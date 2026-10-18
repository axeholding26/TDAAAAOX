import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formationDuMarchand } from "@/lib/formation/editeur";

type Ctx = { params: Promise<{ produitId: string }> };

const corps = z.object({
  certif: z.boolean().optional(),
  certifLeconsPct: z.number().int().min(0).max(100).optional(),
  certifQuizRequis: z.boolean().optional(),
  certifDevoirsRequis: z.boolean().optional(),
});

// PATCH — critères de l'attestation (délivrance automatique quand ils sont remplis).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const f = await formationDuMarchand((await params).produitId);
  if (!f) return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  const parse = corps.safeParse(await req.json().catch(() => null));
  if (!parse.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  const formation = await prisma.formation.update({ where: { id: f.id }, data: parse.data });
  return NextResponse.json({ formation });
}
