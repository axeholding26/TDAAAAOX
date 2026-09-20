"use client";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";
import { DollarSign, TrendingDown, Wallet, BarChart3 } from "lucide-react";

const REVENUS_TUTORIAL_STEPS = [
  { Icon: DollarSign,  titre: "Chiffre d'affaires",        description: "Suivez votre revenu brut sur 30 jours et 7 jours, calculé sur les commandes complétées." },
  { Icon: TrendingDown, titre: "Commissions Axso",          description: "Les frais de plateforme sont automatiquement déduits — visualisez exactement combien est prélevé." },
  { Icon: Wallet,        titre: "Revenu net",                 description: "Ce que vous empochez réellement, une fois les commissions retirées de votre chiffre d'affaires." },
  { Icon: BarChart3,      titre: "Graphique journalier",        description: "Visualisez vos revenus jour par jour sur les 14 derniers jours pour repérer vos tendances." },
];

export function RevenusTutorial() {
  return <ModuleTutorial moduleKey="revenus" titre="Revenus" sousTitre="Analyse financière de ta boutique" steps={REVENUS_TUTORIAL_STEPS} />;
}
