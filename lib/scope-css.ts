// Confine le CSS d'un design importé (AXSO Design) à son conteneur via
// @scope natif : sans ça ses règles globales (`header{background:…}`,
// `*{margin:0;padding:0}`, `button{background:none}`…) s'appliquaient à TOUTE
// la page — barre du Constructeur, panneau AXIA, widgets de la vitrine.
// `:root`/`html`/`body` deviennent `:scope` (variables et fond du design
// portés par le conteneur). Les at-rules qui n'ont pas leur place dans
// @scope (@import, @font-face, @keyframes…) restent au niveau global.

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

/** CSS du design, commun à toutes les sections découpées (blocs embed-html sans CSS propre). */
export function cssSectionsDesign(cfg: { builderCss?: string; colors: Record<string, any>; axsoDesignCssVarMapping?: Record<string, string> }): string {
  if (!cfg.builderCss) return "";
  return scoperCss(`${cfg.builderCss}\n${surchargeCouleursDesign(cfg.colors, cfg.axsoDesignCssVarMapping)}`, "[data-axs-embed-html]");
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
  console.log(out);
}
