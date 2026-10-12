// Parcours complet d'une commande sourcée, en 14 étapes — module pur.
//
// Ce n'est PAS un nouveau cycle de commande : l'étape se DÉDUIT de ce qui
// existe déjà (Commande.statut / paiementStatut, CommandeFournisseur.statut,
// retour accepté) et de l'expédition internationale (Expedition.statut). Les
// transitions restent celles de lib/commandes.ts et lib/cycle-livraison.ts.

export const ETAPES_COMMANDE = [
  { cle: "paiement_attente", libelle: "Paiement en attente", en: "Pending payment" },
  { cle: "payee", libelle: "Payée", en: "Paid" },
  { cle: "fournisseur_a_commander", libelle: "À commander au fournisseur", en: "Supplier order pending" },
  { cle: "fournisseur_commande", libelle: "Commandée au fournisseur", en: "Supplier ordered" },
  { cle: "preparation", libelle: "En préparation", en: "Processing" },
  { cle: "expediee", libelle: "Expédiée", en: "Shipped" },
  { cle: "en_transit", libelle: "En transit", en: "In transit" },
  { cle: "arrivee_pays", libelle: "Arrivée dans le pays", en: "Arrived in country" },
  { cle: "douane", libelle: "En douane", en: "Customs" },
  { cle: "entrepot_local", libelle: "À l'entrepôt local", en: "Local warehouse" },
  { cle: "en_livraison", libelle: "En cours de livraison", en: "Out for delivery" },
  { cle: "livree", libelle: "Livrée", en: "Delivered" },
  { cle: "echec_livraison", libelle: "Échec de livraison", en: "Failed delivery" },
  { cle: "retournee", libelle: "Retournée", en: "Returned" },
] as const;

export type EtapeCommande = (typeof ETAPES_COMMANDE)[number]["cle"];

export const libelleEtape = (cle: string) => ETAPES_COMMANDE.find((e) => e.cle === cle)?.libelle ?? cle;

// ── Expédition internationale ───────────────────────────────────────────────
export const STATUTS_EXPEDITION = ["en_preparation", "expediee", "en_transit", "arrivee_pays", "douane", "entrepot_local"] as const;
export type StatutExpedition = (typeof STATUTS_EXPEDITION)[number] | "annulee";

export const LIBELLES_EXPEDITION: Record<StatutExpedition, string> = {
  en_preparation: "En préparation chez le fournisseur",
  expediee: "Expédiée",
  en_transit: "En transit",
  arrivee_pays: "Arrivée dans le pays",
  douane: "En douane",
  entrepot_local: "À l'entrepôt local",
  annulee: "Annulée",
};

/** Une expédition n'avance que vers l'avant (une étape peut être sautée) ; annulable tant qu'elle n'est pas arrivée. */
export function transitionExpeditionValide(de: string, vers: string): boolean {
  if (de === "annulee" || de === "entrepot_local") return false;
  if (vers === "annulee") return true;
  const i = STATUTS_EXPEDITION.indexOf(de as any), j = STATUTS_EXPEDITION.indexOf(vers as any);
  return i >= 0 && j > i;
}

const ETAPE_EXPEDITION: Record<string, EtapeCommande> = {
  en_preparation: "preparation", expediee: "expediee", en_transit: "en_transit",
  arrivee_pays: "arrivee_pays", douane: "douane", entrepot_local: "entrepot_local",
};

/**
 * Étape courante d'une commande. Lecture du plus avancé au moins avancé :
 * retour > livraison locale > expédition internationale > commande fournisseur > paiement.
 */
export function etapeCommande(c: {
  statut: string;
  paiementStatut: string;
  methodePaiement?: string | null;
  retourAccepte?: boolean;
  commandeFournisseur?: { statut: string } | null;
  expedition?: { statut: string } | null;
}): EtapeCommande {
  if (c.retourAccepte) return "retournee";
  if (c.statut === "livree") return "livree";
  if (c.statut === "tentative_echouee") return "echec_livraison";
  if (c.statut === "expediee") return "en_livraison";

  if (c.expedition && ETAPE_EXPEDITION[c.expedition.statut]) return ETAPE_EXPEDITION[c.expedition.statut];

  const cf = c.commandeFournisseur?.statut;
  if (cf === "expedie") return "expediee";
  if (cf === "livre") return "entrepot_local";
  if (cf === "envoye" || cf === "confirme") return cf === "confirme" ? "preparation" : "fournisseur_commande";
  if (cf === "en_attente") return "fournisseur_a_commander";

  // Paiement à la livraison : la commande confirmée vaut « payée » pour la suite du parcours.
  const cod = !!c.methodePaiement?.includes("cod");
  if (c.paiementStatut === "completed" || (cod && c.statut !== "en_attente")) return c.statut === "en_preparation" ? "preparation" : "payee";
  return "paiement_attente";
}

// ── Annulation d'une commande fournisseur ────────────────────────────────────
// Même règle que les places de marché : seule une annulation dont le fournisseur
// est la cause compte contre lui. Un client qui change d'avis ne dit rien de sa fiabilité.
export const MOTIFS_ANNULATION = {
  rupture: "Rupture chez le fournisseur",
  sans_reponse: "Le fournisseur ne répond pas",
  retard: "Retard du fournisseur",
  client: "Le client a annulé",
  marchand: "Erreur ou choix de ma part",
} as const;
export type MotifAnnulation = keyof typeof MOTIFS_ANNULATION;
export const MOTIFS_IMPUTABLES_FOURNISSEUR: readonly string[] = ["rupture", "sans_reponse", "retard"];
