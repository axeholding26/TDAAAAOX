-- Politique de prix du 20/10/2026 (numérique +13 %, physique en ligne +10 %) : la majoration
-- est figée sur la commande à sa création. NULL = commande antérieure (taux de la boutique).
ALTER TABLE "Commande" ADD COLUMN "tauxCommission" DOUBLE PRECISION;
