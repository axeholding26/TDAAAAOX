-- Nouvelle version payante d'un produit numérique : lien vers la version précédente,
-- et codes promo limités à certains produits (offre réservée aux anciens acheteurs).
ALTER TABLE "Produit" ADD COLUMN "versionPrecedenteId" TEXT;
ALTER TABLE "CodePromo" ADD COLUMN "produitIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
