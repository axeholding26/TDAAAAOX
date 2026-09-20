// API Route — Recherche produit par code-barres (Caisse POS / scanner)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireNiveau } from "@/lib/permissions-server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const refus = await requireNiveau(session, "pos", "ecriture");
  if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });

  const tenantId = (session.user as any)?.tenantId;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim();

  if (!code) return NextResponse.json({ error: "Code manquant" }, { status: 400 });

  const produit = await prisma.produit.findFirst({
    where: { tenantId, OR: [{ codeBarres: code }, { sku: code }] },
    select: {
      id: true,
      nom: true,
      prix: true,
      stock: true,
      sku: true,
      images: true,
      categorie: true,
      variantes: {
        select: { id: true, nom: true, valeur: true, prix: true, stock: true },
      },
    },
  });

  if (!produit) {
    return NextResponse.json({ error: "Produit introuvable pour ce code" }, { status: 404 });
  }

  return NextResponse.json({ produit });
}
