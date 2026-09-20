// Orchestrateur central Axso — coordonne tous les agents vers les objectifs revenus
import { prisma } from "./prisma";
import { publierTache, type AgentId } from "./agent-bus";
import { logDecision } from "./agent-memory";

export interface ObjectifRevenu {
  tenantId: string;
  type: string;
  titre: string;
  cible: number;
  devise: string;
  deadline: Date;
}

export async function creerObjectif(params: ObjectifRevenu) {
  return prisma.agentGoal.create({
    data: {
      tenantId: params.tenantId,
      type: params.type,
      titre: params.titre,
      cible: params.cible,
      devise: params.devise,
      deadline: params.deadline,
    },
  });
}

export async function getObjectifsActifs(tenantId: string) {
  return prisma.agentGoal.findMany({
    where: { tenantId, statut: "actif" },
    orderBy: { createdAt: "desc" },
  });
}

export async function majProgressObjectif(tenantId: string) {
  // Calcule le revenu réel depuis les commandes livrées ce mois
  const debut = new Date();
  debut.setDate(1);
  debut.setHours(0, 0, 0, 0);

  const { _sum } = await prisma.commande.aggregate({
    where: {
      tenantId,
      paiementStatut: "completed",
      createdAt: { gte: debut },
    },
    _sum: { montantTotal: true },
  });

  const actuel = _sum.montantTotal ?? 0;

  await prisma.agentGoal.updateMany({
    where: { tenantId, type: "revenu_mensuel", statut: "actif" },
    data: { actuel },
  });

  // Marquer atteint si cible dépassée
  await prisma.agentGoal.updateMany({
    where: { tenantId, type: "revenu_mensuel", statut: "actif", cible: { lte: actuel } },
    data: { statut: "atteint" },
  });

  return actuel;
}

// Analyse la boutique et active les agents — toujours au moins 2 actions
export async function orchestrerAutonomie(tenantId: string): Promise<string[]> {
  const actionsLancees: string[] = [];

  const [commandes, produits, clients, objectifs, tenant] = await Promise.all([
    prisma.commande.findMany({ where: { tenantId, statut: "en_attente" }, take: 10 }),
    prisma.produit.findMany({ where: { tenantId, actif: true }, take: 50 }),
    prisma.client.findMany({ where: { tenantId }, take: 100 }),
    getObjectifsActifs(tenantId),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { nomBoutique: true, devise: true } }),
  ]);

  const produitsStockBas = produits.filter((p) => p.stock <= 5);
  const clientsAnciens = clients.filter((c) => c.createdAt <= new Date(Date.now() - 30 * 24 * 3600 * 1000));
  const totalCA = await prisma.commande.aggregate({
    where: { tenantId, paiementStatut: "completed" },
    _sum: { montantTotal: true },
  });

  // 1. Agent Revenue — toujours activé (analyse + opportunités)
  await publierTache(tenantId, "orchestrator", "agent-revenue", "analyser_et_optimiser", {
    nb_commandes_attente: commandes.length,
    ca_total: totalCA._sum.montantTotal ?? 0,
    objectifs: objectifs.map((o) => ({ titre: o.titre, progression: o.cible > 0 ? Math.round((o.actuel / o.cible) * 100) : 0 })),
  }, 2);
  actionsLancees.push(`Agent Revenue — analyse des opportunités de CA en cours`);

  // 2. Agent Stock — toujours activé (audit préventif)
  await publierTache(tenantId, "orchestrator", "agent-stock", "audit_stocks", {
    nb_produits: produits.length,
    stock_bas: produitsStockBas.map((p) => ({ id: p.id, nom: p.nom, stock: p.stock })),
  }, produitsStockBas.length > 0 ? 3 : 1);
  actionsLancees.push(
    produitsStockBas.length > 0
      ? `Agent Stock — ALERTE : ${produitsStockBas.length} produit(s) en rupture imminente`
      : `Agent Stock — audit préventif des stocks lancé`
  );

  // 3. Agent Fidélité — si des clients existent
  if (clients.length > 0) {
    await publierTache(tenantId, "orchestrator", "agent-fidelite", "analyser_retention", {
      nb_clients: clients.length,
      clients_anciens: clientsAnciens.length,
    }, clientsAnciens.length > 5 ? 2 : 1);
    actionsLancees.push(
      clientsAnciens.length > 0
        ? `Agent Fidélité — ${clientsAnciens.length} client(s) à réactiver identifié(s)`
        : `Agent Fidélité — analyse de la base clients`
    );
  }

  // 4. Agent Livraison — si commandes en attente
  if (commandes.length > 0) {
    await publierTache(tenantId, "orchestrator", "agent-livraison", "assigner_commandes", {
      commandes: commandes.map((c) => c.id),
    }, 2);
    actionsLancees.push(`Agent Livraison — ${commandes.length} commande(s) à assigner`);
  }

  // 5. Progression objectif revenu
  if (objectifs.length > 0) {
    const obj = objectifs[0];
    const pct = obj.cible > 0 ? Math.round((obj.actuel / obj.cible) * 100) : 0;
    actionsLancees.push(`Objectif "${obj.titre}" — progression : ${pct}% (${obj.actuel.toLocaleString()} / ${obj.cible.toLocaleString()} ${obj.devise})`);
  }

  await logDecision(
    tenantId,
    "orchestrator",
    "orchestration_autonome",
    `Cycle d'orchestration — ${actionsLancees.length} agent(s) coordonné(s)`,
    { actions: actionsLancees, boutique: tenant?.nomBoutique }
  );

  return actionsLancees;
}

export async function getEtatSysteme(tenantId: string) {
  const [objectifs, decisions, taches, wallet] = await Promise.all([
    getObjectifsActifs(tenantId),
    prisma.agentDecision.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.agentTask.findMany({
      where: { tenantId, statut: { in: ["pending", "en_cours"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.wallet.findUnique({ where: { tenantId } }),
  ]);

  return { objectifs, decisions, taches, wallet };
}
