-- « Signaler un problème » : signalements des marchands, suivis dans le Command Center (/admin/support).
CREATE TABLE "Signalement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "description" TEXT NOT NULL,
    "capture" TEXT,
    "page" TEXT NOT NULL,
    "appareil" TEXT,
    "erreur" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ouvert',
    "reponse" TEXT,
    "reponduPar" TEXT,
    "reponduLe" TIMESTAMP(3),
    "resoluLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signalement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Signalement_tenantId_createdAt_idx" ON "Signalement"("tenantId", "createdAt");
CREATE INDEX "Signalement_userId_createdAt_idx" ON "Signalement"("userId", "createdAt");
CREATE INDEX "Signalement_statut_createdAt_idx" ON "Signalement"("statut", "createdAt");

ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
