import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { MANIFESTE_LIBRAIRIE, provisionerThemeInitial } from "@/lib/axso-design-library";

// Provisionne un thème de la bibliothèque AXSO Design (Templates/*.html)
// pour la boutique du marchand connecté, à partir d'un design précis
// (`fichier`, ex. "aube-site") ou — à défaut — de la catégorie de la
// boutique. Remplace, en un seul appel, ce que faisait auparavant un
// simple `PATCH /api/tenants { themeId: "<un des 16 ids figés>" }` : un
// vrai Theme est créé pour ce tenant (vos vrais produits déjà branchés),
// puis assigné directement — le marchand n'a rien d'autre à faire.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ error: "Tenant requis" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const fichier = typeof body.fichier === "string" ? body.fichier : null;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

    if (fichier && !MANIFESTE_LIBRAIRIE.some((e) => e.fichier === fichier)) {
      return NextResponse.json({ error: "Design inconnu" }, { status: 400 });
    }

    const theme = await provisionerThemeInitial({
      tenantId,
      categorie: tenant.categorie,
      slug: tenant.slug,
      nomBoutique: tenant.nomBoutique,
      devise: tenant.devise,
      commissionRate: tenant.commissionRate ?? 0.06,
      fichier: fichier || undefined,
    });

    await prisma.tenant.update({ where: { id: tenantId }, data: { themeId: theme.id } });
    revalidatePath(`/${tenant.slug}`, "layout");

    return NextResponse.json({ theme }, { status: 201 });
  } catch (e) {
    console.error("[API/THEMES/PROVISIONNER]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
