// Cron — publie automatiquement les posts planifiés arrivés à échéance
// Appeler toutes les 5-15 minutes via Vercel Cron ou Render
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executerOutilMcp } from "@/lib/mcp/executor";

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const maintenant = new Date();

  // Récupère tous les posts planifiés dont la date est passée
  const posts = await prisma.postPlanifie.findMany({
    where: {
      statut: "planifie",
      planifieLe: { lte: maintenant },
    },
    take: 50,
  });

  const resultats: { id: string; plateforme: string; succes: boolean; message: string }[] = [];

  for (const post of posts) {
    let toolName = "";
    const args: Record<string, any> = {};

    if (post.plateforme === "facebook") {
      toolName = "meta_poster_facebook";
      args.message = post.contenu + (post.hashtags?.length ? "\n\n" + post.hashtags.map((h) => `#${h}`).join(" ") : "");
      args.imageUrl = post.imageUrl;
    } else if (post.plateforme === "instagram") {
      toolName = "meta_poster_instagram";
      args.caption = post.contenu + (post.hashtags?.length ? "\n\n" + post.hashtags.map((h) => `#${h}`).join(" ") : "");
      args.imageUrl = post.imageUrl;
    } else if (post.plateforme === "whatsapp") {
      // WhatsApp planifié = diffusion à tous
      toolName = "whatsapp_diffusion";
      args.message = post.contenu;
      args.segment = "tous";
    } else {
      // Plateforme non encore supportée (TikTok, Twitter) — marquer comme planifié
      continue;
    }

    try {
      const result = await executerOutilMcp(toolName, args, post.tenantId);

      await prisma.postPlanifie.update({
        where: { id: post.id },
        data: {
          statut: result.succes ? "publie" : "echec",
          publieLe: result.succes ? new Date() : undefined,
          externalId: result.donnees?.postId || result.donnees?.messageId,
          erreur: result.succes ? null : result.resultat,
        },
      });

      resultats.push({ id: post.id, plateforme: post.plateforme, succes: result.succes, message: result.resultat });
    } catch (err) {
      await prisma.postPlanifie.update({
        where: { id: post.id },
        data: { statut: "echec", erreur: String(err) },
      });
      resultats.push({ id: post.id, plateforme: post.plateforme, succes: false, message: String(err) });
    }
  }

  return NextResponse.json({
    timestamp: maintenant.toISOString(),
    posts_traites: posts.length,
    publies: resultats.filter((r) => r.succes).length,
    echecs: resultats.filter((r) => !r.succes).length,
    resultats,
  });
}
