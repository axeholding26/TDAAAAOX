// Catalogue des types de blocs du constructeur libre — SOURCE UNIQUE des
// configs par défaut et de leur description, partagée par :
// - app/(dashboard)/dashboard/builder/canvas/blockDefaults.ts (bibliothèque
//   glisser-déposer du tableau de bord, y ajoute juste les icônes)
// - lib/gemini.ts::agentConstructeurLibre (l'agent AXIA lit ce catalogue
//   pour savoir quels types/champs il a le droit de manipuler)
// Fichier pur (aucun React/Prisma) : importable aussi bien côté client que
// dans une route API.
import type { BlockNode, BlockNodeType } from "./theme-config";
import { genBlockId } from "./block-tree";

export interface BlockCatalogEntry {
  type: BlockNodeType;
  label: string;
  categorie: "structure" | "widget";
  // Description des champs de `config` pour ce type — lue par l'agent IA
  // (prompt), pas affichée aux marchands.
  champs: string;
  defaultConfig?: Record<string, any>;
}

export const BLOCK_CATALOG: BlockCatalogEntry[] = [
  { type: "section", label: "Section", categorie: "structure", champs: "conteneur racine, pas de config ; children = des \"row\" uniquement" },
  { type: "row", label: "Ligne", categorie: "structure", champs: "conteneur horizontal, pas de config ; children = des \"column\" uniquement" },
  { type: "column", label: "Colonne", categorie: "structure", champs: "conteneur vertical, pas de config ; children = widgets ou une \"row\" imbriquée" },
  {
    type: "features", label: "Avantages", categorie: "widget",
    champs: `{ titre: string, colonnes: 2|3|4, items: [{ icone: string (emoji), titre: string, texte: string }] }`,
    defaultConfig: { titre: "Nos avantages", colonnes: 3, items: [{ icone: "★", titre: "Avantage 1", texte: "Description" }, { icone: "→", titre: "Avantage 2", texte: "Description" }, { icone: "✓", titre: "Avantage 3", texte: "Description" }] },
  },
  {
    type: "stats", label: "Statistiques", categorie: "widget",
    champs: `{ titre: string, items: [{ valeur: string, label: string }] }`,
    defaultConfig: { titre: "En chiffres", items: [{ valeur: "10K+", label: "Clients" }, { valeur: "500+", label: "Produits" }, { valeur: "4.9★", label: "Note" }, { valeur: "48h", label: "Livraison" }] },
  },
  {
    type: "countdown", label: "Compte à rebours", categorie: "widget",
    champs: `{ titre: string, texte: string, dateFin: string (ISO datetime), ctaTexte: string }`,
    defaultConfig: { titre: "Offre limitée", texte: "Ne manquez pas cette opportunité unique !", dateFin: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16), ctaTexte: "Profiter maintenant" },
  },
  {
    type: "brands", label: "Logos partenaires", categorie: "widget",
    champs: `{ titre: string, logos: string[] (URLs), style: "carousel"|"grid" }`,
    defaultConfig: { titre: "Ils nous font confiance", logos: ["", "", "", ""], style: "carousel" },
  },
  {
    type: "video", label: "Vidéo showcase", categorie: "widget",
    champs: `{ titre: string, videoUrl: string (YouTube/Vimeo/mp4), style: "centered"|"full", autoplay: boolean }`,
    defaultConfig: { titre: "Découvrez notre monde", videoUrl: "", style: "centered", autoplay: false },
  },
  {
    type: "gallery", label: "Galerie photos", categorie: "widget",
    champs: `{ titre: string, images: string[] (URLs), layout: "masonry"|"grid" }`,
    defaultConfig: { titre: "Notre lookbook", images: ["", "", "", "", "", ""], layout: "masonry" },
  },
  {
    type: "social-proof", label: "Preuve sociale", categorie: "widget",
    champs: `{ note: string (ex "4.9/5"), nbClients: string, nbCommandes: string, certifications: string[] }`,
    defaultConfig: { note: "4.9/5", nbClients: "12 000+", nbCommandes: "30 000+", certifications: ["✓ Paiement sécurisé", "✓ Livraison garantie"] },
  },
  {
    type: "cta-band", label: "Bande CTA", categorie: "widget",
    champs: `{ titre: string, texte: string, ctaTexte: string, ctaLien: string (chemin relatif ex "produits"), style: "gradient"|"solid" }`,
    defaultConfig: { titre: "Prêt à découvrir ?", texte: "Rejoignez des milliers de clients satisfaits", ctaTexte: "Commencer maintenant", ctaLien: "produits", style: "gradient" },
  },
  {
    type: "richtext", label: "Texte riche", categorie: "widget",
    champs: `{ titre: string, texte: string, ctaTexte?: string, ctaLien?: string }`,
    defaultConfig: { titre: "Notre engagement", texte: "Nous sommes passionnés par la qualité et l'authenticité.", ctaTexte: "", ctaLien: "" },
  },
  { type: "spacer", label: "Espacement", categorie: "widget", champs: `{ hauteur: string (ex "80px") }`, defaultConfig: { hauteur: "80px" } },
  {
    type: "tabs", label: "Onglets", categorie: "widget",
    champs: `{ titre: string, onglets: [{ id: string, label: string, blocs: [] }] } — ne pas remplir "blocs", laisser []`,
    defaultConfig: { titre: "Découvrez-en plus", onglets: [{ id: genBlockId("tab"), label: "Photos", blocs: [] }, { id: genBlockId("tab"), label: "Témoignages", blocs: [] }] },
  },
  {
    type: "columns", label: "Colonnes de contenu", categorie: "widget",
    champs: `{ titre: string, nombreColonnes: number, colonnes: [{ id: string, blocs: [] }] } — ne pas remplir "blocs", laisser []`,
    defaultConfig: { titre: "", nombreColonnes: 3, colonnes: [{ id: genBlockId("col"), blocs: [] }, { id: genBlockId("col"), blocs: [] }, { id: genBlockId("col"), blocs: [] }] },
  },
  {
    type: "heading", label: "Titre", categorie: "widget",
    champs: `{ texte: string, niveau: "h1"|"h2"|"h3"|"h4", align: "left"|"center"|"right" }`,
    defaultConfig: { texte: "Votre titre", niveau: "h2", align: "left" },
  },
  {
    type: "text", label: "Texte", categorie: "widget",
    champs: `{ texte: string, align: "left"|"center"|"right" }`,
    defaultConfig: { texte: "Votre texte ici.", align: "left" },
  },
  {
    type: "image", label: "Image", categorie: "widget",
    champs: `{ url: string, alt: string, lien?: string, ratio: "auto"|"square"|"video"|"portrait" }`,
    defaultConfig: { url: "", alt: "", lien: "", ratio: "auto" },
  },
  {
    type: "button", label: "Bouton", categorie: "widget",
    champs: `{ texte: string, lien: string (chemin relatif ex "produits"), style: "primary"|"outline"|"ghost", taille: "sm"|"md"|"lg", align: "left"|"center"|"right" }`,
    defaultConfig: { texte: "En savoir plus", lien: "produits", style: "primary", taille: "md", align: "left" },
  },
  {
    type: "products", label: "Produits", categorie: "widget",
    champs: `{ titre: string, nombre: number (1-24), colonnes: 2|3|4, tri: "recent"|"ventes"|"featured" } — affiche les VRAIS produits de la boutique, jamais de contenu inventé`,
    defaultConfig: { titre: "Nos produits", nombre: 8, colonnes: 4, tri: "recent" },
  },
];

const CATALOG_BY_TYPE = new Map(BLOCK_CATALOG.map((e) => [e.type, e]));

export function getCatalogEntry(type: BlockNodeType): BlockCatalogEntry | undefined {
  return CATALOG_BY_TYPE.get(type);
}

// Construit un nœud avec la config par défaut de son type, éventuellement
// fusionnée avec une config partielle (fournie par le marchand qui glisse un
// bloc, ou par l'agent IA qui a un besoin plus précis).
export function createDefaultNode(type: BlockNodeType, configOverride?: Record<string, any>): BlockNode {
  if (type === "section" || type === "row" || type === "column") {
    return { id: genBlockId(type), type, children: [] };
  }
  const base = getCatalogEntry(type)?.defaultConfig || {};
  return { id: genBlockId(type), type, config: { ...JSON.parse(JSON.stringify(base)), ...(configOverride || {}) } };
}
