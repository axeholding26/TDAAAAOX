-- Chantier LIVE ACADEMY + BOOTCAMPS + COMMUNAUTÉ
-- CreateTable
CREATE TABLE "Evenement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "produitId" TEXT,
    "bootcampId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'webinaire',
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "intervenants" JSONB NOT NULL DEFAULT '[]',
    "debut" TIMESTAMP(3) NOT NULL,
    "dureeMin" INTEGER NOT NULL DEFAULT 60,
    "fuseau" TEXT NOT NULL DEFAULT 'Africa/Douala',
    "recurrence" JSONB,
    "capacite" INTEGER,
    "placesPrises" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'programme',
    "fournisseur" TEXT NOT NULL DEFAULT 'lien_externe',
    "lienSalle" TEXT,
    "salleId" TEXT,
    "ouvertureMin" INTEGER NOT NULL DEFAULT 15,
    "rappels" INTEGER[] DEFAULT ARRAY[1440, 60]::INTEGER[],
    "lienSecours" TEXT,
    "messageSecours" TEXT,
    "ressources" JSONB NOT NULL DEFAULT '[]',
    "replayUrl" TEXT,
    "replayProduitId" TEXT,
    "certificat" BOOLEAN NOT NULL DEFAULT false,
    "annuleAt" TIMESTAMP(3),
    "raisonAnnulation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evenement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InscriptionLive" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evenementId" TEXT,
    "bootcampId" TEXT,
    "commandeId" TEXT,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'inscrite',
    "role" TEXT NOT NULL DEFAULT 'apprenant',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InscriptionLive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceLive" (
    "id" TEXT NOT NULL,
    "evenementId" TEXT NOT NULL,
    "inscriptionId" TEXT NOT NULL,
    "occurrence" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "rejointAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresenceLive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RappelLive" (
    "id" TEXT NOT NULL,
    "inscriptionId" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "envoyeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RappelLive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionLive" (
    "id" TEXT NOT NULL,
    "evenementId" TEXT NOT NULL,
    "inscriptionId" TEXT,
    "auteurNom" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "reponse" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ouverte',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionLive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SondageLive" (
    "id" TEXT NOT NULL,
    "evenementId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "ouvert" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SondageLive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteSondageLive" (
    "id" TEXT NOT NULL,
    "sondageId" TEXT NOT NULL,
    "inscriptionId" TEXT NOT NULL,
    "option" INTEGER NOT NULL,

    CONSTRAINT "VoteSondageLive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bootcamp" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "cohorte" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "fuseau" TEXT NOT NULL DEFAULT 'Africa/Douala',
    "capacite" INTEGER,
    "placesPrises" INTEGER NOT NULL DEFAULT 0,
    "jalons" JSONB NOT NULL DEFAULT '[]',
    "seuilPresence" INTEGER NOT NULL DEFAULT 75,
    "seuilMissions" INTEGER NOT NULL DEFAULT 100,
    "certificat" BOOLEAN NOT NULL DEFAULT false,
    "modeleDeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bootcamp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionBootcamp" (
    "id" TEXT NOT NULL,
    "bootcampId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "consigne" TEXT,
    "echeance" TIMESTAMP(3),
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionBootcamp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivrableBootcamp" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "inscriptionId" TEXT NOT NULL,
    "fichierUrl" TEXT,
    "fichierNom" TEXT,
    "lien" TEXT,
    "texte" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'depose',
    "feedback" TEXT,
    "note" INTEGER,
    "deposeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "corrigeAt" TIMESTAMP(3),

    CONSTRAINT "LivrableBootcamp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EspaceCommunaute" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "regles" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EspaceCommunaute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilCommunaute" (
    "id" TEXT NOT NULL,
    "espaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'discussion',
    "titre" TEXT NOT NULL,
    "auteurCle" TEXT NOT NULL,
    "auteurNom" TEXT NOT NULL,
    "auteurRole" TEXT NOT NULL,
    "epingle" BOOLEAN NOT NULL DEFAULT false,
    "resolu" BOOLEAN NOT NULL DEFAULT false,
    "masque" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilCommunaute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageCommunaute" (
    "id" TEXT NOT NULL,
    "filId" TEXT NOT NULL,
    "auteurCle" TEXT NOT NULL,
    "auteurNom" TEXT NOT NULL,
    "auteurRole" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "masque" BOOLEAN NOT NULL DEFAULT false,
    "signalements" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageCommunaute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactionCommunaute" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "auteurCle" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "ReactionCommunaute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalementCommunaute" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "auteurCle" TEXT NOT NULL,
    "raison" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalementCommunaute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreneauMentorat" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "mentorNom" TEXT NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL,
    "dureeMin" INTEGER NOT NULL DEFAULT 30,
    "lien" TEXT,
    "reserveCle" TEXT,
    "reserveNom" TEXT,
    "reserveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreneauMentorat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Evenement_produitId_key" ON "Evenement"("produitId");

-- CreateIndex
CREATE INDEX "Evenement_tenantId_debut_idx" ON "Evenement"("tenantId", "debut");

-- CreateIndex
CREATE INDEX "Evenement_bootcampId_idx" ON "Evenement"("bootcampId");

-- CreateIndex
CREATE UNIQUE INDEX "InscriptionLive_token_key" ON "InscriptionLive"("token");

-- CreateIndex
CREATE INDEX "InscriptionLive_commandeId_idx" ON "InscriptionLive"("commandeId");

-- CreateIndex
CREATE UNIQUE INDEX "InscriptionLive_evenementId_email_key" ON "InscriptionLive"("evenementId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "InscriptionLive_bootcampId_email_key" ON "InscriptionLive"("bootcampId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "PresenceLive_evenementId_inscriptionId_occurrence_key" ON "PresenceLive"("evenementId", "inscriptionId", "occurrence");

-- CreateIndex
CREATE UNIQUE INDEX "RappelLive_cle_key" ON "RappelLive"("cle");

-- CreateIndex
CREATE INDEX "QuestionLive_evenementId_idx" ON "QuestionLive"("evenementId");

-- CreateIndex
CREATE INDEX "SondageLive_evenementId_idx" ON "SondageLive"("evenementId");

-- CreateIndex
CREATE UNIQUE INDEX "VoteSondageLive_sondageId_inscriptionId_key" ON "VoteSondageLive"("sondageId", "inscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Bootcamp_produitId_key" ON "Bootcamp"("produitId");

-- CreateIndex
CREATE INDEX "MissionBootcamp_bootcampId_idx" ON "MissionBootcamp"("bootcampId");

-- CreateIndex
CREATE UNIQUE INDEX "LivrableBootcamp_missionId_inscriptionId_key" ON "LivrableBootcamp"("missionId", "inscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "EspaceCommunaute_produitId_key" ON "EspaceCommunaute"("produitId");

-- CreateIndex
CREATE INDEX "FilCommunaute_espaceId_createdAt_idx" ON "FilCommunaute"("espaceId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageCommunaute_filId_createdAt_idx" ON "MessageCommunaute"("filId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReactionCommunaute_messageId_auteurCle_emoji_key" ON "ReactionCommunaute"("messageId", "auteurCle", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "SignalementCommunaute_messageId_auteurCle_key" ON "SignalementCommunaute"("messageId", "auteurCle");

-- CreateIndex
CREATE INDEX "CreneauMentorat_produitId_debut_idx" ON "CreneauMentorat"("produitId", "debut");

-- AddForeignKey
ALTER TABLE "Evenement" ADD CONSTRAINT "Evenement_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evenement" ADD CONSTRAINT "Evenement_bootcampId_fkey" FOREIGN KEY ("bootcampId") REFERENCES "Bootcamp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscriptionLive" ADD CONSTRAINT "InscriptionLive_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "Evenement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscriptionLive" ADD CONSTRAINT "InscriptionLive_bootcampId_fkey" FOREIGN KEY ("bootcampId") REFERENCES "Bootcamp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceLive" ADD CONSTRAINT "PresenceLive_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "Evenement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceLive" ADD CONSTRAINT "PresenceLive_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "InscriptionLive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RappelLive" ADD CONSTRAINT "RappelLive_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "InscriptionLive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionLive" ADD CONSTRAINT "QuestionLive_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "Evenement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SondageLive" ADD CONSTRAINT "SondageLive_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "Evenement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteSondageLive" ADD CONSTRAINT "VoteSondageLive_sondageId_fkey" FOREIGN KEY ("sondageId") REFERENCES "SondageLive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bootcamp" ADD CONSTRAINT "Bootcamp_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionBootcamp" ADD CONSTRAINT "MissionBootcamp_bootcampId_fkey" FOREIGN KEY ("bootcampId") REFERENCES "Bootcamp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivrableBootcamp" ADD CONSTRAINT "LivrableBootcamp_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "MissionBootcamp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivrableBootcamp" ADD CONSTRAINT "LivrableBootcamp_inscriptionId_fkey" FOREIGN KEY ("inscriptionId") REFERENCES "InscriptionLive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilCommunaute" ADD CONSTRAINT "FilCommunaute_espaceId_fkey" FOREIGN KEY ("espaceId") REFERENCES "EspaceCommunaute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCommunaute" ADD CONSTRAINT "MessageCommunaute_filId_fkey" FOREIGN KEY ("filId") REFERENCES "FilCommunaute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactionCommunaute" ADD CONSTRAINT "ReactionCommunaute_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MessageCommunaute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalementCommunaute" ADD CONSTRAINT "SignalementCommunaute_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MessageCommunaute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
