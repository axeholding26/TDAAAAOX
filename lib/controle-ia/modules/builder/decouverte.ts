// Builder MCP — découverte : ce que le Builder sait faire (rendu DYNAMIQUEMENT depuis le
// catalogue de blocs, les opérations enregistrées et les outils du module), la représentation
// machine de la boutique, le schéma d'un composant et la mémoire de design compacte.
// L'IA ne doit jamais supposer qu'un composant existe : tout vient d'ici.
import { prisma } from "@/lib/prisma";
import { BLOCK_CATALOG } from "@/lib/block-catalog";
import { ZONES } from "@/lib/block-tree";
import { FONTS } from "@/lib/theme-fonts";
import { NOMS_PALIERS } from "@/lib/plans";
import { prixClient } from "@/lib/pricing";
import { TYPES_FICHE } from "@/lib/fiche-produit";
import { BLOCS_PAGE } from "@/lib/pages-annexes";
import { resolveThemeConfigAsync } from "@/lib/theme-config-server";
import { lireBrouillon } from "@/lib/builder/moteur";
import { OPERATIONS } from "@/lib/builder/operations";
import { listerGabarits, TOKENS, champReel } from "@/lib/builder/operations/design";
import { ANIMATIONS, RESPONSIVE, SECTIONS_SOCLE, STYLE_SCHEMA, schemaBoutique, schemaComposant } from "@/lib/builder/schema";
import { marqueDe } from "@/lib/builder/marque";
import type { CtxOutil, OutilIA, ResultatIA } from "../../types";
import { ko, ok, traduire } from "./commun";

const objet = (properties: Record<string, any> = {}, required: string[] = []) => ({ type: "object" as const, properties, required });
const base = { module: "boutique" as const, niveau: "lecture" as const, capacite: "builder_decouverte" };
const SOURCE = { type: "string", enum: ["brouillon", "publie"], description: "brouillon (défaut : le brouillon s'il existe, sinon la version en ligne) ou publie" };

export const OUTILS: OutilIA[] = [
  {
    ...base, name: "axso_builder_get_capabilities",
    description: "À lire AVANT de construire : ce que le Builder sait réellement faire ici — types de blocs et sections disponibles, gabarits, propriétés et design tokens modifiables, styles, animations, responsive, et la liste des opérations (avec leur schéma) groupées par capacité. N'utilise jamais un composant absent de cette liste.",
    parameters: objet({ capacite: { type: "string", description: "Ne détailler les schémas que d'une capacité (ex. builder_design) ; sans : noms et descriptions seulement" } }),
    sortie: "blocks, sections, templates, tokens, styles, animations, responsive, capabilities { capacite: outils }, plan, rappel d'appel.",
  },
  {
    ...base, name: "axso_builder_get_schema",
    description: "Représentation machine de la boutique : thème, styles globaux, en-tête, navigation, pages (accueil, produits, fiche produit, collections, panier, commande, À propos, Contact, pages libres), pied de page. Chaque nœud : id, type, version, position, children, properties, styles, responsiveStyles, visibility, conditions, dataBindings, events, permissions. Lis-le avant de modifier une page ; passe `page` pour n'en lire qu'une.",
    parameters: objet({
      source: SOURCE,
      page: { type: "string", description: "accueil, produits, fiche-produit, collections, panier, commande, a-propos, contact, p/<slug>" },
      profondeur: { type: "integer", minimum: 1, maximum: 6, description: "Niveaux d'enfants rendus (défaut 4 : section → ligne → colonne → bloc)" },
      offset: { type: "integer", minimum: 0 }, limite: { type: "integer", minimum: 1, maximum: 50, description: "Sections par page (défaut 20)" },
    }),
    sortie: "{ store: { theme, globalStyles, header, navigation, pages, footer } } ou une seule page ; designs importés résumés, jamais leur HTML.",
    exemple: { page: "accueil", profondeur: 2 },
  },
  {
    ...base, name: "axso_builder_get_component_schema",
    description: "Schéma explicite d'un type de composant (content, media, layout, data, style, responsive, enfants permis) : bloc du catalogue (heading, products, cta-band…), section du socle (hero, annonce… si la boutique est sur le socle), section de fiche produit (fiche:gallery…). À lire avant d'ajouter ou de modifier un bloc.",
    parameters: objet({ type: { type: "string" } }, ["type"]),
    exemple: { type: "cta-band" },
  },
  {
    ...base, name: "axso_builder_get_store_context",
    description: "Mémoire de design compacte de la boutique, à lire en début de travail : marque, design system, pages et architecture, produits phares, collections, médias récents, règles de marque, historique récent (versions et actions IA du Builder).",
    parameters: objet(),
    sortie: "brand, design_system, architecture, products (10), collections, assets (10), versions (5), recent_actions (10).",
  },
];

/** Config du brouillon (ou en ligne) et config EFFECTIVE (défauts du socle et design actif appliqués). */
export async function configs(tenantId: string, source?: string) {
  const [b, t] = await Promise.all([
    lireBrouillon(tenantId),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { themeId: true, nomBoutique: true, logoUrl: true, slug: true, devise: true, categorie: true, description: true, commissionRate: true } }),
  ]);
  const brut = (source === "publie" ? b.enLigne : b.config) as unknown as Record<string, any>;
  // Les champs hors ThemeConfig (marque, pagesPerso, seo…) sont gardés tels quels.
  const effective = { ...brut, ...(await resolveThemeConfigAsync(t?.themeId ?? "terre-et-or", tenantId, brut)) } as Record<string, any>;
  return { brut, effective, brouillon: b.existe && source !== "publie", tenant: t! };
}

async function outilsBuilder() {
  // Import tardif : index.ts importe ce fichier.
  const { MODULE } = await import("./index");
  return MODULE.outils;
}

export async function executer(nom: string, args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  try {
    switch (nom) {
      case "axso_builder_get_capabilities": {
        const outils = await outilsBuilder();
        const parCapacite: Record<string, unknown[]> = {};
        for (const o of outils) {
          // Sans `capacite` : une ligne par outil (le catalogue complet ferait des dizaines de Ko).
          (parCapacite[o.capacite] ??= []).push(args.capacite === o.capacite
            ? { name: o.name, avance: !!o.cache, operation: OPERATIONS.some((x) => x.nom === o.name), niveau: o.niveau, risque: o.risque, ...(o.tier && { plan: NOMS_PALIERS[o.tier] }), description: o.description, parameters: o.parameters }
            : `${o.name}${o.cache ? " [avancé]" : ""}${o.niveau === "ecriture" ? ` [${o.risque ?? "faible"}]` : ""}${o.tier ? ` [${NOMS_PALIERS[o.tier]}]` : ""}`);
        }
        const socle = !(await configs(ctx.tenantId)).effective.builderHtml;
        const donnees = {
          blocks: BLOCK_CATALOG.map((e) => ({ type: e.type, label: e.label, categorie: e.categorie, champs: e.champs })),
          nesting: "racine → section → row → column → widgets (ou row imbriquée). Zones des sections racines : " + ZONES.join(", ") + " (config.zone).",
          imported_design: "embed-html : section d'un design importé, déplaçable/masquable/duplicable/supprimable seulement ; jamais créée ni réécrite par une IA.",
          sections: {
            accueil_socle: socle ? SECTIONS_SOCLE : "indisponibles : la boutique affiche un design importé",
            pages_a_propos_contact: Object.keys(BLOCS_PAGE),
            fiche_produit: TYPES_FICHE.map((t) => `fiche:${t}`),
          },
          templates: listerGabarits().map((g) => ({ id: g.id, nom: g.nom, categories: g.categories.map((c) => c.libelle) })),
          tokens: Object.fromEntries(Object.entries(TOKENS).map(([k, t]) => [k, champReel(t) ?? `pas de champ (${"raison" in t ? t.raison : ""})`])),
          styles: { bloc: STYLE_SCHEMA, element_design: "police, taille, graisse, interligne, espacementLettres, casse, alignement, couleur, fond, degrade, imageFond, bordure, rayon, paddings, marges, largeur, hauteur, masque — états base/hover/tablet/mobile (modifier_design_accueil)" },
          fonts: FONTS.map((f) => f.v),
          animations: ANIMATIONS,
          responsive: RESPONSIVE,
          conditions: "aucun affichage conditionnel (par client, date, pays…) dans le moteur : seulement actif et visibilité par appareil.",
          capabilities: parCapacite,
          plan: {
            palier: NOMS_PALIERS[ctx.plan], mode: ctx.mode, risque_publiable_sans_accord_en_autopilote: ctx.limites.risqueBuilderMax,
            operations_par_transaction: 60, versions_gardees: 60, taille_max_config: "≈ 3 Mo",
          },
          how_to_call: "Outils marqués avance=true : axso_decouvrir { capacite } puis axso_outil { name, arguments } ; plusieurs opérations en une transaction : axso_builder_apply { operations: [{ op, args }] }. Toute modification va au BROUILLON ; axso_builder_preview pour voir, axso_builder_publish pour publier.",
        };
        const lignes = Object.entries(parCapacite).map(([c, l]) => `${c} : ${l.map((x: any) => x.name ?? x).join(", ")}`);
        return ok(`Builder — ${BLOCK_CATALOG.length} types de blocs (${BLOCK_CATALOG.map((e) => e.type).join(", ")}), ${donnees.templates.length} gabarits.\n${lignes.join("\n")}\n${donnees.how_to_call}`, donnees);
      }

      case "axso_builder_get_schema": {
        const { effective, brouillon } = await configs(ctx.tenantId, args.source);
        const s = schemaBoutique(effective, { page: args.page ? String(args.page) : undefined, profondeur: Number(args.profondeur) || undefined, offset: Number(args.offset) || 0, limite: Number(args.limite) || undefined });
        if (!s) return ko("NOT_FOUND", `page « ${args.page} » inconnue (accueil, produits, fiche-produit, collections, panier, commande, a-propos, contact, p/<slug>).`);
        const json = JSON.stringify(s);
        return ok(`Schéma ${brouillon ? "du BROUILLON" : "de la version en ligne"}${args.page ? ` — page ${args.page}` : ""} (${Math.round(json.length / 1024)} Ko).\n${json.slice(0, 12000)}${json.length > 12000 ? "\n… tronqué : passe `page`, `profondeur` ou `offset` pour la suite." : ""}`, { source: brouillon ? "brouillon" : "publie", ...s });
      }

      case "axso_builder_get_component_schema": {
        const { effective } = await configs(ctx.tenantId);
        const s = schemaComposant(String(args.type ?? ""), { socle: !effective.builderHtml });
        if (!s) return ko("NOT_FOUND", `type « ${args.type} » inconnu ici. Types : ${BLOCK_CATALOG.map((e) => e.type).join(", ")}, embed-html, fiche:<section>${effective.builderHtml ? "" : `, ${SECTIONS_SOCLE.join(", ")}`}.`);
        return ok(`Composant ${s.type} (${s.label}).\n${JSON.stringify(s).slice(0, 6000)}`, { component: s });
      }

      case "axso_builder_get_store_context": {
        const { effective, brouillon, tenant } = await configs(ctx.tenantId);
        const t = ctx.tenantId;
        const [produits, collections, medias, versions, actions] = await Promise.all([
          prisma.produit.findMany({ where: { tenantId: t, actif: true }, orderBy: [{ featured: "desc" }, { ventes: "desc" }], take: 10, select: { id: true, nom: true, prix: true, type: true, ventes: true, images: true } }),
          prisma.collection.findMany({ where: { tenantId: t, actif: true }, take: 30, select: { nom: true, slug: true, _count: { select: { produits: true } } } }),
          prisma.mediaIA.findMany({ where: { tenantId: t }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, type: true, url: true, createdAt: true } }),
          prisma.versionBoutique.findMany({ where: { tenantId: t }, orderBy: { numero: "desc" }, take: 5, select: { numero: true, type: true, client: true, raison: true, createdAt: true } }),
          prisma.actionIA.findMany({ where: { tenantId: t, outil: { startsWith: "axso_builder" } }, orderBy: { createdAt: "desc" }, take: 10, select: { outil: true, statut: true, client: true, createdAt: true } }),
        ]);
        const m = marqueDe(effective, { nom: tenant.nomBoutique, logoUrl: tenant.logoUrl });
        const schema = schemaBoutique(effective, { profondeur: 1, limite: 30 }) as any;
        const architecture = Object.fromEntries(Object.entries(schema.store.pages).map(([k, p]: [string, any]) => [k, p.source ?? (p.sections ? `${p.sections.length} section(s)` : p.nodes ? `${p.total ?? p.nodes.length} section(s)` : "standard")]));
        const donnees = {
          store: { nom: tenant.nomBoutique, slug: tenant.slug, categorie: tenant.categorie, devise: tenant.devise, description: (tenant.description ?? "").slice(0, 300), source: brouillon ? "brouillon" : "publie" },
          brand: m,
          design_system: { colors: effective.colors, fonts: effective.fonts, radius: effective.radius, layout: effective.layout, boutons: effective.boutons, navigation: effective.navigationStyle, animations: effective.animations?.preset ?? effective.animations?.global },
          architecture: { ...architecture, header: schema.store.header.source, footer: schema.store.footer.source, design_importe: schema.store.theme.design_importe },
          products: produits.map((p) => ({ id: p.id, nom: p.nom, prix: prixClient(p.prix, tenant.commissionRate ?? 0.1, p.type), devise: tenant.devise, ventes: p.ventes, image: p.images[0] ?? null })),
          collections: collections.map((c) => ({ nom: c.nom, slug: c.slug, produits: c._count.produits })),
          assets: medias,
          brand_rules: { regles: m.regles, interdits: m.interdits, verrous: m.verrous, fixee_par_le_marchand: m.definie },
          versions, recent_actions: actions,
        };
        return ok(
          `${tenant.nomBoutique} (${tenant.categorie}) — ${brouillon ? "brouillon en cours" : "pas de brouillon"}. Marque ${m.definie ? "fixée" : "déduite (non bloquante)"} : ${m.couleurs.principales.join(", ")} ; polices ${m.polices.join(", ")}${m.ton ? ` ; ton ${m.ton}` : ""}.\nPages : ${Object.entries(donnees.architecture).map(([k, v]) => `${k} (${v})`).join(", ")}.\nProduits phares : ${donnees.products.map((p) => `${p.nom} ${p.prix} ${p.devise}`).join(" ; ") || "aucun"}.\nDernières versions : ${versions.map((v) => `v${v.numero} ${v.type}`).join(", ") || "aucune"}.`,
          donnees,
        );
      }
    }
    return ko("NOT_FOUND", "outil inconnu.");
  } catch (err) { return traduire(err); }
}
