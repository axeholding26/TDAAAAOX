// Bibliothèque « Fichiers » de la boutique (comme Contenu → Fichiers de
// Shopify) : images, vidéos et documents rangés dans le dossier de la boutique.
import { NextRequest, NextResponse } from "next/server";
import { list, del } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { dossierBoutique, SOUS_DOSSIER_DIGITAL } from "@/lib/fichiers-boutique";

async function dossierConnecte() {
  const tenantId = ((await auth())?.user as any)?.tenantId as string | undefined;
  return tenantId ? dossierBoutique(tenantId) : null;
}

export async function GET(req: NextRequest) {
  const dossier = await dossierConnecte();
  if (!dossier) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "blob_not_configured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "image" | "video" | "document" | null (tous)
  const prefixe = type === "image" || type === "video" || type === "document" ? `${dossier}${type}s/` : dossier;
  const { blobs, cursor, hasMore } = await list({ prefix: prefixe, cursor: searchParams.get("cursor") ?? undefined, limit: 100 });

  const fichiers = blobs
    .filter((b) => !b.pathname.startsWith(dossier + SOUS_DOSSIER_DIGITAL))
    .map((b) => ({
      url: b.url,
      nom: b.pathname.split("/").pop() ?? b.pathname,
      type: b.pathname.startsWith(`${dossier}videos/`) ? "video" : b.pathname.startsWith(`${dossier}documents/`) ? "document" : "image",
      taille: b.size,
      date: b.uploadedAt,
    }))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return NextResponse.json({ fichiers, cursor: hasMore ? cursor : null });
}

export async function DELETE(req: NextRequest) {
  const dossier = await dossierConnecte();
  if (!dossier) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "blob_not_configured" }, { status: 503 });

  const { url } = await req.json().catch(() => ({}));
  let chemin = "";
  try { chemin = decodeURIComponent(new URL(url).pathname.slice(1)); } catch {}
  // Seulement un fichier de cette boutique, et jamais un fichier de produit digital.
  if (!chemin.startsWith(dossier) || chemin.startsWith(dossier + SOUS_DOSSIER_DIGITAL) || chemin.includes("..")) {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
  await del(url);
  return NextResponse.json({ ok: true });
}
