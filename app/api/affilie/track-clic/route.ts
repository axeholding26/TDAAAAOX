import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiLimiter, getClientIp } from "@/lib/rate-limit";

// Clic sur un lien de parrainage B2C (?ref=CODE) — incrémente le compteur
// rapide Affilie.clics et journalise un événement daté pour les graphiques
// jour par jour du portail affilié. Best-effort : jamais bloquant.
export async function POST(req: NextRequest) {
  try {
    // Public : limité pour qu'on ne gonfle pas les clics d'un affilié.
    if (!apiLimiter.check(getClientIp(req)).success) return NextResponse.json({ ok: false });
    const { code } = await req.json();
    if (!code || typeof code !== "string") return NextResponse.json({ ok: false });

    const affilie = await prisma.affilie.findUnique({ where: { codeParrainage: code }, select: { id: true, statut: true } });
    if (!affilie || affilie.statut !== "actif") return NextResponse.json({ ok: false });

    await prisma.$transaction([
      prisma.affilie.update({ where: { id: affilie.id }, data: { clics: { increment: 1 } } }),
      prisma.affilieClic.create({ data: { affilieId: affilie.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
