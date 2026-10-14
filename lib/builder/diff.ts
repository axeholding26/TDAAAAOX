// Comparaison de deux configurations de boutique (avant / après) : ce qui a été ajouté,
// supprimé, déplacé ou modifié, en lignes lisibles (« + Nouveau hero », « ~ Couleurs »).
// Pur : utilisé pour les reçus de publication, les versions et l'aperçu des changements.
import type { BlockNode } from "@/lib/theme-config";

export interface Changement { type: "ajout" | "suppression" | "deplacement" | "modification"; cible: string; detail: string }

const nomDe = (n: BlockNode) => String(n.config?.nom ?? n.config?.titre ?? n.config?.texte ?? n.type).slice(0, 60);

function aplatir(nodes: BlockNode[] = [], parent = "racine", out = new Map<string, { node: BlockNode; parent: string; index: number }>()) {
  nodes.forEach((n, index) => {
    out.set(n.id, { node: n, parent, index });
    aplatir(n.children, n.id, out);
  });
  return out;
}

const sans = (n: BlockNode) => JSON.stringify({ ...n, children: undefined });

/** Clés de premier niveau dont le contenu change, hors arbres et pages comparés à part. */
const TOKENS: Record<string, string> = {
  colors: "Couleurs", fonts: "Typographie", radius: "Arrondis", layout: "Mise en page", boutons: "Boutons",
  navigationStyle: "Navigation", animations: "Animations", sections: "Sections de l'accueil (socle)", productPage: "Fiche produit",
  aboutPage: "Page À propos", contactPage: "Page Contact", customCss: "CSS personnalisé", seo: "Référencement", marque: "Marque",
};

export function comparer(avant: Record<string, any>, apres: Record<string, any>): Changement[] {
  const ch: Changement[] = [];
  const a = aplatir(avant.builderTree), b = aplatir(apres.builderTree);
  for (const [id, x] of b) {
    const y = a.get(id);
    // Seul le nœud le plus haut d'un sous-arbre ajouté est signalé.
    if (!y) { if (x.parent === "racine" || a.has(x.parent)) ch.push({ type: "ajout", cible: id, detail: `${x.node.type} « ${nomDe(x.node)} »` }); continue; }
    if (y.parent !== x.parent || y.index !== x.index) {
      if (x.parent === "racine" || y.parent !== x.parent) ch.push({ type: "deplacement", cible: id, detail: `${x.node.type} « ${nomDe(x.node)} » (position ${y.index + 1} → ${x.index + 1})` });
    }
    if (sans(y.node) !== sans(x.node)) {
      const quoi = [JSON.stringify(y.node.config) !== JSON.stringify(x.node.config) && "contenu", JSON.stringify(y.node.style) !== JSON.stringify(x.node.style) && "style", y.node.actif !== x.node.actif && (x.node.actif === false ? "masqué" : "affiché")].filter(Boolean);
      ch.push({ type: "modification", cible: id, detail: `${x.node.type} « ${nomDe(x.node)} » : ${quoi.join(", ")}` });
    }
  }
  for (const [id, y] of a) if (!b.has(id) && (y.parent === "racine" || b.has(y.parent))) ch.push({ type: "suppression", cible: id, detail: `${y.node.type} « ${nomDe(y.node)} »` });

  const pa = (avant.pagesPerso ?? {}) as Record<string, any>, pb = (apres.pagesPerso ?? {}) as Record<string, any>;
  for (const k of Object.keys(pb)) {
    if (!pa[k]) ch.push({ type: "ajout", cible: `page:${k}`, detail: `Page « ${pb[k]?.nom ?? k} »` });
    else if (JSON.stringify(pa[k]) !== JSON.stringify(pb[k])) ch.push({ type: "modification", cible: `page:${k}`, detail: `Page « ${pb[k]?.nom ?? k} »` });
  }
  for (const k of Object.keys(pa)) if (!pb[k]) ch.push({ type: "suppression", cible: `page:${k}`, detail: `Page « ${pa[k]?.nom ?? k} »` });

  for (const [cle, libelle] of Object.entries(TOKENS)) {
    if (JSON.stringify(avant[cle] ?? null) !== JSON.stringify(apres[cle] ?? null)) ch.push({ type: "modification", cible: cle, detail: libelle });
  }
  return ch;
}

const SIGNE = { ajout: "+", suppression: "-", deplacement: "↕", modification: "~" } as const;
export const resumer = (ch: Changement[], max = 30) =>
  ch.length ? ch.slice(0, max).map((c) => `${SIGNE[c.type]} ${c.detail}`).join("\n") + (ch.length > max ? `\n… et ${ch.length - max} autres` : "") : "Aucun changement.";
