// Builder MCP — analyses (mobile, SEO, accessibilité, performance, conversion), score de
// santé, validation avant publication, SEO (lecture, correction) et vérification visuelle.
// Les analyses sont des fonctions pures (lib/builder/analyses) : ce fichier ne fait que
// charger la config (brouillon par défaut) et les données de la boutique, puis mettre en forme.
// Chaque problème : { gravite, domaine, cible, message, correction: { op, args } | null },
// correction applicable telle quelle par axso_builder_apply.
import { prisma } from "@/lib/prisma";
import { resolveThemeConfigAsync } from "@/lib/theme-config-server";
import type { ThemeConfig } from "@/lib/theme-config";
import { configDe } from "@/lib/builder/moteur";
import { ErreurBuilder, type EtapeOperation } from "@/lib/builder/types";
import type { Boutique, Probleme } from "@/lib/builder/analyses/commun";
import { analyserMobile } from "@/lib/builder/analyses/mobile";
import { analyserSeo, couper, descriptionSeo, etatSeo, titreSeo } from "@/lib/builder/analyses/seo";
import { analyserAccessibilite } from "@/lib/builder/analyses/accessibilite";
import { analyserPerformance } from "@/lib/builder/analyses/performance";
import { analyserConversion, type Stats } from "@/lib/builder/analyses/conversion";
import { LIBELLES, scoreSante, toutAnalyser, verdict } from "@/lib/builder/analyses/sante";
import { LARGEURS, chargerPlaywright, rendre } from "@/lib/builder/rendu";
import { enregistrerMedia } from "@/lib/controle-ia/mediatheque";
import { lancerTache } from "@/lib/controle-ia/taches";
import type { CtxOutil, OutilIA, ResultatIA } from "../../types";
import { evenement, ko, lienApercu, modifier, ok, traduire } from "./commun";

const objet = (properties: Record<string, any> = {}, required: string[] = []) => ({ type: "object" as const, properties, required });
const SOURCE = { type: "string", enum: ["brouillon", "publie"], description: "Version analysée : le brouillon (défaut) ou la boutique en ligne" };
const lecture = { module: "boutique" as const, niveau: "lecture" as const, capacite: "builder_analyse" };
const FORMAT = "liste de problèmes { gravite: info|attention|critique, domaine, cible (id de bloc, page:…, theme:…, boutique, produits), message, correction: { op, args } applicable avec axso_builder_apply, ou null }.";

const analyse = (name: string, quoi: string): OutilIA => ({
  ...lecture, name, parameters: objet({ source: SOURCE }), sortie: FORMAT, exemple: { source: "brouillon" },
  description: `${quoi} Lecture seule, sur le BROUILLON par défaut : à lancer après une série de modifications et avant axso_builder_publish. Les corrections proposées s'appliquent en une transaction avec axso_builder_apply.`,
});

export const OUTILS: OutilIA[] = [
  analyse("axso_builder_analyze_mobile", "Analyse mobile de la boutique (écran de 375 px) : textes trop grands ou trop petits, boutons sous la cible tactile de 44 px, largeurs fixes qui débordent, marges non adaptées, sections trop longues, images trop lourdes, navigation trop chargée, absence d'action dans le premier écran."),
  analyse("axso_builder_analyze_seo", "Analyse SEO : titre et meta description de l'accueil, des pages libres et des produits (absents, trop courts, en double), titre principal h1 unique et hiérarchie, liens cassés, images sans texte alternatif, contenu trop mince, adresses peu lisibles."),
  analyse("axso_builder_analyze_accessibility", "Analyse d'accessibilité : contrastes WCAG calculés entre les couleurs du thème et des blocs (seuil 4,5:1), textes alternatifs, hiérarchie des titres, liens et boutons sans nom, éléments cliquables sans adresse, champs sans libellé."),
  analyse("axso_builder_analyze_performance", "Analyse de performance : nombre et poids des images (quand la médiathèque le connaît), chargement différé, images sans ratio (la page saute), vidéos en lecture automatique, poids du CSS et du design importé, scripts de suivi (taille seulement), nombre de polices, médias inutilisés."),
  {
    ...analyse("axso_builder_analyze_conversion", "Moteur de conversion (CRO) : hero et appel à l'action, preuve sociale (avis réels), produits mis en avant, photos manquantes, faux prix barrés, signaux de confiance (livraison, paiement), friction (WhatsApp, livraison non configurée), navigation, longueur de page — croisé avec les visites, ajouts au panier et commandes des 30 derniers jours."),
  },
  {
    ...lecture, capacite: "builder_seo", name: "axso_builder_get_seo",
    description: "État SEO de la boutique : titre et description de l'accueil, image de partage, h1, SEO des pages libres, produits sans métadonnées, et ce que la vitrine génère réellement (ou pas : sitemap, canonique, données structurées). À lire avant de modifier le référencement.",
    parameters: objet({ source: SOURCE }), sortie: "accueil, pages_libres, produits (compteurs), genere_par_la_vitrine, non_gere_par_la_vitrine.",
  },
  {
    module: "boutique", niveau: "ecriture", risque: "moyen", capacite: "builder_seo", name: "axso_builder_update_store_seo",
    description: "Change le titre SEO (30-60 caractères) et la meta description (70-160) de l'ACCUEIL de la boutique. Ce sont des données de la boutique, pas du design : l'écriture est directe, EN LIGNE tout de suite (hors brouillon). Pour une page libre : axso_builder_update_seo (brouillon).",
    parameters: objet({ titre: { type: "string", maxLength: 70 }, description: { type: "string", maxLength: 170 } }),
    sortie: "avant / après.", exemple: { titre: "Pagnes wax et bogolan faits main | NDOP", description: "Pagnes wax, bogolan et kente travaillés par des ateliers nommés. Livraison à Douala et Yaoundé, paiement à la livraison." },
  },
  {
    module: "boutique", niveau: "ecriture", risque: "moyen", capacite: "builder_seo", name: "axso_builder_fix_seo",
    description: "Pilote automatique SEO. Sans `appliquer` : PROPOSE les corrections (rien n'est modifié). Avec appliquer: true : applique au BROUILLON les corrections de la config (pages libres, textes alternatifs, h1 en double…) en une transaction, et écrit DIRECTEMENT (hors brouillon, en ligne) les titres/descriptions SEO manquants de l'accueil et des produits, tirés de leurs propres textes (rien d'inventé). Les produits sans description assez longue sont listés à enrichir.",
    parameters: objet({
      appliquer: { type: "boolean", description: "false (défaut) : proposer seulement" },
      produits: { type: "boolean", description: "Inclure les métadonnées des produits (défaut true)" },
      limite_produits: { type: "integer", minimum: 1, maximum: 50, description: "Produits traités au plus (défaut 20)" },
    }),
    sortie: "corrections du brouillon (étapes), accueil, produits ; avec appliquer : ce qui a été fait.",
    evaluerRisque: async (args) => (args.appliquer === true ? { risque: "moyen", resume: "Métadonnées SEO de l'accueil et des produits écrites en ligne ; reste au brouillon." } : { risque: "faible", resume: "Propositions seulement." }),
  },
  {
    ...lecture, name: "axso_builder_get_health_score",
    description: "Score de santé /100 de la boutique par domaine (Design, UX, Mobile, SEO, Performance, Accessibilité, Conversion, Cohérence de marque) et global, avec le barème. Pour suivre l'effet d'une série de modifications (avant / après).",
    parameters: objet({ source: SOURCE }), sortie: "global, domaines, bareme, les 10 problèmes les plus graves.",
  },
  {
    ...lecture, name: "axso_builder_validate",
    description: "Validateur global AVANT publication : toutes les analyses + validation de structure (types de blocs, imbrication, code interdit). Verdict prêt à publier ou non, problèmes critiques, et les corrections applicables d'un coup avec axso_builder_apply.",
    parameters: objet({ source: SOURCE }), sortie: "pret (booléen), structure, critiques, corrections (étapes { op, args }), score.",
  },
  {
    module: "boutique", niveau: "ecriture", risque: "faible", capacite: "builder_analyse", name: "axso_builder_render_check",
    description: "Vérification VISUELLE du brouillon : ouvre la vraie vitrine (lien d'aperçu) dans un navigateur à 1280, 768 et 375 px, mesure débordement horizontal, éléments hors écran, images cassées, textes < 12 px, cibles tactiles < 44 px, contrastes réels, et range les captures d'écran dans la médiathèque de la boutique. Tâche longue : renvoie un job_id (axso_statut_tache). Disponible seulement là où un navigateur sans écran est installé ; sinon utilise axso_builder_validate.",
    parameters: objet({
      page: { type: "string", description: "Chemin dans la boutique : vide (accueil), « produits », « p/<page> »…" },
      largeurs: { type: "array", items: { type: "integer", enum: [...LARGEURS] }, description: "Défaut : 1280, 768 et 375" },
      captures: { type: "boolean", description: "Ranger les captures dans la médiathèque (défaut true)" },
    }),
    sortie: "job_id ; résultat : par largeur, mesures et adresse de la capture, puis problèmes au format des analyses.",
  },
];

// ─── Chargement ──────────────────────────────────────────────────────────────
async function charger(ctx: CtxOutil, source: "brouillon" | "publie") {
  const tenantId = ctx.tenantId;
  const [brut, t, produits, collections, avisApprouves, medias] = await Promise.all([
    configDe(tenantId, source),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { themeId: true, nomBoutique: true, slug: true, devise: true, description: true, metaTitle: true, metaDescription: true, logoUrl: true, bannerUrl: true, whatsapp: true, parametresLivraison: true, trackingScripts: true, metaPixelId: true, tiktokPixelId: true, snapPixelId: true, gtmId: true },
    }),
    prisma.produit.findMany({ where: { tenantId, actif: true }, orderBy: { ventes: "desc" }, take: 500, select: { id: true, nom: true, slug: true, description: true, metaTitle: true, metaDesc: true, images: true, prix: true, prixCompare: true, actif: true } }),
    prisma.collection.findMany({ where: { tenantId, actif: true }, select: { slug: true, nom: true }, take: 200 }),
    prisma.avis.count({ where: { tenantId, approuve: true } }),
    prisma.mediaIA.findMany({ where: { tenantId, type: "image" }, orderBy: { createdAt: "desc" }, take: 300, select: { url: true, largeur: true, hauteur: true, metadonnees: true } }),
  ]);
  if (!t) throw new ErreurBuilder("NOT_FOUND", "Boutique introuvable.");
  const cfg = { ...(await resolveThemeConfigAsync(t.themeId, tenantId, brut)), pagesPerso: brut.pagesPerso } as ThemeConfig;
  const boutique: Boutique = {
    nom: t.nomBoutique, slug: t.slug, devise: t.devise, description: t.description, metaTitle: t.metaTitle, metaDescription: t.metaDescription,
    logoUrl: t.logoUrl, bannerUrl: t.bannerUrl, whatsapp: t.whatsapp, livraison: t.parametresLivraison as Record<string, any>,
    // Jamais le contenu des scripts : seulement leur taille et le nombre de pixels.
    scripts: { octets: t.trackingScripts?.length ?? 0, pixels: [t.metaPixelId, t.tiktokPixelId, t.snapPixelId, t.gtmId].filter(Boolean).length },
    produits, collections, avisApprouves,
    medias: medias.map((m) => ({ url: m.url, largeur: m.largeur, hauteur: m.hauteur, octets: Number((m.metadonnees as any)?.octets) || null })),
  };
  return { brut, cfg, boutique };
}

/** Chiffres des 30 derniers jours ; commandes selon le droit « commandes », chiffre d'affaires selon « finance ». */
async function stats(ctx: CtxOutil): Promise<Stats | null> {
  const depuis = new Date(Date.now() - 30 * 86_400_000), tenantId = ctx.tenantId;
  if (ctx.grille.commandes === "aucun") return null;
  const [visites, commandes, ajoutsPanier, ca] = await Promise.all([
    prisma.analytics.count({ where: { tenantId, type: "page_view", date: { gte: depuis } } }),
    prisma.commande.count({ where: { tenantId, createdAt: { gte: depuis }, statut: { not: "annulee" } } }),
    prisma.pixelEvent.count({ where: { tenantId, type: "AddToCart", createdAt: { gte: depuis } } }),
    ctx.grille.finance !== "aucun" ? prisma.commande.aggregate({ where: { tenantId, createdAt: { gte: depuis }, statut: { not: "annulee" } }, _sum: { montantTotal: true } }) : null,
  ]);
  return { visites, commandes, ajoutsPanier, chiffreAffaires: ca?._sum.montantTotal ?? null };
}

const ORDRE = { critique: 0, attention: 1, info: 2 } as const;
const SIGNE = { critique: "✖", attention: "⚠", info: "·" } as const;
const trier = (p: Probleme[]) => [...p].sort((a, b) => ORDRE[a.gravite] - ORDRE[b.gravite]);
const compter = (p: Probleme[]) => ({ critique: p.filter((x) => x.gravite === "critique").length, attention: p.filter((x) => x.gravite === "attention").length, info: p.filter((x) => x.gravite === "info").length });

/** Texte compact pour le modèle (borné) + données complètes (bornées aussi). */
function rapport(titre: string, problemes: Probleme[], extra: Record<string, unknown> = {}, max = 40): ResultatIA {
  const p = trier(problemes), n = compter(p);
  const lignes = p.slice(0, max).map((x) => `${SIGNE[x.gravite]} [${x.cible}] ${x.message}${x.correction ? ` → correction : ${x.correction.op}` : ""}`);
  const texte = p.length
    ? `${titre} : ${n.critique} critique(s), ${n.attention} à surveiller, ${n.info} info(s).\n${lignes.join("\n")}${p.length > max ? `\n… et ${p.length - max} autres (voir donnees.problemes).` : ""}`
    : `${titre} : aucun problème détecté.`;
  const corrections = p.map((x) => x.correction).filter(Boolean) as EtapeOperation[];
  return ok(texte + (corrections.length ? `\n${corrections.length} correction(s) applicable(s) en une transaction : axso_builder_apply { operations: donnees.corrections }.` : ""),
    { total: p.length, par_gravite: n, problemes: p.slice(0, 150), corrections: corrections.slice(0, 60), ...extra });
}

const ANALYSEURS: Record<string, [string, (cfg: ThemeConfig, b: Boutique, s?: Stats | null) => Probleme[]]> = {
  axso_builder_analyze_mobile: ["Mobile", analyserMobile],
  axso_builder_analyze_seo: ["SEO", analyserSeo],
  axso_builder_analyze_accessibility: ["Accessibilité", analyserAccessibilite],
  axso_builder_analyze_performance: ["Performance", analyserPerformance],
  axso_builder_analyze_conversion: ["Conversion", analyserConversion],
};

const texteSeo = (v: unknown, max: number) => (typeof v === "string" && !/[<>]/.test(v) && v.trim().length <= max ? v.replace(/\s+/g, " ").trim() : null);

async function noteMarque(ctx: CtxOutil): Promise<number | null> {
  // Outil d'une autre partie du Builder, appelé par le même circuit ; absent → « non évalué ».
  const r = await ctx.appeler("axso_builder_validate_brand_consistency", {}).catch(() => null);
  const d = r?.succes ? (r.donnees ?? {}) as Record<string, any> : null;
  const n = Number(d?.score ?? d?.score_global ?? d?.global);
  return d && Number.isFinite(n) ? n : null;
}

export async function executer(nom: string, args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const source = args.source === "publie" ? "publie" : "brouillon";
  try {
    if (ANALYSEURS[nom]) {
      const [titre, f] = ANALYSEURS[nom];
      const { cfg, boutique } = await charger(ctx, source);
      const s = nom === "axso_builder_analyze_conversion" ? await stats(ctx) : null;
      return rapport(`${titre} (${source})`, f(cfg, boutique, s), s ? { stats_30j: s } : {});
    }
    switch (nom) {
      case "axso_builder_get_seo": {
        const { cfg, boutique } = await charger(ctx, source);
        const e = etatSeo(cfg, boutique);
        return ok(
          `Accueil — titre : « ${e.accueil.titre} »${e.accueil.titre_personnalise ? "" : " (nom de la boutique, pas de titre SEO)"} ; description : ${e.accueil.description ? `« ${couper(e.accueil.description, 160)} »` : "aucune"} ; image de partage : ${e.accueil.image_partage ? "bannière" : "aucune"} ; h1 : ${e.accueil.h1.length ? e.accueil.h1.map((h) => `« ${h} »`).join(", ") : "aucun"}.\n`
          + `Pages libres : ${e.pages_libres.length ? e.pages_libres.map((p: any) => `${p.page} (${p.titre ? "titre ✓" : "sans titre"}, ${p.description ? "description ✓" : "sans description"}${p.noindex ? ", noindex" : ""})`).join(" ; ") : "aucune"}.\n`
          + `Produits : ${e.produits.total} actifs, ${e.produits.sans_meta_titre} sans titre SEO, ${e.produits.sans_meta_description} sans meta description, ${e.produits.description_trop_courte} avec une description trop courte.\n`
          + `La vitrine génère : ${e.genere_par_la_vitrine.join(", ")}. Elle NE génère PAS : ${e.non_gere_par_la_vitrine.join(", ")}.`,
          e,
        );
      }
      case "axso_builder_update_store_seo": {
        const titre = args.titre === undefined ? undefined : texteSeo(args.titre, 70);
        const description = args.description === undefined ? undefined : texteSeo(args.description, 170);
        if (titre === null || description === null || (titre === undefined && description === undefined)) return ko("INVALID_INPUT", "titre (70 caractères au plus) et/ou description (170 au plus), en texte brut.");
        const avant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { metaTitle: true, metaDescription: true } });
        await prisma.tenant.update({ where: { id: ctx.tenantId }, data: { ...(titre !== undefined && { metaTitle: titre || null }), ...(description !== undefined && { metaDescription: description || null }) } });
        evenement(ctx, "store.updated", { seo: true });
        return ok(`SEO de l'accueil mis à jour EN LIGNE (donnée de boutique, hors brouillon).${titre !== undefined ? `\nTitre : « ${avant?.metaTitle ?? ""} » → « ${titre} »` : ""}${description !== undefined ? `\nDescription : « ${avant?.metaDescription ?? ""} » → « ${description} »` : ""}`,
          { avant, apres: { metaTitle: titre, metaDescription: description } });
      }
      case "axso_builder_fix_seo": {
        const { cfg, boutique: b } = await charger(ctx, "brouillon");
        const etapes = analyserSeo(cfg, b).map((p) => p.correction).filter(Boolean) as EtapeOperation[];
        const accueil: Record<string, string> = {};
        if (!b.metaTitle) accueil.titre = titreSeo(b.description ? `${b.nom} — ${couper(b.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(), 40)}` : b.nom, b.nom);
        if (!b.metaDescription && descriptionSeo(b.description)) accueil.description = descriptionSeo(b.description)!;
        const limite = Math.min(50, Math.max(1, Number(args.limite_produits) || 20));
        const produits = args.produits === false ? [] : b.produits.filter((p) => !p.metaTitle || !p.metaDesc).slice(0, limite).map((p) => ({
          produitId: p.id, nom: p.nom,
          ...(!p.metaTitle && { metaTitle: titreSeo(p.nom, b.nom) }),
          ...(!p.metaDesc && descriptionSeo(p.description) && { metaDesc: descriptionSeo(p.description)! }),
        }));
        const aEnrichir = produits.filter((p) => !p.metaTitle && !p.metaDesc).map((p) => p.nom);
        const aEcrire = produits.filter((p) => p.metaTitle || p.metaDesc);
        const proposition = { brouillon: etapes, accueil, produits: aEcrire, a_enrichir: aEnrichir };
        if (args.appliquer !== true) {
          return ok(`Propositions SEO (rien n'est modifié) :\n- brouillon : ${etapes.length} correction(s)${etapes.length ? ` (${[...new Set(etapes.map((e) => e.op))].join(", ")})` : ""}\n- accueil : ${Object.keys(accueil).length ? Object.entries(accueil).map(([k, v]) => `${k} « ${v} »`).join(" ; ") : "rien à corriger"}\n- produits : ${aEcrire.length} à compléter${aEnrichir.length ? ` ; ${aEnrichir.length} sans description assez longue, à enrichir d'abord (${aEnrichir.slice(0, 5).join(", ")})` : ""}\nRelance avec appliquer: true pour appliquer (accueil et produits : écriture directe, en ligne).`, proposition);
        }
        const fait: string[] = [];
        if (etapes.length) {
          const r = await modifier(ctx, etapes, "Corrections SEO appliquées");
          fait.push(r.succes ? `brouillon : ${etapes.length} correction(s) appliquée(s)` : `brouillon : échec (${r.resultat})`);
        }
        if (Object.keys(accueil).length) {
          await prisma.tenant.update({ where: { id: ctx.tenantId }, data: { ...(accueil.titre && { metaTitle: accueil.titre }), ...(accueil.description && { metaDescription: accueil.description }) } });
          fait.push(`accueil : ${Object.keys(accueil).join(" et ")} écrits en ligne`);
        }
        // Produits : outil métier existant (enrichir_produit), par le même circuit (droits, journal).
        let okProduits = 0;
        const echecs: string[] = [];
        for (const p of aEcrire) {
          const r = await ctx.appeler("enrichir_produit", { produitId: p.produitId, ...(p.metaTitle && { metaTitle: p.metaTitle }), ...(p.metaDesc && { metaDesc: p.metaDesc }) });
          if (r.succes) okProduits++; else echecs.push(`${p.nom} (${r.code ?? r.resultat.slice(0, 60)})`);
        }
        if (aEcrire.length) fait.push(`produits : ${okProduits}/${aEcrire.length} mis à jour en ligne${echecs.length ? ` ; échecs : ${echecs.slice(0, 5).join(", ")}` : ""}`);
        return ok(`SEO corrigé :\n- ${fait.join("\n- ") || "rien à corriger"}${aEnrichir.length ? `\nÀ enrichir d'abord (description trop courte) : ${aEnrichir.slice(0, 8).join(", ")}.` : ""}`, { ...proposition, fait, echecs });
      }
      case "axso_builder_get_health_score": {
        const { cfg, boutique } = await charger(ctx, source);
        const problemes = toutAnalyser(cfg, boutique, await stats(ctx));
        const s = scoreSante(problemes, await noteMarque(ctx));
        const lignes = Object.entries(s.domaines).map(([d, n]) => `${LIBELLES[d as keyof typeof LIBELLES]} : ${n === null ? "non évalué" : `${n}/100`}`);
        return ok(`Santé de la boutique (${source}) : ${s.global}/100.\n${lignes.join("\n")}\nBarème : ${s.bareme}\nÀ traiter d'abord :\n${trier(problemes).slice(0, 10).map((p) => `${SIGNE[p.gravite]} [${p.domaine}] ${p.message}`).join("\n")}`,
          { ...s, par_gravite: compter(problemes), problemes: trier(problemes).slice(0, 10) });
      }
      case "axso_builder_validate": {
        const [{ brut, cfg, boutique }, publie] = await Promise.all([charger(ctx, source), configDe(ctx.tenantId, "publie")]);
        const problemes = toutAnalyser(cfg, boutique, await stats(ctx));
        const v = verdict(brut, source === "brouillon" ? publie : {}, problemes);
        const s = scoreSante(problemes, await noteMarque(ctx));
        const r = rapport(`${v.pret ? "PRÊT à publier" : "PAS prêt à publier"} — score ${s.global}/100`, problemes, { pret: v.pret, structure: v.structure, score: s }, 25);
        return v.structure.length ? { ...r, resultat: `Structure refusée : ${v.structure.slice(0, 5).join(" ; ")}\n${r.resultat}` } : r;
      }
      case "axso_builder_render_check": {
        if (!(await chargerPlaywright())) return ko("UNAVAILABLE", "la vérification visuelle n'est pas disponible sur ce serveur (pas de navigateur sans écran). Les analyses statiques restent disponibles : axso_builder_validate.");
        const page = String(args.page ?? "").replace(/^\/+/, "").slice(0, 200);
        const largeurs = Array.isArray(args.largeurs) && args.largeurs.length ? [...new Set(args.largeurs.map(Number))].filter((l) => (LARGEURS as readonly number[]).includes(l)) : [...LARGEURS];
        if (!largeurs.length) return ko("INVALID_INPUT", "largeurs : 1280, 768 et/ou 375.");
        // Lien calculé ici : l'origine vient de la requête en cours, plus disponible dans la tâche.
        const url = await lienApercu(ctx.tenantId, page);
        if (!url) return ko("UNAVAILABLE", "lien d'aperçu indisponible (secret serveur absent).");
        const captures = args.captures !== false;
        return lancerTache({ tenantId: ctx.tenantId, connexionId: ctx.connexionId }, "builder_render_check", async (avancer) => {
          const rendus = await rendre(url, largeurs, avancer);
          const problemes: Probleme[] = [];
          const resultats = [];
          for (const r of rendus) {
            const m = r.mesures, ou = `${page || "accueil"} @${r.largeur}px`;
            let capture: string | null = null;
            if (r.capture && captures) {
              const media = await enregistrerMedia({ tenantId: ctx.tenantId, type: "image", fournisseur: "axso-rendu", rendu: { donnees: r.capture, mime: "image/jpeg" }, creePar: ctx.connexionId, metadonnees: { statut: "verification", page: page || "accueil", largeur: r.largeur, source: "brouillon" } }).catch(() => null);
              capture = media?.url.startsWith("data:") ? `media:${media.id}` : media?.url ?? null;
            }
            if (!m) {
              problemes.push({ gravite: "critique", domaine: "ux", cible: `page:${page || "accueil"}`, message: `${ou} : la page ne s'affiche pas (${r.statut ? `HTTP ${r.statut}` : r.erreur ?? "sans réponse"})${r.statut === 404 ? " — une boutique pas encore publiée n'est visible que du marchand connecté" : ""}.`, correction: null });
              resultats.push({ largeur: r.largeur, statut: r.statut, capture });
              continue;
            }
            if (m.debordement > 0) problemes.push({ gravite: "critique", domaine: "mobile", cible: m.horsEcran[0]?.cible ?? `page:${page || "accueil"}`, message: `${ou} : la page déborde de ${m.debordement}px sur le côté${m.horsEcran.length ? ` (${m.horsEcran.slice(0, 3).map((h) => h.quoi).join(", ")})` : ""}.`, correction: null });
            for (const i of m.imagesCassees) problemes.push({ gravite: "critique", domaine: "ux", cible: i.cible ?? `page:${page || "accueil"}`, message: `${ou} : image cassée (${i.src.split("/").pop()?.slice(0, 60)}).`, correction: null });
            for (const t of m.textesPetits.slice(0, 5)) problemes.push({ gravite: "attention", domaine: "mobile", cible: t.cible ?? `page:${page || "accueil"}`, message: `${ou} : texte en ${t.taille}px « ${t.texte} » (minimum 12 px).`, correction: null });
            for (const c of m.ciblesPetites.slice(0, 5)) problemes.push({ gravite: "attention", domaine: "mobile", cible: c.cible ?? `page:${page || "accueil"}`, message: `${ou} : « ${c.texte || "élément cliquable"} » fait ${c.largeur}×${c.hauteur}px, sous la cible tactile de 44 px.`, correction: null });
            for (const c of m.contrastes.slice(0, 5)) problemes.push({ gravite: c.ratio < 3 ? "critique" : "attention", domaine: "accessibilite", cible: c.cible ?? `page:${page || "accueil"}`, message: `${ou} : contraste ${c.ratio}:1 « ${c.texte} » (${c.couleur} sur ${c.fond}).`, correction: null });
            resultats.push({ largeur: r.largeur, statut: r.statut, capture, mesures: m });
          }
          return { page: page || "accueil", source: "brouillon", largeurs: resultats, par_gravite: compter(problemes), problemes: trier(problemes).slice(0, 60) };
        });
      }
    }
    return ko("NOT_FOUND", "outil inconnu.");
  } catch (err) { return traduire(err); }
}
