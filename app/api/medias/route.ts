// API Médias — galerie vidéos + images générées par Higgsfield/Gemini
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const genSchema = z.object({
  type: z.enum(["video", "image"]),
  prompt: z.string().min(1),
  model: z.string().optional(),
  style: z.string().optional(),
  aspectRatio: z.string().optional(),
  duration: z.number().optional(),
  produitId: z.string().optional(),
});

// ── GET — lister médias ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "video" | "image" | null (all)
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 20;

  const [videos, total] = await Promise.all([
    prisma.videoGeneree.findMany({
      where: {
        tenantId,
        ...(type === "video" && { videoUrl: { not: null } }),
        ...(type === "image" && { videoUrl: null, thumbnailUrl: { not: null } }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.videoGeneree.count({ where: { tenantId } }),
  ]);

  // Stats rapides
  const stats = {
    total,
    pretes: videos.filter(v => v.statut === "pret").length,
    enCours: videos.filter(v => v.statut === "en_cours").length,
    erreurs: videos.filter(v => v.statut === "erreur").length,
  };

  return NextResponse.json({ medias: videos, stats, total, page, pages: Math.ceil(total / limit) });
}

// ── POST — lancer une génération ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const body = genSchema.parse(await req.json());

  // Créer l'entrée en DB avec statut en_cours
  const media = await prisma.videoGeneree.create({
    data: {
      tenantId,
      prompt: body.prompt,
      style: body.style ?? (body.type === "image" ? "product_photo" : "product"),
      statut: "en_cours",
    },
  });

  // Lancer la génération via MCP executor (sans bloquer la réponse)
  lancerGeneration(media.id, tenantId, body).catch(console.error);

  return NextResponse.json({ id: media.id, statut: "en_cours" });
}

// ── DELETE — supprimer un média ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  await prisma.videoGeneree.deleteMany({ where: { id, tenantId } });
  return NextResponse.json({ success: true });
}

// ── PATCH — mettre à jour statut (polling depuis frontend) ────────────────────
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const media = await prisma.videoGeneree.findFirst({ where: { id, tenantId } });
  if (!media) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  return NextResponse.json(media);
}

async function lancerGeneration(mediaId: string, tenantId: string, params: z.infer<typeof genSchema>) {
  try {
    const { executerOutilMcp } = await import("@/lib/mcp/executor");
    let result;

    if (params.type === "video") {
      result = await executerOutilMcp("higgsfield_generer_video", {
        prompt: params.prompt,
        model: params.model ?? "kling-3.0",
        style: params.style ?? "product",
        duration: params.duration ?? 10,
        aspect_ratio: params.aspectRatio ?? "16:9",
      }, tenantId);
    } else {
      result = await executerOutilMcp("higgsfield_generer_image", {
        prompt: params.prompt,
        model: params.model ?? "recraft-4.1",
        style: params.style ?? "product_photo",
        width: 1024,
        height: 1024,
      }, tenantId);
    }

    if (result.succes && result.donnees) {
      const url = result.donnees.videoUrl ?? result.donnees.imageUrl;
      await prisma.videoGeneree.update({
        where: { id: mediaId },
        data: {
          statut: "pret",
          videoUrl: params.type === "video" ? url : null,
          thumbnailUrl: params.type === "image" ? url : null,
        },
      });
    } else {
      await prisma.videoGeneree.update({
        where: { id: mediaId },
        data: { statut: "erreur", erreur: result.resultat },
      });
    }
  } catch (err: any) {
    await prisma.videoGeneree.update({
      where: { id: mediaId },
      data: { statut: "erreur", erreur: err.message },
    }).catch(() => {});
  }
}
