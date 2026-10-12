// Fidélité — FICHIER AMORCÉ par les fondations, propriété du lot « Clients,
// promotions, fidélité, crédit ».
//
// Les SIGNATURES de `crediterPoints` et `reprendrePoints` sont figées :
// lib/pos/vente.ts les appelle à chaque vente et à chaque annulation. Leur
// corps applique déjà la règle simple des réglages (1 point par tranche de
// `montantParPoint`, niveaux par seuils) ; le lot propriétaire l'enrichit
// (récompenses, coupons, utilisation des points) sans changer ces signatures.
//
// Aucun import de ../prisma ni de code serveur (ce fichier doit rester
// importable par l'écran pour niveauPour / pointsPourMontant) : tout se fait dans
// la transaction de l'appelant, et c'est la ROUTE qui écrit le journal d'audit
// avec l'avant / après que rendent ajusterPoints et convertirPoints.
// Client.pointsFidelite = solde ; MouvementFidelite en est le journal (points signés).
//
// NIVEAU — il se gagne sur les points ACQUIS (gains, annulations, ajustements),
// pas sur le solde : dépenser ses points ne fait pas redescendre de niveau.
// Les avantages d'un niveau sont des promotions « prix_membre » (lib/pos/promotions).
//
// UTILISER SES POINTS — `convertirPoints` échange des points contre un AVOIR
// (AvoirClient) de `points × valeurPoint`. L'avoir se dépense ensuite comme tout
// avoir, par le moyen de paiement « avoir » de la vente : aucune règle de calcul
// du panier ne change, l'annulation d'une vente recrédite l'avoir comme
// d'habitude, et un avoir non utilisé reste au client.
import type { Prisma } from "@prisma/client";
import { ErreurPos } from "./erreurs";
import type { ContextePos, ReglagesPosValeurs } from "./types";

type Tx = Prisma.TransactionClient;
type ReglagesFidelite = ReglagesPosValeurs["fidelite"];

/** Niveau correspondant à un solde de points. PURE. */
export function niveauPour(points: number, seuils: ReglagesFidelite["seuils"]): "bronze" | "silver" | "gold" | "vip" {
  return points >= seuils.vip ? "vip" : points >= seuils.gold ? "gold" : points >= seuils.silver ? "silver" : "bronze";
}

/** Points gagnés pour un montant d'achat. PURE. 0 si la fidélité est éteinte. */
export function pointsPourMontant(montant: number, r: ReglagesFidelite): number {
  return r.active && r.montantParPoint > 0 ? Math.max(0, Math.floor(montant / r.montantParPoint)) : 0;
}

/** Points acquis depuis toujours (tout le journal sauf les utilisations) : la base du niveau. */
export async function pointsAcquis(tx: Tx, tenantId: string, clientId: string): Promise<number> {
  const { _sum } = await tx.mouvementFidelite.aggregate({ where: { tenantId, clientId, type: { not: "utilisation" } }, _sum: { points: true } });
  return Math.max(0, _sum.points ?? 0);
}

/** Remet le niveau du client d'accord avec ses points acquis. À appeler après toute écriture au journal. */
export async function recalculerNiveau(tx: Tx, tenantId: string, clientId: string, seuils: ReglagesFidelite["seuils"]): Promise<string> {
  const niveau = niveauPour(await pointsAcquis(tx, tenantId, clientId), seuils);
  await tx.client.updateMany({ where: { id: clientId, tenantId }, data: { niveauFidelite: niveau } });
  return niveau;
}

/** Crédite les points d'une vente au client et met son niveau à jour. Rend les points gagnés. */
export async function crediterPoints(tx: Tx, ctx: ContextePos, p: { clientId: string; commandeId: string; montant: number; reglages: ReglagesFidelite }): Promise<number> {
  const points = pointsPourMontant(p.montant, p.reglages);
  if (points <= 0) return 0;
  await tx.client.update({ where: { id: p.clientId }, data: { pointsFidelite: { increment: points } } });
  await tx.mouvementFidelite.create({ data: { tenantId: ctx.tenantId, clientId: p.clientId, type: "gain", points, commandeId: p.commandeId } });
  await recalculerNiveau(tx, ctx.tenantId, p.clientId, p.reglages.seuils);
  return points;
}

/**
 * Reprend les points qu'une vente avait donnés (vente annulée ou remboursée).
 * Idempotent : ne reprend que ce qui reste acquis au titre de cette vente.
 * Rend les points repris.
 */
export async function reprendrePoints(tx: Tx, ctx: ContextePos, p: { commandeId: string; motif?: string | null; reglages: ReglagesFidelite }): Promise<number> {
  const mouvements = await tx.mouvementFidelite.findMany({ where: { tenantId: ctx.tenantId, commandeId: p.commandeId }, select: { clientId: true, points: true } });
  const parClient = new Map<string, number>();
  for (const m of mouvements) parClient.set(m.clientId, (parClient.get(m.clientId) ?? 0) + m.points);
  let repris = 0;
  for (const [clientId, acquis] of parClient) {
    if (acquis <= 0) continue;
    // Le solde ne passe jamais sous zéro : des points déjà dépensés (convertis en avoir) ne se reprennent pas.
    // FOR UPDATE : deux reprises simultanées ne lisent pas le même solde.
    const [{ pointsFidelite: solde } = { pointsFidelite: 0 }] = await tx.$queryRaw<{ pointsFidelite: number }[]>`SELECT "pointsFidelite" FROM "Client" WHERE "id" = ${clientId} AND "tenantId" = ${ctx.tenantId} FOR UPDATE`;
    const aReprendre = Math.min(acquis, Math.max(0, solde));
    if (aReprendre <= 0) continue;
    await tx.client.update({ where: { id: clientId }, data: { pointsFidelite: { decrement: aReprendre } } });
    await tx.mouvementFidelite.create({ data: { tenantId: ctx.tenantId, clientId, type: "annulation", points: -aReprendre, commandeId: p.commandeId, motif: p.motif ?? null } });
    await recalculerNiveau(tx, ctx.tenantId, clientId, p.reglages.seuils);
    repris += aReprendre;
  }
  return repris;
}

/**
 * Ajoute ou retire des points à la main (geste commercial, correction). Un motif
 * est obligatoire ; le solde ne peut pas devenir négatif. Rend l'avant / après à journaliser.
 */
export async function ajusterPoints(tx: Tx, ctx: ContextePos, p: { clientId: string; points: number; motif: string; reglages: ReglagesFidelite }): Promise<{ points: number; niveau: string; avant: { points: number; niveau: string } }> {
  const motif = p.motif?.trim() ?? "";
  if (!Number.isInteger(p.points) || p.points === 0) throw new ErreurPos("invalide", 400, "Indiquez un nombre entier de points à ajouter ou à retirer.");
  if (motif.length < 3) throw new ErreurPos("motif_requis", 422, "Indiquez la raison de cet ajustement de points.");
  const client = await tx.client.findFirst({ where: { id: p.clientId, tenantId: ctx.tenantId }, select: { nom: true, pointsFidelite: true, niveauFidelite: true } });
  if (!client) throw new ErreurPos("introuvable", 404, "Ce client est introuvable dans cette boutique.");
  // Condition et écriture en une seule mise à jour : deux retraits simultanés ne passent pas sous zéro.
  const ecrit = await tx.client.updateMany({
    where: { id: p.clientId, tenantId: ctx.tenantId, pointsFidelite: { gte: -p.points } },
    data: { pointsFidelite: { increment: p.points } },
  });
  if (ecrit.count === 0) throw new ErreurPos("conflit", 409, `${client.nom} n'a que ${client.pointsFidelite} point(s) : impossible d'en retirer ${-p.points}.`, { points: client.pointsFidelite });
  await tx.mouvementFidelite.create({ data: { tenantId: ctx.tenantId, clientId: p.clientId, type: "ajustement", points: p.points, motif } });
  const niveau = await recalculerNiveau(tx, ctx.tenantId, p.clientId, p.reglages.seuils);
  const { pointsFidelite } = await tx.client.findUniqueOrThrow({ where: { id: p.clientId }, select: { pointsFidelite: true } });
  return { points: pointsFidelite, niveau, avant: { points: client.pointsFidelite, niveau: client.niveauFidelite } };
}

/** Code d'un avoir de fidélité : « FID- » + 8 caractères sans ambiguïté (ni 0/O, ni 1/I). */
function codeAvoir(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "FID-" + Array.from(crypto.getRandomValues(new Uint8Array(8)), (o) => alphabet[o % alphabet.length]).join("");
}

/**
 * Échange des points contre un avoir de `points × valeurPoint` (voir l'en-tête).
 * Refusé si la fidélité est éteinte, si le point n'a pas de valeur, ou si le
 * client n'a pas assez de points. Une collision de code (P2002) remonte à
 * l'appelant, qui rejoue la transaction (avecRepriseCollision).
 */
export async function convertirPoints(tx: Tx, ctx: ContextePos, p: { clientId: string; points: number; reglages: ReglagesFidelite; arrondir: (montant: number) => number }): Promise<{ avoirId: string; code: string; montant: number; points: number; pointsRestants: number }> {
  if (!p.reglages.active || !(p.reglages.valeurPoint > 0)) {
    throw new ErreurPos("fidelite_inactive", 422, "L'utilisation des points n'est pas activée : donnez une valeur au point dans les réglages de fidélité.");
  }
  if (!Number.isInteger(p.points) || p.points <= 0) throw new ErreurPos("invalide", 400, "Indiquez le nombre de points à utiliser.");
  const montant = p.arrondir(p.points * p.reglages.valeurPoint);
  if (!(montant > 0)) throw new ErreurPos("invalide", 400, "Ce nombre de points ne représente aucun montant.");
  const client = await tx.client.findFirst({ where: { id: p.clientId, tenantId: ctx.tenantId }, select: { nom: true, pointsFidelite: true } });
  if (!client) throw new ErreurPos("introuvable", 404, "Ce client est introuvable dans cette boutique.");
  const debite = await tx.client.updateMany({
    where: { id: p.clientId, tenantId: ctx.tenantId, pointsFidelite: { gte: p.points } },
    data: { pointsFidelite: { decrement: p.points } },
  });
  if (debite.count === 0) throw new ErreurPos("points_insuffisants", 409, `${client.nom} n'a que ${client.pointsFidelite} point(s).`, { points: client.pointsFidelite });
  const avoir = await tx.avoirClient.create({ data: { tenantId: ctx.tenantId, clientId: p.clientId, code: codeAvoir(), montantInitial: montant, solde: montant }, select: { id: true, code: true } });
  await tx.mouvementFidelite.create({ data: { tenantId: ctx.tenantId, clientId: p.clientId, type: "utilisation", points: -p.points, motif: `Avoir ${avoir.code}` } });
  return { avoirId: avoir.id, code: avoir.code, montant, points: p.points, pointsRestants: client.pointsFidelite - p.points };
}
