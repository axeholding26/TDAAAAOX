// Valeurs de Commande.paiementStatut — une seule définition pour toute l'app
// (vitrine, caisse, factures, tableaux de bord, admin). Une vente compte dans le
// CA tant que son paiement est PAYE ; un remboursement la fait sortir partout.
export const PAIEMENT = {
  ATTENTE: "pending",
  PAYE: "completed",
  ECHOUE: "failed",
  REMBOURSE: "refunded",
  // Remboursement demandé à NotchPay sans réponse claire (délai dépassé) : peut-être exécuté.
  // Jamais relancé à l'aveugle — revérifié chez NotchPay au prochain essai (lib/remboursement.ts).
  EN_REMBOURSEMENT: "refunding",
} as const;

// Commande à payer en ligne (NotchPay) — « en_attente » : page de paiement jamais ouverte.
// Toute autre méthode (whatsapp_cod, direct_cod, caisse…) est encaissée hors d'Axso.
export const METHODES_EN_LIGNE = ["notchpay", "en_attente"];

/** Paiement en ligne attendu mais pas reçu : la commande ne peut ni avancer ni être marquée payée. */
export const paiementEnLigneNonRecu = (c: { methodePaiement: string; paiementStatut: string }) =>
  METHODES_EN_LIGNE.includes(c.methodePaiement) && (c.paiementStatut === PAIEMENT.ATTENTE || c.paiementStatut === PAIEMENT.ECHOUE);

/** À la livraison, seule une commande encaissée hors ligne (COD…) devient payée. */
export const payeeALaLivraison = (c: { methodePaiement: string; paiementStatut: string }) =>
  c.paiementStatut !== PAIEMENT.PAYE && !METHODES_EN_LIGNE.includes(c.methodePaiement);

// Valeurs de Commande.canal : d'où vient la vente. Une vente en caisse est une
// Commande comme les autres (stock, retours, factures, analytics) sur le canal
// "pos" — c'est LE marqueur des ventes de caisse (l'ancien, le client fictif
// "pos@local", ne sert plus qu'à reconnaître les ventes d'avant le POS 2.0).
export const CANAL = {
  EN_LIGNE: "en_ligne",
  POS: "pos",
} as const;

// Client inactif : a déjà commandé, mais aucune commande depuis `jours` jours
// (filtre Prisma sur Client — jamais la date d'inscription).
export function clientsInactifs(jours: number) {
  const depuis = new Date(Date.now() - jours * 86400000);
  return { AND: [{ commandes: { some: {} } }, { commandes: { none: { createdAt: { gte: depuis } } } }] };
}

// Accès à un contenu digital acheté : commande payée (non remboursée) et lien
// ni révoqué par le marchand ni arrivé au terme de la durée qu'il a choisie.
export function accesDigitalOuvert(expireAt: Date | null, paiementStatut: string | null | undefined): boolean {
  return paiementStatut === PAIEMENT.PAYE && (!expireAt || expireAt > new Date());
}

/** Fin d'accès : la durée choisie par le marchand sur le produit, sinon à vie (null). */
export function finAcces(jours: number | null | undefined): Date | null {
  return jours ? new Date(Date.now() + jours * 86400 * 1000) : null;
}

/** Options d'un produit digital, stockées en JSON dans instructionsTelechargement. */
export function metaDigital(raw: string | null | undefined): Record<string, any> {
  try {
    if (raw?.startsWith("{")) return JSON.parse(raw);
  } catch {}
  return {};
}

// Source unique de vérité pour les transitions de statut d'une commande.
// Utilisé par app/api/commandes/[id]/statut/route.ts et app/api/retours/route.ts
// pour éviter que Commande.statut et Commande.livraisonStatut divergent.

// Commandes qui occupent encore un livreur (assignées, pas encore livrées ni annulées)
export const STATUTS_COURSE_ACTIVE = ["confirmee", "en_preparation", "expediee", "tentative_echouee"];

export const TRANSITIONS_VALIDES: Record<string, string[]> = {
  en_attente:        ["confirmee", "annulee"],
  confirmee:         ["en_preparation", "expediee", "annulee"],
  en_preparation:    ["expediee", "annulee"],
  expediee:          ["livree", "tentative_echouee", "annulee"],
  // Replanification : le livreur retente, ou le marchand annule après échecs répétés
  tentative_echouee: ["expediee", "livree", "annulee"],
  livree:             [],
  annulee:            [],
};

// Commande.statut -> Commande.livraisonStatut, écrit dans la même transaction
// que Commande.statut pour que les deux champs ne divergent jamais.
export const LIVRAISON_STATUT_MAP: Record<string, string> = {
  en_attente:        "non_expediee",
  confirmee:         "non_expediee",
  en_preparation:    "en_preparation",
  expediee:          "expediee",
  tentative_echouee: "tentative_echouee",
  livree:            "livree",
};

export function livraisonStatutPour(statut: string): string | undefined {
  return LIVRAISON_STATUT_MAP[statut];
}
