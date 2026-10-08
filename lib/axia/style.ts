// Style de langage du marchand : déduit de ses propres messages à AXIA, gardé
// en mémoire (AgentMemory) et réutilisé pour que les réponses et les prises de
// parole d'AXIA lui ressemblent (tutoiement, emojis, longueur, expressions).
import { prisma } from "@/lib/prisma";
import { completionAuto } from "@/lib/llm-client";

const AGENT = "axia";
const CLE = "style_langage";
const VALIDITE_MS = 7 * 86_400_000;

export async function lireStyle(tenantId: string): Promise<string> {
  const m = await prisma.agentMemory.findUnique({
    where: { tenantId_agentId_cle: { tenantId, agentId: AGENT, cle: CLE } },
    select: { valeur: true },
  });
  return m?.valeur ?? "";
}

/** Recalcule le profil s'il date de plus d'une semaine et qu'il y a assez de messages. */
export async function rafraichirStyle(tenantId: string): Promise<void> {
  const actuel = await prisma.agentMemory.findUnique({
    where: { tenantId_agentId_cle: { tenantId, agentId: AGENT, cle: CLE } },
    select: { updatedAt: true },
  });
  if (actuel && Date.now() - actuel.updatedAt.getTime() < VALIDITE_MS) return;

  const conversations = await prisma.axiaConversation.findMany({
    where: { tenantId },
    orderBy: { updatedAt: "desc" },
    take: 15,
    select: { messages: true },
  });
  const phrases = conversations
    .flatMap((c) => (Array.isArray(c.messages) ? (c.messages as any[]) : []))
    .filter((m) => m?.role === "user" && typeof m.content === "string" && m.content.trim())
    .map((m) => (m.content as string).slice(0, 300))
    .slice(0, 40);
  if (phrases.length < 5) return;

  try {
    const { text } = await completionAuto([
      {
        role: "system",
        content: "Tu analyses la façon d'écrire d'un commerçant pour qu'une assistante puisse lui parler comme lui. Réponds en 4 lignes maximum, en français, sans préambule : tutoiement ou vouvoiement, langue(s) et mélanges (français, anglais, nouchi, pidgin, wolof…), longueur des phrases, emojis ou non, ton (familier, direct, formel…), expressions ou mots qu'il emploie souvent.",
      },
      { role: "user", content: phrases.map((p) => `- ${p}`).join("\n") },
    ], 300);
    const valeur = text.trim();
    if (!valeur) return;
    await prisma.agentMemory.upsert({
      where: { tenantId_agentId_cle: { tenantId, agentId: AGENT, cle: CLE } },
      create: { tenantId, agentId: AGENT, cle: CLE, valeur },
      update: { valeur },
    });
  } catch (err: any) {
    console.warn("[axia-style]", err?.message?.slice(0, 100));
  }
}

/** Bloc à ajouter aux prompts d'AXIA (vide tant que le profil n'existe pas). */
export function consigneStyle(style: string): string {
  return style
    ? `─── STYLE DU MARCHAND ───\nAdapte ta façon de parler à la sienne (cette consigne prime sur le registre par défaut) :\n${style}`
    : "";
}

/**
 * Langue de réponse = langue choisie sur la plateforme (cookie "langue"), pas celle
 * du prompt système (écrit en français). Placée en fin de prompt pour primer.
 */
export function consigneLangue(langue: "fr" | "en"): string {
  return langue === "en"
    ? `─── LANGUAGE ───
The platform is set to English. Always answer in clear, natural English, even though these instructions are written in French and even if your tools return French text: translate statuses, labels and tool results. Keep proper names, order numbers, product names and amounts exactly as they are.`
    : `─── LANGUE ───
Réponds toujours en français clair, même si l'utilisateur glisse quelques mots d'une autre langue.`;
}
