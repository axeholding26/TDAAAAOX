// Modération d'un avis plateforme : approuver, refuser (motif communiqué au marchand), retirer.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAdminSessionPour } from "@/lib/admin-auth";
import { peutAgir } from "@/lib/command-center/rbac";
import { journaliser } from "@/lib/command-center/serveur";

const schema = z.discriminatedUnion("statut", [
  z.object({ statut: z.literal("approuve") }),
  z.object({ statut: z.literal("refuse"), motif: z.string().trim().min(5).max(300) }),
  z.object({ statut: z.literal("en_attente") }),
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSessionPour("avis");
  if (!session || !peutAgir(session.role)) return NextResponse.json({ erreur: "Votre rôle ne permet pas de modérer les avis" }, { status: 403 });
  const { id } = await params;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ erreur: "Décision invalide (motif de 5 caractères minimum pour un refus)" }, { status: 400 });
  const avant = await prisma.avisPlateforme.findUnique({ where: { id }, select: { statut: true, tenantId: true, motifRefus: true } });
  if (!avant) return NextResponse.json({ erreur: "Avis introuvable" }, { status: 404 });
  const motif = p.data.statut === "refuse" ? p.data.motif : null;
  await prisma.avisPlateforme.update({ where: { id }, data: { statut: p.data.statut, motifRefus: motif, moderePar: session.email, modereLe: new Date() } });
  if (p.data.statut !== "en_attente") {
    await prisma.notificationMarchand.create({ data: {
      tenantId: avant.tenantId, type: "avis_axso",
      titre: p.data.statut === "approuve" ? "Votre avis sur Axso est publié" : "Votre avis sur Axso n'a pas été publié",
      message: p.data.statut === "approuve" ? "Merci ! Votre avis apparaît désormais sur axsoafrica.com." : `Motif : ${motif}. Vous pouvez le modifier depuis votre tableau de bord.`,
      lien: "/dashboard/accueil",
    } }).catch(() => {});
  }
  await journaliser(session, `avis.${p.data.statut}`, "AvisPlateforme", id, { statut: avant.statut, motif: avant.motifRefus }, { statut: p.data.statut, motif });
  return NextResponse.json({ message: p.data.statut === "approuve" ? "Avis publié" : p.data.statut === "refuse" ? "Avis refusé" : "Avis remis en attente" });
}
