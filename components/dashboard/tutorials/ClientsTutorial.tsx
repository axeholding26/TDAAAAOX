"use client";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";
import { Users, Star, TrendingUp, ChevronRight } from "lucide-react";

const CLIENTS_TUTORIAL_STEPS = [
  { Icon: Users,       titre: "Ta base clients complète", description: "Chaque client ayant commandé chez toi apparaît ici : coordonnées, nombre de commandes et dépenses totales." },
  { Icon: Star,        titre: "Segments VIP / Régulier / Nouveau", description: "Un client devient VIP dès 5 commandes ou 100 000 dans son historique, Régulier dès 2 commandes, sinon Nouveau." },
  { Icon: TrendingUp,  titre: "Revenu généré & panier moyen", description: "Suis le revenu total apporté par tes clients actifs et leur panier moyen en haut de page." },
  { Icon: ChevronRight, titre: "Détail d'un client",        description: "Clique sur une ligne pour voir l'historique complet des commandes de ce client." },
];

export function ClientsTutorial() {
  return <ModuleTutorial moduleKey="clients" titre="Clients" sousTitre="Ta base clients" steps={CLIENTS_TUTORIAL_STEPS} />;
}
