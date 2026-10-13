// Assistant AXSO Sourcing (lib/sourcing/assistant.ts) : une question du marchand,
// une réponse, des cartes chiffrées et des actions à confirmer.
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasGemini } from "@/lib/llm-client";
import { runAxia } from "@/lib/axia/engine";
import { requireNiveau } from "@/lib/permissions-server";
import { aiLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { accesSourcing, contexteCalcul, erreur, reponseErreur } from "@/lib/sourcing/acces";
import { OUTILS_ASSISTANT, executeurAssistant, promptAssistant, type SessionAssistant } from "@/lib/sourcing/assistant";

export const maxDuration = 60;

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) })).min(1).max(24),
  dossierId: z.string().max(64).nullish(),
});

/** L'IA est-elle branchée ? Sans elle, la page garde ses blocs de calcul et de suivi. */
export async function GET() {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  return NextResponse.json({ iaDisponible: hasGemini() });
}

export async function POST(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  if (!hasGemini()) return erreur("L'assistant est momentanément indisponible. Le calcul rapide et le suivi des commandes, plus bas, fonctionnent sans lui.", 503);
  const rl = aiLimiter.check(`${acces.tenantId}:${getClientIp(req)}`);
  if (!rl.success) return rateLimitResponse(rl.reset);
  try {
    const { messages, dossierId } = schema.parse(await req.json());
    if (messages[messages.length - 1].role !== "user") return erreur("Le dernier message doit être le vôtre.");
    const [tenant, ctx, dossier, refusCommandes] = await Promise.all([
      prisma.tenant.findUniqueOrThrow({ where: { id: acces.tenantId }, select: { nomBoutique: true, commissionRate: true } }),
      contexteCalcul(acces.tenantId),
      dossierId ? prisma.produitSource.findFirst({ where: { id: dossierId, tenantId: acces.tenantId }, select: { id: true, nom: true } }) : null,
      requireNiveau(await auth(), "commandes", "lecture"),
    ]);
    const session: SessionAssistant = { acces, commandes: !refusCommandes, dossierId: dossier?.id ?? null, cartes: [], propositions: [] };
    const prompt = promptAssistant(ctx, tenant.commissionRate, tenant.nomBoutique)
      + (dossier ? `\n\nDOSSIER OUVERT À L'ÉCRAN : ${dossier.nom} [id ${dossier.id}]. « Ce produit », « il », « le » désignent ce dossier.` : "\n\nAucun dossier n'est ouvert à l'écran.");
    const { reponse } = await runAxia(prompt, messages, OUTILS_ASSISTANT, acces.tenantId, executeurAssistant(session, tenant.commissionRate), { maxIterations: 5, toolDeadlineMs: 40_000, synthesisDeadlineMs: 15_000 });
    // La conversation affiche du texte brut : les marques de gras que le modèle glisse malgré la consigne sont retirées.
    return NextResponse.json({ reponse: reponse.replace(/\*\*/g, ""), cartes: session.cartes, propositions: session.propositions, dossierId: session.dossierId });
  } catch (e) {
    return reponseErreur(e);
  }
}
