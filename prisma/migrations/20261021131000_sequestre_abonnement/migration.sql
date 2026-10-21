-- Séquestre 48 h des ventes (lib/wallet.ts) : une vente reste en attente jusqu'à disponibleLe.
ALTER TABLE "WalletTransaction" ADD COLUMN "disponibleLe" TIMESTAMP(3);
-- Rappels d'échéance de l'abonnement (lib/abonnement-paiement.ts) : j3 | j0.
ALTER TABLE "Tenant" ADD COLUMN "planRappel" TEXT;
