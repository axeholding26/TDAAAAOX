// Pages de la boutique éditables depuis le Constructeur (sélecteur de la
// barre du haut ; pas le panier : rien à y régler) — partagé par le Constructeur physique et le digital.
export type PageFixe = "accueil" | "catalogue" | "produit" | "commande" | "apropos" | "contact";
// « p:<slug> » : page libre (themeConfig.pagesPerso, ex. page importée), éditée en sections comme l'accueil.
export type PageEditee = PageFixe | `p:${string}`;
export const cleLibre = (p: PageEditee): string | null => (p.startsWith("p:") ? p.slice(2) : null);

export const PAGES: { id: PageFixe; label: string; chemin: string }[] = [
  { id: "accueil",   label: "Page d'accueil", chemin: "" },
  { id: "catalogue", label: "Catalogue",      chemin: "/produits" },
  { id: "produit",   label: "Fiche produit",  chemin: "/produits/:id" },
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
  if (reste === "/checkout") return "commande";
  if (reste === "/a-propos") return "apropos";
  if (reste === "/contact") return "contact";
  const libre = reste.match(/^\/p\/([^/]+)$/);
  if (libre) return `p:${decodeURIComponent(libre[1])}`;
  return null;
}
