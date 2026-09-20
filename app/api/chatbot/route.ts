// API Chatbot WhatsApp — config auto-réponse IA
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET — récupérer config chatbot ────────────────────────────────────────────
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const config = await prisma.connecteurConfig.findFirst({
    where: { tenantId, type: "chatbot_whatsapp" },
  });

  return NextResponse.json({
    actif: config?.statut === "actif",
    config: (config?.config as any) ?? {
      delaiReponse: 0,
      personnalite: "professionnel",
      messageAccueil: "",
      horaires: { actif: false, debut: "08:00", fin: "20:00" },
      motsClesExclus: [],
    },
  });
}

// ── POST — sauvegarder config chatbot ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { actif, config } = await req.json();

  await prisma.connecteurConfig.upsert({
    where: { tenantId_type: { tenantId, type: "chatbot_whatsapp" } },
    create: { tenantId, type: "chatbot_whatsapp", statut: actif ? "actif" : "inactif", config: config ?? {} },
    update: { statut: actif ? "actif" : "inactif", config: config ?? {} },
  });

  return NextResponse.json({ succes: true });
}
