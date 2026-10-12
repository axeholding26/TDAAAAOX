// Session de caisse : ouverture (fonds initial) → journée → fermeture (comptage).
// SERVEUR uniquement.
//
// RÈGLES
// - UNE SEULE session ouverte par caisse : SessionCaisse.caisseOuverteId vaut
//   caisseId tant que la session est ouverte, NULL ensuite ; son unicité en
//   base rend la seconde ouverture impossible, même simultanée.
// - Montant attendu dans le tiroir à la fermeture :
//     fonds initial
//   + espèces encaissées (ce que les clients ont remis)
//   − monnaie rendue
//   + dépôts − retraits − dépenses ± corrections   (MouvementCaisse)
//   − remboursements en espèces                    (PaiementVente négatifs)
//   Seules les ESPÈCES comptent : Mobile Money, carte, crédit… ne sont pas dans le tiroir.
// - Fermeture : écart = compté − attendu. Un écart non nul exige une justification.
// - Chaque vente incrémente SessionCaisse.nbVentes (lib/pos/vente.ts) : cette
//   écriture verrouille la ligne, la fermeture attend donc la fin des ventes en
//   cours, et aucune vente ne peut se glisser après le calcul de l'attendu.
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { ErreurPos } from "./erreurs";
import { exigerDroit } from "./droits";
import { journaliserAudit } from "./audit";
import { publierEvenement } from "./evenements";
import { avecIdempotence } from "./idempotence";
import { arrondir } from "./tarification";
import type { ContextePos } from "./types";

type Tx = Prisma.TransactionClient;

export type ComposantsAttendu = {
  fondsInitial: number;
  /** Espèces remises par les clients (avant monnaie). */
  especesEncaissees: number;
  monnaieRendue: number;
  depots: number;
  retraits: number;
  depenses: number;
  /** Corrections, signées. */
  corrections: number;
  remboursementsEspeces: number;
};
export type DetailAttendu = ComposantsAttendu & { attendu: number };

/** Montant attendu dans le tiroir. PURE. */
export function calculerAttendu(c: ComposantsAttendu): number {
  return arrondir(c.fondsInitial + c.especesEncaissees - c.monnaieRendue + c.depots - c.retraits - c.depenses + c.corrections - c.remboursementsEspeces, 2);
}

/** Détail du montant attendu d'une session, relu en base. */
export async function detailAttendu(tx: Tx, sessionId: string): Promise<DetailAttendu> {
  const [session, especes, mouvements] = await Promise.all([
    tx.sessionCaisse.findUniqueOrThrow({ where: { id: sessionId }, select: { fondsInitial: true } }),
    tx.paiementVente.findMany({ where: { sessionCaisseId: sessionId, mode: "especes", statut: { in: ["confirme", "rembourse"] } }, select: { montant: true, montantRecu: true, monnaieRendue: true } }),
    tx.mouvementCaisse.findMany({ where: { sessionCaisseId: sessionId }, select: { type: true, montant: true } }),
  ]);
  const somme = (type: string) => mouvements.filter((m) => m.type === type).reduce((s, m) => s + (type === "correction" ? m.montant : Math.abs(m.montant)), 0);
  const encaissements = especes.filter((p) => p.montant > 0);
  const c: ComposantsAttendu = {
    fondsInitial: session.fondsInitial,
    especesEncaissees: arrondir(encaissements.reduce((s, p) => s + (p.montantRecu ?? p.montant), 0), 2),
    monnaieRendue: arrondir(encaissements.reduce((s, p) => s + (p.monnaieRendue ?? 0), 0), 2),
    depots: arrondir(somme("depot"), 2),
    retraits: arrondir(somme("retrait"), 2),
    depenses: arrondir(somme("depense"), 2),
    corrections: arrondir(somme("correction"), 2),
    remboursementsEspeces: arrondir(especes.filter((p) => p.montant < 0).reduce((s, p) => s - p.montant, 0), 2),
  };
  return { ...c, attendu: calculerAttendu(c) };
}

export async function montantAttendu(tx: Tx, sessionId: string): Promise<number> {
  return (await detailAttendu(tx, sessionId)).attendu;
}

/** Session ouverte d'une caisse, ou null. */
export async function sessionOuverte(caisseId: string) {
  return prisma.sessionCaisse.findUnique({ where: { caisseOuverteId: caisseId } });
}

export type SessionResume = {
  id: string; magasinId: string; caisseId: string; statut: string;
  ouvertePar: string; ouverteAt: string; fondsInitial: number;
  fermeePar?: string | null; fermeeAt?: string | null;
  montantAttendu?: number | null; montantCompte?: number | null; ecart?: number | null; justificationEcart?: string | null;
};

/**
 * Ouvre la caisse du contexte avec son fonds initial.
 * `cle` (clé d'idempotence de l'appareil) : la même demande rejouée rend la
 * session déjà ouverte au lieu d'une erreur.
 */
export async function ouvrirSession(ctx: ContextePos, fondsInitial: number, cle?: string): Promise<SessionResume & { rejoue: boolean }> {
  exigerDroit(ctx, "ouvrir_caisse");
  if (!Number.isFinite(fondsInitial) || fondsInitial < 0) throw new ErreurPos("invalide", 400, "Indiquez le fonds de caisse de départ (0 si le tiroir est vide).");

  const ouvrir = async (tx: Tx): Promise<SessionResume> => {
    const s = await tx.sessionCaisse.create({
      data: { tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: ctx.caisseId, caisseOuverteId: ctx.caisseId, ouvertePar: ctx.userId, fondsInitial },
    });
    const ici = { ...ctx, sessionCaisseId: s.id };
    await journaliserAudit(tx, ici, { action: "caisse.ouverte", entite: "SessionCaisse", entiteId: s.id, apres: { fondsInitial, caisseId: ctx.caisseId } });
    await publierEvenement(tx, { tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: ctx.caisseId, type: "cash.opened", payload: { sessionCaisseId: s.id, fondsInitial, par: ctx.userNom } });
    return { id: s.id, magasinId: s.magasinId, caisseId: s.caisseId, statut: s.statut, ouvertePar: s.ouvertePar, ouverteAt: s.ouverteAt.toISOString(), fondsInitial: s.fondsInitial };
  };

  try {
    if (cle) {
      const { resultat, rejoue } = await avecIdempotence(ctx.tenantId, cle, "caisse.ouvrir", ouvrir, { appareilId: ctx.appareilId, userId: ctx.userId });
      return { ...resultat, rejoue };
    }
    return { ...(await prisma.$transaction(ouvrir)), rejoue: false };
  } catch (e) {
    // Unicité de caisseOuverteId : une session est déjà ouverte sur cette caisse.
    if ((e as any)?.code === "P2002") {
      const existante = await sessionOuverte(ctx.caisseId);
      throw new ErreurPos("caisse_deja_ouverte", 409, "Cette caisse est déjà ouverte. Fermez la session en cours avant d'en ouvrir une autre.", { sessionCaisseId: existante?.id ?? null });
    }
    throw e;
  }
}

/**
 * Ferme la session ouverte de la caisse du contexte.
 * `compte` = espèces comptées dans le tiroir. Si elles diffèrent de l'attendu,
 * une `justification` est exigée (422 « justification_requise », avec l'écart
 * dans `details`) : la session reste ouverte tant qu'elle manque.
 */
export async function fermerSession(ctx: ContextePos, p: { compte: number; justification?: string | null; detailComptage?: Record<string, number> | null; cle?: string }): Promise<SessionResume & { detail: DetailAttendu; rejoue: boolean }> {
  exigerDroit(ctx, "fermer_caisse");
  if (!Number.isFinite(p.compte) || p.compte < 0) throw new ErreurPos("invalide", 400, "Indiquez le montant compté dans le tiroir.");
  const justification = p.justification?.trim() || null;

  const fermer = async (tx: Tx) => {
    const sessionId = ctx.sessionCaisseId;
    if (!sessionId) throw new ErreurPos("caisse_fermee", 409, "Aucune session n'est ouverte sur cette caisse.");
    const fermeeAt = new Date();
    // Bascule d'abord : verrouille la session (plus aucune vente ne s'y ajoute) et écarte une double fermeture.
    const bascule = await tx.sessionCaisse.updateMany({
      where: { id: sessionId, tenantId: ctx.tenantId, statut: "ouverte" },
      data: { statut: "fermee", caisseOuverteId: null, fermeePar: ctx.userId, fermeeAt },
    });
    if (bascule.count === 0) throw new ErreurPos("caisse_fermee", 409, "Cette session de caisse est déjà fermée.");

    const detail = await detailAttendu(tx, sessionId);
    const ecart = arrondir(p.compte - detail.attendu, 2);
    if (ecart !== 0 && (!justification || justification.length < 3)) {
      throw new ErreurPos("justification_requise", 422,
        ecart < 0 ? "Il manque de l'argent par rapport au montant attendu. Indiquez la raison de cet écart pour fermer la caisse."
          : "Il y a plus d'argent que le montant attendu. Indiquez la raison de cet écart pour fermer la caisse.",
        { attendu: detail.attendu, compte: p.compte, ecart });
    }
    const s = await tx.sessionCaisse.update({
      where: { id: sessionId },
      data: { montantAttendu: detail.attendu, montantCompte: p.compte, ecart, justificationEcart: ecart !== 0 ? justification : null, detailComptage: p.detailComptage ?? undefined },
    });
    await journaliserAudit(tx, ctx, {
      action: "caisse.fermee", entite: "SessionCaisse", entiteId: sessionId,
      apres: { attendu: detail.attendu, compte: p.compte, ecart, detail }, motif: ecart !== 0 ? justification : null,
    });
    await publierEvenement(tx, { tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: ctx.caisseId, type: "cash.closed", payload: { sessionCaisseId: sessionId, attendu: detail.attendu, compte: p.compte, ecart, par: ctx.userNom } });
    return {
      id: s.id, magasinId: s.magasinId, caisseId: s.caisseId, statut: s.statut, ouvertePar: s.ouvertePar, ouverteAt: s.ouverteAt.toISOString(), fondsInitial: s.fondsInitial,
      fermeePar: s.fermeePar, fermeeAt: fermeeAt.toISOString(), montantAttendu: detail.attendu, montantCompte: p.compte, ecart, justificationEcart: s.justificationEcart, detail,
    };
  };

  if (p.cle) {
    const { resultat, rejoue } = await avecIdempotence(ctx.tenantId, p.cle, "caisse.fermer", fermer, { appareilId: ctx.appareilId, userId: ctx.userId });
    return { ...resultat, rejoue };
  }
  return { ...(await prisma.$transaction(fermer)), rejoue: false };
}
