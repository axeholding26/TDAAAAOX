// Règles de l'abonnement payé sans base de données (testables) : paiements NotchPay en attente
// et rappels d'échéance. Utilisées par lib/abonnement-paiement.ts et lib/wallet.ts.

const JOUR = 24 * 3600 * 1000;

// ─── Paiements en attente (Tenant.planPendingRef) ─────────────────────────────
// Plusieurs paiements peuvent être en cours (2e clic, autre onglet) : aucun ne doit être oublié.
// Format : entrées séparées par une espace, chacune « référence~horodatage ms » (une ancienne
// valeur sans « ~ » est lue sans date). Au-delà de REF_ATTENTE_MAX_JOURS, plus vérifiée.
export const REF_ATTENTE_MAX_JOURS = 3;
const MAX_REFS = 3;

export function lireRefsEnAttente(valeur: string | null | undefined): { ref: string; le: number | null }[] {
  return (valeur ?? "").split(" ").filter(Boolean).map((e) => {
    const [ref, le] = e.split("~");
    return { ref, le: le && Number.isFinite(Number(le)) ? Number(le) : null };
  });
}

const ecrire = (refs: { ref: string; le: number | null }[]) => refs.map((r) => (r.le ? `${r.ref}~${r.le}` : r.ref)).join(" ") || null;

/** Ajoute un paiement en attente, en gardant les précédents (les plus récents, MAX_REFS au total). */
export function ajouterRefEnAttente(valeur: string | null | undefined, ref: string, maintenant = Date.now()): string {
  const autres = lireRefsEnAttente(valeur).filter((r) => r.ref !== ref).slice(-(MAX_REFS - 1));
  return ecrire([...autres, { ref, le: maintenant }])!;
}

export function retirerRefsEnAttente(valeur: string | null | undefined, refs: string[]): string | null {
  return ecrire(lireRefsEnAttente(valeur).filter((r) => !refs.includes(r.ref)));
}

export const refTropVieille = (r: { le: number | null }, maintenant = Date.now()) => r.le !== null && maintenant - r.le > REF_ATTENTE_MAX_JOURS * JOUR;

// ─── Rappels d'échéance ───────────────────────────────────────────────────────

/** Rappel à envoyer : j3 (3 jours ou moins avant l'échéance), j0 (moins de 24 h, ou échue), null sinon. Chacun une fois. */
export function rappelEcheanceDu(expireLe: Date, dejaEnvoye: string | null | undefined, maintenant = new Date()): "j3" | "j0" | null {
  const reste = expireLe.getTime() - maintenant.getTime();
  if (reste <= JOUR) return dejaEnvoye === "j0" ? null : "j0";
  if (reste <= 3 * JOUR && !dejaEnvoye) return "j3";
  return null;
}
