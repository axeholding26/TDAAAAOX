-- Supplier Intelligence : extension de "Fournisseur" + nouvelles tables.
-- Écrit à la main, rejouable (IF NOT EXISTS) : la table "Fournisseur" a été
-- créée par `prisma db push` et n'apparaît dans aucune migration précédente.

-- AlterTable
ALTER TABLE "Fournisseur"
  ADD COLUMN IF NOT EXISTS "typeEntreprise" TEXT NOT NULL DEFAULT 'inconnu',
  ADD COLUMN IF NOT EXISTS "anneeCreation" INTEGER,
  ADD COLUMN IF NOT EXISTS "nbEmployes" INTEGER,
  ADD COLUMN IF NOT EXISTS "capaciteProduction" TEXT,
  ADD COLUMN IF NOT EXISTS "adresseUsine" TEXT,
  ADD COLUMN IF NOT EXISTS "categoriesProduites" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "marchesExport" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "photosUsine" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "videoUsine" TEXT,
  ADD COLUMN IF NOT EXISTS "equipements" TEXT,
  ADD COLUMN IF NOT EXISTS "numeroLicence" TEXT,
  ADD COLUMN IF NOT EXISTS "protectionPaiement" TEXT,
  ADD COLUMN IF NOT EXISTS "personnalisation" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "privateLabel" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "packagingPerso" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "echantillonPossible" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "inspectionAcceptee" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "paiementHorsPlateforme" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "scoreGlobal" INTEGER,
  ADD COLUMN IF NOT EXISTS "scoreFabricant" INTEGER,
  ADD COLUMN IF NOT EXISTS "niveauRisque" TEXT,
  ADD COLUMN IF NOT EXISTS "labelVerifie" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "signatureRisque" TEXT,
  ADD COLUMN IF NOT EXISTS "analyseLe" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProduitFournisseur" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "produitId" TEXT,
    "nomProduit" TEXT NOT NULL,
    "categorie" TEXT,
    "urlOffre" TEXT,
    "prixUnitaire" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'USD',
    "paliers" JSONB NOT NULL DEFAULT '[]',
    "moq" INTEGER,
    "delaiProduction" INTEGER,
    "poidsKg" DOUBLE PRECISION,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'saisie',
    "confiance" TEXT NOT NULL DEFAULT 'declare_fournisseur',
    "scoreQualite" INTEGER,
    "scoreCertification" INTEGER,
    "scoreLogistique" INTEGER,
    "scoreRisque" INTEGER,
    "scoreFournisseur" INTEGER,
    "coutRenduTotal" DOUBLE PRECISION,
    "coutRenduDevise" TEXT,
    "derniereVerificationAt" TIMESTAMP(3),
    "recommandeDepuis" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProduitFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DocumentFournisseur" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "certification" TEXT,
    "nom" TEXT NOT NULL,
    "url" TEXT,
    "organismeEmetteur" TEXT,
    "numero" TEXT,
    "dateEmission" TIMESTAMP(3),
    "dateExpiration" TIMESTAMP(3),
    "statutVerification" TEXT NOT NULL DEFAULT 'declare_fournisseur',
    "sourceVerification" TEXT,
    "verifieParId" TEXT,
    "verifieLe" TIMESTAMP(3),
    "alerteExpirationLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditFournisseur" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "prestataire" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'demande',
    "dateAudit" TIMESTAMP(3),
    "rapportUrl" TEXT,
    "reference" TEXT,
    "confiance" TEXT NOT NULL DEFAULT 'declare_fournisseur',
    "sourceVerification" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EchantillonFournisseur" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "offreId" TEXT,
    "nomProduit" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "cout" DOUBLE PRECISION,
    "devise" TEXT NOT NULL DEFAULT 'USD',
    "statut" TEXT NOT NULL DEFAULT 'a_commander',
    "commandeLe" TIMESTAMP(3),
    "recuLe" TIMESTAMP(3),
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "verdict" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EchantillonFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EvaluationFournisseur" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "offreId" TEXT,
    "commandeFournisseurId" TEXT,
    "qualite" INTEGER NOT NULL,
    "conformite" INTEGER NOT NULL,
    "emballage" INTEGER NOT NULL,
    "delai" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "unitesRecues" INTEGER NOT NULL DEFAULT 0,
    "unitesDefectueuses" INTEGER NOT NULL DEFAULT 0,
    "delaiReelJours" INTEGER,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VerificationFournisseur" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "champ" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "verifieParId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DemandeDevis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "produitId" TEXT,
    "nomProduit" TEXT NOT NULL,
    "description" TEXT,
    "quantite" INTEGER NOT NULL,
    "prixCible" DOUBLE PRECISION,
    "devise" TEXT NOT NULL DEFAULT 'USD',
    "paysDestination" TEXT NOT NULL,
    "villeDestination" TEXT,
    "incoterm" TEXT,
    "couleur" TEXT,
    "packaging" TEXT,
    "personnalisation" TEXT,
    "contenu" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandeDevis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReponseDevis" (
    "id" TEXT NOT NULL,
    "demandeDevisId" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "statutEnvoi" TEXT NOT NULL DEFAULT 'non_envoye',
    "envoyeLe" TIMESTAMP(3),
    "texteBrut" TEXT,
    "recuLe" TIMESTAMP(3),
    "prixUnitaire" DOUBLE PRECISION,
    "devise" TEXT,
    "moq" INTEGER,
    "delaiJours" INTEGER,
    "packaging" TEXT,
    "personnalisation" TEXT,
    "expedition" TEXT,
    "conditionsPaiement" TEXT,
    "extraitPar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReponseDevis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProduitFournisseur_tenantId_produitId_idx" ON "ProduitFournisseur"("tenantId", "produitId");
CREATE INDEX IF NOT EXISTS "ProduitFournisseur_fournisseurId_idx" ON "ProduitFournisseur"("fournisseurId");
CREATE INDEX IF NOT EXISTS "DocumentFournisseur_tenantId_fournisseurId_idx" ON "DocumentFournisseur"("tenantId", "fournisseurId");
CREATE INDEX IF NOT EXISTS "DocumentFournisseur_dateExpiration_idx" ON "DocumentFournisseur"("dateExpiration");
CREATE INDEX IF NOT EXISTS "AuditFournisseur_tenantId_fournisseurId_idx" ON "AuditFournisseur"("tenantId", "fournisseurId");
CREATE INDEX IF NOT EXISTS "EchantillonFournisseur_tenantId_fournisseurId_idx" ON "EchantillonFournisseur"("tenantId", "fournisseurId");
CREATE INDEX IF NOT EXISTS "EvaluationFournisseur_tenantId_fournisseurId_idx" ON "EvaluationFournisseur"("tenantId", "fournisseurId");
CREATE INDEX IF NOT EXISTS "VerificationFournisseur_fournisseurId_champ_createdAt_idx" ON "VerificationFournisseur"("fournisseurId", "champ", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "DemandeDevis_tenantId_reference_key" ON "DemandeDevis"("tenantId", "reference");
CREATE INDEX IF NOT EXISTS "DemandeDevis_tenantId_statut_idx" ON "DemandeDevis"("tenantId", "statut");
CREATE UNIQUE INDEX IF NOT EXISTS "ReponseDevis_demandeDevisId_fournisseurId_key" ON "ReponseDevis"("demandeDevisId", "fournisseurId");

-- AddForeignKey (Postgres n'a pas de ADD CONSTRAINT IF NOT EXISTS : on retire avant d'ajouter)
ALTER TABLE "ProduitFournisseur" DROP CONSTRAINT IF EXISTS "ProduitFournisseur_fournisseurId_fkey";
ALTER TABLE "ProduitFournisseur" ADD CONSTRAINT "ProduitFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProduitFournisseur" DROP CONSTRAINT IF EXISTS "ProduitFournisseur_produitId_fkey";
ALTER TABLE "ProduitFournisseur" ADD CONSTRAINT "ProduitFournisseur_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentFournisseur" DROP CONSTRAINT IF EXISTS "DocumentFournisseur_fournisseurId_fkey";
ALTER TABLE "DocumentFournisseur" ADD CONSTRAINT "DocumentFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditFournisseur" DROP CONSTRAINT IF EXISTS "AuditFournisseur_fournisseurId_fkey";
ALTER TABLE "AuditFournisseur" ADD CONSTRAINT "AuditFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EchantillonFournisseur" DROP CONSTRAINT IF EXISTS "EchantillonFournisseur_fournisseurId_fkey";
ALTER TABLE "EchantillonFournisseur" ADD CONSTRAINT "EchantillonFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvaluationFournisseur" DROP CONSTRAINT IF EXISTS "EvaluationFournisseur_fournisseurId_fkey";
ALTER TABLE "EvaluationFournisseur" ADD CONSTRAINT "EvaluationFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificationFournisseur" DROP CONSTRAINT IF EXISTS "VerificationFournisseur_fournisseurId_fkey";
ALTER TABLE "VerificationFournisseur" ADD CONSTRAINT "VerificationFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReponseDevis" DROP CONSTRAINT IF EXISTS "ReponseDevis_demandeDevisId_fkey";
ALTER TABLE "ReponseDevis" ADD CONSTRAINT "ReponseDevis_demandeDevisId_fkey" FOREIGN KEY ("demandeDevisId") REFERENCES "DemandeDevis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReponseDevis" DROP CONSTRAINT IF EXISTS "ReponseDevis_fournisseurId_fkey";
ALTER TABLE "ReponseDevis" ADD CONSTRAINT "ReponseDevis_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
