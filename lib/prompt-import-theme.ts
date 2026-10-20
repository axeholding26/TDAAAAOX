// Prompt standard d'importation de thème : le marchand le colle dans son IA
// (ChatGPT, Claude…) pour obtenir un fichier HTML que l'import
// (app/api/themes/importer → lib/theme-import-clone.ts) et le Constructeur
// (lib/decoupage-design.ts, builder/boutique/elements-dom.ts, lib/scope-css.ts,
// lib/liens-design.ts) savent manipuler. Il ne fixe QUE la structure technique :
// contenu, couleurs, polices et style restent libres. Chaque règle correspond à
// un comportement réel du code — à mettre à jour si ce code change.
// validerThemeImporte : même standard, vérifié sur un fichier avant l'envoi.
import { parse, type HTMLElement as El } from "node-html-parser";

export const PROMPT_IMPORT_THEME = `Crée la page d'accueil d'une boutique en ligne sous la forme d'UN SEUL fichier HTML autonome, destiné à être importé dans le Constructeur de la plateforme Axso. Le style, les couleurs, les polices, l'ambiance et les textes sont libres (je te les décris plus bas). Tu dois en revanche respecter STRICTEMENT les règles techniques suivantes, sinon le fichier ne sera pas modifiable :

1. FICHIER
- Un seul fichier .html complet (<!doctype html>, <head>, <body>), moins de 300 Ko.
- Le <title> du <head> = nom du thème.
- Tout le CSS dans une ou plusieurs balises <style> du <head>. Aucune autre feuille externe : seule Google Fonts est conservée (<link href="https://fonts.googleapis.com/..."> ou @import de Google Fonts).
- AUCUN JavaScript : pas de <script>, pas d'attributs onclick/onload/on…, pas de liens « javascript: ». Ils sont supprimés à l'import ; rien ne doit dépendre d'eux (pas de carrousel, d'onglets, d'accordéon ou de menu en JS — utilise du CSS pur si besoin).
- Pas d'<iframe>, <embed>, <object>, ni bibliothèque CDN (Tailwind, Bootstrap, jQuery…).
- Images : uniquement des URL https publiques complètes dans des balises <img src="https://..." alt="...">, jamais de fichiers locaux. Le marchand les remplacera ensuite.

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
- Exactement UN conteneur <div class="view active" id="view-home"> (pas <main>, pas d'autre conteneur « view »). Chacun de ses enfants directs devient une section que le marchand peut déplacer, masquer, dupliquer ou supprimer : une <section> par bloc (bannière, collection, avantages, témoignages, newsletter…).
- Tout ce qui est AVANT ce conteneur va dans l'en-tête, tout ce qui est APRÈS va dans le pied de page. Rien d'autre au premier niveau du <body> (pas de fenêtre modale, de toast ou de panneau caché).
- Donne à chaque section une classe parlante (hero, promo, features, collection…) et un titre <h1>/<h2>/<h3> : ils servent à nommer la section dans le Constructeur.
- Une seule balise <h1> (dans la bannière principale).

3. ÉLÉMENTS MODIFIABLES
- Chaque texte modifiable dans sa propre balise sans autre balise à l'intérieur : <h1>…<h6>, <p>, <span>, <li>, <a>, <small>, <strong>. Ne mélange pas texte et balises dans un même élément (pas de <br>, <em>, <span> au milieu d'un titre) : découpe plutôt en plusieurs éléments.
- Boutons d'action : des liens <a href="#" class="btn">Texte</a> (pas de <button>, qui n'a pas de lien modifiable).
- Images : des <img> (une image en background-image CSS n'est pas remplaçable par le marchand).
- Icônes : SVG en ligne autorisés.

4. EN-TÊTE ET LIENS
- Logo : <a class="logo" data-axso-nom href="#">Ma marque</a> — l'attribut data-axso-nom le remplace automatiquement par le nom et le logo de la boutique. Dans le pied de page : <span data-axso-nom>Ma marque</span> après le ©.
- Menu dans un <nav> à l'intérieur du <header>, liens <a href="#"> dont le texte visible est l'un de : « Accueil », « Boutique » (ou « Produits » / « Collection »), « À propos », « Contact ». Axso les relie aux vraies pages d'après ce texte ; « Mon compte » et le panier sont ajoutés par Axso.
- Recherche : un <a> SANS href dont le texte est exactement « Rechercher » ouvre la recherche de la boutique.
- Pied de page : uniquement des liens dont le texte contient « Contact », « À propos », « Produits »/« Boutique » ; les autres liens sans destination sont retirés. La phrase « Confidentialité — Conditions générales » devient automatiquement les liens légaux.
- Liens internes vers une section : href="#id-de-la-section" (conservés tels quels).

5. GRILLE DE PRODUITS (emplacement dynamique)
- Une seule grille : un conteneur avec une classe unique (ex. <div class="product-grid">) contenant 4 à 8 cartes de démonstration à la structure IDENTIQUE, chacune avec sa propre classe (ex. class="product-card").
- Chaque carte est un lien et ne contient que : une <img>, le nom du produit, le prix écrit chiffre d'abord (ex. « 12 000 FCFA »), et éventuellement un libellé de bouton « Commander ». Aucun autre texte (pas de description, ni de badge long) : la première carte sert de modèle, Axso y remplace l'image, le nom, le prix et le lien par les vrais produits.
  Exemple : <a href="#" class="product-card"><img src="https://..." alt="Produit"><h3>Nom du produit</h3><span class="price">12 000 FCFA</span></a>
- Pas d'autre emplacement dynamique (catégories, avis, panier…) : les collections sont ajoutées par Axso dans le pied de page ; le reste de la boutique (liste, fiche produit, panier, paiement) est fourni par Axso.

6. CSS
- Déclare la charte dans des variables sur :root (ex. --couleur-fond, --couleur-accent, --police-titre) et utilise-les partout.
- Le CSS est confiné à la page importée : :root, html et body sont rapportés au conteneur du thème. N'utilise pas de sélecteurs qui relient deux sections ou l'en-tête à une section (body > header, header + section, section:nth-child, ~), chaque section étant affichée séparément. Préfère des classes.
- Ne masque jamais .view (pas de .view{display:none}). Pas de !important (il bloquerait les réglages du Constructeur). Pas de position: fixed sur l'en-tête (Axso gère l'en-tête collant).
- Responsive obligatoire, mobile d'abord : @media (max-width: …) / (min-width: …) sur la largeur uniquement, unités relatives, images en max-width: 100%, pas de largeur fixe en px supérieure à 360px, menu lisible sur mobile sans JavaScript (liens qui passent à la ligne ou défilent horizontalement).

Réponds uniquement avec le code HTML complet du fichier, sans explication.

Description de ma boutique et du style souhaité :
[décris ici ta boutique, tes produits, tes couleurs, tes polices et l'ambiance voulue]`;

// ─── Vérification d'un fichier avant import ───────────────────────────────────

export interface RapportTheme {
  erreurs: string[]; // le fichier ne sera pas (bien) découpé en sections
  avertissements: string[]; // parties qui ne seront pas éditables ou seront retirées
}

const TAILLE_MAX = 300_000; // = app/api/themes/importer/route.ts

export function validerThemeImporte(html: string): RapportTheme {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  if (html.length > TAILLE_MAX) erreurs.push("Fichier de plus de 300 Ko : il sera refusé.");

  const racine = parse(html, { blockTextElements: { script: true, style: true } });
  const body = racine.querySelector("body") ?? racine;
  const premierNiveau = body.children;
  const vues = premierNiveau.filter((e) => e.classList.contains("view"));
  if (vues.length === 0) erreurs.push("Aucun conteneur <div class=\"view active\" id=\"view-home\"> au premier niveau du <body> : la page ne sera pas découpée en sections.");
  if (vues.length > 1) erreurs.push(`${vues.length} conteneurs .view : seul le premier est l'accueil, les suivants iront dans le pied de page.`);
  if (vues[0] && vues[0].tagName !== "DIV") avertissements.push(`Le conteneur .view est un <${vues[0].tagName.toLowerCase()}> : il deviendra un <div>, le CSS qui vise cette balise ne s'appliquera plus.`);
  const iVue = vues[0] ? premierNiveau.indexOf(vues[0]) : -1;
  if (iVue >= 0 && !premierNiveau.slice(0, iVue).some((e) => e.tagName === "HEADER")) avertissements.push("Pas de <header> avant le conteneur .view : pas d'en-tête (menu, logo) reconnu.");
  if (iVue >= 0 && !premierNiveau.slice(iVue + 1).some((e) => e.tagName === "FOOTER")) avertissements.push("Pas de <footer> après le conteneur .view : pas de pied de page reconnu.");

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
  return { erreurs, avertissements };
}
