"use client";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";
import { Package, Clock, Truck, TrendingUp } from "lucide-react";

const COMMANDES_TUTORIAL_STEPS = [
  { Icon: Package,      titre: "Toutes tes commandes",     description: "Retrouve chaque commande passée par tes clients, avec le nombre d'articles, le montant et la date, triées de la plus récente à la plus ancienne." },
  { Icon: Clock,        titre: "Filtre par statut",        description: "Utilise les onglets En attente, Confirmée, Expédiée, Livrée ou Annulée pour te concentrer sur ce qui doit être traité." },
  { Icon: Truck,        titre: "Suis chaque livraison",    description: "Clique sur une commande pour voir son détail complet et faire avancer son statut jusqu'à la livraison." },
  { Icon: TrendingUp,   titre: "CA du mois en direct",      description: "Le chiffre d'affaires du mois, les commandes en attente, expédiées et livrées sont résumés en haut de page." },
];

export function CommandesTutorial() {
  return <ModuleTutorial moduleKey="commandes" titre="Commandes" sousTitre="Suivi et gestion des ventes" steps={COMMANDES_TUTORIAL_STEPS} />;
}
