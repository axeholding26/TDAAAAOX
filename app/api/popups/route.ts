import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireNiveau } from "@/lib/permissions-server";
import { apiLimiter, getClientIp } from "@/lib/rate-limit";

// GET — pour le dashboard (auth requis)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantSlug = searchParams.get("slug");

  // Public access: fetch active popups for a storefront
  if (tenantSlug) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true, statut: true } });
    if (!tenant || tenant.statut !== "active") return NextResponse.json({ popups: [] });

    const popups = await prisma.popupCampagne.findMany({
      where: { tenantId: tenant.id, actif: true },
      select: { id: true, type: true, declencheur: true, delaiSec: true, titre: true, message: true, ctaTexte: true, ctaUrl: true, imageUrl: true, codePromo: true },
    });
    return NextResponse.json({ popups });
  }

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  // Sans boutique (livreur, admin) : `where: { tenantId: undefined }` renverrait les popups de TOUTES les boutiques.
  if (!tenantId) return NextResponse.json({ popups: [] });
  // Route publique dans proxy.ts (vitrine) : le module marketing est contrôlé ici.
  const refusLecture = await requireNiveau(session, "marketing", "lecture");
  if (refusLecture) return NextResponse.json({ error: refusLecture.error }, { status: refusLecture.status });

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
  if (!tenantId) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  const refus = await requireNiveau(session, "marketing", "ecriture");
  if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });

  const body = await req.json().catch(() => ({}));
  const { nom, type, declencheur, delaiSec, titre, message, ctaTexte, ctaUrl, imageUrl, codePromo } = body;
  if (!nom || !titre || !message) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const invalide = valider(body);
  if (invalide) return NextResponse.json({ error: invalide }, { status: 400 });
  const popup = await prisma.popupCampagne.create({
    data: {
      tenantId, nom,
      type: type ?? "popup",
      declencheur: declencheur ?? "delai",
      delaiSec: delaiSec ?? 5,
      titre, message,
      ctaTexte: ctaTexte ?? null,
      ctaUrl: ctaUrl || null,
      imageUrl: imageUrl ?? null,
      codePromo: codePromo ?? null,
    },
  });
  return NextResponse.json({ popup }, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { id, trackClick, trackView } = body;
  if (!id || typeof id !== "string") return NextResponse.json({ error: "ID requis" }, { status: 400 });

  // Compteurs envoyés par la vitrine (visiteur sans session) : seul l'incrément est permis, popup active.
  if (trackClick || trackView) {
    if (!apiLimiter.check(getClientIp(req)).success) return NextResponse.json({ ok: true });
    await prisma.popupCampagne.updateMany({
      where: { id, actif: true },
      data: trackClick ? { clics: { increment: 1 } } : { affichages: { increment: 1 } },
    });
    return NextResponse.json({ ok: true });
  }

  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  const refus = await requireNiveau(session, "marketing", "ecriture");
  if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });

  const existing = await prisma.popupCampagne.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Popup introuvable" }, { status: 404 });

  // Champs modifiables seulement (avant : le corps entier allait à Prisma, tenantId compris).
  const invalide = valider(body);
  if (invalide) return NextResponse.json({ error: invalide }, { status: 400 });
  const data: Record<string, unknown> = {};
  for (const k of CHAMPS_MODIFIABLES) if (k in body) data[k] = body[k];
  const popup = await prisma.popupCampagne.update({ where: { id }, data });
  return NextResponse.json({ popup });
}

// Valeurs que la vitrine sait afficher ; lien du bouton : page de la boutique (« produits ») ou site web, jamais « javascript: ».
const TYPES = ["popup", "bandeau", "slide_in"], DECLENCHEURS = ["delai", "exit_intent", "scroll", "premiere_visite"];
function valider(b: Record<string, any>): string | null {
  if ("type" in b && !TYPES.includes(b.type)) return "Type de popup inconnu";
  if ("declencheur" in b && !DECLENCHEURS.includes(b.declencheur)) return "Déclencheur inconnu";
  if ("delaiSec" in b && !(Number.isInteger(b.delaiSec) && b.delaiSec >= 0 && b.delaiSec <= 300)) return "Délai entre 0 et 300 secondes";
  if (b.ctaUrl && /^[a-z][a-z0-9+.-]*:/i.test(String(b.ctaUrl)) && !/^https?:\/\//i.test(String(b.ctaUrl))) return "Lien du bouton : une page de la boutique (produits) ou une adresse https://";
  return null;
}

const CHAMPS_MODIFIABLES = ["nom", "type", "declencheur", "delaiSec", "titre", "message", "ctaTexte", "ctaUrl", "imageUrl", "codePromo", "actif"] as const;

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !tenantId) return NextResponse.json({ error: "ID requis" }, { status: 400 });
  const refus = await requireNiveau(session, "marketing", "ecriture");
  if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });

  const existing = await prisma.popupCampagne.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Popup introuvable" }, { status: 404 });

  await prisma.popupCampagne.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
