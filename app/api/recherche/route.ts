// Recherche globale du tableau de bord (barre « Rechercher… » / Ctrl+K) :
// produits, commandes et clients de la boutique active, chaque module
// seulement si le membre connecté y a au moins accès en lecture.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionsSession } from "@/lib/permissions-server";

export async function GET(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  if (!tenantId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ produits: [], commandes: [], clients: [] });

  const droits = await permissionsSession(session);
  const peut = (m: keyof typeof droits) => droits[m] !== "aucun";
  const contient = { contains: q, mode: "insensitive" as const };

  const [produits, commandes, clients, tenant] = await Promise.all([
    peut("produits") ? prisma.produit.findMany({
      where: { tenantId, OR: [{ nom: contient }, { sku: contient }, { categorie: contient }] },
      select: { id: true, nom: true, type: true, prix: true, images: true, actif: true },
      orderBy: { updatedAt: "desc" }, take: 5,
    }) : [],
    peut("commandes") ? prisma.commande.findMany({
      where: { tenantId, OR: [{ numero: contient }, { clientNom: contient }, { clientTelephone: contient }, { clientEmail: contient }] },
      select: { id: true, numero: true, clientNom: true, montantTotal: true, devise: true, statut: true },
      orderBy: { createdAt: "desc" }, take: 5,
    }) : [],
    peut("clients") ? prisma.client.findMany({
      where: { tenantId, OR: [{ nom: contient }, { email: contient }, { telephone: contient }] },
      select: { id: true, nom: true, telephone: true, email: true },
      orderBy: { createdAt: "desc" }, take: 5,
    }) : [],
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { devise: true } }),
  ]);

  return NextResponse.json({
    devise: tenant?.devise ?? "XAF",
    produits: produits.map((p) => ({ ...p, image: p.images[0] ?? null, images: undefined })),
    commandes,
    clients: clients.map((c) => ({ ...c, email: c.email.endsWith("@axso.com") ? null : c.email })), // adresse générée depuis le téléphone : pas une vraie adresse
  });
}
