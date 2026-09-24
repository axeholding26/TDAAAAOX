// Fiche produit — SOURCE UNIQUE des sections et de leurs opérations.
// Le panneau « Fiche produit » du Constructeur ET l'outil AXIA
// `modifier_fiche_produit` passent tous les deux par `appliquerActionFiche` :
// toute action faisable à la main l'est par AXIA, avec les mêmes garde-fous
// (sections uniques jamais dupliquées, ids uniques, sections de base jamais
// supprimées — seulement masquées). Module pur : client et serveur.
import {
  DEFAULT_PRODUCT_SECTIONS,
  type ProductPageSection,
  type ProductPageSectionStyle,
  type ThemeProductPageConfig,
} from "./theme-config";

export type LayoutFiche = NonNullable<ThemeProductPageConfig["layout"]>;
export const LAYOUTS_FICHE: LayoutFiche[] = ["amazon", "classic", "minimal", "fullwidth"];

type Catalogue = { label: string; base?: true; repetable?: true; defaut: () => Record<string, any> };

// base = présente d'office, jamais supprimée ; repetable = plusieurs exemplaires
// possibles (contenu libre) ; sinon une seule par fiche (éviter les doublons
// qui cassent la mise en page : deux sélecteurs de quantité, deux guides…).
export const SECTIONS_FICHE: Record<string, Catalogue> = {
  gallery:      { label: "Galerie photos", base: true, defaut: () => ({ style: "vertical-thumbs", zoom: true, sticky: true }) },
  info:         { label: "Infos produit", base: true, defaut: () => ({ breadcrumbs: true, badges: true, stock: true }) },
  variants:     { label: "Variantes", base: true, defaut: () => ({ style: "boutons", taille: "md", espacement: "normal", afficherLibelle: true }) },
  quantity:     { label: "Quantité & panier", base: true, defaut: () => ({ afficherQuantite: true, texteBouton: "", afficherAcheterMaintenant: true, afficherWhatsApp: true, couleurBouton: "", couleurTexteBouton: "" }) },
  trust:        { label: "Badges confiance", base: true, defaut: () => ({ disposition: "grille", colonnes: 3, afficherVendeur: true, items: [{ icone: "🔒", texte: "Paiement sécurisé" }, { icone: "🚚", texte: "Livraison rapide" }, { icone: "↩️", texte: "Retour 14 jours" }] }) },
  description:  { label: "Description", base: true, defaut: () => ({ ai: true, afficherLivraison: true, livraison: [{ titre: "Livraison standard", texte: "Préparée sous 24–48h ouvrées." }, { titre: "Politique de retour", texte: "Retours sous 14 jours, produit intact." }, { titre: "Paiement sécurisé", texte: "Mobile money, carte ou paiement à la livraison." }] }) },
  reviews:      { label: "Avis clients", base: true, defaut: () => ({ titre: "Avis clients", disposition: "grille", afficherResume: true, afficherFormulaire: true, afficherVerifie: true, couleurEtoiles: "", max: 20 }) },
  similar:      { label: "Produits similaires", base: true, defaut: () => ({ count: 4, titre: "Vous aimerez aussi" }) },
  richtext:     { label: "Texte libre", repetable: true, defaut: () => ({ titre: "Notre engagement", texte: "Votre texte ici.", ctaTexte: "" }) },
  features:     { label: "Points forts", repetable: true, defaut: () => ({ titre: "Pourquoi choisir ce produit ?", items: [{ icone: "✓", titre: "Qualité premium", texte: "Matériaux soigneusement sélectionnés." }, { icone: "⚡", titre: "Livraison rapide", texte: "Expédié en 24-48h." }, { icone: "♻️", titre: "Éco-responsable", texte: "Fabriqué de façon durable." }] }) },
  howto:        { label: "Mode d'emploi", defaut: () => ({ titre: "Comment l'utiliser ?", style: "etapes", steps: [{ num: "01", titre: "Étape 1", texte: "Description de l'étape ici." }, { num: "02", titre: "Étape 2", texte: "Description de l'étape ici." }, { num: "03", titre: "Étape 3", texte: "Description de l'étape ici." }] }) },
  banner:       { label: "Bannière image", repetable: true, defaut: () => ({ titre: "Offre spéciale", texte: "", imageUrl: "", ctaTexte: "Profiter maintenant" }) },
  video:        { label: "Vidéo", repetable: true, defaut: () => ({ titre: "", videoUrl: "", autoplay: false }) },
  faq:          { label: "FAQ produit", defaut: () => ({ titre: "Questions fréquentes", items: [{ question: "Comment utiliser ce produit ?", reponse: "Répondez ici." }] }) },
  specs:        { label: "Caractéristiques", defaut: () => ({ titre: "Caractéristiques techniques", rows: [{ cle: "Matière", valeur: "" }, { cle: "Dimensions", valeur: "" }, { cle: "Poids", valeur: "" }] }) },
  ingredients:  { label: "Ingrédients / Matières", defaut: () => ({ titre: "Composition", texte: "", items: [{ nom: "Ingrédient 1", desc: "" }, { nom: "Ingrédient 2", desc: "" }] }) },
  testimonials: { label: "Témoignages", defaut: () => ({ titre: "Ils en parlent", items: [{ nom: "Marie D.", note: 5, texte: "Excellent produit, je recommande !", avatar: "" }, { nom: "Jean K.", note: 5, texte: "Très satisfait de mon achat.", avatar: "" }] }) },
  sizeguide:    { label: "Guide des tailles", defaut: () => ({ titre: "Guide des tailles", headers: ["Taille", "Tour de poitrine", "Tour de taille", "Tour de hanches"], rows: [{ cells: ["XS", "80-84 cm", "60-64 cm", "86-90 cm"] }, { cells: ["S", "84-88 cm", "64-68 cm", "90-94 cm"] }, { cells: ["M", "88-92 cm", "68-72 cm", "94-98 cm"] }] }) },
  guarantee:    { label: "Garantie & SAV", defaut: () => ({ titre: "Notre garantie", items: [{ icone: "🛡️", titre: "Garantie 2 ans", texte: "Pièces et main-d'œuvre couvertes." }, { icone: "🔄", titre: "Retour 30 jours", texte: "Remboursement intégral si insatisfait." }, { icone: "📞", titre: "Support 7j/7", texte: "Notre équipe est là pour vous." }] }) },
  bundle:       { label: "Pack / Bundle", defaut: () => ({ titre: "Souvent achetés ensemble", items: [{ nom: "Produit complémentaire 1", imageUrl: "", prix: "" }, { nom: "Produit complémentaire 2", imageUrl: "", prix: "" }], ctaTexte: "Tout ajouter au panier" }) },
  comparison:   { label: "Tableau comparatif", defaut: () => ({ titre: "Comparaison", headers: ["Caractéristique", "Ce produit", "Standard"], rows: [{ cells: ["Qualité", "✓ Premium", "Basique"] }, { cells: ["Garantie", "✓ 2 ans", "6 mois"] }, { cells: ["Support", "✓ Prioritaire", "Email"] }] }) },
  countdown:    { label: "Compte à rebours", defaut: () => ({ titre: "Offre limitée", texte: "Ne manquez pas cette opportunité !", dateFin: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16), ctaTexte: "Profiter maintenant" }) },
  social:       { label: "Partage social", defaut: () => ({}) },
};

export const TYPES_FICHE = Object.keys(SECTIONS_FICHE);

const STYLE_CLES: (keyof ProductPageSectionStyle)[] = ["bgColor", "textColor", "paddingY", "marginY", "maxWidth", "align", "fontScale"];

export function sectionsFiche(pp?: ThemeProductPageConfig | null): ProductPageSection[] {
  return pp?.sections?.length ? pp.sections : DEFAULT_PRODUCT_SECTIONS.map((s) => ({ ...s, config: { ...s.config } }));
}

/** Types déjà présents qui ne peuvent plus être ajoutés (sections uniques). */
export function typesIndisponibles(sections: ProductPageSection[]): Set<string> {
  return new Set(sections.filter((s) => !SECTIONS_FICHE[s.type]?.repetable).map((s) => s.type));
}

function nouvelId(type: string, sections: ProductPageSection[]): string {
  const ids = new Set(sections.map((s) => s.id));
  let id: string;
  do id = `${type}-${Math.random().toString(36).slice(2, 10)}`; while (ids.has(id));
  return id;
}

/** Retrouve une section par id, ou par type pour une section unique (pratique pour AXIA). */
export function trouverSection(sections: ProductPageSection[], ref: string): ProductPageSection | undefined {
  return sections.find((s) => s.id === ref) ?? sections.find((s) => s.type === ref);
}

export type ActionFiche =
  | { action: "ajouter"; type: string; index?: number; config?: Record<string, any> }
  | { action: "supprimer"; section: string }
  | { action: "deplacer"; section: string; index: number }
  | { action: "afficher" | "masquer"; section: string }
  | { action: "configurer"; section: string; config: Record<string, any> }
  | { action: "styliser"; section: string; style: Record<string, any> }
  | { action: "mise_en_page"; layout: string };

/**
 * Applique une action à la fiche produit et renvoie la nouvelle config.
 * Lève une Error au message lisible (affiché au marchand / renvoyé à AXIA)
 * si l'action est invalide — jamais d'état cassé enregistré.
 */
export function appliquerActionFiche(pp: ThemeProductPageConfig | null | undefined, a: ActionFiche): { pp: ThemeProductPageConfig; id?: string } {
  const base: ThemeProductPageConfig = { ...(pp ?? {}) };
  const sections = sectionsFiche(pp);
  const cible = "section" in a ? trouverSection(sections, a.section) : undefined;
  if ("section" in a && !cible) throw new Error(`Section « ${a.section} » introuvable sur la fiche produit.`);
  const clamp = (i: number, max: number) => Math.max(0, Math.min(max, Math.round(i)));

  switch (a.action) {
    case "ajouter": {
      const cat = SECTIONS_FICHE[a.type];
      if (!cat) throw new Error(`Type de section inconnu : « ${a.type} ».`);
      if (typesIndisponibles(sections).has(a.type)) throw new Error(`La section « ${cat.label} » est déjà sur la fiche (une seule autorisée).`);
      const id = nouvelId(a.type, sections);
      const next = [...sections];
      next.splice(clamp(a.index ?? next.length, next.length), 0, { id, type: a.type as any, actif: true, config: { ...cat.defaut(), ...(a.config ?? {}) } });
      return { pp: { ...base, sections: next }, id };
    }
    case "supprimer": {
      if (SECTIONS_FICHE[cible!.type]?.base) throw new Error(`« ${SECTIONS_FICHE[cible!.type].label} » est une section de base : elle peut être masquée, pas supprimée.`);
      return { pp: { ...base, sections: sections.filter((s) => s.id !== cible!.id) } };
    }
    case "deplacer": {
      const next = sections.filter((s) => s.id !== cible!.id);
      next.splice(clamp(a.index, next.length), 0, cible!);
      return { pp: { ...base, sections: next } };
    }
    case "afficher":
    case "masquer":
      return { pp: { ...base, sections: sections.map((s) => (s.id === cible!.id ? { ...s, actif: a.action === "afficher" } : s)) } };
    case "configurer":
      return { pp: { ...base, sections: sections.map((s) => (s.id === cible!.id ? { ...s, config: { ...s.config, ...a.config } } : s)) } };
    case "styliser": {
      const style = Object.fromEntries(Object.entries(a.style ?? {}).filter(([k]) => (STYLE_CLES as string[]).includes(k)));
      if (!Object.keys(style).length) throw new Error(`Aucun style reconnu. Propriétés possibles : ${STYLE_CLES.join(", ")}.`);
      return { pp: { ...base, sections: sections.map((s) => (s.id === cible!.id ? { ...s, style: { ...s.style, ...style } } : s)) } };
    }
    case "mise_en_page": {
      if (!(LAYOUTS_FICHE as string[]).includes(a.layout)) throw new Error(`Mise en page inconnue : « ${a.layout} » (${LAYOUTS_FICHE.join(", ")}).`);
      return { pp: { ...base, sections, layout: a.layout as LayoutFiche } };
    }
  }
}

/** Résumé lisible de la fiche (ordre, état, id) — pour AXIA. */
export function resumerFiche(pp?: ThemeProductPageConfig | null): string {
  const s = sectionsFiche(pp);
  return `Mise en page : ${pp?.layout ?? "amazon"}\n` + s.map((x, i) => `${i}. ${SECTIONS_FICHE[x.type]?.label ?? x.type} [id=${x.id}, type=${x.type}]${x.actif ? "" : " (masquée)"}`).join("\n");
}
