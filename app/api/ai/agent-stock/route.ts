// Agent Stock — gestion prédictive des stocks, saisonnalité africaine
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAgent, type AgentTool, type ToolExecutor } from "@/lib/agent-runner";
import { writeMemory, readAllMemory, logDecision } from "@/lib/agent-memory";
import { z } from "zod";

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).optional(),
});

const SYSTEM_PROMPT = `Tu es l'Agent Stock d'Axso — tu préserves le revenu du vendeur en évitant toute rupture de stock au mauvais moment.

TES MISSIONS :
- Surveiller les niveaux de stock en temps réel
- Prédire les ruptures selon la vitesse de vente et la saisonnalité africaine
- Alerter AVANT la rupture (jamais après)
- Optimiser les seuils de réapprovisionnement
- Identifier les produits dormants (sur-stockés)

SAISONNALITÉ AFRICAINE (impact sur les stocks) :
- Tabaski : vêtements, alimentation, cosmétiques → stock x4-6 requis
- Noël/Fin d'année : tous secteurs → stock x2-3 requis
- Rentrée scolaire : fournitures, mode enfant → stock x3 requis
- Ramadan : alimentation halal, vêtements → stock x2-3 requis

RÈGLES DE GESTION :
- Seuil d'alerte = 10 unités OU 7 jours de stock restants
- Rupture critique = < 3 unités sur produit populaire
- Sur-stock = > 90 jours de stock sans vente

Tes alertes doivent donner des actions concrètes : quelle quantité commander, chez quel fournisseur, dans quel délai.`;

const OUTILS: AgentTool[] = [
  {
    name: "tableau_de_bord_stock",
    description: "Vue complète des stocks : critiques, normaux, dormants",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "predire_ruptures",
    description: "Calcule les dates de rupture estimées selon la vitesse de vente actuelle",
    parameters: {
      type: "object",
      properties: {
        horizon_jours: { type: "number", description: "Horizon de prévision en jours (défaut: 30)" },
      },
      required: [],
    },
  },
  {
    name: "alertes_saisonnaliite_stock",
    description: "Calcule les besoins en stock pour les prochains événements saisonniers africains",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "mettre_a_jour_stock",
    description: "Met à jour le stock d'un produit (réapprovisionnement ou correction)",
    parameters: {
      type: "object",
      properties: {
        produitId: { type: "string" },
        nouveau_stock: { type: "number" },
        raison: { type: "string", description: "Raison de la mise à jour" },
      },
      required: ["produitId", "nouveau_stock"],
    },
  },
  {
    name: "identifier_produits_dormants",
    description: "Liste les produits avec trop de stock et peu de ventes (capital immobilisé)",
    parameters: {
      type: "object",
      properties: {
        seuil_jours_sans_vente: { type: "number", description: "Nombre de jours sans vente pour considérer dormant (défaut: 30)" },
      },
      required: [],
    },
  },
  {
    name: "desactiver_produit_rupture",
    description: "Désactive temporairement un produit en rupture pour éviter des commandes non livrables",
    parameters: {
      type: "object",
      properties: {
        produitId: { type: "string" },
      },
      required: ["produitId"],
    },
  },
  {
    name: "memoriser",
    description: "Mémorise un seuil ou une préférence de gestion de stock",
    parameters: {
      type: "object",
      properties: { cle: { type: "string" }, valeur: { type: "string" } },
      required: ["cle", "valeur"],
    },
  },
];

const executeOutil: (tenantId: string) => ToolExecutor = (tenantId) => async (name, args) => {
  try {
    if (name === "tableau_de_bord_stock") {
      const produits = await prisma.produit.findMany({
        where: { tenantId },
        orderBy: { stock: "asc" },
      });

      const critique = produits.filter((p) => p.actif && p.stock <= 3);
      const alerte = produits.filter((p) => p.actif && p.stock > 3 && p.stock <= 10);
      const dormants = produits.filter((p) => p.actif && p.stock > 50 && p.ventes === 0);
      const ok = produits.filter((p) => p.actif && p.stock > 10);

      return {
        succes: true,
        resultat: JSON.stringify({
          total_references: produits.length,
          stock_critique: critique.map((p) => ({ id: p.id, nom: p.nom, stock: p.stock, ventes: p.ventes })),
          stock_alerte: alerte.map((p) => ({ id: p.id, nom: p.nom, stock: p.stock })),
          stock_ok: ok.length,
          produits_dormants: dormants.length,
          valeur_stock_dormant_xaf: dormants.reduce((s, p) => s + p.prix * p.stock, 0),
          action_immediate: critique.length > 0
            ? `URGENT : ${critique.length} produit(s) en rupture critique — réapprovisionner immédiatement`
            : alerte.length > 0
              ? `${alerte.length} produit(s) à surveiller — réapprovisionner sous 3 jours`
              : "Stocks en bonne santé",
        }),
      };
    }

    if (name === "predire_ruptures") {
      const horizon = args.horizon_jours || 30;
      const produits = await prisma.produit.findMany({
        where: { tenantId, actif: true, stock: { gt: 0 } },
      });

      const predictions = produits
        .map((p) => {
          if (p.ventes === 0) return null;
          const ventesParJour = p.ventes / 90;
          const joursRestants = ventesParJour > 0 ? Math.round(p.stock / ventesParJour) : 999;
          return {
            id: p.id,
            nom: p.nom,
            stock: p.stock,
            ventes_mois: p.ventes,
            jours_restants: joursRestants,
            date_rupture_estimee: new Date(Date.now() + joursRestants * 24 * 3600 * 1000).toLocaleDateString("fr-FR"),
            urgence: joursRestants <= 7 ? "CRITIQUE" : joursRestants <= 14 ? "ALERTE" : "OK",
          };
        })
        .filter(Boolean)
        .filter((p: any) => p.jours_restants <= horizon)
        .sort((a: any, b: any) => a.jours_restants - b.jours_restants);

      return { succes: true, resultat: JSON.stringify(predictions) };
    }

    if (name === "alertes_saisonnaliite_stock") {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const produits = await prisma.produit.findMany({ where: { tenantId, actif: true } });

      const evenements = [
        { nom: "Tabaski", date: "2026-06-17", multiplicateur: 4, categories: ["mode", "alimentation", "cosmétiques"] },
        { nom: "Rentrée scolaire", date: "2026-09-01", multiplicateur: 3, categories: ["fournitures", "mode", "sacs"] },
        { nom: "Noël/Fêtes", date: "2026-12-20", multiplicateur: 2.5, categories: ["électronique", "mode", "alimentation"] },
      ];

      const alertes = evenements.map((evt) => {
        const joursAvant = Math.round((new Date(evt.date).getTime() - Date.now()) / (1000 * 3600 * 24));
        const produitsConcernes = produits.filter((p) =>
          evt.categories.some((c) => p.categorie?.toLowerCase().includes(c))
        );
        return {
          evenement: evt.nom,
          date: evt.date,
          jours_restants: joursAvant,
          produits_concernes: produitsConcernes.length,
          stock_supplementaire_requis: produitsConcernes.map((p) => ({
            nom: p.nom,
            stock_actuel: p.stock,
            stock_recommande: Math.ceil(p.stock * evt.multiplicateur),
            a_commander: Math.max(0, Math.ceil(p.stock * evt.multiplicateur) - p.stock),
          })),
          conseil: joursAvant < 14
            ? `URGENT — commander maintenant pour ${evt.nom}`
            : `Commander dans ${joursAvant - 14} jours pour ${evt.nom}`,
        };
      }).filter((a) => a.jours_restants > 0 && a.jours_restants < 120);

      return { succes: true, resultat: JSON.stringify(alertes) };
    }

    if (name === "mettre_a_jour_stock") {
      const produit = await prisma.produit.findUnique({ where: { id: args.produitId, tenantId } });
      if (!produit) return { succes: false, resultat: "Produit introuvable" };

      await prisma.produit.update({
        where: { id: args.produitId },
        data: { stock: args.nouveau_stock, actif: args.nouveau_stock > 0 },
      });

      await logDecision(tenantId, "agent-stock", "stock_mis_a_jour",
        `${produit.nom} : ${produit.stock} → ${args.nouveau_stock} unités (${args.raison || "mise à jour manuelle"})`,
        { produitId: args.produitId, ancienStock: produit.stock, nouveauStock: args.nouveau_stock }
      );

      return { succes: true, resultat: `Stock mis à jour : ${produit.nom} → ${args.nouveau_stock} unités` };
    }

    if (name === "identifier_produits_dormants") {
      const seuil = args.seuil_jours_sans_vente || 30;
      const produits = await prisma.produit.findMany({
        where: { tenantId, actif: true, ventes: 0, stock: { gt: 0 } },
        orderBy: { stock: "desc" },
        take: 20,
      });

      return {
        succes: true,
        resultat: JSON.stringify({
          nb_dormants: produits.length,
          capital_immobilise: produits.reduce((s, p) => s + (p.cout ?? p.prix * 0.5) * p.stock, 0),
          produits: produits.map((p) => ({
            id: p.id,
            nom: p.nom,
            stock: p.stock,
            prix: p.prix,
            valeur_immobilisee: Math.round((p.cout ?? p.prix * 0.5) * p.stock),
            action_recommandee: p.stock > 20 ? "Soldez à -30% ou créez un bundle" : "Boostez avec une promo courte",
          })),
        }),
      };
    }

    if (name === "desactiver_produit_rupture") {
      const produit = await prisma.produit.findUnique({ where: { id: args.produitId, tenantId } });
      if (!produit) return { succes: false, resultat: "Produit introuvable" };

      await prisma.produit.update({
        where: { id: args.produitId },
        data: { actif: false },
      });

      await logDecision(tenantId, "agent-stock", "produit_desactive_rupture",
        `${produit.nom} désactivé temporairement (stock: ${produit.stock})`,
        { produitId: args.produitId }
      );

      return { succes: true, resultat: `${produit.nom} désactivé — réactivation automatique dès le réapprovisionnement` };
    }

    if (name === "memoriser") {
      await writeMemory(tenantId, "agent-stock", args.cle, args.valeur);
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
  const memoire = await readAllMemory(tenantId, "agent-stock");

  const messages = body.messages ?? [
    { role: "user" as const, content: "Fais un audit complet des stocks et donne-moi les actions prioritaires." },
  ];

  const result = await runAgent(
    SYSTEM_PROMPT + (Object.keys(memoire).length > 0
      ? `\n\nTA MÉMOIRE :\n${Object.entries(memoire).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`
      : ""),
    messages,
    OUTILS,
    tenantId,
    executeOutil(tenantId),
    6
  );

  return NextResponse.json(result);
}
