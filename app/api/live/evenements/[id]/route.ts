// Console organisateur d'un événement (ou d'une séance de bootcamp) : détail, inscrits vs
// participants, Q&R, sondages, ressources, plan de secours, annulation / reprogrammation
// notifiées, replay (et sa vente comme formation), présences, attestations.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { tenantOuRefus, zSeance, donneesSeance, zDateLocale, zLien } from "@/lib/live/api";
import { notifierInscrits, annulerInscription, delivrerCertificatLive, inscrire, envoyerConfirmationInscription } from "@/lib/live/service";
import { dateDansFuseau, formaterDate, seances, placesRestantes } from "@/lib/live/regles";
import { FOURNISSEURS, type CleFournisseur } from "@/lib/live/visio";
import { slugify } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

async function charger(id: string, tenantId: string) {
  return prisma.evenement.findFirst({ where: { id, tenantId }, include: { produit: { select: { id: true, nom: true, prix: true, actif: true, slug: true } }, bootcamp: { select: { id: true, produitId: true } } } });
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const t = await tenantOuRefus();
  if (t instanceof NextResponse) return t;
  const { id } = await params;
  const ev = await charger(id, t.tenantId);
  if (!ev) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const ouInscrits = ev.bootcampId ? { bootcampId: ev.bootcampId } : { evenementId: ev.id };
  const [inscrits, presences, questions, sondages, tenant] = await Promise.all([
    prisma.inscriptionLive.findMany({ where: ouInscrits, orderBy: { createdAt: "asc" }, select: { id: true, nom: true, email: true, statut: true, role: true, commandeId: true, createdAt: true } }),
    prisma.presenceLive.findMany({ where: { evenementId: ev.id }, select: { inscriptionId: true, occurrence: true, source: true, rejointAt: true } }),
    prisma.questionLive.findMany({ where: { evenementId: ev.id }, orderBy: { createdAt: "desc" } }),
    prisma.sondageLive.findMany({ where: { evenementId: ev.id }, orderBy: { createdAt: "desc" }, include: { votes: { select: { option: true } } } }),
    prisma.tenant.findUnique({ where: { id: t.tenantId }, select: { slug: true } }),
  ]);
  const f = FOURNISSEURS[ev.fournisseur as CleFournisseur];
  return NextResponse.json({
    evenement: { ...ev, seances: seances(ev), placesRestantes: placesRestantes(ev.capacite, ev.placesPrises) },
    fournisseur: f ? { cle: f.cle, nom: f.nom, limites: f.limites, configure: f.configure() } : null,
    slug: tenant?.slug,
    inscrits, presences, questions,
    sondages: sondages.map(({ votes, ...s }) => ({ ...s, resultats: s.options.map((_, i) => votes.filter((v) => v.option === i).length) })),
  });
}

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("modifier"), seance: zSeance.partial(), capacite: z.number().int().min(1).max(100_000).nullable().optional(), certificat: z.boolean().optional(), prix: z.number().min(0).optional(), publier: z.boolean().optional() }),
  z.object({ action: z.literal("statut"), statut: z.enum(["programme", "en_direct", "termine"]) }),
  z.object({ action: z.literal("annuler"), raison: z.string().trim().min(3).max(1000) }),
  z.object({ action: z.literal("reprogrammer"), debut: zDateLocale, message: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("secours"), lienSecours: zLien.nullable(), messageSecours: z.string().trim().max(1000).nullable(), notifier: z.boolean().default(true) }),
  z.object({ action: z.literal("ressources"), ressources: z.array(z.object({ titre: z.string().trim().min(1).max(120), url: zLien })).max(30) }),
  z.object({ action: z.literal("repondre"), questionId: z.string().max(40), reponse: z.string().trim().max(3000).nullable(), masquer: z.boolean().optional() }),
  z.object({ action: z.literal("sondage"), question: z.string().trim().min(3).max(300), options: z.array(z.string().trim().min(1).max(120)).min(2).max(6) }),
  z.object({ action: z.literal("fermer_sondage"), sondageId: z.string().max(40), ouvert: z.boolean() }),
  z.object({ action: z.literal("replay"), replayUrl: zLien.nullable() }),
  z.object({ action: z.literal("vendre_replay"), prix: z.number().min(1).max(100_000_000) }),
  z.object({ action: z.literal("presence"), inscriptionId: z.string().max(40), occurrence: z.number().int().min(0).max(51).default(0), present: z.boolean() }),
  z.object({ action: z.literal("desinscrire"), inscriptionId: z.string().max(40) }),
  z.object({ action: z.literal("inviter"), nom: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200) }),
  z.object({ action: z.literal("certificats") }),
  z.object({ action: z.literal("supprimer") }),
]);

export async function POST(req: NextRequest, { params }: Ctx) {
  const t = await tenantOuRefus();
  if (t instanceof NextResponse) return t;
  const { id } = await params;
  const ev = await charger(id, t.tenantId);
  if (!ev) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const p = Action.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Requête invalide" }, { status: 400 });
  const a = p.data;
  const ok = (extra: object = {}) => NextResponse.json({ ok: true, ...extra });

  switch (a.action) {
    case "modifier": {
      const d = donneesSeance(a.seance, ev);
      if ("erreur" in d) return NextResponse.json({ error: d.erreur }, { status: 400 });
      if (a.capacite !== undefined && a.capacite !== null && a.capacite < ev.placesPrises) return NextResponse.json({ error: `Capacité inférieure aux ${ev.placesPrises} places déjà prises` }, { status: 400 });
      await prisma.evenement.update({ where: { id }, data: { ...(d.data as any), ...(a.capacite !== undefined ? { capacite: a.capacite } : {}), ...(a.certificat !== undefined ? { certificat: a.certificat } : {}) } });
      if (ev.produitId && (a.prix !== undefined || a.publier !== undefined || a.seance.titre || a.seance.description !== undefined)) {
        await prisma.produit.update({ where: { id: ev.produitId }, data: { ...(a.prix !== undefined ? { prix: a.prix } : {}), ...(a.publier !== undefined ? { actif: a.publier } : {}), ...(a.seance.titre ? { nom: a.seance.titre } : {}), ...(a.seance.description !== undefined ? { description: a.seance.description } : {}) } });
      }
      return ok();
    }
    case "statut":
      await prisma.evenement.update({ where: { id }, data: { statut: a.statut } });
      return ok();
    case "annuler": {
      if (ev.statut === "annule") return ok({ notifies: 0 });
      await prisma.evenement.update({ where: { id }, data: { statut: "annule", annuleAt: new Date(), raisonAnnulation: a.raison } });
      // Les places payées ne sont PAS remboursées automatiquement : le marchand rembourse chaque commande (NotchPay) depuis Commandes.
      const n = await notifierInscrits(id, `Annulé : ${ev.titre}`, (lien) => `Bonjour,\n\n« ${ev.titre} » prévu le ${formaterDate(ev.debut, ev.fuseau)} est annulé.\nMotif : ${a.raison}\n\nSi vous avez payé, l'organisateur vous contactera pour le remboursement.\nVotre espace : ${lien}`);
      const payees = await prisma.inscriptionLive.count({ where: { evenementId: id, statut: "inscrite", commandeId: { not: null } } });
      return ok({ notifies: n, aRembourser: payees });
    }
    case "reprogrammer": {
      const debut = dateDansFuseau(a.debut, ev.fuseau);
      await prisma.evenement.update({ where: { id }, data: { debut, statut: "programme", annuleAt: null, raisonAnnulation: null } });
      // Nouveaux rappels : le journal est par date de séance, on l'efface pour cet événement.
      await prisma.rappelLive.deleteMany({ where: { cle: { startsWith: `${id}:` } } });
      const n = await notifierInscrits(id, `Nouvelle date : ${ev.titre}`, (lien) => `Bonjour,\n\n« ${ev.titre} » est reprogrammé.\nAncienne date : ${formaterDate(ev.debut, ev.fuseau)}\nNouvelle date : ${formaterDate(debut, ev.fuseau)}\n${a.message ? `\n${a.message}\n` : ""}\nVotre place est conservée. Votre espace : ${lien}`);
      return ok({ notifies: n });
    }
    case "secours": {
      await prisma.evenement.update({ where: { id }, data: { lienSecours: a.lienSecours, messageSecours: a.messageSecours } });
      // Le lien de secours n'est jamais dans l'e-mail : l'inscrit le voit dans son espace (fenêtre d'accès).
      const n = a.notifier && (a.lienSecours || a.messageSecours)
        ? await notifierInscrits(id, `Important : ${ev.titre}`, (lien) => `Bonjour,\n\n${a.messageSecours || "La salle a changé."}\n\nLe nouveau lien de connexion est dans votre espace : ${lien}`)
        : 0;
      return ok({ notifies: n });
    }
    case "ressources":
      await prisma.evenement.update({ where: { id }, data: { ressources: a.ressources } });
      return ok();
    case "repondre": {
      const { count } = await prisma.questionLive.updateMany({ where: { id: a.questionId, evenementId: id }, data: { reponse: a.reponse, statut: a.masquer ? "masquee" : a.reponse ? "repondue" : "ouverte" } });
      return count ? ok() : NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }
    case "sondage": {
      const s = await prisma.sondageLive.create({ data: { evenementId: id, question: a.question, options: a.options } });
      return ok({ id: s.id });
    }
    case "fermer_sondage":
      await prisma.sondageLive.updateMany({ where: { id: a.sondageId, evenementId: id }, data: { ouvert: a.ouvert } });
      return ok();
    case "replay":
      await prisma.evenement.update({ where: { id }, data: { replayUrl: a.replayUrl } });
      return ok();
    case "vendre_replay": {
      // Le replay se vend comme une formation (une leçon vidéo) : même livraison, même accès à vie.
      if (!ev.replayUrl) return NextResponse.json({ error: "Ajoute d'abord l'adresse du replay" }, { status: 400 });
      if (ev.replayProduitId) return ok({ produitId: ev.replayProduitId });
      const u = new URL(ev.replayUrl);
      const videoType = /youtu\.?be/.test(u.hostname) ? "youtube" : /vimeo\.com$/.test(u.hostname) ? "vimeo" : u.hostname.endsWith(".blob.vercel-storage.com") ? "upload" : "iframe";
      const nom = `Replay — ${ev.titre}`.slice(0, 200);
      let slug = slugify(nom) || "replay";
      if (await prisma.produit.findUnique({ where: { tenantId_slug: { tenantId: t.tenantId, slug } } })) slug = `${slug}-${Date.now().toString(36)}`;
      const produit = await prisma.produit.create({
        data: {
          tenantId: t.tenantId, nom, slug, description: ev.description, prix: a.prix, stock: 99999, type: "formation", actif: false, images: [],
          formation: { create: { chapitres: { create: { titre: "Replay", lecons: { create: { titre: ev.titre, type: "video", videoType, videoUrl: ev.replayUrl, duree: ev.dureeMin * 60 } } } } } },
        },
      });
      await prisma.evenement.update({ where: { id }, data: { replayProduitId: produit.id } });
      return ok({ produitId: produit.id });
    }
    case "presence": {
      const insc = await prisma.inscriptionLive.findFirst({ where: { id: a.inscriptionId, ...(ev.bootcampId ? { bootcampId: ev.bootcampId } : { evenementId: id }) }, select: { id: true } });
      if (!insc) return NextResponse.json({ error: "Inscrit introuvable" }, { status: 404 });
      const cle = { evenementId_inscriptionId_occurrence: { evenementId: id, inscriptionId: insc.id, occurrence: a.occurrence } };
      if (a.present) await prisma.presenceLive.upsert({ where: cle, create: { evenementId: id, inscriptionId: insc.id, occurrence: a.occurrence, source: "formateur" }, update: {} });
      else await prisma.presenceLive.deleteMany({ where: { evenementId: id, inscriptionId: insc.id, occurrence: a.occurrence } });
      return ok();
    }
    case "desinscrire": {
      const insc = await prisma.inscriptionLive.findFirst({ where: { id: a.inscriptionId, evenementId: id }, select: { id: true } });
      if (!insc) return NextResponse.json({ error: "Inscrit introuvable" }, { status: 404 });
      await annulerInscription(insc.id);
      return ok();
    }
    case "inviter": {
      // Place offerte par l'organisateur (invité, intervenant) : compte dans la capacité.
      if (ev.bootcampId) return NextResponse.json({ error: "Invite depuis le bootcamp" }, { status: 400 });
      const r = await inscrire({ tenantId: t.tenantId, cible: { evenementId: id }, nom: a.nom, email: a.email });
      if (!r.ok) return NextResponse.json({ error: r.raison === "complet" ? "Complet" : "Inscription impossible" }, { status: 409 });
      if (!r.deja) await envoyerConfirmationInscription(r.inscription.id);
      return ok();
    }
    case "certificats": {
      // Attestation de participation : inscrits actifs présents à au moins une séance.
      if (!ev.certificat || !ev.produitId) return NextResponse.json({ error: "Attestation non activée pour cet événement" }, { status: 400 });
      const tenant = await prisma.tenant.findUnique({ where: { id: t.tenantId }, select: { nomBoutique: true } });
      const presents = await prisma.inscriptionLive.findMany({ where: { evenementId: id, statut: "inscrite", presences: { some: {} } }, select: { email: true, nom: true } });
      for (const i of presents) await delivrerCertificatLive({ produitId: ev.produitId, tenantId: t.tenantId, email: i.email, nom: i.nom, titre: ev.titre, boutiqueNom: tenant?.nomBoutique ?? "" });
      return ok({ delivres: presents.length });
    }
    case "supprimer": {
      // Jamais d'effacement d'un événement qui a des places payées : on l'annule à la place.
      const payees = await prisma.inscriptionLive.count({ where: { evenementId: id, commandeId: { not: null } } });
      if (payees) return NextResponse.json({ error: "Des places ont été vendues : annule l'événement plutôt que de le supprimer" }, { status: 409 });
      if (ev.produitId) {
        const lignes = await prisma.ligneCommande.count({ where: { produitId: ev.produitId } });
        if (lignes) await prisma.produit.update({ where: { id: ev.produitId }, data: { actif: false } });
        else {
          await prisma.produit.delete({ where: { id: ev.produitId } }); // cascade : événement, inscriptions…
          // Communauté et créneaux sont rattachés par produitId sans clé étrangère : effacés à la main.
          await prisma.espaceCommunaute.deleteMany({ where: { produitId: ev.produitId } });
          await prisma.creneauMentorat.deleteMany({ where: { produitId: ev.produitId } });
        }
      }
      await prisma.evenement.deleteMany({ where: { id } });
      return ok();
    }
  }
}
