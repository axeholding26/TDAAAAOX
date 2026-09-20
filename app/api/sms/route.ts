// API Campagnes SMS — Africa's Talking (panafricain, free sandbox)
// Inscription : https://africastalking.com
// Sandbox gratuit pour tests, production nécessite rechargement

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schemaSMS = z.object({
  nom: z.string().min(2),
  message: z.string().min(1).max(160),
  segment: z.enum(["tous", "vip", "inactifs", "nouveaux"]).default("tous"),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const campagnes = await prisma.campagneSMS.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ campagnes });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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

    // Vérifier si Africa's Talking est configuré
    const atKey = process.env.AFRICASTALKING_KEY;
    const atUsername = process.env.AFRICASTALKING_USERNAME;

    let nbEnvoyes = 0;
    let erreurEnvoi = "";

    if (atKey && atUsername && clientsAvecTel.length > 0) {
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
    } else {
      // Mode simulation (pas de clé AT)
      nbEnvoyes = clientsAvecTel.length;
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

    const modeSimu = !atKey || !atUsername;

    return NextResponse.json({
      campagne,
      message: modeSimu
        ? `✅ Campagne enregistrée (${nbEnvoyes} clients ciblés). Ajoutez AFRICASTALKING_KEY pour les envois réels.`
        : `✅ ${nbEnvoyes} SMS envoyés${erreurEnvoi ? ` (quelques erreurs: ${erreurEnvoi})` : ""}`,
      simulation: modeSimu,
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ message: "Données invalides" }, { status: 400 });
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
