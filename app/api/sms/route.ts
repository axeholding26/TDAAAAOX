// API Campagnes SMS — Africa's Talking (panafricain, free sandbox)
// Inscription : https://africastalking.com
// Sandbox gratuit pour tests, production nécessite rechargement

import { NextRequest, NextResponse } from "next/server";
import { integrationActive, BIENTOT_DISPONIBLE } from "@/lib/integrations";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schemaSMS = z.object({
  nom: z.string().min(2),
  message: z.string().min(1).max(160),
  segment: z.enum(["tous", "vip", "inactifs", "nouveaux"]).default("tous"),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const campagnes = await prisma.campagneSMS.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ campagnes, disponible: integrationActive("sms") });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Aucun prestataire SMS branché : on ne crée pas une campagne « envoyée » qui ne part pas.
    if (!integrationActive("sms")) return NextResponse.json({ message: BIENTOT_DISPONIBLE }, { status: 503 });
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const { nom, message, segment } = schemaSMS.parse(await req.json());

    // Récupérer les clients selon le segment
    let where: any = { tenantId };
    if (segment === "vip") {
      const agg = await prisma.client.aggregate({ where: { tenantId }, _avg: { totalDepense: true } });
      where.totalDepense = { gte: (agg._avg.totalDepense ?? 0) * 2 };
    } else if (segment === "inactifs") {
      where.createdAt = { lt: new Date(Date.now() - 30 * 86400000) };
    } else if (segment === "nouveaux") {
      where.createdAt = { gte: new Date(Date.now() - 7 * 86400000) };
    }

    const clients = await prisma.client.findMany({
      where,
      select: { telephone: true, nom: true },
      take: 500,
    });

    const clientsAvecTel = clients.filter(c => c.telephone && c.telephone.trim());

    // Renseignées : integrationActive("sms") l'a vérifié plus haut.
    const atKey = process.env.AFRICASTALKING_KEY!;
    const atUsername = process.env.AFRICASTALKING_USERNAME!;

    let nbEnvoyes = 0;
    let erreurEnvoi = "";

    if (clientsAvecTel.length > 0) {
      // Appel Africa's Talking API
      try {
        const baseUrl = atUsername === "sandbox"
          ? "https://api.sandbox.africastalking.com/version1/messaging"
          : "https://api.africastalking.com/version1/messaging";

        for (const client of clientsAvecTel.slice(0, 50)) {
          const smsPerso = message.replace(/\{\{nom\}\}/g, client.nom.split(" ")[0]);
          const formData = new URLSearchParams({
            username: atUsername,
            to: client.telephone!,
            message: smsPerso,
          });

          const res = await fetch(baseUrl, {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/x-www-form-urlencoded",
              "apiKey": atKey,
            },
            body: formData,
          });

          if (res.ok) nbEnvoyes++;
        }
      } catch (err: any) {
        erreurEnvoi = err.message;
      }
    }

    // Sauvegarder la campagne
    const campagne = await prisma.campagneSMS.create({
      data: {
        tenantId, nom, message, segment,
        nbEnvoyes,
        nbLivres: nbEnvoyes,
        statut: "envoye",
      },
    });

    return NextResponse.json({
      campagne,
      message: `✅ ${nbEnvoyes} SMS envoyés${erreurEnvoi ? ` (quelques erreurs: ${erreurEnvoi})` : ""}`,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ message: "Données invalides" }, { status: 400 });
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
