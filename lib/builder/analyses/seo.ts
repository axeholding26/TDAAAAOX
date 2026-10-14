// Analyse SEO (pur) : métadonnées de l'accueil, des pages libres et des produits, titres de
// la page (un h1, hiérarchie), liens cassés, textes alternatifs, contenu trop mince.
// Ce que la vitrine génère vraiment (app/(storefront)/[slug]/…/generateMetadata) : <title>,
// meta description, image Open Graph (bannière pour l'accueil, ogImage/1re photo pour un
// produit). Pas de sitemap, de robots.txt, de balise canonique, de carte X ni de données
// structurées pour les boutiques : on le dit (etatSeo) au lieu de prétendre le gérer.
import type { ThemeConfig } from "@/lib/theme-config";
import { corr, correction, lienCasse, pagesDe, pb, tronquer, type Boutique, type Probleme } from "./commun";

export const NON_GERE = ["sitemap.xml", "robots.txt", "balise canonique", "carte X/Twitter dédiée (X lit l'Open Graph)", "données structurées (JSON-LD Product)"];

const longueur = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim().length;
const nettoyer = (t: string | null | undefined) => (t ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
/** Coupe proprement à `max` caractères (sur un mot). */
export const couper = (t: string, max: number) => (t.length <= max ? t : t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…");

/** Titre et description proposés quand ils manquent (déterministes : jamais inventés, tirés du contenu). */
export const titreSeo = (nom: string, boutique: string) => couper(nom.toLowerCase().includes(boutique.toLowerCase()) ? nom : `${nom} | ${boutique}`, 60);
export const descriptionSeo = (texte: string | null | undefined) => { const t = nettoyer(texte); return t.length >= 50 ? couper(t, 155) : null; };

/** État SEO lisible : ce qui est rempli, ce que la vitrine en fait, ce qui n'existe pas. */
export function etatSeo(cfg: ThemeConfig, b: Boutique) {
  const pages = pagesDe(cfg, b);
  return {
    accueil: {
      titre: b.metaTitle || b.nom, titre_personnalise: !!b.metaTitle,
      description: b.metaDescription || b.description || "", description_personnalisee: !!b.metaDescription,
      image_partage: b.bannerUrl ?? null,
      h1: pages[0]?.elements.filter((e) => e.sorte === "titre" && e.niveau === 1).map((e) => tronquer(e.texte, 80)) ?? [],
    },
    pages_libres: pages.slice(1).map((p) => ({ page: p.cle, nom: p.nom, ...(p.seo ?? {}) })),
    produits: {
      total: b.produits.length,
      sans_meta_titre: b.produits.filter((p) => !p.metaTitle).length,
      sans_meta_description: b.produits.filter((p) => !p.metaDesc).length,
      description_trop_courte: b.produits.filter((p) => longueur(nettoyer(p.description)) < 80).length,
    },
    genere_par_la_vitrine: ["<title>", "meta description", "image Open Graph (accueil : bannière ; produit : image dédiée ou 1re photo)"],
    non_gere_par_la_vitrine: NON_GERE,
  };
}

export function analyserSeo(cfg: ThemeConfig, b: Boutique): Probleme[] {
  const out: Probleme[] = [];
  const pages = pagesDe(cfg, b);

  // Accueil : métadonnées sur la boutique (Tenant), corrigées par axso_builder_update_store_seo (hors brouillon).
  const titre = b.metaTitle || b.nom;
  if (!b.metaTitle) out.push(pb("attention", "seo", "boutique", `Accueil : pas de titre SEO, Google affiche seulement « ${tronquer(b.nom, 40)} ». Propose « ${titreSeo(b.nom + (b.description ? ` — ${couper(nettoyer(b.description), 30)}` : ""), b.nom)} » via axso_builder_update_store_seo.`));
  else if (longueur(titre) > 60 || longueur(titre) < 15) out.push(pb("info", "seo", "boutique", `Accueil : titre SEO de ${longueur(titre)} caractères (idéal 30-60).`));
  const desc = b.metaDescription || b.description;
  if (!desc) out.push(pb("critique", "seo", "boutique", "Accueil : aucune meta description ni description de boutique — Google invente l'extrait. À remplir via axso_builder_update_store_seo."));
  else if (longueur(desc) < 70 || longueur(desc) > 160) out.push(pb("info", "seo", "boutique", `Accueil : meta description de ${longueur(desc)} caractères (idéal 70-160).`));
  if (!b.bannerUrl) out.push(pb("info", "seo", "boutique", "Accueil : pas de bannière, donc pas d'image quand le lien est partagé sur WhatsApp ou Facebook."));

  const titresPages = new Map<string, string[]>();
  for (const p of pages) {
    // Titres de la page : un seul h1, pas de saut de niveau.
    const titres = p.elements.filter((e) => e.sorte === "titre" && e.zone === "template");
    const h1 = titres.filter((e) => e.niveau === 1);
    const heading = (e?: (typeof titres)[number]) => e?.typeBloc === "heading";
    if (!h1.length) {
      const premier = titres[0];
      out.push(pb("attention", "seo", premier?.bloc ?? `page:${p.cle}`, `${p.nom} : aucun titre principal (h1) — Google ne sait pas de quoi parle la page.`,
        heading(premier) ? corr.configBloc(p.cle, premier.bloc, { niveau: "h1" }) : null));
    } else if (h1.length > 1) out.push(pb("attention", "seo", h1[1].bloc, `${p.nom} : ${h1.length} titres h1 (« ${h1.map((e) => tronquer(e.texte, 25)).join(" », « ")} ») — garde-en un seul.`,
      heading(h1[1]) ? corr.configBloc(p.cle, h1[1].bloc, { niveau: "h2" }) : null));
    let prec = 0;
    for (const t of titres) {
      if (prec && t.niveau! > prec + 1) { out.push(pb("info", "seo", t.bloc, `${p.nom} : saut de niveau de titre (h${prec} → h${t.niveau}, « ${tronquer(t.texte, 30)} »).`)); break; }
      prec = t.niveau!;
    }
    for (const t of titres) if (!t.texte?.trim()) out.push(pb("attention", "seo", t.bloc, `${p.nom} : titre h${t.niveau} vide.`));

    // Contenu mince : peu de texte réel sur la page.
    const mots = p.elements.filter((e) => e.sorte === "texte" || e.sorte === "titre").map((e) => e.texte ?? "").join(" ").split(/\s+/).filter(Boolean).length;
    if (p.cle !== "accueil" && mots < 80) out.push(pb("attention", "seo", `page:${p.cle}`, `${p.nom} : ${mots} mots seulement — contenu trop mince pour être bien référencé (vise 150+).`));

    // Pages libres : métadonnées du brouillon (axso_builder_update_seo).
    if (p.cle.startsWith("p/")) {
      const slug = p.cle.slice(2), seo = p.seo ?? {};
      const proposition: Record<string, any> = { page: slug };
      if (!seo.titre) proposition.titre = titreSeo(p.nom, b.nom);
      const d = descriptionSeo(p.elements.filter((e) => e.sorte === "texte").map((e) => e.texte).join(" "));
      if (!seo.description && d) proposition.description = d;
      if (!seo.titre || !seo.description) out.push(pb("attention", "seo", `page:${p.cle}`, `${p.nom} : ${!seo.titre ? "titre SEO" : ""}${!seo.titre && !seo.description ? " et " : ""}${!seo.description ? "meta description" : ""} manquant(s).`,
        Object.keys(proposition).length > 1 ? correction(["axso_builder_update_seo", proposition]) : null));
      if (slug.length > 40 || /^\d+$/.test(slug) || /(^|-)\d{5,}(-|$)/.test(slug)) out.push(pb("info", "seo", `page:${p.cle}`, `${p.nom} : adresse « ${slug} » peu lisible — préfère 2 à 5 mots-clés.`));
      const t = (seo.titre || p.nom).toLowerCase();
      titresPages.set(t, [...(titresPages.get(t) ?? []), p.cle]);
    }

    // Liens cassés et images sans texte alternatif.
    for (const e of p.elements) {
      if ((e.sorte === "lien" || e.sorte === "bouton") && e.lien !== undefined) {
        const r = lienCasse(e.lien, cfg, b);
        if (r && r !== "élément cliquable sans adresse") out.push(pb(r === "lien vide" ? "attention" : "critique", "seo", e.bloc, `${p.nom} : lien « ${tronquer(e.texte, 30) || "sans texte"} » cassé (${r}).`));
      }
    }
    const sansAlt = p.elements.filter((e) => e.sorte === "image" && e.url && !e.alt && e.source !== "socle");
    for (const e of sansAlt) {
      if (e.typeBloc === "gallery") continue;
      out.push(pb("attention", "seo", e.bloc, `${p.nom} : image sans texte alternatif (${tronquer(e.url!.split("/").pop(), 40)}) — invisible pour Google Images et les lecteurs d'écran (la correction proposée met le nom de la page : précise-le si possible).`,
        e.typeBloc === "image" ? corr.configBloc(p.cle, e.bloc, { alt: couper(p.nom === "Accueil" ? b.nom : p.nom, 100) }) : null));
    }
    for (const g of new Set(sansAlt.filter((e) => e.typeBloc === "gallery").map((e) => e.bloc))) {
      out.push(pb("info", "seo", g, `${p.nom} : les photos d'une galerie n'ont pas de texte alternatif (rendu actuel du bloc Galerie, non réglable).`));
    }
  }
  for (const [t, cles] of titresPages) if (cles.length > 1) out.push(pb("attention", "seo", `page:${cles[1]}`, `Titre SEO « ${tronquer(t, 40)} » en double sur ${cles.join(", ")}.`));

  // Produits : métadonnées sur Produit (écriture directe des données produit, hors brouillon).
  const sansTitre = b.produits.filter((p) => !p.metaTitle), sansDesc = b.produits.filter((p) => !p.metaDesc && !descriptionSeo(p.description));
  if (sansTitre.length) out.push(pb("info", "seo", "produits", `${sansTitre.length} produit(s) sans titre SEO (le nom est utilisé) : ${sansTitre.slice(0, 5).map((p) => tronquer(p.nom, 25)).join(", ")}${sansTitre.length > 5 ? "…" : ""}. axso_builder_fix_seo peut les remplir.`));
  if (sansDesc.length) out.push(pb("attention", "seo", "produits", `${sansDesc.length} produit(s) sans meta description et avec une description trop courte : ${sansDesc.slice(0, 5).map((p) => tronquer(p.nom, 25)).join(", ")}${sansDesc.length > 5 ? "…" : ""}. Enrichis leur description.`));
  const vus = new Map<string, number>();
  for (const p of b.produits) { const k = (p.metaTitle || p.nom).trim().toLowerCase(); vus.set(k, (vus.get(k) ?? 0) + 1); }
  const doublons = [...vus].filter(([, n]) => n > 1);
  if (doublons.length) out.push(pb("attention", "seo", "produits", `Titres de produits en double : ${doublons.slice(0, 5).map(([k, n]) => `« ${tronquer(k, 30)} » ×${n}`).join(", ")}.`));
  return out;
}
