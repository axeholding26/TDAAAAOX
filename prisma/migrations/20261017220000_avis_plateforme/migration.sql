-- CreateTable
CREATE TABLE "AvisPlateforme" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" INTEGER NOT NULL,
    "texte" TEXT NOT NULL,
    "auteurNom" TEXT NOT NULL,
    "auteurRole" TEXT,
    "ville" TEXT,
    "consentement" BOOLEAN NOT NULL DEFAULT false,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "motifRefus" TEXT,
    "moderePar" TEXT,
    "modereLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvisPlateforme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvisPlateforme_tenantId_key" ON "AvisPlateforme"("tenantId");

-- CreateIndex
CREATE INDEX "AvisPlateforme_statut_updatedAt_idx" ON "AvisPlateforme"("statut", "updatedAt");

-- AddForeignKey
ALTER TABLE "AvisPlateforme" ADD CONSTRAINT "AvisPlateforme_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
