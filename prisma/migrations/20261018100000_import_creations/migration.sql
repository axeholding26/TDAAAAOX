-- CreateTable
CREATE TABLE "ImportCreation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fournisseur" TEXT NOT NULL,
    "creePar" TEXT NOT NULL,
    "cleIdempotence" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'received',
    "publierAuto" BOOLEAN NOT NULL DEFAULT false,
    "metadonnees" JSONB NOT NULL DEFAULT '{}',
    "produitId" TEXT,
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "prochaineTentative" TIMESTAMP(3),
    "derniereErreur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportCreation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FichierImport" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "mime" TEXT,
    "taille" INTEGER,
    "sha256" TEXT,
    "url" TEXT,
    "cle" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "erreur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FichierImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportCreation_tenantId_createdAt_idx" ON "ImportCreation"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportCreation_tenantId_cleIdempotence_key" ON "ImportCreation"("tenantId", "cleIdempotence");

-- CreateIndex
CREATE INDEX "FichierImport_importId_idx" ON "FichierImport"("importId");

-- CreateIndex
CREATE INDEX "FichierImport_tenantId_sha256_idx" ON "FichierImport"("tenantId", "sha256");

-- AddForeignKey
ALTER TABLE "FichierImport" ADD CONSTRAINT "FichierImport_importId_fkey" FOREIGN KEY ("importId") REFERENCES "ImportCreation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

