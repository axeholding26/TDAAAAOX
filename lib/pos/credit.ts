// Crédit client (ardoise) — FICHIER AMORCÉ par les fondations, propriété du
// lot « Clients, promotions, fidélité, crédit ».
//
// Les SIGNATURES de `engagerCredit` et `libererCredit` sont figées :
// lib/pos/paiements.ts et lib/pos/vente.ts les appellent. Leur corps est déjà
// fonctionnel (une vente à crédit ne peut pas rester sans trace) ; le lot
// propriétaire y ajoute remboursements, échéances, retards et relances.
//
// Aucun import de ../prisma ni de code serveur (lib/pos/paiements.ts, lu par
// l'écran, importe ce fichier) : tout se fait dans la transaction de
// l'appelant, et c'est la ROUTE qui écrit l'audit et publie l'événement.
// Client.creditUtilise = ce que le client doit ; MouvementCredit en est le
// journal (montant signé : + vente à crédit, − remboursement ou annulation).
//
// ÉCHÉANCES ET RETARDS — chaque vente à crédit porte sa date d'échéance
// (MouvementCredit.echeanceAt). Ce qu'il reste dû d'une vente = somme de ses
// mouvements. Une vente non soldée dont l'échéance est passée est EN RETARD.
// BLOCAGE AUTOMATIQUE — un client en retard ne peut plus acheter à crédit tant
// qu'il n'a pas réglé ce retard (en plus du plafond et du blocage manuel
// Client.creditBloque). Rien n'est écrit : le blocage se lève seul au règlement.
//
// REMBOURSEMENT D'UNE DETTE — l'argent reçu est affecté aux ventes à crédit du
// client, la plus ancienne échéance d'abord. Pour chaque vente touchée :
//   - un PaiementVente POSITIF dans le moyen reçu (espèces, Mobile Money…),
//     rattaché à la vente et à la session de caisse ouverte, par ajouterPaiement :
//     les espèces entrent ainsi dans le « montant attendu » de la session
//     (detailAttendu les lit là), un moyen déclaratif reste « à rapprocher »,
//     et Commande.montantPaye monte du montant réellement encaissé ;
//   - un MouvementCredit « remboursement » négatif ; Client.creditUtilise baisse.
// Le paiement « credit » d'origine n'est pas contre-passé (ce n'est pas un
// remboursement au client) : la dette restante d'une vente se lit dans
// MouvementCredit (echeancesCredit), pas dans la somme des paiements « credit ».
import type { Prisma, PrismaClient } from "@prisma/client";
import { ErreurPos } from "./erreurs";
import type { ContextePos, ModePaiement } from "./types";

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaClient;

/** Écart toléré entre deux montants flottants. */
const EPS = 0.005;

export type EcheanceCredit = { clientId: string; commandeId: string; reste: number; echeanceAt: Date | null; enRetard: boolean; joursRetard: number };

/**
 * Ventes à crédit non soldées des clients demandés (tous ceux qui doivent
 * quelque chose si `clientIds` est absent), la plus ancienne échéance d'abord.
 * ponytail: relit tout le journal de crédit des clients endettés ; ajouter une
 * colonne « soldé » sur le mouvement de vente si une boutique dépasse quelques
 * dizaines de milliers de mouvements.
 */
export async function echeancesCredit(db: Db, tenantId: string, clientIds?: string[], maintenant = new Date()): Promise<EcheanceCredit[]> {
  const mouvements = await db.mouvementCredit.findMany({
    where: { tenantId, commandeId: { not: null }, ...(clientIds ? { clientId: { in: clientIds } } : {}) },
    select: { clientId: true, commandeId: true, montant: true, echeanceAt: true, type: true },
  });
  const parVente = new Map<string, EcheanceCredit>();
  for (const m of mouvements) {
    const e = parVente.get(m.commandeId!) ?? { clientId: m.clientId, commandeId: m.commandeId!, reste: 0, echeanceAt: null, enRetard: false, joursRetard: 0 };
    e.reste += m.montant;
    if (m.type === "vente" && m.echeanceAt) e.echeanceAt = m.echeanceAt;
    parVente.set(e.commandeId, e);
  }
  return [...parVente.values()]
    .filter((e) => e.reste > EPS)
    .map((e) => {
      const jours = e.echeanceAt ? Math.floor((maintenant.getTime() - e.echeanceAt.getTime()) / 86400_000) : 0;
      return { ...e, enRetard: !!e.echeanceAt && e.echeanceAt < maintenant, joursRetard: Math.max(0, jours) };
    })
    .sort((a, b) => (a.echeanceAt?.getTime() ?? Infinity) - (b.echeanceAt?.getTime() ?? Infinity) || (a.commandeId < b.commandeId ? -1 : 1));
}

/** Moyens dans lesquels une dette peut être réglée (jamais un autre crédit ni un avoir). */
export const MODES_REMBOURSEMENT = ["especes", "mobile_money", "carte", "virement", "qr"] as const satisfies readonly ModePaiement[];
export type ModeRemboursement = (typeof MODES_REMBOURSEMENT)[number];

export type ResultatRemboursement = { clientId: string; rembourse: number; resteDu: number; affectations: { commandeId: string; montant: number; paiementVenteId: string }[] };

/**
 * Encaisse le remboursement d'une dette (voir l'en-tête). `ajouterPaiement` est
 * reçu en paramètre : lib/pos/paiements.ts importe déjà ce fichier.
 * Sûr à plusieurs caisses : le débit du compte est conditionnel (on ne
 * rembourse jamais plus que le dû) et verrouille la ligne du client avant le
 * calcul de l'affectation.
 */
export async function encaisserRemboursement(
  tx: Tx, ctx: ContextePos,
  p: { clientId: string; montant: number; mode: ModeRemboursement; reference?: string | null; prestataire?: string | null },
  ajouterPaiement: (tx: Tx, ctx: ContextePos, paiement: { commandeId: string; mode: ModePaiement; montant: number; montantRecu?: number | null; monnaieRendue?: number | null; prestataire?: string | null; reference?: string | null; clientId?: string | null }) => Promise<{ id: string }>,
): Promise<ResultatRemboursement> {
  if (!(p.montant > 0)) throw new ErreurPos("invalide", 400, "Indiquez le montant remboursé par le client.");
  if (!(MODES_REMBOURSEMENT as readonly string[]).includes(p.mode)) throw new ErreurPos("invalide", 400, "Une dette se règle en espèces, Mobile Money, carte, virement ou paiement QR.");
  const client = await tx.client.findFirst({ where: { id: p.clientId, tenantId: ctx.tenantId }, select: { nom: true, creditUtilise: true } });
  if (!client) throw new ErreurPos("introuvable", 404, "Ce client est introuvable dans cette boutique.");

  const debite = await tx.client.updateMany({
    where: { id: p.clientId, tenantId: ctx.tenantId, creditUtilise: { gte: p.montant - EPS } },
    data: { creditUtilise: { decrement: p.montant } },
  });
  if (debite.count === 0) {
    throw new ErreurPos("remboursement_trop_eleve", 409, client.creditUtilise > EPS
      ? `Ce montant dépasse ce que doit ${client.nom}. Rien n'a été encaissé.`
      : `${client.nom} ne doit plus rien. Rien n'a été encaissé.`, { du: client.creditUtilise });
  }

  let reste = p.montant;
  let solde = client.creditUtilise;
  const affectations: ResultatRemboursement["affectations"] = [];
  for (const e of await echeancesCredit(tx, ctx.tenantId, [p.clientId])) {
    if (reste <= EPS) break;
    const part = Math.min(reste, e.reste);
    const paiement = await ajouterPaiement(tx, ctx, {
      commandeId: e.commandeId, mode: p.mode, montant: part, clientId: p.clientId, reference: p.reference, prestataire: p.prestataire,
      ...(p.mode === "especes" ? { montantRecu: part, monnaieRendue: 0 } : {}),
    });
    solde -= part; reste -= part;
    await tx.mouvementCredit.create({
      data: { tenantId: ctx.tenantId, clientId: p.clientId, type: "remboursement", montant: -part, soldeApres: Math.max(0, solde), commandeId: e.commandeId, paiementVenteId: paiement.id, creePar: ctx.userId },
    });
    // Vente entièrement réglée : sa facture passe de « émise » à « payée ».
    if (e.reste - part <= EPS) await tx.facture.updateMany({ where: { commandeId: e.commandeId, tenantId: ctx.tenantId, statut: "emise" }, data: { statut: "payee" } });
    affectations.push({ commandeId: e.commandeId, montant: part, paiementVenteId: paiement.id });
  }
  // Une dette sans vente rattachée ne peut pas entrer en caisse : on annule tout plutôt que d'encaisser sans trace.
  if (reste > EPS) throw new ErreurPos("conflit", 409, `Une partie de la dette de ${client.nom} n'est rattachée à aucune vente. Rien n'a été encaissé : vérifiez son compte.`, { nonAffecte: reste });
  return { clientId: p.clientId, rembourse: p.montant, resteDu: Math.max(0, solde), affectations };
}

/**
 * Porte un montant au compte du client. Refuse (409, « credit_refuse ») si le
 * compte est bloqué ou si le plafond serait dépassé — vérifié et écrit en une
 * seule mise à jour : deux caisses ne peuvent pas dépasser le plafond à elles deux.
 */
export async function engagerCredit(tx: Tx, ctx: ContextePos, p: { clientId: string; commandeId: string; montant: number; paiementVenteId?: string | null; echeanceJours?: number }): Promise<void> {
  const client = await tx.client.findFirst({
    where: { id: p.clientId, tenantId: ctx.tenantId },
    select: { nom: true, creditPlafond: true, creditUtilise: true, creditBloque: true, creditEcheanceJours: true },
  });
  if (!client) throw new ErreurPos("introuvable", 404, "Ce client est introuvable dans cette boutique.");
  const details = { plafond: client.creditPlafond, utilise: client.creditUtilise, disponible: Math.max(0, client.creditPlafond - client.creditUtilise), demande: p.montant };
  if (client.creditBloque) throw new ErreurPos("credit_refuse", 409, `Le crédit de ${client.nom} est bloqué. La vente à crédit est impossible.`, details);
  // Délai de grâce (réglage credit.graceJours) : un retard plus court ne bloque pas encore le crédit.
  // Lu dans la transaction : ce fichier n'importe pas le code serveur des réglages (voir l'en-tête).
  const enregistres = (await tx.reglagesPos.findUnique({ where: { tenantId: ctx.tenantId }, select: { reglages: true } }))?.reglages as { credit?: { graceJours?: unknown } } | null | undefined;
  const graceJours = Number(enregistres?.credit?.graceJours) || 0;
  const retard = (await echeancesCredit(tx, ctx.tenantId, [p.clientId])).filter((e) => e.enRetard && e.joursRetard >= graceJours);
  if (retard.length) {
    const du = retard.reduce((s, e) => s + e.reste, 0);
    throw new ErreurPos("credit_refuse", 409, `${client.nom} a un paiement en retard. Il doit d'abord le régler pour acheter de nouveau à crédit.`, { ...details, enRetard: du, joursRetard: retard[0].joursRetard });
  }

  const engage = await tx.client.updateMany({
    where: { id: p.clientId, tenantId: ctx.tenantId, creditBloque: false, creditUtilise: { lte: client.creditPlafond - p.montant } },
    data: { creditUtilise: { increment: p.montant } },
  });
  if (engage.count === 0) {
    throw new ErreurPos("credit_refuse", 409, client.creditPlafond > 0
      ? `Cette vente dépasse le crédit autorisé pour ${client.nom}.`
      : `${client.nom} n'a pas de crédit autorisé. Fixez d'abord son plafond.`, details);
  }
  const { creditUtilise } = await tx.client.findUniqueOrThrow({ where: { id: p.clientId }, select: { creditUtilise: true } });
  const jours = client.creditEcheanceJours ?? p.echeanceJours ?? 30;
  await tx.mouvementCredit.create({
    data: {
      tenantId: ctx.tenantId, clientId: p.clientId, type: "vente", montant: p.montant, soldeApres: creditUtilise,
      commandeId: p.commandeId, paiementVenteId: p.paiementVenteId ?? null,
      echeanceAt: new Date(Date.now() + jours * 86400_000), creePar: ctx.userId,
    },
  });
}

/**
 * Annule ce qu'une vente avait porté au compte du client (vente annulée).
 * Idempotent : ne retire que ce qui reste engagé pour cette vente.
 * Rend le montant libéré.
 */
export async function libererCredit(tx: Tx, ctx: ContextePos, p: { commandeId: string }): Promise<number> {
  const mouvements = await tx.mouvementCredit.findMany({ where: { tenantId: ctx.tenantId, commandeId: p.commandeId }, select: { clientId: true, montant: true } });
  const parClient = new Map<string, number>();
  for (const m of mouvements) parClient.set(m.clientId, (parClient.get(m.clientId) ?? 0) + m.montant);
  let libere = 0;
  for (const [clientId, engage] of parClient) {
    if (engage <= 0) continue;
    const { creditUtilise } = await tx.client.update({ where: { id: clientId }, data: { creditUtilise: { decrement: engage } }, select: { creditUtilise: true } });
    await tx.mouvementCredit.create({
      data: { tenantId: ctx.tenantId, clientId, type: "ajustement", montant: -engage, soldeApres: creditUtilise, commandeId: p.commandeId, creePar: ctx.userId },
    });
    libere += engage;
  }
  return libere;
}
