// AXSO BUILDER — moteur d'intention de design. Une demande en langage naturel devient une
// INTENTION structurée (style, priorités, zone ciblée, appareil…), puis un plan d'opérations
// du registre, simulé sur une COPIE de la config : jamais « demande → modification directe ».
// La portée et la marque sont vérifiées par du code sur le résultat simulé, quelle que soit
// l'opération (les noms des opérations ne sont pas connus ici). Pur, sauf extraireIntention.
import { completionAuto, hasDeepSeek, hasGemini } from "@/lib/llm-client";
import { validerPlan, dependances } from "@/lib/controle-ia/plan";
import { zoneDe } from "@/lib/block-tree";
import type { BlockNode } from "@/lib/theme-config";
import { comparer } from "./diff";
import { risqueChangements } from "./risque";
import { validerConfig } from "./validation";
import { ErreurBuilder, type DonneesBoutique, type EtapeOperation, type OperationBuilder } from "./types";

// ─── Schéma ──────────────────────────────────────────────────────────────────
/** Zones nommées ; aussi « section:<id> » (une section précise) et « page:<slug> » (une page libre). */
export const ZONES = ["boutique", "accueil", "hero", "navigation", "footer", "fiche_produit", "collection", "pages", "theme", "seo", "assets"] as const;
export const APPAREILS = ["tous", "mobile", "tablette", "ordinateur"] as const;
export const ACTIONS = ["mettre_en_premier", "supprimer", "colorer", "alleger", "optimiser", "restyler", "ajouter"] as const;
export type Appareil = (typeof APPAREILS)[number];
export type TypeAction = (typeof ACTIONS)[number];

export interface Intention {
  objectif: string;
  zone: string;
  appareil: Appareil;
  /** Style visuel visé : premium, minimaliste, moderne, africain, epure, audacieux, chaleureux… */
  style: string[];
  /** Ce qui compte d'abord : conversion, lisibilite, vitesse, confiance, mise_en_avant_produit, mobile… */
  priorites: string[];
  typographie?: string;
  mise_en_page?: string;
  imagerie?: string;
  cta?: string;
  actions: { type: TypeAction; cible?: string; valeur?: string }[];
  /** Couleurs demandées explicitement (hex). */
  couleurs: string[];
  /** Inspiration (« Apple ») : un esprit, jamais une copie de leur marque. */
  reference?: string;
  garder_identite: boolean;
  /** Identifiants de sections à ne pas toucher. */
  exclus: string[];
  /** Ce qu'il faut préciser avant d'agir (ex. « quelle section ? »). */
  a_preciser: string[];
  source: "modele" | "mots_cles";
}

const texte = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const liste = (v: unknown, max = 8) => (Array.isArray(v) ? v.map((x) => texte(x, 60)).filter((x): x is string => !!x).slice(0, max) : []);
const zoneValide = (z: string) => (ZONES as readonly string[]).includes(z) || /^(section|page):[\w-]{1,80}$/.test(z);

/** Intention propre à partir d'un objet quelconque (sortie du modèle) ; null si inexploitable. */
export function validerIntention(brut: any, objectif: string): Intention | null {
  if (!brut || typeof brut !== "object") return null;
  const zone = texte(brut.zone, 90) ?? "boutique";
  const appareil = (APPAREILS as readonly string[]).includes(brut.appareil) ? brut.appareil : "tous";
  const actions = (Array.isArray(brut.actions) ? brut.actions : [])
    .filter((a: any) => (ACTIONS as readonly string[]).includes(a?.type))
    .slice(0, 6).map((a: any) => ({ type: a.type, cible: texte(a.cible, 90), valeur: texte(a.valeur, 60) }));
  return {
    objectif: objectif.slice(0, 500), zone: zoneValide(zone) ? zone : "boutique", appareil,
    style: liste(brut.style), priorites: liste(brut.priorites),
    typographie: texte(brut.typographie), mise_en_page: texte(brut.mise_en_page), imagerie: texte(brut.imagerie), cta: texte(brut.cta),
    actions, couleurs: liste(brut.couleurs).map(normCouleur).filter((c): c is string => !!c),
    reference: texte(brut.reference, 60), garder_identite: brut.garder_identite !== false,
    exclus: liste(brut.exclus, 30), a_preciser: liste(brut.a_preciser, 5), source: "modele",
  };
}

// ─── Analyseur de mots-clés (repli sans modèle, commandes courtes) ───────────
const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const COULEURS: Record<string, string> = {
  noir: "#000000", blanc: "#ffffff", rouge: "#e11d48", bleu: "#2563eb", vert: "#16a34a", jaune: "#facc15", orange: "#f97316",
  violet: "#7c3aed", rose: "#ec4899", gris: "#6b7280", beige: "#e8dcc4", dore: "#d4af37", marron: "#7c4a2d",
};
const ZONE_MOTS: [RegExp, string][] = [
  [/\b(hero|banniere|bandeau principal|haut de (la )?page)\b/, "hero"],
  [/\b(menu|navigation|en-?tete|header)\b/, "navigation"],
  [/\b(pied de page|footer)\b/, "footer"],
  [/\b(fiche|page) produits?\b/, "fiche_produit"],
  [/\bcollections?\b|\bcategories?\b/, "collection"],
  [/\b(referencement|seo|google)\b/, "seo"],
  [/\b(logo|favicon|icones?|visuels?|photos?|images?)\b/, "assets"],
  [/\b(cette section|section)\b/, "accueil"],
  [/\b(accueil|la page|page d'accueil)\b/, "accueil"],
  [/\b(bouton|couleurs?|polices?|typo(graphie)?|theme)\b/, "theme"],
];
const STYLE_MOTS: [RegExp, string[]][] = [
  [/\bpremium|luxe|haut de gamme|chic\b/, ["premium"]],
  [/\bminimalist|epure|sobre\b/, ["minimaliste"]],
  [/\bmoderne\b/, ["moderne"]],
  [/\bafricain|wax|kente|bogolan\b/, ["africain"]],
  [/\bmoins charge|aere|simple\b/, ["epure"]],
  [/\bcolore|vif|audacieux|pop\b/, ["audacieux"]],
  [/\bchaleureux|convivial\b/, ["chaleureux"]],
];
const REFERENCES = /\bcomme (apple|nike|zara|shein|jumia|hermes|chanel|ikea|airbnb)\b/;

/**
 * Intention d'une commande courte (§62) sans modèle. `cible` : identifiant donné par l'IA
 * pour « ce produit », « cette section ». Une zone ou un appareil explicites l'emportent.
 */
export function analyserMotsCles(demande: string, explicite: { zone?: string; appareil?: Appareil; cible?: string } = {}): Intention {
  const t = sansAccents(demande);
  const cible = explicite.cible?.slice(0, 90);
  const i: Intention = {
    objectif: demande.slice(0, 500), zone: "boutique", appareil: "tous", style: [], priorites: [], actions: [], couleurs: [],
    garder_identite: true, exclus: [], a_preciser: [], source: "mots_cles",
  };
  if (/\b(mobile|telephone|smartphone|portable)\b/.test(t)) i.appareil = "mobile";
  else if (/\btablette\b/.test(t)) i.appareil = "tablette";
  else if (/\b(ordinateur|desktop|pc)\b/.test(t)) i.appareil = "ordinateur";

  for (const [re, z] of ZONE_MOTS) if (re.test(t)) { i.zone = z; break; }
  for (const [re, s] of STYLE_MOTS) if (re.test(t)) i.style.push(...s);

  const ref = REFERENCES.exec(t);
  if (ref) {
    i.reference = ref[1][0].toUpperCase() + ref[1].slice(1);
    // « comme Apple » : épuré, beaucoup d'espace, typographie forte — avec l'identité du marchand.
    i.style.push("minimaliste", "premium");
    i.zone = "boutique";
  }
  if (/\bnotre identite|nos couleurs|notre marque|notre style\b/.test(t)) i.garder_identite = true;

  const couleur = Object.entries(COULEURS).find(([mot]) => new RegExp(`\\ben ${mot}\\b|\\b${mot}s?\\b`).test(t))?.[1];
  const hex = /#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/.exec(t)?.[0];
  if (hex || (couleur && /\b(mets?|passe|couleur|en)\b/.test(t))) {
    const c = normCouleur(hex ?? couleur!)!;
    i.couleurs.push(c);
    i.actions.push({ type: "colorer", cible: cible ?? (/\bbouton/.test(t) ? "boutons" : undefined), valeur: c });
  }
  if (/\b(en premier|en tete|tout en haut|mets? .* d'abord|mettre en avant)\b/.test(t)) {
    i.actions.push({ type: "mettre_en_premier", cible: cible ?? (/\bproduit/.test(t) ? "produit" : undefined) });
    i.priorites.push(/\bproduit/.test(t) ? "mise_en_avant_produit" : "hierarchie");
    if (i.zone === "boutique") i.zone = "accueil";
    if (!cible) i.a_preciser.push(/\bproduit/.test(t) ? "quel produit (identifiant) ?" : "quel élément ?");
  }
  if (/\b(enleve|supprime|retire|cache|masque|vire)\b/.test(t)) {
    i.actions.push({ type: "supprimer", cible });
    if (cible) i.zone = `section:${cible}`;
    else i.a_preciser.push("quelle section (identifiant) ?");
  }
  if (/\b(moins charge|alleg|simplifi|plus simple|epure|aere)/.test(t)) {
    i.actions.push({ type: "alleger" });
    if (!i.style.includes("epure")) i.style.push("epure");
    if (i.zone === "boutique" && /\bpage\b/.test(t)) i.zone = "accueil";
  }
  if (/\b(optimis|ameliore|accelere)/.test(t)) {
    i.actions.push({ type: "optimiser" });
    if (i.appareil === "mobile") i.priorites.push("mobile");
    if (/\b(vente|conversion|commande)/.test(t)) i.priorites.push("conversion");
    if (/\b(rapide|vitesse|performance)/.test(t)) i.priorites.push("vitesse");
  }
  // Les styles seuls (« fais plus premium ») sont un changement de style, pas de structure.
  if (i.style.length && !i.actions.some((a) => a.type === "alleger")) i.actions.push({ type: "restyler" });
  if (i.style.includes("premium")) i.priorites.push("confiance");
  if (/\bmais moderne|moderne\b/.test(t) && i.style.includes("africain")) i.typographie = "moderne et lisible, motifs africains en accent";
  if (cible && i.zone === "boutique" && i.actions.some((a) => a.type !== "mettre_en_premier")) i.zone = `section:${cible}`;

  if (explicite.zone && zoneValide(explicite.zone)) i.zone = explicite.zone;
  if (explicite.appareil) i.appareil = explicite.appareil;
  i.style = [...new Set(i.style)];
  i.priorites = [...new Set(i.priorites)];
  return i;
}

const CONSIGNE_INTENTION = `Tu traduis une demande de design de boutique en ligne en une INTENTION JSON, sans rien décider d'autre.
Réponds uniquement par un objet JSON :
{"zone": une de ${ZONES.join(", ")} ou "section:<id>" ou "page:<slug>" — la PLUS PETITE zone visée (« je n'aime pas le hero » → "hero" ; « menu sur mobile » → "navigation"),
 "appareil": ${APPAREILS.join(" | ")}, "style": [mots], "priorites": [mots], "typographie", "mise_en_page", "imagerie", "cta",
 "actions": [{"type": ${ACTIONS.join(" | ")}, "cible", "valeur"}], "couleurs": ["#hex"], "reference": "marque d'inspiration ou vide",
 "garder_identite": true|false, "a_preciser": [questions si la demande est ambiguë]}`;

/**
 * Intention par le modèle interne (sortie JSON), avec repli sur l'analyseur de mots-clés.
 * Seule la demande du marchand est envoyée ici, jamais le contenu de la boutique.
 */
export async function extraireIntention(demande: string, explicite: { zone?: string; appareil?: Appareil; cible?: string } = {}): Promise<Intention> {
  const repli = analyserMotsCles(demande, explicite);
  if (!hasGemini() && !hasDeepSeek()) return repli;
  try {
    const { text } = await completionAuto([
      { role: "system", content: CONSIGNE_INTENTION },
      { role: "user", content: `Demande : ${demande.slice(0, 1500)}${explicite.cible ? `\nÉlément désigné : ${explicite.cible}` : ""}` },
    ], 700, true);
    const i = validerIntention(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)), demande);
    if (!i) return repli;
    if (explicite.zone && zoneValide(explicite.zone)) i.zone = explicite.zone;
    if (explicite.appareil) i.appareil = explicite.appareil;
    // Une couleur ou une zone que le modèle aurait « oubliée » mais que les mots-clés voient.
    if (!i.couleurs.length) i.couleurs = repli.couleurs;
    if (i.zone === "boutique" && repli.zone !== "boutique" && !explicite.zone) i.zone = repli.zone;
    if (i.appareil === "tous" && repli.appareil !== "tous" && !explicite.appareil) i.appareil = repli.appareil;
    return i;
  } catch { return repli; }
}

// ─── Portée : ce qu'une intention autorise à changer ─────────────────────────
// ponytail: repérage du hero par nom ou par le début du contenu ; un rôle explicite de section le remplacera s'il apparaît.
const HERO = /hero|banni|banner|bandeau|slider|slideshow/i;

/** Section « hero » de l'accueil : nommée comme telle, sinon la première du contenu. */
export function sectionsHero(tree: BlockNode[] = []): string[] {
  const nommees = tree.filter((s) => HERO.test(`${s.config?.nom ?? ""} ${s.config?.role ?? ""} ${s.id}`) || s.children?.some((r) => HERO.test(JSON.stringify(r).slice(0, 400))));
  if (nommees.length) return nommees.map((s) => s.id);
  const premiere = tree.find((s) => zoneDe(s) === "template");
  return premiere ? [premiere.id] : [];
}

function racines(tree: BlockNode[] = [], out = new Map<string, BlockNode>(), racine?: BlockNode) {
  for (const n of tree) { out.set(n.id, racine ?? n); racines(n.children, out, racine ?? n); }
  return out;
}

/** Clés de premier niveau (hors arbres comparés à part) dont le contenu change, avec les sous-clés touchées. */
function clesModifiees(avant: Record<string, any>, apres: Record<string, any>) {
  const out: { cle: string; sous: string[] }[] = [];
  for (const cle of new Set([...Object.keys(avant), ...Object.keys(apres)])) {
    if (cle === "builderTree" || cle === "pagesPerso") continue;
    const a = avant[cle], b = apres[cle];
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue;
    const objets = a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b);
    out.push({ cle, sous: objets ? [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) : [] });
  }
  return out;
}

const THEME = new Set(["colors", "fonts", "radius", "layout", "boutons", "animations", "reglagesDesign"]);
const ACCUEIL = new Set(["sections", "sectionOrder", "customSections", "sectionSousBlocs"]);

function cleAutorisee(zone: string, cle: string, sous: string[]): boolean {
  switch (zone) {
    case "boutique": return true;
    case "theme": return THEME.has(cle) || /^(marque|brand)/i.test(cle);
    case "accueil": return ACCUEIL.has(cle);
    case "hero": return cle === "sections" && sous.length > 0 && sous.every((s) => s === "hero");
    case "navigation": return /^nav|menu|header|entete/i.test(cle);
    case "footer": return /footer|pied/i.test(cle);
    case "fiche_produit": return /^productPage|ficheProduit|modeleProduit|productTemplate/i.test(cle);
    case "collection": return /collection/i.test(cle);
    case "pages": return /^(aboutPage|contactPage)$/.test(cle);
    case "seo": return /seo/i.test(cle);
    case "assets": return /asset|logo|favicon|media|icone|image/i.test(cle);
    default: return false;
  }
}

function sectionAutorisee(zone: string, s: BlockNode | undefined, hero: string[]): boolean {
  if (!s) return false;
  if (zone === "boutique" || zone === "assets") return true;
  if (zone.startsWith("section:")) return s.id === zone.slice(8);
  if (zone === "hero") return hero.includes(s.id);
  if (zone === "accueil") return zoneDe(s) === "template";
  if (zone === "navigation") return zoneDe(s) === "header";
  if (zone === "footer") return zoneDe(s) === "footer";
  return false;
}

// Champs propres au mobile (style.responsive.mobile, visibility.mobile, menuMobile…) : retirés, le reste doit être identique.
// Un objet vidé par le retrait (style: { responsive: {} }) compte comme absent.
const sansMobile = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(sansMobile);
  if (!v || typeof v !== "object") return v;
  const o = Object.entries(v).filter(([k]) => !/mobile/i.test(k)).map(([k, x]) => [k, sansMobile(x)] as const)
    .filter(([, x]) => !(x && typeof x === "object" && !Array.isArray(x) && !Object.keys(x).length));
  return Object.fromEntries(o);
};

/**
 * Changements qui sortent de la portée de l'intention (vide = tout est dans la portée).
 * Vérifié sur le résultat simulé : peu importe l'opération, seul compte ce qui change.
 */
export function horsPortee(avant: Record<string, any>, apres: Record<string, any>, intention: Pick<Intention, "zone" | "appareil" | "exclus">): string[] {
  const hors: string[] = [];
  const zone = intention.zone;
  const ra = racines(avant.builderTree), rb = racines(apres.builderTree);
  const hero = [...new Set([...sectionsHero(avant.builderTree), ...sectionsHero(apres.builderTree)])];
  // Déplacer une section de la zone décale les autres : seul compte l'ordre des sections hors zone entre elles.
  const ordreHors = (tree: BlockNode[] = []) => tree.filter((s) => !sectionAutorisee(zone, s, hero) && ra.has(s.id) && rb.has(s.id)).map((s) => s.id).join(",");
  const ordreIntact = ordreHors(avant.builderTree) === ordreHors(apres.builderTree);
  for (const c of comparer(avant, apres)) {
    if (c.type === "deplacement" && ordreIntact && (avant.builderTree ?? []).some((s: BlockNode) => s.id === c.cible)) continue;
    if (c.cible.startsWith("page:")) {
      if (zone !== "boutique" && zone !== "pages" && zone !== c.cible) hors.push(`${c.detail} (page hors de la zone « ${zone} »)`);
      continue;
    }
    if (!ra.has(c.cible) && !rb.has(c.cible)) continue; // jeton de thème : contrôlé avec les clés ci-dessous
    const s = rb.get(c.cible) ?? ra.get(c.cible);
    if (intention.exclus.includes(s!.id)) hors.push(`${c.detail} (section protégée ${s!.id})`);
    else if (zone === "assets" ? c.type !== "modification" : !sectionAutorisee(zone, s, hero)) hors.push(`${c.detail} (hors de la zone « ${zone} »)`);
  }
  for (const { cle, sous } of clesModifiees(avant, apres)) if (!cleAutorisee(zone, cle, sous)) hors.push(`réglage « ${cle} » (hors de la zone « ${zone} »)`);

  if (intention.appareil === "mobile" && JSON.stringify(sansMobile(avant)) !== JSON.stringify(sansMobile(apres))) {
    const reste = comparer(sansMobile(avant) as any, sansMobile(apres) as any);
    hors.push(`changement visible hors mobile : ${reste.slice(0, 3).map((c) => c.detail).join(", ") || "réglages généraux"}`);
  }
  return hors;
}

// ─── Marque ──────────────────────────────────────────────────────────────────
export interface Marque { couleurs: string[]; interdites: string[]; polices: string[]; strict: boolean }

export function normCouleur(c: unknown): string | null {
  if (typeof c !== "string") return null;
  const v = c.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${[...v.slice(1)].map((x) => x + x).join("")}`;
  return /^#[0-9a-f]{6}$/.test(v) ? v : COULEURS[sansAccents(v)] ?? null;
}

/** Marque lue telle que la renvoie axso_builder_get_brand ou themeConfig.marque (formes tolérées). */
export function lireMarque(brut: any): Marque {
  const b = brut?.marque ?? brut?.brand ?? brut ?? {};
  const couleursDe = (v: any): string[] => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [])
    .map((x: any) => normCouleur(typeof x === "object" ? x?.hex ?? x?.valeur : x)).filter((x: string | null): x is string => !!x);
  const polices = (Array.isArray(b.polices ?? b.fonts) ? b.polices ?? b.fonts : Object.values(b.polices ?? b.fonts ?? {})).filter((x: unknown) => typeof x === "string");
  return {
    couleurs: couleursDe(b.couleurs ?? b.colors ?? b.palette),
    interdites: couleursDe(b.couleursInterdites ?? b.couleurs_interdites ?? b.forbidden_colors ?? b.interdits?.couleurs),
    polices, strict: b.strict === true || b.verrouillee === true || b.locked === true,
  };
}

const couleursDans = (v: unknown, out = new Set<string>()): Set<string> => {
  for (const m of JSON.stringify(v ?? {}).matchAll(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g)) out.add(normCouleur(m[0])!);
  return out;
};

/** Conflits avec la marque : couleur demandée ou introduite interdite (ou hors palette d'une marque stricte), police hors marque stricte. */
export function conflitsMarque(intention: Pick<Intention, "couleurs">, marque: Marque, avant?: Record<string, any>, apres?: Record<string, any>): string[] {
  const out: string[] = [];
  const horsPalette = (c: string) => marque.strict && marque.couleurs.length > 0 && !marque.couleurs.includes(c);
  for (const c of intention.couleurs) {
    if (marque.interdites.includes(c)) out.push(`la couleur ${c} est interdite par la charte de marque`);
    else if (horsPalette(c)) out.push(`la couleur ${c} n'est pas dans la palette de la marque (${marque.couleurs.join(", ")})`);
  }
  if (avant && apres) {
    const deja = couleursDans(avant);
    for (const c of couleursDans(apres)) {
      if (deja.has(c)) continue;
      if (marque.interdites.includes(c)) out.push(`la couleur ${c} introduite est interdite par la marque`);
      else if (horsPalette(c)) out.push(`la couleur ${c} introduite est hors palette de la marque`);
    }
    if (marque.strict && marque.polices.length) {
      for (const [k, p] of Object.entries((apres.fonts ?? {}) as Record<string, unknown>)) {
        if (typeof p === "string" && p !== avant.fonts?.[k] && !marque.polices.includes(p)) out.push(`la police « ${p} » n'est pas une police de la marque`);
      }
    }
  }
  return [...new Set(out)];
}

// ─── Plan : validation et simulation ─────────────────────────────────────────
export interface EtapePlan extends EtapeOperation { titre: string }
const METIER = /checkout|panier|paiement|confirmation/i;
const copie = <T,>(v: T): T => JSON.parse(JSON.stringify(v ?? {}));

/** Étapes proposées (modèle, analyses) → étapes d'opérations du registre aux paramètres conformes. */
export function validerEtapes(brut: unknown, registre: OperationBuilder[]): { etapes: EtapePlan[]; rejets: string[] } {
  const liste = (Array.isArray(brut) ? brut : (brut as any)?.etapes) ?? [];
  if (!Array.isArray(liste) || !liste.length) return { etapes: [], rejets: [] };
  const outils = registre.map((o) => ({ name: o.nom, inputSchema: o.parameters }));
  const v = validerPlan(liste.map((e: any) => ({ outil: e?.op ?? e?.outil, args: e?.args ?? {}, titre: e?.titre ?? e?.title })), outils);
  const rejets = [...v.rejets, ...(v.erreur && !v.rejets.length ? [v.erreur] : [])];
  const etapes = v.etapes.filter((e) => {
    // Pas de référence entre étapes : chaque opération est complète au moment du plan.
    if (dependances(e.args).length) { rejets.push(`${e.id} (${e.outil}) : référence à une autre étape non admise`); return false; }
    return true;
  }).map((e) => ({ op: e.outil, args: e.args, titre: e.titre }));
  return { etapes, rejets };
}

export interface Simulation { config: Record<string, any>; retenues: EtapePlan[]; rejets: string[]; conflits: string[]; invalide: string[] }

/**
 * Applique les étapes une à une sur une COPIE (rien n'est enregistré) : une étape qui échoue,
 * sort de la portée, touche au paiement ou heurte la marque est écartée et dite. `simple` :
 * n'admet que des étapes à risque faible (auto-correction).
 */
export function simuler(
  cfg: Record<string, any>, etapes: EtapePlan[], registre: Map<string, OperationBuilder>, donnees: DonneesBoutique,
  intention: Pick<Intention, "zone" | "appareil" | "exclus" | "couleurs">, marque: Marque, opts: { simple?: boolean } = {},
): Simulation {
  let cur = copie(cfg);
  const retenues: EtapePlan[] = [], rejets: string[] = [], conflits: string[] = [];
  for (const [i, e] of etapes.entries()) {
    const nom = `${i + 1}. ${e.titre || e.op}`;
    const op = registre.get(e.op);
    if (!op) { rejets.push(`${nom} : opération inconnue`); continue; }
    if (opts.simple && op.risque === "moyen") { rejets.push(`${nom} : pas une correction simple`); continue; }
    let suivant: Record<string, any>;
    try { suivant = op.appliquer(copie(cur) as any, copie(e.args ?? {}), donnees) as any; }
    catch (err) { rejets.push(`${nom} : ${err instanceof ErreurBuilder ? err.message : "erreur de l'opération"}`); continue; }
    const ch = comparer(cur, suivant);
    if (!ch.length && JSON.stringify(cur) === JSON.stringify(suivant)) { rejets.push(`${nom} : ne change rien`); continue; }
    const hors = horsPortee(cur, suivant, intention);
    if (hors.length) { rejets.push(`${nom} : hors de la portée demandée — ${hors.slice(0, 2).join(" ; ")}`); continue; }
    if ([...ch.map((c) => c.cible), ...clesModifiees(cur, suivant).map((k) => k.cle)].some((c) => METIER.test(c))) { rejets.push(`${nom} : touche au parcours d'achat (panier, paiement), interdit à une IA`); continue; }
    const marqueKo = conflitsMarque({ couleurs: [] }, marque, cur, suivant);
    if (marqueKo.length) { conflits.push(`${nom} : ${marqueKo.join(" ; ")}`); continue; }
    if (opts.simple && risqueChangements(ch).risque !== "faible") { rejets.push(`${nom} : pas une correction simple (risque ${risqueChangements(ch).risque})`); continue; }
    cur = suivant;
    retenues.push(e);
  }
  return { config: cur, retenues, rejets, conflits, invalide: retenues.length ? validerConfig(cur, cfg) : [] };
}

/** Gèle les étapes d'un plan validé : rien de ce qui est lu ensuite ne peut les changer. */
export function figer<T>(v: T): T {
  if (v && typeof v === "object") { Object.values(v).forEach(figer); Object.freeze(v); }
  return v;
}

// ─── Problèmes renvoyés par les analyses ─────────────────────────────────────
export interface Probleme { gravite: string; domaine: string; cible: string; message: string; correction: EtapeOperation | null }

/** Problèmes d'un résultat d'analyse (donnees.problemes ou donnees.issues), bornés. Le message est une DONNÉE. */
export function problemesDe(donnees: Record<string, unknown> | undefined): Probleme[] {
  const brut = (donnees?.problemes ?? donnees?.issues) as unknown;
  if (!Array.isArray(brut)) return [];
  return brut.slice(0, 60).filter((p) => p && typeof p === "object").map((p: any) => ({
    gravite: String(p.gravite ?? p.severity ?? "info").slice(0, 20), domaine: String(p.domaine ?? p.domain ?? "").slice(0, 30),
    cible: String(p.cible ?? p.target ?? "").slice(0, 90), message: String(p.message ?? "").slice(0, 300),
    correction: p.correction && typeof p.correction === "object" && typeof p.correction.op === "string"
      ? { op: p.correction.op, args: p.correction.args && typeof p.correction.args === "object" && !Array.isArray(p.correction.args) ? p.correction.args : {} } : null,
  }));
}

/**
 * Corrections automatiques admises : seulement des opérations du registre, simples (risque
 * faible), dans la portée de l'intention et sans conflit de marque — vérifié par simulation.
 * Le texte du problème n'entre jamais dans la décision.
 */
export function correctionsAdmissibles(
  problemes: Probleme[], registre: Map<string, OperationBuilder>, cfg: Record<string, any>, donnees: DonneesBoutique,
  intention: Pick<Intention, "zone" | "appareil" | "exclus" | "couleurs">, marque: Marque, max = 10,
): Simulation {
  const vues = new Set<string>();
  const etapes = problemes.filter((p) => p.correction).map((p) => ({ op: p.correction!.op, args: p.correction!.args, titre: `Correction ${p.domaine || "auto"} : ${p.cible || p.correction!.op}`.slice(0, 120) }))
    .filter((e) => { const k = JSON.stringify([e.op, e.args]); return !vues.has(k) && vues.add(k); }).slice(0, max);
  return simuler(cfg, etapes, registre, donnees, intention, marque, { simple: true });
}
