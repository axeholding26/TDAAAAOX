// Liens de navigation des designs AXSO (Templates/*.html) — les fichiers
// livrent un 3ᵉ lien d'en-tête qui double « Collection » (Sur-mesure, Drops,
// Bracelets…) et un pied de page plein de liens morts (Presse, Nos riders,
// Livraison, Contact… sans destination). On les remplace par les pages qui
// existent vraiment : À propos, Contact et Mon compte (toujours rendues, avec repli).
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

function corrigerEntete(header: El, slug: string, digital?: boolean) {
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
  let contact = liens.find((a) => a.getAttribute("href")!.endsWith("/contact"));
  if (!contact) { dernier.insertAdjacentHTML("afterend", lienVers(dernier, "Contact", `/${slug}/contact`).outerHTML); contact = dernier.nextElementSibling as El; }
  // Espace client, après Contact. Digital : le bouton « Mes achats » y mène déjà (adapterDigital).
  if (!digital && !header.querySelector(`a[href="/${slug}/mon-compte"]`))
    contact.insertAdjacentHTML("afterend", lienVers(contact, "Mon compte", `/${slug}/mon-compte`).outerHTML);
  // Un seul lien vers le catalogue (les autres portaient une catégorie inventée menant à la même page).
  header.querySelectorAll(`a[href="/${slug}/produits"]`).slice(1).forEach(retirer);
}

// Pas de bouton Panier dans l'en-tête (le panier s'ouvre depuis la
// notification « ajouté au panier » de la fiche produit). Remplacé par un
// repère masqué qui garde les id du bouton (les scripts du design les
// cherchent) et sert d'ancre au lien Favoris (NavigationDesign).
function retirerPanier(racine: El, slug: string) {
  for (const a of racine.querySelectorAll(`header a[href="/${slug}/panier"], header [onclick="go('panier')"]`)) {
    const ids = a.querySelectorAll("[id]").map((el) => `<span id="${el.id}"></span>`).join("");
    a.replaceWith(`<span data-axs-panier-retire style="display:none">${ids}</span>`);
  }
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

// ─── Boutique digitale (modeBoutique "digital") ──────────────────────────────
// Mêmes designs que le physique : achat direct sans panier, rien à livrer.
// Le lien Panier de l'en-tête devient « Mes achats » (Mon compte : achats et
// téléchargements) et les mentions de livraison/retours disparaissent — bandeau
// « A — B », case d'une grille de chiffres clés, élément de défilement.
const LIVRAISON = /livraison|livré|exp[ée]di|retours?\s+(sous|gratuit)|montage inclus/i;

function adapterDigital(racine: El, slug: string) {
  for (const a of racine.querySelectorAll(`a[href="/${slug}/panier"], a[onclick="go('panier')"]`)) {
    a.removeAttribute("onclick");
    const ids = a.querySelectorAll("[id]").map((el) => { el.setAttribute("style", "display:none"); return el.outerHTML; }); // aperçu : ses scripts les cherchent
    a.setAttribute("href", `/${slug}/mon-compte`);
    a.setAttribute("data-axs-achats", "");
    a.set_content(`Mes achats${ids.join("")}`);
  }
  const feuilles = racine.querySelectorAll("*").filter((el) => {
    if (["SCRIPT", "STYLE"].includes(el.tagName)) return false;
    const propre = el.childNodes.filter((n) => n.nodeType === 3).map((n) => n.text).join(" ").trim();
    return propre.length < 90 && LIVRAISON.test(propre);
  });
  for (const el of feuilles) {
    if (!el.parentNode) continue; // déjà retiré avec sa case
    const texte = el.text.trim();
    if (!LIVRAISON.test(texte)) continue; // case déjà réécrite
    const segments = texte.split(/\s+[—–]\s+/);
    if (segments.length > 1) {
      const restants = segments.filter((s) => !LIVRAISON.test(s));
      if (restants.length) el.set_content(restants.join(" — ")); else el.remove();
      continue;
    }
    const parent = el.parentNode as El;
    const cellule = parent.childNodes.filter((n) => n.nodeType === 3).every((n) => !n.text.trim()) ? parent.children : [];
    if (cellule.length === 2 && cellule.includes(el)) {
      const maj = texte === texte.toUpperCase();
      cellule[0].set_content("24/7");
      cellule[1].set_content(maj ? "ACCÈS IMMÉDIAT" : "Accès immédiat");
      continue;
    }
    const sep = [el.nextElementSibling, el.previousElementSibling].find((s) => s && /^[—–]$/.test(s.text.trim()));
    sep?.remove();
    el.remove();
  }
}

// `options.slug` : indispensable pour une section de pied de page seule sans
// aucun lien (Aube, Cadran), d'où l'adresse ne peut pas se déduire.
export interface OptionsLiens { slug?: string; collections?: CollectionLien[]; digital?: boolean }

export function corrigerLiensHtml(html: string | undefined, { slug: slugConnu, collections, digital }: OptionsLiens = {}): string | undefined {
  if (!html) return html;
  const avecChrome = /<(header|footer)\b/.test(html);
  if (!avecChrome && !digital) return html;
  const slug = slugConnu || html.match(/href="\/([^/"?#]+)\/(?:produits|panier)"/)?.[1];
  if (!slug) return html;
  const racine = parse(html);
  racine.querySelectorAll("header").forEach((h) => corrigerEntete(h, slug, digital));
  racine.querySelectorAll("footer").forEach((f) => corrigerPied(f, slug, collections));
  // Boutique digitale : le bouton devient « Mes achats » (adapterDigital), il reste.
  if (digital) adapterDigital(racine, slug); else retirerPanier(racine, slug);
  return racine.toString();
}

/** Aperçu brut d'un design (/api/preview-theme) : seul le <body> est retouché, le document (doctype, scripts) reste intact. */
export function adapterDocument(doc: string, digital: boolean): string {
  const debut = doc.search(/<body\b/i), fin = doc.search(/<\/body>/i);
  if (debut < 0 || fin < 0) return doc;
  const racine = parse(doc.slice(debut, fin));
  if (digital) adapterDigital(racine, "apercu"); else retirerPanier(racine, "apercu");
  // Fiche produit de démonstration : pas de panier, on commande (ou on achète, en digital) directement.
  for (const el of racine.querySelectorAll("button, a")) {
    if (/ajouter au panier/i.test(el.text)) el.set_content(el.innerHTML.replace(/ajouter au panier/i, digital ? "Acheter" : "Commander"));
  }
  return doc.slice(0, debut) + racine.toString() + doc.slice(fin);
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
