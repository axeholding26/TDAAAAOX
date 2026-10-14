// Builder MCP — médias de la boutique vus par le Builder : inventaire (médiathèque + images
// réellement utilisées par la boutique, avec leur emplacement), métadonnées lues dans le
// fichier, import depuis une adresse, remplacement dans le brouillon, suppression protégée,
// diagnostic d'optimisation et génération déléguée au module créatif (ctx.appeler : mêmes
// droits, même accord). La médiathèque reste lib/controle-ia/mediatheque.ts ; list_media,
// attach_media et delete_media (module créatif) ne sont pas refaits ici.
//
// Pas d'outil de redimensionnement dans le projet (ni sharp, ni next/image dans la vitrine) :
// aucune variante responsive n'est produite, le diagnostic le dit.
import type { MediaIA } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { configDe } from "@/lib/builder/moteur";
import { altPropose, diagnostic, imagesUtilisees, lireEntete, ratio, type UsageImage } from "@/lib/builder/images";
import { enregistrerMedia, telecharger } from "@/lib/controle-ia/mediatheque";
import { Refus } from "@/lib/controle-ia/creation/regles";
import { INCONNU, type CtxOutil, type OutilIA, type ResultatIA } from "../../types";
import { ko, modifier, ok, traduire } from "./commun";

const objet = (properties: Record<string, any> = {}, required: string[] = []) => ({ type: "object" as const, properties, required });
const base = { module: "boutique" as const, capacite: "builder_assets" };
const S = { type: "string" };
const CIBLE = objet({
  bloc_id: { ...S, description: "Bloc image, vidéo, galerie ou logos du brouillon" }, element: { ...S, description: "data-axs-el d'une image du design" },
  hero: { type: "string", enum: ["video", "diaporama"], description: "Bannière du socle" }, remplacer_url: { ...S, description: "Remplacer cette image partout dans le brouillon" }, alt: S,
});

/** Où chaque image est utilisée : boutique en ligne, brouillon, logo et bannière de la boutique. */
async function usages(tenantId: string): Promise<Map<string, { enLigne: string[]; brouillon: string[] }>> {
  const [enLigne, brouillon, t] = await Promise.all([
    configDe(tenantId, "publie"), configDe(tenantId, "brouillon"),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { logoUrl: true, bannerUrl: true } }),
  ]);
  const m = new Map<string, { enLigne: string[]; brouillon: string[] }>();
  const noter = (liste: UsageImage[], cle: "enLigne" | "brouillon") => {
    for (const u of liste) { const e = m.get(u.url) ?? { enLigne: [], brouillon: [] }; e[cle].push(u.ou); m.set(u.url, e); }
  };
  noter(imagesUtilisees(enLigne), "enLigne");
  noter(imagesUtilisees(brouillon), "brouillon");
  noter([t?.logoUrl && { url: t.logoUrl, ou: "logo de la boutique" }, t?.bannerUrl && { url: t.bannerUrl, ou: "bannière de la boutique (accueil du socle)" }].filter(Boolean) as UsageImage[], "enLigne");
  return m;
}

const court = (ou: string[]) => [...new Set(ou)].slice(0, 5);
// Sans stockage configuré, une image est gardée en base (data:) : son contenu n'est jamais renvoyé au modèle.
const adresse = (url: string) => (url.startsWith("data:") ? null : url);
const meta = (m: MediaIA) => (m.metadonnees ?? {}) as Record<string, any>;

async function lireMedia(ctx: CtxOutil, id: unknown) {
  if (typeof id !== "string" || !id || id.length > 64) return null;
  return prisma.mediaIA.findFirst({ where: { id, tenantId: ctx.tenantId } });
}

/** Média visé par media_id, ou image utilisée par la boutique visée par son adresse (jamais une adresse quelconque). */
async function cible(ctx: CtxOutil, args: Record<string, any>): Promise<{ media: MediaIA | null; url: string } | ResultatIA> {
  if (args.media_id !== undefined) {
    const m = await lireMedia(ctx, args.media_id);
    return m ? { media: m, url: m.url } : ko("NOT_FOUND", "Média introuvable dans la médiathèque de cette boutique.");
  }
  if (typeof args.url !== "string" || !args.url) return ko("INVALID_INPUT", "Indique « media_id » ou « url ».");
  const media = await prisma.mediaIA.findFirst({ where: { tenantId: ctx.tenantId, url: args.url } });
  if (media) return { media, url: media.url };
  if (!(await usages(ctx.tenantId)).has(args.url)) return ko("NOT_FOUND", "Cette adresse n'est ni dans la médiathèque ni utilisée par la boutique.");
  return { media: null, url: args.url };
}

/** Octets du fichier (images seulement : les vidéos ne sont pas téléchargées pour une simple lecture). */
async function analyserFichier(url: string) {
  const { donnees, mime } = await telecharger(url, "image");
  const entete = lireEntete(donnees);
  return { octets: donnees.length, mime, format: entete?.format ?? null, largeur: entete?.largeur ?? null, hauteur: entete?.hauteur ?? null };
}

export const OUTILS: OutilIA[] = [
  {
    ...base, name: "axso_builder_list_assets", niveau: "lecture",
    description: "Médias de la boutique pour le Builder : ceux de la médiathèque ET les images réellement utilisées par la boutique (logo, bannière, blocs, design), avec où chacune sert (en ligne, brouillon). À lire avant de remplacer, supprimer ou générer un visuel : réutilise plutôt qu'en créer un nouveau.",
    parameters: objet({ type: { type: "string", enum: ["image", "video"] }, limit: { type: "integer", minimum: 1, maximum: 100 } }),
    sortie: "media [{ media_id, type, url, width, height, used_live, used_draft }], used_outside_library [{ url, live, draft }].",
    exemple: { type: "image" },
  },
  {
    ...base, name: "axso_builder_get_asset", niveau: "lecture", cache: true,
    description: "Métadonnées d'une image (media_id, ou adresse d'une image utilisée par la boutique) lues dans le fichier : format, dimensions, ratio, poids, texte alternatif (et proposition), où elle sert, diagnostic. Point focal et variantes responsives : non gérés par Axso (dit tel quel).",
    parameters: objet({ media_id: S, url: S }),
    sortie: "{ format, mime, width, height, ratio, bytes, alt, alt_suggestion, focal_point: null, variants: [], used, problems, advice }",
    exemple: { media_id: "cm456" },
  },
  {
    ...base, name: "axso_builder_upload_asset", niveau: "ecriture", risque: "faible", cache: true,
    description: "Importe dans la médiathèque un fichier depuis une adresse https publique (photo fournie par le marchand, logo, illustration, vidéo). Vérifie que c'est bien une image (PNG, JPEG, WebP, GIF, AVIF) ou une vidéo. SVG, polices et documents : refusés (la médiathèque ne les accepte pas). N'est placé nulle part : ensuite axso_builder_replace_asset ou axso_builder_place_asset.",
    parameters: objet({ url: { ...S, description: "https://…" }, type: { type: "string", enum: ["image", "logo", "icone", "illustration", "video"] }, alt: S }, ["url"]),
    sortie: "media { media_id, url, width, height, format, bytes }",
    exemple: { url: "https://exemple.cm/photos/sac.jpg", type: "image", alt: "Sac en cuir marron" },
  },
  {
    ...base, name: "axso_builder_replace_asset", niveau: "ecriture", risque: "faible", cache: true,
    description: "Remplace une image (ou vidéo) PARTOUT où le brouillon l'utilise (blocs, sections du design, réglages). Ancienne et nouvelle : media_id ou adresse. Le design d'origine figé n'est pas réécrit ; le logo et la bannière de la boutique (données) non plus.",
    parameters: objet({ ancienne_media_id: S, ancienne_url: S, nouvelle_media_id: S, nouvelle_url: S }),
    sortie: "résumé des changements du brouillon et lien d'aperçu.",
    exemple: { ancienne_url: "https://…/vieux-hero.jpg", nouvelle_media_id: "cm789" },
  },
  {
    ...base, name: "axso_builder_delete_asset", niveau: "ecriture", risque: "eleve", cache: true,
    description: "Supprime un média de la médiathèque, SEULEMENT s'il n'est utilisé ni par la boutique en ligne, ni par le brouillon, ni comme logo/bannière. Délègue ensuite à delete_media (qui vérifie fiches produits et campagnes).",
    parameters: objet({ media_id: S }, ["media_id"]),
    sortie: "résultat de delete_media.",
    exemple: { media_id: "cm456" },
  },
  {
    ...base, name: "axso_builder_optimize_asset", niveau: "lecture", cache: true,
    description: "Diagnostic d'optimisation d'une image (poids, dimensions trop grandes, format) avec conseils. Ne produit AUCUNE variante (pas d'outil de redimensionnement dans Axso). Pour une image trop petite ou floue d'un produit, propose enhance_product_image (module créatif).",
    parameters: objet({ media_id: S, url: S }),
    sortie: "{ bytes, width, height, format, problems, advice, variants_generated: false }",
    exemple: { media_id: "cm456" },
  },
  {
    ...base, name: "axso_builder_generate_asset", niveau: "ecriture", risque: "faible", scope: "axso:creative:write",
    description: "Génère un visuel pour la boutique via le module créatif — hero (bannière 16:9), banner (3:1), product_scene (le vrai produit dans un décor), social, video — puis, si « placer_dans » est donné, le place dans le BROUILLON (bloc, image du design, bannière du socle, ou en remplacement d'une image). Vidéo et lots : tâche longue (job_id), à placer ensuite avec axso_builder_place_asset.",
    parameters: objet({
      usage: { type: "string", enum: ["hero", "banner", "product_scene", "social", "video"] },
      product_id: S, media_id: { ...S, description: "product_scene : photo de départ" }, instructions: { ...S, description: "Sujet, ambiance, décor (obligatoire sans product_id ; product_scene : le décor)" },
      headline: { ...S, description: "Texte à afficher sur le visuel" }, platform: { type: "string", enum: ["instagram", "facebook", "tiktok", "whatsapp"] },
      ratio: { type: "string", enum: ["16:9", "9:16", "1:1"], description: "video" }, placer_dans: CIBLE,
    }, ["usage"]),
    sortie: "media { media_id, url } (+ changements du brouillon si placé) ou job_id.",
    exemple: { usage: "hero", instructions: "Collection d'été, ambiance plage au coucher du soleil", headline: "Soldes d'été", placer_dans: { remplacer_url: "https://…/ancien-hero.jpg" } },
  },
];

async function lister(args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const type = args.type === "image" || args.type === "video" ? args.type : undefined;
  const limit = Number.isInteger(args.limit) ? Math.min(100, Math.max(1, args.limit)) : 40;
  const [medias, u] = await Promise.all([
    prisma.mediaIA.findMany({ where: { tenantId: ctx.tenantId, ...(type ? { type } : { type: { in: ["image", "video"] } }) }, orderBy: { createdAt: "desc" }, take: limit }),
    usages(ctx.tenantId),
  ]);
  const vus = new Set(medias.map((m) => m.url));
  const media = medias.map((m) => ({
    media_id: m.id, type: m.type, url: adresse(m.url), width: m.largeur, height: m.hauteur, role: meta(m).role ?? meta(m).outil ?? m.fournisseur,
    used_live: court(u.get(m.url)?.enLigne ?? []), used_draft: court(u.get(m.url)?.brouillon ?? []),
  }));
  const hors = [...u.entries()].filter(([url]) => !vus.has(url) && !url.startsWith("data:")).slice(0, 60).map(([url, e]) => ({ url, live: court(e.enLigne), draft: court(e.brouillon) }));
  const ligne = (x: { url: string | null; used_live: string[]; used_draft: string[] }) => x.used_live.length || x.used_draft.length ? `utilisé : ${[...x.used_live.map((o) => `en ligne ${o}`), ...x.used_draft.map((o) => `brouillon ${o}`)].slice(0, 3).join(" ; ")}` : "non utilisé";
  return ok([
    `Médiathèque (${media.length}) :`, ...media.map((m) => `- ${m.media_id} ${m.type}${m.width ? ` ${m.width}×${m.height}` : ""} — ${ligne(m)}`),
    `Images utilisées hors médiathèque (${hors.length}) :`, ...hors.map((h) => `- ${h.url.slice(0, 120)} — ${[...h.live.map((o) => `en ligne ${o}`), ...h.draft.map((o) => `brouillon ${o}`)].slice(0, 3).join(" ; ")}`),
  ].join("\n"), { media, used_outside_library: hors });
}

async function lire(args: Record<string, any>, ctx: CtxOutil, pourOptimiser: boolean): Promise<ResultatIA> {
  const c = await cible(ctx, args);
  if ("succes" in c) return c;
  const { media, url } = c;
  if (media?.type === "video") return ok(`Vidéo ${media.id}${media.duree ? ` de ${media.duree} s` : ""} : non analysée (seules les images le sont).`, { media_id: media.id, type: "video", url: adresse(url), duration: media.duree });
  const f = await analyserFichier(url);
  const diag = diagnostic(f);
  const u = (await usages(ctx.tenantId)).get(url);
  const nomProduit = media && meta(media).produit_propose
    ? (await prisma.produit.findFirst({ where: { id: String(meta(media).produit_propose), tenantId: ctx.tenantId }, select: { nom: true } }))?.nom : undefined;
  const donnees = {
    media_id: media?.id ?? null, url: adresse(url), format: f.format, mime: f.mime, width: f.largeur, height: f.hauteur, ratio: ratio(f.largeur, f.hauteur), bytes: f.octets, kb: Math.round(f.octets / 1024),
    alt: media ? meta(media).alt ?? null : null, alt_suggestion: nomProduit ? altPropose(nomProduit) : null,
    focal_point: null, variants: [], variants_generated: false,
    used: { live: court(u?.enLigne ?? []), draft: court(u?.brouillon ?? []) }, problems: diag.problemes, advice: diag.conseils,
  };
  if (pourOptimiser) {
    const petite = !!f.largeur && f.largeur < 800;
    const conseils = [...diag.conseils, ...(petite ? [`trop petite (${f.largeur} px) pour une bannière : ${media && meta(media).produit_propose ? "enhance_product_image peut l'agrandir" : "générer une version plus grande (axso_builder_generate_asset)"}`] : [])];
    return ok(`${f.format ?? "format inconnu"} ${f.largeur ?? "?"}×${f.hauteur ?? "?"}, ${donnees.kb} Ko. ${diag.problemes.length ? `Problèmes : ${diag.problemes.join(" ; ")}.` : "Aucun problème de poids ni de taille."} ${conseils.length ? `Conseils : ${conseils.join(" ; ")}.` : ""} Aucune variante n'a été produite : Axso n'a pas d'outil de redimensionnement ; la vitrine sert l'image telle quelle.`,
      { ...donnees, advice: conseils, suggested_tool: petite && media ? "enhance_product_image" : null });
  }
  return ok(`Image ${f.format ?? "de format inconnu"} ${f.largeur ?? "?"}×${f.hauteur ?? "?"} (${donnees.ratio ?? "?"}), ${donnees.kb} Ko. ${u ? `Utilisée : ${[...donnees.used.live.map((o) => `en ligne ${o}`), ...donnees.used.draft.map((o) => `brouillon ${o}`)].join(" ; ")}.` : "Non utilisée par la boutique."}${diag.problemes.length ? ` Problèmes : ${diag.problemes.join(" ; ")}.` : ""} Point focal et variantes : non gérés.`, donnees);
}

const TYPES_IMPORT: Record<string, "image" | "video"> = { image: "image", logo: "image", icone: "image", illustration: "image", video: "video" };

async function importer(args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const role = typeof args.type === "string" ? args.type : "image";
  const type = TYPES_IMPORT[role];
  if (!type) return ko("INVALID_INPUT", "La médiathèque n'accepte que des images (image, logo, icone, illustration) et des vidéos ; polices et documents ne sont pas pris en charge.");
  if (typeof args.url !== "string" || !args.url.startsWith("https://")) return ko("INVALID_INPUT", "« url » : adresse https publique du fichier.");
  if (args.alt !== undefined && (typeof args.alt !== "string" || args.alt.length > 125)) return ko("INVALID_INPUT", "« alt » : 125 caractères au plus.");
  const { donnees, mime } = await telecharger(args.url, type);
  const entete = type === "image" ? lireEntete(donnees) : null;
  if (type === "image" && (!entete || entete.format === "svg")) return ko("ASSET_INVALID", entete ? "SVG refusé : un SVG peut contenir du code ; convertis-le en PNG ou WebP." : "Le fichier n'est pas une image reconnue (PNG, JPEG, WebP, GIF, AVIF).");
  let source = "";
  try { const u = new URL(args.url); source = u.origin + u.pathname; } catch {} // sans la requête : elle peut porter un jeton
  const media = await enregistrerMedia({
    tenantId: ctx.tenantId, type, fournisseur: "import", rendu: { donnees, mime: entete ? `image/${entete.format}` : mime }, creePar: ctx.connexionId || ctx.userId,
    metadonnees: { outil: "axso_builder_upload_asset", role, source, ...(args.alt && { alt: altPropose(args.alt) }), ...(entete && { format: entete.format }) },
  });
  // enregistrerMedia ne lit que les dimensions d'un PNG.
  const m = entete?.largeur && !media.largeur ? await prisma.mediaIA.update({ where: { id: media.id }, data: { largeur: entete.largeur, hauteur: entete.hauteur } }) : media;
  return ok(`Fichier importé dans la médiathèque (media_id ${m.id}${entete ? `, ${entete.format} ${entete.largeur}×${entete.hauteur}` : ""}, ${Math.round(donnees.length / 1024)} Ko). Il n'est placé nulle part : axso_builder_replace_asset ou axso_builder_place_asset.`,
    { media: { media_id: m.id, type: m.type, url: adresse(m.url), width: m.largeur, height: m.hauteur, format: entete?.format ?? null, bytes: donnees.length } });
}

/** Adresse d'un média (media_id) ou adresse donnée. */
async function adresseDe(ctx: CtxOutil, id: unknown, url: unknown): Promise<string | ResultatIA> {
  if (id !== undefined) {
    const m = await lireMedia(ctx, id);
    if (!m) return ko("NOT_FOUND", "Média introuvable dans la médiathèque de cette boutique.");
    if (!m.url.startsWith("https://")) return ko("ASSET_INVALID", "Ce média n'est pas stocké en ligne (stockage de fichiers non configuré) : il ne peut pas être placé dans la boutique.");
    return m.url;
  }
  return typeof url === "string" && url ? url : ko("INVALID_INPUT", "Média manquant (media_id ou url).");
}

async function remplacer(args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const ancienne = await adresseDe(ctx, args.ancienne_media_id, args.ancienne_url);
  if (typeof ancienne !== "string") return ancienne;
  const nouvelle = await adresseDe(ctx, args.nouvelle_media_id, args.nouvelle_url);
  if (typeof nouvelle !== "string") return nouvelle;
  return modifier(ctx, [{ op: "axso_builder_replace_asset", args: { ancienne_url: ancienne, nouvelle_url: nouvelle } }], "Image remplacée dans le brouillon");
}

async function supprimer(args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const m = await lireMedia(ctx, args.media_id);
  if (!m) return ko("NOT_FOUND", "Média introuvable dans la médiathèque de cette boutique.");
  const u = (await usages(ctx.tenantId)).get(m.url);
  if (u && (u.enLigne.length || u.brouillon.length)) {
    return ko("CONFLICT", `Ce média est utilisé par la boutique (${[...court(u.enLigne).map((o) => `en ligne : ${o}`), ...court(u.brouillon).map((o) => `brouillon : ${o}`)].join(" ; ")}). Remplace-le d'abord (axso_builder_replace_asset), publie, puis supprime-le.`, { used_live: court(u.enLigne), used_draft: court(u.brouillon) });
  }
  return ctx.appeler("delete_media", { media_id: m.id });
}

/** Outil du module créatif et ses paramètres pour chaque usage. */
function generation(a: Record<string, any>): { outil: string; args: Record<string, any> } | ResultatIA {
  const commun = { product_id: a.product_id, headline: a.headline, instructions: a.instructions };
  switch (a.usage) {
    case "hero": return { outil: "generate_banner", args: { ...commun, format: "landscape" } };
    case "banner": return { outil: "generate_banner", args: { ...commun, format: "banner" } };
    case "social": return { outil: "generate_social_creative", args: { ...commun, platform: a.platform ?? "instagram" } };
    case "product_scene": return { outil: "generate_product_scene", args: { product_id: a.product_id, media_id: a.media_id, scene: a.instructions } };
    case "video": return { outil: "generate_video", args: { product_id: a.product_id, prompt: a.instructions, ratio: a.ratio ?? "16:9" } };
    default: return ko("INVALID_INPUT", "« usage » : hero, banner, product_scene, social ou video.");
  }
}

async function generer(args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  const g = generation(args);
  if ("succes" in g) return g;
  const p = args.placer_dans;
  if (p !== undefined && (!p || typeof p !== "object")) return ko("INVALID_INPUT", "« placer_dans » : { bloc_id | element | hero | remplacer_url }.");
  const r = await ctx.appeler(g.outil, Object.fromEntries(Object.entries(g.args).filter(([, v]) => v !== undefined)));
  if (!r.succes) return r;
  const jobId = (r.donnees as any)?.job_id;
  if (jobId) return ok(`Génération lancée par ${g.outil} (tâche longue, job_id ${jobId}). Suis-la avec axso_statut_tache ; une fois terminée${p ? ", place le média avec axso_builder_place_asset (ou axso_builder_replace_asset)" : ""}.`, { job_id: jobId, tool: g.outil, placed: false });
  const media = (r.donnees as any)?.media;
  if (!p) return { ...r, donnees: { ...r.donnees, tool: g.outil, placed: false } };
  if (!media?.url) return ok(`${r.resultat}\nNon placé : le média n'a pas d'adresse en ligne (stockage de fichiers non configuré).`, { ...r.donnees, placed: false });
  const etape = typeof p.remplacer_url === "string"
    ? { op: "axso_builder_replace_asset", args: { ancienne_url: p.remplacer_url, nouvelle_url: media.url } }
    : { op: "axso_builder_place_asset", args: { url: media.url, bloc_id: p.bloc_id, element: p.element, hero: p.hero, alt: p.alt } };
  const place = await modifier(ctx, [etape], "Visuel généré placé dans le brouillon");
  // Le média reste dans la médiathèque même si le placement est refusé.
  return place.succes
    ? { ...place, resultat: `Visuel généré par ${g.outil} (media_id ${media.media_id}). ${place.resultat}`, donnees: { ...place.donnees, media, placed: true } }
    : { ...place, resultat: `Visuel généré (media_id ${media.media_id}, dans la médiathèque) mais non placé : ${place.resultat}`, donnees: { ...place.donnees, media, placed: false } };
}

export async function executer(nom: string, args: Record<string, any>, ctx: CtxOutil): Promise<ResultatIA> {
  try {
    switch (nom) {
      case "axso_builder_list_assets": return await lister(args, ctx);
      case "axso_builder_get_asset": return await lire(args, ctx, false);
      case "axso_builder_optimize_asset": return await lire(args, ctx, true);
      case "axso_builder_upload_asset": return await importer(args, ctx);
      case "axso_builder_replace_asset": return await remplacer(args, ctx);
      case "axso_builder_delete_asset": return await supprimer(args, ctx);
      case "axso_builder_generate_asset": return await generer(args, ctx);
      default: return INCONNU;
    }
  } catch (e) {
    // Téléchargement refusé ou source injoignable : message lisible ; le reste passe par traduire (erreurs du moteur).
    if (e instanceof Refus) return ko(e.code, e.message);
    return traduire(e);
  }
}
