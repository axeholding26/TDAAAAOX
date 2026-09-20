import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";

type Ctx = { params: Promise<{ id: string; fichierId: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
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
