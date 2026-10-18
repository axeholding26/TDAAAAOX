import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formationDuMarchand } from "@/lib/formation/editeur";
import { chargerParcours, delivrerCertificatSiEligible } from "@/lib/formation/parcours";

type Ctx = { params: Promise<{ produitId: string; renduId: string }> };

const corps = z.object({
  statut: z.enum(["valide", "a_refaire"]),
  note: z.number().int().min(0).max(100).nullable().optional(),
  feedback: z.string().trim().max(10_000).optional(),
});

// PATCH — correction manuelle d'un devoir par le formateur (uniquement les devoirs de SA formation).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { produitId, renduId } = await params;
  const f = await formationDuMarchand(produitId);
  if (!f) return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  const parse = corps.safeParse(await req.json().catch(() => null));
  if (!parse.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  const rendu = await prisma.renduDevoir.findFirst({ where: { id: renduId, produitId }, select: { id: true, commandeId: true, apprenant: true } });
  if (!rendu) return NextResponse.json({ error: "Devoir introuvable" }, { status: 404 });

  const maj = await prisma.renduDevoir.update({
    where: { id: rendu.id },
    data: { statut: parse.data.statut, note: parse.data.note ?? null, feedback: parse.data.feedback || null, corrigeAt: new Date(), corrigePar: f.userId },
  });
  // Un devoir validé peut compléter les critères : délivrance automatique de l'attestation.
  if (parse.data.statut === "valide") {
    const acces = await prisma.accesFormation.findFirst({ where: { commandeId: rendu.commandeId, produitId, revoqueAt: null }, select: { token: true } });
    const p = acces && (await chargerParcours(acces.token));
    if (p) await delivrerCertificatSiEligible(p);
  }
  return NextResponse.json({ rendu: maj });
}
