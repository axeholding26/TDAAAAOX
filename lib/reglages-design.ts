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
  const apparence: Record<string, string> = {
    light: `background:#FFFFFF!important;color:#111111!important;`,
    dark: `background:#111111!important;color:#FFFFFF!important;`,
    glass: `background:${c.fond || "#FFFFFF"}B3!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);`,
    transparent: `background:transparent!important;box-shadow:none!important;`,
  };
  if (apparence[n.style || ""]) r.push(`header{${apparence[n.style!]}}header a{color:inherit!important}`);
  if (n.hauteur) r.push(`header{min-height:${n.hauteur}!important;display:flex;flex-direction:column;justify-content:center}`);
  if (n.type === "minimal") r.push(`header nav{display:none!important}`);
  if (n.showSearch === false) r.push(`[data-axs-recherche]{display:none!important}`);
  return r.join("");
}

const KEYFRAMES: Record<string, string> = {
  "fade-in": `from{opacity:0}to{opacity:1}`,
  "slide-up": `from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}`,
  "slide-left": `from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}`,
  "zoom-in": `from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}`,
  flip: `from{opacity:0;transform:perspective(600px) rotateX(20deg)}to{opacity:1;transform:none}`,
  "blur-in": `from{opacity:0;filter:blur(12px)}to{opacity:1;filter:none}`,
};

function cssAnimations(a: NonNullable<Cfg["animations"]>): string {
  const kf = KEYFRAMES[a.global || ""];
  const r: string[] = [];
  if (kf) {
    const duree = a.vitesse === "fast" ? ".4s" : a.vitesse === "slow" ? ".9s" : ".6s";
    const cibles = `section${a.stagger !== false ? `, [class*="grid"]:not([class*="foot"]) > *` : ""}`;
    r.push(`@keyframes axs-apparition{${kf}}`);
    // Apparition au défilement (Chrome, Edge, Safari récents) ; ailleurs au chargement.
    r.push(`${cibles}{animation:axs-apparition ${duree} cubic-bezier(.16,1,.3,1) both}`);
    r.push(`@supports (animation-timeline: view()){${cibles}{animation-timeline:view();animation-range:entry 0% entry 55%}}`);
    if (a.stagger !== false) for (let i = 2; i <= 8; i++) r.push(`[class*="grid"]:not([class*="foot"]) > :nth-child(${i}){animation-delay:${(i - 1) * 70}ms}`);
    r.push(`@media (prefers-reduced-motion: reduce){${cibles}{animation:none!important}}`);
  }
  if (a.parallax) r.push(`:is(section,div)[class*="hero"]{background-attachment:fixed!important}`);
  return r.join("");
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
