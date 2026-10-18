// AI Course Studio — liste des studios, création (brief), plafond IA mensuel de la boutique.
// Module « produits » (proxy.ts / lib/permissions-api.ts).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { budget, creerStudio, tenantDeSession } from "@/lib/academie/studio";
import { matriceFournisseurs } from "@/lib/academie/fournisseurs";
import { PLAFOND_MAX } from "@/lib/academie/regles";

const refus = () => NextResponse.json({ error: "Non autorisé" }, { status: 401 });

export async function GET() {
  const tenantId = await tenantDeSession();
  if (!tenantId) return refus();
  const [studios, b, formations] = await Promise.all([
    prisma.studioCours.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, titre: true, statut: true, etape: true, produitId: true, updatedAt: true } }),
    budget(tenantId),
    prisma.produit.findMany({ where: { tenantId, type: "formation" }, select: { id: true, nom: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return NextResponse.json({ studios, budget: b, fournisseurs: matriceFournisseurs(), formations });
}

export async function POST(req: NextRequest) {
  const tenantId = await tenantDeSession();
  if (!tenantId) return refus();
  try {
    const studio = await creerStudio(tenantId, await req.json());
    return NextResponse.json({ studio }, { status: 201 });
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Brief invalide", details: e.issues.map((i) => `${i.path.join(".")} : ${i.message}`) }, { status: 400 });
    return NextResponse.json({ error: e?.message ?? "Erreur" }, { status: e?.status ?? 500 });
  }
}

// PUT { plafond: number | null } — null = retour au plafond par défaut.
export async function PUT(req: NextRequest) {
  const tenantId = await tenantDeSession();
  if (!tenantId) return refus();
  const p = z.object({ plafond: z.number().min(0).max(PLAFOND_MAX).nullable() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: `Plafond invalide (0 à ${PLAFOND_MAX} FCFA)` }, { status: 400 });
  await prisma.tenant.update({ where: { id: tenantId }, data: { plafondIAMensuel: p.data.plafond } });
  return NextResponse.json({ budget: await budget(tenantId) });
}
