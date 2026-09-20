import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const entrepots = await (prisma as any).entrepot.findMany({
    where: { tenantId },
    include: { _count: { select: { stocks: true } } },
    orderBy: [{ principal: "desc" }, { nom: "asc" }],
  });
  return NextResponse.json({ entrepots });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = session.user.tenantId;
  const body = await req.json();

  // If setting as principal, unset others
  if (body.principal) {
    await (prisma as any).entrepot.updateMany({ where: { tenantId }, data: { principal: false } });
  }

  const entrepot = await (prisma as any).entrepot.create({
    data: { tenantId, nom: body.nom, adresse: body.adresse, ville: body.ville, pays: body.pays ?? "Cameroun", principal: body.principal ?? false },
  });
  return NextResponse.json({ entrepot });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = session.user.tenantId;
  const body = await req.json();

  if (body.principal) {
    await (prisma as any).entrepot.updateMany({ where: { tenantId }, data: { principal: false } });
  }

  const entrepot = await (prisma as any).entrepot.update({
    where: { id: body.id },
    data: { nom: body.nom, adresse: body.adresse, ville: body.ville, pays: body.pays, principal: body.principal, actif: body.actif },
  });
  return NextResponse.json({ entrepot });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  await (prisma as any).stockEntrepot.deleteMany({ where: { entrepotId: id } });
  await (prisma as any).entrepot.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
