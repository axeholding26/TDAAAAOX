import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formationDuMarchand } from "@/lib/formation/editeur";

type Ctx = { params: Promise<{ produitId: string; certificatId: string }> };

const corps = z.discriminatedUnion("action", [
  z.object({ action: z.literal("revoquer"), motif: z.string().trim().min(3, "Motif requis").max(500) }),
  z.object({ action: z.literal("retablir") }),
]);

// PATCH — révocation (journalisée : date, motif, auteur) ou rétablissement d'une attestation.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { produitId, certificatId } = await params;
  const f = await formationDuMarchand(produitId);
  if (!f) return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  const parse = corps.safeParse(await req.json().catch(() => null));
  if (!parse.success) return NextResponse.json({ error: parse.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  const c = await prisma.certificat.findFirst({ where: { id: certificatId, produitId, tenantId: f.tenantId }, select: { id: true } });
  if (!c) return NextResponse.json({ error: "Attestation introuvable" }, { status: 404 });
  const certificat = await prisma.certificat.update({
    where: { id: c.id },
    data: parse.data.action === "revoquer"
      ? { revoqueAt: new Date(), revoqueMotif: parse.data.motif, revoquePar: f.userId ?? "marchand" }
      : { revoqueAt: null, revoqueMotif: null, revoquePar: null },
  });
  console.info("[certificat]", parse.data.action, { certificatId: c.id, tenantId: f.tenantId, par: f.userId });
  return NextResponse.json({ certificat });
}
