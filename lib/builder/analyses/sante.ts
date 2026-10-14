// Score de santé de la boutique (pur) et validation globale avant publication.
// Barème (documenté, renvoyé avec le score) : chaque domaine part de 100 et perd
// 25 points par problème critique, 8 par problème à surveiller, 2 par information ;
// borné à 0-100. Global = moyenne des domaines évalués (la cohérence de marque ne compte
// que si un outil a pu l'évaluer).
import type { ThemeConfig } from "@/lib/theme-config";
import { validerConfig } from "@/lib/builder/validation";
import type { Boutique, Domaine, Gravite, Probleme } from "./commun";
import { analyserMobile } from "./mobile";
import { analyserSeo } from "./seo";
import { analyserAccessibilite } from "./accessibilite";
import { analyserPerformance } from "./performance";
import { analyserConversion, type Stats } from "./conversion";
import { analyserDesign } from "./design";

export const PENALITE: Record<Gravite, number> = { critique: 25, attention: 8, info: 2 };
export const BAREME = "Chaque domaine part de 100 : −25 par problème critique, −8 par problème à surveiller, −2 par information, borné à 0-100. Global = moyenne des domaines évalués.";
export const LIBELLES: Record<Domaine | "marque", string> = {
  design: "Design", ux: "UX", mobile: "Mobile", seo: "SEO", performance: "Performance", accessibilite: "Accessibilité", conversion: "Conversion", marque: "Cohérence de marque",
};

export function toutAnalyser(cfg: ThemeConfig, b: Boutique, stats?: Stats | null): Probleme[] {
  return [
    ...analyserDesign(cfg, b), ...analyserMobile(cfg, b), ...analyserSeo(cfg, b),
    ...analyserPerformance(cfg, b), ...analyserAccessibilite(cfg, b), ...analyserConversion(cfg, b, stats),
  ];
}

export const scoreDe = (problemes: Probleme[]) => Math.max(0, Math.min(100, 100 - problemes.reduce((s, p) => s + PENALITE[p.gravite], 0)));

/** Scores par domaine et global. `marque` : score 0-100 fourni par un autre outil, ou null (non évalué). */
export function scoreSante(problemes: Probleme[], marque: number | null = null) {
  const domaines = Object.fromEntries((["design", "ux", "mobile", "seo", "performance", "accessibilite", "conversion"] as Domaine[])
    .map((d) => [d, scoreDe(problemes.filter((p) => p.domaine === d))])) as Record<Domaine, number> & { marque?: number | null };
  const notes = Object.values(domaines) as number[];
  if (marque !== null && Number.isFinite(marque)) { const m = Math.max(0, Math.min(100, Math.round(marque))); domaines.marque = m; notes.push(m); }
  else domaines.marque = null;
  return { global: Math.round(notes.reduce((a, n) => a + n, 0) / notes.length), domaines, bareme: BAREME };
}

/** Verdict de publication (`brut` : config telle qu'enregistrée, non résolue) : structure valide (lib/builder/validation.ts) et aucun problème critique. */
export function verdict(brut: Record<string, any>, avant: Record<string, any>, problemes: Probleme[]) {
  const structure = validerConfig(brut, avant);
  const critiques = problemes.filter((p) => p.gravite === "critique");
  return { pret: !structure.length && !critiques.length, structure, critiques };
}
