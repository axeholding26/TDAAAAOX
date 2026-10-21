// Prompts standards d'importation : le marchand en colle un dans son IA
// (ChatGPT, Claude…) pour obtenir un fichier HTML que l'import
// (app/api/themes/importer → lib/theme-import-clone.ts) et le Constructeur
// (lib/decoupage-design.ts, builder/boutique/elements-dom.ts, lib/scope-css.ts,
// lib/liens-design.ts, lib/vitrine-design.ts) savent manipuler. Ils ne fixent
// QUE la structure technique : contenu, couleurs, polices et style restent
// libres. Chaque règle correspond à un comportement réel du code — à mettre à
// jour si ce code change. Trois types d'import :
//  - accueil  : la page d'accueil (le reste de la boutique est celui d'Axso) ;
//  - boutique : accueil + catalogue (fiche produit, panier, commande, À propos
//    et Contact sont ceux d'Axso, dans l'en-tête et le pied de page du fichier) ;
//  - page     : une page libre de plus (/<boutique>/p/<page>), entre l'en-tête
//    et le pied de page de la boutique.
// validerThemeImporte : même standard, vérifié sur un fichier avant l'envoi.
import { parse, type HTMLElement as El } from "node-html-parser";

export type TypeImport = "accueil" | "boutique" | "page";

const FICHIER = `1. FICHIER
- Un seul fichier .html complet (<!doctype html>, <head>, <body>), moins de 300 Ko.
- Le <title> du <head> = nom du thème (ou de la page).
- Tout le CSS dans une ou plusieurs balises <style> du <head>. Aucune autre feuille externe : seule Google Fonts est conservée (<link href="https://fonts.googleapis.com/..."> ou @import de Google Fonts).
- AUCUN JavaScript : pas de <script>, pas d'attributs onclick/onload/on…, pas de liens « javascript: ». Ils sont supprimés à l'import ; rien ne doit dépendre d'eux (pas de carrousel, d'onglets, d'accordéon ou de menu en JS — utilise du CSS pur si besoin).
- Pas d'<iframe>, <embed>, <object>, ni bibliothèque CDN (Tailwind, Bootstrap, jQuery…).
- Images : uniquement des URL https publiques complètes dans des balises <img src="https://..." alt="...">, jamais de fichiers locaux. Le marchand les remplacera ensuite.`;

const SECTIONS = `- Chaque enfant direct d'un conteneur « view » devient une section que le marchand peut déplacer, masquer, dupliquer ou supprimer : une <section> par bloc (bannière, collection, avantages, témoignages, newsletter…).
- Donne à chaque section une classe parlante (hero, promo, features, collection…) et un titre <h1>/<h2>/<h3> : ils servent à nommer la section dans le Constructeur.`;

const ELEMENTS = `ÉLÉMENTS MODIFIABLES
- Chaque texte modifiable dans sa propre balise sans autre balise à l'intérieur : <h1>…<h6>, <p>, <span>, <li>, <a>, <small>, <strong>. Ne mélange pas texte et balises dans un même élément (pas de <br>, <em>, <span> au milieu d'un titre) : découpe plutôt en plusieurs éléments.
- Boutons d'action : des liens <a href="#" class="btn">Texte</a> (pas de <button>, qui n'a pas de lien modifiable).
- Images : des <img> (une image en background-image CSS n'est pas remplaçable par le marchand).
- Icônes : SVG en ligne autorisés.`;

const ENTETE = `EN-TÊTE ET LIENS
- Logo : <a class="logo" data-axso-nom href="#">Ma marque</a> — l'attribut data-axso-nom le remplace automatiquement par le nom et le logo de la boutique. Dans le pied de page : <span data-axso-nom>Ma marque</span> après le ©.
- Menu dans un <nav> à l'intérieur du <header>, liens <a href="#"> dont le texte visible est l'un de : « Accueil », « Boutique » (ou « Produits » / « Collection »), « À propos », « Contact ». Axso les relie aux vraies pages d'après ce texte ; « Mon compte » et le panier sont ajoutés par Axso.
- Recherche : un <a> SANS href dont le texte est exactement « Rechercher » ouvre la recherche de la boutique.
- Pied de page : uniquement des liens dont le texte contient « Contact », « À propos », « Produits »/« Boutique » ; les autres liens sans destination sont retirés. La phrase « Confidentialité — Conditions générales » devient automatiquement les liens légaux.
- Liens internes vers une section : href="#id-de-la-section" (conservés tels quels).`;

const CARTE = `- Chaque carte est un lien et ne contient que : une <img>, le nom du produit, le prix écrit chiffre d'abord (ex. « 12 000 FCFA »), et éventuellement un libellé de bouton « Commander ». Aucun autre texte (pas de description, ni de badge long) : la première carte sert de modèle, Axso y met l'image, le nom, le prix et le lien des vrais produits.
  Exemple : <a href="#" class="product-card"><img src="https://..." alt="Produit"><h3>Nom du produit</h3><span class="price">12 000 FCFA</span></a>`;

const CSS = `CSS
- Déclare la charte dans ces variables sur :root et utilise-les partout : --couleur-fond, --couleur-texte, --couleur-accent, --couleur-surface (valeurs hexadécimales #rrggbb), --police-titre, --police-corps. Les couleurs choisies ensuite dans le Constructeur remplacent ces variables.
- Le CSS est confiné à la page importée : :root, html et body sont rapportés au conteneur du thème. N'utilise pas de sélecteurs qui relient deux sections ou l'en-tête à une section (body > header, header + section, section:nth-child, ~), chaque section étant affichée séparément. Préfère des classes.
- Ne masque jamais .view (pas de .view{display:none}). Pas de !important (il bloquerait les réglages du Constructeur). Pas de position: fixed sur l'en-tête (Axso gère l'en-tête collant).
- Responsive obligatoire, mobile d'abord : @media (max-width: …) / (min-width: …) sur la largeur uniquement, unités relatives, images en max-width: 100%, pas de largeur fixe en px supérieure à 360px, aucun texte en white-space: nowrap hors des boutons courts, grilles en minmax(0, 1fr), menu lisible sur mobile sans JavaScript (liens qui passent à la ligne ou défilent horizontalement).`;

const FIN = `Réponds uniquement avec le code HTML complet du fichier, sans explication.`;

const PROMPTS: Record<TypeImport, string> = {
  accueil: `Crée la page d'accueil d'une boutique en ligne sous la forme d'UN SEUL fichier HTML autonome, destiné à être importé dans le Constructeur de la plateforme Axso. Le style, les couleurs, les polices, l'ambiance et les textes sont libres (je te les décris plus bas). Tu dois en revanche respecter STRICTEMENT les règles techniques suivantes, sinon le fichier ne sera pas modifiable :

${FICHIER}

2. STRUCTURE DU <body> (obligatoire, dans cet ordre, au premier niveau du <body>)
<body>
  <header>…logo + <nav> avec les liens…</header>
  <div class="view active" id="view-home">
    <section class="hero">…</section>
    <section class="…">…</section>
    …
  </div>
  <footer>…</footer>
</body>
- Exactement UN conteneur <div class="view active" id="view-home"> (pas <main>, pas d'autre conteneur « view »).
${SECTIONS}
- Tout ce qui est AVANT ce conteneur va dans l'en-tête, tout ce qui est APRÈS va dans le pied de page. Rien d'autre au premier niveau du <body> (pas de fenêtre modale, de toast ou de panneau caché).
- Une seule balise <h1> (dans la bannière principale).

3. ${ELEMENTS}

4. ${ENTETE}

5. GRILLE DE PRODUITS (emplacement dynamique)
- Une seule grille : un conteneur avec une classe unique (ex. <div class="product-grid">) contenant 4 à 8 cartes de démonstration à la structure IDENTIQUE, chacune avec sa propre classe (ex. class="product-card").
${CARTE}
- Pas d'autre emplacement dynamique (catégories, avis, panier…) : les collections sont ajoutées par Axso dans le pied de page ; le reste de la boutique (liste, fiche produit, panier, paiement) est fourni par Axso.

6. ${CSS}

${FIN}

Description de ma boutique et du style souhaité :
[décris ici ta boutique, tes produits, tes couleurs, tes polices et l'ambiance voulue]`,

  boutique: `Crée le thème complet d'une boutique en ligne (page d'accueil + page catalogue) sous la forme d'UN SEUL fichier HTML autonome, destiné à être importé dans le Constructeur de la plateforme Axso. Le style, les couleurs, les polices, l'ambiance et les textes sont libres (je te les décris plus bas). Tu dois en revanche respecter STRICTEMENT les règles techniques suivantes, sinon le fichier ne sera pas modifiable :

${FICHIER}

2. STRUCTURE DU <body> (obligatoire, dans cet ordre, au premier niveau du <body>)
<body>
  <header>…logo + <nav> avec les liens…</header>
  <div class="view active" id="view-home">
    <section class="hero">…</section>
    <section class="collection">… <div id="homeGrid" class="product-grid">…cartes…</div> …</section>
    …
  </div>
  <div class="view active" id="view-boutique">
    <section class="plp-head"><h1>Toute la collection</h1><span id="plpCount">8 produits</span></section>
    <section class="plp"><div class="filters"><span class="chip active" data-cat="all">Tout</span><span class="chip" data-cat="exemple">Exemple</span></div><div id="plpGrid" class="product-grid">…cartes…</div></section>
  </div>
  <footer>…</footer>
</body>
- Exactement DEUX conteneurs « view », avec ces id exacts : view-home (page d'accueil) puis view-boutique (catalogue). Ne crée PAS les autres pages : la fiche produit, le panier, la commande, la confirmation, « À propos » et « Contact » sont fournis par Axso, affichés entre TON en-tête et TON pied de page, avec tes couleurs et tes polices.
${SECTIONS}
- Le <header> AVANT le premier conteneur et le <footer> APRÈS le dernier sont communs à toutes les pages. Rien d'autre au premier niveau du <body> (pas de fenêtre modale, de toast ou de panneau caché).
- Une seule balise <h1> par conteneur « view ».

3. ${ELEMENTS}

4. ${ENTETE}

5. GRILLES DE PRODUITS (emplacements dynamiques)
- Accueil : une grille <div id="homeGrid"> (id exact) contenant 4 cartes de démonstration ; Axso y affiche les 8 derniers produits.
- Catalogue : une grille <div id="plpGrid"> (id exact) contenant 8 cartes de démonstration ; Axso y affiche tous les produits. Facultatif : <span id="plpCount">8 produits</span> (remplacé par le vrai nombre) et des pastilles de filtre avec data-cat, la première étant data-cat="all" (remplacées par les vraies catégories, filtrage fourni par Axso).
- Les cartes des deux grilles ont la MÊME structure, enfants directs de la grille.
${CARTE}
- Pas d'autre emplacement dynamique (avis, panier…).

6. ${CSS}

${FIN}

Description de ma boutique et du style souhaité :
[décris ici ta boutique, tes produits, tes couleurs, tes polices et l'ambiance voulue]`,

  page: `Crée UNE page de contenu pour une boutique en ligne existante (page de campagne, présentation de marque, guide, événement…) sous la forme d'UN SEUL fichier HTML autonome, destiné à être importé dans le Constructeur de la plateforme Axso. La page s'affichera entre l'en-tête et le pied de page déjà existants de la boutique. Le style, les couleurs, les polices et les textes sont libres (je te les décris plus bas). Tu dois en revanche respecter STRICTEMENT les règles techniques suivantes, sinon le fichier ne sera pas modifiable :

${FICHIER}

2. STRUCTURE DU <body> (obligatoire)
<body>
  <div class="view active" id="view-home">
    <section class="hero">…</section>
    <section class="…">…</section>
    …
  </div>
</body>
- Exactement UN conteneur <div class="view active" id="view-home">, seul enfant du <body>. PAS de <header>, <nav> ni <footer> : ceux de la boutique sont utilisés.
${SECTIONS}
- Une seule balise <h1> (dans la première section).
- Pas de grille de produits : le marchand ajoutera une section « Produits » dans le Constructeur s'il en veut une.
- Liens : boutons vers « https://… » ou vers une section de la page (href="#id-de-la-section").

3. ${ELEMENTS}

4. ${CSS}

${FIN}

Description de la page souhaitée (sujet, textes, couleurs, polices, ambiance) :
[décris ici ta page]`,
};

export const PROMPTS_IMPORT = PROMPTS;
/** Prompt de l'import historique (page d'accueil). */
export const PROMPT_IMPORT_THEME = PROMPTS.accueil;

// ─── Vérification d'un fichier avant import ───────────────────────────────────

export interface RapportTheme {
  erreurs: string[]; // le fichier ne sera pas (bien) importé
  avertissements: string[]; // parties qui ne seront pas éditables ou seront retirées
}

const TAILLE_MAX = 300_000; // = app/api/themes/importer/route.ts
export const VARIABLES_CHARTE = { fond: "--couleur-fond", texte: "--couleur-texte", accent: "--couleur-accent", surface: "--couleur-surface" } as const;

export function validerThemeImporte(html: string, type: TypeImport = "accueil"): RapportTheme {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  if (html.length > TAILLE_MAX) erreurs.push("Fichier de plus de 300 Ko : il sera refusé.");

  const racine = parse(html, { blockTextElements: { script: true, style: true } });
  const body = racine.querySelector("body") ?? racine;
  const premierNiveau = body.children;
  const vues = premierNiveau.filter((e) => e.classList.contains("view"));
  if (type === "boutique") {
    for (const id of ["view-home", "view-boutique"]) if (!vues.some((v) => v.id === id)) erreurs.push(`Aucun conteneur <div class="view active" id="${id}"> au premier niveau du <body>.`);
    const autres = vues.filter((v) => !["view-home", "view-boutique"].includes(v.id));
    if (autres.length) avertissements.push(`${autres.length} autre(s) conteneur(s) .view (${autres.map((v) => v.id || "sans id").join(", ")}) : ignoré(s), ces pages sont fournies par Axso.`);
    if (!racine.querySelector("#plpGrid")?.children.length) erreurs.push("Pas de grille <div id=\"plpGrid\"> avec des cartes de démonstration : le catalogue n'affichera pas les produits.");
    if (!racine.querySelector("#homeGrid")) avertissements.push("Pas de grille <div id=\"homeGrid\"> : l'accueil n'affichera pas les produits.");
  } else {
    if (vues.length === 0) erreurs.push("Aucun conteneur <div class=\"view active\" id=\"view-home\"> au premier niveau du <body> : la page ne sera pas découpée en sections.");
    if (vues.length > 1) erreurs.push(`${vues.length} conteneurs .view : seul le premier est importé${type === "accueil" ? ", les suivants iront dans le pied de page" : ""}.`);
  }
  if (vues[0] && vues[0].tagName !== "DIV") avertissements.push(`Le conteneur .view est un <${vues[0].tagName.toLowerCase()}> : il deviendra un <div>, le CSS qui vise cette balise ne s'appliquera plus.`);
  const iVue = vues[0] ? premierNiveau.indexOf(vues[0]) : -1;
  const iDerniere = vues.length ? premierNiveau.indexOf(vues[vues.length - 1]) : -1;
  if (type === "page") {
    if (premierNiveau.some((e) => e.tagName === "HEADER" || e.tagName === "FOOTER")) avertissements.push("<header>/<footer> au premier niveau : ignorés, la page utilise l'en-tête et le pied de page de la boutique.");
  } else {
    if (iVue >= 0 && !premierNiveau.slice(0, iVue).some((e) => e.tagName === "HEADER")) avertissements.push("Pas de <header> avant le conteneur .view : pas d'en-tête (menu, logo) reconnu.");
    if (iDerniere >= 0 && !premierNiveau.slice(iDerniere + 1).some((e) => e.tagName === "FOOTER")) avertissements.push("Pas de <footer> après le conteneur .view : pas de pied de page reconnu.");
  }

  const tous = racine.querySelectorAll("*");
  const compter = (n: number, msg: string) => { if (n) avertissements.push(`${n} ${msg}`); };
  compter(racine.querySelectorAll("script").length, "<script> : retiré(s) à l'import, rien de ce qu'ils font ne fonctionnera.");
  compter(tous.filter((e) => Object.keys(e.attributes).some((a) => /^on/i.test(a))).length, "élément(s) avec onclick/on… : retirés à l'import.");
  compter(racine.querySelectorAll('link[rel="stylesheet"]').filter((l) => !/^https:\/\/fonts\.googleapis\.com/.test(l.getAttribute("href") || "")).length, "feuille(s) de style externe(s) hors Google Fonts : ignorée(s).");
  compter(racine.querySelectorAll("iframe, embed, object").length, "<iframe>/<embed>/<object> : contenu externe non modifiable dans le Constructeur.");
  compter(body.querySelectorAll("img").filter((i) => !/^(https:\/\/|data:)/.test(i.getAttribute("src") || "")).length, "image(s) sans URL https : introuvable(s) une fois importée(s).");
  compter(tous.filter((e) => /background(-image)?\s*:[^;]*url\(/i.test(e.getAttribute("style") || "")).length, "image(s) de fond en style : non remplaçable(s) comme une image.");
  compter(body.querySelectorAll("button").length, "<button> : pas de lien modifiable, préférer <a class=\"btn\">.");
  const mixtes = body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,a,li").filter((e: El) => e.children.length > 0 && !e.closest("svg") && e.childNodes.some((n) => n.nodeType === 3 && n.text.trim()));
  compter(mixtes.length, "texte(s) mêlé(s) à des balises : modifiable(s) seulement dans l'aperçu, pas dans le panneau.");
  compter(body.querySelectorAll(".logo").filter((l) => !l.hasAttribute("data-axso-nom")).length, "logo(s) .logo sans data-axso-nom : ne suivra pas le nom de la boutique.");
  const css = racine.querySelectorAll("style").map((s) => s.text).join("\n");
  if (!Object.values(VARIABLES_CHARTE).some((v) => css.includes(`${v}:`) || css.includes(`${v} :`)))
    avertissements.push("Aucune variable --couleur-fond / --couleur-texte / --couleur-accent : les couleurs du Constructeur ne s'appliqueront pas.");
  return { erreurs, avertissements };
}

/** Couleurs de la charte (variables imposées par le prompt) et variables à surcharger depuis le Constructeur. */
export function charteDepuisCss(css: string): { couleurs: Record<string, string>; mapping: Record<string, string> } {
  const couleurs: Record<string, string> = {};
  const mapping: Record<string, string> = {};
  for (const [cle, variable] of Object.entries(VARIABLES_CHARTE)) {
    const m = css.match(new RegExp(`${variable}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`));
    if (m) { couleurs[cle] = m[1].toLowerCase(); mapping[cle] = variable; }
  }
  return { couleurs, mapping };
}
