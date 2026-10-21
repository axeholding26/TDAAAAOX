import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parse } from "node-html-parser";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyserTemplateImporte, identifierStructureTemplate } from "@/lib/gemini";
import { resolveThemeConfig, type BlockNode, type ThemeConfig } from "@/lib/theme-config";
import { fontEntry } from "@/lib/theme-fonts";
import { prixClient } from "@/lib/pricing";
import { formatMontant } from "@/lib/utils";
import { construireTemplateBoutique, extraireVuesLibrairie, gabaritCarteDepuisDemo, injecterGrilleLibrairie } from "@/lib/theme-import-clone";
import { charteDepuisCss } from "@/lib/prompt-import-theme";
import { decouperDesign, type ElementDesign } from "@/lib/decoupage-design";
import { slugLibre, type PagePerso } from "@/lib/builder/operations/structure";
import { empreinte } from "@/lib/builder/moteur";
import { aiLimiter, rateLimitResponse } from "@/lib/rate-limit";

// Import de template — clone visuel exact. Le marchand envoie son propre
// fichier HTML ; on garde SON copywriting et SON design tels quels, et on y
// branche uniquement ce qu'il faut pour que ça fonctionne comme une vraie
// boutique AXSO (vrais produits, panier, navigation). Le fichier n'est
// jamais exécuté : tout <script> est retiré avant stockage (voir
// lib/theme-import-clone.ts pour le détail de la sanitisation). Trois types
// (standard de chacun : lib/prompt-import-theme.ts) :
//  - accueil  : ThemeConfig.builderHtml / builderCss (nouveau thème) ;
//  - boutique : accueil + catalogue, même forme que les designs de la
//    bibliothèque (lib/axso-design-library.ts) — fiche, panier, commande sont
//    ceux d'Axso dans l'habillage du fichier (nouveau thème) ;
//  - page     : une page libre de plus dans la boutique (themeConfig.pagesPerso),
//    découpée en sections, avec son propre CSS ; le thème ne change pas.

const TAILLE_MAX_HTML = 300_000; // 300 Ko — au-delà, prompt trop volumineux
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

// Le HTML est envoyé tel quel par la page (lu dans le navigateur) : plus de
// passage par le stockage de fichiers, et le serveur n'ouvre jamais une
// adresse fournie par le client (évite qu'il serve à interroger autre chose).
const bodySchema = z.object({
  html: z.string().min(1),
  type: z.enum(["accueil", "boutique", "page"]).default("accueil"),
  nomPage: z.string().trim().max(80).optional(),
});

const analyseur = (h: string) => parse(h).children as unknown as ElementDesign[];

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ error: "Tenant requis" }, { status: 400 });
    const rl = aiLimiter.check(`theme-import:${tenantId}`);
    if (!rl.success) return rateLimitResponse(rl.reset);

    const parsedBody = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Fichier HTML vide ou invalide" }, { status: 400 });
    }
    const { type } = parsedBody.data;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

    const htmlBrut = parsedBody.data.html;
    if (!/<(html|body|div|section|header|main)\b/i.test(htmlBrut)) {
      return NextResponse.json({ error: "Ce fichier ne ressemble pas à une page HTML." }, { status: 400 });
    }
    if (htmlBrut.length > TAILLE_MAX_HTML) {
      return NextResponse.json({ error: "Ce fichier est trop volumineux pour être analysé (max 300 Ko)." }, { status: 400 });
    }

    const titreMatch = htmlBrut.match(/<title>([^<]*)<\/title>/i);
    const nomDetecte = titreMatch?.[1]?.trim().slice(0, 60) || "Mon thème importé";

    // Polices Google Fonts éventuellement chargées par le fichier d'origine —
    // conservées telles quelles pour un rendu fidèle (les balises <link> du
    // <head> ne survivent pas à l'extraction du seul <body>).
    const importsPolices = [...htmlBrut.matchAll(/<link[^>]+href=["'](https:\/\/fonts\.googleapis\.com[^"']+)["'][^>]*>/gi)]
      .map((m) => `@import url('${m[1]}');`)
      .join("\n");

    if (type === "page") return importerPage(tenantId, htmlBrut, parsedBody.data.nomPage || nomDetecte, importsPolices);

    // L'IA ne lit le fichier que pour deviner ce que le standard ne fixe pas :
    // la grille de l'accueil simple (deux sélecteurs courts) et, à défaut des
    // variables --couleur-*, les couleurs/polices — jamais pour réécrire le HTML/CSS.
    const htmlPourAnalyse = htmlBrut.replace(/<script[\s\S]*?<\/script>/gi, "").slice(0, 60000);
    const [structure, analyseStyle] = await Promise.all([
      type === "accueil" ? identifierStructureTemplate(htmlPourAnalyse) : Promise.resolve(null),
      analyserTemplateImporte(htmlPourAnalyse),
    ]);

    const produitsBruts = await prisma.produit.findMany({
      where: { tenantId, actif: true },
      orderBy: { createdAt: "desc" },
      take: 24,
    });
    const taux = tenant.commissionRate ?? 0.1;
    const produitsPourClone = produitsBruts.map((p) => ({
      id: p.id,
      nom: p.nom,
      prixAffiche: formatMontant(prixClient(p.prix, taux, p.type), tenant.devise),
      image: p.images[0] ?? null,
    }));

    let champsDesign: Partial<ThemeConfig>;
    let description: string;
    if (type === "boutique") {
      const vues = extraireVuesLibrairie({ htmlBrut, slug: tenant.slug, completer: true });
      if (!vues) return NextResponse.json({ error: "Le fichier doit contenir les conteneurs id=\"view-home\" (accueil) et id=\"view-boutique\" (catalogue)." }, { status: 400 });
      const carte = gabaritCarteDepuisDemo(vues.boutique) ?? gabaritCarteDepuisDemo(vues.home);
      const grille = (vueHtml: string, idConteneur: "homeGrid" | "plpGrid", n: number) =>
        injecterGrilleLibrairie({ vueHtml, idConteneur, carteTemplate: carte, produits: produitsPourClone.slice(0, n), slug: tenant.slug });
      champsDesign = {
        builderCss: `${importsPolices}\n${vues.css}`,
        builderHtml: vues.chromeAvant + grille(vues.home, "homeGrid", 8) + vues.chromeApres,
        builderHtmlProduits: vues.chromeAvant + grille(vues.boutique, "plpGrid", 24) + vues.chromeApres,
        builderHtmlProduit: vues.chromeAvant + vues.produit + vues.chromeApres,
        builderHtmlPanierChrome: vues.chromeAvant + vues.panier + vues.chromeApres,
        builderHtmlCheckoutChrome: vues.chromeAvant + vues.commande + vues.chromeApres,
        builderHtmlConfirmationChrome: vues.chromeAvant + vues.confirmation + vues.chromeApres,
        ...(carte ? { axsoDesignCarteTemplate: carte } : {}),
      };
      description = carte
        ? "Boutique complète importée — accueil et catalogue conservés tels quels, vos vrais produits y sont branchés."
        : "Boutique complète importée — aucune carte produit n'a été reconnue dans les grilles #homeGrid / #plpGrid.";
    } else {
      const { html, css, conteneurTrouve } = construireTemplateBoutique({
        htmlBrut,
        selecteurConteneurProduits: structure?.selecteurConteneurProduits ?? null,
        selecteurCarteProduit: structure?.selecteurCarteProduit ?? null,
        slug: tenant.slug,
        produits: produitsPourClone,
      });
      champsDesign = { builderHtml: html, builderCss: `${importsPolices}\n${css}` };
      description = conteneurTrouve
        ? "Thème importé — design conservé tel quel, vos vrais produits y sont déjà branchés."
        : "Thème importé — design conservé tel quel. Aucune grille de produits n'a été détectée automatiquement dans le fichier envoyé.";
    }

    // Base classique (terre-et-or) juste pour les champs structurels que le
    // ThemeConfig exige (sections, animations...) — non utilisée pour le
    // rendu de ce thème (voir builderHtml/builderCss), seulement pour que
    // les couleurs/polices ci-dessous s'affichent correctement dans la
    // galerie de thèmes et que le reste du constructeur reste cohérent.
    const base = resolveThemeConfig("terre-et-or");
    const colors = { ...base.colors };
    for (const cle of ["fond", "accent", "texte", "surface"] as const) {
      const val = analyseStyle.couleurs?.[cle];
      if (typeof val === "string" && HEX_REGEX.test(val)) colors[cle] = val;
    }
    // Variables --couleur-* du standard : couleurs exactes, et modifiables depuis le Constructeur.
    const charte = charteDepuisCss(champsDesign.builderCss ?? "");
    Object.assign(colors, charte.couleurs);
    const fonts = { ...base.fonts };
    if (analyseStyle.polices?.titre && fontEntry(analyseStyle.polices.titre)) fonts.titre = analyseStyle.polices.titre;
    if (analyseStyle.polices?.corps && fontEntry(analyseStyle.polices.corps)) fonts.corps = analyseStyle.polices.corps;

    const config: ThemeConfig = {
      ...base,
      colors,
      fonts,
      ...champsDesign,
      ...(Object.keys(charte.mapping).length ? { axsoDesignCssVarMapping: charte.mapping } : {}),
    };

    const slugBase = nomDetecte.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40) || "importe";
    const slug = `custom-${slugBase}-${Date.now()}`;

    const theme = await prisma.theme.create({
      data: {
        tenantId,
        nom: nomDetecte,
        slug,
        description,
        badge: "✦ Importé",
        config: config as any,
        actif: true,
      },
    });

    return NextResponse.json({ theme }, { status: 201 });
  } catch (e) {
    console.error("[THEME IMPORT ERROR]", e);
    return NextResponse.json({ error: "Erreur lors de l'analyse du fichier" }, { status: 500 });
  }
}

// Page seule : ajoutée en ligne (publiée) et dans le brouillon du Builder IA
// s'il y en a un — sinon publier ce brouillon ferait disparaître la page.
async function importerPage(tenantId: string, htmlBrut: string, nom: string, importsPolices: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, nomBoutique: true, themeConfig: true } });
  if (!tenant) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });
  const { html, css } = construireTemplateBoutique({ htmlBrut, selecteurConteneurProduits: null, selecteurCarteProduit: null, slug: tenant.slug, produits: [] });
  // Seules les sections du conteneur .view : la page garde l'en-tête et le pied de page de la boutique.
  const sections = decouperDesign(html, analyseur).filter((s) => s.config?.zone === "template").map(marquerCssPage);
  if (!sections.length) return NextResponse.json({ error: "Aucune section trouvée : le fichier doit contenir <div class=\"view active\" id=\"view-home\"> avec des <section>." }, { status: 400 });

  const enLigne = (tenant.themeConfig ?? {}) as Record<string, any>;
  let cle: string;
  try { cle = slugLibre(enLigne as ThemeConfig, nom); }
  catch { cle = slugLibre(enLigne as ThemeConfig, `page-${Date.now()}`); }
  const pages = enLigne.pagesPerso ?? {};
  const page: PagePerso = {
    nom: nom.slice(0, 80), slug: cle, gabarit: "import",
    seo: { titre: `${nom} — ${tenant.nomBoutique}`.slice(0, 120) },
    builderTree: sections,
    css: `${importsPolices}\n${css}`,
    visibilite: "publique", statut: "publiee",
    ordre: Object.keys(pages).length,
  };
  const nouveau = { ...enLigne, pagesPerso: { ...pages, [cle]: page } };
  const brouillon = await prisma.brouillonBoutique.findUnique({ where: { tenantId }, select: { config: true, baseEmpreinte: true } });
  await prisma.$transaction([
    prisma.tenant.update({ where: { id: tenantId }, data: { themeConfig: nouveau as any } }),
    ...(brouillon ? [prisma.brouillonBoutique.update({
      where: { tenantId },
      data: {
        config: { ...(brouillon.config as Record<string, any>), pagesPerso: { ...((brouillon.config as any)?.pagesPerso ?? {}), [cle]: page } } as any,
        // Brouillon à jour de la version en ligne : il le reste (la page est dans les deux).
        ...(brouillon.baseEmpreinte === empreinte(enLigne) ? { baseEmpreinte: empreinte(nouveau) } : {}),
      },
    })] : []),
  ]);
  return NextResponse.json({ page: { slug: cle, nom: page.nom, url: `/${tenant.slug}/p/${cle}` } }, { status: 201 });
}

function marquerCssPage(n: BlockNode): BlockNode {
  if (n.type === "embed-html") return { ...n, config: { ...n.config, cssPage: true } };
  return n.children ? { ...n, children: n.children.map(marquerCssPage) } : n;
}
