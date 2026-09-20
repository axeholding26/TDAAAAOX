// API Voix Off IA — TTS natif Gemini (gemini-3.1-flash-tts-preview)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { generateSpeechGemini, GEMINI_TTS_VOICES } from "@/lib/llm-client";

const schema = z.object({
  texte: z.string().min(1).max(5000),
  voixId: z.string().default("Kore"),
});

// POST /api/ai/voix-off — Générer une voix off
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const body = await req.json();
    const { texte, voixId } = schema.parse(body);

    // Créer l'entrée en DB
    const voixOff = await prisma.voixOff.create({
      data: { tenantId, texte, voixId, statut: "en_cours" },
    });

    try {
      const audioDataUrl = await generateSpeechGemini(texte, voixId);

      await prisma.voixOff.update({
        where: { id: voixOff.id },
        data: { statut: "pret", audioUrl: audioDataUrl },
      });

      return NextResponse.json({
        voixOffId: voixOff.id,
        audioUrl: audioDataUrl,
        statut: "pret",
        caracteres: texte.length,
      });
    } catch (genErr: any) {
      await prisma.voixOff.update({ where: { id: voixOff.id }, data: { statut: "erreur" } });
      const message = genErr?.message?.includes("429") || genErr?.message?.includes("RESOURCE_EXHAUSTED")
        ? "Quota Gemini TTS atteint pour le moment. Réessaie dans quelques instants."
        : `Erreur de génération vocale Gemini : ${genErr?.message ?? "inconnue"}`;
      return NextResponse.json({ message }, { status: 500 });
    }
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ message: "Données invalides" }, { status: 400 });
    console.error("[API/VOIX-OFF]", err);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/ai/voix-off — Liste des voix disponibles
export async function GET() {
  return NextResponse.json({ voix: GEMINI_TTS_VOICES });
}
