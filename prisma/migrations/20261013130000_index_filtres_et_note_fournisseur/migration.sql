-- Index sur les filtres fréquents (avis d'un produit, historique wallet, commandes d'un client/livreur,
-- statistiques, pixel…) et note fournisseur non inventée : vide tant que personne ne l'a évaluée
-- (même principe que delaiLivraison). Strictement additif et rejouable ; les notes existantes sont gardées.

-- AlterTable
ALTER TABLE "Fournisseur" ALTER COLUMN "fiabilite" DROP NOT NULL,
ALTER COLUMN "fiabilite" DROP DEFAULT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Analytics_tenantId_type_date_idx" ON "Analytics"("tenantId", "type", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Avis_tenantId_produitId_idx" ON "Avis"("tenantId", "produitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Collection_tenantId_idx" ON "Collection"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Commande_clientId_idx" ON "Commande"("clientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Commande_livreurId_idx" ON "Commande"("livreurId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommandeFournisseur_commandeId_idx" ON "CommandeFournisseur"("commandeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Commission_tenantId_idx" ON "Commission"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LigneCommande_produitId_idx" ON "LigneCommande"("produitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_livreurId_createdAt_idx" ON "Notification"("livreurId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PixelEvent_tenantId_createdAt_idx" ON "PixelEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Retrait_walletId_idx" ON "Retrait"("walletId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

