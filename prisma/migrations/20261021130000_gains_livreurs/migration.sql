-- Gains des livreurs : réglage de rémunération par boutique/livreur, gain par course, solde par devise, retraits manuels.
CREATE TABLE "ReglageLivreur" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "livreurId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "montantFixe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReglageLivreur_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GainLivreur" (
    "id" TEXT NOT NULL,
    "livreurId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL,
    "paiement" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GainLivreur_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SoldeLivreur" (
    "id" TEXT NOT NULL,
    "livreurId" TEXT NOT NULL,
    "devise" TEXT NOT NULL,
    "solde" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoldeLivreur_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetraitLivreur" (
    "id" TEXT NOT NULL,
    "livreurId" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL,
    "destinataire" TEXT NOT NULL,
    "operateur" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetraitLivreur_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReglageLivreur_tenantId_livreurId_key" ON "ReglageLivreur"("tenantId", "livreurId");
CREATE UNIQUE INDEX "GainLivreur_commandeId_key" ON "GainLivreur"("commandeId");
CREATE INDEX "GainLivreur_livreurId_createdAt_idx" ON "GainLivreur"("livreurId", "createdAt");
CREATE INDEX "GainLivreur_tenantId_livreurId_idx" ON "GainLivreur"("tenantId", "livreurId");
CREATE UNIQUE INDEX "SoldeLivreur_livreurId_devise_key" ON "SoldeLivreur"("livreurId", "devise");
CREATE INDEX "RetraitLivreur_livreurId_createdAt_idx" ON "RetraitLivreur"("livreurId", "createdAt");
CREATE INDEX "RetraitLivreur_statut_idx" ON "RetraitLivreur"("statut");

ALTER TABLE "ReglageLivreur" ADD CONSTRAINT "ReglageLivreur_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "Livreur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GainLivreur" ADD CONSTRAINT "GainLivreur_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "Livreur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SoldeLivreur" ADD CONSTRAINT "SoldeLivreur_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "Livreur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetraitLivreur" ADD CONSTRAINT "RetraitLivreur_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "Livreur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
