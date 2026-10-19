import { NextRequest, NextResponse } from "next/server";
import { requireNiveau } from "@/lib/permissions-server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { modifierProduit, supprimerProduit } from "@/lib/produits";
import { z } from "zod";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  // Sans boutique (admin, livreur) : un filtre tenantId vide ouvrirait toutes les boutiques.
  if (!tenantId) return NextResponse.json({ error: "Non autorisé", message: "Non autorisé" }, { status: 401 });
  const { id } = await params;

  const produit = await prisma.produit.findFirst({
    where: { id, tenantId },
    include: { variantes: true, _count: { select: { avis: true, lignesCommande: true } } },
  });

  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  return NextResponse.json({ produit });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  // Sans boutique (admin, livreur) : un filtre tenantId vide ouvrirait toutes les boutiques.
  if (!tenantId) return NextResponse.json({ error: "Non autorisé", message: "Non autorisé" }, { status: 401 });
  const refus = await requireNiveau(session, "produits", "ecriture");
  if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });

  const { id } = await params;
  const body = await req.json();

  try {
    const updated = await modifierProduit(tenantId, id, body);
    if (!updated) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    return NextResponse.json({ produit: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: err.issues }, { status: 400 });
    }
    // Code-barres unique par boutique (@@unique([tenantId, codeBarres])).
    if ((err as any)?.code === "P2002") return NextResponse.json({ error: "Ce code-barres est déjà utilisé par un autre produit de ta boutique" }, { status: 409 });
    return NextResponse.json({ error: "Erreur lors de l'enregistrement du produit" }, { status: 500 });
  }
}

// PATCH — mise à jour rapide d'un seul champ (type, actif, featured…)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  // Sans boutique (admin, livreur) : un filtre tenantId vide ouvrirait toutes les boutiques.
  if (!tenantId) return NextResponse.json({ error: "Non autorisé", message: "Non autorisé" }, { status: 401 });
  const { id } = await params;

  const body = await req.json();

  const produit = await prisma.produit.findFirst({ where: { id, tenantId } });
  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  // Champs autorisés pour le PATCH rapide
  const data: Record<string, any> = {};
  if (body.type !== undefined && ["physique", "digital", "dropshipping"].includes(body.type)) {
    data.type = body.type;
  }
  if (body.actif !== undefined) data.actif = Boolean(body.actif);
  if (body.featured !== undefined) data.featured = Boolean(body.featured);
  if (body.stock !== undefined) data.stock = Number(body.stock);
  if (body.masquerVentes !== undefined) data.masquerVentes = Boolean(body.masquerVentes);
  if (body.visibleListage !== undefined) data.visibleListage = Boolean(body.visibleListage);
  if (body.faq !== undefined) data.faq = body.faq;
  if (body.champsCommande !== undefined) data.champsCommande = body.champsCommande;
  if ("texteBoutonAchat" in body) data.texteBoutonAchat = body.texteBoutonAchat ?? null;
  if ("ogImage" in body) data.ogImage = body.ogImage ?? null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide à mettre à jour" }, { status: 400 });
  }

  const updated = await prisma.produit.update({ where: { id }, data });
  return NextResponse.json({ produit: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  // Sans boutique (admin, livreur) : un filtre tenantId vide ouvrirait toutes les boutiques.
  if (!tenantId) return NextResponse.json({ error: "Non autorisé", message: "Non autorisé" }, { status: 401 });
  // Suppression réservée au propriétaire de la boutique (jamais déduit de User.role).
  const proprio = await prisma.proprietaireBoutique.findUnique({ where: { userId_tenantId: { userId: (session.user as any).id, tenantId } }, select: { id: true } });
  if (!proprio) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;

  const r = await supprimerProduit(tenantId, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ success: true });
}
