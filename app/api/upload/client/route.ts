import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";
import { TYPES_FICHIERS, TAILLE_MAX } from "@/lib/types-fichiers";
import { dossierBoutique } from "@/lib/fichiers-boutique";

// Envoi direct navigateur → Vercel Blob (images, vidéos et fichiers digitaux
// importés depuis l'appareil — voir lib/televerser.ts et MediaUpload) : /api/upload fait transiter le fichier
// par la fonction serveur, limitée à 4,5 Mo par requête sur Vercel — trop
// peu pour une vidéo. Ici le serveur ne délivre qu'un jeton d'envoi.

// Dossier où la boutique connectée doit ranger ses imports (voir lib/televerser.ts).
export async function GET() {
  const tenantId = ((await auth())?.user as any)?.tenantId as string | undefined;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return NextResponse.json({ dossier: dossierBoutique(tenantId) });
}

export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "blob_not_configured" }, { status: 503 });
  try {
    const reponse = await handleUpload({
      body: (await req.json()) as HandleUploadBody,
      request: req,
      // clientPayload = catégorie annoncée par le navigateur (lib/televerser.ts) : types et taille
      // maximale imposés ICI, côté serveur. Sans catégorie (MediaUpload) : images et vidéos.
      onBeforeGenerateToken: async (chemin, clientPayload) => {
        const tenantId = ((await auth())?.user as any)?.tenantId as string | undefined;
        if (!tenantId) throw new Error("Non autorisé");
        // Le jeton est lié au chemin demandé par le navigateur : on n'autorise que
        // le dossier de la boutique connectée (jamais celui d'une autre).
        if (!chemin.startsWith(dossierBoutique(tenantId)) || chemin.includes("..")) throw new Error("Dossier non autorisé");
        const cat = clientPayload === "image" || clientPayload === "video" || clientPayload === "digital" || clientPayload === "document" ? clientPayload : null;
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
