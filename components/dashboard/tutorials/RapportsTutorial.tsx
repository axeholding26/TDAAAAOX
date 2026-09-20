"use client";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";
import { FileBarChart, Wallet, ShoppingCart, TrendingUp } from "lucide-react";

const RAPPORTS_TUTORIAL_STEPS = [
  { Icon: FileBarChart, titre: "Rapport de productivité",  description: "Revenus, commandes traitées, panier moyen et nouveaux clients, comparés à la période précédente." },
  { Icon: Wallet,       titre: "Choisis ta période",        description: "Bascule entre 7, 30 et 90 jours en haut à droite pour ajuster la fenêtre d'analyse et sa comparaison." },
  { Icon: ShoppingCart, titre: "Statuts & top produits",     description: "Visualise la répartition de tes commandes par statut, ton taux d'annulation et le classement de tes produits les plus vendus." },
  { Icon: TrendingUp,   titre: "Exporte en PDF",             description: "Clique sur le bouton d'impression pour générer une version imprimable de ton rapport, prête à partager." },
];

export function RapportsTutorial() {
  return <ModuleTutorial moduleKey="rapports" titre="Rapports" sousTitre="Exports & synthèses" steps={RAPPORTS_TUTORIAL_STEPS} />;
}
