// Chemin rapide d'AXIA : « ouvre-moi la page catalogue » se reconnaît par règles, sans
// appel au modèle (avant : 2 appels Gemini avec ~75 Ko de prompt et d'outils, plusieurs
// secondes). Seules les demandes courtes et non ambiguës passent ici : destination
// trouvée telle quelle dans le catalogue des vraies pages, sinon null → parcours normal.
// Pur (sans import serveur) : testé dans tests/axia-intention-rapide.test.ts.
import { PAGES_DASHBOARD } from "./pages";
import { PAGES as PAGES_CONSTRUCTEUR, type PageEditee } from "@/app/(dashboard)/dashboard/builder/pages/pages";

export type Intention =
  | { type: "dashboard"; cle: string; chemin: string; nom: string }
  | { type: "boutique_publique" }
  | { type: "constructeur"; page: PageEditee; nom: string };

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[’`]/g, "'").replace(/[.!…]+$/g, "").replace(/\s+/g, " ").trim();

// Synonymes en plus du nom et de la clé de chaque page (lib/axia/pages.ts).
const EXTRAS: Record<string, string[]> = {
  produits: ["catalogue", "mes produits", "articles", "mes articles", "liste des produits"],
  tableau_de_bord: ["dashboard", "accueil du dashboard"],
  analytics: ["stats", "statistiques", "analytique", "analyses"],
  parametres: ["reglages", "parametres de la boutique"],
  wallet: ["portefeuille", "porte-monnaie", "wallet"],
  caisse: ["pos", "point de vente"],
  constructeur: ["builder", "editeur", "editeur de boutique", "constructeur de boutique"],
  codes_promo: ["promos", "codes promos", "code promo", "reductions"],
  automatisations: ["automation", "automatisation"],
  journal_axia: ["journal", "journal axia"],
  emails: ["email", "e-mails", "mails"],
  abonnement: ["mon abonnement", "forfait"],
  livraison: ["livraisons"],
  profil: ["mon profil", "mon compte"],
};
const PUBLIQUE = ["boutique publique", "ma boutique en ligne", "boutique en ligne", "vitrine", "ma vitrine", "mon site", "site"];
// Pages du Constructeur (sélecteur de la barre du haut), reconnues seulement depuis le Constructeur.
const EXTRAS_CONSTRUCTEUR: Partial<Record<PageEditee, string[]>> = {
  accueil: ["accueil", "page d'accueil", "home"],
  catalogue: ["catalogue", "produits", "liste des produits", "boutique"],
  produit: ["fiche produit", "page produit", "produit"],
  commande: ["commande", "checkout", "paiement", "page de paiement"],
  apropos: ["a propos", "qui sommes-nous"],
};

const DASHBOARD = new Map<string, string>();
for (const [cle, [, nom]] of Object.entries(PAGES_DASHBOARD)) {
  for (const s of [nom, cle.replace(/_/g, " "), ...(EXTRAS[cle] ?? [])]) DASHBOARD.set(norm(s), cle);
}
DASHBOARD.delete("boutique"); // « ouvre ma boutique » : réglages ou vitrine ? → le modèle tranche
const CONSTRUCTEUR = new Map<string, PageEditee>();
for (const p of PAGES_CONSTRUCTEUR) for (const s of [p.label, p.id, ...(EXTRAS_CONSTRUCTEUR[p.id] ?? [])]) CONSTRUCTEUR.set(norm(s), p.id);

const VERBE = /^(?:(?:stp|svp|s'il te plait|tu peux|peux-tu|est-ce que tu peux)\s+)?(?:ouvre|ouvres|ouvrir|ouvrez|va|vas|aller|allons|emmene|amene|montre|montrer|affiche|afficher|navigue|accede|direction)(?:[- ]?(?:moi|nous))?\s+(.+)$/;
const ARTICLE = /^(?:(?:a|au|aux|sur|vers|dans|de|du|des|d')\s*)?(?:(?:la|le|les|l'|mes|mon|ma)\s*)?/;
const CONTENANT = /^(?:page|onglet|section|rubrique|menu|ecran)\s+(?:(?:de|des|du|d')\s*)?/;
const POLITESSE = /\s+(?:stp|svp|s'il te plait|merci|please)$/;

/** Intention de navigation reconnue sans modèle, ou null (le parcours normal s'en charge). */
export function intentionRapide(message: string): Intention | null {
  // Les fenêtres AXIA préfixent la demande d'un contexte « [Contexte : …] ».
  const contexte = message.match(/^\s*\[Contexte :([^\]]*)\]/)?.[1] ?? "";
  const texte = norm(message.replace(/^\s*\[Contexte :[^\]]*\]\s*/, ""));
  if (!texte || texte.length > 80 || /[?,;]| et | puis | ensuite /.test(texte)) return null;
  const m = texte.match(VERBE);
  if (!m) return null;
  let dest = m[1].replace(POLITESSE, "").replace(ARTICLE, "");
  dest = dest.replace(CONTENANT, "").replace(ARTICLE, "").trim();
  if (!dest) return null;

  if (/dans le constructeur/i.test(contexte)) {
    const page = CONSTRUCTEUR.get(dest);
    if (page) return { type: "constructeur", page, nom: PAGES_CONSTRUCTEUR.find((p) => p.id === page)!.label };
  }
  if (PUBLIQUE.includes(dest)) return { type: "boutique_publique" };
  const cle = DASHBOARD.get(dest);
  if (!cle) return null;
  const [chemin, nom] = PAGES_DASHBOARD[cle];
  return { type: "dashboard", cle, chemin, nom };
}

/** Adresse d'une page du Constructeur, lue par la fenêtre AXIA du Constructeur pour changer de page. */
export const lienConstructeur = (page: PageEditee) => `/dashboard/builder?page=${page}`;
