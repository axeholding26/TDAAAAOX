// Réglages de thème du Constructeur (Boutons et navigation, Animations)
// appliqués aux designs AXSO importés — qui sont du HTML/CSS à part et
// n'utilisaient que les couleurs et polices. Seulement pour les panneaux que
// le marchand a réellement modifiés (`reglagesDesign`) : les valeurs par
// défaut ne doivent jamais écraser l'apparence d'origine d'un design.
// Sélecteurs vérifiés sur les 15 designs de Templates/ (boutons à classe
// btn/button/cta, un <header>, grilles *grid*).

type Couleurs = Record<string, any>;
type Cfg = {
  colors: Couleurs;
  boutons?: { style?: string; taille?: string; hover?: string };
  navigationStyle?: { type?: string; style?: string; hauteur?: string; sticky?: boolean; showSearch?: boolean };
  animations?: { global?: string; vitesse?: string; stagger?: boolean; parallax?: boolean; smoothScroll?: boolean };
  reglagesDesign?: { boutons?: boolean; navigation?: boolean; animations?: boolean };
};

const BOUTONS = `:is(a,button):is([class*="btn"],[class*="button"],[class*="cta"])`;

function cssBoutons(b: NonNullable<Cfg["boutons"]>, c: Couleurs): string {
  const accent = c.accent || "#111111", fond = c.fond || "#FFFFFF";
  const style: Record<string, string> = {
    filled: `background:${accent}!important;color:${fond}!important;border:1px solid ${accent}!important;text-decoration:none!important;`,
    outlined: `background:transparent!important;color:${accent}!important;border:2px solid ${accent}!important;text-decoration:none!important;`,
    ghost: `background:transparent!important;color:${accent}!important;border-color:transparent!important;text-decoration:underline!important;`,
    pill: `border-radius:999px!important;`,
    square: `border-radius:0!important;`,
  };
  const taille: Record<string, string> = {
    sm: `font-size:.82em!important;padding:.55em 1.1em!important;`,
    lg: `font-size:1.08em!important;padding:.95em 1.9em!important;`,
    xl: `font-size:1.2em!important;padding:1.1em 2.3em!important;`,
  };
  const survol: Record<string, string> = {
    lighten: `filter:brightness(1.12);`,
    darken: `filter:brightness(.85);`,
    scale: `transform:scale(1.05);`,
    glow: `box-shadow:0 0 0 4px ${accent}33,0 10px 28px ${accent}66!important;`,
    slide: `transform:translateY(-3px);`,
  };
  return `${BOUTONS}{${style[b.style || ""] ?? ""}${taille[b.taille || ""] ?? ""}transition:transform .2s,filter .2s,box-shadow .2s!important}`
    + (survol[b.hover || ""] ? `${BOUTONS}:hover{${survol[b.hover!]}}` : "");
}

function cssNavigation(n: NonNullable<Cfg["navigationStyle"]>, c: Couleurs): string {
  const r: string[] = [];
  // L'en-tête des designs est une rangée flex (logo · menu · actions) : on n'y
  // touche jamais (display/direction), seulement fond, couleurs et hauteur.
  const apparence: Record<string, string> = {
    light: `header{background:#FFFFFF!important;color:#111111!important;border-bottom:1px solid rgba(0,0,0,.08)!important}`,
    dark: `header{background:#111111!important;color:#FFFFFF!important;border-bottom-color:rgba(255,255,255,.08)!important}`,
    glass: `header{background:${c.fond || "#FFFFFF"}B8!important;backdrop-filter:blur(14px) saturate(1.4)!important;-webkit-backdrop-filter:blur(14px) saturate(1.4)!important}`,
    transparent: `header{background:transparent!important;box-shadow:none!important;border-color:transparent!important;backdrop-filter:none!important}`,
  };
  if (apparence[n.style || ""]) r.push(apparence[n.style!], `header :is(nav a, .logo, [class*="logo"]){color:inherit!important}`);
  // Hauteur : celle de la rangée, contenu toujours centré verticalement (align-items du design).
  if (n.hauteur) r.push(`header{min-height:${n.hauteur}!important;padding-top:0!important;padding-bottom:0!important;box-sizing:border-box!important}`);
  // Minimal : logo + bouton menu ; les liens s'ouvrent en panneau sous l'en-tête (components/storefront/NavigationDesign.tsx).
  if (n.type === "minimal") r.push(
    `header nav{display:none!important}`,
    `header[data-axs-menu-ouvert] nav{display:flex!important;flex-direction:column;gap:14px;position:absolute;top:100%;left:0;right:0;padding:18px 4vw;background:inherit;box-shadow:0 12px 24px rgba(0,0,0,.08);z-index:5}`,
    `header{position:relative}`,
  );
  if (n.showSearch === false) r.push(`[data-axs-recherche]{display:none!important}`);
  return r.join("");
}

// Animations d'apparition : jouées par components/storefront/AnimationsDesign.tsx
// (au défilement, rejouées dans l'aperçu à chaque réglage). Ici, le parallaxe :
// le contenu de la bannière défile plus lentement que la page.
function cssAnimations(a: NonNullable<Cfg["animations"]>): string {
  if (!a.parallax) return "";
  return `@keyframes axs-parallaxe{to{transform:translateY(28%)}}`
    + `@supports (animation-timeline: scroll()){:is(section,div)[class*="hero"] > *{animation:axs-parallaxe linear both;animation-timeline:scroll();animation-range:0 100vh}}`
    + `@media (prefers-reduced-motion: reduce){:is(section,div)[class*="hero"] > *{animation:none!important}}`;
}

/** CSS à ajouter au design (portée [data-axs-embed-html]) — vide si aucun panneau touché. */
export function cssReglagesDesign(cfg: Cfg): string {
  const t = cfg.reglagesDesign ?? {};
  return [
    t.boutons && cfg.boutons ? cssBoutons(cfg.boutons, cfg.colors) : "",
    t.navigation && cfg.navigationStyle ? cssNavigation(cfg.navigationStyle, cfg.colors) : "",
    t.animations && cfg.animations ? cssAnimations(cfg.animations) : "",
  ].join("");
}

/** CSS hors portée : l'en-tête fixe doit coller à la page (son bloc parent), défilement fluide. */
export function cssReglagesDesignPage(cfg: Cfg): string {
  const t = cfg.reglagesDesign ?? {};
  const r: string[] = [];
  // Bloc le plus extérieur qui contient l'en-tête : section de l'accueil, en-tête des autres pages (HabillageDesign), bloc de l'aperçu du Constructeur.
  if (t.navigation && cfg.navigationStyle?.sticky !== false) r.push(`:is([data-axs-id],[data-axs-embed-html]):not([data-axs-id] *,[data-axs-embed-html] *):has(header),[data-apercu-page]>[data-apercu-id]:has(header){position:sticky;top:0;z-index:40}`);
  if (t.animations && cfg.animations?.smoothScroll !== false) r.push(`html{scroll-behavior:smooth}`);
  return r.join("");
}
