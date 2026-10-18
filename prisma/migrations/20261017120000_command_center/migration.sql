-- CreateTable
CREATE TABLE "ReglageAdmin" (
    "cle" TEXT NOT NULL,
    "valeur" JSONB NOT NULL,
    "majPar" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReglageAdmin_pkey" PRIMARY KEY ("cle")
);

-- CreateTable
CREATE TABLE "AuditAdmin" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT,
    "avant" JSONB,
    "apres" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditAdmin_createdAt_idx" ON "AuditAdmin"("createdAt");

-- CreateIndex
CREATE INDEX "AuditAdmin_entite_entiteId_idx" ON "AuditAdmin"("entite", "entiteId");
