import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { estFichierBlob } from "@/lib/livraison-numerique";

type Ctx = { params: Promise<{ id: string; fichierId: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    // Sans boutique (admin, livreur) : un filtre tenantId vide ouvrirait toutes les boutiques.
    if (!tenantId) return NextResponse.json({ error: "Non autorisé", message: "Non autorisé" }, { status: 401 });
    const { id, fichierId } = await params;

    // Vérifier que le fichier appartient bien au tenant
    const fichier = await prisma.fichierNumerique.findFirst({
      where: { id: fichierId, produitFichier: { produitId: id, produit: { tenantId } } },
    });
    if (!fichier) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });

    // Supprimer du blob si possible (non bloquant)
    try {
      if (process.env.BLOB_READ_WRITE_TOKEN) await del(fichier.url);
    } catch { /* blob déjà supprimé ou non géré */ }

    await prisma.fichierNumerique.delete({ where: { id: fichierId } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/produits/digitaux/[id]/fichiers/[fichierId] DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PUT — remplace le fichier (nouvelle version) : les acheteurs retéléchargent la nouvelle avec leur lien habituel.
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ error: "Non autorisé", message: "Non autorisé" }, { status: 401 });
    const { id, fichierId } = await params;

    const fichier = await prisma.fichierNumerique.findFirst({
      where: { id: fichierId, produitFichier: { produitId: id, produit: { tenantId } } },
    });
    if (!fichier) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });

    const { nom, url, taille, mimeType } = await req.json();
    if (typeof nom !== "string" || !nom.trim() || typeof url !== "string" || !estFichierBlob(url)) {
      return NextResponse.json({ error: "Fichier invalide" }, { status: 400 });
    }
    const maj = await prisma.fichierNumerique.update({
      where: { id: fichierId },
      data: { nom: nom.slice(0, 255), url, taille: Number(taille) || null, mimeType: typeof mimeType === "string" && mimeType ? mimeType : null },
    });

    // Ancienne version effacée du stockage une fois remplacée (non bloquant).
    try {
      if (process.env.BLOB_READ_WRITE_TOKEN && fichier.url !== url) await del(fichier.url);
    } catch { /* déjà supprimé */ }

    return NextResponse.json({ fichier: maj });
  } catch (err) {
    console.error("[api/produits/digitaux/[id]/fichiers/[fichierId] PUT]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
