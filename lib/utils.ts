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

// Générer un numéro de commande unique
export function genererNumeroCommande(): string {
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `AX-${yyyymmdd}-${rand}`;
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
