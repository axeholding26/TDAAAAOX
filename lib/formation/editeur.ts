// Champs pédagogiques modifiables par le formateur (dashboard), validés côté serveur.
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { quizSchema } from "./regles";

const commun = {
  statut: z.enum(["brouillon", "publie", "archive"]).optional(),
  prerequis: z.array(z.string().max(40)).max(50).optional(),
  dripJours: z.number().int().min(0).max(3650).nullable().optional(),
  dripDate: z.coerce.date().nullable().optional(),
};

export const chapitrePedagogie = z.object(commun);

export const leconPedagogie = z.object({
  ...commun,
  quiz: quizSchema.nullable().optional(),
  ressources: z.array(z.object({
    nom: z.string().trim().min(1).max(200),
    url: z.string().url().max(2000).refine((u) => u.startsWith("https://"), "Adresse https requise"),
    mime: z.string().max(120).nullable().optional(),
    taille: z.number().int().min(0).nullable().optional(),
  })).max(30).optional(),
});

/** Ne garde que les prérequis qui appartiennent à la même formation (et pas l'élément lui-même). */
export async function prerequisValides(type: "lecon" | "chapitre", ids: string[], formationId: string, soi?: string) {
  const uniques = [...new Set(ids)].filter((id) => id !== soi);
  if (!uniques.length) return [];
  const trouves = type === "chapitre"
    ? await prisma.chapitre.findMany({ where: { id: { in: uniques }, formationId }, select: { id: true } })
    : await prisma.lecon.findMany({ where: { id: { in: uniques }, chapitre: { formationId } }, select: { id: true } });
  return trouves.map((t) => t.id);
}

/** Applique statut / prérequis / drip (+ quiz et ressources pour une leçon). `body` déjà validé. */
export async function appliquerPedagogie(
  cible: { type: "chapitre" | "lecon"; id: string; formationId: string },
  body: z.infer<typeof leconPedagogie>,
) {
  const data: Prisma.ChapitreUpdateInput & Prisma.LeconUpdateInput = {};
  if (body.statut) data.statut = body.statut;
  if (body.prerequis) data.prerequis = await prerequisValides(cible.type, body.prerequis, cible.formationId, cible.id);
  if (body.dripJours !== undefined) data.dripJours = body.dripJours || null;
  if (body.dripDate !== undefined) data.dripDate = body.dripDate;
  if (cible.type === "chapitre") {
    if (Object.keys(data).length) await prisma.chapitre.update({ where: { id: cible.id }, data });
    return;
  }
  if (Object.keys(data).length) await prisma.lecon.update({ where: { id: cible.id }, data });
  if (body.quiz === null) await prisma.quizLecon.deleteMany({ where: { leconId: cible.id } });
  else if (body.quiz) {
    // Mise à jour en place : l'historique des tentatives est conservé.
    const q = { noteMin: body.quiz.noteMin, tentativesMax: body.quiz.tentativesMax, questions: body.quiz.questions };
    await prisma.quizLecon.upsert({ where: { leconId: cible.id }, create: { leconId: cible.id, ...q }, update: q });
  }
  if (body.ressources) {
    await prisma.$transaction([
      prisma.ressourceLecon.deleteMany({ where: { leconId: cible.id } }),
      prisma.ressourceLecon.createMany({ data: body.ressources.map((r, i) => ({ leconId: cible.id, nom: r.nom, url: r.url, mime: r.mime ?? null, taille: r.taille ?? null, ordre: i })) }),
    ]);
  }
}

/** Formation de la boutique connectée, ou null (sans boutique, ou produit d'une autre boutique). */
export async function formationDuMarchand(produitId: string) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  const userId = (session?.user as any)?.id as string | undefined;
  if (!tenantId) return null;
  const formation = await prisma.formation.findFirst({ where: { produitId, produit: { tenantId } }, select: { id: true, produitId: true } });
  return formation ? { ...formation, tenantId, userId: userId ?? null } : null;
}
