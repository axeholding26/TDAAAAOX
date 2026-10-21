// Validation d'une configuration de boutique avant enregistrement (pur). Une modification
// qui casse la structure, invente un type de bloc ou injecte du code dans la vitrine est
// refusée : le moteur n'enregistre alors rien.
import type { BlockNode, BlockNodeType } from "@/lib/theme-config";
import { peutDeposer } from "@/lib/block-tree";
import { BLOCK_CATALOG } from "@/lib/block-catalog";

const TYPES = new Set<string>([...BLOCK_CATALOG.map((e) => e.type), "embed-html"]);
// Code exécutable dans un texte, un lien ou du HTML : jamais accepté d'une IA.
export const DANGEREUX = /<\s*\/?\s*(script|iframe|object|embed|base|meta|link)\b|\bon[a-z]+\s*=|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|expression\s*\(|@import/i;
// Un design importé peut déjà contenir du code : on refuse seulement ce qui en AJOUTE.
const nbDangers = (t: string | undefined) => (t ? t.match(new RegExp(DANGEREUX.source, "gi"))?.length ?? 0 : 0);
const COULEUR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|transparent|inherit|currentColor|var\(--[\w-]+\)|[a-z]+)$/i;

function parcourir(nodes: BlockNode[], parent: BlockNodeType | "root", vus: Set<string>, avant: Map<string, string>, erreurs: string[]) {
  for (const n of nodes ?? []) {
    if (!n || typeof n !== "object" || typeof n.id !== "string" || !n.id) { erreurs.push("bloc sans identifiant"); continue; }
    if (vus.has(n.id)) erreurs.push(`identifiant en double : ${n.id}`);
    vus.add(n.id);
    // Seuls les blocs nouveaux ou modifiés sont contrôlés : les designs importés d'origine
    // (embed-html placé hors des règles d'imbrication) restent tels quels.
    const contenu = JSON.stringify({ c: n.config, s: n.style });
    const dupliqueDesign = n.type === "embed-html" && avant.has(`html:${n.config?.html}`);
    const touche = avant.get(n.id) !== contenu && !dupliqueDesign;
    if (!TYPES.has(n.type)) erreurs.push(`type de bloc inconnu : ${n.type}`);
    else if (touche && n.type !== "embed-html" && !peutDeposer(parent, n.type)) erreurs.push(`« ${n.type} » ne peut pas être placé dans « ${parent} » (règle section → ligne → colonne → bloc)`);
    if (touche && nbDangers(contenu) > nbDangers(avant.get(n.id))) erreurs.push(`code non autorisé dans le bloc ${n.id} (script, gestionnaire d'événement ou lien javascript)`);
    // Un bloc de design brut ne peut qu'être dupliqué à l'identique, jamais écrit par une IA.
    if (n.type === "embed-html" && avant.get(n.id) === undefined && !dupliqueDesign) erreurs.push("un bloc de design brut (embed-html) ne peut pas être créé par une IA");
    if (n.children?.length) parcourir(n.children, n.type, vus, avant, erreurs);
  }
}

function indexer(nodes: BlockNode[] = [], out = new Map<string, string>()) {
  for (const n of nodes) {
    out.set(n.id, JSON.stringify({ c: n.config, s: n.style }));
    if (n.type === "embed-html") out.set(`html:${n.config?.html}`, "");
    indexer(n.children, out);
  }
  return out;
}

/** Liste des problèmes (vide si la configuration est acceptable). `avant` : la configuration de départ. */
export function validerConfig(cfg: Record<string, any>, avant: Record<string, any> = {}): string[] {
  const erreurs: string[] = [];
  const idsAvant = indexer(avant.builderTree);
  parcourir(cfg.builderTree ?? [], "root", new Set(), idsAvant, erreurs);
  for (const [slug, page] of Object.entries((cfg.pagesPerso ?? {}) as Record<string, any>)) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60) erreurs.push(`adresse de page invalide : ${slug}`);
    parcourir(page?.builderTree ?? [], "root", new Set(), indexer(avant.pagesPerso?.[slug]?.builderTree), erreurs);
  }
  for (const [cle, v] of Object.entries((cfg.colors ?? {}) as Record<string, unknown>)) {
    if (v !== undefined && (typeof v !== "string" || !COULEUR.test(v.trim()))) erreurs.push(`couleur invalide (${cle}) : ${String(v).slice(0, 40)}`);
  }
  if (cfg.customCss !== avant.customCss && typeof cfg.customCss === "string" && (nbDangers(cfg.customCss) > nbDangers(avant.customCss) || /<\/style/i.test(cfg.customCss))) erreurs.push("CSS personnalisé refusé (code non autorisé)");
  for (const cle of ["builderHtml", "builderCss", "builderHtmlProduits", "builderHtmlProduit", "builderHtmlPanierChrome", "builderHtmlCheckoutChrome", "builderHtmlConfirmationChrome", "axsoDesignCarteTemplate"]) {
    if (cfg[cle] !== avant[cle]) erreurs.push(`le design importé (${cle}) ne se modifie pas par une IA`);
  }
  // CSS d'une page importée : même règle que le design importé.
  for (const [cle, page] of Object.entries((cfg.pagesPerso ?? {}) as Record<string, any>)) {
    if (page?.css !== undefined && page.css !== avant.pagesPerso?.[cle]?.css) erreurs.push(`le CSS de la page importée « ${cle} » ne se modifie pas par une IA`);
  }
  return erreurs;
}
