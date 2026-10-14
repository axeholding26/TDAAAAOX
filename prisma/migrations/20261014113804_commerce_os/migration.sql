-- AlterTable
ALTER TABLE "ActionIA" ADD COLUMN     "agent" TEXT,
ADD COLUMN     "approuvePar" TEXT,
ADD COLUMN     "coutEstime" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UsageIA" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "nombre" INTEGER NOT NULL DEFAULT 0,
    "cout" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentManifeste" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "agentId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "developpeur" TEXT NOT NULL DEFAULT 'Axso',
    "permissions" TEXT[],
    "outils" TEXT[],
    "tarif" JSONB NOT NULL DEFAULT '{}',
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentManifeste_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageIA_tenantId_periode_type_key" ON "UsageIA"("tenantId", "periode", "type");

-- CreateIndex
CREATE UNIQUE INDEX "AgentManifeste_tenantId_agentId_key" ON "AgentManifeste"("tenantId", "agentId");
