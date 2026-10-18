// Plan de navigation du Command Center (barre latérale + recherche ⌘K). Module pur.
import type { Section } from "./rbac";

export interface EntreeNav { section: Section; href: string; nom: string; icone: string; ceo?: boolean; gestion?: boolean; mots?: string }

export const NAV: EntreeNav[] = [
  { section: "cc", href: "/admin", nom: "Command Center", icone: "LayoutDashboard", ceo: true, mots: "accueil executive brief daily ceo" },
  { section: "croissance", href: "/admin/croissance", nom: "Croissance", icone: "TrendingUp", ceo: true, mots: "growth acquisition activation retention cohortes funnel dau mau" },
  { section: "revenus", href: "/admin/revenus", nom: "Revenus", icone: "Wallet", ceo: true, mots: "revenue mrr arr arpu ltv plans waterfall prévisions forecast" },
  { section: "marchands", href: "/admin/marchands", nom: "Marchands", icone: "Store", mots: "merchants boutiques table santé health" },
  { section: "commerce", href: "/admin/commerce", nom: "Commerce", icone: "ShoppingBag", mots: "commerce gmv commandes orders panier aov remboursements" },
  { section: "ia", href: "/admin/ia", nom: "Axia IA", icone: "Sparkles", mots: "ai intelligence axia tokens coût roi" },
  { section: "marketing", href: "/admin/marketing", nom: "Marketing", icone: "Megaphone", mots: "marketing campagnes cac roas canaux acquisition" },
  { section: "operations", href: "/admin/operations", nom: "Opérations", icone: "Truck", mots: "operations livraison fulfillment support incidents" },
  { section: "paiements", href: "/admin/paiements", nom: "Paiements", icone: "CreditCard", mots: "payments paiements échecs remboursements mobile money" },
  { section: "geographie", href: "/admin/geographie", nom: "Géographie", icone: "Globe2", ceo: true, mots: "geography africa carte map pays marchés market opportunity" },
  { section: "produit", href: "/admin/produit", nom: "Produit", icone: "Boxes", mots: "product analytics fonctionnalités features adoption" },
  { section: "succes", href: "/admin/succes-client", nom: "Succès client", icone: "HeartPulse", mots: "customer success churn radar expansion santé health score" },
  { section: "alertes", href: "/admin/alertes", nom: "Risques & alertes", icone: "Siren", ceo: true, mots: "alerts risques seuils thresholds" },
  { section: "experiences", href: "/admin/experiences", nom: "Expériences", icone: "FlaskConical", mots: "experiments ab tests pricing" },
  { section: "rapports", href: "/admin/rapports", nom: "Rapports", icone: "FileText", ceo: true, mots: "reports export pdf excel csv planifier daily weekly monthly" },
  { section: "explorer", href: "/admin/explorer", nom: "Explorer les données", icone: "Telescope", mots: "data explorer métrique dimension" },
  { section: "reglages", href: "/admin/reglages", nom: "Réglages", icone: "Settings2", mots: "settings seuils objectifs goals pondérations activation" },
  // Gestion (pages historiques de l'admin)
  { section: "boutiques", href: "/admin/boutiques", nom: "Boutiques", icone: "Store", gestion: true, mots: "gérer suspendre certifier" },
  { section: "abonnements", href: "/admin/abonnements", nom: "Abonnements", icone: "BadgeCheck", gestion: true },
  { section: "finances", href: "/admin/finances", nom: "Finances & Wallet", icone: "Landmark", gestion: true, mots: "wallet retraits commissions" },
  { section: "avis", href: "/admin/avis", nom: "Avis plateforme", icone: "Star", gestion: true, mots: "avis témoignages reviews modération landing" },
  { section: "axsocial", href: "/admin/axsocial", nom: "Axsocial", icone: "MessagesSquare", gestion: true },
  { section: "livreurs", href: "/admin/livreurs", nom: "Livreurs", icone: "Bike", gestion: true },
  { section: "fournisseurs", href: "/admin/fournisseurs", nom: "Fournisseurs", icone: "ShieldCheck", gestion: true },
  { section: "equipe", href: "/admin/equipe", nom: "Équipe & rôles", icone: "UserCog", gestion: true, mots: "rbac rôles permissions" },
  { section: "audit", href: "/admin/audit", nom: "Journal d'audit", icone: "ScrollText", gestion: true, mots: "audit log historique actions" },
  { section: "integrations", href: "/admin/integrations", nom: "Intégrations", icone: "Plug", gestion: true },
];

/** Pages historiques au thème sombre codé en dur : on y garde le thème sombre. */
export const estPageGestion = (chemin: string) => NAV.some((n) => n.gestion && n.section !== "audit" && n.section !== "avis" && chemin.startsWith(n.href));
