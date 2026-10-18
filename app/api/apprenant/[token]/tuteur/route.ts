// Tuteur IA de l'apprenant : répond uniquement à partir des leçons ouvertes de SON parcours
// (lib/academie/tuteur.ts). Jeton contrôlé par parcoursOuRefus, puis limite par apprenant.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parcoursOuRefus } from "@/lib/formation/parcours";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { repondre } from "@/lib/academie/tuteur";

export const maxDuration = 30;
type Ctx = { params: Promise<{ token: string }> };

const limiteTuteur = rateLimit({ windowMs: 60_000, max: 6, keyPrefix: "tuteur" });
const limiteJour = rateLimit({ windowMs: 86_400_000, max: 60, keyPrefix: "tuteur-jour" });
const schema = z.object({
  question: z.string().trim().min(2).max(800),
  mode: z.enum(["question", "indice", "resume", "exercices"]).default("question"),
  leconId: z.string().max(40).optional(),
});

export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const p = await parcoursOuRefus(req, token);
  if (p instanceof NextResponse) return p;
  for (const l of [limiteTuteur, limiteJour]) {
    const rl = l.check(p.acces.id);
    if (!rl.success) return rateLimitResponse(rl.reset);
  }
  const d = schema.safeParse(await req.json().catch(() => null));
  if (!d.success) return NextResponse.json({ error: "Question invalide" }, { status: 400 });
  try {
    const { cout, ...r } = await repondre(p, d.data);
    return NextResponse.json(r);
  } catch (e: any) {
    console.error("[tuteur]", e?.message);
    return NextResponse.json({ error: "Le tuteur est momentanément indisponible." }, { status: 503 });
  }
}
