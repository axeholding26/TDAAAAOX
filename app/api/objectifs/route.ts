import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculerProgression, type TypeObjectif } from "@/lib/objectifs";

const TYPES_VALIDES = new Set<TypeObjectif>(["ca", "commandes", "clients", "panier_moyen"]);

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

  const objectifs = await prisma.agentGoal.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  const enrichis = await Promise.all(objectifs.map(async (o) => {
    const actuel = await calculerProgression({ tenantId, type: o.type, depuis: o.createdAt });
    const atteint = actuel >= o.cible;
    const expire = new Date() > o.deadline;

    // Recalcule le statut sans écraser une pause manuelle.
    let statut = o.statut;
    if (o.statut === "actif" && atteint) statut = "atteint";
    else if (o.statut === "actif" && expire && !atteint) statut = "echoue";

    if (statut !== o.statut || Math.abs(actuel - o.actuel) > 0.01) {
      await prisma.agentGoal.update({ where: { id: o.id }, data: { actuel, statut } });
    }

    return { ...o, actuel, statut };
  }));

  return NextResponse.json({ objectifs: enrichis });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });

  const { type, titre, cible, devise, deadline } = body;
  if (!TYPES_VALIDES.has(type)) return NextResponse.json({ error: "Type d'objectif invalide" }, { status: 400 });
  if (!titre || typeof titre !== "string") return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  const cibleNum = Number(cible);
  if (!Number.isFinite(cibleNum) || cibleNum <= 0) return NextResponse.json({ error: "Cible invalide" }, { status: 400 });
  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
    return NextResponse.json({ error: "Date limite invalide (doit être dans le futur)" }, { status: 400 });
  }

  const objectif = await prisma.agentGoal.create({
    data: { tenantId, type, titre, cible: cibleNum, devise: devise || "XAF", deadline: deadlineDate },
  });

  return NextResponse.json({ objectif });
}
