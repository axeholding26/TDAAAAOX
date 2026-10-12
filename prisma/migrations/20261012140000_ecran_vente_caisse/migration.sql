-- Présence de l'écran de vente, distincte de celle du poste : un téléphone ne doit pas
-- croire son scan « envoyé » quand l'ordinateur affiche Retours ou Stock.
ALTER TABLE "Caisse" ADD COLUMN IF NOT EXISTS "ecranVenteAt" TIMESTAMP(3);
