// Conversion de devises — module pur (aucune dépendance Prisma/serveur),
// importable aussi bien côté serveur que côté client (ex: PlansGrid).

/**
 * Taux de conversion approximatifs depuis XAF vers les devises mondiales.
 * 1 XAF = X unités de la devise cible.
 */
export const XAF_TO: Record<string, number> = {
  XAF: 1, XOF: 1,
  EUR: 0.001524, GBP: 0.00125, CHF: 0.00176,
  USD: 0.001626, CAD: 0.00218, AUD: 0.0025, NZD: 0.0027,
  NGN: 2.6,  GHS: 0.024,  KES: 0.21,  ZAR: 0.031,
  ETB: 0.21, TZS: 4.39,  UGX: 6.18,  RWF: 2.27,
  GNF: 14,   MZN: 0.104, AOA: 1.5,   ZMW: 0.044,
  CDF: 4.6,  MAD: 0.016, DZD: 0.22,  TND: 0.005,
  EGP: 0.078, MGA: 7.5,
  // Reste des 54 pays proposés à l'inscription (sinon repli silencieux sur le taux USD)
  KMF: 0.75, CVE: 0.168, STN: 0.0373, // arrimées à l'euro
  NAD: 0.031, LSL: 0.031, SZL: 0.031, // arrimées au rand
  DJF: 0.289, ERN: 0.0244, SOS: 0.93, SSP: 7.3, SDG: 0.98, BIF: 4.8,
  MWK: 2.82, BWP: 0.022, MUR: 0.075, SCR: 0.023, SLE: 0.037, LRD: 0.31,
  GMD: 0.115, MRU: 0.065, LYD: 0.0088,
  INR: 0.136, CNY: 0.012, JPY: 0.245, IDR: 25.6,
  PHP: 0.094, THB: 0.056, VND: 40,   SGD: 0.00216,
  MYR: 0.0075, KRW: 2.17, PKR: 0.454, BDT: 0.18,
  AED: 0.006, SAR: 0.0061, QAR: 0.0059, TRY: 0.053,
  ILS: 0.006, BHD: 0.00061, KWD: 0.0005,
  BRL: 0.0089, ARS: 1.63, COP: 6.5,  CLP: 1.55,
  MXN: 0.029, PEN: 0.012,
  SEK: 0.0171, NOK: 0.0174, DKK: 0.0105, PLN: 0.0067,
};

/** Convertit un montant de XAF vers une devise, arrondi intelligemment. */
export function convertirDepuisXAF(montantXAF: number, devise: string): number {
  const rate = XAF_TO[devise] ?? XAF_TO["USD"];
  const converted = montantXAF * rate;
  // Arrondi selon l'ordre de grandeur
  if (converted >= 1000) return Math.round(converted / 10) * 10;
  if (converted >= 100)  return Math.round(converted);
  if (converted >= 10)   return Math.round(converted * 10) / 10;
  return Math.round(converted * 100) / 100;
}

/** Montant d'une devise ramené en XAF (portefeuille plateforme AXSO, tenu en XAF). */
export function versXAF(montant: number, devise: string, taux: Record<string, number> = XAF_TO): number {
  const rate = taux[devise] ?? taux["USD"];
  return Math.round((montant / rate) * 100) / 100;
}

// Carte devise par code pays ISO2 — couverture mondiale
export const PAYS_DEVISES: Record<string, string> = {
  // Afrique de l'Ouest CFA
  SN: "XOF", CI: "XOF", TG: "XOF", BJ: "XOF", ML: "XOF", BF: "XOF", GN: "GNF", NE: "XOF", GW: "XOF",
  // Afrique Centrale CFA
  CM: "XAF", GA: "XAF", CG: "XAF", TD: "XAF", CF: "XAF", CD: "CDF", GQ: "XAF",
  // Afrique subsaharienne
  GH: "GHS", NG: "NGN", KE: "KES", ZA: "ZAR", ET: "ETB", TZ: "TZS",
  UG: "UGX", RW: "RWF", MZ: "MZN", AO: "AOA", ZM: "ZMW", ZW: "USD",
  SL: "SLE", LR: "LRD", GM: "GMD", CV: "CVE", MR: "MRU", KM: "KMF",
  DJ: "DJF", ER: "ERN", SO: "SOS", SS: "SSP", SD: "SDG", BI: "BIF",
  MW: "MWK", NA: "NAD", BW: "BWP", LS: "LSL", SZ: "SZL", MU: "MUR",
  SC: "SCR", ST: "STN", MG: "MGA",
  // Afrique du Nord
  MA: "MAD", DZ: "DZD", TN: "TND", EG: "EGP", LY: "LYD",
  // Europe
  FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", PT: "EUR", NL: "EUR", BE: "EUR",
  GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN",
  // Amérique du Nord
  US: "USD", CA: "CAD", MX: "MXN",
  // Amérique Latine
  BR: "BRL", AR: "ARS", CO: "COP", CL: "CLP", PE: "PEN", VE: "USD",
  // Asie
  CN: "CNY", JP: "JPY", IN: "INR", ID: "IDR", PH: "PHP", TH: "THB",
  VN: "VND", SG: "SGD", MY: "MYR", KR: "KRW", PK: "PKR", BD: "BDT",
  // Moyen-Orient
  AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD", OM: "OMR",
  TR: "TRY", IL: "ILS", LB: "USD",
  // Océanie
  AU: "AUD", NZ: "NZD",
};

/** Les 54 pays de l'Union africaine — seuls pays proposés à la création/modification d'une boutique. */
export const PAYS_AFRICAINS = "DZ AO BJ BW BF BI CV CM CF KM CG CD CI DJ EG ER SZ ET GA GM GH GN GW GQ KE LS LR LY MG MW ML MA MR MU MZ NA NE NG UG RW ST SN SC SL SO SD SS TZ TD TG TN ZM ZW ZA".split(" ");

/** Liste des pays proposés dans les formulaires (code ISO2 + nom français natif). */
export const PAYS_OPTIONS = PAYS_AFRICAINS
  .map((code) => ({ code, nom: new Intl.DisplayNames(["fr"], { type: "region" }).of(code) ?? code }))
  .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

/** La devise d'une boutique découle TOUJOURS de son pays ; `repli` seulement pour un pays hors carte. */
export function deviseDuPays(pays: string | null | undefined, repli: string): string {
  return (pays && PAYS_DEVISES[pays]) || repli;
}

/** Montant d'une devise vers une autre (via XAF) — prix de vente affichés au visiteur. */
export function convertirMontant(montant: number, de: string, vers: string, taux: Record<string, number> = XAF_TO): number {
  if (de === vers || !taux[de] || !taux[vers]) return montant;
  return Math.round((montant / taux[de]) * taux[vers]);
}

/** Multiplicateur devise boutique → devise visiteur (1 si aucune conversion possible). */
export const ratioConversion = (de: string, vers: string, taux: Record<string, number> = XAF_TO) =>
  de === vers || !taux[de] || !taux[vers] ? 1 : taux[vers] / taux[de];

/** Devise d'affichage possible (taux connu), sinon celle de la boutique. */
export const deviseAffichable = (devise: string | null | undefined, repli: string) => (devise && XAF_TO[devise] && XAF_TO[repli] ? devise : repli);
