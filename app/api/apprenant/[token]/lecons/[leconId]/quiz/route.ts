import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { delivrerCertificatSiEligible, leconOuverte, marquerTerminee, noterActivite, parcoursOuRefus, refusVerrou } from "@/lib/formation/parcours";
import { correctionVisible, corrigerQuiz, type Question } from "@/lib/formation/regles";

type Ctx = { params: Promise<{ token: string; leconId: string }> };

const corps = z.object({
  reponses: z.record(z.string().max(40), z.union([z.number().int().min(0).max(9), z.array(z.number().int().min(0).max(9)).max(10), z.string().max(500), z.null()])),
});

// POST — soumission d'un quiz : correction côté serveur, tentative enregistrée (historique).
// Les bonnes réponses ne sont renvoyées qu'une fois le quiz réussi ou les tentatives épuisées.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { token, leconId } = await params;
  const p = await parcoursOuRefus(req, token);
  if (p instanceof NextResponse) return p;
  const trouve = leconOuverte(p, leconId);
  if (!trouve || trouve.lecon.type !== "quiz") return NextResponse.json({ error: "Quiz introuvable" }, { status: 404 });
  const refus = refusVerrou(trouve.verrou);
  if (refus) return refus;
  const parse = corps.safeParse(await req.json().catch(() => null));
  if (!parse.success) return NextResponse.json({ error: "Réponses invalides" }, { status: 400 });

  const quiz = await prisma.quizLecon.findUnique({ where: { leconId } });
  if (!quiz) return NextResponse.json({ error: "Quiz introuvable" }, { status: 404 });
  const questions = quiz.questions as Question[];

  const faites = await prisma.tentativeQuiz.count({ where: { quizId: quiz.id, apprenant: p.apprenant } });
  if (quiz.tentativesMax && faites >= quiz.tentativesMax) return NextResponse.json({ error: "Plus de tentative disponible pour ce quiz" }, { status: 409 });

  const { score, reussi, details } = corrigerQuiz(questions, parse.data.reponses, quiz.noteMin);
  await prisma.tentativeQuiz.create({
    data: { quizId: quiz.id, leconId, produitId: p.acces.produitId, apprenant: p.apprenant, commandeId: p.acces.commandeId, reponses: parse.data.reponses, score, reussi },
  });
  const restantes = quiz.tentativesMax ? quiz.tentativesMax - faites - 1 : null;

  let certificat: string | null = null;
  if (reussi) {
    await marquerTerminee(p, leconId);
    p.quizReussis.add(leconId);
    const c = await delivrerCertificatSiEligible(p);
    certificat = c && !c.revoqueAt ? c.code : null;
  }
  await noterActivite(p, leconId);
  return NextResponse.json({
    score, reussi, noteMin: quiz.noteMin, tentativesRestantes: restantes, certificat,
    correction: correctionVisible(questions, details, reussi || restantes === 0),
  });
}
