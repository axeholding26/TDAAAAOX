// AXSO BUILDER — intelligence des images (pur : ni base, ni réseau, ni dépendance).
// Lecture du format et des dimensions depuis les premiers octets (PNG, JPEG, WebP, GIF,
// AVIF), diagnostic d'optimisation, texte alternatif proposé, et inventaire / remplacement
// des images utilisées par une configuration de boutique. Testé dans tests/builder-navigation.test.ts.

export interface EnteteImage { format: "png" | "jpeg" | "webp" | "gif" | "avif" | "svg"; largeur: number | null; hauteur: number | null }

const ascii = (b: Buffer, debut: number, fin: number) => (b.length >= fin ? b.toString("latin1", debut, fin) : "");

/** Format et dimensions lus dans l'en-tête du fichier ; null si ce n'est pas une image reconnue. */
export function lireEntete(b: Buffer): EnteteImage | null {
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47 && ascii(b, 12, 16) === "IHDR") return { format: "png", largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20) };
  if (/^GIF8[79]a$/.test(ascii(b, 0, 6)) && b.length >= 10) return { format: "gif", largeur: b.readUInt16LE(6), hauteur: b.readUInt16LE(8) };
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) return jpeg(b);
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return webp(b);
  if (ascii(b, 4, 8) === "ftyp" && /avi[fs]/.test(ascii(b, 8, Math.min(b.length, 64)))) {
    // ponytail: dimensions du premier « ispe » (image principale dans les fichiers courants) ; lire « pitm » si une grille fausse le résultat.
    const i = b.indexOf("ispe", 0, "latin1");
    return { format: "avif", largeur: i > 0 && b.length >= i + 16 ? b.readUInt32BE(i + 8) : null, hauteur: i > 0 && b.length >= i + 16 ? b.readUInt32BE(i + 12) : null };
  }
  if (/^\s*(<\?xml[^>]*>\s*)?<svg\b/i.test(ascii(b, 0, Math.min(b.length, 512)))) return { format: "svg", largeur: null, hauteur: null };
  return null;
}

// Marqueurs SOF (début d'image) : les dimensions suivent. C4, C8 et CC n'en sont pas.
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
function jpeg(b: Buffer): EnteteImage {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (SOF.has(m)) return { format: "jpeg", hauteur: b.readUInt16BE(i + 5), largeur: b.readUInt16BE(i + 7) };
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return { format: "jpeg", largeur: null, hauteur: null };
}

function webp(b: Buffer): EnteteImage {
  const bloc = ascii(b, 12, 16);
  if (bloc === "VP8 " && b.length >= 30) return { format: "webp", largeur: b.readUInt16LE(26) & 0x3fff, hauteur: b.readUInt16LE(28) & 0x3fff };
  if (bloc === "VP8L" && b.length >= 25) { const v = b.readUInt32LE(21); return { format: "webp", largeur: (v & 0x3fff) + 1, hauteur: ((v >> 14) & 0x3fff) + 1 }; }
  if (bloc === "VP8X" && b.length >= 30) return { format: "webp", largeur: 1 + b.readUIntLE(24, 3), hauteur: 1 + b.readUIntLE(27, 3) };
  return { format: "webp", largeur: null, hauteur: null };
}

/** Ratio lisible (« 16:9 », « 1:1 », sinon « 1.85 »). */
export function ratio(largeur?: number | null, hauteur?: number | null): string | null {
  if (!largeur || !hauteur) return null;
  const pgcd = (a: number, b: number): number => (b ? pgcd(b, a % b) : a);
  const d = pgcd(largeur, hauteur);
  return largeur / d <= 32 && hauteur / d <= 32 ? `${largeur / d}:${hauteur / d}` : (largeur / hauteur).toFixed(2);
}

// ponytail: seuils fixes pour une vitrine (500 Ko, 2560 px) ; les ajuster par usage (logo, bannière) si besoin.
const LOURD = 500 * 1024, TRES_LOURD = 1.5 * 1024 * 1024, LARGEUR_MAX = 2560;

/** Problèmes d'une image pour une vitrine (poids, dimensions, format) et conseil associé. */
export function diagnostic(m: { format?: string | null; octets?: number | null; largeur?: number | null; hauteur?: number | null }): { problemes: string[]; conseils: string[] } {
  const problemes: string[] = [], conseils: string[] = [];
  const ko = m.octets ? Math.round(m.octets / 1024) : null;
  if (m.octets && m.octets > TRES_LOURD) problemes.push(`très lourde (${ko} Ko) : ralentit nettement la page sur mobile`);
  else if (m.octets && m.octets > LOURD) problemes.push(`lourde (${ko} Ko, viser moins de 500 Ko)`);
  if (m.largeur && m.largeur > LARGEUR_MAX) { problemes.push(`trop grande (${m.largeur}×${m.hauteur} px) : aucun écran n'affiche plus de ${LARGEUR_MAX} px de large`); conseils.push(`réduire à ${LARGEUR_MAX} px de large au plus`); }
  if (m.format === "png" && m.octets && m.octets > 300 * 1024) conseils.push("PNG lourd : s'il s'agit d'une photo, le WebP ou l'AVIF la rendrait 3 à 5 fois plus légère");
  if (m.format === "gif" && m.octets && m.octets > 1024 * 1024) conseils.push("GIF animé lourd : une courte vidéo MP4 serait bien plus légère");
  if (m.format === "jpeg" && m.octets && m.octets > LOURD) conseils.push("ré-encoder en WebP (qualité 80) ou réduire la qualité JPEG");
  if (!m.format) problemes.push("format non reconnu (ni PNG, JPEG, WebP, GIF, AVIF ni SVG)");
  return { problemes, conseils };
}

/** Texte alternatif proposé : le nom (produit, section) est une donnée non fiable — nettoyée, bornée, échappée. */
export function altPropose(nom: string, contexte?: string): string {
  const propre = (t: string) => t.replace(/<[^>]*>/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  const texte = [propre(nom ?? ""), contexte ? propre(contexte) : ""].filter(Boolean).join(" — ").slice(0, 125);
  return texte.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Images utilisées par une configuration ──────────────────────────────────
// Les designs importés d'origine (builderHtml…) ne se modifient pas par une IA (lib/builder/validation.ts) :
// ils sont inventoriés, jamais réécrits.
export const CHAMPS_DESIGN_FIGES = new Set(["builderHtml", "builderCss", "builderHtmlProduits", "builderHtmlProduit", "builderHtmlPanierChrome", "builderHtmlCheckoutChrome", "builderHtmlConfirmationChrome"]);
const CLE_IMAGE = /image|img|logo|url|src|photo|banner|banniere|poster|icon|fond|background|slideshow|logos|images/i;
const EXT_MEDIA = /\.(png|jpe?g|webp|gif|avif|svg|mp4|webm|mov)(\?|#|$)/i;
const RE_ATTR = /\b(?:src|poster|data-src)\s*=\s*["']([^"']+)["']/gi;
const RE_CSS = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi;
const estAdresse = (u: string) => /^(https?:\/\/|\/[^/])/.test(u);

export interface UsageImage { url: string; ou: string }

/** Toutes les images (et vidéos) référencées par la configuration, avec l'endroit où elles servent. */
export function imagesUtilisees(cfg: Record<string, any>): UsageImage[] {
  const out: UsageImage[] = [];
  const vu = new Set<string>();
  const noter = (url: string, ou: string) => { const k = `${url}|${ou}`; if (!vu.has(k)) { vu.add(k); out.push({ url, ou }); } };
  const marcher = (v: any, ou: string, cle: string) => {
    if (typeof v === "string") {
      if (v.includes("<") || v.includes("url(")) {
        for (const re of [RE_ATTR, RE_CSS]) for (const m of v.matchAll(re)) if (estAdresse(m[1].trim())) noter(m[1].trim(), ou);
      } else if (estAdresse(v.trim()) && (CLE_IMAGE.test(cle) || EXT_MEDIA.test(v))) noter(v.trim(), ou);
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => marcher(x, x && typeof x === "object" && typeof x.id === "string" ? `${ou} › ${x.config?.nom ? `« ${x.config.nom} » ` : ""}${x.id}` : `${ou}[${i}]`, cle)); return; }
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) marcher(x, ou ? `${ou}.${k}` : k, k);
  };
  marcher(cfg, "", "");
  return out;
}

/** Remplace une image partout dans la configuration (hors design d'origine figé) ; `n` = nombre de remplacements. */
export function remplacerImage<T extends Record<string, any>>(cfg: T, ancienne: string, nouvelle: string): { cfg: T; n: number; figes: number } {
  let n = 0, figes = 0;
  const variantes: [string, string][] = [[ancienne, nouvelle]];
  if (ancienne.includes("&")) variantes.push([ancienne.replace(/&/g, "&amp;"), nouvelle.replace(/&/g, "&amp;")]);
  const changer = (s: string) => {
    if (s === ancienne) { n++; return nouvelle; }
    let r = s;
    for (const [a, b] of variantes) if (r.includes(a)) { n += r.split(a).length - 1; r = r.split(a).join(b); }
    return r;
  };
  const marcher = (v: any): any => {
    if (typeof v === "string") return changer(v);
    if (Array.isArray(v)) return v.map(marcher);
    if (v && typeof v === "object") {
      const o: Record<string, any> = {};
      for (const [k, x] of Object.entries(v)) {
        if (CHAMPS_DESIGN_FIGES.has(k)) { o[k] = x; if (typeof x === "string") figes += x.split(ancienne).length - 1; }
        else o[k] = marcher(x);
      }
      return o;
    }
    return v;
  };
  return { cfg: marcher(cfg), n, figes };
}

/** Adresse d'image acceptable dans la vitrine : https (ou chemin du site), sans caractère qui sortirait d'un attribut ou d'un url(). */
export const adresseImageSure = (u: unknown): u is string =>
  typeof u === "string" && u.length <= 2000 && /^(https:\/\/[^\s"'<>()\\`]+|\/[^\s"'<>()\\`/][^\s"'<>()\\`]*)$/.test(u);
