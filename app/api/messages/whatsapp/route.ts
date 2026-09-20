import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { quotaCommandesAtteint } from "@/lib/abonnement";

// GET  /api/messages/whatsapp                    → liste des conversations
// GET  /api/messages/whatsapp?contact=+221...    → thread d'un contact
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const contact = new URL(req.url).searchParams.get("contact");

  if (contact) {
    // Thread complet pour un contact (entrant + sortant, chronologique)
    const messages = await prisma.messageRecu.findMany({
      where: { tenantId, source: "whatsapp", de: contact },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, de: true, nom: true, corps: true, lu: true,
        direction: true, commandeId: true, createdAt: true, waMessageId: true,
      },
    });

    // Marquer tout comme lu
    await prisma.messageRecu.updateMany({
      where: { tenantId, source: "whatsapp", de: contact, lu: false, direction: "entrant" },
      data: { lu: true },
    });

    // Commandes liées à ce contact (par numéro de téléphone)
    const telephone = contact.replace(/\D/g, "");
    const commandes = await prisma.commande.findMany({
      where: { tenantId, clientTelephone: { contains: telephone.slice(-8) } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, numero: true, statut: true, paiementStatut: true,
        montantTotal: true, devise: true, createdAt: true,
        lignes: { select: { nom: true, quantite: true }, take: 3 },
      },
    });

    return NextResponse.json({ messages, commandes });
  }

  // Liste des conversations groupées par contact (dernière activité)
  const raw = await prisma.messageRecu.findMany({
    where: { tenantId, source: "whatsapp" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, de: true, nom: true, corps: true, lu: true,
      direction: true, commandeId: true, createdAt: true,
    },
  });

  // Grouper par numéro
  const map = new Map<string, { de: string; nom: string | null; dernier: string; lu: boolean; nonLus: number; updatedAt: string }>();
  for (const msg of raw) {
    if (!map.has(msg.de)) {
      map.set(msg.de, {
        de: msg.de,
        nom: msg.nom,
        dernier: msg.corps.slice(0, 80),
        lu: msg.direction === "sortant" ? true : msg.lu,
        nonLus: 0,
        updatedAt: msg.createdAt.toISOString(),
      });
    }
    if (msg.direction === "entrant" && !msg.lu) {
      map.get(msg.de)!.nonLus++;
    }
  }

  const locked = await quotaCommandesAtteint(tenantId);
  return NextResponse.json({ conversations: Array.from(map.values()), locked });
}

// PATCH /api/messages/whatsapp → marquer tout comme lu pour un contact
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  const { contact } = await req.json();

  await prisma.messageRecu.updateMany({
    where: { tenantId, source: "whatsapp", de: contact, lu: false },
    data: { lu: true },
  });

  return NextResponse.json({ success: true });
}
