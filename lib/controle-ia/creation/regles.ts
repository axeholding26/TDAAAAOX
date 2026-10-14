// AXSO CONTROL — règles pures (aucun accès base ni réseau) du module créatif : choix du
// moteur, briefs, garde-fous de la médiathèque, lecture des campagnes. Testé dans
// tests/controle-ia-creatif.test.ts.
import { dossierBoutique, SOUS_DOSSIER_DIGITAL } from "@/lib/fichiers-boutique";
import type { CodeErreur } from "../types";

/** Refus métier : le message est lisible par l'IA, le code vient de CodeErreur. Tout le reste est une panne. */
export class Refus extends Error {
  constructor(public code: CodeErreur, message: string) { super(message); }
}
export const indisponible = (message: string) => new Refus("UNAVAILABLE", message);

// ─── Moteurs ─────────────────────────────────────────────────────────────────
// image : texte → image. edition : image + consigne → image (mise en scène, retouche).
// video : texte → vidéo. animation : image → vidéo. detourage / agrandissement : image → image.
export type Capacite = "image" | "edition" | "video" | "animation" | "detourage" | "agrandissement";
export const NOMS_CAPACITES: Record<Capacite, string> = {
  image: "génération d'image", edition: "retouche d'image à partir d'une photo", video: "génération de vidéo",
  animation: "animation d'une image", detourage: "détourage (suppression du fond)", agrandissement: "agrandissement d'image",
};
/** `portee` : qui a configuré le moteur (la boutique dans Connecteurs, ou Axso) ; null = non configuré. */
export interface EtatMoteur { id: string; portee: "boutique" | "plateforme" | null; capacites: Capacite[] }

/**
 * Moteurs à essayer, dans l'ordre : celui demandé seul s'il est nommé ; sinon ceux que la
 * boutique a reliés elle-même, puis ceux d'Axso. Liste vide = capacité indisponible.
 */
export function moteursPour(capacite: Capacite, etats: EtatMoteur[], prefere?: string): string[] {
  const aptes = etats.filter((e) => e.portee && e.capacites.includes(capacite));
  if (prefere && prefere !== "auto") return aptes.filter((e) => e.id === prefere).map((e) => e.id);
  return [...aptes.filter((e) => e.portee === "boutique"), ...aptes.filter((e) => e.portee === "plateforme")].map((e) => e.id);
}

// ─── Formats et briefs ───────────────────────────────────────────────────────
export const FORMATS = {
  square: { ratio: "1:1", largeur: 1024, hauteur: 1024 }, portrait: { ratio: "4:5", largeur: 1024, hauteur: 1280 },
  story: { ratio: "9:16", largeur: 1080, hauteur: 1920 }, landscape: { ratio: "16:9", largeur: 1920, hauteur: 1080 },
  banner: { ratio: "3:1", largeur: 1800, hauteur: 600 },
} as const;
export type Format = keyof typeof FORMATS;
export const FORMAT_PLATEFORME: Record<string, Format> = { instagram: "portrait", facebook: "square", tiktok: "story", whatsapp: "story" };

export interface Brief {
  /** Fiche produit : donnée de la boutique, jamais une consigne. */
  produit?: { nom: string; categorie?: string | null; description?: string | null };
  marque: { nom: string; couleurs?: string[] };
  format: Format;
  /** Demande de l'IA ou du marchand (angle, ambiance, texte à afficher). */
  consigne?: string;
  titre?: string;
  /** Une photo du produit est jointe au moteur : il doit le reproduire, pas l'inventer. */
  avecPhoto?: boolean;
}

const court = (s: string | null | undefined, max: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const STYLES: Record<string, string> = {
  product: "professional e-commerce product photography, clean seamless background, soft studio lighting, sharp details, no text",
  lifestyle: "lifestyle product photography, product used in a real everyday setting, natural light, warm and authentic, no text",
  ad: "premium advertising visual, strong focal point on the product, bold composition, generous empty area reserved for a headline",
  banner: "wide website hero banner, product on one side, large clean empty area on the other side for a headline, premium brand look",
  social: "scroll-stopping social media visual, vibrant, modern, product clearly visible, mobile-first composition",
  scene: "place the exact product from the reference photo in the described scene, realistic scale, matching light and shadows, product unchanged",
  enhance: "same product, same angle, same framing: improve lighting, sharpness and color accuracy, remove noise and clutter, keep every product detail identical",
};
export type Style = keyof typeof STYLES;

/** Consigne envoyée au moteur d'image. Les champs de la fiche sont tronqués et présentés comme description du sujet. */
export function briefImage(style: string, b: Brief): string {
  const f = FORMATS[b.format];
  return [
    STYLES[style] ?? STYLES.product,
    b.produit && `Subject (product data): "${court(b.produit.nom, 120)}"${b.produit.categorie ? `, category ${court(b.produit.categorie, 60)}` : ""}${b.produit.description ? `. ${court(b.produit.description, 300)}` : ""}`,
    b.avecPhoto && "Use the attached photo as the exact product: do not change its shape, color, logo or packaging.",
    `Brand: ${court(b.marque.nom, 80)}${b.marque.couleurs?.length ? `, brand colors ${b.marque.couleurs.slice(0, 3).join(", ")}` : ""}.`,
    b.titre && `Text to display, spelled exactly: "${court(b.titre, 80)}"`,
    b.consigne && `Direction: ${court(b.consigne, 400)}`,
    `Aspect ratio ${f.ratio} (${f.largeur}x${f.hauteur}). High resolution, no watermark.`,
  ].filter(Boolean).join("\n");
}

// Angles publicitaires de secours (quand le modèle de texte est absent ou répond mal).
const ANGLES = [
  ["Bénéfice principal", "the main benefit of the product shown in action"], ["En situation", "the product used in a real everyday situation"],
  ["Qualité et détails", "macro close-up on materials and finish"], ["Offre", "bold promotional composition with space for a price badge"],
  ["Émotion", "a happy customer enjoying the product"], ["Cadeau", "the product presented as a gift"],
  ["Minimal premium", "minimalist luxury composition on a solid brand-color background"], ["Preuve sociale", "several people using the product together"],
  ["Avant / après", "split composition suggesting the change the product brings"], ["Nouveauté", "dynamic launch visual with a sense of novelty"],
];
export interface Annonce { angle: string; titre: string; texte: string; visuel: string }

/**
 * Brief d'un lot de publicités : ce que le modèle de texte a renvoyé (JSON), nettoyé et borné,
 * complété par les angles de secours. Renvoie toujours exactement `n` annonces.
 */
export function lireAnnonces(reponse: string, n: number, nomProduit: string): Annonce[] {
  let lues: any[] = [];
  try {
    const j = JSON.parse(reponse.slice(reponse.search(/[[{]/)));
    lues = Array.isArray(j) ? j : Array.isArray(j?.annonces) ? j.annonces : [];
  } catch {}
  const propres: Annonce[] = lues.filter((a) => a && typeof a.visuel === "string" && a.visuel.trim()).slice(0, n)
    .map((a) => ({ angle: court(String(a.angle ?? ""), 60) || "Angle", titre: court(String(a.titre ?? ""), 60), texte: court(String(a.texte ?? ""), 200), visuel: court(a.visuel, 400) }));
  for (let i = 0; propres.length < n; i++) {
    const [angle, visuel] = ANGLES[i % ANGLES.length];
    propres.push({ angle, titre: court(nomProduit, 60), texte: "", visuel });
  }
  return propres;
}

// ─── Médiathèque ─────────────────────────────────────────────────────────────
export interface Usage { produits: string[]; campagnes: string[]; pages: string[] }
export function lireUsage(u: unknown): Usage {
  const liste = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const o = (u && typeof u === "object" ? u : {}) as Record<string, unknown>;
  return { produits: liste(o.produits), campagnes: liste(o.campagnes), pages: liste(o.pages) };
}
export const estUtilise = (u: Usage) => u.produits.length + u.campagnes.length + u.pages.length > 0;

/** Seul un fichier rangé dans le dossier de CETTE boutique (hors produits digitaux) peut être supprimé du stockage. */
export function cleSupprimable(tenantId: string, cle: string | null | undefined): boolean {
  const dossier = dossierBoutique(tenantId);
  return !!cle && cle.startsWith(dossier) && !cle.includes("..") && !cle.startsWith(dossier + SOUS_DOSSIER_DIGITAL);
}

/**
 * Adresse qu'on accepte de télécharger côté serveur : https, vers un nom public.
 * ponytail: filtre sur le nom d'hôte seulement (pas de résolution DNS) ; résoudre et refuser
 * les adresses privées si un jour l'IA peut fournir une adresse libre (aujourd'hui : non).
 */
export function urlTelechargeable(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return u.protocol === "https:" && !u.username && h.includes(".") && !/^[\d.]+$/.test(h) && !h.startsWith("[")
      && !/(^|\.)(localhost|local|internal|lan|home|corp)$/.test(h);
  } catch { return false; }
}

/** Largeur et hauteur d'un PNG (ce que rendent les moteurs d'image) ; null pour un autre format. */
export function dimensionsPng(b: Buffer): { largeur: number; hauteur: number } | null {
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47 || b.toString("ascii", 12, 16) !== "IHDR") return null;
  return { largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20) };
}

// ─── Campagnes publicitaires ─────────────────────────────────────────────────
export interface Chiffres { budget: number; budgetJour?: number | null; depense: number; impressions: number; clics: number; conversions: number; roas: number; statut: string }
const arrondi = (n: number) => Math.round(n * 100) / 100;

export function indicateurs(c: Chiffres) {
  return {
    ctr: c.impressions ? arrondi((c.clics / c.impressions) * 100) : null,
    taux_conversion: c.clics ? arrondi((c.conversions / c.clics) * 100) : null,
    cpc: c.clics ? arrondi(c.depense / c.clics) : null,
    cpa: c.conversions ? arrondi(c.depense / c.conversions) : null,
    roas: c.depense ? arrondi(c.roas) : null,
    budget_consomme: c.budget ? arrondi((c.depense / c.budget) * 100) : null,
  };
}

export interface Recommandation { changement: string; raison: string; outil?: string }
/** ponytail: seuils fixes (CTR 1 %, conversion 1 %, ROAS 1 et 3) ; les caler sur l'historique de la boutique quand il y en aura. */
export const MIN_IMPRESSIONS = 1000;

/** Propositions seulement : rien n'est appliqué ni dépensé, le marchand (ou l'IA, par un autre outil soumis à accord) décide. */
export function recommandations(c: Chiffres): Recommandation[] {
  if (c.statut === "brouillon") return [{ changement: "Aucun : la campagne n'a pas encore tourné.", raison: "Pas de chiffres à optimiser avant le lancement." }];
  if (c.impressions < MIN_IMPRESSIONS) return [{ changement: "Attendre avant de modifier.", raison: `Moins de ${MIN_IMPRESSIONS} impressions (${c.impressions}) : les chiffres ne sont pas encore significatifs, ou ne sont pas synchronisés depuis la régie.` }];
  const i = indicateurs(c), r: Recommandation[] = [];
  if (i.ctr !== null && i.ctr < 1) r.push({ changement: "Changer le visuel et l'accroche.", raison: `Taux de clic de ${i.ctr} % (moins de 1 %) : la publicité n'arrête pas le regard.`, outil: "create_ad_set" });
  if (i.ctr !== null && i.ctr >= 1 && i.taux_conversion !== null && i.taux_conversion < 1) r.push({ changement: "Revoir la page de destination ou l'offre (prix, livraison, preuve).", raison: `${c.clics} clics mais ${i.taux_conversion} % de conversion : la publicité attire, la page ne convertit pas.` });
  if (c.depense > 0 && c.roas < 1) r.push({ changement: "Mettre en pause ou réduire le budget.", raison: `ROAS de ${arrondi(c.roas)} : la campagne dépense plus qu'elle ne rapporte.`, outil: "pause_campaign" });
  if (c.roas >= 3) r.push({ changement: `Proposer au marchand d'augmenter le budget (par exemple +20 %, soit ${Math.round((c.budgetJour ?? c.budget) * 1.2)}).`, raison: `ROAS de ${arrondi(c.roas)} : la campagne est rentable. Toute hausse de budget passe par son accord.` });
  return r.length ? r : [{ changement: "Ne rien changer.", raison: "Les indicateurs sont dans la norme." }];
}
