// Liens de navigation des designs AXSO (Templates/*.html) — les fichiers
// livrent un 3ᵉ lien d'en-tête qui double « Collection » (Sur-mesure, Drops,
// Bracelets…) et un pied de page plein de liens morts (Presse, Nos riders,
// Livraison, Contact… sans destination). On les remplace par les pages qui
// existent vraiment : À propos et Contact (toujours rendues, avec repli).
// Pur et idempotent : appliqué au rendu de la vitrine ET au chargement du
// Constructeur, pour toutes les boutiques existantes sans migration.
import { parse, type HTMLElement as El } from "node-html-parser";
import type { BlockNode, ThemeConfig } from "./theme-config";

const CHAMPS_HTML = ["builderHtml", "builderHtmlProduits", "builderHtmlProduit", "builderHtmlPanierChrome", "builderHtmlCheckoutChrome", "builderHtmlConfirmationChrome"] as const;

const lienMort = (a: El) => ["", "#"].includes((a.getAttribute("href") ?? "").trim());

function lienVers(modele: El, texte: string, href: string): El {
  const a = parse(modele.outerHTML).querySelector("a")!;
  a.removeAttribute("data-axs-el"); // nouvel élément : identifiant posé au 1er clic dans le Constructeur
  a.removeAttribute("id");
  a.classList.remove("active");
  a.setAttribute("href", href);
  a.set_content(texte);
  return a;
}

function corrigerEntete(header: El, slug: string) {
  const liens = header.querySelectorAll("a[href]").filter((a) => {
    const h = a.getAttribute("href")!;
    return (h === `/${slug}` || h.startsWith(`/${slug}/`)) && !/\/(panier|wishlist)$/.test(h);
  });
  if (!liens.length) return;
  const aPropos = liens.find((a) => a.getAttribute("href")!.endsWith("/a-propos"));
  let dernier = liens[liens.length - 1];
  if (!aPropos) {
    const doublon = liens.filter((a) => a.getAttribute("href") === `/${slug}/produits`)[1];
    if (doublon) { doublon.setAttribute("href", `/${slug}/a-propos`); doublon.set_content("À propos"); dernier = doublon; }
    else { const n = lienVers(dernier, "À propos", `/${slug}/a-propos`); dernier.insertAdjacentHTML("afterend", n.outerHTML); dernier = dernier.nextElementSibling as El; }
  } else dernier = aPropos;
  if (!liens.some((a) => a.getAttribute("href")!.endsWith("/contact")))
    dernier.insertAdjacentHTML("afterend", lienVers(dernier, "Contact", `/${slug}/contact`).outerHTML);
}

function corrigerPied(footer: El, slug: string) {
  let aPropos = footer.querySelectorAll("a[href]").some((a) => a.getAttribute("href")!.endsWith("/a-propos"));
  for (const a of footer.querySelectorAll("a")) {
    if (!lienMort(a)) continue;
    if (/contact/i.test(a.text)) { a.setAttribute("href", `/${slug}/contact`); continue; }
    if (!aPropos) { a.setAttribute("href", `/${slug}/a-propos`); a.set_content("À propos"); aPropos = true; continue; }
    const li = a.parentNode as El;
    (li?.tagName === "LI" && li.childNodes.every((n) => n === a || !n.text.trim()) ? li : a).remove();
  }
}

export function corrigerLiensHtml(html: string | undefined): string | undefined {
  if (!html || !/<(header|footer)\b/.test(html)) return html;
  const slug = html.match(/href="\/([^/"?#]+)\/(?:produits|panier)"/)?.[1];
  if (!slug) return html;
  const racine = parse(html);
  racine.querySelectorAll("header").forEach((h) => corrigerEntete(h, slug));
  racine.querySelectorAll("footer").forEach((f) => corrigerPied(f, slug));
  return racine.toString();
}

function corrigerArbre(nodes: BlockNode[]): BlockNode[] {
  return nodes.map((n) => ({
    ...n,
    ...(n.type === "embed-html" && n.config?.html ? { config: { ...n.config, html: corrigerLiensHtml(n.config.html) } } : {}),
    ...(n.children ? { children: corrigerArbre(n.children) } : {}),
  }));
}

export function corrigerLiensDesign<T extends ThemeConfig>(cfg: T): T {
  const out: any = { ...cfg };
  for (const k of CHAMPS_HTML) if (typeof out[k] === "string") out[k] = corrigerLiensHtml(out[k]);
  if (cfg.builderTree?.length) out.builderTree = corrigerArbre(cfg.builderTree);
  return out;
}
