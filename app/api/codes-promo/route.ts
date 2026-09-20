// API — Codes promo CRUD
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  const codes = await prisma.codePromo.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(codes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  const body = await req.json();
  const { code, type, valeur, maxUtilisations } = body;

  if (!code || !type || !valeur) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  try {
    const nouveauCode = await prisma.codePromo.create({
      data: {
        tenantId,
        code: code.toUpperCase(),
        type,
        valeur: Number(valeur),
        maxUtilisations: maxUtilisations || null,
        actif: true,
        utilisations: 0,
      },
    });
    return NextResponse.json(nouveauCode);
  } catch {
    return NextResponse.json({ error: "Code déjà existant" }, { status: 409 });
  }
}
