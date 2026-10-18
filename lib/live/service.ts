// Live Academy / Bootcamps — inscriptions, places, notifications, rappels, certificats.
// - Place : prise atomique en SQL (UPDATE … WHERE placesPrises < capacite), dans la même
//   transaction que l'inscription : deux inscriptions simultanées ne dépassent jamais la capacité.
// - Inscription payante : créée par lib/livraison-numerique.ts (commande PAYÉE uniquement),
//   révoquée au remboursement (revoquerInscriptionsCommande), la place est rendue.
// - E-mails : lib/email.ts (envoyerEmailTexte) ; sans Resend, rien n'est marqué envoyé.
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { PAIEMENT } from "../commandes";
import { envoyerEmailTexte, emailReel } from "../email";
import { lienBoutique } from "../origine-site";
import { genererCodeCertificat } from "../formation/regles";
import { eligibleCertificat, formaterDate, rappelsDus, seances, LIBELLE_TYPE } from "./regles";

type Tx = Prisma.TransactionClient;
export const nouveauJetonLive = () => crypto.randomBytes(32).toString("hex");
export const JETON_LIVE = /^[a-f0-9]{64}$/;

export type Cible = { evenementId: string } | { bootcampId: string };
export type ResultatInscription =
  | { ok: true; inscription: { id: string; token: string }; deja: boolean }
  | { ok: false; raison: "complet" | "ferme" | "introuvable" };

/** Prend une place si la capacité le permet (atomique). false = complet. */
async function prendrePlace(tx: Tx, cible: Cible): Promise<boolean> {
  const n = "evenementId" in cible
    ? await tx.$executeRaw`UPDATE "Evenement" SET "placesPrises" = "placesPrises" + 1 WHERE id = ${cible.evenementId} AND statut <> 'annule' AND ("capacite" IS NULL OR "placesPrises" < "capacite")`
    : await tx.$executeRaw`UPDATE "Bootcamp" SET "placesPrises" = "placesPrises" + 1 WHERE id = ${cible.bootcampId} AND ("capacite" IS NULL OR "placesPrises" < "capacite")`;
  return n > 0;
}

async function rendrePlace(tx: Tx, cible: Cible) {
  if ("evenementId" in cible) await tx.$executeRaw`UPDATE "Evenement" SET "placesPrises" = GREATEST("placesPrises" - 1, 0) WHERE id = ${cible.evenementId}`;
  else await tx.$executeRaw`UPDATE "Bootcamp" SET "placesPrises" = GREATEST("placesPrises" - 1, 0) WHERE id = ${cible.bootcampId}`;
}

/**
 * Inscrit une personne (idempotent par e-mail). Une inscription annulée/révoquée est réactivée
 * en reprenant une place. `commandeId` : place payée (livraison numérique).
 */
export async function inscrire(p: { tenantId: string; cible: Cible; nom: string; email: string; commandeId?: string | null }): Promise<ResultatInscription> {
  const email = p.email.trim().toLowerCase();
  const where = "evenementId" in p.cible ? { evenementId: p.cible.evenementId, email } : { bootcampId: p.cible.bootcampId, email };
  try {
    return await prisma.$transaction(async (tx) => {
      const existante = await tx.inscriptionLive.findFirst({ where, select: { id: true, token: true, statut: true, commandeId: true } });
      if (existante?.statut === "inscrite") {
        // Un achat payé arrivé après une inscription gratuite garde la même place.
        if (p.commandeId && !existante.commandeId) await tx.inscriptionLive.update({ where: { id: existante.id }, data: { commandeId: p.commandeId } });
        return { ok: true as const, inscription: existante, deja: true };
      }
      if (!(await prendrePlace(tx, p.cible))) return { ok: false as const, raison: "complet" as const };
      const inscription = existante
        ? await tx.inscriptionLive.update({ where: { id: existante.id }, data: { statut: "inscrite", nom: p.nom, commandeId: p.commandeId ?? existante.commandeId }, select: { id: true, token: true } })
        : await tx.inscriptionLive.create({ data: { tenantId: p.tenantId, ...where, nom: p.nom.trim().slice(0, 120), commandeId: p.commandeId ?? null, token: nouveauJetonLive() }, select: { id: true, token: true } });
      return { ok: true as const, inscription, deja: false };
    });
  } catch (e) {
    // Deux requêtes simultanées pour le même e-mail : l'autre a gagné.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const i = await prisma.inscriptionLive.findFirst({ where, select: { id: true, token: true } });
      if (i) return { ok: true, inscription: i, deja: true };
    }
    throw e;
  }
}

/** Livraison numérique d'un produit « evenement » / « bootcamp » payé. "manque" = complet ou fermé. */
export async function accorderPlaceCommande(commande: { id: string; tenantId?: string; clientEmail: string | null; clientNom?: string | null }, produitId: string): Promise<"ok" | "manque"> {
  const deja = await prisma.inscriptionLive.findFirst({ where: { commandeId: commande.id, statut: "inscrite", OR: [{ evenement: { produitId } }, { bootcamp: { produitId } }] }, select: { id: true } });
  if (deja) return "ok";
  const [ev, bc] = await Promise.all([
    prisma.evenement.findUnique({ where: { produitId }, select: { id: true, tenantId: true, statut: true } }),
    prisma.bootcamp.findUnique({ where: { produitId }, select: { id: true, tenantId: true } }),
  ]);
  const cible: Cible | null = ev && ev.statut !== "annule" ? { evenementId: ev.id } : bc ? { bootcampId: bc.id } : null;
  if (!cible || !emailReel(commande.clientEmail)) return "manque";
  const r = await inscrire({ tenantId: (ev ?? bc)!.tenantId, cible, nom: commande.clientNom || "Participant", email: commande.clientEmail, commandeId: commande.id });
  return r.ok ? "ok" : "manque";
}

/** Contrôle avant paiement (digital-creer) : message de refus, ou null si la place peut être vendue. */
export async function refusVenteLive(produitId: string, prix: number): Promise<string | null> {
  if (!(prix > 0)) return "gratuit : inscrivez-vous directement depuis la page de l'événement";
  const [ev, bc] = await Promise.all([
    prisma.evenement.findUnique({ where: { produitId }, select: { statut: true, capacite: true, placesPrises: true, debut: true, dureeMin: true, recurrence: true } }),
    prisma.bootcamp.findUnique({ where: { produitId }, select: { capacite: true, placesPrises: true, dateFin: true } }),
  ]);
  if (ev) {
    if (ev.statut === "annule") return "événement annulé";
    const fin = seances(ev).at(-1)!.getTime() + ev.dureeMin * 60_000;
    if (ev.statut === "termine" || fin < Date.now()) return "événement terminé";
    if (ev.capacite != null && ev.placesPrises >= ev.capacite) return "complet";
    return null;
  }
  if (bc) {
    if (bc.dateFin.getTime() < Date.now()) return "bootcamp terminé";
    if (bc.capacite != null && bc.placesPrises >= bc.capacite) return "complet";
    return null;
  }
  return "non configuré";
}

/** Remboursement / annulation de commande : places coupées et rendues, certificats live coupés. */
export async function revoquerInscriptionsCommande(tx: Tx, commandeId: string) {
  const liste = await tx.inscriptionLive.findMany({
    where: { commandeId, statut: "inscrite" },
    select: { id: true, email: true, evenementId: true, bootcampId: true, evenement: { select: { produitId: true } }, bootcamp: { select: { produitId: true } } },
  });
  for (const i of liste) {
    await tx.inscriptionLive.update({ where: { id: i.id }, data: { statut: "revoquee" } });
    await rendrePlace(tx, i.evenementId ? { evenementId: i.evenementId } : { bootcampId: i.bootcampId! });
    const produitId = i.evenement?.produitId ?? i.bootcamp?.produitId;
    if (produitId) await tx.certificat.updateMany({ where: { produitId, apprenant: i.email, revoqueAt: null }, data: { revoqueAt: new Date(), revoqueMotif: "Achat remboursé ou annulé", revoquePar: "remboursement" } });
  }
}

/** Désinscription par le formateur (ou l'inscrit d'un événement gratuit) : la place est rendue. */
export async function annulerInscription(id: string) {
  await prisma.$transaction(async (tx) => {
    const i = await tx.inscriptionLive.findUnique({ where: { id }, select: { statut: true, evenementId: true, bootcampId: true } });
    if (!i || i.statut !== "inscrite") return;
    await tx.inscriptionLive.update({ where: { id }, data: { statut: "annulee" } });
    await rendrePlace(tx, i.evenementId ? { evenementId: i.evenementId } : { bootcampId: i.bootcampId! });
  });
}

// ─── Accès d'un inscrit ──────────────────────────────────────────────────────

/** Inscription active : statut « inscrite » et, si payée, commande toujours payée et non annulée. */
export async function chargerInscription(token: string) {
  if (!JETON_LIVE.test(token)) return null;
  const i = await prisma.inscriptionLive.findUnique({
    where: { token },
    include: {
      evenement: { include: { produit: { select: { id: true, nom: true, slug: true } } } },
      bootcamp: { include: { produit: { select: { id: true, nom: true, slug: true } } } },
    },
  });
  if (!i || i.statut !== "inscrite") return null;
  if (i.commandeId) {
    const c = await prisma.commande.findUnique({ where: { id: i.commandeId }, select: { paiementStatut: true, statut: true } });
    if (c?.paiementStatut !== PAIEMENT.PAYE || c.statut === "annulee") return null;
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: i.tenantId }, select: { id: true, slug: true, nomBoutique: true, email: true } });
  return tenant ? { ...i, tenant } : null;
}
export type InscriptionChargee = NonNullable<Awaited<ReturnType<typeof chargerInscription>>>;

export const lienEspace = (slug: string, token: string) => lienBoutique(slug, `/live/${token}`);

// ─── E-mails ─────────────────────────────────────────────────────────────────

async function boutique(tenantId: string) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, nomBoutique: true, email: true } });
  return t ?? { slug: "", nomBoutique: "AXSO", email: null };
}

async function mail(tenantId: string, a: string, sujet: string, texte: string): Promise<boolean> {
  if (!emailReel(a)) return false;
  const b = await boutique(tenantId);
  return envoyerEmailTexte({ a, repondreA: b.email || "noreply@axsoafrica.com", boutique: b.nomBoutique, sujet, texte }).catch(() => false);
}

/** Confirmation d'inscription avec le lien personnel (jamais le lien de salle). */
export async function envoyerConfirmationInscription(inscriptionId: string): Promise<boolean> {
  const i = await prisma.inscriptionLive.findUnique({ where: { id: inscriptionId }, include: { evenement: true, bootcamp: { include: { produit: { select: { nom: true } } } } } });
  if (!i) return false;
  const b = await boutique(i.tenantId);
  const lien = await lienEspace(b.slug, i.token);
  const titre = i.evenement?.titre ?? i.bootcamp?.produit.nom ?? "";
  const quand = i.evenement ? formaterDate(i.evenement.debut, i.evenement.fuseau) : i.bootcamp ? `du ${formaterDate(i.bootcamp.dateDebut, i.bootcamp.fuseau)} au ${formaterDate(i.bootcamp.dateFin, i.bootcamp.fuseau)}` : "";
  return mail(i.tenantId, i.email, `Inscription confirmée : ${titre}`,
    `Bonjour ${i.nom},\n\nVotre inscription à « ${titre} » est confirmée.\nQuand : ${quand}\n\nVotre espace personnel (lien de connexion révélé avant le début, ressources, questions, replay) :\n${lien}\n\nCe lien vous est personnel : ne le partagez pas.\n\n${b.nomBoutique}`);
}

/** Message à tous les inscrits actifs d'un événement (ou du bootcamp d'une séance). Renvoie le nombre d'e-mails partis. */
export async function notifierInscrits(evenementId: string, sujet: string, corps: (lien: string) => string): Promise<number> {
  const ev = await prisma.evenement.findUnique({ where: { id: evenementId }, select: { tenantId: true, bootcampId: true } });
  if (!ev) return 0;
  const inscrits = await prisma.inscriptionLive.findMany({ where: { statut: "inscrite", ...(ev.bootcampId ? { bootcampId: ev.bootcampId } : { evenementId }) }, select: { email: true, token: true } });
  const b = await boutique(ev.tenantId);
  let n = 0;
  for (const i of inscrits) if (await mail(ev.tenantId, i.email, sujet, corps(await lienEspace(b.slug, i.token)))) n++;
  return n;
}

// ─── Rappels (tâche planifiée) ───────────────────────────────────────────────

/**
 * Envoie les rappels dus (lib/live/regles.ts → rappelsDus). Appelée par /api/cron/automatisations :
 * planifiée toutes les 5 min par un planificateur externe, une fois par jour par Vercel (plan Hobby) —
 * dans ce dernier cas seul le rappel du jour (J-1) part à l'heure, les autres sont rattrapés au passage suivant
 * tant que la séance n'a pas commencé. Idempotent : clé unique par inscrit dans RappelLive.
 */
export async function passeRappelsLive(maintenant = new Date()): Promise<{ envoyes: number; echecs: number }> {
  const evenements = await prisma.evenement.findMany({
    where: { statut: { in: ["programme", "en_direct"] }, debut: { gte: new Date(maintenant.getTime() - 365 * 86_400_000), lte: new Date(maintenant.getTime() + 8 * 86_400_000) } },
    take: 200,
  });
  let envoyes = 0, echecs = 0;
  for (const ev of evenements) {
    if (!rappelsDus(ev, new Set(), maintenant).length) continue;
    const inscrits = await prisma.inscriptionLive.findMany({ where: { statut: "inscrite", ...(ev.bootcampId ? { bootcampId: ev.bootcampId } : { evenementId: ev.id }) }, select: { id: true, email: true, nom: true, token: true, rappels: { select: { cle: true } } } });
    const b = await boutique(ev.tenantId);
    for (const i of inscrits) {
      const deja = new Set(i.rappels.map((r) => r.cle.replace(/:[^:]+$/, "")));
      for (const r of rappelsDus(ev, deja, maintenant)) {
        // La ligne est créée AVANT l'envoi : un passage concurrent échoue sur la clé unique au lieu de doubler l'e-mail.
        try { await prisma.rappelLive.create({ data: { inscriptionId: i.id, cle: `${r.cle}:${i.id}` } }); } catch { continue; }
        const debut = seances(ev)[r.occurrence];
        const delai = r.minutes >= 1440 ? `dans ${Math.round(r.minutes / 1440)} jour(s)` : r.minutes >= 60 ? `dans ${Math.round(r.minutes / 60)} h` : `dans ${r.minutes} min`;
        const ok = await mail(ev.tenantId, i.email, `Rappel : ${ev.titre} commence ${delai}`,
          `Bonjour ${i.nom},\n\n« ${ev.titre} » (${LIBELLE_TYPE[ev.type] ?? "Événement"}) commence ${delai} : ${formaterDate(debut, ev.fuseau)}.\n\nRejoindre depuis votre espace (le lien de connexion s'affiche ${ev.ouvertureMin} min avant) :\n${await lienEspace(b.slug, i.token)}\n\n${b.nomBoutique}`);
        // Échec d'envoi vers une vraie adresse (Resend indisponible…) : la ligne est retirée pour que le
        // passage suivant réessaie, tant que la séance n'a pas commencé (rappelsDus s'arrête au début).
        if (!ok && emailReel(i.email)) await prisma.rappelLive.delete({ where: { cle: `${r.cle}:${i.id}` } }).catch(() => null);
        else await prisma.rappelLive.update({ where: { cle: `${r.cle}:${i.id}` }, data: { ok } });
        if (ok) envoyes++; else echecs++;
      }
    }
  }
  return { envoyes, echecs };
}

// ─── Bootcamp : progression et certificat ────────────────────────────────────

export async function progressionBootcamp(bootcampId: string, inscriptionId: string) {
  const bc = await prisma.bootcamp.findUniqueOrThrow({ where: { id: bootcampId }, include: { sessions: { select: { id: true, debut: true, recurrence: true, statut: true } }, missions: { select: { id: true } } } });
  const sessionsPassees = bc.sessions.filter((s) => s.statut !== "annule" && s.debut <= new Date());
  const [presences, validees] = await Promise.all([
    prisma.presenceLive.count({ where: { inscriptionId, evenementId: { in: sessionsPassees.map((s) => s.id) } } }),
    prisma.livrableBootcamp.count({ where: { inscriptionId, statut: "valide", missionId: { in: bc.missions.map((m) => m.id) } } }),
  ]);
  // Le certificat se juge sur toutes les séances non annulées, pas seulement celles déjà passées.
  const seancesTotal = bc.sessions.filter((s) => s.statut !== "annule").length;
  return {
    ...eligibleCertificat({ seancesTotal, presences, missionsTotal: bc.missions.length, missionsValidees: validees, seuilPresence: bc.seuilPresence, seuilMissions: bc.seuilMissions }),
    presences, seancesTotal, seancesPassees: sessionsPassees.length, missionsValidees: validees, missionsTotal: bc.missions.length,
  };
}

/** Attestation (modèle Certificat du cœur pédagogique, vérifiable sur /certificat/<code>). */
export async function delivrerCertificatLive(p: { produitId: string; tenantId: string; email: string; nom: string; titre: string; boutiqueNom: string }) {
  const where = { produitId_apprenant: { produitId: p.produitId, apprenant: p.email } };
  const existant = await prisma.certificat.findUnique({ where });
  if (existant && (!existant.revoqueAt || existant.revoquePar !== "remboursement")) return existant;
  if (existant) return prisma.certificat.update({ where: { id: existant.id }, data: { revoqueAt: null, revoqueMotif: null, revoquePar: null } });
  try {
    return await prisma.certificat.create({ data: { code: genererCodeCertificat(), produitId: p.produitId, tenantId: p.tenantId, apprenant: p.email, nom: p.nom, formationTitre: p.titre, boutiqueNom: p.boutiqueNom } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return prisma.certificat.findUnique({ where });
    throw e;
  }
}

/** Copie un bootcamp (missions, séances, jalons décalés) pour une nouvelle cohorte. Produit en brouillon. */
export async function dupliquerBootcamp(bootcampId: string, tenantId: string, nouveauDebut: Date, cohorte: string) {
  const src = await prisma.bootcamp.findFirst({ where: { id: bootcampId, tenantId }, include: { produit: true, missions: true, sessions: true } });
  if (!src) return null;
  const decalage = nouveauDebut.getTime() - src.dateDebut.getTime();
  const plus = (d: Date | null) => (d ? new Date(d.getTime() + decalage) : null);
  const { id: _i, createdAt: _c, updatedAt: _u, ventes: _v, vues: _w, ...produit } = src.produit;
  return prisma.$transaction(async (tx) => {
    const p = await tx.produit.create({
      data: { ...produit, faq: produit.faq ?? undefined, champsCommande: produit.champsCommande ?? undefined, nom: `${src.produit.nom} — ${cohorte}`.slice(0, 200), slug: `${src.produit.slug}-${Date.now().toString(36)}`, actif: false, sku: null, codeBarres: null },
    });
    const bc = await tx.bootcamp.create({
      data: {
        tenantId, produitId: p.id, cohorte, dateDebut: nouveauDebut, dateFin: plus(src.dateFin)!, fuseau: src.fuseau, capacite: src.capacite,
        seuilPresence: src.seuilPresence, seuilMissions: src.seuilMissions, certificat: src.certificat, modeleDeId: src.id,
        jalons: (Array.isArray(src.jalons) ? src.jalons : []).map((j: any) => ({ ...j, date: j?.date ? plus(new Date(j.date))!.toISOString() : null })),
      },
    });
    for (const m of src.missions) await tx.missionBootcamp.create({ data: { bootcampId: bc.id, titre: m.titre, consigne: m.consigne, echeance: plus(m.echeance), ordre: m.ordre } });
    for (const s of src.sessions) {
      await tx.evenement.create({
        data: {
          tenantId, bootcampId: bc.id, type: "session", titre: s.titre, description: s.description, intervenants: s.intervenants ?? [], debut: plus(s.debut)!, dureeMin: s.dureeMin,
          fuseau: s.fuseau, fournisseur: s.fournisseur, salleId: s.fournisseur === "jitsi" ? `axso-${crypto.randomBytes(16).toString("hex")}` : null,
          ouvertureMin: s.ouvertureMin, rappels: s.rappels, ressources: s.ressources ?? [],
        },
      });
    }
    return bc;
  });
}
