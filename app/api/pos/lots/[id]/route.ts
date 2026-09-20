import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

// PATCH — change le statut d'un lot (actif/epuise/perime/rappele) ou ses notes.
// Un passage à "perime" ou "rappele" retire le solde restant du stock produit
// (le stock physique ne doit plus refléter une marchandise invendable).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const userId = (session.user as any)?.id;
    const { id } = await params;

    const lot = await prisma.lotTracabilite.findFirst({ where: { id, tenantId } });
    if (!lot) return NextResponse.json({ error: "Lot introuvable" }, { status: 404 });

    const body = await req.json();
    const { statut, notes } = body;
    const data: any = {};
    if (notes !== undefined) data.notes = notes;

    if (statut && statut !== lot.statut) {
      if (!["actif", "epuise", "perime", "rappele"].includes(statut)) {
        return NextResponse.json({ error: "statut invalide" }, { status: 400 });
      }
      data.statut = statut;

      // Retrait du solde restant du lot hors stock vendable
      if ((statut === "perime" || statut === "rappele") && lot.quantiteRestante > 0) {
        const produit = await prisma.produit.findUnique({ where: { id: lot.produitId } });
        if (produit) {
          const stockAvant = produit.stock;
          const stockApres = Math.max(0, stockAvant - lot.quantiteRestante);
          await prisma.$transaction([
            prisma.produit.update({ where: { id: produit.id }, data: { stock: stockApres } }),
            prisma.stockMouvement.create({
              data: {
                tenantId, produitId: produit.id, type: "perte",
                quantite: lot.quantiteRestante, stockAvant, stockApres,
                motif: `Lot ${lot.codeLot} — ${statut === "perime" ? "périmé" : "rappelé"}`,
                lotId: lot.id, creePar: userId || null,
              },
            }),
          ]);
        }
        data.quantiteRestante = 0;
      }
    }

    const miseAJour = await prisma.lotTracabilite.update({ where: { id }, data });
    return NextResponse.json({ lot: miseAJour });
  } catch (err) {
    console.error("[pos/lots/[id] PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
