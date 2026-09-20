// API Génération Vidéo IA — Gemini Veo (long-running, sondé via GET)
// Note quota : le modèle vidéo Veo peut renvoyer 429 (quota 0) sur le plan
// gratuit tant qu'aucun compte de facturation Google n'est rattaché au projet.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { startVideoGemini, pollVideoGemini } from "@/lib/llm-client";

const schemaGenerer = z.object({
  prompt: z.string().min(5),
  style: z.enum(["product", "ugc", "ad", "demo"]).default("product"),
  duree: z.enum(["5s", "10s"]).default("5s"),
  ratio: z.enum(["16:9", "9:16", "1:1"]).default("16:9"),
});

// Enrichit le prompt selon le style
function enrichirPrompt(prompt: string, style: string): string {
  const enrichissements: Record<string, string> = {
    product: `${prompt}, professional product video, clean studio background, smooth camera movement, 4K cinematic quality, African e-commerce style`,
    ugc: `${prompt}, authentic UGC style video, natural lighting, real person holding product, casual African lifestyle, Instagram Reels format`,
    ad: `${prompt}, professional advertisement video, dynamic cuts, text overlays ready, high energy, African market targeted, conversion optimized`,
    demo: `${prompt}, detailed product demonstration video, close-up shots, feature highlight, educational style, clear and professional`,
  };
  return enrichissements[style] || prompt;
}

// POST /api/ai/video — Lancer la génération
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const body = await req.json();
    const { prompt, style, duree, ratio } = schemaGenerer.parse(body);
    const promptEnrichi = enrichirPrompt(prompt, style);

    // Créer l'entrée en DB avec statut "en_cours"
    const video = await prisma.videoGeneree.create({
      data: { tenantId, prompt: promptEnrichi, style, statut: "en_cours" },
    });

    try {
      const operationName = await startVideoGemini(promptEnrichi, ratio);
      await prisma.videoGeneree.update({ where: { id: video.id }, data: { requestId: operationName } });
      return NextResponse.json({ videoId: video.id, statut: "en_cours" });
    } catch (genErr: any) {
      const message = genErr?.message?.includes("429") || genErr?.message?.includes("RESOURCE_EXHAUSTED")
        ? "Quota Gemini Veo atteint pour le moment. Réessaie dans quelques instants."
        : `Erreur Gemini Veo : ${genErr?.message ?? "inconnue"}`;
      await prisma.videoGeneree.update({ where: { id: video.id }, data: { statut: "erreur", erreur: message } });
      return NextResponse.json({ message }, { status: 500 });
    }
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ message: "Données invalides" }, { status: 400 });
    console.error("[API/VIDEO]", err);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/ai/video?videoId=xxx — Vérifier le statut
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const videoId = req.nextUrl.searchParams.get("videoId");
    if (!videoId) return NextResponse.json({ message: "videoId requis" }, { status: 400 });

    const video = await prisma.videoGeneree.findUnique({ where: { id: videoId } });
    if (!video) return NextResponse.json({ message: "Vidéo introuvable" }, { status: 404 });

    // Si déjà terminée ou en erreur, retourner directement
    if (video.statut !== "en_cours" || !video.requestId) {
      return NextResponse.json(video);
    }

    const etat = await pollVideoGemini(video.requestId);

    if (!etat.done) return NextResponse.json(video);

    if (etat.error) {
      const updated = await prisma.videoGeneree.update({
        where: { id: videoId },
        data: { statut: "erreur", erreur: etat.error },
      });
      return NextResponse.json(updated);
    }

    if (!etat.videoUri) {
      const updated = await prisma.videoGeneree.update({
        where: { id: videoId },
        data: { statut: "erreur", erreur: "Aucune vidéo renvoyée par Gemini" },
      });
      return NextResponse.json(updated);
    }

    const updated = await prisma.videoGeneree.update({
      where: { id: videoId },
      data: { videoUrl: etat.videoUri, statut: "pret" },
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[API/VIDEO/STATUS]", err);
    return NextResponse.json({ message: "Erreur" }, { status: 500 });
  }
}
