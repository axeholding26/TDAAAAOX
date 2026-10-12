-- AXSO POS 2.0 : champs ajoutés aux modèles existants + nouvelles tables
-- (magasins, caisses, sessions, paiements, stock par lieu, achats, fidélité,
-- crédit, audit, temps réel). Écrit à la main à partir du schéma, rejouable
-- (IF NOT EXISTS) : strictement additif, aucune colonne ni table supprimée.
--
-- La production applique le schéma par `prisma db push` : les sections 1 à 4
-- y sont donc créées sans ce fichier. La section 5 (SQL HORS SCHÉMA) ne l'est
-- PAS : elle est à exécuter à la main, une fois, après le déploiement.

-- ───────────── 1 à 4. Schéma ─────────────
-- AlterTable
ALTER TABLE "Produit" ADD COLUMN IF NOT EXISTS "garantieMois" INTEGER,
ADD COLUMN IF NOT EXISTS "marque" TEXT,
ADD COLUMN IF NOT EXISTS "suiviSerie" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "tauxTVA" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "uniteVente" TEXT NOT NULL DEFAULT 'piece';

-- AlterTable
ALTER TABLE "Variante" ADD COLUMN IF NOT EXISTS "cout" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "codeClient" TEXT,
ADD COLUMN IF NOT EXISTS "creditBloque" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "creditEcheanceJours" INTEGER,
ADD COLUMN IF NOT EXISTS "creditPlafond" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "creditUtilise" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "niveauFidelite" TEXT NOT NULL DEFAULT 'bronze',
ADD COLUMN IF NOT EXISTS "pointsFidelite" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "segment" TEXT;

-- AlterTable
ALTER TABLE "Commande" ADD COLUMN IF NOT EXISTS "appareilId" TEXT,
ADD COLUMN IF NOT EXISTS "caisseId" TEXT,
ADD COLUMN IF NOT EXISTS "canal" TEXT NOT NULL DEFAULT 'en_ligne',
ADD COLUMN IF NOT EXISTS "commandeOrigineId" TEXT,
ADD COLUMN IF NOT EXISTS "creeLocalAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "magasinId" TEXT,
ADD COLUMN IF NOT EXISTS "montantPaye" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "montantTaxes" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "sessionCaisseId" TEXT,
ADD COLUMN IF NOT EXISTS "vendeurId" TEXT;

-- AlterTable
ALTER TABLE "LigneCommande" ADD COLUMN IF NOT EXISTS "commentaire" TEXT,
ADD COLUMN IF NOT EXISTS "cout" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "mesure" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "numeroSerieId" TEXT,
ADD COLUMN IF NOT EXISTS "offert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "prixOrigine" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "promotionId" TEXT,
ADD COLUMN IF NOT EXISTS "quantiteRetournee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "remise" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tauxTVA" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "varianteId" TEXT;

-- AlterTable
ALTER TABLE "MembreEquipe" ADD COLUMN IF NOT EXISTS "droitsPos" JSONB,
ADD COLUMN IF NOT EXISTS "magasinIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "RetourRMA" ADD COLUMN IF NOT EXISTS "avoirId" TEXT,
ADD COLUMN IF NOT EXISTS "lignes" JSONB,
ADD COLUMN IF NOT EXISTS "modeRemboursement" TEXT,
ADD COLUMN IF NOT EXISTS "sansRecu" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "sessionCaisseId" TEXT,
ADD COLUMN IF NOT EXISTS "traitePar" TEXT;

-- AlterTable
ALTER TABLE "StockEntrepot" ADD COLUMN IF NOT EXISTS "bloque" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "endommage" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockMouvement" ADD COLUMN IF NOT EXISTS "comptageId" TEXT,
ADD COLUMN IF NOT EXISTS "entrepotId" TEXT,
ADD COLUMN IF NOT EXISTS "receptionId" TEXT,
ADD COLUMN IF NOT EXISTS "transfertId" TEXT,
ADD COLUMN IF NOT EXISTS "varianteId" TEXT;

-- AlterTable
ALTER TABLE "LotTracabilite" ADD COLUMN IF NOT EXISTS "cout" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "entrepotId" TEXT,
ADD COLUMN IF NOT EXISTS "fournisseurId" TEXT;

-- AlterTable
ALTER TABLE "ChargeExploitation" ADD COLUMN IF NOT EXISTS "magasinId" TEXT,
ADD COLUMN IF NOT EXISTS "sessionCaisseId" TEXT;

-- AlterTable
ALTER TABLE "ProduitFournisseur" ADD COLUMN IF NOT EXISTS "principal" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Magasin" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "code" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "pays" TEXT,
    "telephone" TEXT,
    "entrepotId" TEXT NOT NULL,
    "typeCommerce" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Magasin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Caisse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "magasinId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dernierSignalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Caisse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppareilPos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "magasinId" TEXT,
    "caisseId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'telephone',
    "nom" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "codeAppairage" TEXT,
    "codeExpireAt" TIMESTAMP(3),
    "essais" INTEGER NOT NULL DEFAULT 0,
    "tokenHash" TEXT,
    "appairePar" TEXT NOT NULL,
    "userAgent" TEXT,
    "dernierSignalAt" TIMESTAMP(3),
    "revoqueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppareilPos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SessionCaisse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "magasinId" TEXT NOT NULL,
    "caisseId" TEXT NOT NULL,
    "caisseOuverteId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ouverte',
    "ouvertePar" TEXT NOT NULL,
    "fermeePar" TEXT,
    "fondsInitial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ouverteAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fermeeAt" TIMESTAMP(3),
    "nbVentes" INTEGER NOT NULL DEFAULT 0,
    "montantAttendu" DOUBLE PRECISION,
    "montantCompte" DOUBLE PRECISION,
    "ecart" DOUBLE PRECISION,
    "justificationEcart" TEXT,
    "detailComptage" JSONB,

    CONSTRAINT "SessionCaisse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MouvementCaisse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionCaisseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "motif" TEXT NOT NULL,
    "chargeId" TEXT,
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementCaisse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaiementVente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "sessionCaisseId" TEXT,
    "mode" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "statut" TEXT NOT NULL DEFAULT 'confirme',
    "declaratif" BOOLEAN NOT NULL DEFAULT false,
    "prestataire" TEXT,
    "reference" TEXT,
    "montantRecu" DOUBLE PRECISION,
    "monnaieRendue" DOUBLE PRECISION,
    "rapprochement" TEXT NOT NULL DEFAULT 'a_rapprocher',
    "rapprocheAt" TIMESTAMP(3),
    "encaissePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaiementVente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PanierSuspendu" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "magasinId" TEXT NOT NULL,
    "caisseId" TEXT NOT NULL,
    "creePar" TEXT NOT NULL,
    "libelle" TEXT,
    "clientId" TEXT,
    "contenu" JSONB NOT NULL,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'suspendu',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reprisAt" TIMESTAMP(3),

    CONSTRAINT "PanierSuspendu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ScanPos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "appareilId" TEXT,
    "userId" TEXT,
    "magasinId" TEXT,
    "caisseId" TEXT,
    "sessionCaisseId" TEXT,
    "contexte" TEXT NOT NULL DEFAULT 'vente',
    "codeBarres" TEXT NOT NULL,
    "resultat" TEXT NOT NULL,
    "produitId" TEXT,
    "varianteId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'camera',
    "scanneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanPos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EvenementPos" (
    "seq" BIGSERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "magasinId" TEXT,
    "caisseId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvenementPos_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MutationPos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "appareilId" TEXT,
    "userId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'appliquee',
    "resultat" JSONB NOT NULL,
    "creeLocalAt" TIMESTAMP(3),
    "recueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutationPos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Promotion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "valeur" DOUBLE PRECISION,
    "regles" JSONB NOT NULL DEFAULT '{}',
    "cumulable" BOOLEAN NOT NULL DEFAULT false,
    "priorite" INTEGER NOT NULL DEFAULT 0,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "magasinIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "codePromoId" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "utilisations" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MouvementFidelite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "commandeId" TEXT,
    "motif" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementFidelite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MouvementCredit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "soldeApres" DOUBLE PRECISION NOT NULL,
    "commandeId" TEXT,
    "paiementVenteId" TEXT,
    "echeanceAt" TIMESTAMP(3),
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouvementCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AvoirClient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "code" TEXT NOT NULL,
    "montantInitial" DOUBLE PRECISION NOT NULL,
    "solde" DOUBLE PRECISION NOT NULL,
    "retourId" TEXT,
    "expireAt" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvoirClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "NumeroSerie" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "varianteId" TEXT,
    "numero" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_stock',
    "entrepotId" TEXT,
    "lotId" TEXT,
    "commandeId" TEXT,
    "ligneCommandeId" TEXT,
    "clientId" TEXT,
    "venduAt" TIMESTAMP(3),
    "garantieFinAt" TIMESTAMP(3),
    "coutAchat" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NumeroSerie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ComptageInventaire" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entrepotId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'partiel',
    "perimetre" JSONB NOT NULL DEFAULT '{}',
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "creePar" TEXT NOT NULL,
    "validePar" TEXT,
    "demarreAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valideAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "ComptageInventaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LigneComptage" (
    "id" TEXT NOT NULL,
    "comptageId" TEXT NOT NULL,
    "cleArticle" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "varianteId" TEXT,
    "quantiteTheorique" INTEGER NOT NULL,
    "quantiteComptee" INTEGER,
    "ecart" INTEGER,
    "comptePar" TEXT,
    "compteAt" TIMESTAMP(3),

    CONSTRAINT "LigneComptage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TransfertStock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "entrepotSourceId" TEXT NOT NULL,
    "entrepotDestinationId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "demandePar" TEXT NOT NULL,
    "approuvePar" TEXT,
    "expedieAt" TIMESTAMP(3),
    "recuAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransfertStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LigneTransfert" (
    "id" TEXT NOT NULL,
    "transfertId" TEXT NOT NULL,
    "cleArticle" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "varianteId" TEXT,
    "quantiteDemandee" INTEGER NOT NULL,
    "quantiteExpediee" INTEGER NOT NULL DEFAULT 0,
    "quantiteRecue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LigneTransfert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BonCommande" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "entrepotId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "montantTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dateAttendue" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'manuel',
    "creePar" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonCommande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LigneBonCommande" (
    "id" TEXT NOT NULL,
    "bonCommandeId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "varianteId" TEXT,
    "quantite" INTEGER NOT NULL,
    "quantiteRecue" INTEGER NOT NULL DEFAULT 0,
    "prixUnitaire" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "LigneBonCommande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReceptionAchat" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bonCommandeId" TEXT,
    "fournisseurId" TEXT,
    "entrepotId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "reference" TEXT,
    "recuPar" TEXT NOT NULL,
    "recuAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceptionAchat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LigneReception" (
    "id" TEXT NOT NULL,
    "receptionId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "varianteId" TEXT,
    "quantite" INTEGER NOT NULL,
    "coutUnitaire" DOUBLE PRECISION NOT NULL,
    "lotId" TEXT,
    "numerosSerie" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "LigneReception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "JournalAudit" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "magasinId" TEXT,
    "caisseId" TEXT,
    "appareilId" TEXT,
    "sessionCaisseId" TEXT,
    "userId" TEXT,
    "userNom" TEXT,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT,
    "avant" JSONB,
    "apres" JSONB,
    "motif" TEXT,
    "ip" TEXT,
    "hashPrecedent" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReglagesPos" (
    "tenantId" TEXT NOT NULL,
    "typeCommerce" TEXT NOT NULL DEFAULT 'RETAIL',
    "mode" TEXT NOT NULL DEFAULT 'simple',
    "flags" JSONB NOT NULL DEFAULT '{}',
    "reglages" JSONB NOT NULL DEFAULT '{}',
    "onboarding" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReglagesPos_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Magasin_tenantId_idx" ON "Magasin"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Magasin_tenantId_nom_key" ON "Magasin"("tenantId", "nom");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Caisse_tenantId_idx" ON "Caisse"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Caisse_magasinId_nom_key" ON "Caisse"("magasinId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppareilPos_codeAppairage_key" ON "AppareilPos"("codeAppairage");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppareilPos_tokenHash_key" ON "AppareilPos"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppareilPos_tenantId_statut_idx" ON "AppareilPos"("tenantId", "statut");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppareilPos_caisseId_idx" ON "AppareilPos"("caisseId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SessionCaisse_caisseOuverteId_key" ON "SessionCaisse"("caisseOuverteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SessionCaisse_tenantId_statut_idx" ON "SessionCaisse"("tenantId", "statut");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SessionCaisse_caisseId_ouverteAt_idx" ON "SessionCaisse"("caisseId", "ouverteAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MouvementCaisse_sessionCaisseId_idx" ON "MouvementCaisse"("sessionCaisseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MouvementCaisse_tenantId_createdAt_idx" ON "MouvementCaisse"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaiementVente_commandeId_idx" ON "PaiementVente"("commandeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaiementVente_sessionCaisseId_idx" ON "PaiementVente"("sessionCaisseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaiementVente_tenantId_createdAt_idx" ON "PaiementVente"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaiementVente_tenantId_rapprochement_idx" ON "PaiementVente"("tenantId", "rapprochement");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PanierSuspendu_tenantId_magasinId_statut_idx" ON "PanierSuspendu"("tenantId", "magasinId", "statut");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScanPos_tenantId_caisseId_createdAt_idx" ON "ScanPos"("tenantId", "caisseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ScanPos_tenantId_scanId_key" ON "ScanPos"("tenantId", "scanId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EvenementPos_tenantId_caisseId_seq_idx" ON "EvenementPos"("tenantId", "caisseId", "seq");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EvenementPos_tenantId_seq_idx" ON "EvenementPos"("tenantId", "seq");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EvenementPos_createdAt_idx" ON "EvenementPos"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MutationPos_tenantId_statut_recueAt_idx" ON "MutationPos"("tenantId", "statut", "recueAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MutationPos_tenantId_cle_key" ON "MutationPos"("tenantId", "cle");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Promotion_tenantId_actif_idx" ON "Promotion"("tenantId", "actif");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MouvementFidelite_tenantId_clientId_createdAt_idx" ON "MouvementFidelite"("tenantId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MouvementFidelite_commandeId_idx" ON "MouvementFidelite"("commandeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MouvementCredit_tenantId_clientId_createdAt_idx" ON "MouvementCredit"("tenantId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MouvementCredit_commandeId_idx" ON "MouvementCredit"("commandeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AvoirClient_tenantId_clientId_idx" ON "AvoirClient"("tenantId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AvoirClient_tenantId_code_key" ON "AvoirClient"("tenantId", "code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NumeroSerie_tenantId_produitId_statut_idx" ON "NumeroSerie"("tenantId", "produitId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NumeroSerie_tenantId_numero_key" ON "NumeroSerie"("tenantId", "numero");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ComptageInventaire_tenantId_statut_idx" ON "ComptageInventaire"("tenantId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LigneComptage_comptageId_cleArticle_key" ON "LigneComptage"("comptageId", "cleArticle");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TransfertStock_tenantId_statut_idx" ON "TransfertStock"("tenantId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TransfertStock_tenantId_numero_key" ON "TransfertStock"("tenantId", "numero");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LigneTransfert_produitId_idx" ON "LigneTransfert"("produitId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LigneTransfert_transfertId_cleArticle_key" ON "LigneTransfert"("transfertId", "cleArticle");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BonCommande_tenantId_statut_idx" ON "BonCommande"("tenantId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BonCommande_tenantId_numero_key" ON "BonCommande"("tenantId", "numero");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LigneBonCommande_bonCommandeId_idx" ON "LigneBonCommande"("bonCommandeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LigneBonCommande_produitId_idx" ON "LigneBonCommande"("produitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReceptionAchat_tenantId_recuAt_idx" ON "ReceptionAchat"("tenantId", "recuAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReceptionAchat_bonCommandeId_idx" ON "ReceptionAchat"("bonCommandeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LigneReception_receptionId_idx" ON "LigneReception"("receptionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LigneReception_produitId_idx" ON "LigneReception"("produitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JournalAudit_tenantId_seq_idx" ON "JournalAudit"("tenantId", "seq");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JournalAudit_tenantId_createdAt_idx" ON "JournalAudit"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JournalAudit_tenantId_entite_entiteId_idx" ON "JournalAudit"("tenantId", "entite", "entiteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Variante_codeBarres_idx" ON "Variante"("codeBarres");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Variante_produitId_idx" ON "Variante"("produitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Client_tenantId_telephone_idx" ON "Client"("tenantId", "telephone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Client_tenantId_codeClient_idx" ON "Client"("tenantId", "codeClient");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Commande_tenantId_createdAt_idx" ON "Commande"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Commande_tenantId_canal_createdAt_idx" ON "Commande"("tenantId", "canal", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Commande_sessionCaisseId_idx" ON "Commande"("sessionCaisseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LigneCommande_commandeId_idx" ON "LigneCommande"("commandeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockEntrepot_produitId_idx" ON "StockEntrepot"("produitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockMouvement_commandeId_idx" ON "StockMouvement"("commandeId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Magasin" ADD CONSTRAINT "Magasin_entrepotId_fkey" FOREIGN KEY ("entrepotId") REFERENCES "Entrepot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Caisse" ADD CONSTRAINT "Caisse_magasinId_fkey" FOREIGN KEY ("magasinId") REFERENCES "Magasin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "SessionCaisse" ADD CONSTRAINT "SessionCaisse_caisseId_fkey" FOREIGN KEY ("caisseId") REFERENCES "Caisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MouvementCaisse" ADD CONSTRAINT "MouvementCaisse_sessionCaisseId_fkey" FOREIGN KEY ("sessionCaisseId") REFERENCES "SessionCaisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PaiementVente" ADD CONSTRAINT "PaiementVente_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "NumeroSerie" ADD CONSTRAINT "NumeroSerie_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LigneComptage" ADD CONSTRAINT "LigneComptage_comptageId_fkey" FOREIGN KEY ("comptageId") REFERENCES "ComptageInventaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LigneComptage" ADD CONSTRAINT "LigneComptage_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LigneTransfert" ADD CONSTRAINT "LigneTransfert_transfertId_fkey" FOREIGN KEY ("transfertId") REFERENCES "TransfertStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LigneTransfert" ADD CONSTRAINT "LigneTransfert_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "BonCommande" ADD CONSTRAINT "BonCommande_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LigneBonCommande" ADD CONSTRAINT "LigneBonCommande_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "BonCommande"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LigneBonCommande" ADD CONSTRAINT "LigneBonCommande_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LigneReception" ADD CONSTRAINT "LigneReception_receptionId_fkey" FOREIGN KEY ("receptionId") REFERENCES "ReceptionAchat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LigneReception" ADD CONSTRAINT "LigneReception_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────── 5. SQL HORS SCHÉMA — à exécuter à la main en production ─────────────
-- Rejouable sans effet de bord. `prisma db push` ne crée ni ne supprime rien de ce qui suit.

-- 5.1 Les anciennes ventes de caisse (reconnues par le client fictif pos@local) passent sur le canal "pos".
UPDATE "Commande" SET "canal" = 'pos' WHERE "clientEmail" = 'pos@local' AND "canal" <> 'pos';

-- 5.2 Journal d'audit en ajout seul : toute modification ou suppression est refusée par la base.
-- (Un administrateur de la base peut toujours retirer le trigger : la chaîne de
-- hachage de lib/pos/audit.ts révèle alors la falsification.)
CREATE OR REPLACE FUNCTION journal_audit_immuable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'JournalAudit est en ajout seul : % interdit', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS journal_audit_immuable ON "JournalAudit";
CREATE TRIGGER journal_audit_immuable BEFORE UPDATE OR DELETE ON "JournalAudit"
  FOR EACH ROW EXECUTE FUNCTION journal_audit_immuable();

DROP TRIGGER IF EXISTS journal_audit_immuable_vidage ON "JournalAudit";
CREATE TRIGGER journal_audit_immuable_vidage BEFORE TRUNCATE ON "JournalAudit"
  FOR EACH STATEMENT EXECUTE FUNCTION journal_audit_immuable();

-- 5.3 Répartition initiale du stock : tout le stock existant est rangé dans
-- l'entrepôt principal de chaque boutique (invariant : somme des StockEntrepot
-- d'un article = Produit.stock / Variante.stock).
-- FACULTATIF : lib/pos/stock.ts n'en dépend pas. Pour lui, l'entrepôt principal
-- contient toujours « le total moins ce qui est rangé dans les autres entrepôts »,
-- et sa ligne StockEntrepot est recopiée à chaque mouvement. Cette étape ne sert
-- qu'aux écrans qui lisent directement StockEntrepot (page Entrepôts).

-- a) Un entrepôt principal pour chaque boutique qui a des produits physiques et aucun entrepôt.
INSERT INTO "Entrepot" ("id", "tenantId", "nom", "pays", "principal", "actif", "createdAt")
SELECT 'ent_' || md5(t."id"), t."id", 'Entrepôt principal', t."pays", true, true, CURRENT_TIMESTAMP
FROM "Tenant" t
WHERE EXISTS (SELECT 1 FROM "Produit" p WHERE p."tenantId" = t."id" AND p."type" = 'physique')
  AND NOT EXISTS (SELECT 1 FROM "Entrepot" e WHERE e."tenantId" = t."id")
ON CONFLICT ("id") DO NOTHING;

-- b) Produits sans variante : une ligne dans l'entrepôt principal (le marqué « principal », sinon le plus ancien).
INSERT INTO "StockEntrepot" ("id", "entrepotId", "produitId", "varianteId", "quantite", "stockMin")
SELECT 'se_' || md5(p."id"), e."id", p."id", NULL, p."stock", 0
FROM "Produit" p
JOIN LATERAL (
  SELECT "id" FROM "Entrepot" WHERE "tenantId" = p."tenantId" AND "actif" ORDER BY "principal" DESC, "createdAt" ASC LIMIT 1
) e ON true
WHERE p."type" = 'physique'
  AND NOT EXISTS (SELECT 1 FROM "Variante" v WHERE v."produitId" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "StockEntrepot" s WHERE s."produitId" = p."id" AND s."varianteId" IS NULL)
ON CONFLICT ("id") DO NOTHING;

-- c) Variantes : une ligne par variante.
INSERT INTO "StockEntrepot" ("id", "entrepotId", "produitId", "varianteId", "quantite", "stockMin")
SELECT 'se_' || md5(v."id"), e."id", p."id", v."id", v."stock", 0
FROM "Variante" v
JOIN "Produit" p ON p."id" = v."produitId"
JOIN LATERAL (
  SELECT "id" FROM "Entrepot" WHERE "tenantId" = p."tenantId" AND "actif" ORDER BY "principal" DESC, "createdAt" ASC LIMIT 1
) e ON true
WHERE p."type" = 'physique'
  AND NOT EXISTS (SELECT 1 FROM "StockEntrepot" s WHERE s."varianteId" = v."id")
ON CONFLICT ("id") DO NOTHING;
