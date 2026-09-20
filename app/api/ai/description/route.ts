// API Route — Génération de description produit par IA
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { genererDescriptionProduit } from "@/lib/gemini";
import { z } from "zod";

const schemaDescription = z.object({
  nom: z.string().min(1),
  categorie: z.string().default("Produit"),
  prix: z.number().positive().default(0),
  devise: z.string().default("XOF"),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const data = schemaDescription.parse(body);

    const description = await genererDescriptionProduit(
      data.nom,
      data.categorie,
      data.prix,
      data.devise
    );

    return NextResponse.json({ description });
  } catch (err) {
    if ((err as any)?.message?.includes("GEMINI_API_KEY")) {
      return NextResponse.json({
        description: "Un produit exceptionnel qui saura séduire vos clients. Qualité irréprochable et authenticité africaine garanties.",
      });
    }
    return NextResponse.json({ message: "Erreur génération" }, { status: 500 });
  }
}
