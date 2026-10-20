-- Notifications push (Web Push) : un appareil abonné par ligne.
CREATE TABLE "AbonnementPush" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "espace" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "appareil" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dernierEnvoi" TIMESTAMP(3),
    CONSTRAINT "AbonnementPush_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AbonnementPush_endpoint_espace_key" ON "AbonnementPush"("endpoint", "espace");
CREATE INDEX "AbonnementPush_userId_espace_idx" ON "AbonnementPush"("userId", "espace");
ALTER TABLE "AbonnementPush" ADD CONSTRAINT "AbonnementPush_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
