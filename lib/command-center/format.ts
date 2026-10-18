// Formatage des valeurs (module pur, client + serveur). Montants en FCFA.
// `formats(t)` renvoie les mêmes fonctions dans la langue de `t` (locale + unités) ;
// les exports directs restent en français (e-mails du cron, tests).
import type { Format } from "./moteur";
import { creerT, type T } from "@/lib/i18n";

export const T_FR = creerT("fr", {});

export function formats(t: T = T_FR) {
  const nf = (max = 0) => new Intl.NumberFormat(t.loc, { maximumFractionDigits: max });

  function compact(n: number): string {
    const a = Math.abs(n);
    if (a >= 1e9) return t("{0} Md", nf(1).format(n / 1e9));
    if (a >= 1e6) return t("{0} M", nf(1).format(n / 1e6));
    if (a >= 1e4) return t("{0} k", nf(1).format(n / 1e3));
    return nf(a < 10 && a % 1 ? 1 : 0).format(n);
  }

  function formatValeur(v: number | null | undefined, f: Format, complet = false): string {
    if (v == null || !Number.isFinite(v)) return "—";
    switch (f) {
      case "xaf": return `${complet ? nf().format(Math.round(v)) : compact(v)} FCFA`;
      case "pct": return t("{0} %", nf(1).format(v * 100));
      case "heures": return v >= 48 ? t("{0} j", nf(1).format(v / 24)) : t("{0} h", nf(0).format(v));
      case "ratio": return `${nf(2).format(v)}×`;
      default: return complet ? nf().format(Math.round(v)) : compact(v);
    }
  }

  /** Variation : relative (« +12,8 % ») ou en points pour un pourcentage (« +1,2 pt »). */
  function formatVariation(d: number | null | undefined, f: Format): string {
    if (d == null || !Number.isFinite(d)) return "—";
    // Pas de « −0 % » : le signe suit la valeur arrondie affichée.
    const signe = Math.round(Math.abs(d) * 1000) === 0 ? "" : d > 0 ? "+" : "−";
    if (f === "pct") return signe + t("{0} pt", nf(1).format(Math.abs(d) * 100));
    return signe + t("{0} %", nf(1).format(Math.abs(d) * 100));
  }

  function ilYa(ms: number, maintenant = Date.now()): string {
    const s = Math.max(0, Math.round((maintenant - ms) / 1000));
    if (s < 60) return t("il y a {0} s", s);
    if (s < 3600) return t("il y a {0} min", Math.round(s / 60));
    if (s < 86400) return t("il y a {0} h", Math.round(s / 3600));
    return t("il y a {0} j", Math.round(s / 86400));
  }

  const dateCourte = (ms: number) => new Date(ms).toLocaleDateString(t.loc, { day: "numeric", month: "short", timeZone: "Africa/Douala" });
  const dateLongue = (ms: number) => new Date(ms).toLocaleDateString(t.loc, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Douala" });

  return { compact, formatValeur, formatVariation, ilYa, dateCourte, dateLongue };
}

export const { compact, formatValeur, formatVariation, ilYa, dateCourte, dateLongue } = formats();
