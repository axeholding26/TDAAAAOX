import { prisma } from "./prisma";

export type AgentId =
  | "orchestrator"
  | "agent-revenue"
  | "agent-veille"
  | "agent-growth"
  | "agent-stock"
  | "agent-fidelite"
  | "agent-marketing"
  | "agent-analytics"
  | "agent-clients"
  | "agent-produits"
  | "agent-livraison";

export async function publierTache(
  tenantId: string,
  fromAgent: AgentId,
  toAgent: AgentId,
  type: string,
  payload: object,
  priorite: 1 | 2 | 3 = 1
): Promise<string> {
  const task = await prisma.agentTask.create({
    data: { tenantId, fromAgent, toAgent, type, payload, priorite },
  });
  return task.id;
}

export async function consommerTaches(tenantId: string, agentId: AgentId, limit = 5) {
  return prisma.agentTask.findMany({
    where: { tenantId, toAgent: agentId, statut: "pending" },
    orderBy: [{ priorite: "desc" }, { createdAt: "asc" }],
    take: limit,
  });
}

export async function marquerComplete(taskId: string, resultat: object): Promise<void> {
  await prisma.agentTask.update({
    where: { id: taskId },
    data: { statut: "complete", resultat, updatedAt: new Date() },
  });
}

export async function marquerEchec(taskId: string, erreur: string): Promise<void> {
  await prisma.agentTask.update({
    where: { id: taskId },
    data: { statut: "echec", resultat: { erreur }, updatedAt: new Date() },
  });
}

export async function getTachesEnCours(tenantId: string) {
  return prisma.agentTask.findMany({
    where: { tenantId, statut: { in: ["pending", "en_cours"] } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}
