"use client";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";
import { TrendingUp, AlertTriangle, BarChart3, Target } from "lucide-react";

// Icônes = composants React : ne peuvent pas être sérialisées du serveur
// (page.tsx) vers un client component en tant que prop — ce petit wrapper
// "use client" les garde du bon côté de la frontière.
const ACCUEIL_TUTORIAL_STEPS = [
  { Icon: TrendingUp,   titre: "Tes KPIs en un coup d'œil", description: "Chiffre d'affaires du mois, commandes de la semaine, clients et taux de conversion, avec l'évolution vs le mois dernier." },
  { Icon: Target,       titre: "Objectif & projection",     description: "Suis ta progression vers l'objectif mensuel et la projection de fin de mois calculée sur ta moyenne quotidienne." },
  { Icon: AlertTriangle, titre: "Alertes en temps réel",     description: "Commandes en attente et produits en stock critique remontent directement ici pour que tu puisses agir vite." },
  { Icon: BarChart3,    titre: "Top produits, villes & entonnoir", description: "Repère tes meilleures ventes, tes villes principales et suis le parcours complet, de la visite à la livraison." },
];

export function AccueilTutorial() {
  return <ModuleTutorial moduleKey="accueil" titre="Tableau de bord" sousTitre="Vue d'ensemble de ta boutique" steps={ACCUEIL_TUTORIAL_STEPS} />;
}
