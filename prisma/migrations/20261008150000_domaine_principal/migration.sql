-- AlterTable
ALTER TABLE "ReglePort" ADD COLUMN     "pays" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "zone" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "domaineActifAt" TIMESTAMP(3);

