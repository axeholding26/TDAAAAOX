-- Rattrapage : ces tables existaient en base (créées par `prisma db push`) sans aucune migration.
-- Sans elles, l'historique ne se rejoue pas sur une base vide (fiabiliser_parcours modifie "RetourRMA").
-- Rejouable (IF NOT EXISTS) : sans effet sur une base qui les possède déjà.
-- Index et clés étrangères : voir la migration 20261013120000_rattrapage_index_cles.

CREATE TABLE IF NOT EXISTS "Telechargement" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expireAt" TIMESTAMP(3),
    "telecharge" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Telechargement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationMarchand" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "lien" TEXT,
    "commandeId" TEXT,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationMarchand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PostSocial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'post',
    "contenu" TEXT,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "produitId" TEXT,
    "produitNom" TEXT,
    "produitPrix" DOUBLE PRECISION,
    "produitImg" TEXT,
    "scoreValeur" DOUBLE PRECISION,
    "scoreLabel" TEXT,
    "sondageOptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sondageVotes" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "vues" INTEGER NOT NULL DEFAULT 0,
    "expireAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostSocial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReactionSociale" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '❤️',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReactionSociale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommentaireSocial" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "auteur" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentaireSocial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProprietaireBoutique" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProprietaireBoutique_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CodeVerification" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expireAt" TIMESTAMP(3) NOT NULL,
    "utilise" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Theme" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "nom" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "badge" TEXT,
    "config" JSONB NOT NULL,
    "effetId" TEXT,
    "apercu" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "premium" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PostPlanifie" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plateforme" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "hashtags" TEXT[],
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "planifieLe" TIMESTAMP(3) NOT NULL,
    "publieLe" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'planifie',
    "externalId" TEXT,
    "erreur" TEXT,
    "noteInterne" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostPlanifie_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConnecteurConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'inactif',
    "pageId" TEXT,
    "igUserId" TEXT,
    "accessToken" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnecteurConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VideoGeneree" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT 'product',
    "videoUrl" TEXT,
    "thumbnailUrl" TEXT,
    "duree" INTEGER,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "requestId" TEXT,
    "erreur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoGeneree_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VoixOff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "voixId" TEXT NOT NULL DEFAULT 'rachel',
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "audioUrl" TEXT,
    "duree" INTEGER,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoixOff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Campagne" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plateforme" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "objectif" TEXT NOT NULL DEFAULT 'conversions',
    "budget" DOUBLE PRECISION NOT NULL,
    "budgetJour" DOUBLE PRECISION,
    "devise" TEXT NOT NULL DEFAULT 'XOF',
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "depense" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clics" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "cpc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "externalId" TEXT,
    "adSetId" TEXT,
    "ciblePays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cibleAge" TEXT NOT NULL DEFAULT '18-45',
    "cibleInterets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "titreAd" TEXT,
    "descriptionAd" TEXT,
    "imageAdUrl" TEXT,
    "videoAdUrl" TEXT,
    "urlDestination" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campagne_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Publicite" (
    "id" TEXT NOT NULL,
    "campagneId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "urlClic" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'active',
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clics" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Publicite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VeilleConcurrentielle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nomConcurrent" TEXT NOT NULL,
    "urlConcurrent" TEXT,
    "categorie" TEXT,
    "produitNom" TEXT,
    "prixDetecte" DOUBLE PRECISION,
    "descriptionNote" TEXT,
    "alerteActive" BOOLEAN NOT NULL DEFAULT true,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VeilleConcurrentielle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CampagneSMS" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "segment" TEXT NOT NULL DEFAULT 'tous',
    "nbEnvoyes" INTEGER NOT NULL DEFAULT 0,
    "nbLivres" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampagneSMS_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Wallet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "solde" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRecu" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRetire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "commandeId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Retrait" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "methode" TEXT NOT NULL,
    "destinataire" TEXT NOT NULL,
    "operateur" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Retrait_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PixelEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "valeur" DOUBLE PRECISION,
    "devise" TEXT,
    "produitId" TEXT,
    "commandeId" TEXT,
    "source" TEXT,
    "campagneId" TEXT,
    "sessionId" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PixelEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AffiliationLien" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "affilieurId" TEXT NOT NULL,
    "affilieId" TEXT,
    "produitId" TEXT,
    "code" TEXT NOT NULL,
    "clics" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "montantGenere" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cookieJours" INTEGER NOT NULL DEFAULT 30,
    "derniereConversion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliationLien_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AffiliationCommission" (
    "id" TEXT NOT NULL,
    "lienId" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "affilieurId" TEXT NOT NULL,
    "montantCommande" DOUBLE PRECISION NOT NULL,
    "taux" DOUBLE PRECISION NOT NULL,
    "montantGagne" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'pending',
    "payeeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliationCommission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentMemory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromAgent" TEXT NOT NULL,
    "toAgent" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'pending',
    "resultat" JSONB,
    "priorite" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentDecision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "donnees" JSONB NOT NULL DEFAULT '{}',
    "impactEstime" DOUBLE PRECISION,
    "impactReel" DOUBLE PRECISION,
    "statut" TEXT NOT NULL DEFAULT 'effectuee',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AxiaConversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "titre" TEXT NOT NULL DEFAULT 'Nouvelle conversation',
    "messages" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxiaConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentGoal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "cible" DOUBLE PRECISION NOT NULL,
    "actuel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "deadline" TIMESTAMP(3) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessageRecu" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "de" TEXT NOT NULL,
    "nom" TEXT,
    "corps" TEXT NOT NULL,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "repondu" BOOLEAN NOT NULL DEFAULT false,
    "direction" TEXT NOT NULL DEFAULT 'entrant',
    "waMessageId" TEXT,
    "commandeId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageRecu_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CampagneEmail" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sujet" TEXT NOT NULL,
    "corps" TEXT NOT NULL,
    "segment" TEXT NOT NULL DEFAULT 'tous',
    "nbEnvoyes" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'envoye',
    "source" TEXT NOT NULL DEFAULT 'resend',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampagneEmail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReglePort" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "zone" TEXT NOT NULL DEFAULT '',
    "poidsMin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "poidsMax" DOUBLE PRECISION,
    "montantMin" DOUBLE PRECISION,
    "montantMax" DOUBLE PRECISION,
    "frais" DOUBLE PRECISION NOT NULL,
    "fraisKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "delai" TEXT NOT NULL DEFAULT '3-5 jours',
    "transporteur" TEXT,
    "modeLivraison" TEXT NOT NULL DEFAULT 'livreur_local',
    "gratuit" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReglePort_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Fournisseur" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "pays" TEXT NOT NULL DEFAULT 'Chine',
    "type" TEXT NOT NULL DEFAULT 'aliexpress',
    "url" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "delaiLivraison" INTEGER,
    "fiabilite" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "margeAuto" DOUBLE PRECISION NOT NULL DEFAULT 0.30,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "catalogueCount" INTEGER NOT NULL DEFAULT 0,
    "livraisonsTotal" INTEGER NOT NULL DEFAULT 0,
    "livraisonsOk" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "typeEntreprise" TEXT NOT NULL DEFAULT 'inconnu',
    "anneeCreation" INTEGER,
    "nbEmployes" INTEGER,
    "capaciteProduction" TEXT,
    "adresseUsine" TEXT,
    "categoriesProduites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "marchesExport" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photosUsine" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videoUsine" TEXT,
    "equipements" TEXT,
    "numeroLicence" TEXT,
    "protectionPaiement" TEXT,
    "personnalisation" BOOLEAN,
    "privateLabel" BOOLEAN,
    "packagingPerso" BOOLEAN,
    "echantillonPossible" BOOLEAN,
    "inspectionAcceptee" BOOLEAN,
    "paiementHorsPlateforme" BOOLEAN NOT NULL DEFAULT false,
    "scoreGlobal" INTEGER,
    "scoreFabricant" INTEGER,
    "niveauRisque" TEXT,
    "labelVerifie" BOOLEAN NOT NULL DEFAULT false,
    "signatureRisque" TEXT,
    "analyseLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fournisseur_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RetourRMA" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "clientNom" TEXT NOT NULL,
    "clientEmail" TEXT,
    "raison" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'remboursement',
    "statut" TEXT NOT NULL DEFAULT 'ouvert',
    "montant" DOUBLE PRECISION,
    "notes" TEXT,
    "preuveUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lignes" JSONB,
    "modeRemboursement" TEXT,
    "sessionCaisseId" TEXT,
    "avoirId" TEXT,
    "sansRecu" BOOLEAN NOT NULL DEFAULT false,
    "traitePar" TEXT,

    CONSTRAINT "RetourRMA_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Facture" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "clientNom" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "clientAdresse" TEXT,
    "lignes" JSONB NOT NULL,
    "montantHT" DOUBLE PRECISION NOT NULL,
    "tauxTVA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montantTVA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montantTTC" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "statut" TEXT NOT NULL DEFAULT 'emise',
    "pdfUrl" TEXT,
    "emiseAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Facture_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockReservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "varianteId" TEXT,
    "sessionId" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "expireAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PopupCampagne" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'popup',
    "declencheur" TEXT NOT NULL DEFAULT 'delai',
    "delaiSec" INTEGER NOT NULL DEFAULT 5,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ctaTexte" TEXT,
    "ctaUrl" TEXT,
    "imageUrl" TEXT,
    "codePromo" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "affichages" INTEGER NOT NULL DEFAULT 0,
    "clics" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PopupCampagne_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompteAcheteur" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "pays" TEXT,
    "passwordHash" TEXT,
    "token" TEXT,
    "tokenExpire" TIMESTAMP(3),
    "clientId" TEXT,
    "totalCommandes" INTEGER NOT NULL DEFAULT 0,
    "totalDepense" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompteAcheteur_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AutomationWorkflow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "delaiHeures" INTEGER NOT NULL DEFAULT 1,
    "canal" TEXT NOT NULL DEFAULT 'email',
    "sujet" TEXT,
    "message" TEXT NOT NULL,
    "declenchements" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BadgeMarchand" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '🏆',
    "obtenueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeMarchand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Entrepot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "ville" TEXT,
    "pays" TEXT NOT NULL DEFAULT 'Cameroun',
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entrepot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockEntrepot" (
    "id" TEXT NOT NULL,
    "entrepotId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "varianteId" TEXT,
    "quantite" INTEGER NOT NULL DEFAULT 0,
    "stockMin" INTEGER NOT NULL DEFAULT 0,
    "bloque" INTEGER NOT NULL DEFAULT 0,
    "endommage" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StockEntrepot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommandeFournisseur" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "motifAnnulation" TEXT,
    "reference" TEXT,
    "montantFournisseur" DOUBLE PRECISION,
    "delaiEstime" INTEGER,
    "trackingNo" TEXT,
    "notes" TEXT,
    "envoiAuto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommandeFournisseur_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AffiliationEntrante" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "marchand" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "categorie" TEXT,
    "commission" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "clics" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliationEntrante_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaiementCommission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "affilieurId" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "methode" TEXT NOT NULL DEFAULT 'mobile_money',
    "telephone" TEXT,
    "reference" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "notes" TEXT,
    "commissionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaiementCommission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProgrammeAffiliation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "typeCommission" TEXT NOT NULL DEFAULT 'pourcentage',
    "valeurCommission" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "dureeCookie" INTEGER NOT NULL DEFAULT 30,
    "seuilPaiement" DOUBLE PRECISION NOT NULL DEFAULT 5000,
    "tousLesProduits" BOOLEAN NOT NULL DEFAULT true,
    "produitIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tiersActifs" BOOLEAN NOT NULL DEFAULT false,
    "tier1Nom" TEXT NOT NULL DEFAULT 'Bronze',
    "tier1Max" INTEGER NOT NULL DEFAULT 10,
    "tier1Commission" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "tier2Nom" TEXT NOT NULL DEFAULT 'Argent',
    "tier2Max" INTEGER NOT NULL DEFAULT 50,
    "tier2Commission" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "tier3Nom" TEXT NOT NULL DEFAULT 'Or',
    "tier3Commission" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "multiNiveauActif" BOOLEAN NOT NULL DEFAULT false,
    "tauxSousAffilies" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "autoApprobation" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammeAffiliation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Affilie" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT,
    "programmeId" TEXT,
    "codeParrainage" TEXT NOT NULL,
    "portalToken" TEXT NOT NULL,
    "notes" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "clics" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "commissionTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionPending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affilie_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AffilieClic" (
    "id" TEXT NOT NULL,
    "affilieId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffilieClic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommissionAffilie" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "affilieId" TEXT NOT NULL,
    "commandeId" TEXT,
    "montantCommission" DOUBLE PRECISION NOT NULL,
    "valeurCommande" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionAffilie_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VariantePrix" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prix" DOUBLE PRECISION NOT NULL,
    "prixPromo" DOUBLE PRECISION,
    "periodeValidite" TEXT,
    "renouvAuto" BOOLEAN NOT NULL DEFAULT false,
    "autorisePromo" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantePrix_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProduitFichier" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "limitAchats" INTEGER,
    "motDePasse" TEXT,
    "filigrane" BOOLEAN NOT NULL DEFAULT false,
    "instructionsAchat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProduitFichier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FichierNumerique" (
    "id" TEXT NOT NULL,
    "produitFichierId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "taille" INTEGER,
    "mimeType" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FichierNumerique_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Formation" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "niveau" TEXT,
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "dureeMin" INTEGER,
    "certif" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Formation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Chapitre" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chapitre_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Lecon" (
    "id" TEXT NOT NULL,
    "chapitreId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'texte',
    "contenu" TEXT,
    "videoType" TEXT,
    "videoUrl" TEXT,
    "audioUrl" TEXT,
    "duree" INTEGER,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "gratuite" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lecon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProgressionLecon" (
    "id" TEXT NOT NULL,
    "leconId" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressionLecon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AccesFormation" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccesFormation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LicenceProduit" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "modeDistrib" TEXT NOT NULL DEFAULT 'auto',
    "formatAuto" TEXT NOT NULL DEFAULT 'uuid',
    "prefixe" TEXT,
    "longueur" INTEGER NOT NULL DEFAULT 16,
    "maxActivations" INTEGER NOT NULL DEFAULT 1,
    "dureeJours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LicenceProduit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CleLicence" (
    "id" TEXT NOT NULL,
    "licenceProduitId" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'disponible',
    "commandeId" TEXT,
    "acheteurEmail" TEXT,
    "expireAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleLicence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ActivationLicence" (
    "id" TEXT NOT NULL,
    "cleId" TEXT NOT NULL,
    "appareil" TEXT,
    "ipAdresse" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivationLicence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BundleProduit" (
    "id" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleProduit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ElementBundle" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "produitInclusId" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ElementBundle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockMouvement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "stockAvant" DOUBLE PRECISION NOT NULL,
    "stockApres" DOUBLE PRECISION NOT NULL,
    "motif" TEXT,
    "lotId" TEXT,
    "commandeId" TEXT,
    "creePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entrepotId" TEXT,
    "varianteId" TEXT,
    "transfertId" TEXT,
    "comptageId" TEXT,
    "receptionId" TEXT,

    CONSTRAINT "StockMouvement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LotTracabilite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "codeLot" TEXT NOT NULL,
    "quantiteInitiale" DOUBLE PRECISION NOT NULL,
    "quantiteRestante" DOUBLE PRECISION NOT NULL,
    "fournisseurNom" TEXT,
    "fournisseurRef" TEXT,
    "dateReception" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateExpiration" TIMESTAMP(3),
    "certification" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cout" DOUBLE PRECISION,
    "fournisseurId" TEXT,
    "entrepotId" TEXT,

    CONSTRAINT "LotTracabilite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChargeExploitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'XAF',
    "frequence" TEXT NOT NULL DEFAULT 'ponctuelle',
    "dateEnregistrement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEcheance" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'payee',
    "fournisseur" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "creePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "magasinId" TEXT,
    "sessionCaisseId" TEXT,

    CONSTRAINT "ChargeExploitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CategorieProduit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategorieProduit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AxiaProposition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "action" JSONB,
    "statut" TEXT NOT NULL DEFAULT 'nouveau',
    "resultat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AxiaProposition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdminAxiaAction" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "outil" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "message" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "resultat" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAxiaAction_pkey" PRIMARY KEY ("id")
);

-- Colonnes ajoutées par `db push` aux tables plus anciennes (rejouable).
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "codeClient" TEXT,
ADD COLUMN IF NOT EXISTS "creditBloque" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "creditEcheanceJours" INTEGER,
ADD COLUMN IF NOT EXISTS "creditPlafond" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "creditUtilise" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "niveauFidelite" TEXT NOT NULL DEFAULT 'bronze',
ADD COLUMN IF NOT EXISTS "pointsFidelite" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "segment" TEXT;

ALTER TABLE "Commande" ADD COLUMN IF NOT EXISTS "adresseExacte" TEXT,
ADD COLUMN IF NOT EXISTS "affilieurId" TEXT,
ADD COLUMN IF NOT EXISTS "appareilId" TEXT,
ADD COLUMN IF NOT EXISTS "caisseId" TEXT,
ADD COLUMN IF NOT EXISTS "canal" TEXT NOT NULL DEFAULT 'en_ligne',
ADD COLUMN IF NOT EXISTS "codRemis" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "codRemisAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "codRemisParId" TEXT,
ADD COLUMN IF NOT EXISTS "codeAffiliation" TEXT,
ADD COLUMN IF NOT EXISTS "codeEssais" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "codeLivraison" TEXT,
ADD COLUMN IF NOT EXISTS "commandeOrigineId" TEXT,
ADD COLUMN IF NOT EXISTS "creeLocalAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "echecCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "echecRaison" TEXT,
ADD COLUMN IF NOT EXISTS "expedieeAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "latitudeClient" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "livreeAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "livreurNom" TEXT,
ADD COLUMN IF NOT EXISTS "livreurPosition" JSONB,
ADD COLUMN IF NOT EXISTS "livreurTelephone" TEXT,
ADD COLUMN IF NOT EXISTS "livreurToken" TEXT,
ADD COLUMN IF NOT EXISTS "longitudeClient" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "magasinId" TEXT,
ADD COLUMN IF NOT EXISTS "mapsLienClient" TEXT,
ADD COLUMN IF NOT EXISTS "montantPaye" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "montantTaxes" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "paiementProvider" TEXT,
ADD COLUMN IF NOT EXISTS "paiementReference" TEXT,
ADD COLUMN IF NOT EXISTS "sessionCaisseId" TEXT,
ADD COLUMN IF NOT EXISTS "stripeChargeId" TEXT,
ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT,
ADD COLUMN IF NOT EXISTS "trackingToken" TEXT,
ADD COLUMN IF NOT EXISTS "vendeurId" TEXT;

ALTER TABLE "LigneCommande" ADD COLUMN IF NOT EXISTS "commentaire" TEXT,
ADD COLUMN IF NOT EXISTS "cout" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "lotId" TEXT,
ADD COLUMN IF NOT EXISTS "mesure" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "numeroSerieId" TEXT,
ADD COLUMN IF NOT EXISTS "offert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "prixOrigine" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "promotionId" TEXT,
ADD COLUMN IF NOT EXISTS "quantiteRetournee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "remise" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tauxTVA" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "varianteId" TEXT;

ALTER TABLE "Livreur" ADD COLUMN IF NOT EXISTS "valideAt" TIMESTAMP(3);

ALTER TABLE "MembreEquipe" ADD COLUMN IF NOT EXISTS "droitsPos" JSONB,
ADD COLUMN IF NOT EXISTS "inviteExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "inviteToken" TEXT,
ADD COLUMN IF NOT EXISTS "magasinIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "permissions" JSONB,
ADD COLUMN IF NOT EXISTS "statut" TEXT NOT NULL DEFAULT 'invite',
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN IF NOT EXISTS "userId" TEXT;

ALTER TABLE "Produit" ADD COLUMN IF NOT EXISTS "affiliationActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "champsCommande" JSONB,
ADD COLUMN IF NOT EXISTS "chariowProduitId" TEXT,
ADD COLUMN IF NOT EXISTS "codeBarres" TEXT,
ADD COLUMN IF NOT EXISTS "faq" JSONB,
ADD COLUMN IF NOT EXISTS "fichierNom" TEXT,
ADD COLUMN IF NOT EXISTS "fichierTaille" INTEGER,
ADD COLUMN IF NOT EXISTS "fichierUrl" TEXT,
ADD COLUMN IF NOT EXISTS "fournisseurId" TEXT,
ADD COLUMN IF NOT EXISTS "garantieMois" INTEGER,
ADD COLUMN IF NOT EXISTS "instructionsTelechargement" TEXT,
ADD COLUMN IF NOT EXISTS "marque" TEXT,
ADD COLUMN IF NOT EXISTS "masquerVentes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "nomFournisseur" TEXT,
ADD COLUMN IF NOT EXISTS "ogImage" TEXT,
ADD COLUMN IF NOT EXISTS "prixFournisseur" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "stockMin" INTEGER,
ADD COLUMN IF NOT EXISTS "stockReserve" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "suiviSerie" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "tauxCommissionAff" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "tauxTVA" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "texteBoutonAchat" TEXT,
ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'physique',
ADD COLUMN IF NOT EXISTS "uniteVente" TEXT NOT NULL DEFAULT 'piece',
ADD COLUMN IF NOT EXISTS "urlFournisseur" TEXT,
ADD COLUMN IF NOT EXISTS "videos" TEXT[],
ADD COLUMN IF NOT EXISTS "visibleListage" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "certifie" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "gtmId" TEXT,
ADD COLUMN IF NOT EXISTS "juridiction" TEXT NOT NULL DEFAULT 'CM',
ADD COLUMN IF NOT EXISTS "kycDocUrl" TEXT,
ADD COLUMN IF NOT EXISTS "kycStatut" TEXT NOT NULL DEFAULT 'non_soumis',
ADD COLUMN IF NOT EXISTS "metaPixelId" TEXT,
ADD COLUMN IF NOT EXISTS "parametresAffiliation" JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "parametresCommande" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "planPendingRef" TEXT,
ADD COLUMN IF NOT EXISTS "snapActif" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "snapPixelId" TEXT,
ADD COLUMN IF NOT EXISTS "tauxTVA" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tiktokPixelId" TEXT,
ADD COLUMN IF NOT EXISTS "trackingScripts" TEXT,
ADD COLUMN IF NOT EXISTS "whatsappNumero" TEXT;

ALTER TABLE "Variante" ADD COLUMN IF NOT EXISTS "actif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "codeBarres" TEXT,
ADD COLUMN IF NOT EXISTS "cout" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "dimension" TEXT,
ADD COLUMN IF NOT EXISTS "image" TEXT;
