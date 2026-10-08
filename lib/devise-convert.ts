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

/** Exemple de numéro mobile au format international, pour chacun des 54 pays (placeholders des champs téléphone). */
const EXEMPLES_TELEPHONE: Record<string, string> = {
  DZ: "+213 5 51 23 45 67", AO: "+244 923 123 456", BJ: "+229 01 90 01 12 34", BW: "+267 71 123 456",
  BF: "+226 70 12 34 56", BI: "+257 79 56 12 34", CV: "+238 991 12 34", CM: "+237 6 71 23 45 67",
  CF: "+236 70 01 23 45", KM: "+269 321 23 45", CG: "+242 06 123 4567", CD: "+243 991 234 567",
  CI: "+225 01 23 45 67 89", DJ: "+253 77 83 10 01", EG: "+20 100 123 4567", ER: "+291 7 123 456",
  SZ: "+268 7612 3456", ET: "+251 91 123 4567", GA: "+241 06 03 12 34", GM: "+220 301 2345",
  GH: "+233 23 123 4567", GN: "+224 601 12 34 56", GW: "+245 955 012 345", GQ: "+240 222 123 456",
  KE: "+254 712 123 456", LS: "+266 5012 3456", LR: "+231 77 012 3456", LY: "+218 91 234 5678",
  MG: "+261 32 12 345 67", MW: "+265 991 23 45 67", ML: "+223 65 01 23 45", MA: "+212 6 50 12 34 56",
  MR: "+222 22 12 34 56", MU: "+230 5251 2345", MZ: "+258 82 123 4567", NA: "+264 81 123 4567",
  NE: "+227 93 12 34 56", NG: "+234 802 123 4567", UG: "+256 712 345 678", RW: "+250 720 123 456",
  ST: "+239 981 2345", SN: "+221 77 123 45 67", SC: "+248 2 510 123", SL: "+232 25 123456",
  SO: "+252 7 1123456", SD: "+249 91 123 1234", SS: "+211 977 123 456", TZ: "+255 621 234 567",
  TD: "+235 63 01 23 45", TG: "+228 90 11 23 45", TN: "+216 20 123 456", ZM: "+260 95 5123456",
  ZW: "+263 71 234 5678", ZA: "+27 71 123 4567",
};

/** Code ISO2 d'un pays africain à partir de son code ou de son nom français (formulaires vitrine) ; null sinon. */
export function codePays(pays?: string | null): string | null {
  if (!pays) return null;
  const code = pays.length === 2 ? pays.toUpperCase() : PAYS_OPTIONS.find((p) => p.nom === pays)?.code;
  return code && PAYS_AFRICAINS.includes(code) ? code : null;
}

/** Placeholder d'un champ téléphone selon le pays (code ISO2 ou nom français) ; Cameroun par défaut. */
export function exempleTelephone(pays?: string | null): string {
  return EXEMPLES_TELEPHONE[codePays(pays) ?? "CM"];
}

/** Groupes proposés pour cocher plusieurs pays d'un coup (règles de livraison). */
export const GROUPES_PAYS: Record<string, string[]> = {
  "UEMOA (XOF)": ["BJ", "BF", "CI", "GW", "ML", "NE", "SN", "TG"],
  "CEMAC (XAF)": ["CM", "CF", "TD", "CG", "GQ", "GA"],
};

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
