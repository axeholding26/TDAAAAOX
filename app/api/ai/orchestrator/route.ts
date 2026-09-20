// Orchestrateur central AXIA — coordonne tous les agents vers les objectifs
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import {
  creerObjectif,
  getObjectifsActifs,
  majProgressObjectif,
  orchestrerAutonomie,
  getEtatSysteme,
} from "@/lib/orchestrator";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("etat") }),
  z.object({ action: z.literal("orchestrer") }),
  z.object({
    action: z.literal("creer_objectif"),
    type: z.string(),
    titre: z.string(),
    cible: z.number(),
    devise: z.string().default("XAF"),
    deadline: z.string(),
  }),
  z.object({ action: z.literal("objectifs") }),
]);

export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = schema.parse(await req.json());

  if (body.action === "etat") {
    const etat = await getEtatSysteme(tenantId);
    return NextResponse.json(etat);
  }

  if (body.action === "orchestrer") {
    await majProgressObjectif(tenantId);
    const actions = await orchestrerAutonomie(tenantId);
    return NextResponse.json({ actions, message: `${actions.length} agent(s) activé(s) automatiquement` });
  }

  if (body.action === "creer_objectif") {
    const objectif = await creerObjectif({
      tenantId,
      type: body.type,
      titre: body.titre,
      cible: body.cible,
      devise: body.devise,
      deadline: new Date(body.deadline),
    });
    return NextResponse.json(objectif);
  }

  if (body.action === "objectifs") {
    const objectifs = await getObjectifsActifs(tenantId);
    return NextResponse.json(objectifs);
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const etat = await getEtatSysteme(tenantId);
  return NextResponse.json(etat);
}
