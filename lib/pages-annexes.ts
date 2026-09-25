// Pages À propos et Contact — SOURCE UNIQUE des blocs et de leurs opérations.
// Le panneau du Constructeur (PanelPageSections) ET l'outil AXIA
// `modifier_page` passent tous les deux par `appliquerActionPage` : toute
// action faisable à la main l'est par AXIA, avec les mêmes règles (ids
// uniques, types connus, ordre recalculé). Module pur : client et serveur.
// Même principe que lib/fiche-produit.ts pour la fiche produit.
import type { CustomSection, ThemeAboutPageConfig, ThemeContactPageConfig } from "./theme-config";

export type CleePage = "aboutPage" | "contactPage";
export type PageAnnexe = Partial<ThemeAboutPageConfig & ThemeContactPageConfig>;

/** Id unique (préfixe + horodatage + aléa). */
export const uid = (prefixe: string) => `${prefixe}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const BLOCS_PAGE: Record<CustomSection["type"], { label: string; defaut: () => Record<string, any> }> = {
  richtext:       { label: "Texte riche", defaut: () => ({ titre: "Notre histoire", texte: "Racontez ici l'histoire de votre boutique.", ctaTexte: "", ctaLien: "" }) },
  features:       { label: "Avantages / Features", defaut: () => ({ titre: "Nos valeurs", items: [{ icone: "★", titre: "Valeur 1", texte: "Description" }, { icone: "→", titre: "Valeur 2", texte: "Description" }, { icone: "✓", titre: "Valeur 3", texte: "Description" }], colonnes: 3 }) },
  stats:          { label: "Statistiques", defaut: () => ({ titre: "En chiffres", items: [{ valeur: "10K+", label: "Clients" }, { valeur: "500+", label: "Produits" }, { valeur: "4.9★", label: "Note" }, { valeur: "48h", label: "Livraison" }] }) },
  gallery:        { label: "Galerie photos", defaut: () => ({ titre: "Notre galerie", images: ["", "", "", "", "", ""], layout: "masonry" }) },
  video:          { label: "Vidéo showcase", defaut: () => ({ titre: "Découvrez notre monde", videoUrl: "", style: "centered", autoplay: false }) },
  "cta-band":     { label: "Bande CTA", defaut: () => ({ titre: "Une question ?", texte: "Contactez-nous, on vous répond vite", ctaTexte: "Nous écrire", ctaLien: "contact", style: "gradient" }) },
  brands:         { label: "Logos partenaires", defaut: () => ({ titre: "Ils nous font confiance", logos: ["", "", "", ""], style: "carousel" }) },
  "social-proof": { label: "Preuve sociale", defaut: () => ({ note: "4.9/5", nbClients: "12 000+", nbCommandes: "30 000+", certifications: ["✓ Paiement sécurisé", "✓ Livraison garantie"] }) },
  countdown:      { label: "Compte à rebours", defaut: () => ({ titre: "Offre limitée", texte: "Ne manquez pas cette opportunité unique !", dateFin: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16), ctaTexte: "Profiter maintenant" }) },
  spacer:         { label: "Espacement", defaut: () => ({ hauteur: "80px" }) },
  faq:            { label: "FAQ", defaut: () => ({ titre: "Questions fréquentes", items: [{ question: "Comment passer commande ?", reponse: "Choisissez votre produit puis suivez les étapes de paiement.", image: "" }, { question: "Quels sont les délais ?", reponse: "Réponse ici.", image: "" }] }) },
  tabs:           { label: "Onglets", defaut: () => ({ titre: "Découvrez-en plus", onglets: [{ id: uid("tab"), label: "Photos", blocs: [] }, { id: uid("tab"), label: "Témoignages", blocs: [] }] }) },
  columns:        { label: "Colonnes", defaut: () => ({ titre: "", nombreColonnes: 3, colonnes: [{ id: uid("col"), blocs: [] }, { id: uid("col"), blocs: [] }, { id: uid("col"), blocs: [] }] }) },
};

/** Copie profonde d'une config avec des ids neufs pour ses onglets/colonnes/sous-blocs (duplication sans doublon). */
export function avecIdsNeufs(config: Record<string, any> = {}): Record<string, any> {
  const c = JSON.parse(JSON.stringify(config));
  const blocs = (l: any[]) => l.map((b) => ({ ...b, id: uid("bloc") }));
  if (Array.isArray(c.onglets)) c.onglets = c.onglets.map((o: any) => ({ ...o, id: uid("tab"), blocs: blocs(o.blocs ?? []) }));
  if (Array.isArray(c.colonnes)) c.colonnes = c.colonnes.map((o: any) => ({ ...o, id: uid("col"), blocs: blocs(o.blocs ?? []) }));
  return c;
}

export type ActionPage =
  | { action: "afficher_page" | "masquer_page" }
  | { action: "ajouter"; type: string; index?: number; config?: Record<string, any>; label?: string }
  | { action: "supprimer" | "dupliquer" | "afficher" | "masquer"; bloc: string }
  | { action: "deplacer"; bloc: string; index: number }
  | { action: "configurer"; bloc: string; config: Record<string, any>; label?: string }
  | { action: "reglages_contact"; intro?: string; afficherFormulaire?: boolean };

const trouver = (sections: CustomSection[], ref: string) =>
  sections.find((s) => s.id === ref) ?? sections.find((s) => s.label === ref) ?? sections.find((s) => s.type === ref);

/**
 * Applique une action à la page (À propos ou Contact) et renvoie la nouvelle
 * config. Lève une Error au message lisible si l'action est invalide —
 * jamais d'état cassé enregistré.
 */
export function appliquerActionPage(page: PageAnnexe | null | undefined, cle: CleePage, a: ActionPage): { page: PageAnnexe; id?: string } {
  const base: PageAnnexe = { ...(page ?? {}), actif: page?.actif === true, sections: [...(page?.sections ?? [])] };
  const sections = base.sections!;
  const cible = "bloc" in a ? trouver(sections, a.bloc) : undefined;
  if ("bloc" in a && !cible) throw new Error(`Bloc « ${a.bloc} » introuvable sur la page.`);
  const reordonner = (l: CustomSection[]) => l.map((s, i) => ({ ...s, ordre: i }));
  const clamp = (i: number, max: number) => Math.max(0, Math.min(max, Math.round(i)));

  switch (a.action) {
    case "afficher_page": return { page: { ...base, actif: true } };
    case "masquer_page": return { page: { ...base, actif: false } };
    case "ajouter": {
      const cat = BLOCS_PAGE[a.type as CustomSection["type"]];
      if (!cat) throw new Error(`Type de bloc inconnu : « ${a.type} » (${Object.keys(BLOCS_PAGE).join(", ")}).`);
      const id = uid("custom");
      const next = [...sections];
      next.splice(clamp(a.index ?? next.length, next.length), 0,
        { id, type: a.type as CustomSection["type"], actif: true, label: a.label || cat.label, ordre: 0, config: { ...cat.defaut(), ...(a.config ?? {}) } });
      return { page: { ...base, sections: reordonner(next) }, id };
    }
    case "supprimer": return { page: { ...base, sections: reordonner(sections.filter((s) => s.id !== cible!.id)) } };
    case "dupliquer": {
      const id = uid("custom");
      const next = [...sections];
      next.splice(sections.indexOf(cible!) + 1, 0, { ...cible!, id, label: `${cible!.label} (copie)`, config: avecIdsNeufs(cible!.config) });
      return { page: { ...base, sections: reordonner(next) }, id };
    }
    case "afficher":
    case "masquer":
      return { page: { ...base, sections: sections.map((s) => (s.id === cible!.id ? { ...s, actif: a.action === "afficher" } : s)) } };
    case "deplacer": {
      const next = sections.filter((s) => s.id !== cible!.id);
      next.splice(clamp(a.index, next.length), 0, cible!);
      return { page: { ...base, sections: reordonner(next) } };
    }
    case "configurer":
      return { page: { ...base, sections: sections.map((s) => (s.id === cible!.id ? { ...s, ...(a.label ? { label: a.label } : {}), config: { ...s.config, ...a.config } } : s)) } };
    case "reglages_contact": {
      if (cle !== "contactPage") throw new Error("Introduction et formulaire ne concernent que la page Contact.");
      return { page: { ...base, ...(a.intro !== undefined ? { intro: a.intro } : {}), ...(a.afficherFormulaire !== undefined ? { afficherFormulaire: a.afficherFormulaire } : {}) } };
    }
  }
}

/** Résumé lisible (état, ordre, ids) — pour AXIA. */
export function resumerPage(page: PageAnnexe | null | undefined, cle: CleePage): string {
  const s = page?.sections ?? [];
  return `Page ${cle === "aboutPage" ? "À propos" : "Contact"} : ${page?.actif ? "affichée" : "masquée"}`
    + (cle === "contactPage" ? ` | formulaire ${page?.afficherFormulaire === false ? "masqué" : "affiché"}${page?.intro ? ` | intro : « ${page.intro.slice(0, 80)} »` : ""}` : "")
    + `\n` + (s.length ? s.map((x, i) => `${i}. ${x.label} [id=${x.id}, type=${x.type}]${x.actif ? "" : " (masqué)"}`).join("\n") : "(aucun bloc)");
}
