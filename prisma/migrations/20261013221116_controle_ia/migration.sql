-- CreateTable
CREATE TABLE "ConnexionIA" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "scopes" TEXT[],
    "mode" TEXT NOT NULL DEFAULT 'copilot',
    "limites" JSONB NOT NULL DEFAULT '{}',
    "revoqueLe" TIMESTAMP(3),
    "utiliseLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnexionIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JetonIA" (
    "hash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "connexionId" TEXT,
    "expireLe" TIMESTAMP(3) NOT NULL,
    "donnees" JSONB,

    CONSTRAINT "JetonIA_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "ActionIA" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connexionId" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "outil" TEXT NOT NULL,
    "risque" TEXT NOT NULL,
    "entree" TEXT NOT NULL,
    "sortie" TEXT NOT NULL DEFAULT '',
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "cleIdempotence" TEXT,
    "dureeMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionIA_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnexionIA_tenantId_idx" ON "ConnexionIA"("tenantId");

-- CreateIndex
CREATE INDEX "ConnexionIA_userId_idx" ON "ConnexionIA"("userId");

-- CreateIndex
CREATE INDEX "JetonIA_connexionId_idx" ON "JetonIA"("connexionId");

-- CreateIndex
CREATE INDEX "JetonIA_expireLe_idx" ON "JetonIA"("expireLe");

-- CreateIndex
CREATE INDEX "ActionIA_tenantId_createdAt_idx" ON "ActionIA"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActionIA_connexionId_cleIdempotence_key" ON "ActionIA"("connexionId", "cleIdempotence");

-- AddForeignKey
ALTER TABLE "JetonIA" ADD CONSTRAINT "JetonIA_connexionId_fkey" FOREIGN KEY ("connexionId") REFERENCES "ConnexionIA"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionIA" ADD CONSTRAINT "ActionIA_connexionId_fkey" FOREIGN KEY ("connexionId") REFERENCES "ConnexionIA"("id") ON DELETE CASCADE ON UPDATE CASCADE;
