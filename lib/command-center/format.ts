// Formatage des valeurs (module pur, client + serveur). Locale française, montants en FCFA.
import type { Format } from "./moteur";

const nf = (max = 0) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: max });

export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${nf(1).format(n / 1e9)} Md`;
  if (a >= 1e6) return `${nf(1).format(n / 1e6)} M`;
  if (a >= 1e4) return `${nf(1).format(n / 1e3)} k`;
  return nf(a < 10 && a % 1 ? 1 : 0).format(n);
}

export function formatValeur(v: number | null | undefined, f: Format, complet = false): string {
  if (v == null || !Number.isFinite(v)) return "—";
  switch (f) {
    case "xaf": return `${complet ? nf().format(Math.round(v)) : compact(v)} FCFA`;
    case "pct": return `${nf(1).format(v * 100)} %`;
    case "heures": return v >= 48 ? `${nf(1).format(v / 24)} j` : `${nf(0).format(v)} h`;
    case "ratio": return `${nf(2).format(v)}×`;
    default: return complet ? nf().format(Math.round(v)) : compact(v);
  }
}

/** Variation : relative (« +12,8 % ») ou en points pour un pourcentage (« +1,2 pt »). */
export function formatVariation(d: number | null | undefined, f: Format): string {
  if (d == null || !Number.isFinite(d)) return "—";
  // Pas de « −0 % » : le signe suit la valeur arrondie affichée.
  const signe = Math.round(Math.abs(d) * 1000) === 0 ? "" : d > 0 ? "+" : "−";
  if (f === "pct") return `${signe}${nf(1).format(Math.abs(d) * 100)} pt`;
  return `${signe}${nf(1).format(Math.abs(d) * 100)} %`;
}

export function ilYa(ms: number, maintenant = Date.now()): string {
  const s = Math.max(0, Math.round((maintenant - ms) / 1000));
  if (s < 60) return `il y a ${s} s`;
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

export const dateCourte = (ms: number) => new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
export const dateLongue = (ms: number) => new Date(ms).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
