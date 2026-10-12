// Tâche planifiée de la caisse : calcule les alertes de chaque boutique qui a
// une caisse, prévient les marchands (sans doublon), puis purge les événements
// temps réel de plus de 24 h. Protégée par CRON_SECRET, comme les autres
// tâches (en-tête `x-cron-secret`, ou `Authorization: Bearer` que Vercel Cron
// envoie de lui-même).
//
// Planifiée une fois par jour dans vercel.json (bloc `crons`). Les alertes
// restent visibles entre deux passages : elles sont aussi calculées à chaque
// lecture de GET /api/pos/alertes.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculerAlertes, notifierAlertes } from "@/lib/pos/alertes";
import { purgerEvenements } from "@/lib/pos/evenements";

export const maxDuration = 60;

function autorise(req: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && (req.headers.get("x-cron-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`);
}

async function executer(seule?: string | null) {
  const boutiques = seule ? [{ tenantId: seule }] : await prisma.caisse.findMany({ where: { actif: true }, distinct: ["tenantId"], select: { tenantId: true } });
  let alertes = 0, notifiees = 0, echecs = 0;
  // ponytail: boutiques traitées l'une après l'autre dans une seule exécution de 60 s ; découper par paquets si leur nombre l'exige.
  for (const { tenantId } of boutiques) {
    try {
      const liste = await calculerAlertes(tenantId);
      alertes += liste.length;
      notifiees += await notifierAlertes(tenantId, liste);
    } catch (e) {
      echecs++;
      console.warn("[cron-pos-alertes]", tenantId, (e as Error)?.message?.slice(0, 120));
    }
  }
  const evenementsPurges = await purgerEvenements().catch(() => 0);
  return { ok: true, boutiques: boutiques.length, alertes, notifiees, echecs, evenementsPurges };
}

export async function GET(req: Request) {
  if (!autorise(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return NextResponse.json(await executer(new URL(req.url).searchParams.get("tenantId")));
}

export async function POST(req: Request) {
  if (!autorise(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const corps = await req.json().catch(() => ({}));
  return NextResponse.json(await executer(typeof corps?.tenantId === "string" ? corps.tenantId : null));
}
