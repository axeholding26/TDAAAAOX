// Ask Axso : question → réponse calculée sur le contexte (filtres de l'URL).
import { NextResponse, type NextRequest } from "next/server";
import { contexteApi } from "@/lib/command-center/serveur";
import { repondre } from "@/lib/command-center/copilote";
import { getT } from "@/lib/i18n/serveur";

export async function POST(req: NextRequest) {
  const c = await contexteApi("cc", req);
  if (c instanceof NextResponse) return c;
  const corps = await req.json().catch(() => null) as { question?: unknown } | null;
  const question = typeof corps?.question === "string" ? corps.question.trim().slice(0, 300) : "";
  if (question.length < 2) return NextResponse.json({ erreur: "Question vide" }, { status: 400 });
  return NextResponse.json(repondre(c, question, await getT()));
}
