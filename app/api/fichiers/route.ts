// Bibliothèque « Fichiers » de la boutique (comme Contenu → Fichiers de
// Shopify) : images, vidéos et documents rangés dans le dossier de la boutique.
import { NextRequest, NextResponse } from "next/server";
import { list, del } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dossierBoutique, SOUS_DOSSIER_DIGITAL } from "@/lib/fichiers-boutique";

async function boutiqueConnectee() {
  return ((await auth())?.user as any)?.tenantId as string | undefined;
}
async function dossierConnecte() {
  const tenantId = await boutiqueConnectee();
  return tenantId ? dossierBoutique(tenantId) : null;
}

/**
 * Images de produits hébergées ailleurs (image générée par l'IA, lien collé) : elles font partie de la
 * boutique, comme sur Shopify, mais ne sont pas dans son dossier. Listées à part, jamais supprimables ici.
 */
async function imagesProduitsExternes(tenantId: string, dejaListees: Set<string>) {
  const produits = await prisma.produit.findMany({ where: { tenantId }, select: { id: true, nom: true, images: true, updatedAt: true } });
  return produits.flatMap((p) => p.images
    .filter((url) => /^https?:\/\//.test(url) && !dejaListees.has(url))
    .map((url, i) => ({ url, nom: p.images.length > 1 ? `${p.nom} (${i + 1})` : p.nom, type: "image" as const, taille: null, date: p.updatedAt.toISOString(), externe: true, produitId: p.id })));
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
      date: b.uploadedAt.toISOString(),
    }));
  // Première page seulement (toutes ou images) : les images de produits hébergées ailleurs.
  const externes = !searchParams.get("cursor") && (!type || type === "image")
    ? await imagesProduitsExternes((await boutiqueConnectee())!, new Set(fichiers.map((f) => f.url)))
    : [];
  const tous = [...fichiers, ...externes].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return NextResponse.json({ fichiers: tous, cursor: hasMore ? cursor : null });
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
