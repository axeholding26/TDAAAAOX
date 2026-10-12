// Coût rendu d'un produit importé, PAR UNITÉ, dans la devise du marchand :
// produit + transport international + assurance + droits/taxes estimés +
// dédouanement/transitaire + livraison locale.
//
// Fonction PURE (aucun accès réseau ni base) : utilisable côté client pour un
// calcul en direct. Pour les taux du jour, l'appelant serveur passe
// `tauxChange: await tauxDuJour()` (lib/taux-change.ts) ; sinon repli sur les
// taux fixes de lib/devise-convert.ts.
//
// Conventions d'unités :
// - `prixUnitaire` est dans `deviseFournisseur` ; TOUS les autres montants sont
//   dans `deviseCible` (la devise du marchand).
// - transport, assurance, transitaire et dédouanement sont ceux de l'envoi
//   ENTIER (les `quantite` unités) : ils sont répartis par unité.
// - `livraisonLocale` est déjà par unité (livraison au client final).
// - les droits et taxes sont une ESTIMATION : taux × valeur CAF (produit +
//   transport + assurance). Le taux vient du marchand, sinon de la valeur de
//   départ du pays (lib/sourcing/pays.ts).
import { z } from "zod";
import { XAF_TO } from "../devise-convert";
import { configPays, type CodePays } from "./pays";

export interface EntreeCoutRendu {
  prixUnitaire: number;
  deviseFournisseur: string;
  quantite: number;
  /** Poids d'UNE unité. Ne sert qu'avec `tarifTransportKg`, quand le transport n'est pas saisi. */
  poidsKg?: number;
  pays: CodePays;
  deviseCible: string;
  transportInternational?: number;
  assurance?: number;
  /** Part de la valeur CAF, ex. 0.3 = 30 %. */
  tauxDroits?: number;
  fraisTransitaire?: number;
  fraisDedouanement?: number;
  livraisonLocale?: number;
  /**
   * Table « 1 XAF = x devise » (forme de XAF_TO / tauxDuJour()), ou directement
   * le nombre d'unités de `deviseCible` pour 1 unité de `deviseFournisseur`.
   */
  tauxChange?: Record<string, number> | number;
  /** Tarif du transitaire au kilo (devise cible), pour estimer le transport à partir du poids. */
  tarifTransportKg?: number;
}

export interface LigneCout {
  cle: string;
  libelle: string;
  montant: number;
}

export interface CoutRendu {
  lignes: LigneCout[];
  total: number;
  devise: string;
}

const positif = (n: number | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

/** Arrondi d'affichage : à l'unité pour les devises sans centimes usuels, sinon au centime. */
export function arrondirMontant(montant: number, devise: string): number {
  return ["USD", "EUR", "GHS", "GBP", "CNY"].includes(devise) ? Math.round(montant * 100) / 100 : Math.round(montant);
}

const ALIAS_DEVISE: Record<string, string> = { RMB: "CNY", YUAN: "CNY", CNH: "CNY", "¥": "CNY", "￥": "CNY", $: "USD", US$: "USD", "€": "EUR", "£": "GBP", FCFA: "XAF", CFA: "XAF" };

/** Code ISO d'une devise de la table de change (« RMB » → CNY, « $ » → USD), ou null si elle est inconnue. */
export function normaliserDevise(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const code = v.trim().toUpperCase();
  const iso = ALIAS_DEVISE[code] ?? code;
  return XAF_TO[iso] ? iso : null;
}

/** Devise saisie : normalisée, et refusée si elle est inconnue — sans taux, 18 RMB compteraient pour 18 XAF. */
export const schemaDevise = z.string().max(12).transform((v, ctx) => {
  const iso = normaliserDevise(v);
  if (iso) return iso;
  ctx.addIssue({ code: "custom", message: `Devise inconnue : « ${v} ». Utilisez un code comme USD, EUR ou CNY.` });
  return z.NEVER;
});

/**
 * Nombre d'unités de `vers` pour 1 unité de `de`. Les devises sont refusées à la
 * saisie si elles sont inconnues (schemaDevise) ; le repli à 1 ne sert plus qu'aux
 * anciennes lignes déjà en base.
 */
export function tauxEntre(de: string, vers: string, taux: Record<string, number> | number = XAF_TO): number {
  if (typeof taux === "number") return taux > 0 ? taux : 1;
  de = normaliserDevise(de) ?? de; vers = normaliserDevise(vers) ?? vers;
  if (de === vers || !taux[de] || !taux[vers]) return 1;
  return taux[vers] / taux[de];
}

export function calculerCoutRendu(entree: EntreeCoutRendu): CoutRendu {
  const devise = entree.deviseCible;
  const quantite = Math.max(1, Math.floor(positif(entree.quantite)) || 1);
  const parUnite = (montantEnvoi: number | undefined) => positif(montantEnvoi) / quantite;

  const produit = positif(entree.prixUnitaire) * tauxEntre(entree.deviseFournisseur, devise, entree.tauxChange);
  const transport = entree.transportInternational !== undefined
    ? parUnite(entree.transportInternational)
    : positif(entree.poidsKg) * positif(entree.tarifTransportKg);
  const assurance = parUnite(entree.assurance);
  const tauxDroits = entree.tauxDroits !== undefined ? positif(entree.tauxDroits) : configPays(entree.pays).estimations.tauxDroits;
  const droits = (produit + transport + assurance) * tauxDroits;

  const lignes: LigneCout[] = [
    { cle: "produit", libelle: "Coût produit", montant: produit },
    { cle: "transport", libelle: "Transport international", montant: transport },
    { cle: "assurance", libelle: "Assurance", montant: assurance },
    { cle: "droits", libelle: "Droits et taxes (estimation)", montant: droits },
    { cle: "transitaire", libelle: "Frais de transitaire", montant: parUnite(entree.fraisTransitaire) },
    { cle: "dedouanement", libelle: "Dédouanement", montant: parUnite(entree.fraisDedouanement) },
    { cle: "livraison", libelle: "Livraison locale", montant: positif(entree.livraisonLocale) },
  ].map((l) => ({ ...l, montant: arrondirMontant(l.montant, devise) }));

  return { lignes, total: arrondirMontant(lignes.reduce((s, l) => s + l.montant, 0), devise), devise };
}
