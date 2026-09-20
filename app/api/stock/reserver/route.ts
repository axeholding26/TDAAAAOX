import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST — Reserve stock when item added to cart
// Body: { tenantId, produitId, varianteId?, sessionId, quantite, action: "reserver"|"liberer" }
export async function POST(req: Request) {
  const body = await req.json();
  const { tenantId, produitId, varianteId, sessionId, quantite = 1, action = "reserver" } = body;

  if (!tenantId || !produitId || !sessionId) {
    return NextResponse.json({ error: "Paramètres requis manquants" }, { status: 400 });
  }

  // Cleanup expired reservations first
  await prisma.stockReservation.deleteMany({
    where: { expireAt: { lt: new Date() } },
  }).catch(() => null);

  if (action === "liberer") {
    await prisma.stockReservation.deleteMany({ where: { sessionId, produitId } });
    if (varianteId) {
      await prisma.variante.update({
        where: { id: varianteId },
        data: { stock: { increment: quantite } },
      }).catch(() => null);
    } else {
      await prisma.produit.update({
        where: { id: produitId },
        data: { stock: { increment: quantite }, stockReserve: { decrement: quantite } },
      }).catch(() => null);
    }
    return NextResponse.json({ ok: true, action: "libere" });
  }

  // Check available stock
  const produit = await prisma.produit.findUnique({ where: { id: produitId } });
  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  const stockDispo = varianteId
    ? (await prisma.variante.findUnique({ where: { id: varianteId } }))?.stock ?? 0
    : produit.stock - produit.stockReserve;

  if (stockDispo < quantite) {
    return NextResponse.json({ error: "Stock insuffisant", stockDispo }, { status: 409 });
  }

  // Delete existing reservation for this session+product
  await prisma.stockReservation.deleteMany({ where: { sessionId, produitId } });

  // Create new reservation (TTL 30 minutes)
  const expireAt = new Date(Date.now() + 30 * 60 * 1000);
  await prisma.stockReservation.create({
    data: { tenantId, produitId, varianteId: varianteId ?? null, sessionId, quantite, expireAt },
  });

  // Decrement available stock
  if (varianteId) {
    await prisma.variante.update({
      where: { id: varianteId },
      data: { stock: { decrement: quantite } },
    });
  } else {
    await prisma.produit.update({
      where: { id: produitId },
      data: { stockReserve: { increment: quantite } },
    });
  }

  return NextResponse.json({ ok: true, action: "reserve", stockDispo: stockDispo - quantite, expireAt });
}
