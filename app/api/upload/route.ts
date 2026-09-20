import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";

const TYPES_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const TYPES_VIDEO = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
const TYPES_DIGITAL = [
  "application/pdf",
  "application/zip", "application/x-zip-compressed",
  "application/octet-stream",
  "audio/mpeg", "audio/wav", "audio/ogg",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const TAILLE_MAX_IMAGE = 5 * 1024 * 1024;    // 5 MB
const TAILLE_MAX_VIDEO = 100 * 1024 * 1024;  // 100 MB
const TAILLE_MAX_DIGITAL = 200 * 1024 * 1024; // 200 MB

function getFileCategory(type: string): "image" | "video" | "digital" | null {
  if (TYPES_IMAGE.includes(type)) return "image";
  if (TYPES_VIDEO.includes(type)) return "video";
  if (TYPES_DIGITAL.includes(type) || type.startsWith("text/")) return "digital";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "blob_not_configured" }, { status: 503 });
    }
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });

    const categorie = getFileCategory(file.type);
    if (!categorie) {
      return NextResponse.json({
        error: `Format non supporté. Acceptés: images (JPEG/PNG/WebP), vidéos (MP4/WebM), fichiers digitaux (PDF/ZIP/MP3)`,
      }, { status: 400 });
    }

    const tailleMax = categorie === "image" ? TAILLE_MAX_IMAGE : categorie === "video" ? TAILLE_MAX_VIDEO : TAILLE_MAX_DIGITAL;
    const tailleMaxLabel = categorie === "image" ? "5 MB" : categorie === "video" ? "100 MB" : "200 MB";

    if (file.size > tailleMax) {
      return NextResponse.json({ error: `Fichier trop volumineux (max ${tailleMaxLabel} pour les ${categorie}s)` }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || (
      categorie === "image" ? "jpg" : categorie === "video" ? "mp4" : "bin"
    );
    const dossier = `${categorie}s`;
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
