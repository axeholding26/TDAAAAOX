import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireNiveau } from "@/lib/permissions-server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const refus = await requireNiveau(session, "equipe", "lecture");
  if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });

  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ membres: [] });

  const membres = await prisma.membreEquipe.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://axsoafrica.com";
  // Le lien d'invitation (qui vaut accès) n'est montré qu'à qui peut gérer l'équipe.
  const peutInviter = !(await requireNiveau(session, "equipe", "ecriture"));
  const enrichis = membres.map(({ inviteToken, ...m }) => ({
    ...m,
    inviteToken: null,
    lienInvitation: peutInviter && m.statut === "invite" && inviteToken ? `${appUrl}/rejoindre-equipe/${inviteToken}` : null,
  }));

  return NextResponse.json({ membres: enrichis });
}
