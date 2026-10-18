// Espace personnel d'un inscrit (jeton de 256 bits = seule autorisation, comme une formation).
// GET : état (le lien de salle n'y figure JAMAIS) ; ?certificat=1 : attestation PDF.
// POST : rejoindre (révèle la salle dans la fenêtre d'accès et note la présence), question,
// vote, dépôt de livrable (envoi direct Vercel Blob limité au dossier de l'inscrit).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { chargerInscription, progressionBootcamp, delivrerCertificatLive, type InscriptionChargee } from "@/lib/live/service";
import { fenetreAcces, seances } from "@/lib/live/regles";
import { salle, lienValide } from "@/lib/live/visio";
import { dossierBoutique, SOUS_DOSSIER_DIGITAL } from "@/lib/fichiers-boutique";
import { TYPES_FICHIERS, TAILLE_MAX } from "@/lib/types-fichiers";
import { estFichierBlob } from "@/lib/livraison-numerique";
import { pdfCertificat } from "@/lib/formation/certificat-pdf";
import { lienBoutique } from "@/lib/origine-site";

type Ctx = { params: Promise<{ token: string }> };
const limite = rateLimit({ windowMs: 60_000, max: 60, keyPrefix: "live-acces" });
const refus = () => NextResponse.json({ error: "Accès invalide, annulé ou remboursé" }, { status: 404 });
const dossierLivrables = (i: { tenantId: string; id: string }) => `${dossierBoutique(i.tenantId)}${SOUS_DOSSIER_DIGITAL}livrables/${i.id}/`;

async function preambule(req: NextRequest, token: string): Promise<InscriptionChargee | NextResponse> {
  const rl = limite.check(getClientIp(req));
  if (!rl.success) return rateLimitResponse(rl.reset);
  return (await chargerInscription(token)) ?? refus();
}

/** Séance visée : l'événement de l'inscription, ou une séance de SON bootcamp. */
async function seanceDe(i: InscriptionChargee, sessionId?: string) {
  if (i.evenement) return i.evenement;
  if (!sessionId || !i.bootcampId) return null;
  return prisma.evenement.findFirst({ where: { id: sessionId, bootcampId: i.bootcampId } });
}

async function attestation(i: InscriptionChargee) {
  const produitId = i.evenement?.produitId ?? i.bootcamp?.produitId;
  if (!produitId) return { active: false, eligible: false, code: null as string | null };
  const active = i.evenement ? i.evenement.certificat : !!i.bootcamp?.certificat;
  if (!active) return { active, eligible: false, code: null };
  const eligible = i.bootcamp
    ? (await progressionBootcamp(i.bootcamp.id, i.id)).eligible
    : (await prisma.presenceLive.count({ where: { inscriptionId: i.id } })) > 0 && (i.evenement!.statut === "termine" || seances(i.evenement!).at(-1)!.getTime() < Date.now());
  const c = await prisma.certificat.findUnique({ where: { produitId_apprenant: { produitId, apprenant: i.email } } });
  return { active, eligible, code: c && !c.revoqueAt ? c.code : null };
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const i = await preambule(req, token);
  if (i instanceof NextResponse) return i;

  if (req.nextUrl.searchParams.get("certificat")) {
    const etat = await attestation(i);
    if (!etat.active || !etat.eligible) return NextResponse.json({ error: "Attestation pas encore obtenue" }, { status: 403 });
    const c = await delivrerCertificatLive({ produitId: (i.evenement?.produitId ?? i.bootcamp?.produitId)!, tenantId: i.tenantId, email: i.email, nom: i.nom, titre: i.evenement?.titre ?? i.bootcamp!.produit.nom, boutiqueNom: i.tenant.nomBoutique });
    if (!c || c.revoqueAt) return NextResponse.json({ error: "Attestation révoquée" }, { status: 403 });
    const pdf = await pdfCertificat({ ...c, lienVerification: await lienBoutique(i.tenant.slug, `/certificat/${c.code}`) });
    return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="attestation-${c.code}.pdf"`, "Cache-Control": "private, no-store" } });
  }

  const vue = (ev: NonNullable<Awaited<ReturnType<typeof seanceDe>>>) => {
    const f = fenetreAcces(ev, true);
    return {
      id: ev.id, titre: ev.titre, type: ev.type, description: ev.description, intervenants: ev.intervenants, debut: ev.debut, dureeMin: ev.dureeMin, fuseau: ev.fuseau,
      seances: seances(ev), statut: ev.statut, raisonAnnulation: ev.raisonAnnulation, ouvertureMin: ev.ouvertureMin,
      acces: f.ouvert ? { ouvert: true } : { ouvert: false, raison: f.raison, ouvreA: f.ouvreA ?? null },
      // Secours et ressources : réservés aux inscrits (on est dans leur espace), le lien de secours seulement salle ouverte.
      messageSecours: ev.messageSecours, ressources: ev.ressources, replayUrl: ev.statut === "annule" ? null : ev.replayUrl,
    };
  };
  const moi = { nom: i.nom, role: i.role, boutique: i.tenant.nomBoutique, slug: i.tenant.slug };

  if (i.evenement) {
    const [questions, sondages, votes] = await Promise.all([
      prisma.questionLive.findMany({ where: { evenementId: i.evenement.id, OR: [{ inscriptionId: i.id }, { statut: "repondue" }] }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, texte: true, reponse: true, statut: true, auteurNom: true, inscriptionId: true } }),
      prisma.sondageLive.findMany({ where: { evenementId: i.evenement.id }, orderBy: { createdAt: "desc" }, include: { votes: { select: { option: true } } } }),
      prisma.voteSondageLive.findMany({ where: { inscriptionId: i.id }, select: { sondageId: true, option: true } }),
    ]);
    return NextResponse.json({
      moi, produitId: i.evenement.produitId, evenement: vue(i.evenement), attestation: await attestation(i),
      questions: questions.map(({ inscriptionId, ...q }) => ({ ...q, moi: inscriptionId === i.id })),
      sondages: sondages.map(({ votes: v, ...s }) => {
        const monVote = votes.find((x) => x.sondageId === s.id)?.option ?? null;
        // Résultats visibles après avoir voté ou à la clôture.
        return { ...s, monVote, resultats: monVote !== null || !s.ouvert ? s.options.map((_, k) => v.filter((x) => x.option === k).length) : null };
      }),
    });
  }

  const bc = i.bootcamp!;
  const [sessions, missions, progression] = await Promise.all([
    prisma.evenement.findMany({ where: { bootcampId: bc.id }, orderBy: { debut: "asc" } }),
    prisma.missionBootcamp.findMany({ where: { bootcampId: bc.id }, orderBy: [{ ordre: "asc" }, { createdAt: "asc" }], include: { livrables: { where: { inscriptionId: i.id } } } }),
    progressionBootcamp(bc.id, i.id),
  ]);
  return NextResponse.json({
    moi, produitId: bc.produitId,
    bootcamp: { nom: bc.produit.nom, cohorte: bc.cohorte, dateDebut: bc.dateDebut, dateFin: bc.dateFin, fuseau: bc.fuseau, jalons: bc.jalons, seuilPresence: bc.seuilPresence, seuilMissions: bc.seuilMissions },
    sessions: sessions.map(vue), progression, attestation: await attestation(i), dossierDepot: dossierLivrables(i),
    missions: missions.map(({ livrables, ...m }) => ({ ...m, livrable: livrables[0] ?? null })),
  });
}

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rejoindre"), sessionId: z.string().max(40).optional() }),
  z.object({ action: z.literal("question"), texte: z.string().trim().min(3).max(1000) }),
  z.object({ action: z.literal("voter"), sondageId: z.string().max(40), option: z.number().int().min(0).max(5) }),
  z.object({ action: z.literal("livrable"), missionId: z.string().max(40), fichierUrl: z.string().url().max(2000).optional(), fichierNom: z.string().max(200).optional(), lien: z.string().max(1000).optional(), texte: z.string().max(10_000).optional() }),
]);

export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const i = await preambule(req, token);
  if (i instanceof NextResponse) return i;
  const corps = await req.json().catch(() => null);

  // Envoi direct d'un livrable vers Vercel Blob : jeton d'envoi limité au dossier de CET inscrit.
  if (typeof corps?.type === "string" && corps.type.startsWith("blob.")) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Stockage non configuré" }, { status: 503 });
    if (!i.bootcampId) return refus();
    try {
      return NextResponse.json(await handleUpload({
        body: corps as HandleUploadBody, request: req,
        onBeforeGenerateToken: async (chemin) => {
          if (!chemin.startsWith(dossierLivrables(i)) || chemin.includes("..")) throw new Error("Dossier non autorisé");
          return { allowedContentTypes: [...TYPES_FICHIERS.document, ...TYPES_FICHIERS.image, "video/mp4"], maximumSizeInBytes: TAILLE_MAX.document.octets, addRandomSuffix: true };
        },
        onUploadCompleted: async () => {},
      }));
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Envoi impossible" }, { status: 400 });
    }
  }

  const p = Action.safeParse(corps);
  if (!p.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const a = p.data;

  switch (a.action) {
    case "rejoindre": {
      const ev = await seanceDe(i, a.sessionId);
      if (!ev) return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
      const f = fenetreAcces(ev, true);
      if (!f.ouvert) return NextResponse.json({ error: f.raison === "trop_tot" ? "La salle n'est pas encore ouverte" : f.raison === "annule" ? "Événement annulé" : "Événement terminé", ...f }, { status: 403 });
      const s = salle(ev, i.nom);
      // Présence : l'inscrit a demandé à entrer pendant la fenêtre (meilleure mesure possible sans API du fournisseur).
      await prisma.presenceLive.upsert({
        where: { evenementId_inscriptionId_occurrence: { evenementId: ev.id, inscriptionId: i.id, occurrence: f.occurrence } },
        create: { evenementId: ev.id, inscriptionId: i.id, occurrence: f.occurrence }, update: {},
      });
      return NextResponse.json({ salle: s, secours: lienValide(ev.lienSecours) ? ev.lienSecours : null, messageSecours: ev.messageSecours });
    }
    case "question": {
      if (!i.evenement) return NextResponse.json({ error: "Questions : utilisez la communauté du bootcamp" }, { status: 400 });
      const n = await prisma.questionLive.count({ where: { inscriptionId: i.id } });
      if (n >= 20) return NextResponse.json({ error: "Limite de questions atteinte" }, { status: 429 });
      await prisma.questionLive.create({ data: { evenementId: i.evenement.id, inscriptionId: i.id, auteurNom: i.nom, texte: a.texte } });
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    case "voter": {
      const s = i.evenement ? await prisma.sondageLive.findFirst({ where: { id: a.sondageId, evenementId: i.evenement.id, ouvert: true } }) : null;
      if (!s || a.option >= s.options.length) return NextResponse.json({ error: "Sondage fermé ou introuvable" }, { status: 404 });
      const r = await prisma.voteSondageLive.create({ data: { sondageId: s.id, inscriptionId: i.id, option: a.option } }).catch(() => null);
      return r ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Vous avez déjà voté" }, { status: 409 });
    }
    case "livrable": {
      if (!i.bootcampId) return refus();
      const mission = await prisma.missionBootcamp.findFirst({ where: { id: a.missionId, bootcampId: i.bootcampId } });
      if (!mission) return NextResponse.json({ error: "Mission introuvable" }, { status: 404 });
      // Fichier : uniquement un blob de NOTRE stockage, dans le dossier de cet inscrit.
      if (a.fichierUrl && !(estFichierBlob(a.fichierUrl) && decodeURIComponent(new URL(a.fichierUrl).pathname).startsWith(`/${dossierLivrables(i)}`))) return NextResponse.json({ error: "Fichier refusé" }, { status: 400 });
      if (a.lien && !lienValide(a.lien)) return NextResponse.json({ error: "Lien https requis" }, { status: 400 });
      if (!a.fichierUrl && !a.lien && !a.texte?.trim()) return NextResponse.json({ error: "Livrable vide" }, { status: 400 });
      const existant = await prisma.livrableBootcamp.findUnique({ where: { missionId_inscriptionId: { missionId: mission.id, inscriptionId: i.id } } });
      if (existant?.statut === "valide") return NextResponse.json({ error: "Mission déjà validée" }, { status: 409 });
      const data = { fichierUrl: a.fichierUrl ?? null, fichierNom: a.fichierNom?.slice(0, 200) ?? null, lien: a.lien || null, texte: a.texte?.trim() || null, statut: "depose", deposeAt: new Date() };
      await prisma.livrableBootcamp.upsert({ where: { missionId_inscriptionId: { missionId: mission.id, inscriptionId: i.id } }, create: { missionId: mission.id, inscriptionId: i.id, ...data }, update: data });
      return NextResponse.json({ ok: true }, { status: 201 });
    }
  }
}
