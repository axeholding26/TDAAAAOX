// Axia — voix off éphémère pour le mode vocal (pas de persistance, contrairement à /api/ai/voix-off)
// TTS natif Gemini (gemini-3.1-flash-tts-preview) — pas de fournisseur tiers.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { generateSpeechGemini } from "@/lib/llm-client";

const VOIX_AXIA = "Kore"; // voix Gemini féminine, professionnelle et chaleureuse

const schema = z.object({
  texte: z.string().min(1).max(1000),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const { texte } = schema.parse(await req.json());
    const texteClean = texte.replace(/[*_`#>]/g, "").replace(/\[IMAGE:[^\]]+\]|\[VIDEO:[^\]]+\]|\[AUDIO:[^\]]+\]/gi, "").slice(0, 800);
    if (!texteClean.trim()) return NextResponse.json({ message: "Texte vide" }, { status: 400 });

    const dataUrl = await generateSpeechGemini(texteClean, VOIX_AXIA);
    const base64 = dataUrl.split(",")[1];
    const buf = Buffer.from(base64, "base64");
    return new Response(buf, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ message: "Format invalide" }, { status: 400 });
    console.error("[AXIA/VOIX]", err);
    return NextResponse.json({ message: "Erreur TTS" }, { status: 502 });
  }
}
