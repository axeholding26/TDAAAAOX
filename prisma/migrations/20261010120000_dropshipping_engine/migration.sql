-- CreateTable
CREATE TABLE "ProduitSource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connecteur" TEXT NOT NULL DEFAULT 'manuel',
    "refExterne" TEXT,
    "url" TEXT,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "variantes" JSONB NOT NULL DEFAULT '[]',
    "prixFournisseur" DOUBLE PRECISION NOT NULL,
    "deviseFournisseur" TEXT NOT NULL DEFAULT 'USD',
    "moq" INTEGER NOT NULL DEFAULT 1,
    "poidsKg" DOUBLE PRECISION,
    "dimensions" JSONB,
    "logistique" JSONB,
    "sku" TEXT,
    "disponibilite" INTEGER,
    "fournisseurNom" TEXT,
    "fournisseurId" TEXT,
    "favori" BOOLEAN NOT NULL DEFAULT false,
    "etape" TEXT NOT NULL DEFAULT 'decouverte',
    "modeAppro" TEXT NOT NULL DEFAULT 'dropshipping',
    "parametresCout" JSONB NOT NULL DEFAULT '{}',
    "tarification" JSONB NOT NULL DEFAULT '{}',
    "criteresScore" JSONB NOT NULL DEFAULT '{}',
    "score" INTEGER,
    "analyseIA" JSONB,
    "kitTest" JSONB,
    "publicites" JSONB,
    "produitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProduitSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expedition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "commandeFournisseurId" TEXT,
    "commandeId" TEXT,
    "produitSourceId" TEXT,
    "quantite" INTEGER,
    "mode" TEXT NOT NULL DEFAULT 'aerien',
    "transporteur" TEXT,
    "transitaire" TEXT,
    "trackingNo" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'en_preparation',
    "paysOrigine" TEXT NOT NULL DEFAULT 'CN',
    "paysDestination" TEXT NOT NULL,
    "pointEntree" TEXT,
    "entrepotId" TEXT,
    "poidsKg" DOUBLE PRECISION,
    "cout" DOUBLE PRECISION,
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "dateExpedition" TIMESTAMP(3),
    "arriveeEstimee" TIMESTAMP(3),
    "arriveeReelle" TIMESTAMP(3),
    "stockRecu" BOOLEAN NOT NULL DEFAULT false,
    "evenements" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expedition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglagesSourcing" (
    "tenantId" TEXT NOT NULL,
    "reglages" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReglagesSourcing_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "JournalSourcing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "cible" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalSourcing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProduitSource_tenantId_connecteur_refExterne_key" ON "ProduitSource"("tenantId", "connecteur", "refExterne");

-- CreateIndex
CREATE INDEX "ProduitSource_tenantId_etape_idx" ON "ProduitSource"("tenantId", "etape");

-- CreateIndex
CREATE INDEX "ProduitSource_tenantId_produitId_idx" ON "ProduitSource"("tenantId", "produitId");

-- CreateIndex
CREATE INDEX "Expedition_tenantId_statut_idx" ON "Expedition"("tenantId", "statut");

-- CreateIndex
CREATE INDEX "Expedition_commandeId_idx" ON "Expedition"("commandeId");

-- CreateIndex
CREATE INDEX "JournalSourcing_tenantId_createdAt_idx" ON "JournalSourcing"("tenantId", "createdAt");
