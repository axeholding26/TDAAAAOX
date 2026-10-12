// Idempotence des mutations de la caisse : un seul registre, MutationPos,
// unique sur (boutique, clé). SERVEUR uniquement.
//
// L'appareil génère une clé (crypto.randomUUID) par action de l'utilisateur et
// la renvoie à chaque nouvel essai (double-clic, réseau coupé, rejeu de la file
// hors ligne). La première exécution s'applique et stocke son résultat ; toute
// suivante renvoie ce résultat sans rien refaire (`rejoue: true`).
//
// La ligne du registre est écrite DANS la transaction de la mutation : si la
// mutation échoue, la clé n'est pas consommée et l'essai suivant repart de zéro.
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { ErreurPos } from "./erreurs";

type Tx = Prisma.TransactionClient;

export type MetaMutation = {
  appareilId?: string | null;
  userId?: string | null;
  /** Horodatage de l'appareil (mutation saisie hors ligne). */
  creeLocalAt?: Date | string | null;
  /** Statut à inscrire selon le résultat (défaut « appliquee ») — la synchronisation hors ligne marque ainsi ses conflits. */
  statut?: (resultat: any) => "appliquee" | "rejetee" | "conflit";
};

/** Durée laissée à une mutation (une vente de nombreuses lignes enchaîne des dizaines d'écritures). */
const OPTIONS_TX = { maxWait: 10_000, timeout: 30_000 };

/**
 * Résultat d'une mutation déjà traitée pour cette clé, ou null. À appeler en
 * tête d'une fonction métier pour rendre le résultat d'origine AVANT toute
 * relecture ou validation (les données ont pu changer depuis le premier envoi).
 */
export async function mutationConnue<T>(tenantId: string, cle: string, type: string): Promise<T | null> {
  if (!cle) return null;
  const m = await prisma.mutationPos.findUnique({ where: { tenantId_cle: { tenantId, cle } } });
  if (!m) return null;
  if (m.type !== type) {
    throw new ErreurPos("cle_reutilisee", 409, "Cette demande porte l'identifiant d'une autre opération déjà enregistrée. Rechargez la page puis réessayez.");
  }
  return m.resultat as T;
}

async function dejaTraitee<T>(tenantId: string, cle: string, type: string): Promise<{ resultat: T; rejoue: true } | null> {
  const resultat = await mutationConnue<T>(tenantId, cle, type);
  return resultat === null ? null : { resultat, rejoue: true };
}

/**
 * Exécute `fn` une seule fois pour (boutique, clé). `fn` reçoit la transaction
 * et doit rendre un résultat sérialisable en JSON (pas de Date ni de BigInt :
 * c'est ce résultat qui sera renvoyé aux rejeux).
 */
export async function avecIdempotence<T>(tenantId: string, cle: string, type: string, fn: (tx: Tx) => Promise<T>, meta: MetaMutation = {}): Promise<{ resultat: T; rejoue: boolean }> {
  if (!cle || cle.length < 8 || cle.length > 200) throw new ErreurPos("invalide", 400, "La demande n'a pas d'identifiant valide. Rechargez la page puis réessayez.");

  const connue = await dejaTraitee<T>(tenantId, cle, type);
  if (connue) return connue;

  try {
    const resultat = await prisma.$transaction(async (tx) => {
      // Réserve la clé en premier : une demande jumelle arrivée en même temps
      // attend ici la fin de cette transaction, puis échoue sur l'unicité.
      const ligne = await tx.mutationPos.create({
        data: {
          tenantId, cle, type, appareilId: meta.appareilId ?? null, userId: meta.userId ?? null,
          creeLocalAt: meta.creeLocalAt ? new Date(meta.creeLocalAt) : null, resultat: {},
        },
        select: { id: true },
      });
      const r = await fn(tx);
      await tx.mutationPos.update({
        where: { id: ligne.id },
        data: { resultat: (r ?? {}) as Prisma.InputJsonValue, statut: meta.statut?.(r) ?? "appliquee" },
      });
      return r;
    }, OPTIONS_TX);
    return { resultat, rejoue: false };
  } catch (e) {
    // Doublon sur la clé : la demande jumelle a gagné, on rend son résultat.
    if ((e as any)?.code === "P2002") {
      const jumelle = await dejaTraitee<T>(tenantId, cle, type);
      if (jumelle) return jumelle;
    }
    throw e;
  }
}

/**
 * Relance `fn` quand elle échoue sur une valeur unique tirée au hasard (numéro
 * de vente, de facture) : chaque essai retire de nouveaux numéros. Les autres
 * erreurs, et les erreurs métier, remontent telles quelles.
 */
export async function avecRepriseCollision<T>(fn: () => Promise<T>, essais = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if ((e as any)?.code !== "P2002" || i >= essais) throw e;
    }
  }
}
