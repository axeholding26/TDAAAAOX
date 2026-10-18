import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parcoursOuRefus } from "@/lib/formation/parcours";

type Ctx = { params: Promise<{ token: string }> };

const texteBrut = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// GET ?q= — recherche dans les titres et le texte des leçons OUVERTES de ce cours
// (le texte d'une leçon verrouillée n'est jamais cherché, donc jamais divulgué en extrait).
export async function GET(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const p = await parcoursOuRefus(req, token);
  if (p instanceof NextResponse) return p;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ resultats: [] });

  const ouvertes = p.leconIds.filter((id) => p.verrous.get(id)?.ouvert);
  const lecons = ouvertes.length
    ? await prisma.lecon.findMany({
        where: { id: { in: ouvertes }, OR: [{ titre: { contains: q, mode: "insensitive" } }, { contenu: { contains: q, mode: "insensitive" } }] },
        select: { id: true, titre: true, contenu: true },
        take: 30,
      })
    : [];
  const bas = q.toLowerCase();
  return NextResponse.json({
    resultats: lecons.map((l) => {
      const t = texteBrut(l.contenu ?? "");
      const i = t.toLowerCase().indexOf(bas);
      return { id: l.id, titre: l.titre, extrait: i >= 0 ? `${i > 40 ? "…" : ""}${t.slice(Math.max(0, i - 40), i + 80)}…` : null };
    }),
  });
}
