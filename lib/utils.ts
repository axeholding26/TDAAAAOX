// Utilitaires globaux Axso
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formater un montant avec la devise africaine
export function formatMontant(montant: number, devise: string = "XAF"): string {
  const localeMap: Record<string, string> = {
    XAF: "fr-CM",
    XOF: "fr-SN",
    GHS: "en-GH",
    NGN: "en-NG",
    KES: "en-KE",
    MAD: "fr-MA",
    EUR: "fr-FR",
    USD: "en-US",
  };
  const locale = localeMap[devise] || "fr-FR";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: devise,
    maximumFractionDigits: 0,
  }).format(montant);
}

// Suffixe aléatoire lisible : ni 0/O ni 1/I/L, pour être dicté ou recopié sans erreur.
const ALPHABET_NUMERO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function suffixeAleatoire(longueur: number): string {
  const octets = new Uint8Array(longueur);
  globalThis.crypto.getRandomValues(octets);
  return Array.from(octets, (o) => ALPHABET_NUMERO[o % ALPHABET_NUMERO.length]).join("");
}

// Générer un numéro de commande unique : AX-20261011-K7M2QD.
// Commande.numero est unique sur TOUTE la plateforme : 6 caractères tirés parmi
// 31 donnent ~887 millions de numéros par jour (l'ancien tirage n'en avait que
// 9 000, et se heurtait dès quelques centaines de commandes par jour). Une
// collision reste possible en théorie : la caisse rejoue alors la vente avec un
// nouveau numéro (avecRepriseCollision, lib/pos/idempotence.ts).
export function genererNumeroCommande(): string {
  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `AX-${yyyymmdd}-${suffixeAleatoire(6)}`;
}

// Numéro de facture : FAC-2026-0042-7KQ2M. `sequence` = rang de la facture dans
// la boutique (nombre de factures + 1), lisible par le marchand. Facture.numero
// étant unique sur toute la plateforme, le suffixe distingue les boutiques : sans
// lui, la facture n°1 de la deuxième boutique échouait (« Unique constraint
// failed on numero ») et la vente restait sans facture.
export function genererNumeroFacture(sequence: number): string {
  return `FAC-${new Date().getFullYear()}-${String(sequence).padStart(4, "0")}-${suffixeAleatoire(5)}`;
}

// Slugifier un texte français
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Tronquer un texte
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

// Calculer le pourcentage de remise
export function pourcentageRemise(prix: number, prixCompare: number): number {
  if (!prixCompare || prixCompare <= prix) return 0;
  return Math.round(((prixCompare - prix) / prixCompare) * 100);
}

// Formater une date en français
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

// Formater une date relative (il y a X jours)
export function dateRelative(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffJ = Math.floor(diffH / 24);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffJ < 7) return `Il y a ${diffJ}j`;
  return formatDate(date);
}

// Initiales d'un nom
export function initiales(nom: string): string {
  return nom
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Lien YouTube/Vimeo → adresse du lecteur intégrable (un lien « watch » ou
// « vimeo.com/123 » refuse de s'afficher dans une iframe) ; null pour un
// fichier vidéo (mp4…) à lire avec <video>.
export function urlVideoIntegree(url: string, autoplay = false): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}${autoplay ? "?autoplay=1&mute=1" : ""}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}${autoplay ? "?autoplay=1&muted=1" : ""}`;
  return null;
}

// Lien d'un bloc (bouton, image, bandeau CTA) → adresse réelle. Comme
// Shopify, le bloc garde une destination de la boutique (« a-propos »,
// « collections/ete », « / » pour l'accueil) qui suit le slug ; une URL
// complète, un chemin absolu, une ancre, mailto: ou tel: restent tels quels.
export function hrefBoutique(slug: string, lien?: string | null): string | undefined {
  const l = lien?.trim();
  if (!l) return undefined;
  if (l === "/") return `/${slug}`;
  if (/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(l)) return l;
  return `/${slug}/${l}`;
}

// ── Adresse des boutiques : sous-domaine (modèle Shopify) — nom.axsoafrica.com ──
// Actif dès que NEXT_PUBLIC_AXSO_DOMAIN est un vrai domaine (DNS générique *.domaine) ;
// sur *.vercel.app aucun sous-domaine générique n'existe : on reste en domaine/nom.
const DOMAINE_AXSO = process.env.NEXT_PUBLIC_AXSO_DOMAIN || "";
export const SOUS_DOMAINES_ACTIFS = !!DOMAINE_AXSO && !DOMAINE_AXSO.endsWith(".vercel.app");

/** "https://nom.axsoafrica.com" ; null quand les sous-domaines ne sont pas actifs. */
export function adresseBoutique(slug: string): string | null {
  if (!SOUS_DOMAINES_ACTIFS) return null;
  return `${DOMAINE_AXSO.startsWith("localhost") ? "http" : "https"}://${slug}.${DOMAINE_AXSO}`;
}

// Noms qu'une boutique ne peut pas prendre : sous-domaines techniques et premières
// pages du site (une boutique « blog » serait masquée par /blog).
export const SLUGS_RESERVES = new Set([
  "www", "app", "api", "admin", "dashboard", "mail", "smtp", "ftp", "cdn", "static", "assets", "status", "support", "help", "aide",
  "docs", "blog", "shop", "store", "boutique", "axso", "axsoafrica", "login", "register", "auth", "connexion", "inscription",
  "about", "affiliation", "affilie", "community", "contact", "fonctionnalites", "jobs", "legal", "mon-espace-affilie", "press",
  "rejoindre", "suivi", "temoignages", "themes", "tutorials", "livreur", "test", "dev", "staging", "preview",
  "oauth", // écran d'autorisation des IA externes (app/oauth)
  "scanner", // interface du téléphone-scanner de la caisse (app/scanner)
]);

/** Un slug doit être une étiquette DNS valide (3 à 63 caractères) et ne pas être réservé. */
export function slugBoutiqueValide(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug) && !SLUGS_RESERVES.has(slug);
}
