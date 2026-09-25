import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";

// Envoi direct navigateur → Vercel Blob (images et vidéos importées depuis
// l'appareil dans les Constructeurs) : /api/upload fait transiter le fichier
// par la fonction serveur, limitée à 4,5 Mo par requête sur Vercel — trop
// peu pour une vidéo. Ici le serveur ne délivre qu'un jeton d'envoi.
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "video/mp4", "video/webm", "video/quicktime"];

export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "blob_not_configured" }, { status: 503 });
  try {
    const reponse = await handleUpload({
      body: (await req.json()) as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async () => {
        if (!(await auth())) throw new Error("Non autorisé");
        return { allowedContentTypes: TYPES, maximumSizeInBytes: 100 * 1024 * 1024, addRandomSuffix: true };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(reponse);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Envoi impossible" }, { status: 400 });
  }
}
