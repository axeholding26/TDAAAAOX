import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST public — active une clé de licence pour un client
// Body: { cle: string, email: string, appareil?: string, ipAdresse?: string }
export async function POST(req: NextRequest) {
  try {
    const { cle, email, appareil, ipAdresse } = await req.json();
    if (!cle || !email) {
      return NextResponse.json({ error: "cle et email requis" }, { status: 400 });
    }

    const cleLicence = await prisma.cleLicence.findUnique({
      where: { cle },
      include: {
        licenceProduit: true,
        activations: true,
      },
    });

    if (!cleLicence) {
      return NextResponse.json({ error: "Clé invalide" }, { status: 404 });
    }

    if (cleLicence.statut === "revoquee") {
      return NextResponse.json({ error: "Cette clé a été révoquée" }, { status: 403 });
    }

    if (cleLicence.statut === "expiree") {
      return NextResponse.json({ error: "Cette clé a expiré" }, { status: 403 });
    }

    // Vérifier expiration basée sur date
    if (cleLicence.expireAt && cleLicence.expireAt < new Date()) {
      await prisma.cleLicence.update({ where: { id: cleLicence.id }, data: { statut: "expiree" } });
      return NextResponse.json({ error: "Cette clé a expiré" }, { status: 403 });
    }

    const totalActivations = cleLicence.activations.length;
    const maxAct = cleLicence.licenceProduit.maxActivations;

    // Vérifier quota max activations
    if (maxAct && totalActivations >= maxAct) {
      return NextResponse.json({ error: "Nombre maximum d'activations atteint" }, { status: 403 });
    }

    // Créer l'activation
    await prisma.activationLicence.create({
      data: {
        cleId: cleLicence.id,
        appareil: appareil ?? null,
        ipAdresse: ipAdresse ?? req.headers.get("x-forwarded-for") ?? null,
      },
    });

    // Marquer comme vendue si disponible et stocker l'email acheteur
    if (cleLicence.statut === "disponible") {
      await prisma.cleLicence.update({
        where: { id: cleLicence.id },
        data: { statut: "vendue", acheteurEmail: email },
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Clé activée avec succès",
      expireAt: cleLicence.expireAt,
      activationsRestantes: maxAct ? maxAct - totalActivations - 1 : null,
    });
  } catch (err) {
    console.error("[licences/activer POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
