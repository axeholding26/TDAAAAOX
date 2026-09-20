// Magic Import — génération catalogue IA + import en masse
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGemini, completionAuto } from "@/lib/llm-client";
import { generateProductImageUrl, buildProductImagePrompt } from "@/lib/image-gen";
import { slugify } from "@/lib/utils";
import { z } from "zod";

const schemaGen = z.object({
  description: z.string().min(5).max(600),
  nombreProduits: z.number().min(3).max(20).default(8),
});

function buildPrompt(description: string, nb: number, pays: string, devise: string) {
  return `Tu es un expert e-commerce. Génère exactement ${nb} fiches produits premium pour cette boutique : "${description}".

RÉPONDS UNIQUEMENT avec un tableau JSON valide. Zéro texte avant ou après. Commence par [ et termine par ].

Format strict :
[
  {
    "nom": "Nom précis du produit",
    "description": "Description vendeuse et convaincante en français (80-120 mots). Inclure les bénéfices, la qualité et l'usage.",
    "prix": 0,
    "prixCompare": 0,
    "categorie": "Catégorie précise du produit",
    "tags": ["tag1", "tag2", "tag3", "tag4"],
    "imagePrompt": "Ultra-detailed product photography prompt in English: describe the product on white background, studio lighting, 8K, photorealistic, specific colors and materials",
    "stock": 25
  }
]

Règles strictes :
- Pays cible : ${pays}, devise : ${devise}
- Prix réalistes pour le marché local (pas trop élevés ni trop bas)
- prixCompare = prix barré, toujours 15-30% plus élevé que prix
- imagePrompt EN ANGLAIS, ultra-détaillé pour Flux.1-dev
- Descriptions percutantes en français, orientées vente
- Produits variés et complémentaires (éviter doublons)
- tags : mots-clés SEO pertinents en minuscules`;
}

// POST — générer catalogue IA
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ message: "Boutique introuvable" }, { status: 404 });

    const body = schemaGen.parse(await request.json());
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { pays: true, devise: true },
    });

    const pays = tenant?.pays || "SN";
    const devise = tenant?.devise || "XOF";

    if (!hasGemini()) {
      return NextResponse.json({ message: "Gemini non configuré. Vérifiez GEMINI_API_KEY dans .env.local" }, { status: 503 });
    }

    const result = await completionAuto(
      [{ role: "user", content: buildPrompt(body.description, body.nombreProduits, pays, devise) }],
      6000
    );

    const jsonMatch = result.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ message: "L'IA n'a pas retourné de catalogue JSON valide" }, { status: 500 });
    }

    let produits: any[] = JSON.parse(jsonMatch[0]);

    // Génère les visuels produits via Gemini (échoue silencieusement par produit — jamais tout l'import)
    produits = await Promise.all(produits.map(async (p, i) => {
      const imagePrompt = p.imagePrompt || buildProductImagePrompt(p.nom, p.categorie);
      return {
        ...p,
        imageUrl: await generateProductImageUrl(imagePrompt),
        imagePrompt,
        slug: slugify(p.nom) + "-" + Date.now().toString(36) + i,
        devise,
      };
    }));

    return NextResponse.json({ produits, total: produits.length });
  } catch (err: any) {
    console.error("[MAGIC-IMPORT/POST]", err);
    if (err instanceof z.ZodError) return NextResponse.json({ message: "Format invalide" }, { status: 400 });
    return NextResponse.json({ message: err.message || "Erreur génération" }, { status: 500 });
  }
}

// PUT — import en masse des produits sélectionnés
export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ message: "Boutique introuvable" }, { status: 404 });

    const { produits } = await request.json();
    if (!Array.isArray(produits) || produits.length === 0) {
      return NextResponse.json({ message: "Aucun produit sélectionné" }, { status: 400 });
    }

    let created = 0;
    const errors: string[] = [];

    for (const p of produits) {
      try {
        const slug = p.slug || `${slugify(p.nom)}-${Date.now().toString(36)}`;
        await prisma.produit.create({
          data: {
            tenantId,
            nom: String(p.nom || "Produit"),
            slug,
            description: String(p.description || ""),
            prix: Number(p.prix) || 0,
            prixCompare: p.prixCompare && Number(p.prixCompare) > Number(p.prix) ? Number(p.prixCompare) : null,
            stock: Number(p.stock) || 10,
            categorie: String(p.categorie || "Général"),
            tags: Array.isArray(p.tags) ? p.tags : [],
            images: p.imageUrl ? [String(p.imageUrl)] : [],
            actif: true,
          },
        });
        created++;
      } catch (e: any) {
        errors.push(p.nom || "inconnu");
      }
    }

    return NextResponse.json({
      created,
      errors: errors.length,
      message: `${created} produit${created > 1 ? "s" : ""} importé${created > 1 ? "s" : ""} avec succès`,
    });
  } catch (err: any) {
    console.error("[MAGIC-IMPORT/PUT]", err);
    return NextResponse.json({ message: err.message || "Erreur import" }, { status: 500 });
  }
}
