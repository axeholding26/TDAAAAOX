// Bootcamp OS — tableau du formateur : séances (événements), missions, livrables et feedback,
// présence, progression par apprenant, jalons, attestations conditionnelles, duplication de cohorte.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { tenantOuRefus, zSeance, donneesSeance, zDateLocale, zFuseau } from "@/lib/live/api";
import { progressionBootcamp, delivrerCertificatLive, dupliquerBootcamp, inscrire, envoyerConfirmationInscription, annulerInscription } from "@/lib/live/service";
import { dateDansFuseau } from "@/lib/live/regles";

type Ctx = { params: Promise<{ id: string }> };

const charger = (id: string, tenantId: string) =>
  prisma.bootcamp.findFirst({ where: { id, tenantId }, include: { produit: { select: { id: true, nom: true, prix: true, actif: true, description: true } } } });

export async function GET(_req: NextRequest, { params }: Ctx) {
  const t = await tenantOuRefus();
  if (t instanceof NextResponse) return t;
  const { id } = await params;
  const bc = await charger(id, t.tenantId);
  if (!bc) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const [sessions, missions, inscrits, tenant] = await Promise.all([
    prisma.evenement.findMany({ where: { bootcampId: id }, orderBy: { debut: "asc" }, select: { id: true, titre: true, debut: true, dureeMin: true, statut: true, fournisseur: true, presences: { select: { inscriptionId: true } } } }),
    prisma.missionBootcamp.findMany({ where: { bootcampId: id }, orderBy: [{ ordre: "asc" }, { createdAt: "asc" }], include: { livrables: { include: { inscription: { select: { nom: true } } } } } }),
    prisma.inscriptionLive.findMany({ where: { bootcampId: id }, orderBy: { createdAt: "asc" }, select: { id: true, nom: true, email: true, statut: true, role: true, commandeId: true } }),
    prisma.tenant.findUnique({ where: { id: t.tenantId }, select: { slug: true } }),
  ]);
  const progression = Object.fromEntries(await Promise.all(inscrits.filter((i) => i.statut === "inscrite").map(async (i) => [i.id, await progressionBootcamp(id, i.id)] as const)));
  return NextResponse.json({ bootcamp: bc, sessions, missions, inscrits, progression, slug: tenant?.slug });
}

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("modifier"), nom: z.string().trim().min(2).max(160).optional(), description: z.string().max(5000).nullable().optional(), cohorte: z.string().trim().max(80).nullable().optional(), dateDebut: zDateLocale.optional(), dateFin: zDateLocale.optional(), fuseau: zFuseau.optional(), prix: z.number().min(0).optional(), capacite: z.number().int().min(1).nullable().optional(), seuilPresence: z.number().int().min(0).max(100).optional(), seuilMissions: z.number().int().min(0).max(100).optional(), certificat: z.boolean().optional(), publier: z.boolean().optional() }),
  z.object({ action: z.literal("session"), seance: zSeance }),
  z.object({ action: z.literal("mission"), missionId: z.string().max(40).optional(), titre: z.string().trim().min(2).max(160), consigne: z.string().max(10_000).nullable().optional(), echeance: zDateLocale.nullable().optional(), ordre: z.number().int().min(0).max(999).optional() }),
  z.object({ action: z.literal("supprimer_mission"), missionId: z.string().max(40) }),
  z.object({ action: z.literal("corriger"), livrableId: z.string().max(40), statut: z.enum(["valide", "a_revoir"]), feedback: z.string().trim().max(5000).nullable().optional(), note: z.number().int().min(0).max(100).nullable().optional() }),
  z.object({ action: z.literal("presence"), sessionId: z.string().max(40), inscriptionId: z.string().max(40), present: z.boolean() }),
  z.object({ action: z.literal("jalons"), jalons: z.array(z.object({ titre: z.string().trim().min(1).max(120), date: zDateLocale })).max(30) }),
  z.object({ action: z.literal("inviter"), nom: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200) }),
  z.object({ action: z.literal("desinscrire"), inscriptionId: z.string().max(40) }),
  z.object({ action: z.literal("certificats") }),
  z.object({ action: z.literal("dupliquer"), dateDebut: zDateLocale, cohorte: z.string().trim().min(1).max(80) }),
]);

export async function POST(req: NextRequest, { params }: Ctx) {
  const t = await tenantOuRefus();
  if (t instanceof NextResponse) return t;
  const { id } = await params;
  const bc = await charger(id, t.tenantId);
  if (!bc) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const p = Action.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  const a = p.data;
  const ok = (extra: object = {}) => NextResponse.json({ ok: true, ...extra });
  const fuseau = bc.fuseau;

  switch (a.action) {
    case "modifier": {
      const f = a.fuseau ?? fuseau;
      await prisma.bootcamp.update({
        where: { id },
        data: {
          ...(a.cohorte !== undefined ? { cohorte: a.cohorte } : {}), ...(a.fuseau ? { fuseau: a.fuseau } : {}),
          ...(a.dateDebut ? { dateDebut: dateDansFuseau(a.dateDebut, f) } : {}), ...(a.dateFin ? { dateFin: dateDansFuseau(a.dateFin, f) } : {}),
          ...(a.capacite !== undefined ? { capacite: a.capacite } : {}), ...(a.seuilPresence !== undefined ? { seuilPresence: a.seuilPresence } : {}),
          ...(a.seuilMissions !== undefined ? { seuilMissions: a.seuilMissions } : {}), ...(a.certificat !== undefined ? { certificat: a.certificat } : {}),
        },
      });
      await prisma.produit.update({ where: { id: bc.produitId }, data: { ...(a.nom ? { nom: a.nom } : {}), ...(a.description !== undefined ? { description: a.description } : {}), ...(a.prix !== undefined ? { prix: a.prix } : {}), ...(a.publier !== undefined ? { actif: a.publier } : {}) } });
      return ok();
    }
    case "session": {
      const d = donneesSeance({ ...a.seance, type: "session", recurrence: null });
      if ("erreur" in d) return NextResponse.json({ error: d.erreur }, { status: 400 });
      const s = await prisma.evenement.create({ data: { ...(d.data as any), tenantId: t.tenantId, bootcampId: id } });
      return ok({ id: s.id });
    }
    case "mission": {
      const data = { titre: a.titre, consigne: a.consigne ?? null, echeance: a.echeance ? dateDansFuseau(a.echeance, fuseau) : null, ...(a.ordre !== undefined ? { ordre: a.ordre } : {}) };
      if (a.missionId) {
        const { count } = await prisma.missionBootcamp.updateMany({ where: { id: a.missionId, bootcampId: id }, data });
        return count ? ok() : NextResponse.json({ error: "Introuvable" }, { status: 404 });
      }
      const m = await prisma.missionBootcamp.create({ data: { ...data, bootcampId: id } });
      return ok({ id: m.id });
    }
    case "supprimer_mission":
      await prisma.missionBootcamp.deleteMany({ where: { id: a.missionId, bootcampId: id } });
      return ok();
    case "corriger": {
      const { count } = await prisma.livrableBootcamp.updateMany({
        where: { id: a.livrableId, mission: { bootcampId: id } },
        data: { statut: a.statut, feedback: a.feedback ?? null, note: a.note ?? null, corrigeAt: new Date() },
      });
      return count ? ok() : NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }
    case "presence": {
      const [s, i] = await Promise.all([
        prisma.evenement.findFirst({ where: { id: a.sessionId, bootcampId: id }, select: { id: true } }),
        prisma.inscriptionLive.findFirst({ where: { id: a.inscriptionId, bootcampId: id }, select: { id: true } }),
      ]);
      if (!s || !i) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
      const cle = { evenementId_inscriptionId_occurrence: { evenementId: s.id, inscriptionId: i.id, occurrence: 0 } };
      if (a.present) await prisma.presenceLive.upsert({ where: cle, create: { evenementId: s.id, inscriptionId: i.id, source: "formateur" }, update: {} });
      else await prisma.presenceLive.deleteMany({ where: { evenementId: s.id, inscriptionId: i.id } });
      return ok();
    }
    case "jalons":
      await prisma.bootcamp.update({ where: { id }, data: { jalons: a.jalons.map((j) => ({ titre: j.titre, date: dateDansFuseau(j.date, fuseau).toISOString() })) } });
      return ok();
    case "inviter": {
      const r = await inscrire({ tenantId: t.tenantId, cible: { bootcampId: id }, nom: a.nom, email: a.email });
      if (!r.ok) return NextResponse.json({ error: r.raison === "complet" ? "Complet" : "Inscription impossible" }, { status: 409 });
      if (!r.deja) await envoyerConfirmationInscription(r.inscription.id);
      return ok();
    }
    case "desinscrire": {
      const i = await prisma.inscriptionLive.findFirst({ where: { id: a.inscriptionId, bootcampId: id }, select: { id: true } });
      if (!i) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
      await annulerInscription(i.id);
      return ok();
    }
    case "certificats": {
      if (!bc.certificat) return NextResponse.json({ error: "Attestation désactivée pour ce bootcamp" }, { status: 400 });
      const tenant = await prisma.tenant.findUnique({ where: { id: t.tenantId }, select: { nomBoutique: true } });
      const inscrits = await prisma.inscriptionLive.findMany({ where: { bootcampId: id, statut: "inscrite" }, select: { id: true, email: true, nom: true } });
      let delivres = 0;
      for (const i of inscrits) {
        if (!(await progressionBootcamp(id, i.id)).eligible) continue;
        await delivrerCertificatLive({ produitId: bc.produitId, tenantId: t.tenantId, email: i.email, nom: i.nom, titre: bc.produit.nom, boutiqueNom: tenant?.nomBoutique ?? "" });
        delivres++;
      }
      return ok({ delivres, inscrits: inscrits.length });
    }
    case "dupliquer": {
      const copie = await dupliquerBootcamp(id, t.tenantId, dateDansFuseau(a.dateDebut, fuseau), a.cohorte);
      return copie ? ok({ id: copie.id }) : NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }
  }
}
