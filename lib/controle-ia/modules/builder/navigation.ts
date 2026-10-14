// Builder MCP — navigation, en-tête et pied de page. Lecture (menus avec leur cible résolue
// et leur validité) et analyse (liens cassés, menu trop chargé, pages importantes absentes)
// sur le brouillon ; les modifications sont des opérations pures (lib/builder/operations/navigation.ts).
// Exceptions hors brouillon, en risque « moyen » : logo du socle (Tenant.logoUrl) et réseaux
// sociaux (Tenant.socialLinks) — des données de la boutique, pas du design.
import { prisma } from "@/lib/prisma";
import { configDe, donneesBoutique, lireBrouillon } from "@/lib/builder/moteur";
import { lireMenus, sectionsChrome, verifierLien } from "@/lib/builder/operations/navigation";
import { corrigerLiensDesign } from "@/lib/liens-design";
import { ErreurBuilder, type DonneesBoutique } from "@/lib/builder/types";
import { INCONNU, type CtxOutil, type OutilIA, type ResultatIA } from "../../types";
import { ko, modifier, ok, traduire } from "./commun";

const objet = (properties: Record<string, any> = {}, required: string[] = []) => ({ type: "object" as const, properties, required });
const base = { module: "boutique" as const, capacite: "builder_navigation" };
const VERSION = { type: "string", enum: ["brouillon", "publie"], description: "Défaut : brouillon" };
const RESEAUX = ["instagram", "facebook", "tiktok"] as const;
const DOMAINES: Record<string, RegExp> = { instagram: /(^|\.)instagram\.com$/, facebook: /(^|\.)(facebook\.com|fb\.com)$/, tiktok: /(^|\.)tiktok\.com$/ };

/** Menus tels qu'enregistrés, chaque lien avec sa cible résolue et sa validité. */
function menusVerifies(cfg: Record<string, any>, d: DonneesBoutique) {
  return lireMenus(cfg, d).map((m) => ({ ...m, liens: m.liens.map((l) => ({ ...l, ...verifierLien(l.href, d, cfg) })) }));
}

const MAX_ENTETE = 7, MAX_COLONNE = 10, MAX_COLONNES = 6;

/** Analyse de la navigation telle que le visiteur la voit (liens du design corrigés au rendu). */
function analyser(cfg: Record<string, any>, d: DonneesBoutique) {
  const design = sectionsChrome(cfg).length > 0;
  // La vitrine complète les designs au rendu (À propos, Contact, Mon compte, catalogue, collections) : on analyse ce rendu.
  const rendu = design ? corrigerLiensDesign(cfg as any, { slug: d.slug, collections: d.collections, digital: cfg.modeBoutique === "digital" }) : cfg;
  // Design : la vitrine montre ses menus, pas ceux du socle.
  const menus = menusVerifies(rendu, d).filter((m) => !design || m.source === "design");
  const casses = menus.flatMap((m) => m.liens.filter((l) => !l.valide).map((l) => ({ menu: m.id, index: l.index, libelle: l.libelle, href: l.href, raison: l.raison })));
  const complexite: string[] = [];
  const entete = menus.filter((m) => m.zone === "header");
  const nbEntete = entete.reduce((n, m) => n + m.liens.length, 0);
  if (nbEntete > MAX_ENTETE) complexite.push(`${nbEntete} liens dans l'en-tête (au-delà de ${MAX_ENTETE}, le visiteur ne lit plus) : garde l'essentiel, déplace le reste dans le pied de page.`);
  const colonnes = menus.filter((m) => m.zone === "footer");
  if (colonnes.length > MAX_COLONNES) complexite.push(`${colonnes.length} colonnes dans le pied de page (${MAX_COLONNES} au plus conseillé).`);
  for (const c of colonnes) if (c.liens.length > MAX_COLONNE) complexite.push(`Colonne « ${c.titre ?? c.id} » : ${c.liens.length} liens (${MAX_COLONNE} au plus conseillé).`);
  if (design && sectionsChrome(rendu).some((s) => /<(ul|ol)\b[^>]*>(?:(?!<\/(ul|ol)>)[\s\S])*<(ul|ol)\b/i.test(s.embed.config?.html ?? ""))) complexite.push("Sous-menus imbriqués dans le design : plus d'un niveau gêne la navigation sur mobile.");
  const doublons = menus.flatMap((m) => m.liens.filter((l, i) => l.lien && m.liens.findIndex((x) => x.lien === l.lien) < i).map((l) => `${m.id} : « ${l.libelle} » en double`));
  // Pages importantes : présentes dans au moins un menu.
  const cibles = new Set(menus.flatMap((m) => m.liens.map((l) => l.lien)));
  const absentes = [
    !cibles.has("produits") && "catalogue (produits)",
    !cibles.has("contact") && ![...cibles].some((c) => c && /^(https:\/\/wa\.me|tel:|mailto:)/.test(c)) && "contact (page Contact, WhatsApp ou téléphone)",
    ...d.collections.slice(0, 3).filter((c) => !cibles.has(`collections/${c.slug}`)).map((c) => `collection « ${c.nom} »`),
  ].filter(Boolean) as string[];
  return { design, casses, complexite, doublons, absentes, menus: menus.map((m) => ({ id: m.id, zone: m.zone, titre: m.titre, liens: m.liens.length })) };
}

/** Le média appartient-il à la boutique ? Rend son adresse (jamais une image intégrée en base, trop lourde pour la page). */
async function adresseMedia(ctx: CtxOutil, mediaId: unknown): Promise<string> {
  if (typeof mediaId !== "string" || !mediaId || mediaId.length > 64) throw new ErreurBuilder("INVALID_INPUT", "« logo_media_id » manquant.");
  const m = await prisma.mediaIA.findFirst({ where: { id: mediaId, tenantId: ctx.tenantId }, select: { url: true, type: true } });
  if (!m) throw new ErreurBuilder("NOT_FOUND", "Média introuvable dans la médiathèque de cette boutique (axso_builder_list_assets).");
  if (m.type !== "image") throw new ErreurBuilder("ASSET_INVALID", "Le logo doit être une image.");
  if (!m.url.startsWith("https://")) throw new ErreurBuilder("ASSET_INVALID", "Ce média n'est pas stocké en ligne (stockage de fichiers non configuré) : il ne peut pas servir de logo.");
  return m.url;
}

const CHAMPS_ENTETE = ["type", "style", "sticky", "hauteur", "recherche", "favoris", "annonce"];

export const OUTILS: OutilIA[] = [
  {
    ...base, name: "axso_builder_get_navigation", niveau: "lecture",
    description: "Tous les menus de la boutique — en-tête, menu mobile (mêmes liens que l'en-tête), colonnes du pied de page — avec, pour chaque lien, sa cible résolue (collection, page, produit, WhatsApp…) et sa validité, plus les réglages d'en-tête, d'annonce et de pied de page. À lire avant toute modification de menu : donne les identifiants de menus et l'index des liens.",
    parameters: objet({ version: VERSION }),
    sortie: "source (design | socle), menus [{ id, source, zone, titre, liens [{ index, libelle, href, cible, valide, raison? }] }], entete, pied, notes.",
    exemple: {},
  },
  {
    ...base, name: "axso_builder_analyze_navigation", niveau: "lecture",
    description: "Diagnostic de la navigation telle que le visiteur la voit : liens cassés (collection, page ou produit inexistants, autre boutique, lien vide), navigation trop chargée ou trop profonde, doublons, pages importantes absentes des menus (catalogue, contact, collections principales). Avec les outils pour corriger.",
    parameters: objet({ version: VERSION }),
    sortie: "broken_links, complexity, duplicates, missing_pages, suggestions.",
    exemple: { version: "publie" },
  },
  {
    ...base, name: "axso_builder_update_header", niveau: "ecriture", risque: "faible", cache: true,
    description: "Règle l'en-tête (brouillon) : disposition, apparence, collant, hauteur, recherche, favoris, barre d'annonce, logo du design. logo_media_id (image de la médiathèque) : sur un design importé, posé dans l'en-tête du brouillon ; sur le socle, devient le logo de la boutique — donnée de la boutique écrite DIRECTEMENT en ligne, hors brouillon (risque moyen). Panier, compte et menu mobile : toujours présents, non réglables.",
    parameters: objet({
      type: { type: "string", enum: ["classic", "centered", "floating", "minimal", "mega", "transparent-scroll"] }, style: { type: "string", enum: ["light", "dark", "glass", "transparent"] },
      sticky: { type: "boolean" }, hauteur: { type: "string", enum: ["48px", "64px", "80px"] }, recherche: { type: "boolean" }, favoris: { type: "boolean" },
      annonce: objet({ actif: { type: "boolean" }, texte: { type: "string" }, couleur_fond: { type: "string" }, couleur_texte: { type: "string" }, defilant: { type: "boolean" } }),
      logo_media_id: { type: "string", description: "Image de la médiathèque (axso_builder_list_assets)" }, logo_alt: { type: "string" },
    }),
    evaluerRisque: async (args, ctx) => {
      if (!args.logo_media_id) return { risque: "faible" };
      const b = await lireBrouillon(ctx.tenantId).catch(() => null);
      return b && sectionsChrome(b.config).some((s) => s.zone === "header") ? { risque: "faible" } : { risque: "moyen", resume: "Change le logo de la boutique en ligne (hors brouillon)." };
    },
    sortie: "résumé des changements du brouillon, lien d'aperçu ; logo_live si le logo de la boutique a été changé en ligne.",
    exemple: { type: "minimal", sticky: true, annonce: { actif: true, texte: "Livraison offerte dès 20 000 FCFA" } },
  },
  {
    ...base, name: "axso_builder_update_footer", niveau: "ecriture", risque: "faible", cache: true,
    description: "Règle le pied de page : colonnes de liens (socle), newsletter (socle), copyright (design importé) dans le brouillon ; « reseaux » (liens Instagram, Facebook, TikTok, vide = retirer) est une donnée de la boutique écrite DIRECTEMENT en ligne, hors brouillon (risque moyen), affichée par le pied de page du socle. Moyens de paiement et mentions légales : non réglables (rendus automatiquement).",
    parameters: objet({
      colonnes: { type: "array", items: objet({ titre: { type: "string" }, liens: { type: "array", items: objet({ libelle: { type: "string" }, lien: { type: "string" } }, ["libelle", "lien"]) } }, ["titre", "liens"]) },
      newsletter: objet({ actif: { type: "boolean" }, titre: { type: "string" }, texte: { type: "string" }, cta: { type: "string" }, placeholder: { type: "string" } }),
      copyright: { type: "string" },
      reseaux: objet({ instagram: { type: "string" }, facebook: { type: "string" }, tiktok: { type: "string" } }),
    }),
    evaluerRisque: async (args) => (args.reseaux ? { risque: "moyen", resume: "Modifie les réseaux sociaux de la boutique en ligne (hors brouillon)." } : { risque: "faible" }),
    sortie: "résumé des changements du brouillon et lien d'aperçu ; social_links si les réseaux ont été modifiés en ligne.",
    exemple: { reseaux: { instagram: "https://instagram.com/maboutique" }, copyright: "© 2026 Ma Boutique" },
  },
];

async function lireNavigation(args: Record<string, any>, ctx: CtxOutil, analyse: boolean): Promise<ResultatIA> {
  const version = args.version === "publie" ? "publie" : "brouillon";
  const [cfg, d, t] = await Promise.all([
    configDe(ctx.tenantId, version), donneesBoutique(ctx.tenantId),
    prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { logoUrl: true, socialLinks: true, whatsapp: true } }),
  ]);
  if (analyse) {
    const a = analyser(cfg, d);
    const suggestions = [
      a.casses.length && "Corrige ou retire chaque lien cassé : axso_builder_update_menu (action modifier ou supprimer).",
      a.absentes.length && "Ajoute les pages absentes : axso_builder_update_menu (action ajouter).",
      (a.complexite.length || a.doublons.length) && "Allège : axso_builder_update_menu (supprimer) et axso_builder_reorder_menu_items.",
    ].filter(Boolean);
    const lignes = [
      `Navigation (${version}, ${a.design ? "design importé, telle que rendue" : "socle"}).`,
      a.casses.length ? `Liens cassés (${a.casses.length}) :\n${a.casses.map((c) => `- ${c.menu} n°${c.index} « ${c.libelle} » → ${c.href || "(vide)"} : ${c.raison}`).join("\n")}` : "Aucun lien cassé.",
      a.complexite.length ? `Complexité :\n- ${a.complexite.join("\n- ")}` : "Taille des menus correcte.",
      a.doublons.length ? `Doublons :\n- ${a.doublons.join("\n- ")}` : "",
      a.absentes.length ? `Pages importantes absentes des menus : ${a.absentes.join(", ")}.` : "Catalogue, contact et collections principales sont accessibles.",
      suggestions.length ? `À faire : ${suggestions.join(" ")}` : "",
    ].filter(Boolean);
    return ok(lignes.join("\n"), { version, design: a.design, broken_links: a.casses, complexity: a.complexite, duplicates: a.doublons, missing_pages: a.absentes, menus: a.menus, suggestions });
  }
  const menus = menusVerifies(cfg, d);
  const design = menus.some((m) => m.source === "design");
  const ns = cfg.navigationStyle ?? {};
  const social = (t?.socialLinks ?? {}) as Record<string, string>;
  const entete = {
    type: ns.type ?? "classic", style: ns.style ?? "light", sticky: ns.sticky !== false, hauteur: ns.hauteur ?? "64px", recherche: ns.showSearch !== false, favoris: ns.showWishlist === true,
    reglages_appliques_au_design: design ? !!cfg.reglagesDesign?.navigation : undefined,
    annonce: design ? "non affichée (design)" : { actif: !!cfg.sections?.annonce?.actif, texte: String(cfg.sections?.annonce?.texte ?? "").slice(0, 200) },
    logo_boutique: t?.logoUrl ?? null,
  };
  const pied = {
    reseaux: Object.fromEntries(RESEAUX.map((r) => [r, social[r] ?? null])), whatsapp: !!t?.whatsapp,
    newsletter: design ? "non affichée (design)" : !!cfg.sections?.newsletter?.actif,
    reseaux_affiches: design ? "non (le pied de page du design ne les montre pas)" : "oui",
  };
  const notes = [
    design && "Design importé : au rendu, la vitrine ajoute automatiquement À propos, Contact, Mon compte, le catalogue et les collections s'ils manquent, et retire le lien Panier de l'en-tête — un tel lien supprimé reviendra.",
    design && "Le menu « principal » du socle ne sert que sur les pages sans design (ex. catalogue d'une boutique dont seul l'accueil est importé).",
    "Menu mobile : mêmes liens que l'en-tête.",
  ].filter(Boolean);
  const texte = menus.map((m) => `• ${m.id} [${m.source}, ${m.zone}${m.titre ? `, « ${m.titre} »` : ""}${m.par_defaut ? ", liens par défaut" : ""}]\n${m.liens.map((l) => `   ${l.index}. « ${l.libelle} » → ${l.href || "(vide)"} : ${l.cible}${l.valide ? "" : ` ✗ ${l.raison}`}`).join("\n") || "   (vide)"}`).join("\n");
  return ok(`Navigation (${version}, ${design ? "design importé" : "socle"}) :\n${texte}\n\n${notes.join("\n")}`, { version, source: design ? "design" : "socle", menus, entete, pied, notes });
}

async function enTete(args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const opArgs: Record<string, any> = Object.fromEntries(Object.entries(args).filter(([k]) => CHAMPS_ENTETE.includes(k)));
  let logoLive: string | null = null;
  if (args.logo_media_id !== undefined) {
    const url = await adresseMedia(ctx, args.logo_media_id);
    if (sectionsChrome((await lireBrouillon(ctx.tenantId)).config).some((s) => s.zone === "header")) Object.assign(opArgs, { logo_url: url, logo_alt: args.logo_alt });
    else logoLive = url;
  }
  // Le brouillon d'abord : s'il est refusé, le logo en ligne n'est pas changé non plus.
  const r = Object.keys(opArgs).length ? await modifier(ctx, [{ op: "axso_builder_update_header", args: opArgs }], "En-tête modifié") : null;
  if (r && !r.succes) return r;
  if (logoLive) await prisma.tenant.update({ where: { id: ctx.tenantId }, data: { logoUrl: logoLive } });
  if (!r) return logoLive ? ok("Logo de la boutique changé EN LIGNE (donnée de la boutique, hors brouillon) : visible tout de suite dans l'en-tête et le pied de page du socle.", { logo_live: logoLive, draft: false }) : ko("INVALID_INPUT", "Rien à modifier.");
  return logoLive ? { ...r, resultat: `Logo de la boutique changé EN LIGNE (hors brouillon). ${r.resultat}`, donnees: { ...r.donnees, logo_live: logoLive } } : r;
}

async function piedDePage(args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  let social: Record<string, string> | null = null;
  if (args.reseaux !== undefined) {
    if (!args.reseaux || typeof args.reseaux !== "object") return ko("INVALID_INPUT", "« reseaux » : { instagram?, facebook?, tiktok? }.");
    const t = await prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { socialLinks: true } });
    social = { ...((t?.socialLinks ?? {}) as Record<string, string>) };
    for (const [r, v] of Object.entries(args.reseaux as Record<string, unknown>)) {
      if (!(RESEAUX as readonly string[]).includes(r)) return ko("INVALID_INPUT", `Réseau inconnu : ${r} (instagram, facebook, tiktok).`);
      if (v === "" || v === null) { delete social[r]; continue; }
      let ok = false;
      try { const u = new URL(String(v)); ok = u.protocol === "https:" && DOMAINES[r].test(u.hostname) && String(v).length <= 300 && !/["'<>\s]/.test(String(v)); } catch {}
      if (!ok) return ko("INVALID_INPUT", `Lien ${r} refusé : adresse https du profil sur ${r}.com attendue.`);
      social[r] = String(v);
    }
  }
  const opArgs = Object.fromEntries(Object.entries(args).filter(([k]) => ["colonnes", "newsletter", "copyright"].includes(k)));
  // Le brouillon d'abord : s'il est refusé, les réseaux ne sont pas écrits non plus.
  const r = Object.keys(opArgs).length ? await modifier(ctx, [{ op: "axso_builder_update_footer", args: opArgs }], "Pied de page modifié") : null;
  if (r && !r.succes) return r;
  if (social) await prisma.tenant.update({ where: { id: ctx.tenantId }, data: { socialLinks: social } });
  if (!r) return social ? ok("Réseaux sociaux de la boutique mis à jour EN LIGNE (donnée de la boutique, hors brouillon) ; affichés par le pied de page du socle.", { social_links: social, draft: false }) : ko("INVALID_INPUT", "Rien à modifier.");
  return social ? { ...r, resultat: `Réseaux sociaux mis à jour EN LIGNE (hors brouillon). ${r.resultat}`, donnees: { ...r.donnees, social_links: social } } : r;
}

export async function executer(nom: string, args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  try {
    switch (nom) {
      case "axso_builder_get_navigation": return await lireNavigation(args, ctx, false);
      case "axso_builder_analyze_navigation": return await lireNavigation(args, ctx, true);
      case "axso_builder_update_header": return await enTete(args, ctx);
      case "axso_builder_update_footer": return await piedDePage(args, ctx);
      default: return INCONNU;
    }
  } catch (e) { return traduire(e); }
}
