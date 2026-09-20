import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { crediterBonusWallet } from "@/lib/wallet";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Lecture seule — action réservée au super-admin" }, { status: 403 });

  const { id } = await params;
  const { montant, raison, emoji, titre } = await req.json();

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { devise: true, statut: true } });
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  if (tenant.statut === "systeme") return NextResponse.json({ error: "Boutique système, non applicable" }, { status: 400 });

  if (montant && Number(montant) > 0) {
    try {
      await crediterBonusWallet(id, Number(montant), tenant.devise, raison || "Récompense Axso");
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? "Erreur bonus" }, { status: 400 });
    }
  }

  if (titre?.trim()) {
    await prisma.badgeMarchand.create({
      data: {
        tenantId: id,
        type: `recompense_${Date.now()}`,
        titre: titre.trim(),
        description: raison || undefined,
        emoji: emoji || "🏆",
      },
    });
  }

  return NextResponse.json({ success: true });
}
