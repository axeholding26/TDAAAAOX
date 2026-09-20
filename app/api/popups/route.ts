import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — pour le dashboard (auth requis)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantSlug = searchParams.get("slug");

  // Public access: fetch active popups for a storefront
  if (tenantSlug) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) return NextResponse.json({ popups: [] });

    const popups = await prisma.popupCampagne.findMany({
      where: { tenantId: tenant.id, actif: true },
      select: { id: true, type: true, declencheur: true, delaiSec: true, titre: true, message: true, ctaTexte: true, ctaUrl: true, imageUrl: true, codePromo: true },
    });
    return NextResponse.json({ popups });
  }

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const popups = await prisma.popupCampagne.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ popups });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const body = await req.json();
  const { nom, type, declencheur, delaiSec, titre, message, ctaTexte, ctaUrl, imageUrl, codePromo } = body;
  if (!nom || !titre || !message) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const popup = await prisma.popupCampagne.create({
    data: {
      tenantId, nom,
      type: type ?? "popup",
      declencheur: declencheur ?? "delai",
      delaiSec: delaiSec ?? 5,
      titre, message,
      ctaTexte: ctaTexte ?? null,
      ctaUrl: ctaUrl ?? null,
      imageUrl: imageUrl ?? null,
      codePromo: codePromo ?? null,
    },
  });
  return NextResponse.json({ popup }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const existing = await prisma.popupCampagne.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Popup introuvable" }, { status: 404 });

  // Track clicks
  if (data.trackClick) {
    await prisma.popupCampagne.update({ where: { id }, data: { clics: { increment: 1 } } });
    return NextResponse.json({ ok: true });
  }
  if (data.trackView) {
    await prisma.popupCampagne.update({ where: { id }, data: { affichages: { increment: 1 } } });
    return NextResponse.json({ ok: true });
  }

  const popup = await prisma.popupCampagne.update({ where: { id }, data });
  return NextResponse.json({ popup });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const existing = await prisma.popupCampagne.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Popup introuvable" }, { status: 404 });

  await prisma.popupCampagne.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
