import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const programmes = await (prisma as any).affiliationEntrante.findMany({
    where: { tenantId },
    orderBy: { revenus: "desc" },
  });

  const stats = {
    total: programmes.length,
    actifs: programmes.filter((p: any) => p.actif).length,
    revenuTotal: programmes.reduce((s: number, p: any) => s + p.revenus, 0),
    clicsTotal: programmes.reduce((s: number, p: any) => s + p.clics, 0),
  };

  return NextResponse.json({ programmes, stats });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = session.user.tenantId;
  const body = await req.json();

  const programme = await (prisma as any).affiliationEntrante.create({
    data: {
      tenantId,
      nom: body.nom,
      marchand: body.marchand,
      url: body.url,
      categorie: body.categorie,
      commission: body.commission ?? 0.10,
      devise: body.devise ?? "XAF",
    },
  });
  return NextResponse.json({ programme });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = await req.json();

  const data: any = {};
  if (body.actif !== undefined) data.actif = body.actif;
  if (body.trackClick) data.clics = { increment: 1 };
  if (body.trackConversion) {
    data.conversions = { increment: 1 };
    if (body.montant) data.revenus = { increment: body.montant };
  }
  if (body.nom) data.nom = body.nom;
  if (body.url) data.url = body.url;

  const programme = await (prisma as any).affiliationEntrante.update({ where: { id: body.id }, data });
  return NextResponse.json({ programme });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await (prisma as any).affiliationEntrante.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
