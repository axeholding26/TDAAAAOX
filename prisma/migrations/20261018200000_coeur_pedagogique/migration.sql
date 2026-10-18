-- AlterTable
ALTER TABLE "AccesFormation" ADD COLUMN     "derniereActiviteAt" TIMESTAMP(3),
ADD COLUMN     "derniereLeconId" TEXT,
ADD COLUMN     "revoqueAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Chapitre" ADD COLUMN     "dripDate" TIMESTAMP(3),
ADD COLUMN     "dripJours" INTEGER,
ADD COLUMN     "prerequis" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "statut" TEXT NOT NULL DEFAULT 'publie';

-- AlterTable
ALTER TABLE "Formation" ADD COLUMN     "certifDevoirsRequis" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "certifLeconsPct" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "certifQuizRequis" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Lecon" ADD COLUMN     "dripDate" TIMESTAMP(3),
ADD COLUMN     "dripJours" INTEGER,
ADD COLUMN     "prerequis" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "statut" TEXT NOT NULL DEFAULT 'publie';

-- AlterTable
ALTER TABLE "ProgressionLecon" ADD COLUMN     "favori" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "majAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "position" INTEGER;

-- CreateTable
CREATE TABLE "QuizLecon" (
    "id" TEXT NOT NULL,
    "leconId" TEXT NOT NULL,
    "noteMin" INTEGER NOT NULL DEFAULT 70,
    "tentativesMax" INTEGER,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizLecon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TentativeQuiz" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "leconId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "apprenant" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "reponses" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "reussi" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativeQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenduDevoir" (
    "id" TEXT NOT NULL,
    "leconId" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "apprenant" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'soumis',
    "note" INTEGER,
    "feedback" TEXT,
    "corrigeAt" TIMESTAMP(3),
    "corrigePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenduDevoir_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RessourceLecon" (
    "id" TEXT NOT NULL,
    "leconId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mime" TEXT,
    "taille" INTEGER,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RessourceLecon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificat" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "produitId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "apprenant" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "formationTitre" TEXT NOT NULL,
    "boutiqueNom" TEXT NOT NULL,
    "delivreAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoqueAt" TIMESTAMP(3),
    "revoqueMotif" TEXT,
    "revoquePar" TEXT,

    CONSTRAINT "Certificat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuizLecon_leconId_key" ON "QuizLecon"("leconId");

-- CreateIndex
CREATE INDEX "TentativeQuiz_quizId_apprenant_idx" ON "TentativeQuiz"("quizId", "apprenant");

-- CreateIndex
CREATE INDEX "TentativeQuiz_produitId_idx" ON "TentativeQuiz"("produitId");

-- CreateIndex
CREATE INDEX "RenduDevoir_produitId_statut_idx" ON "RenduDevoir"("produitId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "RenduDevoir_leconId_apprenant_key" ON "RenduDevoir"("leconId", "apprenant");

-- CreateIndex
CREATE INDEX "RessourceLecon_leconId_idx" ON "RessourceLecon"("leconId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificat_code_key" ON "Certificat"("code");

-- CreateIndex
CREATE INDEX "Certificat_tenantId_idx" ON "Certificat"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificat_produitId_apprenant_key" ON "Certificat"("produitId", "apprenant");

-- CreateIndex
CREATE INDEX "AccesFormation_clientEmail_idx" ON "AccesFormation"("clientEmail");

-- AddForeignKey
ALTER TABLE "QuizLecon" ADD CONSTRAINT "QuizLecon_leconId_fkey" FOREIGN KEY ("leconId") REFERENCES "Lecon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TentativeQuiz" ADD CONSTRAINT "TentativeQuiz_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "QuizLecon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenduDevoir" ADD CONSTRAINT "RenduDevoir_leconId_fkey" FOREIGN KEY ("leconId") REFERENCES "Lecon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RessourceLecon" ADD CONSTRAINT "RessourceLecon_leconId_fkey" FOREIGN KEY ("leconId") REFERENCES "Lecon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

