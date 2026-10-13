-- Rattrapage (2/2) : index, contraintes d'unicité et clés étrangères créés jusqu'ici par
-- `prisma db push` sans migration. Généré par `prisma migrate diff` (historique → schéma),
-- rendu rejouable (IF NOT EXISTS / duplicate_object) : sans effet sur une base déjà à jour.
-- DropIndex
DROP INDEX IF EXISTS "Tenant_email_key";

-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Commande" ALTER COLUMN "clientEmail" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MembreEquipe" ALTER COLUMN "role" SET DEFAULT 'gerant';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AccesFormation_token_key" ON "AccesFormation"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccesFormation_produitId_idx" ON "AccesFormation"("produitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivationLicence_cleId_idx" ON "ActivationLicence"("cleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAxiaAction_adminId_statut_idx" ON "AdminAxiaAction"("adminId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AffiliationCommission_commandeId_key" ON "AffiliationCommission"("commandeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AffiliationCommission_affilieurId_idx" ON "AffiliationCommission"("affilieurId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AffiliationCommission_tenantId_idx" ON "AffiliationCommission"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AffiliationEntrante_tenantId_idx" ON "AffiliationEntrante"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AffiliationLien_code_key" ON "AffiliationLien"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AffiliationLien_affilieurId_idx" ON "AffiliationLien"("affilieurId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AffiliationLien_tenantId_idx" ON "AffiliationLien"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Affilie_codeParrainage_key" ON "Affilie"("codeParrainage");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Affilie_portalToken_key" ON "Affilie"("portalToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Affilie_tenantId_idx" ON "Affilie"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Affilie_tenantId_email_key" ON "Affilie"("tenantId", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AffilieClic_affilieId_createdAt_idx" ON "AffilieClic"("affilieId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentDecision_tenantId_agentId_idx" ON "AgentDecision"("tenantId", "agentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentDecision_tenantId_createdAt_idx" ON "AgentDecision"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentGoal_tenantId_statut_idx" ON "AgentGoal"("tenantId", "statut");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentMemory_tenantId_agentId_idx" ON "AgentMemory"("tenantId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AgentMemory_tenantId_agentId_cle_key" ON "AgentMemory"("tenantId", "agentId", "cle");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentTask_tenantId_toAgent_statut_idx" ON "AgentTask"("tenantId", "toAgent", "statut");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AutomationWorkflow_tenantId_type_actif_idx" ON "AutomationWorkflow"("tenantId", "type", "actif");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AxiaConversation_tenantId_updatedAt_idx" ON "AxiaConversation"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AxiaProposition_tenantId_statut_idx" ON "AxiaProposition"("tenantId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AxiaProposition_tenantId_cle_key" ON "AxiaProposition"("tenantId", "cle");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BadgeMarchand_tenantId_idx" ON "BadgeMarchand"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BadgeMarchand_tenantId_type_key" ON "BadgeMarchand"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BundleProduit_produitId_key" ON "BundleProduit"("produitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CampagneEmail_tenantId_idx" ON "CampagneEmail"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CategorieProduit_tenantId_ordre_idx" ON "CategorieProduit"("tenantId", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CategorieProduit_tenantId_slug_key" ON "CategorieProduit"("tenantId", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChargeExploitation_tenantId_dateEnregistrement_idx" ON "ChargeExploitation"("tenantId", "dateEnregistrement");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChargeExploitation_tenantId_statut_idx" ON "ChargeExploitation"("tenantId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CleLicence_cle_key" ON "CleLicence"("cle");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CleLicence_licenceProduitId_statut_idx" ON "CleLicence"("licenceProduitId", "statut");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CodeVerification_email_code_idx" ON "CodeVerification"("email", "code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Commande_trackingToken_key" ON "Commande"("trackingToken");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Commande_livreurToken_key" ON "Commande"("livreurToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommandeFournisseur_tenantId_statut_idx" ON "CommandeFournisseur"("tenantId", "statut");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommissionAffilie_tenantId_idx" ON "CommissionAffilie"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommissionAffilie_affilieId_idx" ON "CommissionAffilie"("affilieId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CompteAcheteur_token_idx" ON "CompteAcheteur"("token");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CompteAcheteur_tenantId_email_key" ON "CompteAcheteur"("tenantId", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConnecteurConfig_tenantId_idx" ON "ConnecteurConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ConnecteurConfig_tenantId_type_key" ON "ConnecteurConfig"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ElementBundle_bundleId_produitInclusId_key" ON "ElementBundle"("bundleId", "produitInclusId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Entrepot_tenantId_idx" ON "Entrepot"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Facture_commandeId_key" ON "Facture"("commandeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Facture_numero_key" ON "Facture"("numero");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Facture_tenantId_idx" ON "Facture"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Formation_produitId_key" ON "Formation"("produitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Fournisseur_tenantId_actif_idx" ON "Fournisseur"("tenantId", "actif");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LicenceProduit_produitId_key" ON "LicenceProduit"("produitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LotTracabilite_tenantId_produitId_idx" ON "LotTracabilite"("tenantId", "produitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LotTracabilite_tenantId_statut_idx" ON "LotTracabilite"("tenantId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LotTracabilite_tenantId_codeLot_key" ON "LotTracabilite"("tenantId", "codeLot");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MembreEquipe_inviteToken_key" ON "MembreEquipe"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MembreEquipe_userId_tenantId_key" ON "MembreEquipe"("userId", "tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessageRecu_tenantId_source_idx" ON "MessageRecu"("tenantId", "source");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessageRecu_tenantId_de_idx" ON "MessageRecu"("tenantId", "de");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MessageRecu_tenantId_lu_idx" ON "MessageRecu"("tenantId", "lu");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationMarchand_tenantId_lu_idx" ON "NotificationMarchand"("tenantId", "lu");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NotificationMarchand_tenantId_createdAt_idx" ON "NotificationMarchand"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaiementCommission_tenantId_statut_idx" ON "PaiementCommission"("tenantId", "statut");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PopupCampagne_tenantId_actif_idx" ON "PopupCampagne"("tenantId", "actif");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostPlanifie_tenantId_statut_planifieLe_idx" ON "PostPlanifie"("tenantId", "statut", "planifieLe");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Produit_tenantId_codeBarres_key" ON "Produit"("tenantId", "codeBarres");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProduitFichier_produitId_key" ON "ProduitFichier"("produitId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProgrammeAffiliation_tenantId_key" ON "ProgrammeAffiliation"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProgressionLecon_commandeId_idx" ON "ProgressionLecon"("commandeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProgressionLecon_leconId_clientEmail_key" ON "ProgressionLecon"("leconId", "clientEmail");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProprietaireBoutique_tenantId_idx" ON "ProprietaireBoutique"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProprietaireBoutique_userId_tenantId_key" ON "ProprietaireBoutique"("userId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ReactionSociale_postId_tenantId_key" ON "ReactionSociale"("postId", "tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ReglePort_tenantId_actif_idx" ON "ReglePort"("tenantId", "actif");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetourRMA_tenantId_statut_idx" ON "RetourRMA"("tenantId", "statut");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetourRMA_commandeId_idx" ON "RetourRMA"("commandeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StockEntrepot_entrepotId_produitId_varianteId_key" ON "StockEntrepot"("entrepotId", "produitId", "varianteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockMouvement_tenantId_produitId_createdAt_idx" ON "StockMouvement"("tenantId", "produitId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockMouvement_tenantId_createdAt_idx" ON "StockMouvement"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockReservation_tenantId_produitId_idx" ON "StockReservation"("tenantId", "produitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockReservation_sessionId_idx" ON "StockReservation"("sessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StockReservation_expireAt_idx" ON "StockReservation"("expireAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Telechargement_token_key" ON "Telechargement"("token");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Theme_tenantId_slug_key" ON "Theme"("tenantId", "slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VariantePrix_tenantId_idx" ON "VariantePrix"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "VariantePrix_produitId_slug_key" ON "VariantePrix"("produitId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_tenantId_key" ON "Wallet"("tenantId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Produit" ADD CONSTRAINT "Produit_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Telechargement" ADD CONSTRAINT "Telechargement_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "LotTracabilite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "NotificationMarchand" ADD CONSTRAINT "NotificationMarchand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "MembreEquipe" ADD CONSTRAINT "MembreEquipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PostSocial" ADD CONSTRAINT "PostSocial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ReactionSociale" ADD CONSTRAINT "ReactionSociale_postId_fkey" FOREIGN KEY ("postId") REFERENCES "PostSocial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CommentaireSocial" ADD CONSTRAINT "CommentaireSocial_postId_fkey" FOREIGN KEY ("postId") REFERENCES "PostSocial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ProprietaireBoutique" ADD CONSTRAINT "ProprietaireBoutique_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ProprietaireBoutique" ADD CONSTRAINT "ProprietaireBoutique_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Theme" ADD CONSTRAINT "Theme_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Publicite" ADD CONSTRAINT "Publicite_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Retrait" ADD CONSTRAINT "Retrait_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AffiliationLien" ADD CONSTRAINT "AffiliationLien_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AffiliationLien" ADD CONSTRAINT "AffiliationLien_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AffiliationCommission" ADD CONSTRAINT "AffiliationCommission_lienId_fkey" FOREIGN KEY ("lienId") REFERENCES "AffiliationLien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AffiliationCommission" ADD CONSTRAINT "AffiliationCommission_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "RetourRMA" ADD CONSTRAINT "RetourRMA_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Facture" ADD CONSTRAINT "Facture_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Entrepot" ADD CONSTRAINT "Entrepot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StockEntrepot" ADD CONSTRAINT "StockEntrepot_entrepotId_fkey" FOREIGN KEY ("entrepotId") REFERENCES "Entrepot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StockEntrepot" ADD CONSTRAINT "StockEntrepot_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StockEntrepot" ADD CONSTRAINT "StockEntrepot_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "Variante"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CommandeFournisseur" ADD CONSTRAINT "CommandeFournisseur_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CommandeFournisseur" ADD CONSTRAINT "CommandeFournisseur_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CommandeFournisseur" ADD CONSTRAINT "CommandeFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AffiliationEntrante" ADD CONSTRAINT "AffiliationEntrante_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PaiementCommission" ADD CONSTRAINT "PaiementCommission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ProgrammeAffiliation" ADD CONSTRAINT "ProgrammeAffiliation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Affilie" ADD CONSTRAINT "Affilie_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Affilie" ADD CONSTRAINT "Affilie_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "ProgrammeAffiliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AffilieClic" ADD CONSTRAINT "AffilieClic_affilieId_fkey" FOREIGN KEY ("affilieId") REFERENCES "Affilie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CommissionAffilie" ADD CONSTRAINT "CommissionAffilie_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CommissionAffilie" ADD CONSTRAINT "CommissionAffilie_affilieId_fkey" FOREIGN KEY ("affilieId") REFERENCES "Affilie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "VariantePrix" ADD CONSTRAINT "VariantePrix_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ProduitFichier" ADD CONSTRAINT "ProduitFichier_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FichierNumerique" ADD CONSTRAINT "FichierNumerique_produitFichierId_fkey" FOREIGN KEY ("produitFichierId") REFERENCES "ProduitFichier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Formation" ADD CONSTRAINT "Formation_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Chapitre" ADD CONSTRAINT "Chapitre_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "Formation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Lecon" ADD CONSTRAINT "Lecon_chapitreId_fkey" FOREIGN KEY ("chapitreId") REFERENCES "Chapitre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ProgressionLecon" ADD CONSTRAINT "ProgressionLecon_leconId_fkey" FOREIGN KEY ("leconId") REFERENCES "Lecon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AccesFormation" ADD CONSTRAINT "AccesFormation_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LicenceProduit" ADD CONSTRAINT "LicenceProduit_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CleLicence" ADD CONSTRAINT "CleLicence_licenceProduitId_fkey" FOREIGN KEY ("licenceProduitId") REFERENCES "LicenceProduit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ActivationLicence" ADD CONSTRAINT "ActivationLicence_cleId_fkey" FOREIGN KEY ("cleId") REFERENCES "CleLicence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "BundleProduit" ADD CONSTRAINT "BundleProduit_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ElementBundle" ADD CONSTRAINT "ElementBundle_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "BundleProduit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ElementBundle" ADD CONSTRAINT "ElementBundle_produitInclusId_fkey" FOREIGN KEY ("produitInclusId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StockMouvement" ADD CONSTRAINT "StockMouvement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StockMouvement" ADD CONSTRAINT "StockMouvement_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StockMouvement" ADD CONSTRAINT "StockMouvement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "LotTracabilite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LotTracabilite" ADD CONSTRAINT "LotTracabilite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "LotTracabilite" ADD CONSTRAINT "LotTracabilite_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ChargeExploitation" ADD CONSTRAINT "ChargeExploitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CategorieProduit" ADD CONSTRAINT "CategorieProduit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

