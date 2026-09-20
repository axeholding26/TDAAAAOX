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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://axso.vercel.app";
  const enrichis = membres.map((m) => ({
    ...m,
    lienInvitation: m.statut === "invite" && m.inviteToken ? `${appUrl}/rejoindre-equipe/${m.inviteToken}` : null,
  }));

  return NextResponse.json({ membres: enrichis });
}
