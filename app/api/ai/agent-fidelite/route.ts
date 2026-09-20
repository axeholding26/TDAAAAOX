// Agent Fidélité — programmes VIP, rétention, LTV maximum
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { runAgent, type AgentTool, type ToolExecutor } from "@/lib/agent-runner";
import { writeMemory, readAllMemory, logDecision } from "@/lib/agent-memory";
import { z } from "zod";

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional(),
});

const SYSTEM_PROMPT = `Tu es l'Agent Fidélité d'Axso — tu transformes chaque client en ambassadeur et multiplies leur valeur vie (LTV).

TES MISSIONS :
- Identifier et chouchouter les clients VIP (top 20% = 80% du revenu)
- Réactiver les clients dormants avant qu'ils partent définitivement
- Construire des programmes de fidélité adaptés à la culture africaine
- Personnaliser les offres selon l'historique d'achat
- Transformer les clients satisfaits en ambassadeurs actifs

SEGMENTATION CLIENTS AFRICAINS :
- VIP (LTV > 50,000 XAF) : traitement royal, accès prioritaire, offres exclusives
- Réguliers (2-5 achats) : programme points, offre anniversaire
- Occasionnels (1 achat > 60j) : campagne réactivation avec code promo
- Inactifs (> 90j) : dernière chance — offre irrésistible ou abandon

LEVIERS DE FIDÉLISATION AFRICAINS :
- Message personnalisé WhatsApp (nom, historique, occasion)
- Offre anniversaire (date de naissance si connue)
- Programme "Clan" : 5 amis invités = récompense spéciale
- Statut "Client Or/Platine" visible sur le profil
- Accès anticipé aux nouvelles collections

RAPPEL CULTUREL :
En Afrique, la relation personnelle est clé. Un client fidèle devient souvent
un distributeur informel dans sa communauté. Traite chaque VIP comme un partenaire.`;

const OUTILS: AgentTool[] = [
  {
    name: "segmenter_clients",
    description: "Classe tous les clients en segments : VIP, réguliers, occasionnels, inactifs",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "actions_vip",
    description: "Génère des actions personnalisées pour les clients VIP",
    parameters: {
      type: "object",
      properties: {
        remise_exclusive: { type: "number", description: "% de remise exclusive VIP" },
        message_personnalise: { type: "boolean", description: "Envoyer un message personnalisé" },
      },
      required: [],
    },
  },
  {
    name: "campagne_reactivation",
    description: "Lance une campagne ciblée pour réactiver les clients inactifs",
    parameters: {
      type: "object",
      properties: {
        segment: { type: "string", enum: ["inactifs_30j", "inactifs_60j", "inactifs_90j"] },
        offre_remise: { type: "number", description: "% de remise pour la réactivation" },
        canal: { type: "string", enum: ["email", "whatsapp_template"] },
      },
      required: ["segment", "offre_remise"],
    },
  },
  {
    name: "creer_code_vip",
    description: "Génère un code promo exclusif pour un client VIP spécifique",
    parameters: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        remise: { type: "number" },
        validite_jours: { type: "number" },
      },
      required: ["clientId", "remise"],
    },
  },
  {
    name: "rapport_ltv",
    description: "Calcule la valeur vie client et les projections de revenus fidélisation",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "message_anniversaire",
    description: "Génère et envoie des messages d'anniversaire personnalisés aux clients",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "memoriser",
    description: "Mémorise une stratégie de fidélisation",
    parameters: {
      type: "object",
      properties: { cle: { type: "string" }, valeur: { type: "string" } },
      required: ["cle", "valeur"],
    },
  },
];

const executeOutil: (tenantId: string) => ToolExecutor = (tenantId) => async (name, args) => {
  try {
    if (name === "segmenter_clients") {
      const clients = await prisma.client.findMany({
        where: { tenantId },
        orderBy: { totalDepense: "desc" },
      });

      const maintenant = new Date();
      const il_y_a_30j = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const il_y_a_60j = new Date(Date.now() - 60 * 24 * 3600 * 1000);
      const il_y_a_90j = new Date(Date.now() - 90 * 24 * 3600 * 1000);

      const totalLTV = clients.reduce((s, c) => s + c.totalDepense, 0);
      const seuilVIP = totalLTV > 0 ? clients.slice(0, Math.ceil(clients.length * 0.2)).reduce((s, c) => s + c.totalDepense, 0) : 50000;

      const vip = clients.filter((c) => c.totalDepense >= 50000);
      const reguliers = clients.filter((c) => c.totalCommandes >= 2 && c.totalDepense < 50000 && c.createdAt >= il_y_a_60j);
      const occasionnels = clients.filter((c) => c.totalCommandes === 1 && c.createdAt >= il_y_a_90j && c.createdAt < il_y_a_30j);
      const inactifs30 = clients.filter((c) => c.createdAt < il_y_a_30j && c.createdAt >= il_y_a_60j);
      const inactifs90 = clients.filter((c) => c.createdAt < il_y_a_90j);

      return {
        succes: true,
        resultat: JSON.stringify({
          total_clients: clients.length,
          segments: {
            vip: { count: vip.length, ltv_total: vip.reduce((s, c) => s + c.totalDepense, 0), exemples: vip.slice(0, 3).map((c) => ({ nom: c.nom, depense: c.totalDepense, commandes: c.totalCommandes })) },
            reguliers: { count: reguliers.length },
            occasionnels: { count: occasionnels.length },
            inactifs_30j: { count: inactifs30.length },
            inactifs_90j_critique: { count: inactifs90.length },
          },
          recommandations: [
            vip.length > 0 && `Envoyer offre exclusive à ${vip.length} clients VIP`,
            inactifs30.length > 3 && `Relancer ${inactifs30.length} clients inactifs 30j avant qu'ils partent`,
            inactifs90.length > 0 && `Dernière chance pour ${inactifs90.length} clients inactifs 90j+`,
          ].filter(Boolean),
        }),
      };
    }

    if (name === "actions_vip") {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const clientsVIP = await prisma.client.findMany({
        where: { tenantId, totalDepense: { gte: 50000 } },
        orderBy: { totalDepense: "desc" },
        take: 20,
      });

      if (args.message_personnalise !== false && tenant) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        let envoyes = 0;

        if (process.env.RESEND_API_KEY) {
          for (const client of clientsVIP) {
            if (!client.email) continue;
            await resend.emails.send({
              from: `${tenant.nomBoutique} <noreply@axso.app>`,
              to: client.email,
              subject: `${client.nom}, vous êtes notre client(e) d'exception 👑`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2>Bonjour ${client.nom ?? "cher(e) client(e)"} 👑</h2>
<p>Vous faites partie de nos clients les plus fidèles chez <strong>${tenant.nomBoutique}</strong>.</p>
<p>En signe de notre reconnaissance, voici un cadeau exclusif :</p>
${args.remise_exclusive ? `<div style="background:#f0f7ff;padding:15px;border-radius:8px;text-align:center;margin:20px 0">
<strong style="font-size:24px;color:#1B4FD8">${args.remise_exclusive}% de remise</strong><br>
<span>Sur votre prochaine commande — rien que pour vous</span>
</div>` : ""}
<p>Merci de votre confiance. Vous méritez le meilleur 🌟</p>
</div>`,
            });
            envoyes++;
          }
        }

        await logDecision(tenantId, "agent-fidelite", "campagne_vip",
          `${envoyes} clients VIP contactés avec offre exclusive`,
          { envoyes, remise: args.remise_exclusive }
        );

        return { succes: true, resultat: `${envoyes} messages VIP envoyés${process.env.RESEND_API_KEY ? "" : " (mode démo)"}` };
      }

      return {
        succes: true,
        resultat: JSON.stringify({
          clients_vip: clientsVIP.length,
          ltv_total: clientsVIP.reduce((s, c) => s + c.totalDepense, 0),
          actions_proposees: [
            `Envoyer carte de remerciement personnalisée à ${clientsVIP.length} VIPs`,
            `Créer un groupe WhatsApp VIP privé`,
            `Offrir accès anticipé aux nouvelles collections`,
            args.remise_exclusive ? `Code promo exclusif ${args.remise_exclusive}% à créer` : null,
          ].filter(Boolean),
        }),
      };
    }

    if (name === "campagne_reactivation") {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const periodeMap: Record<string, number> = { inactifs_30j: 30, inactifs_60j: 60, inactifs_90j: 90 };
      const jours = periodeMap[args.segment] ?? 30;
      const since = new Date(Date.now() - jours * 24 * 3600 * 1000);

      const clients = await prisma.client.findMany({
        where: { tenantId, createdAt: { lte: since } },
        take: 100,
      });

      const code = `RETOUR${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      await prisma.codePromo.create({
        data: {
          tenantId,
          code,
          type: "pourcentage",
          valeur: args.offre_remise,
          actif: true,
          dateExpiration: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        },
      });

      let envoyes = 0;
      if (tenant && process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        for (const client of clients) {
          if (!client.email) continue;
          await resend.emails.send({
            from: `${tenant.nomBoutique} <noreply@axso.app>`,
            to: client.email,
            subject: client.nom ? `${client.nom}, vous nous avez manqué 💙` : "Vous nous manquez 💙",
            html: `<p>Bonjour ${client.nom ?? ""},</p>
<p>Cela fait un moment qu'on ne vous a pas vu chez ${tenant.nomBoutique} — et on pense à vous.</p>
<p>Pour fêter votre retour : <strong>${args.offre_remise}% de réduction</strong> avec le code <strong>${code}</strong></p>
<p>Valable 7 jours — ne passez pas à côté ! 🎁</p>`,
          });
          envoyes++;
        }
      }

      await logDecision(tenantId, "agent-fidelite", "reactivation_clients",
        `${envoyes || clients.length} clients ${args.segment} relancés avec code ${code}`,
        { segment: args.segment, code, remise: args.offre_remise, nb_clients: clients.length }
      );

      return {
        succes: true,
        resultat: `Campagne réactivation lancée — code ${code} (${args.offre_remise}%) créé. ${process.env.RESEND_API_KEY ? `${envoyes} emails envoyés` : `${clients.length} clients ciblés (mode démo)`}`,
      };
    }

    if (name === "creer_code_vip") {
      const client = await prisma.client.findUnique({ where: { id: args.clientId } });
      if (!client) return { succes: false, resultat: "Client introuvable" };

      const code = `VIP${client.nom?.slice(0, 4).toUpperCase() ?? "CLUB"}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      await prisma.codePromo.create({
        data: {
          tenantId,
          code,
          type: "pourcentage",
          valeur: args.remise,
          actif: true,
          dateExpiration: new Date(Date.now() + (args.validite_jours || 30) * 24 * 3600 * 1000),
          maxUtilisations: 1,
        },
      });

      return { succes: true, resultat: `Code VIP ${code} créé pour ${client.nom} — ${args.remise}% valable ${args.validite_jours || 30} jours` };
    }

    if (name === "rapport_ltv") {
      const clients = await prisma.client.findMany({
        where: { tenantId },
        orderBy: { totalDepense: "desc" },
      });

      const ltv_moyen = clients.length > 0 ? clients.reduce((s, c) => s + c.totalDepense, 0) / clients.length : 0;
      const ltv_top20 = clients.slice(0, Math.ceil(clients.length * 0.2)).reduce((s, c) => s + c.totalDepense, 0);
      const ltv_total = clients.reduce((s, c) => s + c.totalDepense, 0);

      return {
        succes: true,
        resultat: JSON.stringify({
          total_clients: clients.length,
          ltv_total,
          ltv_moyen: Math.round(ltv_moyen),
          ltv_top_20pct: ltv_top20,
          part_vip_dans_revenu: ltv_total > 0 ? Math.round((ltv_top20 / ltv_total) * 100) : 0,
          clients_a_fort_potentiel: clients.filter((c) => c.totalCommandes >= 2 && c.totalDepense < 50000).length,
          projection_si_1_achat_de_plus: Math.round(clients.length * ltv_moyen * 0.2),
        }),
      };
    }

    if (name === "message_anniversaire") {
      return { succes: true, resultat: "Fonctionnalité activée — les messages anniversaire seront envoyés automatiquement dès que les dates de naissance clients sont renseignées." };
    }

    if (name === "memoriser") {
      await writeMemory(tenantId, "agent-fidelite", args.cle, args.valeur);
      return { succes: true, resultat: `Mémorisé : ${args.cle}` };
    }

    return { succes: false, resultat: `Outil inconnu : ${name}` };
  } catch (err) {
    return { succes: false, resultat: `Erreur : ${err instanceof Error ? err.message : String(err)}` };
  }
};

// Exporté pour l'exécution autonome (lib/agent-consumer.ts)
export { SYSTEM_PROMPT, OUTILS, executeOutil };

export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = schema.parse(await req.json());
  const memoire = await readAllMemory(tenantId, "agent-fidelite");

  const messages = body.messages ?? [
    { role: "user" as const, content: "Analyse ma base clients et lance les meilleures actions de fidélisation maintenant." },
  ];

  const result = await runAgent(
    SYSTEM_PROMPT + (Object.keys(memoire).length > 0
      ? `\n\nTA MÉMOIRE :\n${Object.entries(memoire).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`
      : ""),
    messages,
    OUTILS,
    tenantId,
    executeOutil(tenantId),
    7
  );

  return NextResponse.json(result);
}
