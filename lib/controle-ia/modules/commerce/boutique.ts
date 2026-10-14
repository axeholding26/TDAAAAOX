// Module « commerce » — boutique : lecture du thème et des pages (les outils AXIA ne les
// lisent que par un outil d'écriture), sections de la page d'accueil posées bloc par bloc,
// aperçu. L'IA ne manipule que les blocs du catalogue du Constructeur (lib/block-catalog.ts),
// avec leurs champs connus : jamais de HTML, de CSS ni de script libres.
import { prisma } from "@/lib/prisma";
import { lienBoutique } from "@/lib/origine-site";
import { evaluerPublication } from "@/lib/boutique-completion";
import { BLOCK_CATALOG } from "@/lib/block-catalog";
import { findNode, zoneDe } from "@/lib/block-tree";
import { applyAgentActions, validerActions, type AgentNodeSpec } from "@/lib/agent-actions";
import { assurerSections } from "@/lib/design-accueil";
import { resumerPage } from "@/lib/pages-annexes";
import { resumerFiche } from "@/lib/fiche-produit";
import type { BlockNode, ThemeConfig } from "@/lib/theme-config";
import { liste, lu, nombre, objet, ok, parmi, refuser, requis, texte, type Args, type Outil } from "./commun";

const WIDGETS = BLOCK_CATALOG.filter((e) => e.categorie === "widget");
const PAGES = ["home", "about", "contact", "product"] as const;
// Sous-arbres de blocs (onglets, colonnes) : laissés à leur valeur par défaut, comme le demande le catalogue.
const CHAMPS_FERMES = new Set(["onglets", "colonnes"]);

async function themeDe(tenantId: string) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, nomBoutique: true, statut: true, themeId: true, themeConfig: true } });
  if (!t) return refuser("NOT_FOUND", "Boutique introuvable.");
  return { ...t, cfg: ((t.themeConfig as Record<string, any>) ?? {}) };
}

/** Ne garde que les champs que le catalogue connaît pour ce type de bloc ; refuse tout ce qui ressemble à du code. */
function configSure(type: string, brut: unknown): Record<string, any> {
  const entree = WIDGETS.find((e) => e.type === type);
  if (!entree) return refuser("INVALID_INPUT", `Type de bloc inconnu : « ${type} ». Types possibles : ${WIDGETS.map((e) => e.type).join(", ")}.`);
  if (brut == null) return {};
  if (typeof brut !== "object" || Array.isArray(brut)) return refuser("INVALID_INPUT", `La config du bloc « ${type} » doit être un objet : ${entree.champs}`);
  const connus = Object.keys(entree.defaultConfig ?? {}).filter((k) => !CHAMPS_FERMES.has(k));
  const config = Object.fromEntries(Object.entries(brut).filter(([k]) => connus.includes(k)));
  const json = JSON.stringify(config);
  if (json.length > 8000) return refuser("INVALID_INPUT", `La config du bloc « ${type} » est trop longue.`);
  if (/javascript:|<\s*script|<\s*iframe|\bon\w+\s*=/i.test(json)) return refuser("INVALID_INPUT", "Du code (script, iframe, gestionnaire d'événement) n'est pas accepté dans un bloc.");
  return config;
}

/** Blocs de contenu d'une section du Constructeur (les sections de design sont décrites par modifier_design_accueil). */
function widgets(n: BlockNode): { id: string; type: string; config: string }[] {
  const ici = WIDGETS.some((e) => e.type === n.type) ? [{ id: n.id, type: n.type, config: JSON.stringify(n.config ?? {}).slice(0, 300) }] : [];
  return [...ici, ...(n.children ?? []).flatMap(widgets)];
}
const estDesign = (s: BlockNode) => JSON.stringify(s.children ?? []).includes('"embed-html"');

async function enregistrerArbre(tenantId: string, slug: string, config: Record<string, any>, builderTree: BlockNode[]) {
  await prisma.tenant.update({ where: { id: tenantId }, data: { themeConfig: { ...config, builderTree } as any } });
  // Invalidation du cache vitrine : sans effet (et sans erreur) hors requête Next.
  try { (await import("next/cache")).revalidatePath(`/${slug}`, "layout"); } catch {}
}

export const OUTILS_BOUTIQUE: Outil[] = [
  {
    name: "get_theme", module: "boutique", niveau: "lecture", capacite: "boutique",
    description: "Réglages actuels du thème de la boutique : couleurs, polices, arrondi, mise en page, boutons, barre de navigation, animations. À lire avant modifier_theme ou modifier_couleurs. Un réglage absent garde la valeur par défaut du design.",
    parameters: objet(),
    sortie: "{ theme_id, colors, fonts, radius, layout, buttons, navigation, animations }",
    exemple: {},
    run: async (_a, ctx) => {
      const { themeId, cfg } = await themeDe(ctx.tenantId);
      return lu("Réglages du thème.", { theme_id: themeId, colors: cfg.colors ?? null, fonts: cfg.fonts ?? null, radius: cfg.radius ?? null, layout: cfg.layout ?? null, buttons: cfg.boutons ?? null, navigation: cfg.navigationStyle ?? null, animations: cfg.animations ?? null });
    },
  },
  {
    name: "get_pages", module: "boutique", niveau: "lecture", capacite: "boutique",
    description: "Pages de la boutique et leur contenu. Sans paramètre : la liste (accueil, À propos, Contact, fiche produit) et leur état. Avec page : ses sections ou blocs dans l'ordre, avec leurs identifiants — à lire avant create_section, update_section, modifier_page, modifier_fiche_produit ou modifier_design_accueil. Une boutique Axso n'a que ces quatre pages : il n'existe pas de page libre.",
    parameters: objet({ page: { type: "string", enum: PAGES, description: "home, about, contact ou product (gabarit commun à toutes les fiches produit)" } }),
    sortie: "Sans page : { pages: [{ page, visible, blocks }] }. home : { sections: [{ id, zone, visible, kind, blocks: [{ id, type, config }] }] }. Autres pages : { summary }",
    exemple: { page: "home" },
    run: async (a, ctx) => {
      const { cfg } = await themeDe(ctx.tenantId);
      const arbre: BlockNode[] = cfg.builderTree ?? [];
      if (a.page == null || a.page === "") {
        return lu("Pages de la boutique.", { pages: [
          { page: "home", visible: true, blocks: arbre.length },
          { page: "about", visible: cfg.aboutPage?.actif === true, blocks: cfg.aboutPage?.sections?.length ?? 0 },
          { page: "contact", visible: cfg.contactPage?.actif === true, blocks: cfg.contactPage?.sections?.length ?? 0 },
          { page: "product", visible: true, blocks: cfg.productPage?.sections?.length ?? 0 },
        ] });
      }
      const page = parmi(a, "page", PAGES);
      if (page === "about" || page === "contact") { const cle = page === "about" ? "aboutPage" : "contactPage"; return lu(resumerPage(cfg[cle], cle), { page, summary: resumerPage(cfg[cle], cle) }); }
      if (page === "product") return lu(resumerFiche(cfg.productPage), { page, summary: resumerFiche(cfg.productPage) });
      // Design pas encore découpé en sections : les identifiants ne naissent qu'à la première modification (elle les enregistre).
      if (!arbre.length) return lu("La page d'accueil est encore le design d'origine, sans section identifiée. Appelle modifier_design_accueil avec actions=[] pour la découper et obtenir les identifiants, ou create_section pour y ajouter une section.", { page, sections: [] });
      const sections = arbre.slice(0, 60).map((s) => ({ id: s.id, zone: zoneDe(s), visible: s.actif !== false, kind: estDesign(s) ? "design" : "blocks", name: s.config?.nom ?? null, blocks: estDesign(s) ? [] : widgets(s).slice(0, 20) }));
      return lu(`Page d'accueil : ${sections.length} section(s). Sections « design » : textes, liens et images se modifient avec modifier_design_accueil. Sections « blocks » : update_section.`, { page, sections });
    },
  },
  {
    name: "create_section", module: "boutique", niveau: "ecriture", risque: "faible", capacite: "boutique",
    description: `Ajoute une section à la page d'accueil, faite de 1 à 6 blocs du Constructeur empilés. Types et champs de config : ${WIDGETS.map((e) => `${e.type} ${e.champs}`).join(" ; ")}. Un champ omis garde sa valeur par défaut ; images et vidéos par adresse https. Pour masquer, déplacer, dupliquer ou supprimer une section : modifier_design_accueil. Pour les pages À propos et Contact : modifier_page.`,
    parameters: objet({
      blocks: { type: "array", description: "1 à 6 blocs, de haut en bas", items: { type: "object", properties: { type: { type: "string", enum: WIDGETS.map((e) => e.type) }, config: { type: "object" } }, required: ["type"] } },
      position: { type: "number", description: "Rang parmi les sections du corps de page, 0 = tout en haut (défaut : en bas, avant le pied de page)" },
    }, ["blocks"]),
    sortie: "{ section_id, blocks: [{ id, type }] }",
    exemple: { blocks: [{ type: "heading", config: { texte: "Nos engagements", niveau: "h2", align: "center" } }, { type: "features", config: { colonnes: 3, items: [{ icone: "🚚", titre: "Livraison 48 h", texte: "Partout à Douala" }] } }], position: 1 },
    run: async (a, ctx) => {
      const blocs = liste(a, "blocks", 6) ?? [];
      if (!blocs.length) return refuser("INVALID_INPUT", "« blocks » doit contenir de 1 à 6 blocs.");
      const enfants: AgentNodeSpec[] = blocs.map((b: Args) => ({ type: requis(b, "type", 30) as AgentNodeSpec["type"], config: configSure(String(b?.type), b?.config) }));
      const t = await themeDe(ctx.tenantId);
      const config: Record<string, any> = assurerSections(t.cfg as ThemeConfig);
      const arbre: BlockNode[] = config.builderTree ?? [];
      const rang = nombre(a, "position", { entier: true, max: 200 });
      const corps = arbre.filter((n) => zoneDe(n) === "template");
      const pied = arbre.findIndex((n) => zoneDe(n) === "footer");
      const index = rang !== undefined && corps[rang] ? arbre.indexOf(corps[rang]) : pied < 0 ? arbre.length : pied;
      const actions = validerActions([{ op: "insert", parentId: null, index, node: { type: "section", children: [{ type: "row", children: [{ type: "column", children: enfants }] }] } }]);
      const suivant = applyAgentActions(arbre, actions);
      const section = suivant[index];
      if (suivant.length !== arbre.length + 1 || !section) return refuser("INVALID_INPUT", "La section n'a pas pu être construite avec ces blocs.");
      await enregistrerArbre(ctx.tenantId, t.slug, config, suivant);
      const poses = widgets(section).map(({ id, type }) => ({ id, type }));
      return ok(`Section ajoutée à la page d'accueil (${poses.map((b) => b.type).join(", ")}).`, { section_id: section.id, blocks: poses });
    },
  },
  {
    name: "update_section", module: "boutique", niveau: "ecriture", risque: "faible", capacite: "boutique",
    description: "Modifie le contenu d'UN bloc d'une section de la page d'accueil (titre, texte, bouton, image, liste d'avantages…) : seuls les champs donnés changent. block_id vient de get_pages (page=home, sections « blocks ») ou de create_section. Pour une section « design » : modifier_design_accueil. Pour le style d'un bloc : personnaliser_page_boutique.",
    parameters: objet({ block_id: { type: "string" }, config: { type: "object", description: "Champs à changer, selon le type du bloc (voir create_section)" } }, ["block_id", "config"]),
    sortie: "{ block_id, type, changed: [champs] }",
    exemple: { block_id: "heading_m2x9k1", config: { texte: "Pourquoi nous choisir" } },
    run: async (a, ctx) => {
      const id = requis(a, "block_id", 80);
      const t = await themeDe(ctx.tenantId);
      const arbre: BlockNode[] = t.cfg.builderTree ?? [];
      const bloc = findNode(arbre, id);
      if (!bloc) return refuser("NOT_FOUND", "Bloc introuvable sur la page d'accueil (get_pages page=home donne les identifiants).");
      if (!WIDGETS.some((e) => e.type === bloc.type)) return refuser("INVALID_INPUT", `Ce bloc (${bloc.type}) ne se modifie pas ici : pour une section de design, utilise modifier_design_accueil.`);
      const config = configSure(bloc.type, a.config);
      if (!Object.keys(config).length) return refuser("INVALID_INPUT", `Aucun champ reconnu pour un bloc « ${bloc.type} » : ${WIDGETS.find((e) => e.type === bloc.type)!.champs}`);
      await enregistrerArbre(ctx.tenantId, t.slug, t.cfg, applyAgentActions(arbre, [{ op: "updateConfig", nodeId: id, config }]));
      return ok(`Bloc « ${bloc.type} » mis à jour (${Object.keys(config).join(", ")}).`, { block_id: id, type: bloc.type, changed: Object.keys(config) });
    },
  },
  {
    name: "preview_store", module: "boutique", niveau: "lecture", capacite: "boutique",
    description: "Adresse de la boutique (ou d'une de ses pages) à donner au marchand pour qu'il vérifie le résultat, et état de publication : en ligne ou brouillon, et ce qui manque pour publier (publier_boutique). Les modifications de thème et de pages sont appliquées directement à la boutique : il n'y a pas de version « brouillon » séparée du design.",
    parameters: objet({ page: { type: "string", enum: ["home", "products", "about", "contact"] }, product_id: { type: "string", description: "Fiche d'un produit précis" } }),
    sortie: "{ url, public, status, ready_to_publish, missing: [critères] }",
    exemple: { page: "products" },
    run: async (a, ctx) => {
      const t = await themeDe(ctx.tenantId);
      const produitId = texte(a, "product_id", { max: 64 });
      if (produitId && !(await prisma.produit.findFirst({ where: { id: produitId, tenantId: ctx.tenantId }, select: { id: true } }))) return refuser("NOT_FOUND", "Produit introuvable dans cette boutique.");
      const chemin = produitId ? `/produits/${produitId}` : { home: "", products: "/produits", about: "/a-propos", contact: "/contact" }[parmi(a, "page", ["home", "products", "about", "contact"] as const, "home")];
      const [adresse, evaluation] = await Promise.all([lienBoutique(t.slug, chemin), evaluerPublication(ctx.tenantId)]);
      const enLigne = t.statut === "active";
      const manque = evaluation.criteres.filter((c) => !c.ok).map((c) => c.label);
      return lu(
        enLigne ? `${t.nomBoutique} est en ligne : ${adresse}` : `${t.nomBoutique} n'est pas en ligne (${t.statut}) : le public ne voit pas ${adresse}. Le marchand voit l'aperçu dans son tableau de bord Axso (Constructeur).${manque.length ? ` Avant de publier, il manque : ${manque.join(", ")}.` : " Elle est prête à être publiée (publier_boutique)."}`,
        { url: adresse, public: enLigne, status: t.statut, ready_to_publish: evaluation.prete, missing: manque },
      );
    },
  },
];
