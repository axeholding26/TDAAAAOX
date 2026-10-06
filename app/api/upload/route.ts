import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { categorieFichier, TAILLE_MAX } from "@/lib/types-fichiers";
import { dossierBoutique } from "@/lib/fichiers-boutique";

// Types et tailles : source unique partagée avec l'envoi direct (lib/televerser.ts).
// ⚠ Sur Vercel, une fonction serveur accepte 4,5 Mo maximum par requête : l'interface
// passe par /api/upload/client ; cette route reste pour les petits fichiers et la compatibilité.
const getFileCategory = categorieFichier;

export async function POST(req: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "blob_not_configured" }, { status: 503 });
    }
    const session = await auth();
    const tenantId = (session?.user as any)?.tenantId as string | undefined;
    if (!session || !tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });

    const categorie = getFileCategory(file.type);
    if (!categorie) {
      return NextResponse.json({
        error: `Format non supporté. Acceptés: images (JPEG/PNG/WebP), vidéos (MP4/WebM), fichiers digitaux (PDF/ZIP/MP3)`,
      }, { status: 400 });
    }

    const tailleMax = TAILLE_MAX[categorie].octets;
    const tailleMaxLabel = TAILLE_MAX[categorie].libelle;

    if (file.size > tailleMax) {
      return NextResponse.json({ error: `Fichier trop volumineux (max ${tailleMaxLabel} pour les ${categorie}s)` }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || (
      categorie === "image" ? "jpg" : categorie === "video" ? "mp4" : "bin"
    );
    const dossier = `${dossierBoutique(tenantId)}${categorie}s`;
    const filename = `${dossier}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const blob = await put(filename, file, {
      access: "public",
      contentType: file.type,
    });

    return NextResponse.json({
      url: blob.url,
      filename: blob.pathname,
      categorie,
      nom: file.name,
      taille: file.size,
      type: file.type,
    });
  } catch (err: any) {
    console.error("[UPLOAD ERROR]", err?.message, err?.cause, err?.code);
    const msg = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({
      error: msg,
      detail: err?.cause ?? err?.code ?? null,
      storeId: process.env.BLOB_STORE_ID ?? "non défini",
    }, { status: 500 });
  }
}
