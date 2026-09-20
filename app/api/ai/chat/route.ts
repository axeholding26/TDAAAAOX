// API Route — Chat IA avec Gemini
import { NextResponse } from "next/server";

export const maxDuration = 60;
import { auth } from "@/lib/auth";
import { chatAvecIA } from "@/lib/gemini";
import { z } from "zod";

const schemaChat = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { messages } = schemaChat.parse(body);

    const reponse = await chatAvecIA(messages);

    return NextResponse.json({ reponse });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: "Format invalide" }, { status: 400 });
    }

    // Si la clé API manque, renvoyer une réponse de démonstration
    if ((err as any)?.message?.includes("GEMINI_API_KEY")) {
      return NextResponse.json({
        reponse: "🤖 L'assistant IA nécessite une clé GEMINI_API_KEY dans votre .env.local. Configurez-la pour activer toutes les fonctionnalités IA.",
      });
    }

    console.error("[API/AI/CHAT] Erreur:", err);
    return NextResponse.json({ message: "Erreur IA" }, { status: 500 });
  }
}
