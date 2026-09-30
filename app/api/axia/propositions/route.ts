// Bulle AXIA du dashboard : lit les prises de parole d'AXIA (constats et
// demandes de confirmation) et applique la décision du marchand.
import { NextResponse, after } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionsSession } from "@/lib/permissions-server";
import { outilAutorise } from "@/lib/axia/droits";
import { detecterConstats } from "@/lib/axia/constats";
import { AXIA_TOOLS, executerOutilDirect } from "@/lib/axia/tools";
import { executerOutilAgent } from "@/lib/agent-consumer";
import { filtrerOutilsParPalier } from "@/lib/plans";
import { planActif } from "@/lib/abonnement";
import { palierAuMoins } from "@/lib/plans";
import { logDecision } from "@/lib/agent-memory";
import { getLangue } from "@/lib/i18n/serveur";
import type { GrillePermissions } from "@/lib/permissions";

export const maxDuration = 60;

const INTERVALLE_DETECTION_MS = 15 * 60_000;
const EN_ATTENTE = ["nouveau", "vu"];

type Action = { outil?: string; args?: Record<string, any>; agent?: string; prompt?: string; lien?: string };

// Constats (chiffres de la boutique) : accès complet uniquement. Confirmations :
// quiconque a le droit d'utiliser l'outil ; celles des agents autonomes : accès complet.
function visible(p: { type: string; action: unknown }, droits: GrillePermissions, complet: boolean) {
  if (p.type !== "confirmation") return complet;
  const a = p.action as Action | null;
  return a?.agent ? complet : !!a?.outil && outilAutorise(a.outil, droits);
}

async function contexte() {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  if (!session || !tenantId) return null;
  const droits = await permissionsSession(session);
  return { tenantId, droits, complet: outilAutorise("deleguer_vers_agent", droits) };
}

export async function GET() {
  const ctx = await contexte();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { tenantId, droits, complet } = ctx;
  // AXIA (prises de parole et demandes d'accord) : Palier Pro et plus, comme AXIA plein écran.
  if (!palierAuMoins((await planActif(tenantId)).plan, "palier1")) return NextResponse.json({ propositions: [] });

  if (complet) {
    const cle = { tenantId_agentId_cle: { tenantId, agentId: "axia", cle: "derniere_detection" } };
    const derniere = await prisma.agentMemory.findUnique({ where: cle, select: { updatedAt: true } });
    if (!derniere || Date.now() - derniere.updatedAt.getTime() > INTERVALLE_DETECTION_MS) {
      await prisma.agentMemory.upsert({
        where: cle,
        create: { tenantId, agentId: "axia", cle: "derniere_detection", valeur: new Date().toISOString() },
        update: { valeur: new Date().toISOString() },
      });
      const langue = await getLangue();
      after(() => detecterConstats(tenantId, langue).catch((err) => console.warn("[axia-constats]", err?.message?.slice(0, 100))));
    }
  }

  const propositions = await prisma.axiaProposition.findMany({
    where: { tenantId, statut: { in: EN_ATTENTE }, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, type: true, message: true, action: true, statut: true, createdAt: true },
  });

  return NextResponse.json({
    propositions: propositions
      .filter((p) => visible(p, droits, complet))
      // Les paramètres techniques d'une confirmation restent côté serveur.
      .map(({ action, ...p }) => {
        const a = action as Action | null;
        return { ...p, action: a?.outil ? { confirmation: true } : a };
      }),
  });
}

const schema = z.object({ id: z.string(), decision: z.enum(["vu", "accepter", "refuser"]) });

export async function PATCH(req: Request) {
  const ctx = await contexte();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { tenantId, droits, complet } = ctx;

  if (!palierAuMoins((await planActif(tenantId)).plan, "palier1")) {
    return NextResponse.json({ error: "AXIA est disponible à partir du Palier Pro." }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  const { id, decision } = parsed.data;

  const p = await prisma.axiaProposition.findFirst({ where: { id, tenantId } });
  if (!p || !visible(p, droits, complet)) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const statut = decision === "vu" ? "vu" : decision === "refuser" ? "refuse" : "accepte";
  // Prise atomique : une confirmation ne peut être exécutée qu'une seule fois (double clic, deux onglets).
  const pris = await prisma.axiaProposition.updateMany({ where: { id, statut: { in: EN_ATTENTE } }, data: { statut } });
  if (!pris.count) return NextResponse.json({ error: "Déjà traité" }, { status: 409 });

  const action = p.action as Action | null;
  if (p.type !== "confirmation" || decision !== "accepter" || !action?.outil) return NextResponse.json({ ok: true });

  let r: { succes: boolean; resultat: string };
  try {
    if (action.agent) {
      r = await executerOutilAgent(action.agent, tenantId, action.outil, action.args ?? {});
    } else {
      // Revérifié au moment de l'exécution : droits et plan ont pu changer depuis la demande.
      const { plan } = await planActif(tenantId);
      const permis = outilAutorise(action.outil, droits) && filtrerOutilsParPalier(AXIA_TOOLS, plan).some((o) => o.name === action.outil);
      r = permis
        ? await executerOutilDirect(action.outil, action.args ?? {}, tenantId)
        : { succes: false, resultat: "Action non autorisée pour ton rôle ou ton plan." };
    }
  } catch (err: any) {
    r = { succes: false, resultat: `L'action a échoué : ${err?.message?.slice(0, 150) ?? "erreur inconnue"}` };
  }

  await prisma.axiaProposition.update({ where: { id }, data: { statut: r.succes ? "execute" : "echec", resultat: r.resultat.slice(0, 2000) } });
  await logDecision(tenantId, "axia", "action_autorisee", p.message, { outil: action.outil, args: action.args, succes: r.succes }).catch(() => {});

  return NextResponse.json({ ok: true, succes: r.succes, resultat: r.resultat.slice(0, 300) });
}
