// Génération d'images produits — Gemini natif exclusif (gemini-3.1-flash-image)
//
// Note quota : sur le plan gratuit Gemini, les modèles image peuvent renvoyer
// une erreur 429 (quota 0) tant qu'aucun compte de facturation Google n'est
// rattaché au projet — ce n'est pas un bug. generateProductImage() échoue
// alors silencieusement (retourne null) pour ne jamais bloquer la création
// d'un produit ou d'une boutique faute d'image.

import { put } from "@vercel/blob";
import { generateImageGemini } from "./llm-client";

export interface ImageGenOptions {
  prompt: string;
}

/** Upload une image générée (data: URL) vers Vercel Blob si configuré, sinon la garde en data: URL. */
async function persistGeneratedImage(dataUrl: string): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return dataUrl;
  try {
    const [meta, base64] = dataUrl.split(",");
    const mimeType = meta.match(/data:(.*?);base64/)?.[1] ?? "image/png";
    const ext = mimeType.split("/")[1]?.split("+")[0] ?? "png";
    const buffer = Buffer.from(base64, "base64");
    const blob = await put(`ia-generation/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`, buffer, {
      access: "public",
      contentType: mimeType,
    });
    return blob.url;
  } catch (err) {
    console.error("[image-gen/blob]", err);
    return dataUrl;
  }
}

/** Génère une image produit via Gemini. Retourne null (jamais d'exception) si le quota ou le réseau échoue. */
export async function generateProductImage(opts: ImageGenOptions): Promise<string | null> {
  try {
    const dataUrl = await generateImageGemini(opts.prompt);
    if (!dataUrl) return null;
    return await persistGeneratedImage(dataUrl);
  } catch (err) {
    console.error("[image-gen/gemini]", (err as any)?.message ?? err);
    return null;
  }
}

/** Version historique attendue par les appelants existants — retourne "" plutôt que null en cas d'échec (pas d'image cassée dans l'UI). */
export async function generateProductImageUrl(prompt: string): Promise<string> {
  const url = await generateProductImage({ prompt });
  return url ?? "";
}

// Construit le prompt d'image optimisé pour Gemini
export function buildProductImagePrompt(nom: string, categorie: string, style = "product_white"): string {
  const styleMap: Record<string, string> = {
    product_white: "professional product photography, pure white background, studio lighting, e-commerce, sharp details, 8K quality",
    product_lifestyle: "lifestyle product photography, African context, natural lighting, warm atmosphere, premium quality",
    social_media: "Instagram post visual, vibrant colors, African aesthetic, eye-catching, high quality",
    banner: "wide marketing banner, professional design, African colors, premium brand look",
  };
  return `${nom}, ${categorie}, ${styleMap[style] ?? styleMap.product_white}`;
}
