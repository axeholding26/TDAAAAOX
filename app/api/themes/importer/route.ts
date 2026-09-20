import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyserTemplateImporte, identifierStructureTemplate } from "@/lib/gemini";
import { resolveThemeConfig, type ThemeConfig } from "@/lib/theme-config";
import { fontEntry } from "@/lib/theme-fonts";
import { prixClient } from "@/lib/pricing";
import { formatMontant } from "@/lib/utils";
import { construireTemplateBoutique } from "@/lib/theme-import-clone";

// Import de template — clone visuel exact. Le marchand envoie son propre
// fichier HTML ; on garde SON copywriting et SON design tels quels, et on y
// branche uniquement ce qu'il faut pour que ça fonctionne comme une vraie
// boutique AXSO (vrais produits, panier, navigation). Le fichier n'est
// jamais exécuté : tout <script> est retiré avant stockage (voir
// lib/theme-import-clone.ts pour le détail de la sanitisation). Le résultat
// est stocké dans les champs ThemeConfig.builderHtml / builderCss, rendus
// par components/storefront/templates/ImportedLiteralHomePage.tsx.

const TAILLE_MAX_HTML = 300_000; // 300 Ko — au-delà, prompt trop volumineux
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

const bodySchema = z.object({ url: z.string().url() });

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ error: "Tenant requis" }, { status: 400 });

    const parsedBody = bodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return NextResponse.json({ error: "URL de fichier invalide" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

    const fichierRes = await fetch(parsedBody.data.url);
    if (!fichierRes.ok) {
      return NextResponse.json({ error: "Impossible de récupérer le fichier envoyé" }, { status: 400 });
    }
    const htmlBrut = await fichierRes.text();
    if (htmlBrut.length > TAILLE_MAX_HTML) {
      return NextResponse.json({ error: "Ce fichier est trop volumineux pour être analysé (max 300 Ko)." }, { status: 400 });
    }

    const titreMatch = htmlBrut.match(/<title>([^<]*)<\/title>/i);
    const nomDetecte = titreMatch?.[1]?.trim().slice(0, 60) || "Mon thème importé";

    // Deux appels IA indépendants et à faible risque d'échec : l'un cherche
    // juste deux sélecteurs CSS courts (grille + carte produit), l'autre
    // n'est utilisé que pour peupler les métadonnées couleurs/polices du
    // thème (aperçu dans la galerie /dashboard/themes) — jamais pour
    // modifier le HTML/CSS conservé tel quel.
    const htmlPourAnalyse = htmlBrut.replace(/<script[\s\S]*?<\/script>/gi, "").slice(0, 60000);
    const [structure, analyseStyle] = await Promise.all([
      identifierStructureTemplate(htmlPourAnalyse),
      analyserTemplateImporte(htmlPourAnalyse),
    ]);

    const produitsBruts = await prisma.produit.findMany({
      where: { tenantId, actif: true },
      orderBy: { createdAt: "desc" },
      take: 24,
    });
    const taux = tenant.commissionRate ?? 0.06;
    const produitsPourClone = produitsBruts.map((p) => ({
      id: p.id,
      nom: p.nom,
      prixAffiche: formatMontant(prixClient(p.prix, taux), tenant.devise),
      image: p.images[0] ?? null,
    }));

    const { html: builderHtml, css: cssExtrait, conteneurTrouve } = construireTemplateBoutique({
      htmlBrut,
      selecteurConteneurProduits: structure.selecteurConteneurProduits,
      selecteurCarteProduit: structure.selecteurCarteProduit,
      slug: tenant.slug,
      produits: produitsPourClone,
    });

    // Polices Google Fonts éventuellement chargées par le fichier d'origine —
    // conservées telles quelles pour un rendu fidèle (les balises <link> du
    // <head> ne survivent pas à l'extraction du seul <body>).
    const importsPolices = [...htmlBrut.matchAll(/<link[^>]+href=["'](https:\/\/fonts\.googleapis\.com[^"']+)["'][^>]*>/gi)]
      .map((m) => `@import url('${m[1]}');`)
      .join("\n");
    const builderCss = `${importsPolices}\n${cssExtrait}`;

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
    const fonts = { ...base.fonts };
    if (analyseStyle.polices?.titre && fontEntry(analyseStyle.polices.titre)) fonts.titre = analyseStyle.polices.titre;
    if (analyseStyle.polices?.corps && fontEntry(analyseStyle.polices.corps)) fonts.corps = analyseStyle.polices.corps;

    const config: ThemeConfig = {
      ...base,
      colors,
      fonts,
      builderHtml,
      builderCss,
    };

    const slugBase = nomDetecte.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40) || "importe";
    const slug = `custom-${slugBase}-${Date.now()}`;

    const theme = await prisma.theme.create({
      data: {
        tenantId,
        nom: nomDetecte,
        slug,
        description: conteneurTrouve
          ? "Thème importé — design conservé tel quel, vos vrais produits y sont déjà branchés."
          : "Thème importé — design conservé tel quel. Aucune grille de produits n'a été détectée automatiquement dans le fichier envoyé.",
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
