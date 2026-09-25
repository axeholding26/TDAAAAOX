// Confine le CSS d'un design importé (AXSO Design) à son conteneur via
// @scope natif : sans ça ses règles globales (`header{background:…}`,
// `*{margin:0;padding:0}`, `button{background:none}`…) s'appliquaient à TOUTE
// la page — barre du Constructeur, panneau AXIA, widgets de la vitrine.
// `:root`/`html`/`body` deviennent `:scope` (variables et fond du design
// portés par le conteneur). Les at-rules qui n'ont pas leur place dans
// @scope (@import, @font-face, @keyframes…) restent au niveau global.

import { MANIFESTE_LIBRAIRIE } from "./axso-design-manifest";
import { fontEntry } from "./theme-fonts";
import { cssElements, importPolices, policesDe, type ElementStyles } from "./element-styles";
import type { BlockNode } from "./theme-config";
import { cssReglagesDesign, cssReglagesDesignPage } from "./reglages-design";

const AT_RULES_GLOBALES = /^@(import|charset|font-face|keyframes|-webkit-keyframes|property|namespace)\b/i;

/** Découpe une feuille en instructions de premier niveau (règle, at-rule à bloc ou `;`). */
function decouperPremierNiveau(css: string): string[] {
  const morceaux: string[] = [];
  let debut = 0, profondeur = 0, quote: string | null = null;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "/" && css[i + 1] === "*") {
      const fin = css.indexOf("*/", i + 2);
      i = fin === -1 ? css.length : fin + 1;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "{") profondeur++;
    else if (c === "}") {
      profondeur = Math.max(0, profondeur - 1);
      if (profondeur === 0) { morceaux.push(css.slice(debut, i + 1)); debut = i + 1; }
    } else if (c === ";" && profondeur === 0) {
      morceaux.push(css.slice(debut, i + 1)); debut = i + 1;
    }
  }
  if (css.slice(debut).trim()) morceaux.push(css.slice(debut));
  return morceaux.map((m) => m.trim()).filter(Boolean);
}

// `html body`, `html`, `body` et `:root` en position de sélecteur → `:scope`.
function versScope(css: string): string {
  return css
    .replace(/:root\b/g, ":scope")
    .replace(/(^|[\s,{}>~+(])html\s+body(?=[\s,{.:#[>~+)])/g, "$1:scope")
    .replace(/(^|[\s,{}>~+(])(?:html|body)(?=[\s,{.:#[>~+)])/g, "$1:scope");
}

export function scoperCss(css: string, selecteurRacine: string): string {
  const globales: string[] = [];
  const locales: string[] = [];
  for (const m of decouperPremierNiveau(css)) (AT_RULES_GLOBALES.test(m) ? globales : locales).push(m);
  // @import doit précéder toute autre règle de la feuille, sinon il est ignoré.
  globales.sort((a, b) => Number(/^@(import|charset)/i.test(b)) - Number(/^@(import|charset)/i.test(a)));
  return `${globales.join("\n")}\n@scope (${selecteurRacine}) {\n${versScope(locales.join("\n"))}\n}`;
}

// Surcharge des variables CSS du design par les couleurs choisies dans le
// Constructeur (mapping couleur → variables posé au provisionnement).
export function surchargeCouleursDesign(colors: Record<string, any>, mapping?: Record<string, string>): string {
  if (!mapping) return "";
  const decls: string[] = [];
  for (const [cle, vars] of Object.entries(mapping)) {
    const valeur = colors[cle];
    if (!valeur || !vars) continue;
    for (const v of vars.split(",")) decls.push(`${v.trim()}: ${valeur}`);
  }
  return decls.length ? `:root { ${decls.join("; ")} }` : "";
}

type Polices = { titre?: string; corps?: string };
type CfgDesign = Partial<Pick<Parameters<typeof cssReglagesDesign>[0], "boutons" | "navigationStyle" | "animations" | "reglagesDesign">> & { builderCss?: string; colors: Record<string, any>; fonts?: Polices; axsoDesignCssVarMapping?: Record<string, string>; axsoDesignPolices?: Polices; builderTree?: BlockNode[] };

// Responsive du design dans l'aperçu : ses @media de largeur deviennent des
// @container et ses `vw` des `cqw` — ils suivent la largeur du conteneur
// (l'aperçu tablette/mobile du Constructeur ; toute la page sur la boutique,
// où l'effet est identique à avant). Les @media non liés à la largeur
// (prefers-reduced-motion, hover, print…) restent des @media.
function adapterAuConteneur(css: string): string {
  return css
    .replace(/@media\s*([^{]+)\{/gi, (m, cond: string) => {
      const c = cond.trim().replace(/^(only\s+)?(screen|all)\s+and\s+/i, "");
      return /^\(\s*(min-|max-)?width\s*[:<>=][^)]*\)(\s+and\s+\(\s*(min-|max-)?width\s*[:<>=][^)]*\))*$/i.test(c) ? `@container ${c}{` : m;
    })
    .replace(/(\d*\.?\d+)vw\b/g, "$1cqw");
}

// Garde-fous anti-débordement communs à tous les designs (petits écrans).
const SECURITE_RESPONSIVE = `img,video,iframe,svg{max-width:100%}h1,h2,h3,h4,p,a,li,span,button{overflow-wrap:break-word}`;

function stylesElementsArbre(tree?: BlockNode[]): ElementStyles {
  const tous: ElementStyles = {};
  const parcourir = (n: BlockNode) => {
    if (n.type === "embed-html" && n.config?.elementStyles) Object.assign(tous, n.config.elementStyles);
    (n.children ?? []).forEach(parcourir);
  };
  (tree ?? []).forEach(parcourir);
  return tous;
}

// Polices d'origine du design, pour savoir quoi remplacer. Enregistrées au
// provisionnement ; pour les boutiques plus anciennes, design retrouvé à sa
// couleur de fond et sa police de titre (présentes dans son CSS).
function policesOrigine(cfg: CfgDesign): Polices | null {
  if (cfg.axsoDesignPolices) return cfg.axsoDesignPolices;
  const css = (cfg.builderCss || "").toLowerCase();
  const e = MANIFESTE_LIBRAIRIE.find((m) => {
    const titre = fontEntry(m.polices.titre)?.label.toLowerCase();
    return !!m.couleurs.fond && css.includes(m.couleurs.fond.toLowerCase()) && !!titre && css.includes(titre);
  });
  return e?.polices ?? null;
}

// Remplace, dans les déclarations font/font-family du design, ses polices
// d'origine par celles choisies dans le Constructeur (panneau Typographie).
// Le reste du design (tailles, graisses, polices secondaires) est intact.
// ponytail: si le design utilise la même police en titre et en corps, en
// changer une seule change les deux (impossible de les distinguer ici).
function remplacerPolices(css: string, origine: Polices, choisies: Polices): string {
  for (const k of ["titre", "corps"] as const) {
    const avant = fontEntry(origine[k])?.label;
    const apres = fontEntry(choisies[k])?.label;
    if (!avant || !apres || avant === apres) continue;
    const nom = new RegExp(`(["']?)${avant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`, "gi");
    css = css.replace(/(font(?:-family)?\s*:)([^;}]*)/gi, (_m, prop: string, valeur: string) => prop + valeur.replace(nom, `'${apres}'`));
  }
  return css;
}

/** CSS du design avec les couleurs et polices choisies dans le Constructeur — le même partout (aperçu, vitrine, toutes pages). */
export function cssDesignPersonnalise(cfg: CfgDesign): string {
  if (!cfg.builderCss) return "";
  const origine = policesOrigine(cfg);
  const css = adapterAuConteneur(origine && cfg.fonts ? remplacerPolices(cfg.builderCss, origine, cfg.fonts) : cfg.builderCss);
  // Réglages par élément (panneau de droite) : après le design, pour primer.
  const elements = stylesElementsArbre(cfg.builderTree);
  return [
    importPolices(policesDe(elements)),
    css,
    surchargeCouleursDesign(cfg.colors, cfg.axsoDesignCssVarMapping),
    SECURITE_RESPONSIVE,
    // Panneaux Boutons et navigation / Animations, s'ils ont été modifiés.
    cssReglagesDesign(cfg as any),
    cssElements(elements, "", false),
  ].join("\n");
}

/** CSS du design, commun à toutes les sections découpées (blocs embed-html sans CSS propre). */
export function cssSectionsDesign(cfg: CfgDesign): string {
  const css = cssDesignPersonnalise(cfg);
  return css ? scoperCss(css, "[data-axs-embed-html]") + cssReglagesDesignPage(cfg as any) : "";
}

// Auto-vérification : `SCOPE_CSS_CHECK=1 npx tsx lib/scope-css.ts`
if (process.env.SCOPE_CSS_CHECK) {
  const out = scoperCss(
    `@import url(x.css);:root{--a:1} *{margin:0} body{background:red} html body .x{a:b} header{c:d} @media(max-width:9px){body.d{e:f}} @keyframes k{from{g:h}} .body-copy{i:j} a[href$=".html"]{k:l}`,
    "[data-x]",
  );
  const [avant, scope] = out.split("@scope");
  console.assert(avant.includes("@import") && avant.includes("@keyframes k"), "at-rules globales hissées");
  console.assert(!scope.includes("@import") && !scope.includes("@keyframes"), "rien de global dans @scope");
  console.assert(scope.includes(":scope{--a:1}") && scope.includes(":scope{background:red}"), ":root/body → :scope");
  console.assert(scope.includes(":scope .x") && scope.includes(":scope.d{"), "html body / body.d");
  console.assert(scope.includes(".body-copy") && scope.includes('.html"'), "classes et attributs intacts");
  const perso = cssDesignPersonnalise({
    builderCss: `h1{font-family:'Italiana',serif} body{font-family:"Jost",sans-serif} .x{font:500 12px 'Jost'} @import url(https://f?family=Jost);`,
    colors: {}, fonts: { titre: "playfair", corps: "inter" }, axsoDesignPolices: { titre: "italiana", corps: "jost" },
  });
  console.assert(perso.includes("h1{font-family:'Playfair Display',serif}") && perso.includes("body{font-family:'Inter',sans-serif}"), "polices remplacées");
  console.assert(perso.includes(".x{font:500 12px 'Inter'}") && perso.includes("family=Jost"), "raccourci font remplacé, URL intacte");
  const resp = adapterAuConteneur(`@media(max-width:880px){nav{display:none}} @media screen and (min-width: 600px) and (max-width: 900px){a{b:c}} @media (prefers-reduced-motion: reduce){*{d:e}} .h{padding:26px 4vw;width:12.5vw}`);
  console.assert(resp.includes("@container (max-width:880px){") && resp.includes("@container (min-width: 600px) and (max-width: 900px){"), "@media largeur → @container");
  console.assert(resp.includes("@media (prefers-reduced-motion: reduce)"), "autres @media intacts");
  console.assert(resp.includes("26px 4cqw;width:12.5cqw"), "vw → cqw");
  console.log(out);
}
