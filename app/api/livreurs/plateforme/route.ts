import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { STATUTS_COURSE_ACTIVE } from "@/lib/commandes";

// Livreurs indépendants de la plateforme, assignables par n'importe quel marchand.
// Réservé aux marchands : expose téléphones et positions.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!(session.user as any)?.tenantId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const livreurs = await prisma.livreur.findMany({
    where: { actif: true, tenantId: null },
    select: {
      id: true,
      nom: true,
      telephone: true,
      vehicule: true,
      zone: true,
      disponible: true,
      latitude: true,
      longitude: true,
      positionAt: true,
      tenantId: true,
      createdAt: true,
      _count: { select: { commandes: { where: { statut: { in: STATUTS_COURSE_ACTIVE } } } } },
      tenant: { select: { nomBoutique: true, pays: true } },
    },
    orderBy: [{ disponible: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ livreurs });
}
