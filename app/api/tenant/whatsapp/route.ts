// API Route — Mise à jour du numéro WhatsApp Business du tenant
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) {
      return NextResponse.json({ message: "Tenant introuvable" }, { status: 400 });
    }

    const body = await request.json();
    const { whatsappNumero } = body as { whatsappNumero: string };

    if (!whatsappNumero) {
      return NextResponse.json({ message: "whatsappNumero requis" }, { status: 400 });
    }

    // Validation : doit commencer par "+" et contenir uniquement des chiffres ensuite
    if (!/^\+\d+$/.test(whatsappNumero)) {
      return NextResponse.json(
        { message: "Format invalide. Le numéro doit commencer par + suivi de chiffres uniquement." },
        { status: 422 }
      );
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { whatsappNumero },
    });

    return NextResponse.json({ succes: true });
  } catch (err) {
    console.error("[tenant/whatsapp]", err);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
