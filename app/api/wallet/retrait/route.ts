import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { initierRetrait } from "@/lib/wallet";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Aucune boutique" }, { status: 400 });

  const body = await req.json();
  const { montant, methode, destinataire, operateur, notes } = body;

  if (!montant || montant <= 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }
  if (!methode || !["mobile_money", "virement_bancaire"].includes(methode)) {
    return NextResponse.json({ error: "Méthode invalide" }, { status: 400 });
  }
  if (!destinataire?.trim()) {
    return NextResponse.json({ error: "Destinataire requis" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { devise: true } });

  try {
    const retrait = await initierRetrait({
      tenantId,
      montant: Number(montant),
      devise: tenant?.devise ?? "XAF",
      methode,
      destinataire,
      operateur,
      notes,
    });

    return NextResponse.json({ success: true, retrait });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur retrait" }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ retraits: [] });

    const wallet = await prisma.wallet.findUnique({ where: { tenantId } });
    if (!wallet) return NextResponse.json({ retraits: [] });

    const retraits = await prisma.retrait.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ retraits });
  } catch {
    return NextResponse.json({ retraits: [] });
  }
}
