import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  nom: z.string().min(2),
  email: z.string().email(),
  telephone: z.string().min(8),
  password: z.string().min(6),
  vehicule: z.enum(["moto", "voiture", "velo", "a_pied"]).default("moto"),
  zone: z.string().optional(),
  ville: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const existe = await prisma.user.findUnique({ where: { email: data.email } });
    if (existe) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
    }

    const { livreur } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.nom,
          email: data.email,
          password: await hash(data.password, 10),
          role: "livreur",
        },
      });

      const livreur = await tx.livreur.create({
        data: {
          userId: user.id,
          nom: data.nom,
          telephone: data.telephone,
          vehicule: data.vehicule,
          zone: data.zone || data.ville || null,
          disponible: true,
          actif: true,
        },
      });

      return { livreur };
    });

    return NextResponse.json({ success: true, livreurId: livreur.id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[API/LIVREURS/INSCRIPTION]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
