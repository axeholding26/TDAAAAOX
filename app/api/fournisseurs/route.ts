import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const fournisseurs = await prisma.fournisseur.findMany({
    where: { tenantId },
    include: {
      _count: { select: { produits: true } },
    },
    orderBy: { fiabilite: "desc" },
  });

  return NextResponse.json({ fournisseurs });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const body = await req.json();
  const { nom, pays, type, url, email, telephone, delaiLivraison, margeAuto, notes } = body;

  if (!nom) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  const fournisseur = await prisma.fournisseur.create({
    data: {
      tenantId,
      nom,
      pays: pays ?? "Chine",
      type: type ?? "aliexpress",
      url: url ?? null,
      email: email ?? null,
      telephone: telephone ?? null,
      delaiLivraison: delaiLivraison ?? 15,
      margeAuto: margeAuto ?? 0.30,
      notes: notes ?? null,
    },
  });

  return NextResponse.json({ fournisseur }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const existing = await prisma.fournisseur.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });

  const fournisseur = await prisma.fournisseur.update({ where: { id }, data });
  return NextResponse.json({ fournisseur });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const existing = await prisma.fournisseur.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });

  // Detach products before deleting
  await prisma.produit.updateMany({
    where: { fournisseurId: id },
    data: { fournisseurId: null },
  });

  await prisma.fournisseur.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
