-- Le délai de livraison n'est plus inventé (15 j) à la création : vide tant que non saisi.
-- Les lignes existantes gardent leur valeur.
ALTER TABLE "Fournisseur" ALTER COLUMN "delaiLivraison" DROP DEFAULT;
ALTER TABLE "Fournisseur" ALTER COLUMN "delaiLivraison" DROP NOT NULL;
