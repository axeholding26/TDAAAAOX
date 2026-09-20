import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { genererFaqProduit } from "@/lib/gemini";
import { z } from "zod";

const schema = z.object({
  nom: z.string().min(1),
  description: z.string().default(""),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await req.json();
    const { nom, description } = schema.parse(body);

    const faq = await genererFaqProduit(nom, description);
    return NextResponse.json({ faq });
  } catch (err) {
    console.error("[api/ai/faq]", err);
    return NextResponse.json({ error: "Erreur génération FAQ" }, { status: 500 });
  }
}
