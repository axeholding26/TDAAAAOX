// API Médias — galerie vidéos + images générées par Higgsfield/Gemini
import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { integrationActive, BIENTOT_DISPONIBLE } from "@/lib/integrations";
import { prisma } from "@/lib/prisma";
import { lireConnexion } from "@/lib/connect";
import { z } from "zod";
import { aiLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const genSchema = z.object({
  type: z.enum(["video", "image"]),
  prompt: z.string().min(1).max(2000),
  model: z.string().optional(),
  style: z.string().optional(),
  aspectRatio: z.string().optional(),
  duration: z.number().optional(),
  produitId: z.string().optional(),
});

// ── GET — lister médias ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

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
  const rl = aiLimiter.check(getClientIp(req));
  if (!rl.success) return rateLimitResponse(rl.reset);
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const parsed = genSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  const body = parsed.data;

  // Clé Higgsfield de la boutique (Connecteurs) ou de la plateforme : sans aucune, on ne crée pas
  // une génération « en cours » qui finira forcément en erreur.
  const cle = await lireConnexion(tenantId, "higgsfield");
  if (!cle?.accessToken && !integrationActive("higgsfield")) return NextResponse.json({ error: BIENTOT_DISPONIBLE }, { status: 503 });

  // Créer l'entrée en DB avec statut en_cours
  const media = await prisma.videoGeneree.create({
    data: {
      tenantId,
      prompt: body.prompt,
      style: body.style ?? (body.type === "image" ? "product_photo" : "product"),
      statut: "en_cours",
    },
  });

  // Génération après la réponse : after() garde la fonction en vie (une promesse
  // lâchée était coupée par l'hébergeur dès la réponse envoyée).
  after(() => lancerGeneration(media.id, tenantId, body).catch(console.error));

  return NextResponse.json({ id: media.id, statut: "en_cours" });
}

// ── DELETE — supprimer un média ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  await prisma.videoGeneree.deleteMany({ where: { id, tenantId } });
  return NextResponse.json({ success: true });
}

// ── PATCH — mettre à jour statut (polling depuis frontend) ────────────────────
export async function PATCH(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
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
        dejaEnregistre: true, // ce média est déjà en base : pas de doublon dans la galerie
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
