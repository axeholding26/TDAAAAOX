// ─── Import de template — clone visuel exact ──────────────────────────────────
// Contrairement à l'extraction de style (couleurs/polices posées sur un thème
// premium existant), cette voie reproduit LITTÉRALEMENT le HTML/CSS envoyé
// par le marchand — même copywriting, même mise en page — en y branchant
// uniquement ce qu'il faut pour que ça fonctionne comme une vraie boutique
// AXSO : vrais produits (nom/prix/photo/lien), navigation vers le panier /
// la liste produits / le contact, aucune trace de script exécuté.
//
// Sécurité : tout <script> est retiré (jamais exécuté), tout attribut
// gestionnaire d'événement (onclick, onerror...) et tout lien
// "javascript:" sont neutralisés avant stockage. Le HTML obtenu est un
// simple bloc statique + CSS, injecté via dangerouslySetInnerHTML côté
// storefront (components/storefront/templates/ImportedLiteral*.tsx) — même
// niveau de confiance que customCss/trackingScripts déjà acceptés sur la
// boutique du marchand lui-même, en plus restrictif puisque aucun JS n'y
// tourne jamais.
//
// Étendu (AXSO Design + import manuel multi-pages) pour couvrir, en plus de
// l'accueil (construireTemplateBoutique) : la liste boutique — même grille
// que l'accueil (clonerGrilleProduits, factorisée) —, la fiche produit à un
// seul exemplaire (clonerFicheProduit), et l'« habillage » (chrome visuel
// seul, sans reproduire ni deviner la logique) du panier/checkout/
// confirmation (extraireChrome) — ces 3 dernières pages restent pilotées
// par les vrais composants AXSO (CartContent, CheckoutForm...) enchâssés
// dans le chrome cloné, jamais par une reconstruction du HTML/JS d'origine :
// trop risqué sur un flux qui touche à de l'argent réel.
import { parse, type HTMLElement as ParsedElement } from "node-html-parser";

export interface ProduitPourClone {
  id: string;
  nom: string;
  prixAffiche: string; // déjà formaté (formatMontant + prixClient) par l'appelant
  image: string | null;
  description?: string | null;
}

export interface CloneTemplateResult {
  html: string;
  css: string;
  conteneurTrouve: boolean;
}

const ATTRS_DANGEREUX = /^on/i;
const PROTOCOLE_DANGEREUX = /^\s*javascript:/i;
// Texte de bouton d'action (achat, ajout panier...) — jamais un candidat nom
// de produit : un CTA comme "Ajouter au panier" a souvent plus de lettres
// qu'un titre court, et gagnerait sinon à tort l'heuristique "texte non-
// numérique le plus long".
const REGEX_TEXTE_BOUTON_ACTION = /ajouter|acheter|commander|add to cart|buy|panier|cart/i;
// Élément (pas un commentaire HTML : node-html-parser ne les préserve pas de
// façon fiable au ré-encodage) — recherché tel quel comme simple chaîne dans
// le HTML final pour couper avant/après (voir ImportedLiteral*Shell.tsx).
export const MARQUEUR_SLOT = '<div data-axso-slot="1"></div>';
export const ATTR_AJOUTER_PANIER = "data-axso-add-to-cart";

function nettoyerElement(el: ParsedElement) {
  // Retire tout gestionnaire d'événement inline et tout lien javascript:.
  for (const attr of Object.keys(el.attributes || {})) {
    if (ATTRS_DANGEREUX.test(attr)) {
      el.removeAttribute(attr);
      continue;
    }
    if ((attr === "href" || attr === "src") && PROTOCOLE_DANGEREUX.test(el.getAttribute(attr) || "")) {
      el.removeAttribute(attr);
    }
  }
  for (const enfant of el.childNodes) {
    if ((enfant as ParsedElement).attributes !== undefined) nettoyerElement(enfant as ParsedElement);
  }
}

// Réécrit les liens de nav vers les vraies routes AXSO d'après le texte du
// lien (heuristique simple, sans dépendre de classes CSS spécifiques à un
// template précis — fonctionne sur n'importe quel fichier envoyé).
function reecrireLiensNav(root: ParsedElement, slug: string) {
  const regles: Array<{ motifs: RegExp; href: string }> = [
    { motifs: /panier|cart/i, href: `/${slug}/panier` },
    { motifs: /(?<!sous-)(?<!suivi )produits?|boutique|shop|collection/i, href: `/${slug}/produits` },
    { motifs: /contact/i, href: `/${slug}/contact` },
    { motifs: /(à propos|a propos|about)/i, href: `/${slug}/a-propos` },
    { motifs: /accueil|home/i, href: `/${slug}` },
  ];
  const prefixeProduitDeja = `/${slug}/produits/`;
  root.querySelectorAll("a").forEach((a) => {
    const texte = (a.textContent || "").trim();
    if (!texte) return;
    const hrefActuel = a.getAttribute("href") || "";
    // Ne touche jamais un lien déjà réécrit vers une fiche produit précise
    // par clonerGrilleProduits/lierProduitAuGabarit — sans cette garde, un
    // nom ou prix de produit contenant par coïncidence un mot-clé de nav
    // (ex. "Produit", "Collection été") écraserait le lien déjà correct.
    if (hrefActuel.startsWith(prefixeProduitDeja) && hrefActuel.length > prefixeProduitDeja.length) return;
    // Ne touche pas aux liens déjà explicitement fonctionnels (ancre interne
    // vers une section de la page, ex: #collection) sauf s'ils ne mènent
    // nulle part (# seul) — dans ce cas on tente de les rattacher.
    if (hrefActuel.startsWith("#") && hrefActuel.length > 1) return;
    for (const regle of regles) {
      if (regle.motifs.test(texte)) {
        a.setAttribute("href", regle.href);
        return;
      }
    }
  });
}

// Préparation commune à tous les points d'entrée : parse, retire les
// <script> (jamais exécutés), extrait puis retire les <style> (réinjectés à
// part par le composant de rendu).
function parserEtExtraireCss(htmlBrut: string): { root: ParsedElement; css: string } {
  const root = parse(htmlBrut, { blockTextElements: { script: false, style: true } });
  root.querySelectorAll("script").forEach((s) => s.remove());
  const css = root.querySelectorAll("style").map((s) => s.textContent).join("\n");
  root.querySelectorAll("style").forEach((s) => s.remove());
  return { root, css };
}

function finaliser(root: ParsedElement, slug: string): string {
  reecrireLiensNav(root, slug);
  nettoyerElement(root);
  const body = root.querySelector("body");
  return (body ? body.innerHTML : root.toString()).trim();
}

// Clone une grille de produits répétée (accueil ET liste boutique) — clone
// la première carte trouvée comme gabarit, puis en génère une par produit
// réel avec nom/prix/image/lien réécrits. Mute `root` en place ; retourne si
// un conteneur+carte ont effectivement été trouvés.
function clonerGrilleProduits(
  root: ParsedElement,
  selecteurConteneurProduits: string | null,
  selecteurCarteProduit: string | null,
  slug: string,
  produits: ProduitPourClone[]
): boolean {
  if (!selecteurConteneurProduits || !selecteurCarteProduit || produits.length === 0) return false;
  const conteneur = root.querySelector(selecteurConteneurProduits);
  if (!conteneur) return false;
  const cartes = conteneur.querySelectorAll(selecteurCarteProduit);
  if (cartes.length === 0) return false;

  const carteModele = cartes[0].outerHTML;
  const nouvellesCartes = produits.slice(0, 24).map((p) => {
    const carte = parse(carteModele).firstChild as ParsedElement;
    if (!carte) return carteModele;

    const img = carte.querySelector("img");
    if (img && p.image) img.setAttribute("src", p.image);

    // Heuristique nom/prix : le prix est le texte qui correspond au format
    // monétaire strict ; le nom est le texte non-numérique le plus long
    // parmi les descendants directs (titres, spans, paragraphes).
    const candidats = carte.querySelectorAll("*").filter((el) => {
      const t = (el.textContent || "").trim();
      return t.length > 0 && el.childNodes.every((c) => (c as any).nodeType === 3 || (c as any).nodeType === undefined || !(c as ParsedElement).tagName);
    });
    const candidatPrix = candidats.find((el) =>
      /^[\d][\d\s.,]*\s*(FCFA|CFA|XOF|XAF|F|€|EUR|\$|USD)?$/i.test((el.textContent || "").trim())
    );
    const candidatNom = candidats
      .filter((el) => el !== candidatPrix && !REGEX_TEXTE_BOUTON_ACTION.test((el.textContent || "").trim()))
      .sort((a, b) =>
        (b.textContent || "").replace(/[^a-zA-ZÀ-ÿ]/g, "").length -
        (a.textContent || "").replace(/[^a-zA-ZÀ-ÿ]/g, "").length
      )[0];

    if (candidatPrix) candidatPrix.set_content(p.prixAffiche);
    if (candidatNom) candidatNom.set_content(p.nom);

    // Le lien de la carte (elle-même ou son premier <a> parent/enfant) doit
    // pointer vers la vraie fiche produit.
    const lienCarte = carte.tagName === "A" ? carte : carte.querySelector("a");
    if (lienCarte) lienCarte.setAttribute("href", `/${slug}/produits/${p.id}`);

    return carte.outerHTML;
  });
  conteneur.set_content(nouvellesCartes.join(""));
  return true;
}

export function construireTemplateBoutique(params: {
  htmlBrut: string;
  selecteurConteneurProduits: string | null;
  selecteurCarteProduit: string | null;
  slug: string;
  produits: ProduitPourClone[];
}): CloneTemplateResult {
  const { htmlBrut, selecteurConteneurProduits, selecteurCarteProduit, slug, produits } = params;
  const { root, css } = parserEtExtraireCss(htmlBrut);
  const conteneurTrouve = clonerGrilleProduits(root, selecteurConteneurProduits, selecteurCarteProduit, slug, produits);
  const html = finaliser(root, slug);
  return { html, css, conteneurTrouve };
}

// Fiche produit (PDP) — clone la zone désignée UNE SEULE FOIS (pas de
// répétition) et y injecte le produit réel. Ne branche aucun handler de clic
// ici : le bouton d'achat retrouvé par son texte est juste marqué
// (ATTR_AJOUTER_PANIER) — c'est le composant client React qui lui attache le
// vrai onClick (useCartStore), jamais de JS cloné/exécuté.
//
// Contrairement à l'accueil/la liste boutique (figées avec un instantané de
// produits au moment de l'import — limitation acceptée, comme aujourd'hui),
// la fiche produit affiche un produit DIFFÉRENT à chaque URL : on ne peut
// donc pas figer une seule liaison au moment de l'import. Découpé en deux
// étapes : extraireGabaritFicheProduit (une fois, à l'import — isole juste
// la zone comme fragment réutilisable, sans produit) et lierProduitAuGabarit
// (à chaque requête storefront, avec le vrai produit demandé).

// Étape import — isole la zone fiche-produit comme fragment réutilisable
// (aucun produit encore lié). Stocké tel quel dans ThemeConfig.builderHtmlProduit.
export function extraireGabaritFicheProduit(params: {
  htmlBrut: string;
  selecteurZoneProduit: string | null;
}): { gabarit: string; css: string; zoneTrouvee: boolean } {
  const { htmlBrut, selecteurZoneProduit } = params;
  const { root, css } = parserEtExtraireCss(htmlBrut);
  const zone = selecteurZoneProduit ? root.querySelector(selecteurZoneProduit) : null;
  if (!zone) return { gabarit: "", css, zoneTrouvee: false };
  nettoyerElement(zone as ParsedElement);
  return { gabarit: zone.outerHTML.trim(), css, zoneTrouvee: true };
}

// Étape requête — reçoit le petit fragment déjà isolé (pas la page entière)
// et y lie le produit réellement demandé. Rapide (fragment isolé, pas de
// sélecteur à chercher dans tout le document) : appelable à chaque rendu
// SSR de la fiche produit sans coût d'appel IA.
export function lierProduitAuGabarit(gabarit: string, slug: string, produit: ProduitPourClone): string {
  if (!gabarit) return "";
  const zone = parse(gabarit).firstChild as ParsedElement;
  if (!zone) return gabarit;

  const img = zone.querySelector("img");
  if (img && produit.image) img.setAttribute("src", produit.image);

  const candidats = zone.querySelectorAll("*").filter((el) => {
    const t = (el.textContent || "").trim();
    return t.length > 0 && el.childNodes.every((c) => (c as any).nodeType === 3 || (c as any).nodeType === undefined || !(c as ParsedElement).tagName);
  });
  const candidatPrix = candidats.find((el) =>
    /^[\d][\d\s.,]*\s*(FCFA|CFA|XOF|XAF|F|€|EUR|\$|USD)?$/i.test((el.textContent || "").trim())
  );
  const candidatNom = candidats
    .filter((el) => el !== candidatPrix && !REGEX_TEXTE_BOUTON_ACTION.test((el.textContent || "").trim()))
    .sort((a, b) =>
      (b.textContent || "").replace(/[^a-zA-ZÀ-ÿ]/g, "").length -
      (a.textContent || "").replace(/[^a-zA-ZÀ-ÿ]/g, "").length
    )[0];
  if (candidatPrix) candidatPrix.set_content(produit.prixAffiche);
  if (candidatNom) candidatNom.set_content(produit.nom);

  // Bouton d'achat retrouvé par texte visible — jamais par classe (trop
  // spécifique à un template précis).
  const boutonAchat = zone.querySelectorAll("button, a").find((el) =>
    REGEX_TEXTE_BOUTON_ACTION.test((el.textContent || "").trim())
  );
  boutonAchat?.setAttribute(ATTR_AJOUTER_PANIER, "1");

  reecrireLiensNav(zone, slug);
  return zone.outerHTML.trim();
}

// Panier / commande / confirmation — n'essaie jamais de recloner ni de
// rebrancher la logique JS d'origine (trop risqué sur un flux qui touche à
// de l'argent réel). Garde tout le chrome visuel de la page, remplace
// uniquement la zone désignée par un marqueur : le composant de rendu y
// enchâsse le vrai composant AXSO (CartContent/CheckoutForm/confirmation).
export function extraireChrome(params: {
  htmlBrut: string;
  selecteurZoneRemplacement: string | null;
  slug: string;
}): CloneTemplateResult {
  const { htmlBrut, selecteurZoneRemplacement, slug } = params;
  const { root, css } = parserEtExtraireCss(htmlBrut);

  let zoneTrouvee = false;
  const zone = selecteurZoneRemplacement ? root.querySelector(selecteurZoneRemplacement) : null;
  if (zone) {
    zoneTrouvee = true;
    zone.set_content(MARQUEUR_SLOT);
  }

  const html = finaliser(root, slug);
  return { html, css, conteneurTrouve: zoneTrouvee };
}

// ─── Bibliothèque AXSO Design (Templates/*.html) ──────────────────────────────
// Ces fichiers suivent une convention figée par le prompt système qui les a
// produits — mêmes ids fonctionnels quel que soit le design visuel :
// #view-home/#view-boutique/#view-produit/#view-panier/#view-commande/
// #view-confirmation, #homeGrid/#plpGrid (grilles vides, remplies en JS par
// le fichier d'origine — jamais exécuté), #pdpName/#pdpDesc/#pdpPriceRow/
// #pdpAddBtn (fiche produit), navigation via onclick="go('page')" plutôt que
// des href. Ça permet un branchement 100% déterministe par id — SEULE la
// carte produit (visuelle, bespoke par design, générée par une fonction JS
// jamais exécutée) demande une extraction ponctuelle par IA, une fois par
// fichier (lib/gemini.ts::extraireGabaritsLibrairie), jamais par boutique.
function echapperHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function remplacerTokensCarte(gabarit: string, p: ProduitPourClone, slug: string): string {
  return gabarit
    .replaceAll("{{ID}}", echapperHtml(p.id))
    .replaceAll("{{NOM}}", echapperHtml(p.nom))
    .replaceAll("{{PRIX}}", echapperHtml(p.prixAffiche))
    .replaceAll("{{IMAGE}}", echapperHtml(p.image || ""))
    .replaceAll("{{LIEN}}", echapperHtml(`/${slug}/produits/${p.id}`));
}

// Réécrit la navigation SPA (onclick="go('boutique')") vers de vraies routes
// AXSO — plus fiable que reecrireLiensNav (basée sur le texte du lien) sur
// ces fichiers puisque l'argument de go() est explicite et sans ambiguïté.
function reecrireLiensGo(root: ParsedElement, slug: string) {
  const cibles: Record<string, string> = {
    home: `/${slug}`,
    boutique: `/${slug}/produits`,
    panier: `/${slug}/panier`,
    commande: `/${slug}/checkout`,
  };
  root.querySelectorAll("[onclick]").forEach((el) => {
    const onclick = el.getAttribute("onclick") || "";
    const m = onclick.match(/^go\('(\w+)'\)$/);
    if (!m) return;
    const cible = cibles[m[1]];
    if (cible) el.setAttribute("href", cible);
  });
}

export interface VuesLibrairie {
  chromeAvant: string; // défs SVG partagées + en-tête/nav (une fois, avant la 1ère vue)
  chromeApres: string; // pied de page + reste (une fois, après la dernière vue)
  home: string;
  boutique: string;
  produit: string; // gabarit NON lié à un produit — voir lierProduitLibrairieAuGabarit
  panier: string; // déjà réduit à un seul marqueur d'enchâssement (MARQUEUR_SLOT)
  commande: string;
  confirmation: string;
  css: string;
}

// Découpe un fichier de la bibliothèque en chrome partagé + 6 vues, réécrit
// la nav SPA vers de vraies routes, assainit, et force chaque vue visible
// individuellement (le CSS d'origine masque .view par défaut et ne montre
// que .view.active — chaque route AXSO ne rend qu'une seule vue à la fois).
// Retourne null si le fichier ne suit pas la convention à 6 vues attendue.
export function extraireVuesLibrairie(params: { htmlBrut: string; slug: string }): VuesLibrairie | null {
  const { htmlBrut, slug } = params;
  const { root, css } = parserEtExtraireCss(htmlBrut);
  const body = root.querySelector("body");
  if (!body) return null;

  const enfants = body.childNodes.filter((n) => (n as ParsedElement).tagName) as ParsedElement[];
  const idxVues = enfants.map((el, i) => (el.classList?.contains("view") ? i : -1)).filter((i) => i >= 0);
  if (idxVues.length === 0) return null;

  const ids = ["home", "boutique", "produit", "panier", "commande", "confirmation"] as const;
  const vues: Partial<Record<(typeof ids)[number], ParsedElement>> = {};
  for (const id of ids) {
    const el = root.querySelector(`#view-${id}`);
    if (el) vues[id] = el;
  }
  if (ids.some((id) => !vues[id])) return null;

  reecrireLiensGo(root, slug);
  nettoyerElement(root);
  for (const id of ids) vues[id]!.setAttribute("class", "view active");

  // Pour panier/commande/confirmation : le contenu propre à la vue (faux
  // panier/formulaire/récap JS) est entièrement remplacé par le vrai
  // composant AXSO (CartContent/CheckoutForm/confirmation) — voir
  // ImportedLiteral*Shell.tsx. On ne garde que l'enveloppe .view (padding/
  // largeur cohérents avec le reste du design).
  vues.panier!.set_content(MARQUEUR_SLOT);
  vues.commande!.set_content(MARQUEUR_SLOT);
  vues.confirmation!.set_content(MARQUEUR_SLOT);

  const premier = idxVues[0];
  const dernier = idxVues[idxVues.length - 1];
  const chromeAvant = enfants.slice(0, premier).map((el) => el.outerHTML).join("");
  const chromeApres = enfants.slice(dernier + 1).map((el) => el.outerHTML).join("");

  return {
    chromeAvant,
    chromeApres,
    home: vues.home!.outerHTML,
    boutique: vues.boutique!.outerHTML,
    produit: vues.produit!.outerHTML,
    panier: vues.panier!.outerHTML,
    commande: vues.commande!.outerHTML,
    confirmation: vues.confirmation!.outerHTML,
    css,
  };
}

// Injecte une grille de produits réels dans le conteneur connu (#homeGrid ou
// #plpGrid, vide dans le HTML d'origine — rempli en JS par le fichier
// source, jamais exécuté ici) à partir du gabarit de carte tokenisé
// ({{ID}}/{{NOM}}/{{PRIX}}/{{IMAGE}}/{{LIEN}}, extrait une fois par
// lib/gemini.ts::extraireGabaritsLibrairie). `vueHtml` doit être une des
// vues renvoyées par extraireVuesLibrairie (déjà assainie).
export function injecterGrilleLibrairie(params: {
  vueHtml: string;
  idConteneur: "homeGrid" | "plpGrid";
  carteTemplate: string | null;
  produits: ProduitPourClone[];
  slug: string;
}): string {
  const { vueHtml, idConteneur, carteTemplate, produits, slug } = params;
  if (!carteTemplate || produits.length === 0) return vueHtml;
  const racine = parse(vueHtml).firstChild as ParsedElement;
  const conteneur = racine?.querySelector(`#${idConteneur}`);
  if (!racine || !conteneur) return vueHtml;
  const cartesHtml = produits.slice(0, 24).map((p) => remplacerTokensCarte(carteTemplate, p, slug)).join("");
  conteneur.set_content(cartesHtml);
  nettoyerElement(racine); // défense en profondeur si le gabarit IA a laissé un attribut indésirable
  return racine.outerHTML;
}

// Lie le produit réellement demandé au gabarit de fiche produit — appelé à
// CHAQUE requête storefront (contrairement à l'accueil/la liste boutique,
// une fiche produit affiche un produit différent par URL, impossible à
// figer une fois pour toutes). 100% par id (#pdpName/#pdpDesc/#pdpPriceRow/
// #pdpAddBtn), aucune heuristique de texte nécessaire — la convention de la
// bibliothèque garantit ces ids. `selecteurVisuelPdp` (trouvé une fois par
// IA, voir extraireGabaritsLibrairie) désigne le conteneur du visuel
// principal, remplacé par une vraie photo produit.
export function lierProduitLibrairieAuGabarit(params: {
  gabaritPage: string;
  selecteurVisuelPdp: string | null;
  produit: ProduitPourClone;
}): string {
  const { gabaritPage, selecteurVisuelPdp, produit } = params;
  // `gabaritPage` (builderHtmlProduit) est chromeAvant+vue+chromeApres, donc
  // PLUSIEURS éléments racines — un simple `.firstChild` ne capturerait que
  // le premier fragment de chrome (ex. les <defs> SVG) et perdrait tout le
  // reste. On enveloppe dans un conteneur de travail avant de parser.
  const racine = parse(`<div>${gabaritPage}</div>`).firstChild as ParsedElement;
  if (!racine) return gabaritPage;

  racine.querySelector("#pdpName")?.set_content(echapperHtml(produit.nom));
  racine.querySelector("#pdpDesc")?.set_content(echapperHtml(produit.description || ""));
  racine.querySelector("#pdpPriceRow")?.set_content(echapperHtml(produit.prixAffiche));

  const visuel = selecteurVisuelPdp ? racine.querySelector(selecteurVisuelPdp) : null;
  if (visuel && produit.image) {
    visuel.set_content(`<img src="${echapperHtml(produit.image)}" alt="${echapperHtml(produit.nom)}" style="width:100%;height:100%;object-fit:cover;">`);
  }

  racine.querySelector("#pdpAddBtn")?.setAttribute(ATTR_AJOUTER_PANIER, "1");

  nettoyerElement(racine);
  return racine.innerHTML;
}
