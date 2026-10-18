-- Chantier LIVRAISON NUMÉRIQUE : révocation et compteur des jetons, journal de livraison.
ALTER TABLE "Telechargement" ADD COLUMN "revoqueAt" TIMESTAMP(3);
ALTER TABLE "Telechargement" ADD COLUMN "nbTelechargements" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Telechargement" ADD COLUMN "dernierTelechargementAt" TIMESTAMP(3);
CREATE INDEX "Telechargement_commandeId_idx" ON "Telechargement"("commandeId");

CREATE TABLE "LivraisonDigitale" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "emailStatut" TEXT NOT NULL DEFAULT 'en_attente',
    "tentatives" INTEGER NOT NULL DEFAULT 0,
    "emailTentatives" INTEGER NOT NULL DEFAULT 0,
    "derniereErreur" TEXT,
    "verrouAt" TIMESTAMP(3),
    "livreeAt" TIMESTAMP(3),
    "emailEnvoyeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LivraisonDigitale_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LivraisonDigitale_commandeId_key" ON "LivraisonDigitale"("commandeId");
CREATE INDEX "LivraisonDigitale_tenantId_statut_idx" ON "LivraisonDigitale"("tenantId", "statut");
