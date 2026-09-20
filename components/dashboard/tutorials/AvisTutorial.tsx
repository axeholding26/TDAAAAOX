"use client";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";
import { Star, Clock, ShieldCheck, MessageSquare } from "lucide-react";

const AVIS_TUTORIAL_STEPS = [
  { Icon: Star,         titre: "Note moyenne & répartition", description: "Visualise ta note moyenne sur 5 et la répartition détaillée des avis, de 5 à 1 étoile." },
  { Icon: Clock,        titre: "Modération avant publication", description: "Chaque nouvel avis arrive \"En attente\" — clique sur \"Approuver\" pour qu'il devienne visible sur ta boutique." },
  { Icon: ShieldCheck,  titre: "Achats vérifiés",             description: "Le badge \"Achat vérifié\" signale les avis laissés par un client ayant réellement acheté le produit." },
  { Icon: MessageSquare, titre: "Retours par produit",        description: "Chaque avis affiche le produit concerné, la note, le commentaire et la date, pour suivre la satisfaction commande par commande." },
];

export function AvisTutorial() {
  return <ModuleTutorial moduleKey="avis" titre="Avis clients" sousTitre="Réputation & satisfaction" steps={AVIS_TUTORIAL_STEPS} />;
}
