-- Essai de 7 jours du plan Illimité (lib/essai.ts)
ALTER TABLE "Tenant" ADD COLUMN "essaiStatut" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "essaiFinLe" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "essaiRappel" TEXT;
