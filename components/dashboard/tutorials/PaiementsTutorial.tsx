"use client";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";
import { Wallet, Lock, CreditCard, ArrowUpRight } from "lucide-react";

const PAIEMENTS_TUTORIAL_STEPS = [
  { Icon: Wallet,      titre: "Votre wallet Axso",     description: "Le solde disponible, ce que vous avez reçu, retiré et payé en commission — tout au même endroit." },
  { Icon: Lock,         titre: "Séquestre 48h",          description: "Chaque paiement client transite d'abord par un séquestre de sécurité, libéré automatiquement après 48h." },
  { Icon: CreditCard,    titre: "Historique des transactions", description: "Toutes vos commandes avec leur méthode de paiement, leur statut et leur montant, triées par date." },
  { Icon: ArrowUpRight,   titre: "Retraits",               description: "Suivez vos demandes de retrait et leur statut, et lancez-en une nouvelle depuis le module Revenus." },
];

export function PaiementsTutorial() {
  return <ModuleTutorial moduleKey="paiements" titre="Paiements" sousTitre="Wallet, transactions, retraits" steps={PAIEMENTS_TUTORIAL_STEPS} />;
}
