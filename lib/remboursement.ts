// Annulation et remboursement d'une commande — point de passage unique pour
// l'interface marchand, les retours (RMA), AXIA et les agents.
//
// - libererCommande : défait ce qu'une commande avait engagé (stock, code promo,
//   commissions d'affiliation non versées). Appelée à l'annulation et au remboursement.
// - rembourserCommande : rend l'argent d'une commande payée, selon le mode de paiement.
//   En ligne (NotchPay) : remboursement sur le moyen d'origine, portefeuille du marchand
//   et commission Axso repris (lib/wallet.ts). À la livraison : l'argent n'est jamais
//   passé par Axso, le marchand rend les espèces lui-même ; on enregistre le remboursement.
//   Dans les deux cas la vente sort du CA (paiementStatut = REMBOURSE) et les accès
//   digitaux sont coupés (téléchargements et formations exigent un paiement PAYE,
//   les clés de licence sont révoquées).
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { PAIEMENT } from "./commandes";
import { compterVentes, rendreStock } from "./stock";
import { reprendreVenteRemboursee } from "./wallet";
import { rembourserPaiementNotchPay, hasNotchPay } from "./notchpay";
import { notifierMarchand } from "./notifications-marchand";
import { notifierClientWhatsApp } from "./whatsapp";
import { formatMontant } from "./utils";

type Tx = Prisma.TransactionClient;

export type Resultat<T = {}> = ({ ok: true } & T) | { ok: false; status: number; error: string };

/** Défait les engagements d'une commande. Idempotent (chaque étape l'est). */
export async function libererCommande(tx: Tx, p: { commandeId: string; motif: string; restock: boolean }) {
  if (p.restock) await rendreStock(tx, { commandeId: p.commandeId, motif: p.motif });

  // Commissions d'affiliation pas encore versées : rejetées. Une commission déjà
  // versée à l'affilié reste acquise (l'argent est parti).
  const commissions = await tx.commissionAffilie.findMany({ where: { commandeId: p.commandeId, statut: { in: ["pending", "approuvee"] } } });
  for (const c of commissions) {
    await tx.commissionAffilie.update({ where: { id: c.id }, data: { statut: "rejetee" } });
    await tx.affilie.update({
      where: { id: c.affilieId },
      data: { conversions: { decrement: 1 }, commissionTotal: { decrement: c.montantCommission }, commissionPending: { decrement: c.montantCommission } },
    });
  }

  // Code promo rendu (une seule fois : le lien est retiré de la commande).
  const { codePromoId } = await tx.commande.findUniqueOrThrow({ where: { id: p.commandeId }, select: { codePromoId: true } });
  if (codePromoId) {
    await tx.codePromo.updateMany({ where: { id: codePromoId, utilisations: { gt: 0 } }, data: { utilisations: { decrement: 1 } } });
    await tx.commande.update({ where: { id: p.commandeId }, data: { codePromoId: null } });
  }
}

export async function rembourserCommande(p: {
  commandeId: string;
  tenantId: string;
  motif: string;
  /** La marchandise revient en stock (retour accepté, annulation avant envoi). */
  restock: boolean;
}): Promise<Resultat<{ montant: number; enLigne: boolean }>> {
  const commande = await prisma.commande.findUnique({
    where: { id: p.commandeId },
    include: { tenant: { select: { nomBoutique: true, slug: true } } },
  });
  if (!commande || commande.tenantId !== p.tenantId) return { ok: false, status: 404, error: "Commande introuvable" };
  if (commande.paiementStatut === PAIEMENT.REMBOURSE) return { ok: true, montant: commande.montantTotal, enLigne: commande.methodePaiement === "notchpay" };
  if (commande.paiementStatut !== PAIEMENT.PAYE) return { ok: false, status: 400, error: "Cette commande n'a pas été payée : rien à rembourser" };

  const enLigne = commande.methodePaiement === "notchpay";
  if (enLigne && (!hasNotchPay() || !commande.paiementReference)) {
    return { ok: false, status: 503, error: "Remboursement en ligne indisponible (paiement NotchPay introuvable)" };
  }

  // Prise atomique : deux demandes simultanées ne remboursent jamais deux fois.
  const pris = await prisma.commande.updateMany({
    where: { id: commande.id, paiementStatut: PAIEMENT.PAYE },
    data: { paiementStatut: PAIEMENT.REMBOURSE },
  });
  if (pris.count === 0) return { ok: true, montant: commande.montantTotal, enLigne };

  if (enLigne) {
    try {
      await rembourserPaiementNotchPay(commande.paiementReference!, p.motif);
    } catch (err: any) {
      // NotchPay a refusé : rien n'a bougé, la commande redevient payée.
      await prisma.commande.update({ where: { id: commande.id }, data: { paiementStatut: PAIEMENT.PAYE } });
      return { ok: false, status: 502, error: `Remboursement refusé par NotchPay : ${err?.message ?? "erreur inconnue"}` };
    }
    await reprendreVenteRemboursee({ tenantId: commande.tenantId, commandeId: commande.id, numero: commande.numero, reference: commande.paiementReference ?? undefined });
  }

  await prisma.$transaction(async (tx) => {
    await compterVentes(tx, commande.id, -1);
    await libererCommande(tx, { commandeId: commande.id, motif: `Remboursement #${commande.numero}`, restock: p.restock });
    await tx.cleLicence.updateMany({ where: { commandeId: commande.id, statut: "vendue" }, data: { statut: "revoquee" } });
  });

  await notifierMarchand({
    tenantId: commande.tenantId,
    type: "commande_remboursee",
    titre: `Commande #${commande.numero} remboursée`,
    message: enLigne
      ? `${formatMontant(commande.montantTotal, commande.devise)} renvoyés au client via NotchPay, repris sur ton portefeuille.`
      : `Paiement à la livraison : rends ${formatMontant(commande.montantTotal, commande.devise)} au client en espèces.`,
    lien: `/dashboard/commandes/${commande.id}`,
    commandeId: commande.id,
  }).catch(() => {});
  await notifierClientWhatsApp({
    telephone: commande.clientTelephone,
    statut: enLigne ? "rembourse_en_ligne" : "rembourse_especes",
    numero: commande.numero,
    boutique: commande.tenant.nomBoutique,
    slug: commande.tenant.slug,
    trackingToken: commande.trackingToken,
    tenantId: commande.tenantId,
  }).catch(() => {});

  return { ok: true, montant: commande.montantTotal, enLigne };
}

// ─── Retours (RMA) — interface, AXIA et agents ───────────────────────────────

/** Ouvre un retour sur une commande de la boutique (statut de la commande inchangé). */
export async function creerRetour(p: {
  tenantId: string;
  commande: string; // id ou numéro
  raison: string;
  description?: string | null;
  type?: "remboursement" | "echange" | "avoir";
  preuveUrls?: string[];
}): Promise<Resultat<{ retour: { id: string }; numero: string }>> {
  const commande = await prisma.commande.findFirst({
    where: { tenantId: p.tenantId, OR: [{ id: p.commande }, { numero: { equals: p.commande, mode: "insensitive" } }] },
    select: { id: true, numero: true, statut: true, clientNom: true, clientEmail: true, montantTotal: true },
  });
  if (!commande) return { ok: false, status: 404, error: `Commande introuvable : « ${p.commande} »` };
  if (commande.statut !== "livree") {
    return { ok: false, status: 400, error: `La commande ${commande.numero} n'est pas livrée (${commande.statut}) : annule-la plutôt que d'ouvrir un retour.` };
  }
  const retour = await prisma.retourRMA.create({
    data: {
      tenantId: p.tenantId, commandeId: commande.id, clientNom: commande.clientNom, clientEmail: commande.clientEmail,
      raison: p.raison, description: p.description ?? null, type: p.type ?? "remboursement",
      montant: commande.montantTotal, preuveUrls: p.preuveUrls ?? [],
    },
  });
  return { ok: true, retour, numero: commande.numero };
}

/**
 * Fait avancer un retour. Accepter un retour « remboursement » rembourse la
 * commande en entier (argent, stock, accès digitaux) : si le remboursement
 * échoue, le retour n'est pas accepté.
 */
export async function mettreAJourRetour(p: {
  tenantId: string;
  retourId: string;
  statut?: string;
  notes?: string | null;
}): Promise<Resultat<{ retour: { id: string; statut: string; type: string } }>> {
  const existant = await prisma.retourRMA.findFirst({ where: { id: p.retourId, tenantId: p.tenantId } });
  if (!existant) return { ok: false, status: 404, error: "Retour introuvable" };
  // Un remboursement effectué ne se défait pas : le retour ne peut plus qu'être clos.
  if (existant.statut === "accepte" && existant.type === "remboursement" && p.statut && !["accepte", "clos"].includes(p.statut)) {
    return { ok: false, status: 400, error: "Ce retour a déjà été remboursé : il ne peut plus qu'être clos" };
  }

  if (p.statut === "accepte" && existant.statut !== "accepte" && existant.type === "remboursement") {
    const r = await rembourserCommande({ commandeId: existant.commandeId, tenantId: p.tenantId, motif: `Retour accepté : ${existant.raison}`, restock: true });
    if (!r.ok) return r;
  }

  const retour = await prisma.retourRMA.update({
    where: { id: existant.id },
    data: { ...(p.statut ? { statut: p.statut } : {}), ...(p.notes !== undefined ? { notes: p.notes } : {}) },
  });
  return { ok: true, retour };
}
