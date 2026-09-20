"use client";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";
import { TrendingUp, BarChart3, Eye, Star } from "lucide-react";

const ANALYTICS_TUTORIAL_STEPS = [
  { Icon: TrendingUp, titre: "4 indicateurs clés",           description: "Chiffre d'affaires, commandes, visiteurs et taux de conversion, comparés à la période précédente avec leur variation en %." },
  { Icon: BarChart3,  titre: "Évolution, top produits & statuts", description: "La courbe du CA jour par jour, le classement de tes produits les plus vendus et la répartition des statuts de commandes." },
  { Icon: Eye,        titre: "Entonnoir de conversion",       description: "Suis le parcours complet : visites → vues produits → ajouts au panier → achats, avec le taux de passage à chaque étape." },
  { Icon: Star,       titre: "Derniers avis clients",         description: "Les 5 avis les plus récents de tes clients s'affichent directement ici, note et commentaire inclus." },
];

export function AnalyticsTutorial() {
  return <ModuleTutorial moduleKey="analytics" titre="Analytics" sousTitre="Performance de ta boutique" steps={ANALYTICS_TUTORIAL_STEPS} />;
}
