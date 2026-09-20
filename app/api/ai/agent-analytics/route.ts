// Agent Analytics — stats, tendances, rapport business complet
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAgent, type AgentTool, type ToolExecutor } from "@/lib/agent-runner";
import { z } from "zod";

const schema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
});

const PROMPT = `Tu es l'Agent Analytics d'Axso, data analyst expert en e-commerce africain.
Tu transformes les données brutes en insights actionnables pour aider les marchands à croître.

Tes capacités :
- Analyser les ventes, commandes, clients et produits sur différentes périodes
- Identifier les tendances et anomalies dans les données
- Calculer les KPIs clés : taux de conversion, panier moyen, LTV client
- Générer des rapports business complets avec recommandations

Workflow recommandé :
1. Commence par stats_globales pour avoir une vue d'ensemble
2. Approfondis avec des analyses spécifiques selon la question
3. Synthétise en recommandations concrètes et actionnables

Présente toujours les données avec contexte et interprétation, pas juste des chiffres.
Utilise des émojis de tendance (📈📉) pour rendre les insights visuels.`;

const OUTILS: AgentTool[] = [
  {
    name: "stats_globales",
    description: "KPIs principaux : CA, commandes, clients, panier moyen sur une période",
    parameters: {
      type: "object" as const,
      properties: {
        periode: { type: "string", enum: ["7j", "30j", "90j", "365j"], description: "Période d'analyse" },
      },
      required: ["periode"],
    },
  },
  {
    name: "evolution_ca",
    description: "Évolution du chiffre d'affaires jour par jour sur une période",
    parameters: {
      type: "object" as const,
      properties: {
        periode: { type: "string", enum: ["7j", "30j", "90j"], description: "Période" },
      },
      required: ["periode"],
    },
  },
  {
    name: "produits_performance",
    description: "Classement des produits par ventes, revenus, et taux de rotation du stock",
    parameters: {
      type: "object" as const,
      properties: {
        tri: { type: "string", enum: ["ventes", "revenu", "stock_critique"], description: "Critère de classement" },
        limite: { type: "number", description: "Nombre de produits" },
      },
      required: ["tri"],
    },
  },
  {
    name: "analyse_clients",
    description: "Analyse de la base clients : acquisition, rétention, LTV, segmentation RFM",
    parameters: {
      type: "object" as const,
      properties: {
        periode: { type: "string", enum: ["30j", "90j", "365j"], description: "Période d'analyse" },
      },
      required: ["periode"],
    },
  },
  {
    name: "analyse_commandes",
    description: "Analyse des commandes : statuts, taux de complétion, délais, paniers abandonnés",
    parameters: {
      type: "object" as const,
      properties: {
        periode: { type: "string", enum: ["7j", "30j", "90j"], description: "Période" },
      },
      required: ["periode"],
    },
  },
  {
    name: "rapport_complet",
    description: "Génère un rapport business complet sur 30 jours avec tous les KPIs",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

function joursVersDuree(periode: string): number {
  return periode === "7j" ? 7 : periode === "30j" ? 30 : periode === "90j" ? 90 : 365;
}

const executeOutil: ToolExecutor = async (nom, args, tenantId) => {
  try {
    switch (nom) {
      case "stats_globales": {
        const jours = joursVersDuree(args.periode);
        const depuis = new Date(Date.now() - jours * 86400000);
        const precedent = new Date(Date.now() - jours * 2 * 86400000);

        const [commandes, commandesPrecedent, clients, clientsPrecedent, produits, tenant] = await Promise.all([
          prisma.commande.findMany({
            where: { tenantId, createdAt: { gte: depuis } },
            select: { montantTotal: true, statut: true, devise: true, montantLivraison: true },
          }),
          prisma.commande.findMany({
            where: { tenantId, createdAt: { gte: precedent, lt: depuis } },
            select: { montantTotal: true, statut: true },
          }),
          prisma.client.count({ where: { tenantId, createdAt: { gte: depuis } } }),
          prisma.client.count({ where: { tenantId, createdAt: { gte: precedent, lt: depuis } } }),
          prisma.produit.count({ where: { tenantId, actif: true } }),
          prisma.tenant.findUnique({ where: { id: tenantId }, select: { devise: true, nomBoutique: true } }),
        ]);

        const confirmees = commandes.filter((c) => ["confirmee", "livree"].includes(c.statut));
        const ca = confirmees.reduce((s, c) => s + c.montantTotal, 0);
        const caPrecedent = commandesPrecedent.filter((c) => ["confirmee", "livree"].includes(c.statut)).reduce((s, c) => s + c.montantTotal, 0);
        const panierMoyen = confirmees.length ? ca / confirmees.length : 0;
        const tauxConversion = commandes.length ? (confirmees.length / commandes.length) * 100 : 0;
        const croissanceCa = caPrecedent ? ((ca - caPrecedent) / caPrecedent) * 100 : null;

        return {
          succes: true,
          resultat: JSON.stringify({
            periode: args.periode,
            boutique: tenant?.nomBoutique,
            devise: tenant?.devise,
            ca: Math.round(ca),
            ca_precedent: Math.round(caPrecedent),
            croissance_ca_pct: croissanceCa !== null ? Math.round(croissanceCa) : null,
            nb_commandes: commandes.length,
            nb_confirmees: confirmees.length,
            taux_conversion_pct: Math.round(tauxConversion),
            panier_moyen: Math.round(panierMoyen),
            nouveaux_clients: clients,
            nouveaux_clients_precedent: clientsPrecedent,
            produits_actifs: produits,
          }),
        };
      }

      case "evolution_ca": {
        const jours = joursVersDuree(args.periode);
        const depuis = new Date(Date.now() - jours * 86400000);
        const commandes = await prisma.commande.findMany({
          where: { tenantId, createdAt: { gte: depuis }, statut: { in: ["confirmee", "livree"] } },
          select: { montantTotal: true, createdAt: true, devise: true },
          orderBy: { createdAt: "asc" },
        });

        const parJour: Record<string, number> = {};
        commandes.forEach((c) => {
          const jour = c.createdAt.toISOString().split("T")[0];
          parJour[jour] = (parJour[jour] ?? 0) + c.montantTotal;
        });

        const devise = commandes[0]?.devise || "XOF";
        return { succes: true, resultat: JSON.stringify({ devise, evolution: parJour }) };
      }

      case "produits_performance": {
        const produits = await prisma.produit.findMany({
          where: { tenantId },
          select: { id: true, nom: true, prix: true, ventes: true, stock: true, categorie: true, actif: true },
          take: args.limite ?? 10,
          orderBy:
            args.tri === "ventes" ? { ventes: "desc" }
            : args.tri === "revenu" ? { ventes: "desc" }
            : { stock: "asc" },
        });

        const avecRevenu = produits.map((p) => ({
          ...p,
          revenu_estime: Math.round(p.prix * p.ventes),
          stock_critique: p.stock <= 3,
        }));

        if (args.tri === "revenu") avecRevenu.sort((a, b) => b.revenu_estime - a.revenu_estime);
        return { succes: true, resultat: JSON.stringify(avecRevenu) };
      }

      case "analyse_clients": {
        const jours = joursVersDuree(args.periode);
        const depuis = new Date(Date.now() - jours * 86400000);

        const [total, nouveaux, actifs, top5] = await Promise.all([
          prisma.client.count({ where: { tenantId } }),
          prisma.client.count({ where: { tenantId, createdAt: { gte: depuis } } }),
          prisma.client.count({ where: { tenantId, totalCommandes: { gt: 1 } } }),
          prisma.client.findMany({
            where: { tenantId },
            orderBy: { totalDepense: "desc" },
            take: 5,
            select: { nom: true, totalCommandes: true, totalDepense: true },
          }),
        ]);

        const agregat = await prisma.client.aggregate({
          where: { tenantId },
          _avg: { totalDepense: true, totalCommandes: true },
          _sum: { totalDepense: true },
        });

        return {
          succes: true,
          resultat: JSON.stringify({
            periode: args.periode,
            total_clients: total,
            nouveaux_periode: nouveaux,
            clients_fideles: actifs,
            taux_fidelite_pct: total ? Math.round((actifs / total) * 100) : 0,
            ltv_moyen: Math.round(agregat._avg.totalDepense ?? 0),
            commandes_moyennes_par_client: Math.round((agregat._avg.totalCommandes ?? 0) * 10) / 10,
            revenu_total_clients: Math.round(agregat._sum.totalDepense ?? 0),
            top_5_clients: top5,
          }),
        };
      }

      case "analyse_commandes": {
        const jours = joursVersDuree(args.periode);
        const depuis = new Date(Date.now() - jours * 86400000);

        const commandes = await prisma.commande.findMany({
          where: { tenantId, createdAt: { gte: depuis } },
          select: { statut: true, paiementStatut: true, livraisonStatut: true, montantTotal: true, devise: true },
        });

        const parStatut: Record<string, number> = {};
        commandes.forEach((c) => { parStatut[c.statut] = (parStatut[c.statut] ?? 0) + 1; });

        const livrees = commandes.filter((c) => c.statut === "livree").length;
        const annulees = commandes.filter((c) => c.statut === "annulee").length;
        const devise = commandes[0]?.devise || "XOF";

        return {
          succes: true,
          resultat: JSON.stringify({
            total: commandes.length,
            par_statut: parStatut,
            taux_livraison_pct: commandes.length ? Math.round((livrees / commandes.length) * 100) : 0,
            taux_annulation_pct: commandes.length ? Math.round((annulees / commandes.length) * 100) : 0,
            devise,
          }),
        };
      }

      case "rapport_complet": {
        const depuis30j = new Date(Date.now() - 30 * 86400000);
        const depuis7j = new Date(Date.now() - 7 * 86400000);

        const [commandes30j, commandes7j, clients, produits, tenant] = await Promise.all([
          prisma.commande.findMany({
            where: { tenantId, createdAt: { gte: depuis30j } },
            select: { montantTotal: true, statut: true, devise: true },
          }),
          prisma.commande.findMany({
            where: { tenantId, createdAt: { gte: depuis7j } },
            select: { montantTotal: true, statut: true },
          }),
          prisma.client.aggregate({ where: { tenantId }, _count: true, _sum: { totalDepense: true } }),
          prisma.produit.findMany({
            where: { tenantId, actif: true },
            orderBy: { ventes: "desc" },
            take: 5,
            select: { nom: true, ventes: true, prix: true },
          }),
          prisma.tenant.findUnique({ where: { id: tenantId }, select: { nomBoutique: true, devise: true, pays: true, createdAt: true } }),
        ]);

        const conf30j = commandes30j.filter((c) => ["confirmee", "livree"].includes(c.statut));
        const conf7j = commandes7j.filter((c) => ["confirmee", "livree"].includes(c.statut));
        const ca30j = conf30j.reduce((s, c) => s + c.montantTotal, 0);
        const ca7j = conf7j.reduce((s, c) => s + c.montantTotal, 0);

        return {
          succes: true,
          resultat: JSON.stringify({
            boutique: tenant?.nomBoutique,
            pays: tenant?.pays,
            devise: tenant?.devise,
            kpis_30j: {
              ca: Math.round(ca30j),
              commandes: commandes30j.length,
              confirmees: conf30j.length,
              taux_conversion: commandes30j.length ? Math.round((conf30j.length / commandes30j.length) * 100) : 0,
            },
            kpis_7j: {
              ca: Math.round(ca7j),
              commandes: commandes7j.length,
            },
            clients: { total: clients._count, revenu_total: Math.round(clients._sum.totalDepense ?? 0) },
            top_produits: produits.map((p) => ({ nom: p.nom, ventes: p.ventes, revenu: Math.round(p.prix * p.ventes) })),
          }),
        };
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
    console.error("[AGENT/ANALYTICS]", err);
    return NextResponse.json({ message: "Erreur agent analytics" }, { status: 500 });
  }
}
