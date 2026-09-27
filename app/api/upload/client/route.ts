import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";
import { TYPES_FICHIERS, TAILLE_MAX } from "@/lib/types-fichiers";

// Envoi direct navigateur → Vercel Blob (images, vidéos et fichiers digitaux
// importés depuis l'appareil — voir lib/televerser.ts et MediaUpload) : /api/upload fait transiter le fichier
// par la fonction serveur, limitée à 4,5 Mo par requête sur Vercel — trop
// peu pour une vidéo. Ici le serveur ne délivre qu'un jeton d'envoi.

export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "blob_not_configured" }, { status: 503 });
  try {
    const reponse = await handleUpload({
      body: (await req.json()) as HandleUploadBody,
      request: req,
      // clientPayload = catégorie annoncée par le navigateur (lib/televerser.ts) : types et taille
      // maximale imposés ICI, côté serveur. Sans catégorie (MediaUpload) : images et vidéos.
      onBeforeGenerateToken: async (_chemin, clientPayload) => {
        if (!(await auth())) throw new Error("Non autorisé");
        const cat = clientPayload === "image" || clientPayload === "video" || clientPayload === "digital" ? clientPayload : null;
        const types = cat ? TYPES_FICHIERS[cat] : [...TYPES_FICHIERS.image, ...TYPES_FICHIERS.video];
        return { allowedContentTypes: types, maximumSizeInBytes: TAILLE_MAX[cat ?? "video"].octets, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(reponse);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Envoi impossible" }, { status: 400 });
  }
}
