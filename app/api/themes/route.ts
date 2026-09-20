import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MANIFESTE_LIBRAIRIE } from "@/lib/axso-design-library";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId;

    const themesDB = tenantId
      ? await prisma.theme.findMany({
          where: { OR: [{ tenantId }, { tenantId: null }], actif: true },
          orderBy: [{ ordre: "asc" }, { createdAt: "desc" }],
        })
      : [];

    const themesCustom = themesDB
      .filter((t) => t.tenantId !== null)
      .map((t) => ({ ...t, builtin: false }));

    // Bibliothèque AXSO Design (Templates/*.html) — remplace progressivement
    // la gamme ci-dessus (voir plan de migration). `axsoDesign: true` +
    // `fichier` signalent au picker qu'il doit passer par
    // POST /api/themes/provisionner (qui crée un vrai Theme pour CE tenant,
    // vrais produits déjà branchés) plutôt que d'assigner directement un id
    // partagé comme pour les thèmes classiques/premium ci-dessus.
    const themesLibrairie = MANIFESTE_LIBRAIRIE.map((e, i) => ({
      id: `axso-design:${e.fichier}`,
      slug: e.fichier,
      fichier: e.fichier,
      nom: e.nom,
      description: e.ambiance.join(" · "),
      badge: "✦ AXSO Design",
      config: { colors: e.couleurs, fonts: e.polices },
      effetId: null,
      tenantId: null,
      builtin: true,
      axsoDesign: true,
      actif: true,
      premium: false,
      ordre: 100 + i,
      createdAt: new Date(),
      updatedAt: new Date(),
      apercu: null,
    }));

    return NextResponse.json({ themes: [...themesLibrairie, ...themesCustom] });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ error: "Tenant requis" }, { status: 400 });

    const body = await req.json();
    const { nom, description, config, effetId, badge } = body;
    if (!nom || !config) return NextResponse.json({ error: "nom et config requis" }, { status: 400 });

    const slug = `custom-${nom.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}-${Date.now()}`;

    const theme = await prisma.theme.create({
      data: {
        tenantId,
        nom,
        slug,
        description: description || "",
        badge: badge || "✦ Custom",
        config,
        effetId: effetId || null,
        actif: true,
      },
    });

    return NextResponse.json({ theme }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

