// Logique PURE de l'écran de caisse (aucun React, aucun réseau) : passage d'un
// article du catalogue à une ligne de panier, fusion des lignes, lecture des
// saisies numériques, détection d'un scanner en mode clavier.
import { cleArticle, type ArticleResolu, type LigneDemande, type LignePanier, type Remise, type VarianteArticle } from "@/lib/pos/types";

/** Ligne du panier telle que l'écran la tient : la ligne de calcul + de quoi l'afficher et la modifier. */
export type LigneCaisse = LignePanier & {
  id: string;
  /** Stock affiché au moment de l'ajout (grammes si kg) ; null = inconnu. Le serveur seul décide. */
  stock: number | null;
  /** Variantes du produit, pour le changement de variante depuis le panier. */
  variantes: VarianteArticle[];
  suiviSerie: boolean;
};

/** Client associé à la vente, réduit à ce que la caisse affiche et calcule. */
export type ClientCaisse = {
  id: string; nom: string; telephone?: string | null; email?: string | null; codeClient?: string | null;
  segment?: string | null; niveauFidelite?: string | null; pointsFidelite?: number | null;
  creditPlafond?: number | null; creditUtilise?: number | null; creditBloque?: boolean | null;
};

/** Lit un client rendu par /api/pos/clients (« ResumeClient » : points, niveau, credit{…}) ; null s'il est inutilisable. */
export function versClientCaisse(c: any): ClientCaisse | null {
  if (!c || typeof c.id !== "string" || typeof c.nom !== "string") return null;
  return {
    id: c.id, nom: c.nom, telephone: c.telephone ?? null, email: c.email ?? null, codeClient: c.codeClient ?? null, segment: c.segment ?? null,
    niveauFidelite: c.niveau ?? null, pointsFidelite: typeof c.points === "number" ? c.points : null,
    creditPlafond: c.credit?.plafond ?? null, creditUtilise: c.credit?.utilise ?? null, creditBloque: c.credit?.bloque ?? null,
  };
}

/** Tout ce qui fait une vente en cours — c'est aussi ce qui est gardé dans un panier suspendu. */
export type ContenuPanier = { lignes: LigneCaisse[]; remise: Remise | null; codePromo: string; client: ClientCaisse | null; note: string };

/** Identifiant local (ligne de panier, ligne de paiement). */
export const idLocal = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Ce qu'il faut demander au caissier avant de pouvoir ajouter cet article. */
export function precisionsRequises(a: ArticleResolu): { variante: boolean; poids: boolean; serie: boolean } {
  return {
    variante: a.variantes.length > 0 && !a.varianteId,
    poids: a.uniteVente === "kg" && !(a.poidsGrammes && a.poidsGrammes > 0),
    serie: a.suiviSerie && !a.numeroSerie && !a.numeroSerieId,
  };
}

/** Ligne de panier pour un article (et, s'il en a, la variante choisie). Quantité : pièces, ou grammes pour un produit au poids. */
export function ligneDepuisArticle(a: ArticleResolu, o: { varianteId?: string | null; quantite?: number; numeroSerie?: string | null } = {}): LigneCaisse {
  const varianteId = o.varianteId ?? a.varianteId ?? null;
  const v = varianteId ? a.variantes.find((x) => x.id === varianteId) ?? null : null;
  return {
    id: idLocal(),
    produitId: a.produitId, varianteId,
    quantite: o.quantite ?? a.poidsGrammes ?? 1,
    numeroSerie: o.numeroSerie ?? a.numeroSerie ?? null, numeroSerieId: o.numeroSerie ? null : a.numeroSerieId ?? null,
    nom: a.nom, variante: v ? `${v.nom}: ${v.valeur}` : a.variante,
    prixUnitaire: v ? v.prix : a.prix,
    uniteVente: a.uniteVente, tauxTVA: a.tauxTVA, cout: v ? v.cout : a.cout, categorie: a.categorie, image: v?.image ?? a.image,
    stock: v ? v.stockMagasin ?? v.stock : a.stockMagasin ?? a.stock,
    variantes: a.variantes, suiviSerie: a.suiviSerie,
  };
}

/**
 * Ajoute une ligne au panier. Un même article à la pièce s'additionne à sa
 * ligne ; un produit au poids, à numéro de série ou offert garde sa ligne.
 */
export function ajouterLigne(lignes: LigneCaisse[], nouvelle: LigneCaisse): LigneCaisse[] {
  const fusionnable = (l: LigneCaisse) => l.uniteVente !== "kg" && !l.suiviSerie && !l.offert && !l.numeroSerie && !l.numeroSerieId;
  const cle = cleArticle(nouvelle.produitId, nouvelle.varianteId);
  const i = fusionnable(nouvelle) ? lignes.findIndex((l) => fusionnable(l) && cleArticle(l.produitId, l.varianteId) === cle) : -1;
  if (i < 0) return [...lignes, nouvelle];
  return lignes.map((l, j) => (j === i ? { ...l, quantite: l.quantite + nouvelle.quantite } : l));
}

/** Ce qui part au serveur pour une ligne : jamais de prix catalogue ni de libellé. */
export function versDemande(l: LigneCaisse): LigneDemande {
  return {
    produitId: l.produitId, varianteId: l.varianteId ?? null, quantite: l.quantite,
    prixPersonnalise: l.prixPersonnalise ?? null, remise: l.remise ?? null, offert: l.offert || undefined,
    commentaire: l.commentaire?.trim() || null, numeroSerie: l.numeroSerie?.trim() || null, numeroSerieId: l.numeroSerieId ?? null,
  };
}

/** Lit un nombre saisi à la française (« 1 250,5 ») ; null si ce n'en est pas un. */
export function lireNombre(saisie: string): number | null {
  const propre = saisie.replace(/[\s  ]/g, "").replace(",", ".");
  if (!propre || !/^\d*\.?\d+$|^\d+\.$/.test(propre)) return null;
  const n = Number(propre);
  return Number.isFinite(n) ? n : null;
}

/** Poids saisi en kilos → grammes entiers (convention du POS) ; null si la saisie n'est pas un poids positif. */
export function kgVersGrammes(saisie: string): number | null {
  const kg = lireNombre(saisie);
  if (kg === null) return null;
  const g = Math.round(kg * 1000);
  return g > 0 ? g : null;
}

/**
 * Détecteur de scanner USB / Bluetooth en mode clavier : une douchette « tape »
 * le code en rafale (quelques millisecondes par touche) puis Entrée — bien plus
 * vite qu'une personne. À alimenter avec chaque touche et son horodatage ;
 * rend le code quand une rafale se termine par Entrée, null sinon.
 */
export function creerDetecteurScan(o: { intervalleMax?: number; longueurMin?: number } = {}) {
  // Réglables : certaines douchettes Bluetooth sont plus lentes que les USB.
  const intervalleMax = o.intervalleMax ?? 50, longueurMin = o.longueurMin ?? 4;
  let tampon = "", dernier = 0;
  return (touche: string, horodatage: number): string | null => {
    if (touche === "Enter") {
      const code = horodatage - dernier <= intervalleMax * 2 ? tampon : "";
      tampon = "";
      return code.length >= longueurMin ? code : null;
    }
    if (touche.length !== 1) return null;
    tampon = horodatage - dernier <= intervalleMax ? tampon + touche : touche;
    dernier = horodatage;
    return null;
  };
}
