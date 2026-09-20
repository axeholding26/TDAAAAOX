import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — vue d'ensemble du stock des produits physiques (POS n'a de sens que
// pour de l'inventaire réel — pas les produits digitaux, sans stock physique).
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const filtre = searchParams.get("filtre") || "all"; // all | bas | rupture

    const where: any = { tenantId, type: "physique", actif: true };
    if (search) where.nom = { contains: search, mode: "insensitive" };

    const produits = await prisma.produit.findMany({
      where,
      select: {
        id: true, nom: true, images: true, sku: true, categorie: true,
        stock: true, stockMin: true, cout: true, prix: true,
        lotsTracabilite: { where: { statut: "actif" }, select: { id: true, codeLot: true, quantiteRestante: true, dateExpiration: true } },
      },
      orderBy: { nom: "asc" },
      take: 300,
    });

    let resultats = produits.map(p => ({
      ...p,
      statutStock: p.stock === 0 ? "rupture" : (p.stockMin && p.stock <= p.stockMin) ? "bas" : "ok",
    }));

    if (filtre === "bas") resultats = resultats.filter(p => p.statutStock === "bas");
    if (filtre === "rupture") resultats = resultats.filter(p => p.statutStock === "rupture");

    const mouvementsRecents = await prisma.stockMouvement.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { produit: { select: { nom: true, images: true } } },
    });

    return NextResponse.json({
      produits: resultats,
      mouvementsRecents,
      stats: {
        total: produits.length,
        enRupture: produits.filter(p => p.stock === 0).length,
        stockBas: produits.filter(p => p.stockMin && p.stock > 0 && p.stock <= p.stockMin).length,
        valeurStock: Math.round(produits.reduce((s, p) => s + (p.cout ?? 0) * p.stock, 0) * 100) / 100,
      },
    });
  } catch (err) {
    console.error("[pos/stock GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST — mouvement de stock manuel (entrée / sortie / perte / ajustement).
// Transactionnel : le solde produit.stock et le journal StockMouvement ne
// doivent jamais diverger.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const userId = (session.user as any)?.id;

    const body = await req.json();
    const { produitId, type, quantite, nouveauStock, motif, lotId } = body;

    if (!produitId || !type) return NextResponse.json({ error: "produitId et type requis" }, { status: 400 });
    if (!["entree", "sortie", "ajustement", "perte"].includes(type)) {
      return NextResponse.json({ error: "type invalide" }, { status: 400 });
    }

    const produit = await prisma.produit.findFirst({ where: { id: produitId, tenantId } });
    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const stockAvant = produit.stock;
    let stockApres: number;
    let quantiteMouvement: number;

    if (type === "entree") {
      quantiteMouvement = Math.abs(Number(quantite) || 0);
      stockApres = stockAvant + quantiteMouvement;
    } else if (type === "sortie" || type === "perte") {
      quantiteMouvement = Math.abs(Number(quantite) || 0);
      stockApres = Math.max(0, stockAvant - quantiteMouvement);
    } else {
      // ajustement — nouveauStock est la valeur absolue cible (ex: après inventaire physique)
      stockApres = Math.max(0, Number(nouveauStock) || 0);
      quantiteMouvement = Math.abs(stockApres - stockAvant);
    }

    const [, mouvement] = await prisma.$transaction([
      prisma.produit.update({ where: { id: produitId }, data: { stock: stockApres } }),
      prisma.stockMouvement.create({
        data: {
          tenantId, produitId, type, quantite: quantiteMouvement, stockAvant, stockApres,
          motif: motif || null, lotId: lotId || null, creePar: userId || null,
        },
      }),
    ]);

    return NextResponse.json({ mouvement, stock: stockApres }, { status: 201 });
  } catch (err) {
    console.error("[pos/stock POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
