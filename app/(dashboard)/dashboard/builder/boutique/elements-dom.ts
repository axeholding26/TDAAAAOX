// Éléments d'une section de design (bloc embed-html) : un titre, un bouton,
// une image… du HTML d'origine. Un élément devient sélectionnable/stylable dès
// qu'il porte un attribut `data-axs-el` (posé au premier clic, enregistré dans
// le HTML de la section) ; ses styles vivent dans config.elementStyles du bloc
// (lib/element-styles.ts). Navigateur uniquement (DOMParser).

export const ATTR_EL = "data-axs-el";

export function genElId(): string {
  return `el_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Élément réellement visé par un clic/survol : un <svg> entier plutôt qu'un de ses tracés. */
export function cibleSelectionnable(t: EventTarget | null, racine: HTMLElement): HTMLElement | null {
  if (!(t instanceof Element)) return null;
  const el = (t.closest("svg") ?? t) as HTMLElement;
  return el !== racine && racine.contains(el) ? el : null;
}

export function nomElement(tag: string, classe = ""): string {
  const t = tag.toLowerCase();
  if (/^h[1-6]$/.test(t)) return `Titre (${t.toUpperCase()})`;
  if (t === "button" || (t === "a" && /btn|button|cta/i.test(classe))) return "Bouton";
  if (t === "a") return "Lien";
  if (t === "img") return "Image";
  if (t === "svg") return "Icône";
  if (t === "p") return "Paragraphe";
  if (t === "input" || t === "textarea" || t === "select") return "Champ de formulaire";
  if (t === "ul" || t === "ol") return "Liste";
  if (t === "li") return "Élément de liste";
  if (["span", "strong", "em", "b", "i", "small", "label"].includes(t)) return "Texte";
  if (t === "header") return "En-tête";
  if (t === "footer") return "Pied de page";
  if (t === "nav") return "Menu";
  return "Bloc";
}

export interface InfoElement {
  tag: string;
  nom: string;
  texte: string | null; // null : l'élément contient d'autres éléments (texte non éditable d'un bloc)
  texteEnLigne: boolean; // texte mis en forme (retours à la ligne, italique…) : à modifier dans l'aperçu
  lien: string | null;
  image: string | null;
  alt: string | null;
  placeholder: string | null;
}

function parser(html: string): Document {
  return new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html");
}

export function lireElement(html: string, id: string): InfoElement | null {
  const el = parser(html).querySelector(`[${ATTR_EL}="${id}"]`);
  if (!el) return null;
  const tag = el.tagName.toLowerCase();
  const sansEnfants = el.children.length === 0 && !["img", "input", "textarea", "select", "svg"].includes(tag);
  return {
    tag,
    nom: nomElement(tag, el.getAttribute("class") || ""),
    texte: sansEnfants ? el.textContent ?? "" : null,
    texteEnLigne: !sansEnfants && !!el.textContent?.trim() && !["img", "input", "textarea", "select", "svg"].includes(tag),
    lien: tag === "a" ? el.getAttribute("href") ?? "" : null,
    image: tag === "img" ? el.getAttribute("src") ?? "" : null,
    alt: tag === "img" ? el.getAttribute("alt") ?? "" : null,
    placeholder: tag === "input" || tag === "textarea" ? el.getAttribute("placeholder") ?? "" : null,
  };
}

/** Applique `modif` à l'élément `id` du HTML ; renvoie le nouveau HTML (inchangé si introuvable). */
export function modifierElement(html: string, id: string, modif: (el: Element) => void): string {
  const doc = parser(html);
  const el = doc.querySelector(`[${ATTR_EL}="${id}"]`);
  if (!el) return html;
  modif(el);
  return doc.body.innerHTML;
}

export function appliquerContenu(el: Element, patch: Partial<Pick<InfoElement, "texte" | "lien" | "image" | "alt" | "placeholder">>) {
  if (patch.texte != null && el.children.length === 0) el.textContent = patch.texte;
  if (patch.lien != null) el.setAttribute("href", patch.lien);
  if (patch.image != null) el.setAttribute("src", patch.image);
  if (patch.alt != null) el.setAttribute("alt", patch.alt);
  if (patch.placeholder != null) el.setAttribute("placeholder", patch.placeholder);
}

/**
 * Parent de l'élément `id`, en lui posant un identifiant si besoin. `null` si
 * le parent est la racine de la section (on sélectionne alors la section).
 */
export function selectionnerParent(html: string, id: string): { html: string; id: string } | null {
  const doc = parser(html);
  const parent = doc.querySelector(`[${ATTR_EL}="${id}"]`)?.parentElement;
  if (!parent || parent === doc.body) return null;
  let idParent = parent.getAttribute(ATTR_EL);
  if (!idParent) { idParent = genElId(); parent.setAttribute(ATTR_EL, idParent); }
  return { html: doc.body.innerHTML, id: idParent };
}
