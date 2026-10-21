// Rémunération d'un livreur choisie par le marchand (lib/gains-livreur.ts) : son livreur
// ou un livreur plateforme. GET : réglage + ce qui a été payé ; PUT : changer le réglage.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireNiveau } from "@/lib/permissions-server";
import { MODES_GAIN, livreurReglable, resumePourMarchand } from "@/lib/gains-livreur";

async function contexte(id: string, niveau: "lecture" | "ecriture") {
  const session = await auth();
  if (!session) return { erreur: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  const tenantId = (session.user as any)?.tenantId as string | undefined;
  if (!tenantId) return { erreur: NextResponse.json({ error: "Tenant introuvable" }, { status: 404 }) };
  const refus = await requireNiveau(session, "commandes", niveau);
  if (refus) return { erreur: NextResponse.json({ error: refus.error }, { status: refus.status }) };
  const livreur = await livreurReglable(tenantId, id);
  if (!livreur) return { erreur: NextResponse.json({ error: "Livreur introuvable" }, { status: 404 }) };
  return { tenantId, livreur };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await contexte((await params).id, "lecture");
  if (c.erreur) return c.erreur;
  const { devise } = (await prisma.tenant.findUnique({ where: { id: c.tenantId }, select: { devise: true } })) ?? { devise: "XAF" };
  return NextResponse.json({ ...(await resumePourMarchand(c.tenantId, c.livreur)), devise });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await contexte((await params).id, "ecriture");
  if (c.erreur) return c.erreur;
  const { mode, montantFixe } = await req.json().catch(() => ({}));
  if (!MODES_GAIN.includes(mode)) return NextResponse.json({ error: "Mode de rémunération invalide" }, { status: 400 });
  const fixe = Math.round(Number(montantFixe ?? 0) * 100) / 100;
  if (mode === "fixe" && !(fixe > 0)) return NextResponse.json({ error: "Indique un montant par course supérieur à 0" }, { status: 400 });
  const data = { mode, montantFixe: mode === "fixe" ? fixe : 0 };
  await prisma.reglageLivreur.upsert({
    where: { tenantId_livreurId: { tenantId: c.tenantId, livreurId: c.livreur.id } },
    create: { tenantId: c.tenantId, livreurId: c.livreur.id, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true, ...data });
}
