import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — liste des lots de traçabilité du tenant
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");

    const where: any = { tenantId };
    if (statut && statut !== "all") where.statut = statut;

    const lots = await prisma.lotTracabilite.findMany({
      where,
      include: { produit: { select: { nom: true, images: true, sku: true } } },
      orderBy: { dateReception: "desc" },
      take: 200,
    });

    const now = new Date();
    const enrichis = lots.map(l => ({
      ...l,
      expireBientot: !!l.dateExpiration && l.statut === "actif" && l.dateExpiration.getTime() - now.getTime() < 7 * 86400000 && l.dateExpiration.getTime() > now.getTime(),
      expire: !!l.dateExpiration && l.statut === "actif" && l.dateExpiration.getTime() <= now.getTime(),
    }));

    return NextResponse.json({
      lots: enrichis,
      stats: {
        actifs: lots.filter(l => l.statut === "actif").length,
        expirantBientot: enrichis.filter(l => l.expireBientot).length,
        expires: enrichis.filter(l => l.expire).length,
      },
    });
  } catch (err) {
    console.error("[pos/lots GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST — réception d'un nouveau lot (crée le lot + crédite le stock produit via
// un StockMouvement "entree" lié, pour que le journal et la traçabilité collent).
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const userId = (session.user as any)?.id;

    const body = await req.json();
    const {
      produitId, codeLot, quantiteInitiale, fournisseurNom, fournisseurRef,
      dateReception, dateExpiration, certification, notes,
    } = body;

    if (!produitId || !codeLot || !quantiteInitiale) {
      return NextResponse.json({ error: "produitId, codeLot et quantiteInitiale requis" }, { status: 400 });
    }

    const produit = await prisma.produit.findFirst({ where: { id: produitId, tenantId } });
    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const existant = await prisma.lotTracabilite.findUnique({ where: { tenantId_codeLot: { tenantId, codeLot } } });
    if (existant) return NextResponse.json({ error: "Ce code de lot existe déjà" }, { status: 409 });

    const qte = Number(quantiteInitiale);
    const stockAvant = produit.stock;
    const stockApres = stockAvant + qte;

    const [lot] = await prisma.$transaction([
      prisma.lotTracabilite.create({
        data: {
          tenantId, produitId, codeLot,
          quantiteInitiale: qte, quantiteRestante: qte,
          fournisseurNom: fournisseurNom || null, fournisseurRef: fournisseurRef || null,
          dateReception: dateReception ? new Date(dateReception) : new Date(),
          dateExpiration: dateExpiration ? new Date(dateExpiration) : null,
          certification: certification || null, notes: notes || null,
        },
      }),
      prisma.produit.update({ where: { id: produitId }, data: { stock: stockApres } }),
    ]);

    await prisma.stockMouvement.create({
      data: {
        tenantId, produitId, type: "entree", quantite: qte, stockAvant, stockApres,
        motif: `Réception lot ${codeLot}`, lotId: lot.id, creePar: userId || null,
      },
    });

    return NextResponse.json({ lot }, { status: 201 });
  } catch (err) {
    console.error("[pos/lots POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
