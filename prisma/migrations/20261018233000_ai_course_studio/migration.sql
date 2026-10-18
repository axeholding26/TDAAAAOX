-- AlterTable
ALTER TABLE "TacheIA" ADD COLUMN     "cible" TEXT,
ADD COLUMN     "coutEstime" DOUBLE PRECISION,
ADD COLUMN     "coutReel" DOUBLE PRECISION,
ADD COLUMN     "maxTentatives" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "prochaineTentative" TIMESTAMP(3),
ADD COLUMN     "tentatives" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verrouAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "plafondIAMensuel" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "StudioCours" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "brief" JSONB NOT NULL,
    "etape" INTEGER NOT NULL DEFAULT 1,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "produitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioCours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioElement" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "titre" TEXT NOT NULL,
    "contenu" JSONB NOT NULL DEFAULT '{}',
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "version" INTEGER NOT NULL DEFAULT 1,
    "alertes" JSONB NOT NULL DEFAULT '[]',
    "erreur" TEXT,
    "publieId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioVersion" (
    "id" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "contenu" JSONB NOT NULL,
    "origine" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudioCours_tenantId_updatedAt_idx" ON "StudioCours"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "StudioElement_studioId_type_ordre_idx" ON "StudioElement"("studioId", "type", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "StudioVersion_elementId_version_key" ON "StudioVersion"("elementId", "version");

-- AddForeignKey
ALTER TABLE "StudioElement" ADD CONSTRAINT "StudioElement_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "StudioCours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioVersion" ADD CONSTRAINT "StudioVersion_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "StudioElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

