
// ─── Couleurs ────────────────────────────────────────────────────────────────
export interface ThemeColors {
  fond: string;
  accent: string;
  accentSecondaire?: string;
  texte: string;
  texteMuted?: string;
  surface: string;
  bordure?: string;
}

// ─── Typographie ─────────────────────────────────────────────────────────────
export interface ThemeFonts {
  titre: string;
  corps: string;
  poidsTitre?: string;
  tailleBase?: string;
  lettreEspacement?: string;
  hauteurLigne?: string;
  transformTitre?: string;
}

// ─── Mise en page ────────────────────────────────────────────────────────────
export interface ThemeLayout {
  largeurContainer?: string;
  paddingSection?: string;
  colonnesProduits?: number;
  colonnesMobile?: number;
  styleCarte?: string;
  ombre?: string;
}

// ─── Boutons ─────────────────────────────────────────────────────────────────
export interface ThemeBoutons {
  style?: string;
  taille?: string;
  hover?: string;
  bordureWidth?: string;
}

// ─── Navigation ──────────────────────────────────────────────────────────────
export interface ThemeNavigationCfg {
  type?: "classic" | "centered" | "floating" | "minimal" | "mega" | "transparent-scroll";
  style?: "light" | "dark" | "glass" | "transparent";
  sticky?: boolean;
  hauteur?: string;
  showSearch?: boolean;
  showWishlist?: boolean;
}

// ─── Animations ──────────────────────────────────────────────────────────────
export interface ThemeAnimations {
  global: "none" | "fade-in" | "slide-up" | "slide-left" | "zoom-in" | "flip" | "blur-in";
  vitesse: "fast" | "normal" | "slow";
  parallax: boolean;
  smoothScroll: boolean;
  stagger: boolean;
  preset?: "luxury" | "dynamic" | "elegant" | "playful" | "none";
  sectionAnimations: Record<string, string>;
}

// ─── Sections custom (bibliothèque) ──────────────────────────────────────────
export interface CustomSection {
  id: string;
  type: "features" | "stats" | "countdown" | "brands" | "video" | "gallery" | "social-proof" | "spacer" | "richtext" | "cta-band" | "tabs" | "columns";
  actif: boolean;
  label: string;
  animation?: string;
  ordre: number;
  config: Record<string, any>;
}

// ─── Sous-sections (blocs) — ajoutables dans n'importe quelle section ────────
// Permet d'imbriquer du contenu de forme libre à l'intérieur de toute section
// (built-in ou custom, y compris onglets et colonnes), façon Shopify.
export interface SousBloc {
  id: string;
  type: "photos" | "temoignage" | "promo" | "texte" | "video" | "stats" | "features" | "countdown" | "logos" | "confiance" | "liste" | "spacer";
  config: Record<string, any>;
}

// ─── Sections built-in ───────────────────────────────────────────────────────
export interface ThemeSectionAnnonce {
  actif: boolean;
  texte: string;
  couleurFond: string;
  couleurTexte: string;
  defilant?: boolean;
}

export interface ThemeSectionHero {
  actif: boolean;
  style: "centered" | "split" | "fullscreen" | "minimal" | "video" | "slideshow" | "magazine";
  titre: string;
  sousTitre: string;
  ctaTexte: string;
  ctaLien: string;
  overlay: number;
  hauteur?: "50vh" | "60vh" | "70vh" | "80vh" | "100vh";
  videoUrl?: string;
  slideshowImages?: string[];
  slideshowInterval?: number;
  textPosition?: "left" | "center" | "right";
  showSecondCta?: boolean;
  secondCtaTexte?: string;
  secondCtaLien?: string;
  badgeTexte?: string;
  particles?: boolean;
  animation?: string;
}

export interface ThemeSectionVedettes {
  actif: boolean;
  titre: string;
  nombre: number;
  triPar: "ventes" | "recent" | "featured";
  layout?: "grid" | "carousel" | "masonry";
  colonnes?: number;
  showRatings?: boolean;
  showSoldCount?: boolean;
}

export interface ThemeSectionCollections {
  actif: boolean;
  titre: string;
  layout?: "grid" | "masonry" | "carousel" | "cards";
}

export interface ThemeSectionPromo {
  actif: boolean;
  titre: string;
  texte: string;
  ctaTexte: string;
  style?: "gradient" | "solid" | "image" | "split";
  imageUrl?: string;
  bgColor?: string;
}

export interface ThemeSectionAvis {
  actif: boolean;
  titre: string;
  layout?: "cards" | "carousel" | "list" | "masonry";
  showPhotos?: boolean;
}

export interface ThemeSectionNewsletter {
  actif: boolean;
  titre: string;
  texte: string;
  placeholder: string;
  ctaTexte: string;
  style?: "centered" | "split" | "banner";
  bgColor?: string;
}

export interface ThemeSectionConfiance {
  actif: boolean;
  layout?: "icons" | "cards" | "bar" | "marquee";
  items: Array<{ icone: string; titre: string; texte: string }>;
}

export interface ThemeSectionAbout {
  actif: boolean;
  titre: string;
  texte: string;
  layout: "image-left" | "image-right" | "centered" | "fullwidth";
  imageUrl?: string;
  badgeTexte?: string;
  stats?: Array<{ valeur: string; label: string }>;
}

export interface ThemeSectionFaq {
  actif: boolean;
  titre: string;
  layout?: "accordion" | "grid" | "columns";
  items: Array<{ question: string; reponse: string }>;
}

export interface ThemeSections {
  annonce: ThemeSectionAnnonce;
  hero: ThemeSectionHero;
  vedettes: ThemeSectionVedettes;
  collections: ThemeSectionCollections;
  promo: ThemeSectionPromo;
  avis: ThemeSectionAvis;
  newsletter: ThemeSectionNewsletter;
  confiance?: ThemeSectionConfiance;
  about?: ThemeSectionAbout;
  faq?: ThemeSectionFaq;
}

// ─── Page produit — sections style Shopify ───────────────────────────────────
export type ProductPageSectionType =
  | "gallery" | "info" | "variants" | "quantity" | "trust" | "description" | "reviews" | "similar"
  | "richtext" | "banner" | "video" | "faq" | "specs" | "countdown" | "social";

// Style personnalisable par section de fiche produit (fond, couleurs, espacement, largeur)
export interface ProductPageSectionStyle {
  bgColor?: string;
  textColor?: string;
  paddingY?: "none" | "sm" | "md" | "lg" | "xl";
  maxWidth?: "full" | "medium" | "narrow";
  align?: "left" | "center";
}

export interface ProductPageSection {
  id: string;
  type: ProductPageSectionType;
  actif: boolean;
  config: Record<string, any>;
  style?: ProductPageSectionStyle;
}

export interface ThemeProductPageConfig {
  layout?: "amazon" | "classic" | "minimal" | "fullwidth";
  sections?: ProductPageSection[];
}

// ─── Pages À propos & Contact — même patron que la fiche produit ci-dessus :
// une liste de sections indépendante de la home, composée avec la même
// bibliothèque CustomSection (richtext, stats, galerie...).
export interface ThemeAboutPageConfig {
  actif: boolean;
  sections: CustomSection[];
}

export interface ThemeContactPageConfig {
  actif: boolean;
  intro?: string;
  afficherFormulaire: boolean;
  sections?: CustomSection[];
}

export const DEFAULT_PRODUCT_SECTIONS: ProductPageSection[] = [
  { id: "gallery",     type: "gallery",     actif: true, config: { style: "vertical-thumbs", zoom: true, sticky: true } },
  { id: "info",        type: "info",        actif: true, config: { breadcrumbs: true, badges: true, stock: true } },
  { id: "variants",    type: "variants",    actif: true, config: {} },
  { id: "quantity",    type: "quantity",    actif: true, config: {} },
  { id: "trust",       type: "trust",       actif: true, config: {} },
  { id: "description", type: "description", actif: true, config: { ai: true } },
  { id: "reviews",     type: "reviews",     actif: true, config: {} },
  { id: "similar",     type: "similar",     actif: true, config: { count: 4, titre: "Vous aimerez aussi" } },
];

// ─── Constructeur libre — arbre de blocs (Elementor-like) ─────────────────────
// Additif : n'existe que si le marchand a activé le "Constructeur libre",
// sinon `undefined` pour 100% des boutiques (rendu classique inchangé — voir
// dispatch dans app/(storefront)/[slug]/page.tsx). Contrairement à
// `sections`/`customSections` (schéma fixe, une seule liste plate), ceci est
// un vrai arbre : section → ligne(s) → colonne(s) → widget(s), déposable et
// réordonnable à n'importe quel endroit via glisser-déposer (dnd-kit).
export type BlockNodeType =
  | "section" | "row" | "column" // conteneurs structurels
  | "features" | "stats" | "countdown" | "brands" | "video" | "gallery"
  | "social-proof" | "spacer" | "richtext" | "cta-band" | "tabs" | "columns" // réutilisés de CustomSection (voir components/storefront/blocks/registry.tsx)
  | "heading" | "text" | "image" | "button" | "products"; // atomes (vague 2)

export interface BlockStyleOverrides {
  spacing?: { pt?: string; pb?: string; pl?: string; pr?: string; mt?: string; mb?: string };
  background?: { color?: string; image?: string; gradient?: string };
  typography?: { color?: string; taille?: string; poids?: string; align?: "left" | "center" | "right" };
  border?: { radius?: string; width?: string; color?: string };
  visibility?: { desktop?: boolean; tablet?: boolean; mobile?: boolean };
  width?: string;
  customClass?: string;
  // Vague 3 — surcharges par appareil (branché sur le sélecteur Device déjà
  // existant du constructeur). Chaque appareil ne redéfinit que les champs
  // qu'il change ; tout champ absent hérite de la valeur desktop ci-dessus.
  // Appliqué via de vraies media queries CSS (voir styleUtils.ts) — jamais
  // en JS, un style inline ne peut pas réagir à la taille d'écran.
  responsive?: {
    tablet?: Omit<BlockStyleOverrides, "responsive" | "customClass" | "visibility">;
    mobile?: Omit<BlockStyleOverrides, "responsive" | "customClass" | "visibility">;
  };
}

export interface BlockNode {
  id: string; // stable, sert aussi de data-axs-id pour la sélection visuelle
  type: BlockNodeType;
  actif?: boolean;
  children?: BlockNode[]; // uniquement pour section/row/column
  config?: Record<string, any>; // même forme que CustomSection.config pour les 12 types réutilisés
  style?: BlockStyleOverrides;
}

// "terre-et-or" est désormais le seul socle interne — piloté par
// `sections`/JSX partagé (voir DEFAULTS plus bas), jamais proposé au
// marchand comme un thème parmi d'autres (la bibliothèque AXSO Design,
// lib/axso-design-library.ts, est la seule gamme visible). Seul ce socle
// peut activer le Constructeur libre.
export const THEMES_LIBRE_ELIGIBLES = ["terre-et-or"] as const;

// ─── Config principale ───────────────────────────────────────────────────────
export interface ThemeConfig {
  colors: ThemeColors;
  fonts: ThemeFonts;
  radius: string;
  layout?: ThemeLayout;
  boutons?: ThemeBoutons;
  navigationStyle?: ThemeNavigationCfg;
  animations?: ThemeAnimations;
  customSections?: CustomSection[];
  sectionOrder?: string[];
  // Sous-sections personnalisées ajoutées dans n'importe quelle section (built-in ou custom),
  // indexées par id de section. Permet d'ajouter photos/témoignages/promo/texte dans toute section.
  sectionSousBlocs?: Record<string, SousBloc[]>;
  customCss?: string;
  sections: ThemeSections;
  productPage?: ThemeProductPageConfig;
  aboutPage?: ThemeAboutPageConfig;
  contactPage?: ThemeContactPageConfig;
  builderHtml?: string;
  builderCss?: string;
  builderTree?: BlockNode[];
  // Clone/habillage multi-pages (AXSO Design + import manuel étendu) — même
  // convention que builderHtml (chaîne brute, jamais exécutée) mais une par
  // page storefront. builderCss ci-dessus reste partagé entre toutes (un
  // seul fichier source, un seul <style>). Voir lib/theme-import-clone.ts.
  builderHtmlProduits?: string; // liste boutique (PLP)
  builderHtmlProduit?: string; // fiche produit (PDP) — gabarit à un seul produit
  builderHtmlPanierChrome?: string; // habillage panier — enchâsse <CartContent>
  builderHtmlCheckoutChrome?: string; // habillage commande — enchâsse <CheckoutForm>
  builderHtmlConfirmationChrome?: string; // habillage confirmation
  // Métadonnée nécessaire pour lier une fiche produit à chaque requête
  // (lierProduitLibrairieAuGabarit) — le sélecteur du visuel PDP est propre
  // au design d'origine (lib/axso-design-library.ts), pas au produit.
  axsoDesignSelecteurVisuelPdp?: string;
  // Mapping couleurs ThemeConfig → noms de variables CSS du template HTML.
  // Calculé une fois à la provision (lib/axso-design-library.ts) et stocké
  // dans Theme.config pour que ImportedLiteralHomePage puisse injecter des
  // surcharges précises quand le marchand modifie ses couleurs via le builder.
  axsoDesignCssVarMapping?: Record<string, string>;
}

// ─── Defaults ────────────────────────────────────────────────────────────────
const DEFAULT_CONFIANCE: ThemeSectionConfiance = {
  actif: true,
  layout: "marquee",
  items: [
    { icone: "📦", titre: "Livraison rapide", texte: "Expédiée sous 24h-48h" },
    { icone: "🔒", titre: "Paiement sécurisé", texte: "Transactions protégées" },
    { icone: "↩️", titre: "Retours faciles", texte: "Sous 14 jours" },
    { icone: "💬", titre: "Support dédié", texte: "Réponse rapide garantie" },
  ],
};

const DEFAULT_ABOUT: ThemeSectionAbout = {
  actif: false,
  titre: "Notre histoire",
  texte: "Fondée avec passion, notre boutique est née d'un désir profond de vous proposer des produits authentiques et de qualité exceptionnelle. Chaque article est sélectionné avec soin pour refléter nos valeurs d'excellence.",
  layout: "image-right",
  stats: [
    { valeur: "1000+", label: "Clients satisfaits" },
    { valeur: "500+", label: "Produits" },
    { valeur: "5★", label: "Note moyenne" },
  ],
};

const DEFAULT_FAQ: ThemeSectionFaq = {
  actif: false,
  titre: "Questions fréquentes",
  layout: "accordion",
  items: [
    { question: "Quels sont vos délais de livraison ?", reponse: "Nous livrons sous 24 à 48h pour les commandes passées avant 14h." },
    { question: "Comment retourner un article ?", reponse: "Vous disposez de 14 jours pour retourner un article. Contactez-nous par WhatsApp pour initier le retour." },
    { question: "Quels modes de paiement acceptez-vous ?", reponse: "Nous acceptons Orange Money, Wave, Moov Money et les virements bancaires." },
  ],
};

// Variété sobre par défaut, section par section — le système ScrollReveal
// est déjà câblé partout (voir components/storefront/ScrollReveal.tsx),
// il ne manquait que ces préréglages pour qu'une boutique neuve soit animée
// de façon professionnelle sans que le marchand ait à toucher au builder.
const DEFAULT_SECTION_ANIMATIONS: Record<string, string> = {
  hero: "fade-in",
  confiance: "fade-in",
  vedettes: "slide-up",
  collections: "zoom-in",
  about: "slide-left",
  promo: "fade-in",
  faq: "fade-in",
  avis: "slide-up",
  newsletter: "fade-in",
};

const DEFAULT_ANIMATIONS: ThemeAnimations = {
  global: "slide-up",
  vitesse: "normal",
  parallax: false,
  smoothScroll: true,
  stagger: true,
  preset: "elegant",
  sectionAnimations: { ...DEFAULT_SECTION_ANIMATIONS },
};

const DEFAULT_NAV: ThemeNavigationCfg = {
  type: "classic",
  style: "light",
  sticky: true,
  hauteur: "64px",
  showSearch: true,
  showWishlist: false,
};

const DEFAULT_BOUTONS: ThemeBoutons = {
  style: "filled",
  taille: "md",
  hover: "scale",
  bordureWidth: "2px",
};

const DEFAULT_LAYOUT: ThemeLayout = {
  largeurContainer: "1280px",
  paddingSection: "lg",
  colonnesProduits: 4,
  colonnesMobile: 2,
  styleCarte: "shadow",
  ombre: "md",
};

// Un seul socle structurel interne — jamais exposé au marchand comme un
// thème parmi d'autres (voir THEMES_LIBRE_ELIGIBLES ci-dessus). Nécessaire
// pour que resolveThemeConfig/resolveThemeConfigAsync gardent toujours une
// forme ThemeConfig valide, y compris si un Theme venait à manquer, ou
// (cas réel) si le provisionnement automatique depuis la bibliothèque AXSO
// Design échouait — voir lib/axso-design-library.ts::provisionerThemeInitial
// et le commentaire équivalent dans app/(storefront)/[slug]/page.tsx.
const DEFAULTS: Record<string, ThemeConfig> = {
  "terre-et-or": {
    colors: { fond: "#fff8f0", accent: "#c2622d", texte: "#2c1503", surface: "#fef3e8", texteMuted: "#8a6248", bordure: "#f0e0d0" },
    fonts: { titre: "playfair", corps: "inter", poidsTitre: "700" },
    radius: "12px",
    layout: { ...DEFAULT_LAYOUT, styleCarte: "bordered" },
    boutons: { ...DEFAULT_BOUTONS, hover: "darken" },
    navigationStyle: { ...DEFAULT_NAV, style: "light" },
    animations: { ...DEFAULT_ANIMATIONS, preset: "luxury" },
    sections: {
      annonce: { actif: true, texte: "🌿 Produits naturels & authentiques — Livraison soignée sous 48h — Satisfaction garantie", couleurFond: "#c2622d", couleurTexte: "#ffffff" },
      hero: { actif: true, style: "split", titre: "L'authenticité à l'état pur", sousTitre: "Des produits sélectionnés avec soin, pour une vie plus belle et naturelle", ctaTexte: "Découvrir", ctaLien: "produits", overlay: 30, hauteur: "80vh", textPosition: "left" },
      confiance: { ...DEFAULT_CONFIANCE },
      vedettes: { actif: true, titre: "Nos Coups de Cœur", nombre: 8, triPar: "ventes", colonnes: 4, layout: "grid" },
      collections: { actif: true, titre: "Explorer nos Collections", layout: "grid" },
      about: { ...DEFAULT_ABOUT, actif: true },
      promo: { actif: true, titre: "Artisanat local", texte: "Chaque produit raconte une histoire unique de savoir-faire et de passion", ctaTexte: "Découvrir l'histoire", style: "split" },
      faq: { ...DEFAULT_FAQ },
      avis: { actif: true, titre: "Ils nous font confiance", layout: "cards" },
      newsletter: { actif: false, titre: "Restez connecté", texte: "Recevez nos actualités et offres spéciales directement dans votre boîte mail", placeholder: "votre@email.com", ctaTexte: "S'abonner", style: "centered" },
    },
  },
};

// Fusionne une couche de surcharges (overrides — venant soit d'un thème custom
// stocké en DB, soit des réglages live du tenant sauvegardés par le builder)
// par-dessus une base ThemeConfig déjà complète. Utilisé pour empiler
// plusieurs couches : défauts intégrés → thème custom → édits du builder.
export function mergeThemeConfig(base: ThemeConfig, overrides: Record<string, any>): ThemeConfig {
  return {
    ...base,
    colors: { ...base.colors, ...(overrides.colors || {}) },
    fonts: { ...base.fonts, ...(overrides.fonts || {}) },
    radius: overrides.radius || base.radius,
    layout: { ...base.layout, ...(overrides.layout || {}) },
    boutons: { ...base.boutons, ...(overrides.boutons || {}) },
    navigationStyle: { ...base.navigationStyle, ...(overrides.navigationStyle || {}) },
    animations: { ...base.animations, ...(overrides.animations || {}), sectionAnimations: { ...(base.animations?.sectionAnimations || {}), ...(overrides.animations?.sectionAnimations || {}) } },
    customSections: overrides.customSections ?? base.customSections,
    sectionOrder: overrides.sectionOrder ?? base.sectionOrder,
    sectionSousBlocs: overrides.sectionSousBlocs ?? base.sectionSousBlocs ?? {},
    customCss: overrides.customCss ?? base.customCss,
    sections: {
      annonce: { ...base.sections.annonce, ...(overrides.sections?.annonce || {}) },
      hero: { ...base.sections.hero, ...(overrides.sections?.hero || {}) },
      vedettes: { ...base.sections.vedettes, ...(overrides.sections?.vedettes || {}) },
      collections: { ...base.sections.collections, ...(overrides.sections?.collections || {}) },
      promo: { ...base.sections.promo, ...(overrides.sections?.promo || {}) },
      avis: { ...base.sections.avis, ...(overrides.sections?.avis || {}) },
      newsletter: { ...base.sections.newsletter, ...(overrides.sections?.newsletter || {}) },
      confiance: overrides.sections?.confiance ?? base.sections.confiance ?? DEFAULT_CONFIANCE,
      about: overrides.sections?.about ?? base.sections.about ?? DEFAULT_ABOUT,
      faq: overrides.sections?.faq ?? base.sections.faq ?? DEFAULT_FAQ,
    },
    productPage: overrides.productPage ?? base.productPage,
    aboutPage: overrides.aboutPage ?? base.aboutPage,
    contactPage: overrides.contactPage ?? base.contactPage,
    builderHtml: overrides.builderHtml ?? base.builderHtml,
    builderCss: overrides.builderCss ?? base.builderCss,
    builderTree: overrides.builderTree ?? base.builderTree,
    builderHtmlProduits: overrides.builderHtmlProduits ?? base.builderHtmlProduits,
    builderHtmlProduit: overrides.builderHtmlProduit ?? base.builderHtmlProduit,
    builderHtmlPanierChrome: overrides.builderHtmlPanierChrome ?? base.builderHtmlPanierChrome,
    builderHtmlCheckoutChrome: overrides.builderHtmlCheckoutChrome ?? base.builderHtmlCheckoutChrome,
    builderHtmlConfirmationChrome: overrides.builderHtmlConfirmationChrome ?? base.builderHtmlConfirmationChrome,
    axsoDesignSelecteurVisuelPdp: overrides.axsoDesignSelecteurVisuelPdp ?? base.axsoDesignSelecteurVisuelPdp,
    axsoDesignCssVarMapping: overrides.axsoDesignCssVarMapping ?? base.axsoDesignCssVarMapping,
  };
}

export function resolveThemeConfig(themeId: string, savedConfig: Record<string, any> = {}): ThemeConfig {
  const base = DEFAULTS[themeId] || DEFAULTS["terre-et-or"];
  const CHAMPS_CLONE = new Set(["builderHtml", "builderCss", "builderHtmlProduits", "builderHtmlProduit", "builderHtmlPanierChrome", "builderHtmlCheckoutChrome", "builderHtmlConfirmationChrome", "axsoDesignSelecteurVisuelPdp"]);
  const hasCustom = savedConfig && Object.keys(savedConfig).filter(k => !CHAMPS_CLONE.has(k)).length > 0;
  if (!hasCustom) return base;

  return mergeThemeConfig(base, savedConfig);
}

// ─── Changement de thème sans perdre le texte du marchand ────────────────────
// Chaque thème a ses propres textes par défaut (titres, accroches, badges de
// confiance...), mais un marchand qui a déjà écrit/gardé le sien ne doit
// jamais le voir disparaître au profit du texte par défaut du thème choisi —
// seule l'identité visuelle (couleurs, polices, rayon, boutons, animations,
// mise en page) doit changer avec le thème. Liste des champs "copywriting"
// par section, conservés depuis l'ancienne config ; tout le reste de la
// section vient des défauts du nouveau thème.
const CHAMPS_COPY_PAR_SECTION: Record<string, string[]> = {
  annonce: ["texte"],
  hero: ["titre", "sousTitre", "ctaTexte", "ctaLien", "badgeTexte", "showSecondCta", "secondCtaTexte", "secondCtaLien", "videoUrl", "slideshowImages", "slideshowInterval"],
  vedettes: ["titre"],
  collections: ["titre"],
  promo: ["titre", "texte", "ctaTexte", "imageUrl"],
  avis: ["titre"],
  newsletter: ["titre", "texte", "placeholder", "ctaTexte"],
  confiance: ["items"],
  about: ["titre", "texte", "badgeTexte", "stats", "imageUrl"],
  faq: ["titre", "items"],
};

// `ancienConfig` : config actuellement active du tenant (déjà résolue,
// fusionnée avec ses propres édits). `nouveauThemeBase` : défauts du thème
// vers lequel il bascule (résolu SANS les overrides du tenant — juste le
// thème lui-même). Retourne la nouvelle config à sauvegarder.
export function appliquerNouveauTheme(ancienConfig: ThemeConfig, nouveauThemeBase: ThemeConfig): ThemeConfig {
  const sections: Record<string, any> = {};
  for (const [id, base] of Object.entries(nouveauThemeBase.sections)) {
    const ancienneSec = (ancienConfig.sections as any)?.[id];
    const champsCopy = CHAMPS_COPY_PAR_SECTION[id] || [];
    const fusion: any = { ...(base as any) };
    if (ancienneSec) {
      for (const champ of champsCopy) {
        if (ancienneSec[champ] !== undefined) fusion[champ] = ancienneSec[champ];
      }
    }
    sections[id] = fusion;
  }
  return {
    ...nouveauThemeBase,
    sections: sections as ThemeSections,
    // Contenu piloté par le marchand, jamais lié à l'identité visuelle d'un
    // thème — ne doit jamais être perdu en changeant de thème.
    customSections: ancienConfig.customSections,
    sectionOrder: ancienConfig.sectionOrder,
    sectionSousBlocs: ancienConfig.sectionSousBlocs,
    customCss: ancienConfig.customCss,
    productPage: ancienConfig.productPage,
    aboutPage: ancienConfig.aboutPage,
    contactPage: ancienConfig.contactPage,
    builderTree: ancienConfig.builderTree,
  };
}

export { DEFAULTS as THEME_DEFAULTS };
