// Décision de l'admin sur une action préparée par AXIA admin.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { executerAction } from "@/lib/axia-admin/outils";

const schema = z.object({ id: z.string(), decision: z.enum(["accepter", "refuser"]) });

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Réservé au super-admin" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  const { id, decision } = parsed.data;

  // Prise atomique, limitée à l'admin qui a fait la demande et aux demandes de moins d'une heure :
  // une action ne peut partir qu'une fois (double clic, deux onglets).
  const pris = await prisma.adminAxiaAction.updateMany({
    where: { id, adminId: session.userId, statut: "en_attente", createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    data: { statut: decision === "accepter" ? "accepte" : "refuse" },
  });
  if (!pris.count) return NextResponse.json({ error: "Demande expirée ou déjà traitée" }, { status: 409 });
  if (decision === "refuser") return NextResponse.json({ ok: true });

  const action = await prisma.adminAxiaAction.findUniqueOrThrow({ where: { id } });
  const r = await executerAction(action.outil, action.args as Record<string, any>, session.userId);
  await prisma.adminAxiaAction.update({ where: { id }, data: { statut: r.succes ? "execute" : "echec", resultat: r.resultat } });
  return NextResponse.json({ ok: true, succes: r.succes, resultat: r.resultat });
}
