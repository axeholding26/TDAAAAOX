// Moyens de paiement selon le pays : ce que la boutique accepte (Tenant.parametresPaiement) et ce que
// le paiement en ligne (NotchPay) couvre. Utilisable côté serveur et navigateur.

// Devises encaissables en ligne. NotchPay documente le Cameroun (XAF) et la Côte d'Ivoire (XOF) ;
// une devise refusée faisait échouer le paiement au dernier moment, après la commande.
// ponytail: liste fixe, réglable sans code par NEXT_PUBLIC_DEVISES_EN_LIGNE ; lire GET /countries de NotchPay si elle bouge souvent.
export const DEVISES_EN_LIGNE = (process.env.NEXT_PUBLIC_DEVISES_EN_LIGNE || "XAF,XOF").split(",").map((d) => d.trim().toUpperCase()).filter(Boolean);
export const paiementEnLigneDisponible = (devise?: string | null) => !!devise && DEVISES_EN_LIGNE.includes(devise.toUpperCase());

// Wave : prévu, pas encore encaissé. NEXT_PUBLIC_WAVE_ACTIF=1 l'affiche le jour où il l'est.
const WAVE = process.env.NEXT_PUBLIC_WAVE_ACTIF === "1" ? ["Wave"] : [];

// Moyens connus par pays, affichés au client. Pays absent : « Mobile Money et carte », sans promettre d'opérateur.
const MOYENS_PAR_PAYS: Record<string, string[]> = {
  CM: ["MTN MoMo", "Orange Money"],
  CI: [...WAVE, "Orange Money", "MTN MoMo", "Moov Money"],
  SN: [...WAVE, "Orange Money", "Free Money"],
};

/** « MTN MoMo, Orange Money ou carte bancaire » pour un client de ce pays. */
export function moyensEnLigne(paysClient?: string | null) {
  const moyens = MOYENS_PAR_PAYS[(paysClient ?? "").toUpperCase()];
  return moyens?.length ? `${moyens.join(", ")} ou carte bancaire` : "Mobile Money ou carte bancaire";
}

// ─── Réglages du marchand (Paramètres → Moyens de paiement) ────────────────
export type ReglagesPaiement = {
  livraison: boolean;          // paiement à la livraison (commande directe)
  whatsapp: boolean;           // commande via WhatsApp (payée à la livraison)
  enLigne: boolean;            // produits physiques payables en ligne (prix + commission Axso, comme le digital)
  livraisonHorsPays: boolean;  // paiement à la livraison pour un client d'un autre pays
};

export function lireReglagesPaiement(brut: unknown): ReglagesPaiement {
  const p = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const oui = (v: unknown, defaut: boolean) => (typeof v === "boolean" ? v : defaut);
  const r = {
    livraison: oui(p.livraison, true),
    whatsapp: oui(p.whatsapp, true),
    enLigne: oui(p.enLigne, false),
    livraisonHorsPays: oui(p.livraisonHorsPays, false),
  };
  // Jamais aucun moyen : la boutique ne pourrait plus rien vendre.
  if (!r.livraison && !r.whatsapp && !r.enLigne) r.livraison = true;
  return r;
}

/** Moyens proposés à un client pour des produits physiques. `enLigneDispo` : NotchPay configuré et devise couverte. */
export function moyensPhysique(r: ReglagesPaiement, p: { paysClient?: string | null; paysBoutique?: string | null; enLigneDispo: boolean }) {
  const memePays = !p.paysClient || !p.paysBoutique || p.paysClient.toUpperCase() === p.paysBoutique.toUpperCase();
  const cod = memePays || r.livraisonHorsPays;
  return { livraison: cod && r.livraison, whatsapp: cod && r.whatsapp, enLigne: r.enLigne && p.enLigneDispo };
}
