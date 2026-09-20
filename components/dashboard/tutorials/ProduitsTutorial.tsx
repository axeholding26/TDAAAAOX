"use client";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";
import { Plus, Search, AlertTriangle, TrendingUp } from "lucide-react";

const PRODUITS_TUTORIAL_STEPS = [
  { Icon: Plus,          titre: "Ajoute un produit",       description: "Clique sur \"Nouveau produit\" pour créer une fiche avec photos, prix, variantes et stock." },
  { Icon: Search,        titre: "Recherche & filtres",      description: "Retrouve un produit par nom, ou filtre par Actifs, Inactifs, Stock faible ou Épuisés." },
  { Icon: AlertTriangle, titre: "Surveille ton stock",      description: "Les badges \"Stock faible\" et \"Épuisé\" apparaissent directement sur chaque fiche produit dès que le seuil de 5 unités est atteint." },
  { Icon: TrendingUp,    titre: "Ventes & avis en un clin d'œil", description: "Le nombre de ventes et la note des avis clients s'affichent sous chaque produit pour repérer tes best-sellers." },
];

export function ProduitsTutorial() {
  return <ModuleTutorial moduleKey="produits" titre="Produits" sousTitre="Ton catalogue" steps={PRODUITS_TUTORIAL_STEPS} />;
}
