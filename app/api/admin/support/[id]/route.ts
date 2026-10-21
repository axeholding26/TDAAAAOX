// Traitement d'un signalement marchand : statut et réponse, notifiés au marchand.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSessionPour } from "@/lib/admin-auth";
import { peutAgir } from "@/lib/command-center/rbac";
import { journaliser } from "@/lib/command-center/serveur";
import { notifierMarchand } from "@/lib/notifications-marchand";
import { schemaTraitement, NOM_STATUT } from "@/lib/signalements";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSessionPour("support");
  if (!session || !peutAgir(session.role)) return NextResponse.json({ erreur: "Votre rôle ne permet pas de traiter les signalements" }, { status: 403 });
  const { id } = await params;
  const p = schemaTraitement.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ erreur: "Traitement invalide" }, { status: 400 });
  const avant = await prisma.signalement.findUnique({ where: { id }, select: { tenantId: true, statut: true, reponse: true, resoluLe: true } });
  if (!avant) return NextResponse.json({ erreur: "Signalement introuvable" }, { status: 404 });

  const { statut } = p.data;
  const reponse = p.data.reponse || null;
  const nouvelleReponse = !!reponse && reponse !== avant.reponse;
  await prisma.signalement.update({
    where: { id },
    data: {
      statut,
      resoluLe: statut === "resolu" ? avant.resoluLe ?? new Date() : null,
      ...(nouvelleReponse ? { reponse, reponduPar: session.email, reponduLe: new Date() } : {}),
    },
  });
  // Le marchand est prévenu d'une réponse ou d'une résolution (pas d'un simple passage « en cours »).
  if (nouvelleReponse || (statut === "resolu" && avant.statut !== "resolu")) {
    await notifierMarchand({
      tenantId: avant.tenantId, type: "signalement",
      titre: statut === "resolu" ? "Votre problème signalé est résolu" : "Axso a répondu à votre signalement",
      message: reponse ? reponse.slice(0, 500) : `Statut : ${NOM_STATUT[statut]}.`,
      lien: "/dashboard/support",
    });
  }
  await journaliser(session, `support.${statut}`, "Signalement", id, { statut: avant.statut, reponse: avant.reponse }, { statut, reponse: nouvelleReponse ? reponse : avant.reponse });
  return NextResponse.json({ message: nouvelleReponse ? "Réponse envoyée au marchand" : "Statut mis à jour" });
}
