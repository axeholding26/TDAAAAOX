import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hash } from "bcryptjs";
import { z } from "zod";

const schemaLivreur = z.object({
  nom: z.string().min(2),
  email: z.string().email(),
  telephone: z.string().min(8),
  password: z.string().min(6),
  vehicule: z.enum(["moto", "voiture", "velo", "a_pied"]).default("moto"),
  zone: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

  const livreurs = await prisma.livreur.findMany({
    where: { tenantId },
    include: {
      user: { select: { email: true, name: true } },
      _count: { select: { commandes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ livreurs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  const role = (session.user as any)?.role;
  if (!tenantId || role !== "owner") {
    return NextResponse.json({ error: "Réservé au propriétaire" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = schemaLivreur.parse(body);

    const emailExiste = await prisma.user.findUnique({ where: { email: data.email } });
    if (emailExiste) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
    }

    const { livreur } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.nom,
          email: data.email,
          password: await hash(data.password, 10),
          tenantId,
          role: "livreur",
        },
      });

      const livreur = await tx.livreur.create({
        data: {
          userId: user.id,
          tenantId,
          nom: data.nom,
          telephone: data.telephone,
          vehicule: data.vehicule,
          zone: data.zone,
        },
      });

      return { livreur };
    });

    return NextResponse.json({ success: true, livreur }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: err.issues }, { status: 400 });
    }
    console.error("[API/LIVREURS] POST:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
