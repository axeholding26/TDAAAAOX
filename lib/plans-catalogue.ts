// Catalogue marketing des plans Axso — module pur (aucune dépendance Prisma),
// partagé entre la page /dashboard/abonnement (serveur) et l'overlay plein
// écran (client). La source de vérité fonctionnelle reste lib/plans.ts
// (LIMITES/FEATURES appliqués réellement par le backend).
import { CreditCard, Zap, Crown, type LucideIcon } from "lucide-react";

export const PLANS_CATALOGUE = [
  {
    id: "palier0",
    nom: "Essentiel",
    palier: "Palier 0",
    prixXAF: 0,
    description: "Démarrez votre activité en ligne",
    couleur: "#6b7280",
    bg: "rgba(107,114,128,0.08)",
    border: "rgba(107,114,128,0.2)",
    icone: CreditCard as LucideIcon,
    recommande: false,
    features: [
      { label: "Commandes limitées (30/mois)", ok: true },
      { label: "WhatsApp Business intégré", ok: true },
      { label: "AXIA IA — outils essentiels", ok: true },
      { label: "Social Media intégré", ok: true },
      { label: "1 boutique en ligne", ok: true },
      { label: "Commandes illimitées", ok: false },
      { label: "IA avancée (agents, automatisations)", ok: false },
      { label: "Sourcing dropshipping mondial", ok: false },
      { label: "Analytics avancés", ok: false },
    ],
  },
  {
    id: "palier1",
    nom: "Pro",
    palier: "Palier 1",
    prixXAF: 6000,
    description: "Scalez sans contrainte",
    couleur: "#F5A623",
    bg: "rgba(245,166,35,0.08)",
    border: "rgba(245,166,35,0.3)",
    icone: Zap as LucideIcon,
    recommande: true,
    features: [
      { label: "Commandes illimitées", ok: true },
      { label: "WhatsApp Business intégré", ok: true },
      { label: "AXIA IA — outils avancés (agents, automatisations)", ok: true },
      { label: "Marketing & campagnes (email, SMS, réseaux sociaux)", ok: true },
      { label: "Analytics avancés — historique complet", ok: true },
      { label: "Sourcing dropshipping mondial", ok: false },
      { label: "Analytics temps réel", ok: false },
      { label: "Multi-boutique", ok: false },
    ],
  },
  {
    id: "palier2",
    nom: "Illimité",
    palier: "Palier 2",
    prixXAF: 20000,
    description: "Aucune limite — puissance totale",
    couleur: "#111111",
    bg: "rgba(17,17,17,0.08)",
    border: "rgba(17,17,17,0.25)",
    icone: Crown as LucideIcon,
    recommande: false,
    features: [
      { label: "AUCUNE LIMITE — tout inclus", ok: true },
      { label: "AXIA IA — tous les outils (médias, ads, entrepôts…)", ok: true },
      { label: "Sourcing dropshipping mondial", ok: true },
      { label: "Analytics temps réel", ok: true },
      { label: "Multi-boutique", ok: true },
      { label: "Support prioritaire 24/7", ok: true },
    ],
  },
] as const;

export type PlanCatalogueId = (typeof PLANS_CATALOGUE)[number]["id"];

export const ABONNEMENT_FAQ = [
  {
    q: "Puis-je changer de plan à tout moment ?",
    r: "Oui. Le changement est immédiat. Si vous montez de palier, vous accédez instantanément aux nouvelles fonctionnalités.",
  },
  {
    q: "Comment fonctionne la limite de commandes au Palier 0 ?",
    r: "Au Palier 0 vous pouvez recevoir jusqu'à 30 commandes par mois. Au-delà, vos commandes continuent d'arriver normalement, mais vous ne pouvez plus les gérer (statuts, livreurs, retours, factures) ni utiliser WhatsApp tant que vous n'upgradez pas ou que le mois ne change pas.",
  },
  {
    q: "Le Palier 2 inclut vraiment tout sans supplément ?",
    r: "Oui. Le Palier 2 'Illimité' supprime toutes les limites : commandes, IA, sourcing mondial, analytics et boutiques. Aucun frais caché.",
  },
  {
    q: "Les prix sont-ils affichés en ma devise locale ?",
    r: "Oui, les prix sont automatiquement convertis dans la devise de votre pays pour vous donner une idée du coût. La facturation s'effectue en FCFA ou via votre opérateur local.",
  },
];
