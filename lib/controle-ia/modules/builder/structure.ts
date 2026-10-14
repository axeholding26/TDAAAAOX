// Builder MCP — pages, sections, composants : lecture du brouillon (ids, structure, contenu
// borné) et création de pages par objectif ou par intention. Les écritures passent toutes par
// les opérations pures de lib/builder/operations/structure.ts, appliquées au brouillon.
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { getCatalogEntry } from "@/lib/block-catalog";
import { zoneDe, ZONES } from "@/lib/block-tree";
import { decrireAccueil } from "@/lib/design-accueil";
import type { BlockNode, BlockNodeType } from "@/lib/theme-config";
import { lireBrouillon } from "@/lib/builder/moteur";
import { PAGES_FIXES, PLANS, arbreDePage, estDesign, pagesDe, planPourIntention, schemaDe } from "@/lib/builder/operations/structure";
import type { CtxOutil, OutilIA, ResultatIA } from "../../types";
import { ko, lienApercu, modifier, ok, traduire } from "./commun";

const objet = (properties: Record<string, any> = {}, required: string[] = []) => ({ type: "object" as const, properties, required });
const PAGE = { type: "string", description: "vide ou « accueil » (défaut), « p/<slug> » pour une page libre" };
const lecture = { module: "boutique" as const, niveau: "lecture" as const, capacite: "builder_structure" };
const creation = { module: "boutique" as const, niveau: "ecriture" as const, risque: "faible" as const, capacite: "builder_structure", sortie: "page créée dans le brouillon, résumé des changements, lien d'aperçu de la page." };
const SEO = objet({ titre: { type: "string" }, description: { type: "string" }, image: { type: "string" } });
const OBJECTIFS = ["campagne", "lancement", "promotion", "leads", "evenement", "acquisition"];

export const OUTILS: OutilIA[] = [
  {
    ...lecture, name: "axso_builder_list_pages",
    description: "Toutes les pages de la boutique : pages fixes (accueil, catalogue, fiche produit, À propos, Contact — et l'outil qui modifie chacune) et pages libres (/p/<slug>) avec statut, visibilité, ordre. Lit le brouillon s'il existe.",
    parameters: objet(), sortie: "fixed_pages, custom_pages [{ slug, nom, statut, visibilite, ordre, sections }].",
  },
  {
    ...lecture, name: "axso_builder_get_page",
    description: "Une page (accueil ou page libre) : réglages (SEO, statut, visibilité) et sections dans l'ordre d'affichage avec leurs composants.",
    parameters: objet({ page: PAGE }), exemple: { page: "p/ramadan" },
  },
  {
    ...lecture, name: "axso_builder_list_sections",
    description: "Sections d'une page par zone (header, template, footer) : id, nom, masquée, design importé ou blocs, composants contenus. À lire avant de déplacer, ajouter ou supprimer une section.",
    parameters: objet({ page: PAGE }),
  },
  {
    ...lecture, name: "axso_builder_get_section",
    description: "Détail d'une section : lignes, colonnes et composants (id, type, contenu), styles ; pour une section de design importé, ses éléments modifiables (id data-axs-el, texte, lien, image) à utiliser avec axso_builder_update_design_element.",
    parameters: objet({ page: PAGE, section_id: { type: "string" } }, ["section_id"]),
  },
  {
    ...lecture, name: "axso_builder_list_components",
    description: "Composants (widgets) d'une page ou d'une section : id, type, section, colonne, aperçu du contenu ; les grilles produits avec leur règle de liaison.",
    parameters: objet({ page: PAGE, section_id: { type: "string" } }),
  },
  {
    ...lecture, name: "axso_builder_get_component",
    description: "Un composant : sa config complète (bornée), son style (ordinateur, tablette, mobile) et les champs permis par le catalogue pour ce type.",
    parameters: objet({ page: PAGE, component_id: { type: "string" } }, ["component_id"]),
  },
  {
    ...creation, name: "axso_builder_create_collection_page",
    description: "Crée une page libre dédiée à une collection : en-tête, grille de produits LIÉE à la collection (dynamique), texte SEO. En brouillon de page tant que statut ≠ publiee. Le bloc produits n'a pas de filtres : le catalogue (/produits) les a.",
    parameters: objet({ collection: { type: "string", description: "Slug de la collection" }, nom: { type: "string" }, slug: { type: "string" }, titre: { type: "string" }, sous_titre: { type: "string" }, seo: SEO, statut: { type: "string", enum: ["brouillon", "publiee"] } }, ["collection"]),
    exemple: { collection: "ramadan", seo: { titre: "Collection Ramadan", description: "…" } },
  },
  {
    ...creation, name: "axso_builder_create_landing_page",
    description: "Crée une landing page selon un objectif — campagne, lancement (produit), promotion (compte à rebours), leads (collecte de contacts : WhatsApp ou page Contact), evenement, acquisition — avec blocs du catalogue, CTA (WhatsApp si la boutique a un numéro), produits liés (collection si donnée) et SEO. Textes génériques à relire : axso_builder_update_content.",
    parameters: objet({ objectif: { type: "string", enum: OBJECTIFS }, nom: { type: "string" }, slug: { type: "string" }, collection: { type: "string" }, titre: { type: "string" }, sous_titre: { type: "string" }, date_fin: { type: "string", description: "Fin de promotion / date d'événement (ISO)" }, seo: SEO, statut: { type: "string", enum: ["brouillon", "publiee"] } }, ["objectif", "nom"]),
    exemple: { objectif: "promotion", nom: "Soldes de fin d'année", date_fin: "2026-12-31T23:59" },
  },
  {
    ...creation, name: "axso_builder_create_page_from_intent",
    description: "Crée une page à partir d'une intention en langage courant (« page pour présenter notre collection Ramadan ») : choisit un plan de page codé (collection, campagne, lancement, promotion, leads, evenement, acquisition, présentation) et la collection citée. Aucun modèle n'invente la structure ; les textes sont génériques, à réécrire ensuite.",
    parameters: objet({ intention: { type: "string" }, nom: { type: "string" }, slug: { type: "string" }, statut: { type: "string", enum: ["brouillon", "publiee"] } }, ["intention"]),
    exemple: { intention: "page pour présenter notre collection Ramadan" },
  },
];

// ─── Résumés bornés (jamais de HTML brut) ─────────────────────────────────────
const court = (v: unknown, n = 80) => { const t = String(v ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
const nomSection = (s: BlockNode) => s.config?.nom || (estDesign(s) ? "Design importé" : "Section");

function apercuComposant(n: BlockNode): string {
  const c = n.config ?? {};
  if (n.type === "products") return `${c.regle ?? `tri ${c.tri ?? "recent"}`}${c.collection ? ` (${c.collection})` : ""}${c.categorie ? ` (${c.categorie})` : ""}${c.motCle ? ` « ${c.motCle} »` : ""}, ${c.nombre ?? 8} produits, ${c.colonnes ?? 4} col.${c.titre ? ` — « ${court(c.titre, 50)} »` : ""}`;
  const texte = c.titre ?? c.texte ?? c.ctaTexte ?? c.alt ?? c.url ?? "";
  return texte ? `« ${court(texte)} »` : "";
}

function widgets(n: BlockNode, out: { n: BlockNode; colonne?: string }[] = [], colonne?: string) {
  for (const e of n.children ?? []) {
    if (e.type === "row" || e.type === "section") widgets(e, out, colonne);
    else if (e.type === "column") widgets(e, out, e.id);
    else out.push({ n: e, colonne });
  }
  return out;
}

function ligneSection(s: BlockNode): string {
  const w = estDesign(s) ? [] : widgets(s);
  return `[${zoneDe(s)}] ${s.id} « ${court(nomSection(s), 50)} »${s.actif === false ? " (masquée)" : ""}${estDesign(s) ? " — design importé (éléments : axso_builder_get_section)" : ` — ${w.map((x) => `${x.n.type} ${x.n.id}`).join(", ") || "vide"}`}`;
}

function structure(n: BlockNode, prof = 0): string[] {
  const pad = "  ".repeat(prof);
  if (["section", "row", "column"].includes(n.type)) {
    return [`${pad}${n.type} ${n.id}${n.actif === false ? " (masqué)" : ""}${n.style ? " (stylé)" : ""}`, ...(n.children ?? []).flatMap((e) => structure(e, prof + 1))];
  }
  return [`${pad}${n.type} ${n.id} ${apercuComposant(n)}${n.actif === false ? " (masqué)" : ""}`];
}

const sections = (tree: BlockNode[]) => ZONES.flatMap((z) => tree.filter((n) => zoneDe(n) === z));

async function slugDisponible(tenantId: string, voulu: string) {
  const pages = pagesDe((await lireBrouillon(tenantId)).config);
  const base = slugify(voulu).slice(0, 50) || "page";
  let s = base;
  for (let i = 2; pages[s] || s === "accueil"; i++) s = `${base}-${i}`;
  return s;
}

/** Applique axso_builder_create_page (avec le WhatsApp de la boutique pour les CTA) et renvoie l'aperçu de la page. */
async function creerPage(ctx: CtxOutil, args: Record<string, any>, quoi: string): Promise<ResultatIA> {
  const t = await prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { whatsapp: true } });
  const slug = await slugDisponible(ctx.tenantId, args.slug || args.nom);
  const r = await modifier(ctx, [{ op: "axso_builder_create_page", args: { ...args, slug, whatsapp: t?.whatsapp || undefined } }], quoi);
  if (!r.succes) return r;
  const apercu = await lienApercu(ctx.tenantId, `p/${slug}`);
  return {
    ...r,
    resultat: `${r.resultat}\nPage : /p/${slug} (${args.statut === "publiee" ? "publiée à la prochaine publication" : "statut brouillon : invisible du public même après publication, passe-la en « publiee » avec axso_builder_update_page"}). Aperçu de la page : ${apercu ?? "indisponible"}.`,
    donnees: { ...r.donnees, page: `p/${slug}`, page_preview_url: apercu },
  };
}

export async function executer(nom: string, args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  try {
    if (nom === "axso_builder_create_collection_page") {
      return creerPage(ctx, { ...args, gabarit: "collection", nom: args.nom || args.titre || `Collection ${args.collection}` }, "Page de collection créée");
    }
    if (nom === "axso_builder_create_landing_page") {
      if (!OBJECTIFS.includes(args.objectif)) return ko("INVALID_INPUT", `objectif : ${OBJECTIFS.join(" | ")}.`);
      return creerPage(ctx, { ...args, gabarit: args.objectif }, `Landing page « ${args.objectif} » créée`);
    }
    if (nom === "axso_builder_create_page_from_intent") {
      const intention = typeof args.intention === "string" ? args.intention.trim().slice(0, 300) : "";
      if (!intention) return ko("INVALID_INPUT", "`intention` requise.");
      const collections = await prisma.collection.findMany({ where: { tenantId: ctx.tenantId, actif: true }, select: { slug: true, nom: true }, take: 100 });
      const plan = planPourIntention(intention, collections);
      const nomPage = args.nom || (plan.collection ? `Collection ${plan.collection.nom}` : court(intention, 60));
      const r = await creerPage(ctx, { nom: nomPage, slug: args.slug, statut: args.statut, gabarit: plan.gabarit, collection: plan.collection?.slug }, `Page créée (plan « ${PLANS[plan.gabarit].label} »)`);
      return r.succes ? { ...r, resultat: `${r.resultat}\nPlan choisi : ${plan.gabarit}${plan.collection ? `, collection « ${plan.collection.nom} »` : ""}. Textes génériques : réécris-les avec axso_builder_update_content.`, donnees: { ...r.donnees, plan: plan.gabarit, collection: plan.collection?.slug ?? null } } : r;
    }

    const cfg = (await lireBrouillon(ctx.tenantId)).config;
    switch (nom) {
      case "axso_builder_list_pages": {
        const libres = Object.values(pagesDe(cfg)).sort((a, b) => a.ordre - b.ordre)
          .map((p) => ({ slug: p.slug, nom: p.nom, statut: p.statut, visibilite: p.visibilite, ordre: p.ordre, gabarit: p.gabarit, sections: (p.builderTree ?? []).length, chemin: `p/${p.slug}` }));
        return ok(
          `Pages fixes :\n${PAGES_FIXES.map((f) => `• ${f.nom} (/${f.chemin}) — ${f.outil}`).join("\n")}\nPages libres :\n${libres.map((p) => `• ${p.nom} (/p/${p.slug}) — ${p.statut}, ${p.visibilite}, ${p.sections} section(s)`).join("\n") || "aucune"}`,
          { fixed_pages: PAGES_FIXES, custom_pages: libres },
        );
      }
      case "axso_builder_get_page": {
        const { cle, tree } = arbreDePage(cfg, args.page);
        const p = cle ? pagesDe(cfg)[cle] : null;
        const s = sections(tree);
        return ok(
          `${p ? `Page « ${p.nom} » (/p/${p.slug}) — ${p.statut}, ${p.visibilite}${p.gabarit ? `, gabarit ${p.gabarit}` : ""}\nSEO : ${court(p.seo?.titre, 70) || "—"} / ${court(p.seo?.description, 160) || "—"}` : "Accueil"}\n${s.map(ligneSection).join("\n") || "Aucune section."}`,
          { page: p ? { nom: p.nom, slug: p.slug, statut: p.statut, visibilite: p.visibilite, seo: p.seo, ordre: p.ordre, gabarit: p.gabarit } : { nom: "Accueil" }, sections: s.map((x) => ({ id: x.id, zone: zoneDe(x), nom: nomSection(x), masquee: x.actif === false, design: estDesign(x) })) },
        );
      }
      case "axso_builder_list_sections": {
        const s = sections(arbreDePage(cfg, args.page).tree);
        return ok(s.map(ligneSection).join("\n") || "Aucune section sur cette page.", {
          sections: s.map((x, i) => ({ id: x.id, zone: zoneDe(x), position: s.filter((y, j) => j < i && zoneDe(y) === zoneDe(x)).length, nom: nomSection(x), masquee: x.actif === false, design: estDesign(x), composants: estDesign(x) ? [] : widgets(x).map((w) => ({ id: w.n.id, type: w.n.type })) })),
        });
      }
      case "axso_builder_get_section": {
        const tree = arbreDePage(cfg, args.page).tree;
        const s = tree.find((n) => n.id === args.section_id);
        if (!s) return ko("NOT_FOUND", `section « ${args.section_id ?? ""} » introuvable (axso_builder_list_sections).`);
        if (estDesign(s)) {
          const d = decrireAccueil([s]);
          const sansIds = d.tree[0] !== s;
          return ok(sansIds
            ? `Section de design importé « ${nomSection(s)} » : ses éléments n'ont pas encore d'identifiant. Appelle axso_builder_update_design_element { page, actions: [] } pour les poser, puis relis cette section.`
            : `Section de design importé « ${nomSection(s)} » [${zoneDe(s)}] — éléments modifiables (axso_builder_update_design_element) :\n${d.resume.split("\n").slice(1).join("\n") || "aucun"}`,
          { id: s.id, zone: zoneDe(s), design: true, elements_a_identifier: sansIds });
        }
        return ok(`${ligneSection(s)}\n${structure(s).join("\n")}`, { id: s.id, zone: zoneDe(s), nom: nomSection(s), style: s.style ?? null, config: s.config ?? {} });
      }
      case "axso_builder_list_components": {
        const tree = arbreDePage(cfg, args.page).tree;
        const s = args.section_id ? tree.filter((n) => n.id === args.section_id) : sections(tree);
        if (args.section_id && !s.length) return ko("NOT_FOUND", `section « ${args.section_id} » introuvable.`);
        const liste = s.filter((x) => !estDesign(x)).flatMap((x) => widgets(x).map((w) => ({ id: w.n.id, type: w.n.type, section: x.id, colonne: w.colonne, apercu: apercuComposant(w.n), masque: w.n.actif === false })));
        return ok(liste.map((c) => `${c.type} ${c.id} (section ${c.section}, colonne ${c.colonne}) ${c.apercu}`).join("\n") || "Aucun composant (les sections de design importé ont des éléments, voir axso_builder_get_section).", { components: liste });
      }
      case "axso_builder_get_component": {
        const tree = arbreDePage(cfg, args.page).tree;
        const n = (function chercher(l: BlockNode[]): BlockNode | undefined { for (const x of l) { if (x.id === args.component_id) return x; const r = chercher(x.children ?? []); if (r) return r; } })(tree);
        if (!n || ["section", "row", "column", "embed-html"].includes(n.type)) return ko("NOT_FOUND", `composant « ${args.component_id ?? ""} » introuvable (axso_builder_list_components).`);
        const config = JSON.stringify(n.config ?? {});
        const champs = getCatalogEntry(n.type as BlockNodeType)?.champs;
        return ok(`${n.type} ${n.id}\nConfig : ${config.length > 3000 ? `${config.slice(0, 3000)}… (tronquée)` : config}\nStyle : ${JSON.stringify(n.style ?? {})}\nChamps permis : ${champs}`,
          { id: n.id, type: n.type, config: config.length > 3000 ? null : n.config ?? {}, style: n.style ?? {}, champs: Object.keys(schemaDe(n.type)), catalogue: champs });
      }
    }
    return ko("NOT_FOUND", "outil inconnu.");
  } catch (err) { return traduire(err); }
}
