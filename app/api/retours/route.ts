import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { creerRetour, mettreAJourRetour } from "@/lib/remboursement";
import { requireNiveau } from "@/lib/permissions-server";
import { quotaCommandesAtteint } from "@/lib/abonnement";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const statut = searchParams.get("statut");

  const retours = await prisma.retourRMA.findMany({
    where: {
      tenantId,
      ...(statut ? { statut } : {}),
    },
    include: {
      commande: {
        select: { numero: true, montantTotal: true, devise: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const stats = {
    total: await prisma.retourRMA.count({ where: { tenantId } }),
    ouverts: await prisma.retourRMA.count({ where: { tenantId, statut: "ouvert" } }),
    enCours: await prisma.retourRMA.count({ where: { tenantId, statut: "en_cours" } }),
    acceptes: await prisma.retourRMA.count({ where: { tenantId, statut: "accepte" } }),
  };

  return NextResponse.json({ retours, stats });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const refus = await requireNiveau(session, "commandes", "ecriture");
  if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });

  if (await quotaCommandesAtteint(tenantId)) {
    return NextResponse.json({ error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour continuer à gérer vos commandes.", code: "quota_atteint" }, { status: 403 });
  }

  const { commande, commandeId, raison, description, type, preuveUrls } = await req.json();
  if (!(commande || commandeId) || !raison) return NextResponse.json({ error: "Commande et raison requises" }, { status: 400 });

  const r = await creerRetour({ tenantId, commande: String(commande || commandeId).trim(), raison, description, type, preuveUrls });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const retour = await prisma.retourRMA.findUnique({ where: { id: r.retour.id }, include: { commande: { select: { numero: true, montantTotal: true, devise: true } } } });
  return NextResponse.json({ retour }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const refus = await requireNiveau(session, "commandes", "ecriture");
  if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });

  if (await quotaCommandesAtteint(tenantId)) {
    return NextResponse.json({ error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour continuer à gérer vos commandes.", code: "quota_atteint" }, { status: 403 });
  }

  const { id, statut, notes } = await req.json();
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const r = await mettreAJourRetour({ tenantId, retourId: id, statut, notes });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ retour: r.retour });
}
