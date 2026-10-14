-- AlterTable
ALTER TABLE "ActionIA" ADD COLUMN     "annuleLe" TIMESTAMP(3),
ADD COLUMN     "apres" JSONB,
ADD COLUMN     "args" JSONB,
ADD COLUMN     "avant" JSONB,
ADD COLUMN     "requete" TEXT,
ADD COLUMN     "ressources" JSONB;

-- AlterTable
ALTER TABLE "ConnexionIA" ADD COLUMN     "boutiques" TEXT[],
ADD COLUMN     "fournisseur" TEXT NOT NULL DEFAULT 'autre';

-- CreateTable
CREATE TABLE "TacheIA" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connexionId" TEXT,
    "type" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "progression" INTEGER NOT NULL DEFAULT 0,
    "etape" TEXT,
    "resultat" JSONB,
    "erreur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TacheIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanIA" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connexionId" TEXT NOT NULL,
    "objectif" TEXT NOT NULL,
    "contraintes" JSONB NOT NULL DEFAULT '{}',
    "etapes" JSONB NOT NULL DEFAULT '[]',
    "statut" TEXT NOT NULL DEFAULT 'propose',
    "rapport" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvenementIA" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "donnees" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvenementIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookIA" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "evenements" TEXT[],
    "secret" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "echecs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomatisationIA" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connexionId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "declencheur" JSONB NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "etapes" JSONB NOT NULL DEFAULT '[]',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "prochaineExecution" TIMESTAMP(3),
    "derniereExecution" TIMESTAMP(3),
    "executions" INTEGER NOT NULL DEFAULT 0,
    "dernierResultat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomatisationIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionAutomatisation" (
    "id" TEXT NOT NULL,
    "automatisationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "etape" INTEGER NOT NULL DEFAULT 0,
    "contexte" JSONB NOT NULL DEFAULT '{}',
    "journal" JSONB NOT NULL DEFAULT '[]',
    "reprendreLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionAutomatisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaIA" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fournisseur" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "cleStockage" TEXT,
    "metadonnees" JSONB NOT NULL DEFAULT '{}',
    "largeur" INTEGER,
    "hauteur" INTEGER,
    "duree" DOUBLE PRECISION,
    "creePar" TEXT NOT NULL,
    "usage" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TacheIA_tenantId_createdAt_idx" ON "TacheIA"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "PlanIA_tenantId_createdAt_idx" ON "PlanIA"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "EvenementIA_tenantId_type_createdAt_idx" ON "EvenementIA"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookIA_tenantId_idx" ON "WebhookIA"("tenantId");

-- CreateIndex
CREATE INDEX "AutomatisationIA_tenantId_idx" ON "AutomatisationIA"("tenantId");

-- CreateIndex
CREATE INDEX "AutomatisationIA_actif_prochaineExecution_idx" ON "AutomatisationIA"("actif", "prochaineExecution");

-- CreateIndex
CREATE INDEX "ExecutionAutomatisation_automatisationId_idx" ON "ExecutionAutomatisation"("automatisationId");

-- CreateIndex
CREATE INDEX "ExecutionAutomatisation_statut_reprendreLe_idx" ON "ExecutionAutomatisation"("statut", "reprendreLe");

-- CreateIndex
CREATE INDEX "MediaIA_tenantId_type_createdAt_idx" ON "MediaIA"("tenantId", "type", "createdAt");
