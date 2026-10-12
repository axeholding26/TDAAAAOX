-- Commission Axso : 6 % → 10 % (ajoutée au prix payé en ligne par le client ; environ 3 % couvrent
-- les frais NotchPay). Seules les boutiques restées au taux standard changent : un taux négocié est conservé.
ALTER TABLE "Tenant" ALTER COLUMN "commissionRate" SET DEFAULT 0.1;
UPDATE "Tenant" SET "commissionRate" = 0.1 WHERE "commissionRate" = 0.06;
