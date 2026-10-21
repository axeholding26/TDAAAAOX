// Espace livreur : soldes (par devise), gains par course, retraits. POST = demander un retrait.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { demanderRetraitLivreur, minimumRetrait } from "@/lib/gains-livreur";

async function livreurConnecte() {
  const session = await auth();
  const userId = (session?.user as any)?.id;
  return userId ? prisma.livreur.findUnique({ where: { userId }, select: { id: true, telephone: true } }) : null;
}

export async function GET() {
  const livreur = await livreurConnecte();
  if (!livreur) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const [soldes, gains, retraits] = await Promise.all([
    prisma.soldeLivreur.findMany({ where: { livreurId: livreur.id }, select: { devise: true, solde: true } }),
    prisma.gainLivreur.findMany({ where: { livreurId: livreur.id }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, numero: true, montant: true, devise: true, paiement: true, mode: true, createdAt: true } }),
    prisma.retraitLivreur.findMany({ where: { livreurId: livreur.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return NextResponse.json({
    soldes: soldes.map((s) => ({ ...s, minimum: minimumRetrait(s.devise) })),
    gains, retraits, telephone: livreur.telephone,
  });
}

export async function POST(req: NextRequest) {
  const livreur = await livreurConnecte();
  if (!livreur) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { montant, devise, telephone, operateur } = await req.json().catch(() => ({}));
  if (typeof devise !== "string" || typeof telephone !== "string") return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  try {
    const retrait = await demanderRetraitLivreur({ livreurId: livreur.id, montant: Number(montant), devise, telephone, operateur: typeof operateur === "string" ? operateur : null });
    return NextResponse.json({ ok: true, retrait });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erreur" }, { status: 400 });
  }
}
