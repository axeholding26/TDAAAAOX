-- AlterTable
ALTER TABLE "ConnexionIA" ADD COLUMN     "capacitesClient" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "editionIaBloquee" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BrouillonBoutique" (
    "tenantId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "baseEmpreinte" TEXT NOT NULL,
    "majPar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrouillonBoutique_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "VersionBoutique" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "auteur" TEXT NOT NULL,
    "client" TEXT,
    "fournisseur" TEXT,
    "connexionId" TEXT,
    "raison" TEXT NOT NULL,
    "changements" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VersionBoutique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceBoutique" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "variantes" JSONB NOT NULL,
    "repartition" INTEGER NOT NULL DEFAULT 50,
    "metrique" TEXT NOT NULL DEFAULT 'conversion',
    "resultats" JSONB NOT NULL DEFAULT '{}',
    "debut" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperienceBoutique_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VersionBoutique_tenantId_createdAt_idx" ON "VersionBoutique"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VersionBoutique_tenantId_numero_key" ON "VersionBoutique"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "ExperienceBoutique_tenantId_statut_idx" ON "ExperienceBoutique"("tenantId", "statut");
