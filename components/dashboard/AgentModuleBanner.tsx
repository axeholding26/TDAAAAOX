"use client";
import { usePathname } from "next/navigation";
import { AgentWelcomeBox } from "./AgentWelcomeBox";
import type { AgentId } from "./AgentAvatar3D";

interface ModuleConfig {
  agentId: AgentId;
  endpoint: string;
  greeting: string;
  suggestions: string[];
}

const MODULE_MAP: Record<string, ModuleConfig> = {
  "/dashboard": {
    agentId: "orion",
    endpoint: "/api/ai/universal",
    greeting: "Bienvenue ! Je suis **ORION**, votre agent d'onboarding et de pilotage.\n\nVotre boutique est active — je surveille tout en temps réel. Comment puis-je vous aider aujourd'hui ?",
    suggestions: ["Résume mes performances du jour", "Que dois-je faire en priorité ?", "Crée 3 nouveaux produits avec IA"],
  },
  "/dashboard/produits": {
    agentId: "kira",
    endpoint: "/api/ai/agent-produits",
    greeting: "Salut ! Je suis **KIRA**, votre agent catalogue.\n\nJe peux enrichir vos fiches produits, générer des images IA, optimiser le SEO et suggérer les meilleurs prix. Par où on commence ?",
    suggestions: ["Enrichis tous mes produits sans description", "Génère des images pour les produits sans photo", "Analyse les prix de mon catalogue vs concurrents"],
  },
  "/dashboard/produits/nouveau": {
    agentId: "kira",
    endpoint: "/api/ai/agent-produits",
    greeting: "Parfait, créons un nouveau produit ensemble ! Je suis **KIRA**.\n\nDécrivez-moi votre produit en quelques mots — je génère la description, le SEO, les tags et vous suggère un prix optimal.",
    suggestions: ["Sac en cuir marron pour femme, 35 cm", "Robe wax africaine taille M", "Téléphone Samsung Galaxy A15"],
  },
  "/dashboard/marketing": {
    agentId: "nova",
    endpoint: "/api/ai/agent-marketing",
    greeting: "Coucou ! Je suis **NOVA**, votre agent marketing.\n\nPromo, campagne email, post viral Instagram/TikTok — je crée tout ça en quelques secondes, adapté au marché africain. Qu'est-ce qu'on lance ?",
    suggestions: ["Génère un post Instagram pour mes meilleurs produits", "Crée une campagne email de réactivation", "Lance un code promo flash 24h"],
  },
  "/dashboard/studio": {
    agentId: "nova",
    endpoint: "/api/ai/agent-marketing",
    greeting: "Hello ! Je suis **NOVA**, votre productrice de contenu IA.\n\nScripts publicitaires, voix off, vidéos produit — créons du contenu qui convertit. Quel contenu voulez-vous créer ?",
    suggestions: ["Écris un script pub 30s pour mon produit phare", "Génère une voix off en français pour une vidéo", "Crée un UGC style pour TikTok"],
  },
  "/dashboard/scheduler": {
    agentId: "nova",
    endpoint: "/api/ai/agent-marketing",
    greeting: "Salut ! Je suis **NOVA**.\n\nPlanifions votre calendrier de contenu social. Instagram, Facebook, TikTok, WhatsApp — je génère les posts et visuels, vous choisissez quand publier.",
    suggestions: ["Génère 7 posts Instagram pour cette semaine", "Planifie une série de posts pour le weekend", "Crée un post d'annonce pour ma nouvelle collection"],
  },
  "/dashboard/clients": {
    agentId: "zeta",
    endpoint: "/api/ai/agent-clients",
    greeting: "Hello ! Je suis **ZETA**, votre agent CRM.\n\nJ'analyse vos clients en temps réel — segments, VIP, inactifs, comportements. Voulez-vous voir vos meilleurs clients ou lancer une relance ?",
    suggestions: ["Qui sont mes 10 meilleurs clients ?", "Relance les clients inactifs depuis 30 jours", "Envoie un email VIP à mes clients fidèles"],
  },
  "/dashboard/commandes": {
    agentId: "atlas",
    endpoint: "/api/ai/agent-livraison",
    greeting: "Bonjour ! Je suis **ATLAS**, votre agent logistique.\n\nJe vois toutes vos commandes en cours. Voulez-vous que j'assigne les livreurs, mette à jour des statuts ou envoie des notifications clients ?",
    suggestions: ["Combien de commandes sont en attente d'expédition ?", "Assigne les livreurs disponibles aux commandes", "Notifie les clients dont la commande est livrée"],
  },
  "/dashboard/logistique": {
    agentId: "atlas",
    endpoint: "/api/ai/agent-livraison",
    greeting: "Bonjour ! Je suis **ATLAS**, votre agent livraison.\n\nJe gère votre logistique de A à Z — attribution des livreurs, suivi en temps réel, notifications clients. Que voulez-vous faire ?",
    suggestions: ["Assigne les livreurs aux commandes en attente", "Statut de toutes les livraisons en cours", "Identifie les retards de livraison"],
  },
  "/dashboard/analytics": {
    agentId: "lyra",
    endpoint: "/api/ai/agent-analytics",
    greeting: "Bonjour ! Je suis **LYRA**, votre analyste IA.\n\nJ'ai accès à toutes vos données — ventes, clients, tendances, performances. Voulez-vous un rapport complet ou une analyse spécifique ?",
    suggestions: ["Génère un rapport complet de ce mois", "Quels sont mes produits les plus vendus ?", "Analyse les tendances de ventes sur 90 jours"],
  },
  "/dashboard/revenus": {
    agentId: "lyra",
    endpoint: "/api/ai/agent-analytics",
    greeting: "Salut ! Je suis **LYRA**.\n\nJe vais analyser vos revenus en détail — évolution, pics de ventes, comparaisons, prévisions. Que voulez-vous explorer ?",
    suggestions: ["Compare mes revenus ce mois vs le mois dernier", "Quelles sont mes meilleures journées de ventes ?", "Prévision de revenus pour le mois prochain"],
  },
  "/dashboard/dropshipping": {
    agentId: "kira",
    endpoint: "/api/ai/agent-produits",
    greeting: "Salut ! Je suis **KIRA**.\n\nPour le dropshipping, je peux rechercher des produits tendance, analyser les marges et créer des fiches optimisées automatiquement.",
    suggestions: ["Trouve 5 produits tendance pour l'Afrique", "Analyse la marge de mes produits dropshipping", "Optimise les descriptions de mes produits importés"],
  },
  "/dashboard/veille": {
    agentId: "lyra",
    endpoint: "/api/ai/agent-analytics",
    greeting: "Bonjour ! Je suis **LYRA**.\n\nSurveillons ensemble votre marché — prix concurrents, tendances, nouvelles opportunités. Que voulez-vous analyser ?",
    suggestions: ["Analyse les prix de mes concurrents", "Quelles tendances émergent sur mon marché ?", "Identifie les opportunités à saisir cette semaine"],
  },
};

// Trouver la config pour une route donnée (match exact ou préfixe)
function getModuleConfig(pathname: string): ModuleConfig | null {
  if (MODULE_MAP[pathname]) return MODULE_MAP[pathname];
  // Match par préfixe (ex: /dashboard/produits/[id] → produits config)
  const prefixMatch = Object.keys(MODULE_MAP)
    .filter(k => k !== "/dashboard" && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return prefixMatch ? MODULE_MAP[prefixMatch] : null;
}

export function AgentModuleBanner() {
  const pathname = usePathname();
  const config = getModuleConfig(pathname);

  // Ne pas afficher sur /dashboard/axia (déjà intégré) et /dashboard/agents
  if (!config) return null;
  if (pathname === "/dashboard/axia" || pathname.startsWith("/dashboard/agents")) return null;

  return (
    <AgentWelcomeBox
      agentId={config.agentId}
      endpoint={config.endpoint}
      greeting={config.greeting}
      suggestions={config.suggestions}
    />
  );
}
