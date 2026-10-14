// AXSO BUILDER — mémoire de marque (themeConfig.marque), garde de marque et contrôle de
// cohérence du style. Pur et testé. La marque n'est BLOQUANTE que si le marchand l'a fixée
// (themeConfig.marque non vide) : déduite de la boutique, elle n'est qu'indicative — sinon
// la première couleur nouvelle de toute boutique serait refusée.
import type { BlockNode } from "@/lib/theme-config";
import { FONTS } from "@/lib/theme-fonts";

export const VERROUS = ["logo", "couleurs", "polices", "ton"] as const;
export type Verrou = (typeof VERROUS)[number];

export interface Marque {
  definie: boolean;
  nom: string;
  logo: { principal: string | null; variantes: string[] };
  couleurs: { principales: string[]; secondaires: string[] };
  polices: string[];
  ton: string; stylePhoto: string; styleVisuel: string; styleIcones: string;
  regles: string[];
  interdits: string[];
  verrous: Verrou[];
}

const uniques = <T,>(l: (T | undefined | null | "")[]) => [...new Set(l.filter(Boolean) as T[])];

/** Marque enregistrée, complétée par ce que la boutique montre déjà (nom, logo, couleurs, polices). */
export function marqueDe(cfg: Record<string, any>, boutique: { nom: string; logoUrl?: string | null }): Marque {
  const m = (cfg.marque ?? {}) as Partial<Marque>;
  const c = cfg.colors ?? {};
  return {
    definie: Object.keys(m).length > 0,
    nom: m.nom || boutique.nom,
    logo: { principal: m.logo?.principal ?? boutique.logoUrl ?? null, variantes: m.logo?.variantes ?? [] },
    couleurs: {
      principales: m.couleurs?.principales ?? uniques<string>([c.accent, c.accentSecondaire]),
      secondaires: m.couleurs?.secondaires ?? uniques<string>([c.fond, c.texte, c.surface, c.texteMuted, c.bordure]),
    },
    polices: m.polices ?? uniques<string>([cfg.fonts?.titre, cfg.fonts?.corps]),
    ton: m.ton ?? "", stylePhoto: m.stylePhoto ?? "", styleVisuel: m.styleVisuel ?? "", styleIcones: m.styleIcones ?? "",
    regles: m.regles ?? [], interdits: m.interdits ?? [], verrous: m.verrous ?? [],
  };
}

// ─── Couleurs ──────────────────────────────────────────────────────────────────
export function rgb(c: string): [number, number, number] | null {
  const s = c.trim().toLowerCase();
  const h = s.match(/^#([0-9a-f]{3,8})$/)?.[1];
  if (h) {
    const x = h.length < 6 ? h.slice(0, 3).split("").map((d) => d + d).join("") : h.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)) as [number, number, number];
  }
  const m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

/** Distance perçue approximative (« redmean ») : 0 identique, ~765 noir/blanc. */
export function distance(a: string, b: string): number | null {
  const x = rgb(a), y = rgb(b);
  if (!x || !y) return null;
  const r = (x[0] + y[0]) / 2, dr = x[0] - y[0], dg = x[1] - y[1], db = x[2] - y[2];
  return Math.sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db);
}

/** Blancs, noirs et gris : toujours compatibles avec une marque (textes, fonds neutres). */
export const neutre = (c: string) => { const x = rgb(c); return !!x && Math.max(...x) - Math.min(...x) < 24; };

export const SEUIL_COULEUR = 40; // en dessous : même couleur à l'œil (variante d'une teinte de la palette)

/** null si la couleur est compatible avec la palette, sinon la couleur la plus proche de la palette. */
export function horsPalette(couleur: string, palette: string[]): { proche: string | null } | null {
  if (!rgb(couleur) || neutre(couleur) || !palette.length) return null;
  let proche: string | null = null, d = Infinity;
  for (const p of palette) { const x = distance(couleur, p); if (x !== null && x < d) { d = x; proche = p; } }
  return d <= SEUIL_COULEUR ? null : { proche };
}

export const palette = (m: Marque) => [...m.couleurs.principales, ...m.couleurs.secondaires];
const nomPolice = (id: string) => FONTS.find((f) => f.v === id)?.label ?? id;

/**
 * Conflits entre un changement de thème et la marque FIXÉE par le marchand : couleur hors
 * palette, police non autorisée, élément verrouillé. Vide = rien à redire.
 */
export function conflitsMarque(avant: Record<string, any>, apres: Record<string, any>, m: Marque): string[] {
  if (!m.definie) return [];
  const out: string[] = [];
  const ca = avant.colors ?? {}, cb = apres.colors ?? {};
  for (const [k, v] of Object.entries(cb)) {
    if (v === ca[k] || typeof v !== "string") continue;
    if (m.verrous.includes("couleurs")) { out.push(`couleurs verrouillées par la marque (${k} → ${v})`); continue; }
    const h = horsPalette(v, palette(m));
    if (h) out.push(`${k} ${v} est hors de la palette approuvée (${palette(m).join(", ")}) — la plus proche : ${h.proche}`);
  }
  for (const k of ["titre", "corps"]) {
    const v = apres.fonts?.[k];
    if (!v || v === avant.fonts?.[k]) continue;
    if (m.verrous.includes("polices")) out.push(`typographies verrouillées par la marque (${k} → ${v})`);
    else if (m.polices.length && !m.polices.includes(v)) out.push(`la police ${nomPolice(v)} (${k}) n'est pas autorisée par la marque (autorisées : ${m.polices.map(nomPolice).join(", ")})`);
  }
  return out;
}

// ─── Parcours de la boutique ───────────────────────────────────────────────────
type Visite = (n: BlockNode, ou: string) => void;
export function parcourir(cfg: Record<string, any>, f: Visite) {
  const rec = (nodes: BlockNode[] = [], ou: string) => nodes.forEach((n) => { f(n, ou); rec(n.children, ou); });
  rec(cfg.builderTree, "accueil");
  for (const [slug, p] of Object.entries((cfg.pagesPerso ?? {}) as Record<string, any>)) rec(p?.builderTree, `p/${slug}`);
}

/** Toutes les couleurs posées : thème, sections du socle, styles des blocs (et par appareil), styles d'éléments du design. */
export function couleursUtilisees(cfg: Record<string, any>): { couleur: string; ou: string }[] {
  const out: { couleur: string; ou: string }[] = [];
  const pousser = (v: unknown, ou: string) => { if (typeof v === "string" && rgb(v)) out.push({ couleur: v.trim(), ou }); };
  for (const [k, v] of Object.entries(cfg.colors ?? {})) pousser(v, `thème colors.${k}`);
  const s = cfg.sections ?? {};
  pousser(s.annonce?.couleurFond, "socle annonce"); pousser(s.annonce?.couleurTexte, "socle annonce");
  pousser(s.promo?.bgColor, "socle promo"); pousser(s.newsletter?.bgColor, "socle newsletter");
  parcourir(cfg, (n, ou) => {
    const cible = `${ou} › ${n.type} ${n.id}`;
    for (const st of [n.style, n.style?.responsive?.tablet, n.style?.responsive?.mobile]) {
      pousser(st?.background?.color, cible); pousser(st?.typography?.color, cible); pousser(st?.border?.color, cible);
      pousser(st?.hover?.color, cible); pousser(st?.hover?.background, cible);
    }
    for (const etats of Object.values((n.config?.elementStyles ?? {}) as Record<string, Record<string, any>>)) {
      for (const e of Object.values(etats ?? {})) { pousser(e?.couleur, cible); pousser(e?.fond, cible); pousser(e?.bordureCouleur, cible); }
    }
  });
  return out;
}

export function policesUtilisees(cfg: Record<string, any>): { police: string; ou: string }[] {
  const out: { police: string; ou: string }[] = [];
  if (cfg.fonts?.titre) out.push({ police: cfg.fonts.titre, ou: "thème (titres)" });
  if (cfg.fonts?.corps) out.push({ police: cfg.fonts.corps, ou: "thème (texte)" });
  parcourir(cfg, (n, ou) => {
    for (const st of [n.style, n.style?.responsive?.tablet, n.style?.responsive?.mobile]) if (st?.typography?.police) out.push({ police: st.typography.police, ou: `${ou} › ${n.type} ${n.id}` });
    for (const etats of Object.values((n.config?.elementStyles ?? {}) as Record<string, Record<string, any>>)) {
      for (const e of Object.values(etats ?? {})) if (e?.police) out.push({ police: e.police, ou: `${ou} › ${n.type} ${n.id}` });
    }
  });
  return out;
}

// ─── Contrôles ─────────────────────────────────────────────────────────────────
export interface Probleme { categorie: string; gravite: "erreur" | "avertissement" | "info"; message: string; cibles?: string[] }

const grouper = (l: { cle: string; ou: string }[]) => {
  const m = new Map<string, string[]>();
  for (const x of l) m.set(x.cle, [...(m.get(x.cle) ?? []), x.ou]);
  return m;
};

/** Cohérence du style (STYLE CONSISTENCY) : couleurs hors palette, espacements et tailles disparates, boutons hétérogènes, trop de polices, doublons. */
export function validerStyle(cfg: Record<string, any>, paletteRef: string[] = []): Probleme[] {
  const p: Probleme[] = [];
  const pal = paletteRef.length ? paletteRef : Object.values(cfg.colors ?? {}).filter((v): v is string => typeof v === "string");
  const hors = couleursUtilisees(cfg).filter((x) => !x.ou.startsWith("thème") && horsPalette(x.couleur, pal));
  for (const [c, ou] of grouper(hors.map((x) => ({ cle: x.couleur.toLowerCase(), ou: x.ou })))) {
    p.push({ categorie: "couleurs", gravite: "avertissement", message: `${c} n'appartient pas à la palette (${ou.length} usage(s))`, cibles: ou.slice(0, 5) });
  }

  const espacements = new Set<string>(), tailles = new Set<string>(), boutons = new Map<string, string[]>(), configs = new Map<string, string[]>();
  parcourir(cfg, (n, ou) => {
    const sp = n.style?.spacing;
    if (n.type === "section") for (const v of [sp?.pt, sp?.pb]) if (v) espacements.add(v);
    if (n.style?.typography?.taille) tailles.add(n.style.typography.taille);
    if (n.type === "button") { const cle = `${n.config?.style ?? "primary"}/${n.config?.taille ?? "md"}${n.style?.border?.radius ? `/r${n.style.border.radius}` : ""}`; boutons.set(cle, [...(boutons.get(cle) ?? []), n.id]); }
    if (n.config && !["section", "row", "column"].includes(n.type)) {
      const cle = `${n.type}:${JSON.stringify(n.config)}:${JSON.stringify(n.style ?? {})}`;
      configs.set(cle, [...(configs.get(cle) ?? []), `${ou} › ${n.id}`]);
    }
  });
  if (espacements.size > 4) p.push({ categorie: "espacements", gravite: "avertissement", message: `${espacements.size} hauteurs de marge de section différentes (${[...espacements].join(", ")}) : choisis 2 ou 3 valeurs et tiens-t'y.` });
  const horsGrille = [...espacements].filter((v) => /^\d+px$/.test(v) && parseInt(v) % 4 !== 0);
  if (horsGrille.length) p.push({ categorie: "espacements", gravite: "info", message: `marges hors grille de 4 px : ${horsGrille.join(", ")}` });
  if (tailles.size > 6) p.push({ categorie: "tailles", gravite: "avertissement", message: `${tailles.size} tailles de texte différentes posées à la main (${[...tailles].join(", ")}) : trop pour une hiérarchie lisible.` });
  if (boutons.size > 2) p.push({ categorie: "boutons", gravite: "avertissement", message: `${boutons.size} styles de boutons différents (${[...boutons.keys()].join(", ")}) : un style principal et un secondaire suffisent.`, cibles: [...boutons.values()].flat().slice(0, 8) });

  const polices = new Set(policesUtilisees(cfg).map((x) => x.police));
  if (polices.size > 3) p.push({ categorie: "typographie", gravite: "avertissement", message: `${polices.size} polices utilisées (${[...polices].map(nomPolice).join(", ")}) : 2, au plus 3.` });
  const inconnues = [...polices].filter((v) => !FONTS.some((f) => f.v === v));
  if (inconnues.length) p.push({ categorie: "typographie", gravite: "erreur", message: `police(s) inconnue(s) du catalogue, non chargée(s) : ${inconnues.join(", ")}` });

  for (const ou of configs.values()) if (ou.length > 1) p.push({ categorie: "doublons", gravite: "avertissement", message: `composant dupliqué à l'identique (${ou.length} fois)`, cibles: ou.slice(0, 5) });
  return p;
}

const TUTOIEMENT = /\b(tu|ton|ta|tes|toi|te)\b/i;
const VOUVOIEMENT = /\b(vous|votre|vos)\b/i;

/** Textes visibles de la boutique (blocs + accueil du socle), pour le contrôle du ton. */
function textes(cfg: Record<string, any>): string[] {
  const t: string[] = [];
  const s = cfg.sections ?? {};
  for (const v of [s.annonce?.texte, s.hero?.titre, s.hero?.sousTitre, s.hero?.ctaTexte, s.promo?.titre, s.promo?.texte]) if (typeof v === "string") t.push(v);
  parcourir(cfg, (n) => { for (const k of ["titre", "texte", "ctaTexte", "sousTitre"]) if (typeof n.config?.[k] === "string") t.push(n.config[k]); });
  return t.filter(Boolean);
}

/**
 * Cohérence avec la marque (BRAND GUARD) : logo, couleurs (tout le brouillon), typographies,
 * ton (heuristique : tutoiement/vouvoiement, cris), visuels, cohérence des composants.
 */
export function validerCoherenceMarque(cfg: Record<string, any>, m: Marque): { score: number; problemes: Probleme[] } {
  const p: Probleme[] = [];
  if (!m.logo.principal) p.push({ categorie: "logo", gravite: "avertissement", message: "aucun logo défini pour la marque" });

  const hors = couleursUtilisees(cfg).filter((x) => horsPalette(x.couleur, palette(m)));
  for (const [c, ou] of grouper(hors.map((x) => ({ cle: x.couleur.toLowerCase(), ou: x.ou })))) {
    p.push({ categorie: "couleurs", gravite: m.definie ? "erreur" : "info", message: `${c} est hors de la palette de la marque`, cibles: ou.slice(0, 5) });
  }
  if (m.polices.length) {
    for (const [v, ou] of grouper(policesUtilisees(cfg).filter((x) => !m.polices.includes(x.police)).map((x) => ({ cle: x.police, ou: x.ou })))) {
      p.push({ categorie: "typographie", gravite: m.definie ? "erreur" : "info", message: `police ${nomPolice(v)} non autorisée par la marque`, cibles: ou.slice(0, 5) });
    }
  }

  const ton = m.ton.toLowerCase(), tous = textes(cfg);
  if (/vouvoi|formel|luxe|premium|élégan|sobre/.test(ton)) {
    const tu = tous.filter((x) => TUTOIEMENT.test(x));
    if (tu.length) p.push({ categorie: "ton", gravite: "avertissement", message: `ton « ${m.ton} » mais ${tu.length} texte(s) au tutoiement`, cibles: tu.slice(0, 3).map((x) => x.slice(0, 80)) });
  }
  if (/tutoi|décontract|familier|fun|jeune/.test(ton)) {
    const vous = tous.filter((x) => VOUVOIEMENT.test(x));
    if (vous.length) p.push({ categorie: "ton", gravite: "avertissement", message: `ton « ${m.ton} » mais ${vous.length} texte(s) au vouvoiement`, cibles: vous.slice(0, 3).map((x) => x.slice(0, 80)) });
  }
  const cris = tous.filter((x) => /!!|\b[A-ZÀ-Ü]{6,}\b.*\b[A-ZÀ-Ü]{6,}\b/.test(x));
  if (cris.length && /luxe|premium|élégan|sobre|formel/.test(ton)) p.push({ categorie: "ton", gravite: "avertissement", message: `${cris.length} texte(s) criards (majuscules, « !! ») pour un ton « ${m.ton} »` });

  parcourir(cfg, (n, ou) => {
    if (n.type === "image" && !n.config?.url) p.push({ categorie: "visuels", gravite: "avertissement", message: "image sans fichier", cibles: [`${ou} › ${n.id}`] });
    else if (n.type === "image" && !n.config?.alt) p.push({ categorie: "visuels", gravite: "info", message: "image sans texte alternatif (accessibilité, SEO)", cibles: [`${ou} › ${n.id}`] });
    if ((n.type === "gallery" && (n.config?.images ?? []).some((x: string) => !x)) || (n.type === "brands" && (n.config?.logos ?? []).some((x: string) => !x))) {
      p.push({ categorie: "visuels", gravite: "avertissement", message: `${n.type} avec des emplacements d'image vides`, cibles: [`${ou} › ${n.id}`] });
    }
  });

  p.push(...validerStyle(cfg, palette(m)).filter((x) => x.categorie !== "couleurs" && x.categorie !== "typographie").map((x) => ({ ...x, categorie: `composants/${x.categorie}` })));
  const score = Math.max(0, 100 - p.reduce((s, x) => s + (x.gravite === "erreur" ? 15 : x.gravite === "avertissement" ? 5 : 1), 0));
  return { score, problemes: p };
}
