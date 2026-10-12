// Calcul du panier de la caisse : prix, remises, promotions, taxes, total.
// PUR et CLIENT-SAFE : aucune lecture en base, aucun effet. L'écran l'exécute
// pour afficher le panier ; le serveur le REFAIT avec les prix relus en base
// (lib/pos/vente.ts) — seul son résultat à lui est enregistré.
//
// ORDRE DU CALCUL
//   1. brut      = prix retenu × quantité (prix personnalisé s'il est autorisé)
//   2. − remise saisie sur la ligne (ou tout le brut si la ligne est offerte)
//   3. − remise de promotion (lib/pos/promotions)
//   4. − remise globale du panier, puis code promo, répartis sur les lignes au
//        prorata de leur montant (la dernière ligne absorbe l'arrondi)
//   5. taxes ligne par ligne, au taux du produit sinon à celui de la boutique
//
// TAXES — les taux sont des FRACTIONS (0.1925 = 19,25 %), comme Tenant.tauxTVA.
//   prixTTC = true (défaut) : les prix contiennent la TVA ; elle est extraite
//     du montant (taxe = montant − montant / (1 + taux)), le total ne bouge pas.
//   prixTTC = false : la TVA s'ajoute au montant.
//
// PRODUITS AU POIDS (Produit.uniteVente = "kg") — convention de tout le POS :
//   - le stock (Produit.stock, Variante.stock, StockEntrepot.quantite) et les
//     quantités (LignePanier.quantite, LigneCommande.quantite) sont en GRAMMES
//     entiers : les colonnes restent des entiers, sans changer le reste d'AXSO ;
//   - le prix catalogue et le coût sont au KILO ;
//   - brut = prix au kilo × grammes / 1000 ;
//   - en base, LigneCommande.prix est le prix au GRAMME (prix au kilo / 1000)
//     pour que « prix × quantite » reste le montant de la ligne dans tous les
//     écrans existants ; LigneCommande.mesure garde le poids en kilos.
//
// DROITS — le calcul ne refuse rien lui-même : il rend des `alertes`. Une
// alerte `bloquant` (remise sans le droit, au-delà du plafond — par ligne, sur
// le panier, ET en cumul des deux —, prix modifié ou
// article offert sans le droit, quantité invalide) fait refuser la vente par le
// serveur ; l'écran s'en sert pour prévenir avant l'envoi.
import { reductionPromo } from "../pricing";
import { appliquerPromotions, type PromotionActive } from "./promotions";
import { REGLAGES_DEFAUT, type AlertePanier, type DroitsPos, type LigneCalculee, type LignePanier, type PanierCalcule, type Remise, type UniteVente } from "./types";

/** Devises sans centimes en usage sur AXSO : montants arrondis à l'unité. */
const SANS_CENTIMES = new Set(["XAF", "XOF", "GNF", "RWF", "UGX", "BIF", "DJF", "KMF"]);

export function decimalesDevise(devise?: string | null): number {
  return !devise || SANS_CENTIMES.has(devise.toUpperCase()) ? 0 : 2;
}

export function arrondir(montant: number, decimales = 0): number {
  const f = 10 ** decimales;
  // + EPSILON : 1.005 × 100 vaut 100.49999… en flottant.
  return Math.round((montant + Number.EPSILON) * f) / f;
}

/** Montant d'une quantité : pièces × prix, ou grammes × prix au kilo / 1000. */
export function montantBrut(prix: number, quantite: number, unite: UniteVente = "piece", decimales = 0): number {
  return arrondir(unite === "kg" ? (prix * quantite) / 1000 : prix * quantite, decimales);
}

/** Montant d'une remise sur une base, borné à [0, base]. */
export function montantRemise(remise: Remise | null | undefined, base: number, decimales = 0): number {
  if (!remise || !(remise.valeur > 0) || base <= 0) return 0;
  const m = remise.type === "pourcentage" ? (base * Math.min(remise.valeur, 100)) / 100 : remise.valeur;
  return Math.min(base, arrondir(m, decimales));
}

/** Code promo tel que lib/pricing.ts (reductionPromo) l'attend — une ligne CodePromo convient. */
export type CodePromoPanier = { id?: string; type: string; valeur: number; minCommande?: number | null; maxUtilisations?: number | null; utilisations?: number; dateExpiration?: Date | null };

export type OptionsPanier = {
  /** Taux de TVA de la boutique, en fraction (Tenant.tauxTVA). */
  tauxTVA: number;
  droits: DroitsPos;
  client?: { id: string; segment?: string | null; niveauFidelite?: string | null } | null;
  promotions?: PromotionActive[];
  /** Devise de la boutique : fixe l'arrondi (défaut : sans centimes). */
  devise?: string | null;
  /** ReglagesPos.reglages.taxes.prixTTC (défaut true). */
  prixTTC?: boolean;
  /** ReglagesPos.reglages.remises.plafondPct (défaut 10). */
  plafondRemisePct?: number;
  /** Remise sur l'ensemble du panier. */
  remise?: Remise | null;
  codePromo?: CodePromoPanier | null;
  magasinId?: string | null;
  /**
   * Rejeu d'une vente saisie hors ligne (lib/pos/vente.ts, SERVEUR uniquement) :
   * `lignesFigees` = lignes dont le prix encaissé hors ligne est imposé (pas de
   * contrôle du droit « prix_personnalise » : ce n'est pas un geste du caissier) ;
   * `ajustement` = écart entre le total recalculé et le total encaissé, retiré
   * comme une remise globale hors contrôle de droits. Les bornes sont vérifiées
   * par l'appelant (SEUIL_ECART_REJEU).
   */
  rejeu?: { lignesFigees: ReadonlySet<number>; ajustement: number };
};

export function calculerPanier(lignes: LignePanier[], o: OptionsPanier): PanierCalcule {
  const dec = decimalesDevise(o.devise);
  const prixTTC = o.prixTTC ?? REGLAGES_DEFAUT.taxes.prixTTC;
  const plafond = o.plafondRemisePct ?? REGLAGES_DEFAUT.remises.plafondPct;
  const alertes: AlertePanier[] = [];
  const refuser = (code: string, message: string, ligne?: number) => alertes.push({ code, message, ligne, bloquant: true });

  /** Une remise manuelle exige le droit « remise », et « remise_hors_plafond » au-delà du plafond. */
  const controlerRemise = (montant: number, base: number, ligne?: number) => {
    if (montant <= 0) return;
    if (!o.droits.remise) return refuser("remise_non_autorisee", "Vous n'avez pas le droit d'accorder une remise. Demandez à un responsable.", ligne);
    const pct = base > 0 ? (montant / base) * 100 : 100;
    if (pct > plafond + 1e-6 && !o.droits.remise_hors_plafond) {
      refuser("remise_hors_plafond", `Cette remise dépasse le plafond autorisé (${plafond} %). Demandez à un responsable.`, ligne);
    }
  };

  // 1 et 2 — brut et remise de ligne.
  const calc = lignes.map((l, i) => {
    const unite: UniteVente = l.uniteVente === "kg" ? "kg" : "piece";
    if (!Number.isInteger(l.quantite) || l.quantite <= 0) {
      refuser("quantite_invalide", unite === "kg" ? `Indiquez le poids de « ${l.nom} ».` : `La quantité de « ${l.nom} » n'est pas valide.`, i);
    }
    const quantite = Number.isFinite(l.quantite) && l.quantite > 0 ? l.quantite : 0;
    const personnalise = l.prixPersonnalise !== null && l.prixPersonnalise !== undefined && l.prixPersonnalise >= 0 && l.prixPersonnalise !== l.prixUnitaire;
    if (personnalise && !o.droits.prix_personnalise && !o.rejeu?.lignesFigees.has(i)) {
      refuser("prix_non_autorise", `Vous n'avez pas le droit de modifier le prix de « ${l.nom} ». Demandez à un responsable.`, i);
    }
    const prixApplique = personnalise ? (l.prixPersonnalise as number) : l.prixUnitaire;
    const brut = montantBrut(prixApplique, quantite, unite, dec);
    let remiseLigne = 0;
    if (l.offert) {
      remiseLigne = brut;
      if (!o.droits.produit_offert) refuser("offert_non_autorise", `Vous n'avez pas le droit d'offrir « ${l.nom} ». Demandez à un responsable.`, i);
    } else {
      remiseLigne = montantRemise(l.remise, brut, dec);
      controlerRemise(remiseLigne, brut, i);
    }
    return { l, unite, quantite, prixApplique, brut, remiseLigne, remisePromotion: 0, promotionId: null as string | null, net: brut - remiseLigne, remiseRepartie: 0 };
  });

  // 3 — promotions : au plus une par ligne, jamais plus que le net, rien sur une ligne offerte.
  const promotionsAppliquees = new Map<string, { promotionId: string; nom: string; montant: number }>();
  if (o.promotions?.length) {
    const reductions = appliquerPromotions(
      calc.map((c, index) => ({ index, produitId: c.l.produitId, varianteId: c.l.varianteId ?? null, categorie: c.l.categorie ?? null, quantite: c.quantite, prixApplique: c.prixApplique, net: c.net, offert: !!c.l.offert })),
      o.promotions,
      { client: o.client ?? null, magasinId: o.magasinId ?? null, decimales: dec, codePromoIds: o.codePromo?.id ? [o.codePromo.id] : [] },
    );
    for (const r of reductions) {
      const c = calc[r.index];
      if (!c || c.l.offert || c.promotionId || !(r.montant > 0)) continue;
      const montant = Math.min(c.net, arrondir(r.montant, dec));
      c.remisePromotion = montant; c.promotionId = r.promotionId; c.net -= montant;
      const cumul = promotionsAppliquees.get(r.promotionId) ?? { promotionId: r.promotionId, nom: r.nom, montant: 0 };
      cumul.montant = arrondir(cumul.montant + montant, dec);
      promotionsAppliquees.set(r.promotionId, cumul);
    }
  }

  // 4 — remise globale puis code promo, répartis au prorata du net.
  const net = arrondir(calc.reduce((s, c) => s + c.net, 0), dec);
  const remiseSaisie = montantRemise(o.remise, net, dec);
  controlerRemise(remiseSaisie, net);
  // Cumul : remises de ligne + remise du panier, jugées ENSEMBLE sur le brut des lignes non offertes —
  // sinon 10 % par ligne puis 10 % sur le panier passent (≈ 19 %) sous un plafond de 10 %.
  if (remiseSaisie > 0 && o.droits.remise && !o.droits.remise_hors_plafond && !alertes.some((a) => a.code === "remise_hors_plafond")) {
    const payantes = calc.filter((c) => !c.l.offert);
    const brut = payantes.reduce((s, c) => s + c.brut, 0);
    const manuelles = payantes.reduce((s, c) => s + c.remiseLigne, 0) + remiseSaisie;
    if (brut > 0 && (manuelles / brut) * 100 > plafond + 1e-6) {
      refuser("remise_hors_plafond", `Les remises cumulées (lignes + panier) dépassent le plafond autorisé (${plafond} %). Demandez à un responsable.`);
    }
  }
  const remiseGlobale = Math.min(net, arrondir(remiseSaisie + Math.max(0, o.rejeu?.ajustement ?? 0), dec));
  const remiseCodePromo = Math.min(net - remiseGlobale, arrondir(reductionPromo(o.codePromo, net - remiseGlobale), dec));
  const aRepartir = remiseGlobale + remiseCodePromo;
  if (aRepartir > 0 && net > 0) {
    const concernees = calc.filter((c) => c.net > 0);
    let reste = aRepartir;
    concernees.forEach((c, i) => {
      const part = i === concernees.length - 1 ? reste : Math.min(c.net, arrondir((aRepartir * c.net) / net, dec));
      c.remiseRepartie = Math.min(c.net, arrondir(part, dec));
      reste = arrondir(reste - c.remiseRepartie, dec);
    });
  }

  // 5 — taxes.
  const parTaux = new Map<number, { taux: number; base: number; montant: number }>();
  const resultat: LigneCalculee[] = calc.map((c) => {
    const montant = arrondir(c.net - c.remiseRepartie, dec);
    const taux = Math.max(0, c.l.tauxTVA ?? o.tauxTVA ?? 0);
    const taxe = prixTTC ? arrondir(montant - montant / (1 + taux), dec) : arrondir(montant * taux, dec);
    const ht = prixTTC ? arrondir(montant - taxe, dec) : montant;
    if (taux > 0 && montant > 0) {
      const t = parTaux.get(taux) ?? { taux, base: 0, montant: 0 };
      t.base = arrondir(t.base + ht, dec); t.montant = arrondir(t.montant + taxe, dec);
      parTaux.set(taux, t);
    }
    return {
      ...c.l, uniteVente: c.unite, prixApplique: c.prixApplique, brut: c.brut,
      remiseLigne: c.remiseLigne, remisePromotion: c.remisePromotion, promotionId: c.promotionId, remiseRepartie: c.remiseRepartie,
      remiseTotale: arrondir(c.remiseLigne + c.remisePromotion + c.remiseRepartie, dec),
      taux, ht, taxe, total: arrondir(ht + taxe, dec),
    };
  });

  const somme = (f: (l: LigneCalculee) => number) => arrondir(resultat.reduce((s, l) => s + f(l), 0), dec);
  const remiseLignes = somme((l) => l.remiseLigne);
  const remisePromotions = somme((l) => l.remisePromotion);
  return {
    lignes: resultat,
    articles: calc.reduce((s, c) => s + (c.unite === "kg" ? (c.quantite > 0 ? 1 : 0) : c.quantite), 0),
    sousTotal: somme((l) => l.brut),
    remiseLignes, remisePromotions, remiseGlobale, remiseCodePromo,
    totalRemises: arrondir(remiseLignes + remisePromotions + aRepartir, dec),
    totalHT: somme((l) => l.ht),
    montantTaxes: somme((l) => l.taxe),
    taxesParTaux: [...parTaux.values()].sort((a, b) => a.taux - b.taux),
    frais: 0,
    total: somme((l) => l.total),
    promotionsAppliquees: [...promotionsAppliquees.values()],
    alertes,
  };
}

/**
 * Prix unitaire à écrire dans LigneCommande.prix : le prix retenu à la pièce,
 * ou au GRAMME pour un produit au poids (voir la convention en tête de fichier).
 */
export function prixLigneCommande(l: Pick<LigneCalculee, "prixApplique" | "uniteVente">): number {
  return l.uniteVente === "kg" ? l.prixApplique / 1000 : l.prixApplique;
}

/** Quantité lisible : « 3 » ou « 1,250 kg ». */
export function libelleQuantite(quantite: number, unite: UniteVente = "piece"): string {
  return unite === "kg" ? `${(quantite / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg` : String(quantite);
}
