// Avis du marchand sur Axso : lire, déposer / modifier (repasse en validation), retirer.
// Réservé au propriétaire (accès complet) de la boutique active.
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accesComplet } from "@/lib/permissions-server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { eligibiliteAvis, schemaAvisPlateforme } from "@/lib/avis-plateforme";

const limite = rateLimit({ windowMs: 60_000, max: 5, keyPrefix: "avis-plateforme" });

async function contexte() {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  const userId = (session?.user as any)?.id as string | undefined;
  if (!session || !tenantId || !userId) return null;
  if (!(await accesComplet(session))) return null;
  return { tenantId, userId };
}

export async function GET() {
  const c = await contexte();
  if (!c) return NextResponse.json({ error: "Réservé au propriétaire de la boutique" }, { status: 403 });
  const [avis, elig] = await Promise.all([prisma.avisPlateforme.findUnique({ where: { tenantId: c.tenantId } }), eligibiliteAvis(c.tenantId)]);
  return NextResponse.json({ avis, ...elig });
}

export async function POST(req: NextRequest) {
  const c = await contexte();
  if (!c) return NextResponse.json({ error: "Réservé au propriétaire de la boutique" }, { status: 403 });
  const l = limite.check(c.userId);
  if (!l.success) return rateLimitResponse(l.reset);
  const elig = await eligibiliteAvis(c.tenantId);
  if (!elig.eligible) return NextResponse.json({ error: elig.raison }, { status: 403 });
  const p = schemaAvisPlateforme.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Avis invalide" }, { status: 400 });
  // Toute modification repasse en validation : un avis publié ne change jamais sans relecture.
  const donnees = { ...p.data, auteurRole: p.data.auteurRole ?? null, ville: p.data.ville ?? null, userId: c.userId, statut: "en_attente", motifRefus: null, moderePar: null, modereLe: null };
  const avis = await prisma.avisPlateforme.upsert({ where: { tenantId: c.tenantId }, create: { tenantId: c.tenantId, ...donnees }, update: donnees });
  return NextResponse.json({ avis });
}

export async function DELETE() {
  const c = await contexte();
  if (!c) return NextResponse.json({ error: "Réservé au propriétaire de la boutique" }, { status: 403 });
  await prisma.avisPlateforme.deleteMany({ where: { tenantId: c.tenantId } });
  return NextResponse.json({ ok: true });
}
