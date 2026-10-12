// Règles pures des achats de la caisse : cycle de vie d'un bon de commande,
// calcul du réapprovisionnement (avec saisonnalité), coût d'un article après
// réception, texte du bon à envoyer. Aucun accès base : importable côté client.
//
// QUANTITÉS — entières : pièces, ou GRAMMES pour un produit au poids. Les prix
// d'achat sont à la pièce, ou AU KILO pour un produit au poids (même convention
// que Produit.cout, voir lib/pos/tarification.ts).
import { ErreurPos } from "../erreurs";
import { arrondir, libelleQuantite, montantBrut } from "../tarification";
import type { ActionPos, UniteVente } from "../types";

// ─── Bon de commande ─────────────────────────────────────────────────────────

export const STATUTS_BON = ["brouillon", "envoye", "confirme", "partiellement_recu", "recu", "annule"] as const;
export type StatutBon = (typeof STATUTS_BON)[number];

export const LIBELLES_STATUT_BON: Record<StatutBon, string> = {
  brouillon: "Brouillon", envoye: "Envoyé", confirme: "Confirmé par le fournisseur",
  partiellement_recu: "Partiellement reçu", recu: "Reçu", annule: "Annulé",
};

/** Statuts d'un bon sur lequel une réception peut être enregistrée. */
export const STATUTS_RECEVABLES: StatutBon[] = ["envoye", "confirme", "partiellement_recu"];

/**
 * Gestes possibles sur un bon. Le passage à « partiellement reçu » / « reçu »
 * n'est pas un geste : seule une réception le provoque. « solder » clôt un bon
 * dont le reste ne sera jamais livré.
 */
export const ACTIONS_BON = {
  envoyer: { de: ["brouillon"], vers: "envoye", droit: "achat_valider", motif: false, libelle: "Marquer comme envoyé" },
  confirmer: { de: ["envoye"], vers: "confirme", droit: "achat_valider", motif: false, libelle: "Confirmé par le fournisseur" },
  solder: { de: ["partiellement_recu"], vers: "recu", droit: "achat_valider", motif: true, libelle: "Solder (le reste ne sera pas livré)" },
  annuler: { de: ["brouillon", "envoye", "confirme"], vers: "annule", droit: "achat_valider", motif: true, libelle: "Annuler le bon" },
} as const satisfies Record<string, { de: readonly StatutBon[]; vers: StatutBon; droit: ActionPos; motif: boolean; libelle: string }>;
export type ActionBon = keyof typeof ACTIONS_BON;

/** Statut d'arrivée d'un geste, ou refus expliqué si le bon n'est pas dans un état qui le permet. */
export function transitionBon(statut: string, action: ActionBon): StatutBon {
  const regle = ACTIONS_BON[action];
  if (!(regle.de as readonly string[]).includes(statut)) {
    const libelle = LIBELLES_STATUT_BON[statut as StatutBon] ?? statut;
    throw new ErreurPos("transition_refusee", 409, `Ce bon de commande est « ${libelle} » : cette action n'est plus possible. Rechargez la page pour voir son état actuel.`);
  }
  return regle.vers;
}

/** Statut d'un bon après une réception : « reçu » quand chaque ligne a tout reçu. */
export function statutApresReception(lignes: { quantite: number; quantiteRecue: number }[]): "partiellement_recu" | "recu" {
  return lignes.length > 0 && lignes.every((l) => l.quantiteRecue >= l.quantite) ? "recu" : "partiellement_recu";
}

export function totalBon(lignes: { quantite: number; prixUnitaire: number; uniteVente?: string | null }[], decimales = 0): number {
  return arrondir(lignes.reduce((s, l) => s + montantBrut(l.prixUnitaire, l.quantite, l.uniteVente === "kg" ? "kg" : "piece", decimales), 0), decimales);
}

// ─── Coût d'un article après réception ───────────────────────────────────────

/**
 * RÈGLE RETENUE : coût moyen pondéré.
 *   nouveau coût = (stock avant × coût avant + quantité reçue × coût reçu) / (stock avant + quantité reçue)
 * Le stock mélange des unités achetées à des prix différents : la marge d'une
 * vente doit refléter ce mélange, pas seulement le dernier arrivage. Quand il
 * n'y a rien à pondérer (stock nul ou négatif, coût encore inconnu), c'est le
 * coût de cette réception qui s'applique (« dernier coût »).
 */
export function coutApresReception(p: { stockAvant: number; coutAvant: number | null; quantite: number; coutRecu: number; decimales?: number }): { cout: number; regle: "moyen_pondere" | "dernier_cout" } {
  // Toujours 2 décimales au moins : un coût moyen de 706,67 FCFA arrondi à 707 fausserait les marges à la longue.
  const decimales = Math.max(2, p.decimales ?? 2);
  if (p.coutAvant == null || p.stockAvant <= 0 || p.quantite <= 0) return { cout: arrondir(p.coutRecu, decimales), regle: "dernier_cout" };
  return {
    cout: arrondir((p.stockAvant * p.coutAvant + p.quantite * p.coutRecu) / (p.stockAvant + p.quantite), decimales),
    regle: "moyen_pondere",
  };
}

// ─── Réapprovisionnement ─────────────────────────────────────────────────────

export const FENETRE_VENTES_JOURS = 30;
/** Jours de vente gardés en réserve — même valeur que lib/sourcing/stocks.ts. */
export const SECURITE_JOURS = 14;
/** Ventes minimales sur la période de référence de l'an dernier pour oser un coefficient. */
const VENTES_MIN_SAISON = 10;

export type Saisonnalite = {
  /** Multiplicateur appliqué à la vitesse de vente ; 1 = aucun effet. */
  coefficient: number;
  /** false : pas assez d'historique, le coefficient vaut 1 et ne change rien. */
  estimee: boolean;
  explication: string;
};

/**
 * Saisonnalité simple, calculée sur les ventes réelles de l'an dernier :
 * on compare les 30 jours qui ont SUIVI la même date l'an dernier (`apres`)
 * aux 30 jours qui l'ont PRÉCÉDÉE (`avant`). Si les ventes avaient alors
 * augmenté de 40 %, on s'attend à la même hausse : coefficient 1,4.
 * Borné entre 0,5 et 2 : une estimation ne doit pas doubler une commande à
 * elle seule. C'est une ESTIMATION, à présenter comme telle.
 */
export function saisonnalite(avant: number, apres: number): Saisonnalite {
  if (avant < VENTES_MIN_SAISON) {
    return { coefficient: 1, estimee: false, explication: "Saisonnalité : pas assez d'historique. Il faut des ventes de ce produit à la même période l'an dernier pour l'estimer." };
  }
  const brut = apres / avant;
  const coefficient = Math.round(Math.min(2, Math.max(0.5, brut)) * 100) / 100;
  const pct = Math.round((brut - 1) * 100);
  const borne = coefficient !== Math.round(brut * 100) / 100 ? ` (effet limité à ×${coefficient.toLocaleString("fr-FR")})` : "";
  return {
    coefficient, estimee: true,
    explication: pct === 0
      ? "Saisonnalité (estimation) : l'an dernier, les ventes sont restées stables à cette période."
      : `Saisonnalité (estimation) : l'an dernier, à la même période, les ventes ont ${pct > 0 ? "augmenté" : "baissé"} de ${Math.abs(pct)} % sur les 30 jours suivants${borne}.`,
  };
}

export type CalculReappro = {
  /** Ventes par jour retenues (vitesse × coefficient saisonnier). */
  ventesParJour: number;
  /** Besoin pendant le délai du fournisseur. */
  besoinDelai: number;
  /** Stock de sécurité : 14 jours de vente, ou le seuil d'alerte du produit s'il est plus haut. */
  securite: number;
  /** Besoin − stock − déjà en commande (jamais négatif). */
  net: number;
  /** Quantité recommandée, arrondie au minimum de commande du fournisseur. */
  quantite: number;
};

/**
 * Quantité à commander :
 *   ventes par jour × coefficient × délai fournisseur  (ce qui se vendra en attendant la livraison)
 * + stock de sécurité                                  (14 jours de vente, ou le seuil d'alerte du produit)
 * − stock actuel − quantités déjà en commande
 * arrondie au multiple supérieur du minimum de commande.
 */
export function calculerReappro(p: { ventes30j: number; coefficient: number; delaiJours: number; stock: number; enCommande: number; stockMin?: number | null; moq?: number | null }): CalculReappro {
  const ventesParJour = (Math.max(0, p.ventes30j) / FENETRE_VENTES_JOURS) * p.coefficient;
  const besoinDelai = Math.ceil(ventesParJour * Math.max(0, p.delaiJours));
  const securite = Math.max(Math.ceil(ventesParJour * SECURITE_JOURS), p.stockMin ?? 0);
  const net = Math.max(0, besoinDelai + securite - Math.max(0, p.stock) - Math.max(0, p.enCommande));
  const moq = Math.max(1, Math.floor(p.moq ?? 1));
  return { ventesParJour, besoinDelai, securite, net, quantite: net > 0 ? Math.ceil(net / moq) * moq : 0 };
}

// ─── Texte du bon à envoyer ──────────────────────────────────────────────────

export type BonTexte = {
  numero: string;
  boutique: string;
  telephoneBoutique?: string | null;
  fournisseur: string;
  /** Date ISO de création. */
  date: string;
  dateAttendue?: string | null;
  lieuLivraison?: string | null;
  notes?: string | null;
  total: number;
  lignes: { nom: string; variante?: string | null; sku?: string | null; quantite: number; prixUnitaire: number; uniteVente?: string | null }[];
};

const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

/** Bon de commande en texte brut : à copier, à envoyer par WhatsApp ou par e-mail. `fmt` formate un montant dans la devise de la boutique. */
export function texteBon(b: BonTexte, fmt: (montant: number) => string, decimales = 0): string {
  const lignes = b.lignes.map((l, i) => {
    const unite: UniteVente = l.uniteVente === "kg" ? "kg" : "piece";
    const prix = l.prixUnitaire > 0
      ? ` × ${fmt(l.prixUnitaire)}${unite === "kg" ? "/kg" : ""} = ${fmt(montantBrut(l.prixUnitaire, l.quantite, unite, decimales))}`
      : " (prix à confirmer)";
    return `${i + 1}. ${l.nom}${l.variante ? ` (${l.variante})` : ""}${l.sku ? ` [réf. ${l.sku}]` : ""} : ${libelleQuantite(l.quantite, unite)}${prix}`;
  });
  return [
    `BON DE COMMANDE ${b.numero}`,
    `De : ${b.boutique}${b.telephoneBoutique ? ` (${b.telephoneBoutique})` : ""}`,
    `Pour : ${b.fournisseur}`,
    `Date : ${jour(b.date)}`,
    ...(b.dateAttendue ? [`Livraison souhaitée le : ${jour(b.dateAttendue)}`] : []),
    ...(b.lieuLivraison ? [`Lieu de livraison : ${b.lieuLivraison}`] : []),
    "",
    ...lignes,
    "",
    `TOTAL : ${fmt(b.total)}`,
    ...(b.notes ? ["", `Note : ${b.notes}`] : []),
    "",
    "Merci de confirmer la disponibilité, les prix et la date de livraison.",
  ].join("\n");
}
