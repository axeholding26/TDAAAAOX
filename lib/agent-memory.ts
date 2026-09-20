import { prisma } from "./prisma";

export async function readMemory(tenantId: string, agentId: string, cle: string): Promise<string | null> {
  const mem = await prisma.agentMemory.findUnique({
    where: { tenantId_agentId_cle: { tenantId, agentId, cle } },
  });
  return mem?.valeur ?? null;
}

export async function writeMemory(tenantId: string, agentId: string, cle: string, valeur: string): Promise<void> {
  await prisma.agentMemory.upsert({
    where: { tenantId_agentId_cle: { tenantId, agentId, cle } },
    create: { tenantId, agentId, cle, valeur },
    update: { valeur },
  });
}

export async function readAllMemory(tenantId: string, agentId: string): Promise<Record<string, string>> {
  const mems = await prisma.agentMemory.findMany({ where: { tenantId, agentId } });
  return Object.fromEntries(mems.map((m) => [m.cle, m.valeur]));
}

export async function logDecision(
  tenantId: string,
  agentId: string,
  type: string,
  description: string,
  donnees: object = {},
  impactEstime?: number
): Promise<void> {
  await prisma.agentDecision.create({
    data: { tenantId, agentId, type, description, donnees, impactEstime },
  });
}

export async function getDecisionsRecentes(tenantId: string, limite = 20) {
  return prisma.agentDecision.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limite,
  });
}
