// Agent Clients — segmentation, analyse comportementale, relance personnalisée
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { runAgent, type AgentTool, type ToolExecutor } from "@/lib/agent-runner";
import { z } from "zod";

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
});

const PROMPT = `Tu es l'Agent Clients d'Axso, spécialiste CRM et fidélisation pour l'e-commerce africain.
Tu analyses la base clients pour identifier des opportunités de croissance et automatiser la relation client.

Tes capacités :
- Segmenter les clients (VIP, actifs, inactifs, nouveaux)
- Identifier les clients à risque de churn et les meilleurs clients
- Envoyer des emails personnalisés de relance ou de fidélisation
- Analyser les comportements d'achat et proposer des actions

Workflow recommandé :
1. Commence par lire_stats_clients pour avoir une vue d'ensemble
2. Identifie les segments prioritaires
3. Propose et exécute des actions de relance ou fidélisation

Approche : personnalisation maximale, messages en français adapté à la culture locale.`;

const OUTILS: AgentTool[] = [
  {
    name: "lire_stats_clients",
    description: "Vue d'ensemble de la base clients : totaux, dépenses moyennes, segments",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "lister_clients",
    description: "Liste les clients avec filtres de segmentation",
    parameters: {
      type: "object" as const,
      properties: {
        tri: { type: "string", enum: ["depense_desc", "commandes_desc", "recent"], description: "Ordre de tri" },
        limite: { type: "number", description: "Nombre max de clients (défaut 20)" },
      },
      required: [],
    },
  },
  {
    name: "identifier_clients_inactifs",
    description: "Trouve les clients n'ayant pas commandé depuis N jours",
    parameters: {
      type: "object" as const,
      properties: {
        jours: { type: "number", description: "Nombre de jours d'inactivité (ex: 30, 60, 90)" },
      },
      required: ["jours"],
    },
  },
  {
    name: "identifier_meilleurs_clients",
    description: "Top clients par chiffre d'affaires généré",
    parameters: {
      type: "object" as const,
      properties: {
        limite: { type: "number", description: "Nombre de clients VIP à retourner" },
        seuilMinDepense: { type: "number", description: "Dépense minimum pour être VIP" },
      },
      required: [],
    },
  },
  {
    name: "envoyer_email_client",
    description: "Envoie un email personnalisé à un ou plusieurs clients",
    parameters: {
      type: "object" as const,
      properties: {
        destinataires: { type: "string", enum: ["tous", "inactifs_30j", "inactifs_60j", "vip", "nouveaux"], description: "Segment cible" },
        sujet: { type: "string", description: "Sujet de l'email" },
        html: { type: "string", description: "Corps HTML de l'email. Utilise {{nom}} pour personnaliser." },
      },
      required: ["destinataires", "sujet", "html"],
    },
  },
  {
    name: "lire_historique_client",
    description: "Lit le profil complet et l'historique des commandes d'un client",
    parameters: {
      type: "object" as const,
      properties: {
        clientId: { type: "string", description: "ID du client" },
      },
      required: ["clientId"],
    },
  },
];

const executeOutil: ToolExecutor = async (nom, args, tenantId) => {
  try {
    switch (nom) {
      case "lire_stats_clients": {
        const [total, topClient, depenseTotal, nouveaux30j] = await Promise.all([
          prisma.client.count({ where: { tenantId } }),
          prisma.client.findFirst({ where: { tenantId }, orderBy: { totalDepense: "desc" }, select: { nom: true, totalDepense: true } }),
          prisma.client.aggregate({ where: { tenantId }, _sum: { totalDepense: true }, _avg: { totalDepense: true } }),
          prisma.client.count({ where: { tenantId, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
        ]);
        const devise = (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { devise: true } }))?.devise || "XOF";
        return {
          succes: true,
          resultat: JSON.stringify({
            total_clients: total,
            nouveaux_30j: nouveaux30j,
            depense_totale: depenseTotal._sum.totalDepense ?? 0,
            depense_moyenne: Math.round(depenseTotal._avg.totalDepense ?? 0),
            meilleur_client: topClient,
            devise,
          }),
        };
      }

      case "lister_clients": {
        const orderBy: any =
          args.tri === "depense_desc" ? { totalDepense: "desc" }
          : args.tri === "commandes_desc" ? { totalCommandes: "desc" }
          : { createdAt: "desc" };

        const clients = await prisma.client.findMany({
          where: { tenantId },
          orderBy,
          take: args.limite ?? 20,
          select: { id: true, nom: true, email: true, telephone: true, totalCommandes: true, totalDepense: true, createdAt: true, ville: true },
        });
        return { succes: true, resultat: JSON.stringify(clients) };
      }

      case "identifier_clients_inactifs": {
        const limite = new Date(Date.now() - args.jours * 86400000);
        const clientsInactifs = await prisma.client.findMany({
          where: { tenantId, createdAt: { lt: limite }, totalCommandes: { gt: 0 } },
          select: { id: true, nom: true, email: true, totalCommandes: true, totalDepense: true },
          take: 30,
        });
        return { succes: true, resultat: `${clientsInactifs.length} clients inactifs depuis ${args.jours}j : ${JSON.stringify(clientsInactifs.slice(0, 5))}` };
      }

      case "identifier_meilleurs_clients": {
        const clients = await prisma.client.findMany({
          where: {
            tenantId,
            totalDepense: { gte: args.seuilMinDepense ?? 0 },
          },
          orderBy: { totalDepense: "desc" },
          take: args.limite ?? 10,
          select: { id: true, nom: true, email: true, totalCommandes: true, totalDepense: true },
        });
        return { succes: true, resultat: JSON.stringify(clients) };
      }

      case "envoyer_email_client": {
        const resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) return { succes: false, resultat: "RESEND_API_KEY manquante" };

        let whereClients: any = { tenantId };
        if (args.destinataires === "inactifs_30j") {
          whereClients.createdAt = { lt: new Date(Date.now() - 30 * 86400000) };
        } else if (args.destinataires === "inactifs_60j") {
          whereClients.createdAt = { lt: new Date(Date.now() - 60 * 86400000) };
        } else if (args.destinataires === "vip") {
          const depenseMoy = await prisma.client.aggregate({ where: { tenantId }, _avg: { totalDepense: true } });
          whereClients.totalDepense = { gte: (depenseMoy._avg.totalDepense ?? 0) * 2 };
        } else if (args.destinataires === "nouveaux") {
          whereClients.createdAt = { gte: new Date(Date.now() - 7 * 86400000) };
        }

        const clients = await prisma.client.findMany({ where: whereClients, select: { email: true, nom: true }, take: 50 });
        if (!clients.length) return { succes: false, resultat: "Aucun client dans ce segment" };

        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { nomBoutique: true } });
        const resend = new Resend(resendKey);
        let envoyes = 0;

        for (const client of clients) {
          try {
            await resend.emails.send({
              from: `${tenant?.nomBoutique} <onboarding@resend.dev>`,
              to: client.email,
              subject: args.sujet,
              html: args.html.replace(/\{\{nom\}\}/g, client.nom),
            });
            envoyes++;
          } catch { /* continue */ }
        }
        return { succes: true, resultat: `✅ ${envoyes}/${clients.length} emails envoyés au segment "${args.destinataires}"` };
      }

      case "lire_historique_client": {
        const client = await prisma.client.findFirst({
          where: { id: args.clientId, tenantId },
          include: {
            commandes: {
              orderBy: { createdAt: "desc" },
              take: 5,
              select: { numero: true, montantTotal: true, statut: true, devise: true, createdAt: true },
            },
          },
        });
        if (!client) return { succes: false, resultat: "Client introuvable" };
        return { succes: true, resultat: JSON.stringify(client) };
      }

      default:
        return { succes: false, resultat: `Outil inconnu: ${nom}` };
    }
  } catch (err: any) {
    return { succes: false, resultat: `Erreur: ${err.message}` };
  }
};

// Exporté pour l'exécution autonome (lib/agent-consumer.ts)
export { PROMPT, OUTILS, executeOutil };

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ message: "Boutique introuvable" }, { status: 404 });

    const { messages } = schema.parse(await request.json());
    const result = await runAgent(PROMPT, messages, OUTILS, tenantId, executeOutil);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ message: "Format invalide" }, { status: 400 });
    console.error("[AGENT/CLIENTS]", err);
    return NextResponse.json({ message: "Erreur agent clients" }, { status: 500 });
  }
}
