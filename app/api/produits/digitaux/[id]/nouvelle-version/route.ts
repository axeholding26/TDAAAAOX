import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { creerNouvelleVersion } from "@/lib/produits";
import { acheteursDuProduit, preparerOffreNouvelleVersion } from "@/lib/livraison-numerique";

type Ctx = { params: Promise<{ id: string }> };

const boutique = async () => ((await auth())?.user as any)?.tenantId as string | undefined;

// GET — pour la nouvelle version : version précédente et nombre de ses acheteurs (à qui faire l'offre).
export async function GET(_req: NextRequest, { params }: Ctx) {
  const tenantId = await boutique();
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const p = await prisma.produit.findFirst({ where: { id, tenantId }, select: { versionPrecedenteId: true } });
  const precedente = p?.versionPrecedenteId ? await prisma.produit.findFirst({ where: { id: p.versionPrecedenteId, tenantId }, select: { id: true, nom: true } }) : null;
  if (!precedente) return NextResponse.json({ precedente: null });
  const offres = await prisma.codePromo.findMany({ where: { tenantId, produitIds: { has: id } }, orderBy: { createdAt: "desc" }, select: { code: true, valeur: true, utilisations: true, maxUtilisations: true, dateExpiration: true } });
  return NextResponse.json({ precedente, acheteurs: (await acheteursDuProduit(tenantId, precedente.id)).length, offres });
}

// POST {} — crée la nouvelle version (brouillon sans fichiers) du produit.
// POST { offre: { pourcentage, jours } } — sur la nouvelle version : code promo + e-mail aux anciens acheteurs.
export async function POST(req: NextRequest, { params }: Ctx) {
  const tenantId = await boutique();
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const { offre } = await req.json().catch(() => ({}));
  if (!offre) {
    const r = await creerNouvelleVersion(tenantId, id);
    return r.ok ? NextResponse.json({ id: r.id }, { status: 201 }) : NextResponse.json({ error: r.error }, { status: r.status });
  }
  const pourcentage = Math.round(Number(offre.pourcentage)), jours = Math.round(Number(offre.jours));
  if (!(pourcentage >= 1 && pourcentage <= 100) || !(jours >= 1 && jours <= 365)) return NextResponse.json({ error: "Réduction entre 1 et 100 %, durée entre 1 et 365 jours" }, { status: 400 });
  const r = await preparerOffreNouvelleVersion(tenantId, id, pourcentage, jours);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
  after(() => r.envoyer().catch((e) => console.error("[offre-nouvelle-version]", String(e?.message).slice(0, 200))));
  return NextResponse.json({ code: r.code, acheteurs: r.acheteurs, dateExpiration: r.dateExpiration });
}
