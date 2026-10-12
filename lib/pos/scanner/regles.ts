// Règles du scanner — PURES et CLIENT-SAFE (aucun import de Prisma) : partagées
// par les routes /api/pos/scanner, l'écran du téléphone (app/scanner) et les
// composants de la caisse. Tout ce qui se décide sans base de données est ici.
import type { ActionPos, ArticleResolu, ContexteScan, DroitsPos, EvenementPosLu } from "../types";

/** Durée de vie d'un code d'appairage (QR affiché sur la caisse). */
export const DUREE_CODE_MS = 5 * 60_000;
/** Essais d'échange ratés tolérés sur un même code avant qu'il soit condamné (compteur en base). */
export const ESSAIS_MAX = 5;
/** Le téléphone donne signe de vie à ce rythme… */
export const INTERVALLE_SIGNAL_MS = 20_000;
/** …et il est tenu pour déconnecté après ce silence (deux signaux manqués). */
export const SEUIL_SIGNAL_MS = 45_000;
/** L'écran de vente signale sa présence toutes les 15 s ; un onglet en arrière-plan est ralenti à 1 fois par minute, d'où la marge. */
export const SEUIL_ECRAN_VENTE_MS = 90_000;
/** Scans gardés sur le téléphone pendant une coupure. Au-delà, il refuse de scanner plutôt que d'en perdre. */
export const TAILLE_FILE_MAX = 50;

/** Contextes proposés sur le téléphone, dans l'ordre d'affichage, avec le droit exigé. */
export const CONTEXTES_SCAN: { id: ContexteScan; libelle: string; aide: string; droits: ActionPos[] }[] = [
  { id: "vente", libelle: "Vente", aide: "L'article s'ajoute au panier de la caisse.", droits: ["scanner"] },
  { id: "inventaire", libelle: "Inventaire", aide: "L'article est compté dans l'inventaire ouvert sur la caisse.", droits: ["inventaire_compter"] },
  { id: "reception", libelle: "Réception", aide: "L'article est ajouté à la réception fournisseur en cours.", droits: ["reception"] },
  { id: "transfert", libelle: "Transfert", aide: "L'article est ajouté au transfert en cours.", droits: ["transfert_recevoir", "transfert_creer"] },
  { id: "recherche", libelle: "Fiche produit", aide: "La fiche de l'article s'ouvre sur la caisse.", droits: ["voir_stock", "scanner"] },
  { id: "prix", libelle: "Contrôle prix", aide: "Le prix de l'article s'affiche ici, rien n'est ajouté au panier.", droits: ["voir_stock", "scanner"] },
  { id: "stock", libelle: "Contrôle stock", aide: "Le stock de l'article s'affiche ici, rien n'est modifié.", droits: ["voir_stock"] },
];

/** Droits qui ouvrent un contexte (un seul suffit). « creation » n'est pas proposé sur le téléphone mais reste accepté par l'API. */
export function droitsDuContexte(contexte: ContexteScan): ActionPos[] {
  return CONTEXTES_SCAN.find((c) => c.id === contexte)?.droits ?? ["creer_produit"];
}

export function contexteAutorise(droits: DroitsPos, contexte: ContexteScan): boolean {
  return droitsDuContexte(contexte).some((a) => droits[a] === true);
}

/** Un appareil (ou un poste) est-il en ligne, d'après son dernier signal ? */
export function enLigne(dernierSignalAt: Date | string | null | undefined, maintenant: number = Date.now()): boolean {
  if (!dernierSignalAt) return false;
  const t = new Date(dernierSignalAt).getTime();
  return Number.isFinite(t) && maintenant - t < SEUIL_SIGNAL_MS;
}

/** Code d'appairage porté par le QR : « <id de l'appareil>.<secret> ». Rend null s'il est illisible. */
export function decouperCode(code: string | null | undefined): { id: string; secret: string } | null {
  const m = /^([a-z0-9]{8,40})\.([A-Za-z0-9_-]{16,64})$/.exec(code?.trim() ?? "");
  return m ? { id: m[1], secret: m[2] } : null;
}

/** Type et nom par défaut d'un appareil, d'après son navigateur. */
export function decrireAppareil(userAgent: string | null | undefined): { type: "telephone" | "tablette" | "pc"; nom: string } {
  const ua = userAgent ?? "";
  if (/iPad/i.test(ua)) return { type: "tablette", nom: "iPad" };
  if (/iPhone/i.test(ua)) return { type: "telephone", nom: "iPhone" };
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? { type: "telephone", nom: "Téléphone Android" } : { type: "tablette", nom: "Tablette Android" };
  if (/Mobi/i.test(ua)) return { type: "telephone", nom: "Téléphone" };
  return { type: "pc", nom: "Ordinateur" };
}

/**
 * Heure du scan retenue : celle du téléphone si elle est plausible (une file
 * hors ligne garde l'heure réelle de la lecture), sinon celle du serveur —
 * l'horloge d'un téléphone peut être fausse, on ne refuse pas un scan pour ça.
 */
export function horodatageScan(client: string | null | undefined, maintenant: number = Date.now()): Date {
  const t = client ? new Date(client).getTime() : NaN;
  return Number.isFinite(t) && t <= maintenant + 60_000 && t >= maintenant - 24 * 3600_000 ? new Date(t) : new Date(maintenant);
}

type Candidat = { id: string; codeBarres: string | null; sku: string | null };

/**
 * Le code désigne-t-il plusieurs articles ? Même ordre de priorité que
 * `resoudreCode` : les codes-barres d'abord ; les SKU ne comptent que si aucun
 * code-barres ne correspond. Une variante et SON produit ne sont pas ambigus
 * (le code de la variante l'emporte).
 */
export function codeAmbigu(code: string, variantes: (Candidat & { produitId: string })[], produits: Candidat[]): boolean {
  for (const champ of ["codeBarres", "sku"] as const) {
    const v = variantes.filter((x) => x[champ] === code);
    const p = produits.filter((x) => x[champ] === code);
    if (!v.length && !p.length) continue;
    return v.length > 1 || p.length > 1 || (v.length === 1 && p.length === 1 && v[0].produitId !== p[0].id);
  }
  return false;
}

export type EtatScan = "ok" | "inconnu" | "ambigu" | "inactif" | "epuise";

/** Ce que le scan a donné, en une phrase pour celui qui tient le téléphone. */
export function evaluerScan(article: Pick<ArticleResolu, "actif" | "stock" | "stockMagasin" | "variantes" | "varianteId"> | null, ambigu: boolean, contexte: ContexteScan): { etat: EtatScan; resultat: "trouve" | "inconnu" | "ambigu"; message: string | null } {
  if (!article) return { etat: "inconnu", resultat: "inconnu", message: "Produit non reconnu. Vous pouvez le créer ou le rechercher depuis la caisse." };
  if (ambigu) return { etat: "ambigu", resultat: "ambigu", message: "Ce code correspond à plusieurs articles. Recherchez le bon article sur la caisse." };
  if (!article.actif) return { etat: "inactif", resultat: "trouve", message: "Cet article a été retiré de la vente. Il n'a pas été ajouté." };
  const stock = article.stockMagasin ?? article.stock;
  // Un stock à zéro ne gêne ni un comptage ni une réception : on ne le signale que là où il compte.
  if (stock <= 0 && (contexte === "vente" || contexte === "prix" || contexte === "stock" || contexte === "recherche")) {
    return { etat: "epuise", resultat: "trouve", message: "Stock épuisé dans ce magasin." };
  }
  if (contexte === "vente" && article.variantes.length && !article.varianteId) {
    return { etat: "ok", resultat: "trouve", message: "Cet article a plusieurs variantes : choisissez-la sur la caisse." };
  }
  return { etat: "ok", resultat: "trouve", message: null };
}

/** Un scan de téléphone doit-il être remis aux écrans de la caisse ? Pas s'il désigne plusieurs articles ou un article retiré. */
export function scanARelayer(payload: Record<string, unknown>): boolean {
  return payload.source === "mobile" && typeof payload.code === "string" && typeof payload.scanId === "string"
    && payload.etat !== "ambigu" && payload.etat !== "inactif";
}

// ── File locale du téléphone (coupure réseau) ─────────────────────────────────

export type ScanEnAttente = { scanId: string; code: string; contexte: ContexteScan; scanneAt: string };

/** Ajoute en fin de file (ordre de lecture conservé). Rend null si la file est pleine : on ne perd jamais un scan en silence. */
export function ajouterALaFile(file: ScanEnAttente[], scan: ScanEnAttente, max: number = TAILLE_FILE_MAX): ScanEnAttente[] | null {
  if (file.some((s) => s.scanId === scan.scanId)) return file;
  return file.length >= max ? null : [...file, scan];
}

/** Événement tel qu'il arrive par le flux : `seq` est null pour ceux que le flux déduit lui-même (prêt, appareil silencieux). */
export type EvenementFlux = Omit<EvenementPosLu, "seq" | "type"> & { seq: string | null; type: EvenementPosLu["type"] | "pret" };

/** Trame SSE d'un événement. Sans `seq`, pas de ligne `id:` : le curseur du client ne bouge pas. */
export function trameSse(e: { seq: string | null } & Record<string, unknown>): string {
  return `${e.seq ? `id: ${e.seq}\n` : ""}data: ${JSON.stringify(e)}\n\n`;
}

/** Curseur reçu du client (`Last-Event-ID`, `?depuis=`) : un entier positif en chaîne, sinon null. */
export function lireCurseur(valeur: string | null | undefined): string | null {
  const v = valeur?.trim() ?? "";
  return /^\d{1,19}$/.test(v) ? v : null;
}
