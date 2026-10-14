// Opérations pures du Builder — SEO des pages libres (themeConfig.pagesPerso[slug].seo), au
// BROUILLON. Le SEO de l'accueil (Tenant.metaTitle/metaDescription) et celui des produits
// (Produit.metaTitle/metaDesc) sont des données de boutique, hors config : outils séparés
// (lib/controle-ia/modules/builder/analyses.ts).
import type { OperationBuilder } from "../types";
import { ErreurBuilder } from "../types";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const texte = (v: unknown, nom: string, max: number): string => {
  if (typeof v !== "string") throw new ErreurBuilder("INVALID_INPUT", `${nom} : texte attendu.`);
  const t = v.replace(/\s+/g, " ").trim();
  // Du texte brut seulement : la balise <title> et les métadonnées n'interprètent pas de HTML.
  if (/[<>]/.test(t)) throw new ErreurBuilder("INVALID_INPUT", `${nom} : pas de balise HTML.`);
  if (t.length > max) throw new ErreurBuilder("INVALID_INPUT", `${nom} : ${t.length} caractères, ${max} au plus.`);
  return t;
};

export const OPERATIONS: OperationBuilder[] = [
  {
    nom: "axso_builder_update_seo",
    description: "Règle le référencement d'une page libre (p/<slug>) dans le brouillon : titre de l'onglet et des résultats Google (30-60 caractères), meta description (70-160), image de partage (Open Graph, reprise par WhatsApp, Facebook et X), noindex, et changement d'adresse de la page (les liens internes vers l'ancienne adresse sont mis à jour). Pour l'accueil utilise axso_builder_update_store_seo, pour un produit axso_builder_fix_seo.",
    capacite: "builder_seo",
    parameters: {
      type: "object",
      properties: {
        page: { type: "string", description: "Adresse de la page libre (slug, ex. « ramadan »)" },
        titre: { type: "string", maxLength: 70 },
        description: { type: "string", maxLength: 170 },
        image: { type: "string", description: "Image de partage https (1200×630 conseillé) ; chaîne vide pour retirer" },
        noindex: { type: "boolean", description: "true : la page n'apparaît pas dans Google" },
        nouveau_slug: { type: "string", description: "Nouvelle adresse (minuscules, chiffres, tirets)" },
      },
      required: ["page"],
    },
    appliquer: (cfg, args) => {
      const pages = ((cfg as any).pagesPerso ?? {}) as Record<string, any>;
      const page = pages[args.page];
      if (!page) throw new ErreurBuilder("NOT_FOUND", `Page libre « ${args.page} » introuvable dans le brouillon.`);
      const seo = { ...(page.seo ?? {}) };
      if (args.titre !== undefined) seo.titre = texte(args.titre, "titre", 70);
      if (args.description !== undefined) seo.description = texte(args.description, "description", 170);
      if (args.image !== undefined) {
        if (args.image && !/^https:\/\/[^\s"'<>]+$/i.test(args.image)) throw new ErreurBuilder("INVALID_INPUT", "image : adresse https attendue.");
        seo.image = args.image || undefined;
      }
      if (args.noindex !== undefined) seo.noindex = !!args.noindex;
      page.seo = seo;
      if (args.nouveau_slug !== undefined && args.nouveau_slug !== args.page) {
        const neuf = String(args.nouveau_slug);
        if (!SLUG.test(neuf) || neuf.length > 60) throw new ErreurBuilder("INVALID_INPUT", "nouveau_slug : minuscules, chiffres et tirets seulement (60 caractères au plus).");
        if (pages[neuf]) throw new ErreurBuilder("CONFLICT", `Une page « ${neuf} » existe déjà.`);
        // Les liens internes (« p/ancien ») suivent : sinon ils deviendraient des liens cassés.
        const avant = JSON.stringify({ ...cfg, pagesPerso: { ...pages, [neuf]: page, [args.page]: undefined } });
        return JSON.parse(avant.replace(new RegExp(`(["/])p/${String(args.page).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=["/?#])`, "g"), `$1p/${neuf}`));
      }
      return cfg;
    },
  },
];
