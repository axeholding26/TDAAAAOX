// Liste et gère les liens d'affiliation du tenant connecté
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — liens que j'ai générés (je suis affilieur)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const affilieurId = (session.user as any)?.tenantId;

  const liens = await prisma.affiliationLien.findMany({
    where: { affilieurId },
    include: {
      produit: { select: { nom: true, prix: true, images: true, tauxCommissionAff: true } },
      tenant: { select: { nomBoutique: true, slug: true } },
      commissions: { select: { montantGagne: true, statut: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ liens });
}

// PATCH — mise à jour (cookieJours, actif, etc.)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = await req.json();
  const data: any = {};
  if (body.cookieJours !== undefined) data.cookieJours = body.cookieJours;
  if (body.actif !== undefined) data.actif = body.actif;
  const lien = await prisma.affiliationLien.update({ where: { id: body.id }, data });
  return NextResponse.json({ lien });
}

// DELETE — désactive un lien
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const affilieurId = (session.user as any)?.tenantId;

  const { lienId } = await req.json();
  const lien = await prisma.affiliationLien.findFirst({ where: { id: lienId, affilieurId } });
  if (!lien) return NextResponse.json({ error: "Lien introuvable" }, { status: 404 });

  await prisma.affiliationLien.update({ where: { id: lienId }, data: { actif: false } });
  return NextResponse.json({ ok: true });
}
