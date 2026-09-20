// Multi-boutique (Palier 2) — liste et création de boutiques supplémentaires
// pour un compte déjà propriétaire d'au moins une boutique.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planActif } from "@/lib/abonnement";
import { aAcces } from "@/lib/plans";
import { slugify } from "@/lib/utils";
import { z } from "zod";
import { generateStoreConfig } from "@/lib/generate-store-config";
import { MANIFESTE_LIBRAIRIE, provisionerThemeInitial } from "@/lib/axso-design-library";

const schemaCreation = z.object({
  nomBoutique: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  categorie: z.string(),
  pays: z.string(),
  whatsapp: z.string().min(8),
  devise: z.string().default("XOF"),
  themeId: z.string().default("terre-et-or"),
});

// GET — liste des boutiques possédées par le compte, avec la boutique active
// marquée. ?checkSlug=xxx pour une vérification de disponibilité en direct
// (formulaire de création), sans avoir besoin d'être propriétaire de quoi que ce soit.
export async function GET(req: NextRequest) {
  const checkSlug = req.nextUrl.searchParams.get("checkSlug");
  if (checkSlug !== null) {
    const slug = slugify(checkSlug);
    if (!slug) return NextResponse.json({ disponible: false });
    const existe = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
    return NextResponse.json({ disponible: !existe, slug });
  }

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const userId = (session.user as any)?.id;
  const tenantActif = (session.user as any)?.tenantId;

  const proprietes = await prisma.proprietaireBoutique.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      tenant: {
        select: {
          id: true, slug: true, nomBoutique: true, logoUrl: true, planType: true,
          _count: { select: { produits: true, commandes: true } },
        },
      },
    },
  });

  const boutiques = proprietes.map(p => ({ ...p.tenant, active: p.tenant.id === tenantActif }));
  return NextResponse.json({ boutiques });
}

// POST — créer une boutique supplémentaire (nécessite d'être déjà Palier 2
// sur au moins une boutique existante)
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const userId = (session.user as any)?.id;
  const userEmail = (session.user as any)?.email as string | undefined;
  if (!userEmail) return NextResponse.json({ error: "Email introuvable sur le compte" }, { status: 400 });

  const proprietes = await prisma.proprietaireBoutique.findMany({
    where: { userId },
    select: { tenantId: true },
  });

  let dejaPalier2 = false;
  for (const p of proprietes) {
    const { plan } = await planActif(p.tenantId);
    if (aAcces(plan, "multi_boutique")) { dejaPalier2 = true; break; }
  }
  if (!dejaPalier2) {
    return NextResponse.json({ error: "Le multi-boutique est réservé au Palier 2 — passez à niveau sur l'une de vos boutiques pour en créer une nouvelle.", code: "quota_atteint" }, { status: 403 });
  }

  let data;
  try {
    data = schemaCreation.parse(await req.json());
  } catch (err: any) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    throw err;
  }

  const slugExiste = await prisma.tenant.findUnique({ where: { slug: data.slug } });
  if (slugExiste) {
    return NextResponse.json({ error: `L'URL "${data.slug}" est déjà prise.` }, { status: 400 });
  }

  // Tenant.email est unique — un compte qui possède déjà une boutique sur son
  // email doit utiliser un alias "+tag" pour la/les suivante(s) (délivré au
  // même email chez la plupart des fournisseurs).
  const emailBoutique = userEmail.includes("@") ? userEmail.replace("@", `+${data.slug}@`) : userEmail;

  const { themeConfig } = generateStoreConfig({
    categorie: data.categorie,
    nomBoutique: data.nomBoutique,
    pays: data.pays,
    devise: data.devise,
  });

  const tenant = await prisma.$transaction(async (tx) => {
    const t = await tx.tenant.create({
      data: {
        slug: data.slug,
        nomBoutique: data.nomBoutique,
        email: emailBoutique,
        categorie: data.categorie,
        pays: data.pays,
        devise: data.devise,
        whatsapp: data.whatsapp,
        themeConfig: themeConfig as any,
        commissionRate: 0.06,
        statut: "active",
        planType: "palier0",
      },
    });
    await tx.proprietaireBoutique.create({
      data: { userId, tenantId: t.id, role: "owner" },
    });
    return t;
  });

  // Provisionne un design de la bibliothèque AXSO Design d'après la
  // catégorie — non bloquant, la boutique reste sur le socle par défaut
  // ("terre-et-or") en cas d'échec.
  try {
    const fichierForce = MANIFESTE_LIBRAIRIE.some((e) => e.fichier === data.themeId) ? data.themeId : undefined;
    const theme = await provisionerThemeInitial({
      tenantId: tenant.id,
      categorie: data.categorie,
      slug: tenant.slug,
      nomBoutique: tenant.nomBoutique,
      devise: tenant.devise,
      fichier: fichierForce,
    });
    await prisma.tenant.update({ where: { id: tenant.id }, data: { themeId: theme.id } });
  } catch (err) {
    console.warn("[API/BOUTIQUES] Provisionnement bibliothèque échoué (non bloquant):", err);
  }

  return NextResponse.json({ success: true, tenantId: tenant.id, slug: tenant.slug }, { status: 201 });
}
