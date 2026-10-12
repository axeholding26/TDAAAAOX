-- Motif d'annulation d'une commande fournisseur : seules les annulations imputables
-- au fournisseur (rupture, sans réponse, retard) comptent contre sa fiabilité.
ALTER TABLE "CommandeFournisseur" ADD COLUMN IF NOT EXISTS "motifAnnulation" TEXT;
