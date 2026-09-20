// Orchestrateur Contenu — génère automatiquement visuels + posts pour les produits
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { produitId, actions } = await req.json();
  // actions: ["photo", "video", "post_instagram", "post_facebook", "description"]

  const produit = await prisma.produit.findFirst({
    where: { id: produitId, tenantId },
    select: { id: true, nom: true, description: true, prix: true, images: true },
  });
  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  const { executerOutilMcp } = await import("@/lib/mcp/executor");
  const resultats: Record<string, any> = {};

  // Générer description IA
  if (actions.includes("description")) {
    const r = await executerOutilMcp("gemini_generer_description_produit", {
      nom: produit.nom,
      prix: produit.prix,
      details: produit.description ?? "",
    }, tenantId);
    if (r.succes) {
      resultats.description = r.resultat;
      await prisma.produit.update({ where: { id: produitId }, data: { description: r.resultat } });
    }
  }

  // Générer photo produit
  if (actions.includes("photo")) {
    const r = await executerOutilMcp("higgsfield_generer_image", {
      prompt: `Photo produit professionnelle de ${produit.nom}, fond blanc, éclairage studio, ultra HD`,
      model: "recraft-4.1",
      style: "product_photo",
      width: 1024,
      height: 1024,
    }, tenantId);
    if (r.succes && r.donnees?.imageUrl) {
      resultats.photo = r.donnees.imageUrl;
      await prisma.videoGeneree.create({
        data: { tenantId, prompt: `Photo produit: ${produit.nom}`, style: "product_photo", statut: "pret", thumbnailUrl: r.donnees.imageUrl },
      });
    }
  }

  // Générer vidéo produit
  if (actions.includes("video")) {
    const mediaEntry = await prisma.videoGeneree.create({
      data: { tenantId, prompt: `Vidéo produit: ${produit.nom}`, style: "product", statut: "en_cours" },
    });
    resultats.videoId = mediaEntry.id;
    // Lance en arrière-plan
    lancerVideoAsync(mediaEntry.id, tenantId, produit.nom, executerOutilMcp).catch(() => {});
  }

  // Générer post Instagram
  if (actions.includes("post_instagram")) {
    const r = await executerOutilMcp("gemini_generer_post_social", {
      produit: produit.nom,
      prix: produit.prix,
      plateforme: "instagram",
    }, tenantId);
    if (r.succes) resultats.post_instagram = r.resultat;
  }

  // Générer post Facebook
  if (actions.includes("post_facebook")) {
    const r = await executerOutilMcp("gemini_generer_post_social", {
      produit: produit.nom,
      prix: produit.prix,
      plateforme: "facebook",
    }, tenantId);
    if (r.succes) resultats.post_facebook = r.resultat;
  }

  return NextResponse.json({ succes: true, resultats });
}

async function lancerVideoAsync(mediaId: string, tenantId: string, nomProduit: string, executerOutilMcp: Function) {
  try {
    const r = await executerOutilMcp("higgsfield_generer_video", {
      prompt: `Présentation produit ${nomProduit}, cinématique, rotation 360°, éclairage professionnel`,
      model: "kling-3.0",
      style: "product",
      duration: 10,
      aspect_ratio: "1:1",
    }, tenantId);
    await prisma.videoGeneree.update({
      where: { id: mediaId },
      data: r.succes && r.donnees?.videoUrl
        ? { statut: "pret", videoUrl: r.donnees.videoUrl }
        : { statut: "erreur", erreur: r.resultat },
    });
  } catch (e: any) {
    await prisma.videoGeneree.update({ where: { id: mediaId }, data: { statut: "erreur", erreur: e.message } }).catch(() => {});
  }
}
