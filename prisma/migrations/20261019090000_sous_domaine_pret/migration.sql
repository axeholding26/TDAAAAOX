-- Sous-domaine nom.axsoafrica.com accepté par Vercel (garde-fou : liens et redirection seulement après).
ALTER TABLE "Tenant" ADD COLUMN "sousDomaineAt" TIMESTAMP(3);
