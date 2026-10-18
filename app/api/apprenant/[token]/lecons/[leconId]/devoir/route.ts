import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { leconOuverte, marquerTerminee, noterActivite, parcoursOuRefus, refusVerrou } from "@/lib/formation/parcours";
import { notifierMarchand } from "@/lib/notifications-marchand";

type Ctx = { params: Promise<{ token: string; leconId: string }> };

const corps = z.object({ texte: z.string().trim().min(1, "Réponse vide").max(20_000) });

// POST — rendu d'un devoir (réponse ouverte). Modifiable tant qu'il n'est pas validé ;
// la leçon compte comme « terminée » (progression), la validation par le formateur est la réussite.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { token, leconId } = await params;
  const p = await parcoursOuRefus(req, token);
  if (p instanceof NextResponse) return p;
  const trouve = leconOuverte(p, leconId);
  if (!trouve || trouve.lecon.type !== "devoir") return NextResponse.json({ error: "Devoir introuvable" }, { status: 404 });
  const refus = refusVerrou(trouve.verrou);
  if (refus) return refus;
  const parse = corps.safeParse(await req.json().catch(() => null));
  if (!parse.success) return NextResponse.json({ error: parse.error.issues[0]?.message ?? "Réponse invalide" }, { status: 400 });

  const where = { leconId_apprenant: { leconId, apprenant: p.apprenant } };
  const existant = await prisma.renduDevoir.findUnique({ where, select: { statut: true } });
  if (existant?.statut === "valide") return NextResponse.json({ error: "Ce devoir est déjà validé" }, { status: 409 });

  await prisma.renduDevoir.upsert({
    where,
    create: { leconId, produitId: p.acces.produitId, apprenant: p.apprenant, commandeId: p.acces.commandeId, texte: parse.data.texte },
    update: { texte: parse.data.texte, statut: "soumis" },
  });
  await marquerTerminee(p, leconId);
  await noterActivite(p, leconId);
  await notifierMarchand({
    tenantId: p.tenantId, type: "devoir",
    titre: `Devoir à corriger — ${p.produitNom}`,
    message: `${p.nomApprenant || "Un apprenant"} a rendu « ${trouve.lecon.titre} ».`,
    lien: `/dashboard/produits/${p.acces.produitId}/apprenants#devoirs`,
  });
  return NextResponse.json({ ok: true, statut: "soumis" });
}
