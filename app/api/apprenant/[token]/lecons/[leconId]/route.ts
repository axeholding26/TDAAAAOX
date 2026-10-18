import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { delivrerCertificatSiEligible, leconOuverte, marquerTerminee, noterActivite, parcoursOuRefus, refusVerrou } from "@/lib/formation/parcours";
import { questionsPubliques, type Question } from "@/lib/formation/regles";

type Ctx = { params: Promise<{ token: string; leconId: string }> };

// GET — contenu d'UNE leçon ouverte (chargée à la demande : rien d'inutile sur une connexion lente,
// et le contenu d'une leçon verrouillée ne quitte jamais le serveur).
export async function GET(req: NextRequest, { params }: Ctx) {
  const { token, leconId } = await params;
  const p = await parcoursOuRefus(req, token);
  if (p instanceof NextResponse) return p;
  const trouve = leconOuverte(p, leconId);
  if (!trouve) return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
  const refus = refusVerrou(trouve.verrou);
  if (refus) return refus;

  const [lecon, progression, tentatives, rendu] = await Promise.all([
    prisma.lecon.findUnique({
      where: { id: leconId },
      select: {
        id: true, titre: true, type: true, contenu: true, videoType: true, videoUrl: true, audioUrl: true, duree: true,
        ressources: { orderBy: { ordre: "asc" }, select: { id: true, nom: true, mime: true, taille: true } },
        quiz: { select: { noteMin: true, tentativesMax: true, questions: true } },
      },
    }),
    prisma.progressionLecon.findUnique({ where: { leconId_clientEmail: { leconId, clientEmail: p.apprenant } }, select: { complete: true, position: true, favori: true, note: true } }),
    prisma.tentativeQuiz.findMany({ where: { leconId, apprenant: p.apprenant }, orderBy: { createdAt: "desc" }, take: 20, select: { score: true, reussi: true, createdAt: true } }),
    prisma.renduDevoir.findUnique({ where: { leconId_apprenant: { leconId, apprenant: p.apprenant } }, select: { texte: true, statut: true, note: true, feedback: true, updatedAt: true } }),
  ]);
  if (!lecon) return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
  await noterActivite(p, leconId);

  const { quiz, ...reste } = lecon;
  return NextResponse.json({
    lecon: reste,
    progression: progression ?? { complete: false, position: null, favori: false, note: null },
    quiz: quiz && lecon.type === "quiz" ? {
      noteMin: quiz.noteMin, tentativesMax: quiz.tentativesMax, tentatives,
      questions: questionsPubliques(quiz.questions as Question[]), // sans les bonnes réponses
    } : null,
    devoir: lecon.type === "devoir" ? rendu : null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("terminer") }),
  z.object({ action: z.literal("position"), position: z.number().int().min(0).max(86_400) }),
  z.object({ action: z.literal("favori"), favori: z.boolean() }),
  z.object({ action: z.literal("note"), note: z.string().max(20_000) }),
]);

// POST — progression : terminer, position de reprise, favori, notes personnelles.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { token, leconId } = await params;
  const p = await parcoursOuRefus(req, token);
  if (p instanceof NextResponse) return p;
  const trouve = leconOuverte(p, leconId);
  if (!trouve) return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
  const refus = refusVerrou(trouve.verrou);
  if (refus) return refus;
  const parse = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parse.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const a = parse.data;

  if (a.action === "terminer") {
    // Un quiz se termine en le réussissant, un devoir en le rendant : pas de raccourci.
    if (trouve.lecon.type === "quiz") return NextResponse.json({ error: "Réussis le quiz pour terminer cette leçon" }, { status: 409 });
    if (trouve.lecon.type === "devoir") return NextResponse.json({ error: "Rends le devoir pour terminer cette leçon" }, { status: 409 });
    await marquerTerminee(p, leconId);
    await noterActivite(p, leconId);
    const certificat = await delivrerCertificatSiEligible(p);
    return NextResponse.json({ ok: true, certificat: certificat && !certificat.revoqueAt ? certificat.code : null });
  }

  const data = a.action === "position" ? { position: a.position } : a.action === "favori" ? { favori: a.favori } : { note: a.note.trim() || null };
  await prisma.progressionLecon.upsert({
    where: { leconId_clientEmail: { leconId, clientEmail: p.apprenant } },
    create: { leconId, commandeId: p.acces.commandeId, clientEmail: p.apprenant, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true });
}
