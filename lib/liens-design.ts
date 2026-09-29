// Liens de navigation des designs AXSO (Templates/*.html) — les fichiers
// livrent un 3ᵉ lien d'en-tête qui double « Collection » (Sur-mesure, Drops,
// Bracelets…) et un pied de page plein de liens morts (Presse, Nos riders,
// Livraison, Contact… sans destination). On les remplace par les pages qui
// existent vraiment : À propos et Contact (toujours rendues, avec repli).
// Pied de page : chaque page de la boutique y a son lien (catalogue,
// collections, À propos, Contact, Mon compte, CGU, confidentialité), une
// seule fois — doublons, Panier (déjà dans l'en-tête) et Commander (panier
// vide) retirés.
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

// Retire un lien, avec son <li> s'il n'y est que lui.
function retirer(a: El) {
  const li = a.parentNode as El;
  (li?.tagName === "LI" && li.childNodes.every((n) => n === a || !n.text.trim()) ? li : a).remove();
}

// Ajoute un lien juste après `ref`, dans le même style (dans un <li> copié du sien le cas échéant).
function ajouterApres(ref: El, texte: string, href: string): El {
  const lien = lienVers(ref, texte, href).outerHTML;
  const li = ref.parentNode as El;
  if (li?.tagName === "LI") {
    const copie = parse(li.outerHTML).firstChild as El;
    copie.removeAttribute("id");
    copie.set_content(lien);
    li.insertAdjacentHTML("afterend", copie.outerHTML);
    return (li.nextElementSibling as El).querySelector("a")!;
  }
  ref.insertAdjacentHTML("afterend", lien);
  return ref.nextElementSibling as El;
}

const hrefDe = (a: El) => a.getAttribute("href") ?? "";

function corrigerEntete(header: El, slug: string) {
  const liens = header.querySelectorAll("a[href]").filter((a) => {
    const h = a.getAttribute("href")!;
    return (h === `/${slug}` || h.startsWith(`/${slug}/`)) && !/\/(panier|wishlist|mon-compte)$/.test(h);
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
  // Un seul lien vers le catalogue (les autres portaient une catégorie inventée menant à la même page).
  header.querySelectorAll(`a[href="/${slug}/produits"]`).slice(1).forEach(retirer);
}

export interface CollectionLien { slug: string; nom: string }

const MENTIONS = /Confidentialit[ée]\s*[—–-]\s*Conditions g[ée]n[ée]rales/;

function corrigerPied(footer: El, slug: string, collections?: CollectionLien[]) {
  let aPropos = footer.querySelectorAll("a[href]").some((a) => a.getAttribute("href")!.endsWith("/a-propos"));
  for (const a of footer.querySelectorAll("a")) {
    if (!lienMort(a)) continue;
    if (/contact/i.test(a.text)) { a.setAttribute("href", `/${slug}/contact`); continue; }
    if (!aPropos) { a.setAttribute("href", `/${slug}/a-propos`); a.set_content("À propos"); aPropos = true; continue; }
    retirer(a);
  }
  // Superflus : Panier (dans l'en-tête), Commander (ouvre la commande même panier vide), doublons.
  const vus = new Set<string>();
  for (const a of footer.querySelectorAll("a[href]")) {
    const h = hrefDe(a);
    if (/\/(panier|checkout)$/.test(h) || vus.has(h)) retirer(a);
    else vus.add(h);
  }
  const liens = footer.querySelectorAll("a[href]");
  const vers = (fin: string) => liens.find((a) => hrefDe(a) === `/${slug}${fin}`);
  // Pages sans lien : ajoutées à la suite d'À propos, dans le même style.
  let ref = vers("/a-propos") ?? liens[liens.length - 1];
  if (!ref) return;
  if (!vers("/a-propos")) ref = ajouterApres(ref, "À propos", `/${slug}/a-propos`);
  ref = vers("/contact") ?? ajouterApres(ref, "Contact", `/${slug}/contact`);
  if (!vers("/mon-compte")) ref = ajouterApres(ref, "Mon compte", `/${slug}/mon-compte`);
  if (!vers("/produits")) ajouterApres(ref, "Tous les produits", `/${slug}/produits`);
  // Colonne vidée par le nettoyage (titre « Service » sans plus aucun lien) : retirée.
  for (const ul of footer.querySelectorAll("ul")) {
    if (ul.querySelectorAll("a").length) continue;
    const bloc = ul.parentNode as El;
    (bloc && bloc !== footer && !bloc.querySelectorAll("a").length ? bloc : ul).remove();
  }
  // Collections de la boutique, après le lien du catalogue (vitrine uniquement : la liste vient de la base).
  const catalogue = footer.querySelectorAll("a[href]").find((a) => hrefDe(a) === `/${slug}/produits`);
  if (catalogue && collections?.length && !liens.some((a) => hrefDe(a).includes(`/${slug}/collections/`))) {
    let apres = catalogue;
    for (const c of collections.slice(0, 6)) apres = ajouterApres(apres, c.nom, `/${slug}/collections/${c.slug}`);
  }
  // « Confidentialité — Conditions générales » : du texte dans les designs → vrais liens.
  if (!footer.querySelector('a[href^="/legal/"]')) {
    const mentions = footer.querySelectorAll("*").find((el) => el.childNodes.every((n) => n.nodeType === 3) && MENTIONS.test(el.text));
    mentions?.set_content(mentions.innerHTML.replace(MENTIONS, '<a href="/legal/privacy" style="color:inherit">Confidentialité</a> — <a href="/legal/cgu" style="color:inherit">Conditions générales</a>'));
  }
}

// `options.slug` : indispensable pour une section de pied de page seule sans
// aucun lien (Aube, Cadran), d'où l'adresse ne peut pas se déduire.
export interface OptionsLiens { slug?: string; collections?: CollectionLien[] }

export function corrigerLiensHtml(html: string | undefined, { slug: slugConnu, collections }: OptionsLiens = {}): string | undefined {
  if (!html || !/<(header|footer)\b/.test(html)) return html;
  const slug = slugConnu || html.match(/href="\/([^/"?#]+)\/(?:produits|panier)"/)?.[1];
  if (!slug) return html;
  const racine = parse(html);
  racine.querySelectorAll("header").forEach((h) => corrigerEntete(h, slug));
  racine.querySelectorAll("footer").forEach((f) => corrigerPied(f, slug, collections));
  return racine.toString();
}

function corrigerArbre(nodes: BlockNode[], options: OptionsLiens): BlockNode[] {
  return nodes.map((n) => ({
    ...n,
    ...(n.type === "embed-html" && n.config?.html ? { config: { ...n.config, html: corrigerLiensHtml(n.config.html, options) } } : {}),
    ...(n.children ? { children: corrigerArbre(n.children, options) } : {}),
  }));
}

export function corrigerLiensDesign<T extends ThemeConfig>(cfg: T, options: OptionsLiens = {}): T {
  const out: any = { ...cfg };
  for (const k of CHAMPS_HTML) if (typeof out[k] === "string") out[k] = corrigerLiensHtml(out[k], options);
  if (cfg.builderTree?.length) out.builderTree = corrigerArbre(cfg.builderTree, options);
  return out;
}
