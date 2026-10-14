// Niveau de risque d'un ensemble de changements de boutique (moteur de risque du Builder).
// Pur. faible : textes, déplacements, styles locaux. moyen : couleurs, typographie, thème,
// suppression de section, nouvelle page. eleve : refonte majeure, paiement/commande, CSS libre.
import type { Changement } from "./diff";
import type { Risque } from "@/lib/controle-ia/regles";

const MOYEN = new Set(["colors", "fonts", "radius", "layout", "boutons", "navigationStyle", "sections", "productPage", "marque", "seo"]);
const ELEVE = new Set(["customCss"]);
const PAIEMENT = /checkout|panier|confirmation|paiement/i;

export function risqueChangements(ch: Changement[]): { risque: Risque; score: number; raisons: string[] } {
  const raisons: string[] = [];
  let score = 0;
  for (const c of ch) {
    if (ELEVE.has(c.cible) || PAIEMENT.test(c.cible)) { score += 40; raisons.push(`${c.detail} (sensible)`); }
    else if (MOYEN.has(c.cible)) { score += 12; raisons.push(c.detail); }
    else if (c.type === "suppression") { score += 8; raisons.push(`suppression : ${c.detail}`); }
    else if (c.type === "ajout" && c.cible.startsWith("page:")) score += 6;
    else score += 2;
  }
  // Une refonte (beaucoup de changements à la fois) est en soi risquée.
  if (ch.length >= 25) { score += 30; raisons.push(`refonte importante (${ch.length} changements)`); }
  score = Math.min(100, score);
  return { risque: score >= 50 ? "eleve" : score >= 15 ? "moyen" : "faible", score, raisons: raisons.slice(0, 8) };
}
