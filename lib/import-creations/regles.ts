// IMPORT IA → BOUTIQUE — règles pures (aucun accès base ni réseau) : reconnaissance des
// fichiers par leur signature, adresses réseau interdites, statuts, complétude d'un produit,
// temporisation des reprises. Testé dans tests/import-creations.test.ts.
import { isIP } from "net";

// ─── Fichiers acceptés ───────────────────────────────────────────────────────
// Le type vient des OCTETS (signature) ; l'extension doit être cohérente. Pas de HTML ni de SVG
// (du script servi depuis le stockage), pas d'exécutable, même renommé.
export type Genre = "image" | "document" | "archive" | "audio" | "video" | "texte";
export const TYPES: Record<string, { mime: string; genre: Genre }> = {
  pdf: { mime: "application/pdf", genre: "document" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", genre: "document" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", genre: "document" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", genre: "document" },
  epub: { mime: "application/epub+zip", genre: "document" },
  zip: { mime: "application/zip", genre: "archive" },
  png: { mime: "image/png", genre: "image" },
  jpg: { mime: "image/jpeg", genre: "image" },
  webp: { mime: "image/webp", genre: "image" },
  gif: { mime: "image/gif", genre: "image" },
  mp3: { mime: "audio/mpeg", genre: "audio" },
  wav: { mime: "audio/wav", genre: "audio" },
  ogg: { mime: "audio/ogg", genre: "audio" },
  mp4: { mime: "video/mp4", genre: "video" },
  csv: { mime: "text/csv", genre: "texte" },
  txt: { mime: "text/plain", genre: "texte" },
  md: { mime: "text/markdown", genre: "texte" },
};
const ALIAS: Record<string, string> = { jpeg: "jpg", m4a: "mp4", mov: "mp4" };
const ZIP_OFFICE = new Set(["docx", "xlsx", "pptx", "epub", "zip"]);

export const extension = (nom: string) => {
  const e = (/\.([a-z0-9]{1,5})$/i.exec(nom.trim())?.[1] ?? "").toLowerCase();
  return ALIAS[e] ?? e;
};

const debut = (b: Buffer, ...octets: number[]) => octets.every((o, i) => b[i] === o);
const ascii = (b: Buffer, de: number, a: number) => b.toString("latin1", de, a);

/** Exécutables et scripts reconnus à leur signature : refusés quel que soit leur nom. */
export function estExecutable(b: Buffer): boolean {
  return debut(b, 0x4d, 0x5a) // MZ : .exe, .dll (Windows)
    || debut(b, 0x7f, 0x45, 0x4c, 0x46) // ELF (Linux)
    || [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe].includes(b.length >= 4 ? b.readUInt32BE(0) : 0) // Mach-O, classes Java
    || debut(b, 0x23, 0x21) // #! script
    || /^\s*<(\?xml[^>]*>\s*<svg|svg|!doctype html|html|script)/i.test(ascii(b, 0, 200));
}

/** Type réel (clé de TYPES) déduit des octets, ou null. */
export function signature(b: Buffer): string | null {
  if (b.length < 4) return b.length && texteSur(b) ? "txt" : null;
  if (debut(b, 0x25, 0x50, 0x44, 0x46, 0x2d)) return "pdf";
  if (debut(b, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (debut(b, 0xff, 0xd8, 0xff)) return "jpg";
  if (ascii(b, 0, 4) === "GIF8") return "gif";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WAVE") return "wav";
  if (ascii(b, 0, 4) === "OggS") return "ogg";
  if (ascii(b, 4, 8) === "ftyp") return "mp4";
  if (ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "mp3";
  if (debut(b, 0x50, 0x4b, 0x03, 0x04) || debut(b, 0x50, 0x4b, 0x05, 0x06)) return "zip";
  return texteSur(b) ? "txt" : null;
}

/** Texte brut : UTF-8 valide, sans octet nul. */
function texteSur(b: Buffer): boolean {
  const extrait = b.subarray(0, 64 * 1024);
  if (extrait.includes(0)) return false;
  try { new TextDecoder("utf-8", { fatal: true }).decode(extrait.subarray(0, Math.max(0, extrait.length - 4))); return true; } catch { return false; }
}

export const HTML_REFUSE = "Page web (HTML) refusée : compresse-la dans une archive .zip (avec ses images et scripts) ; l'acheteur extrait l'archive puis ouvre le fichier .html dans son navigateur.";

export type Verdict ={ ok: true; type: string; mime: string; genre: Genre } | { ok: false; raison: string };

/**
 * Verdict sur un fichier : signature reconnue, extension cohérente, rôle respecté
 * (un visuel est une image). docx/xlsx/pptx/epub sont des ZIP : l'extension les distingue.
 * ponytail: le contenu d'un ZIP n'est pas inspecté (un .exe dedans passe) ; lister ses
 * entrées si des acheteurs signalent des archives piégées.
 */
export function verifierFichier(b: Buffer, nom: string, role: "fichier" | "visuel"): Verdict {
  if (!b.length) return { ok: false, raison: "Fichier vide." };
  const ext = extension(nom);
  // Une page web servie depuis le stockage exécuterait son script : elle se vend dans un .zip.
  if (["html", "htm", "xhtml"].includes(ext) || /^\s*<(!doctype html|html)/i.test(ascii(b, 0, 200))) return { ok: false, raison: HTML_REFUSE };
  if (estExecutable(b) || /^(svg|js|mjs|exe|msi|bat|cmd|sh|ps1|apk|jar|dll|scr|vbs|php)$/.test(ext)) return { ok: false, raison: "Fichier exécutable, script ou image SVG refusé." };
  const reel = signature(b);
  if (!reel) return { ok: false, raison: "Type de fichier non reconnu ou non accepté." };
  let type = reel;
  if (reel === "zip") type = ZIP_OFFICE.has(ext) ? ext : "zip";
  else if (reel === "txt") type = ["csv", "md", "txt"].includes(ext) ? ext : "txt";
  if (ext && ext !== type) return { ok: false, raison: `Le contenu (${type}) ne correspond pas à l'extension .${ext}.` };
  const t = TYPES[type];
  if (role === "visuel" && t.genre !== "image") return { ok: false, raison: "Un visuel doit être une image (PNG, JPEG, WebP, GIF)." };
  return { ok: true, type, ...t };
}

// ─── Réseau ──────────────────────────────────────────────────────────────────
/** Adresse IP qu'on ne contacte jamais : boucle locale, réseaux privés, lien local (métadonnées cloud), CGNAT, multidiffusion… */
export function ipInterdite(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  if (v === 6) {
    const x = ip.toLowerCase().replace(/^\[|\]$/g, "");
    const mappe = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
    if (mappe) return ipInterdite(mappe[1]);
    return x === "::" || x === "::1" || /^(fc|fd|fe[89ab]|ff)/.test(x) || x.startsWith("64:ff9b:") || x.startsWith("::ffff:");
  }
  return true;
}

/** Adresse fournie par une IA, avant toute résolution : https, sans identifiants, port standard, nom d'hôte ou IP publique. */
export function urlAcceptee(brut: string): URL | null {
  let u: URL;
  try { u = new URL(brut); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return null;
  const h = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(h)) return ipInterdite(h) ? null : u;
  if (!h.includes(".") || /(^|\.)(localhost|local|internal|lan|home|corp|intranet)$/.test(h)) return null;
  return u;
}

// ─── Statuts ─────────────────────────────────────────────────────────────────
export const ETAPES = ["received", "validated", "stored", "product_created", "assets_attached", "ready_for_review", "published"] as const;
export type Statut = (typeof ETAPES)[number] | "failed" | "retrying";
export const LIBELLES: Record<Statut, string> = {
  received: "Reçu", validated: "Vérifié", stored: "Fichiers stockés", product_created: "Produit créé", assets_attached: "Visuels associés",
  ready_for_review: "Prêt à publier", published: "Publié", failed: "Échec", retrying: "Nouvelle tentative prévue",
};

export const TENTATIVES_MAX = 5;
/** Délai avant la tentative n° `n` (1, 2…) : 1 min, 5 min, 25 min, 2 h, 10 h. */
export const delaiReprise = (n: number) => 60_000 * 5 ** Math.max(0, n - 1);

/** Erreur passagère (réseau, 5xx, délai) : on retente. Le reste (404, fichier refusé) attend une correction. */
export class ErreurImport extends Error {
  constructor(message: string, public passagere = false) { super(message); }
}

// ─── Complétude ──────────────────────────────────────────────────────────────
export interface EtatProduit { prix: number; images: string[]; fichiersStockes: number; nom?: string | null }
/** Ce qui manque pour publier ; vide = publiable. Jamais de produit en ligne sans fichier, prix ou visuel. */
export function manquePourPublier(p: EtatProduit): string[] {
  return [
    !p.nom?.trim() && "un nom",
    !(p.prix > 0) && "un prix supérieur à 0",
    !p.images.length && "au moins un visuel",
    !p.fichiersStockes && "au moins un fichier téléchargeable stocké",
  ].filter((x): x is string => !!x);
}

/** Description publiée : texte du créateur, puis la liste des bénéfices. */
export function descriptionAvecBenefices(description: string | undefined, benefices: string[] | undefined): string | null {
  const liste = (benefices ?? []).map((b) => b.trim()).filter(Boolean);
  const texte = [description?.trim(), liste.length ? `Ce que vous obtenez :\n${liste.map((b) => `• ${b}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
  return texte || null;
}

/** Nom de fichier propre pour le stockage et l'acheteur (pas de chemin, pas de caractère de contrôle). */
export const nomPropre = (nom: string) => nom.replace(/[\\/\x00-\x1f"<>|:*?]+/g, "-").replace(/^\.+/, "").trim().slice(0, 120) || "fichier";
