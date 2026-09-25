// Pages de la boutique éditables depuis le Constructeur (sélecteur de la
// barre du haut) — partagé par le Constructeur physique et le digital.
export type PageEditee = "accueil" | "catalogue" | "produit" | "panier" | "commande" | "apropos" | "contact";

export const PAGES: { id: PageEditee; label: string; chemin: string }[] = [
  { id: "accueil",   label: "Page d'accueil", chemin: "" },
  { id: "catalogue", label: "Catalogue",      chemin: "/produits" },
  { id: "produit",   label: "Fiche produit",  chemin: "/produits/:id" },
  { id: "panier",    label: "Panier",         chemin: "/panier" },
  { id: "commande",  label: "Commande",       chemin: "/checkout" },
  { id: "apropos",   label: "À propos",       chemin: "/a-propos" },
  { id: "contact",   label: "Contact",        chemin: "/contact" },
];

/** Page du Constructeur correspondant à une URL de la vitrine (lien cliqué dans l'aperçu). */
export function pageDepuisChemin(slug: string, pathname: string): PageEditee | null {
  const reste = pathname.replace(/\/+$/, "").replace(new RegExp(`^/${slug}`), "");
  if (reste === "") return "accueil";
  if (/^\/produits\/[^/]+$/.test(reste) || /^\/formation\//.test(reste)) return "produit";
  if (reste === "/produits" || reste.startsWith("/collections/")) return "catalogue";
  if (reste === "/panier") return "panier";
  if (reste === "/checkout") return "commande";
  if (reste === "/a-propos") return "apropos";
  if (reste === "/contact") return "contact";
  return null;
}
