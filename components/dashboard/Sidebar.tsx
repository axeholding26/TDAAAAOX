"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar unique — navigation principale du dashboard marchand.
//
// Refonte : plus de sous-sidebars "Boutique" / "Point de vente". Elles
// dérivaient leur état du pathname (BOUTIQUE_ROUTES / POS_ROUTES) et le
// moindre lien hors de ces listes (ex: "Commandes", "Produits") renvoyait
// l'utilisateur d'office sur la sidebar principale — changement de contexte
// involontaire en pleine navigation. Une seule sidebar, avec des groupes
// repliables, supprime ce problème à la racine : tous les liens sont
// accessibles au même endroit, quel que soit le chemin courant.
//
// Un groupe s'ouvre d'office quand il contient la route active, et se replie
// au clic sur son en-tête. Ses liens sont filtrés par permissions d'équipe.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { BoutiqueSwitcher } from "@/components/dashboard/BoutiqueSwitcher";
import {
  Home, ShoppingCart, Monitor, Users, Package, Download,
  Star, Truck, MessageSquare, BarChart3, Megaphone,
  DollarSign, CreditCard, Wallet, Map, Box,
  Settings2, ExternalLink, UserCheck, LayoutGrid, Plug, Link2,
  Bell, ChevronDown, ChevronRight, RotateCcw, FileText, Lock,
  Target, FileBarChart, Sparkles, Boxes, Receipt, Calculator, Store,
} from "lucide-react";
import { useAbonnementOverlay } from "@/components/dashboard/AbonnementOverlayProvider";
import { palierAuMoins, type Palier } from "@/lib/plans";
import type { ModuleKey, Niveau } from "@/lib/permissions";

// ─── Types ────────────────────────────────────────────────────────────────────

// Signature minimale d'une icône : typée explicitement (plutôt que
// React.ElementType) pour que les props `size`/`className`/`style` soient
// vérifiables — React.ElementType fait retomber l'inférence sur `never`.
type IconeComposant = React.ComponentType<{
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}>;

interface NavItem {
  href: string;
  label: string;
  Icon: IconeComposant;
  /** Pastille animée : signal "à traiter" (commandes, messages...). */
  badge?: boolean;
  /** Correspondance stricte sur le pathname (pas de startsWith). */
  exact?: boolean;
  /** Route préfixée par celle-ci mais rattachée à un autre lien (ex: produits/digital). */
  excludePrefix?: string;
  /** Palier minimum requis — sinon l'item est cadenassé et ouvre l'upsell. */
  requiresPalier?: Palier;
  /** Ouvre l'overlay abonnement au lieu de naviguer. */
  opensAbonnement?: boolean;
  /** Module de permissions : l'item disparaît entièrement si le niveau est "aucun". */
  moduleKey?: ModuleKey;
}

/** Groupe repliable — son en-tête déplie/replie ses liens. */
interface NavGroupe {
  id: string;
  label: string;
  Icon: IconeComposant;
  items: NavItem[];
}

export interface SidebarProps {
  boutiqueNom?: string;
  boutiqueSlug?: string;
  userInitials?: string;
  palier?: Palier;
  /** undefined = propriétaire : aucun filtrage n'est appliqué. */
  permissions?: Record<ModuleKey, Niveau>;
}

// ─── Filtrage par permissions ─────────────────────────────────────────────────

function filtreParPermission(
  items: NavItem[],
  permissions?: Record<ModuleKey, Niveau>,
): NavItem[] {
  if (!permissions) return items;
  return items.filter(it => !it.moduleKey || permissions[it.moduleKey] !== "aucun");
}

// ─── État actif ───────────────────────────────────────────────────────────────
// Un href peut porter une query ("/dashboard/logistique?tab=pos") : le
// pathname seul ne suffit alors pas à décider. On compare pathname + chaque
// paire clé/valeur de la query, ce qui remplace l'ancien `activeOverride`
// codé en dur pour le seul lien de la caisse.

function estActif(item: NavItem, pathname: string, searchParams: URLSearchParams): boolean {
  if (item.excludePrefix && pathname.startsWith(item.excludePrefix)) return false;

  const [base, query] = item.href.split("?");
  if (query) {
    if (pathname !== base) return false;
    for (const [cle, valeur] of new URLSearchParams(query)) {
      if (searchParams.get(cle) !== valeur) return false;
    }
    return true;
  }

  if (item.exact) return pathname === base;
  // "/dashboard" est un préfixe de tout le dashboard : il exige l'égalité
  // stricte pour ne pas rester actif sur toutes les pages.
  return base !== "/dashboard" ? pathname.startsWith(base) : pathname === base;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

/** Raccourcis hors groupe — toujours visibles, en tête de sidebar. */
const PRIMAIRES: NavItem[] = [
  { href: "/dashboard",         label: "AXIA",            Icon: Sparkles, exact: true },
  { href: "/dashboard/accueil", label: "Tableau de bord", Icon: Home,     exact: true },
  // Hub du module Boutique (profil, médias, SEO, réseaux, livraison,
  // multi-boutique) — remplace l'ancienne sous-sidebar dédiée.
  { href: "/dashboard/boutique", label: "Ma boutique", Icon: Store, exact: true, moduleKey: "boutique" },
];

const GROUPES: NavGroupe[] = [
  {
    id: "ventes", label: "Ventes", Icon: ShoppingCart,
    items: [
      { href: "/dashboard/commandes", label: "Commandes", Icon: ShoppingCart, badge: true, moduleKey: "commandes" },
      { href: "/dashboard/factures",  label: "Factures",  Icon: FileText,                 moduleKey: "finance"   },
      { href: "/dashboard/retours",   label: "Retours",   Icon: RotateCcw,                moduleKey: "commandes" },
    ],
  },
  {
    id: "pos", label: "Point de vente", Icon: Monitor,
    items: [
      { href: "/dashboard/logistique?tab=pos",       label: "Caisse POS",            Icon: Monitor,    moduleKey: "pos"     },
      { href: "/dashboard/pos/stock",                label: "Gestion des stocks",    Icon: Boxes,      moduleKey: "pos"     },
      { href: "/dashboard/pos/tracabilite",          label: "Traçabilité",           Icon: Package,    moduleKey: "pos"     },
      // Comptabilité / Charges / Encaissements = sous-outils financiers de la
      // caisse, pilotés par la permission "finance" : un caissier pur
      // (pos:ecriture, finance:aucun) voit la caisse mais pas la comptabilité.
      { href: "/dashboard/pos/comptabilite",         label: "Comptabilité",          Icon: Calculator, moduleKey: "finance" },
      { href: "/dashboard/pos/charges",              label: "Charges d'exploitation", Icon: Receipt,   moduleKey: "finance" },
      { href: "/dashboard/logistique/encaissements", label: "Encaissements COD",     Icon: Wallet,     moduleKey: "finance" },
    ],
  },
  {
    id: "clients", label: "Clients", Icon: Users,
    items: [
      { href: "/dashboard/clients",  label: "Clients",      Icon: Users,         moduleKey: "clients" },
      { href: "/dashboard/avis",     label: "Avis clients", Icon: Star,          moduleKey: "clients" },
      { href: "/dashboard/whatsapp", label: "WhatsApp",     Icon: MessageSquare, badge: true, moduleKey: "clients" },
      { href: "/dashboard/livreurs", label: "Livreurs",     Icon: Truck,         moduleKey: "clients" },
    ],
  },
  {
    id: "catalogue", label: "Catalogue", Icon: Package,
    items: [
      { href: "/dashboard/produits",         label: "Produits",          Icon: Package,  excludePrefix: "/dashboard/produits/digital", moduleKey: "produits" },
      { href: "/dashboard/produits/digital", label: "Produits Digitaux", Icon: Download, moduleKey: "produits" },
      { href: "/dashboard/sourcing",         label: "Sourcing",          Icon: Map,      requiresPalier: "palier2", moduleKey: "produits" },
      { href: "/dashboard/entrepots",        label: "Entrepôts",         Icon: Box,      moduleKey: "produits" },
    ],
  },
  {
    id: "boutique", label: "Boutique", Icon: LayoutGrid,
    items: [
      { href: "/dashboard/themes",        label: "Thèmes",        Icon: LayoutGrid, moduleKey: "boutique" },
      { href: "/dashboard/builder",       label: "Constructeur",  Icon: Sparkles,   moduleKey: "boutique" },
      { href: "/dashboard/transporteurs", label: "Transporteurs", Icon: Truck,      moduleKey: "boutique" },
      { href: "/dashboard/connecteurs",   label: "Connecteurs",   Icon: Plug,       moduleKey: "boutique" },
      { href: "/dashboard/feeds",         label: "Flux produits", Icon: Link2,      moduleKey: "boutique" },
      { href: "/dashboard/campagnes",     label: "Campagnes",     Icon: Bell,       moduleKey: "boutique" },
    ],
  },
  {
    id: "croissance", label: "Croissance", Icon: BarChart3,
    items: [
      { href: "/dashboard/analytics",   label: "Analytics",   Icon: BarChart3,    moduleKey: "produits"  },
      { href: "/dashboard/objectifs",   label: "Objectifs",   Icon: Target,       moduleKey: "produits"  },
      { href: "/dashboard/rapports",    label: "Rapports",    Icon: FileBarChart, moduleKey: "produits"  },
      { href: "/dashboard/marketing",   label: "Marketing",   Icon: Megaphone,    requiresPalier: "palier1", moduleKey: "marketing" },
      { href: "/dashboard/affiliation", label: "Affiliation", Icon: UserCheck,    moduleKey: "marketing" },
    ],
  },
  {
    id: "finance", label: "Finance", Icon: Wallet,
    items: [
      { href: "/dashboard/revenus",   label: "Revenus",   Icon: DollarSign, moduleKey: "finance" },
      { href: "/dashboard/paiements", label: "Paiements", Icon: CreditCard, moduleKey: "finance" },
      { href: "/dashboard/wallet",    label: "Wallet",    Icon: Wallet,     moduleKey: "finance" },
    ],
  },
  {
    id: "compte", label: "Compte", Icon: Settings2,
    items: [
      { href: "/dashboard/abonnement", label: "Abonnement", Icon: CreditCard, opensAbonnement: true, moduleKey: "parametres" },
    ],
  },
];

// ─── Lien de premier niveau (raccourci hors groupe) ───────────────────────────

function LienPrincipal({
  item, pathname, searchParams, palier, accent = "#F5A623", activeBg = "#FFF7ED", activeText = "#92400E",
}: {
  item: NavItem;
  pathname: string;
  searchParams: URLSearchParams;
  palier?: Palier;
  accent?: string;
  activeBg?: string;
  activeText?: string;
}) {
  const { openAbonnement } = useAbonnementOverlay();
  const active = estActif(item, pathname, searchParams);
  const locked = !!item.requiresPalier && !palierAuMoins(palier ?? "palier0", item.requiresPalier);

  const contenu = (
    <>
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
          style={{ backgroundColor: accent }}
        />
      )}
      <span
        className="flex-shrink-0 flex items-center justify-center w-[30px] h-[30px] rounded-lg transition-all"
        style={active
          ? { backgroundColor: `${accent}22`, color: accent }
          : { backgroundColor: "#F5F5F5", color: locked ? "#D1D5DB" : "#9CA3AF" }}
      >
        <item.Icon size={16} />
      </span>
      <span className={cn(
        "flex-1 truncate leading-none font-medium",
        locked ? "text-gray-400" : active ? "font-semibold text-[#111111]" : "text-gray-600 group-hover:text-[#111111]",
      )}>
        {item.label}
      </span>
      {locked && <Lock size={12} className="flex-shrink-0 text-gray-300" />}
      {!locked && item.badge && (
        <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: accent }} />
      )}
    </>
  );

  const className = cn(
    "relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 group",
    !active && !locked && "hover:bg-[#FFF7ED]",
    locked && "cursor-pointer hover:bg-[#FFF7ED]/60",
  );

  if (locked) {
    return (
      <button type="button" onClick={() => openAbonnement(item.requiresPalier)} className={cn(className, "w-full text-left")}>
        {contenu}
      </button>
    );
  }
  if (item.opensAbonnement) {
    return (
      <button type="button" onClick={() => openAbonnement()} className={cn(className, "w-full text-left")}
        style={active ? { backgroundColor: activeBg, color: activeText } : undefined}>
        {contenu}
      </button>
    );
  }
  return (
    <Link href={item.href} className={className} style={active ? { backgroundColor: activeBg, color: activeText } : undefined}>
      {contenu}
    </Link>
  );
}

// ─── Lien enfant (à l'intérieur d'un groupe déplié) ───────────────────────────

function LienEnfant({
  item, pathname, searchParams, palier, accent = "#F5A623", activeBg = "#FFF7ED", activeText = "#92400E",
}: {
  item: NavItem;
  pathname: string;
  searchParams: URLSearchParams;
  palier?: Palier;
  accent?: string;
  activeBg?: string;
  activeText?: string;
}) {
  const { openAbonnement } = useAbonnementOverlay();
  const active = estActif(item, pathname, searchParams);
  const locked = !!item.requiresPalier && !palierAuMoins(palier ?? "palier0", item.requiresPalier);

  const contenu = (
    <>
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors"
        style={{ backgroundColor: active ? accent : locked ? "#E8E8E8" : "#D8D8D8" }}
      />
      <span className={cn(
        "flex-1 truncate leading-none",
        locked ? "text-gray-400" : active ? "font-semibold text-[#111111]" : "text-gray-500 group-hover:text-[#111111]",
      )}>
        {item.label}
      </span>
      {locked && <Lock size={11} className="flex-shrink-0 text-gray-300" />}
      {!locked && item.badge && (
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: accent }} />
      )}
    </>
  );

  const className = cn(
    "relative flex items-center gap-2.5 w-full pl-3 pr-3 py-2 rounded-lg text-[13px] transition-all duration-150 group",
    !active && !locked && "hover:bg-[#FFF7ED]",
    locked && "cursor-pointer hover:bg-[#FFF7ED]/60",
  );

  if (locked) {
    return (
      <button type="button" onClick={() => openAbonnement(item.requiresPalier)} className={cn(className, "text-left")}>
        {contenu}
      </button>
    );
  }
  if (item.opensAbonnement) {
    return (
      <button type="button" onClick={() => openAbonnement()} className={cn(className, "text-left")}
        style={active ? { backgroundColor: activeBg, color: activeText } : undefined}>
        {contenu}
      </button>
    );
  }
  return (
    <Link href={item.href} className={className} style={active ? { backgroundColor: activeBg, color: activeText } : undefined}>
      {contenu}
    </Link>
  );
}

// ─── Groupe repliable ─────────────────────────────────────────────────────────

function GroupeRepliable({
  groupe, pathname, searchParams, palier, ouvert, onToggle,
}: {
  groupe: NavGroupe;
  pathname: string;
  searchParams: URLSearchParams;
  palier?: Palier;
  ouvert: boolean;
  onToggle: () => void;
}) {
  const Icon = groupe.Icon;
  const contientActif = groupe.items.some(it => estActif(it, pathname, searchParams));
  // Replié, le groupe signale quand même une activité à traiter.
  const badgeMasque = !ouvert && groupe.items.some(it => it.badge);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={ouvert}
        className={cn(
          "w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all duration-150",
          !contientActif && "text-[#999999] hover:bg-[#FFF7ED] hover:text-[#111111]",
        )}
        style={contientActif ? { color: "#D4911A" } : undefined}
      >
        <Icon size={14} className="flex-shrink-0" />
        <span className="flex-1 text-left text-[11.5px] font-bold uppercase tracking-[0.1em]">
          {groupe.label}
        </span>
        {badgeMasque && (
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: "#F5A623" }} />
        )}
        <ChevronDown
          size={13}
          className={cn("flex-shrink-0 transition-transform duration-200", ouvert && "rotate-180")}
        />
      </button>

      {ouvert && (
        <div className="ml-[19px] pl-2.5 border-l border-[#F0F0F0] mt-0.5 mb-1 space-y-0.5">
          {groupe.items.map(item => (
            <LienEnfant
              key={item.href}
              item={item}
              pathname={pathname}
              searchParams={searchParams}
              palier={palier}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({ boutiqueNom, boutiqueSlug, userInitials, palier, permissions }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Groupes visibles pour cette session (les items sans accès sont retirés,
  // et un groupe entièrement vidé par le filtrage disparaît avec eux).
  const groupes = GROUPES
    .map(g => ({ ...g, items: filtreParPermission(g.items, permissions) }))
    .filter(g => g.items.length > 0);

  // Groupe qui contient la route courante.
  const idActif = groupes
    .find(g => g.items.some(it => estActif(it, pathname, searchParams)))?.id;

  // Choix explicite de l'utilisateur, par groupe. Tant qu'il n'a rien touché,
  // le groupe suit la route (l'actif est déplié, les autres repliés) ; dès
  // qu'il replie ou déplie un groupe à la main, son choix prime et n'est plus
  // écrasé par la navigation. État purement dérivé : aucun effet, donc aucun
  // risque de re-déplier un groupe que l'utilisateur vient de fermer.
  const [choix, setChoix] = useState<Record<string, boolean>>({});
  const estOuvert = (id: string) => choix[id] ?? (id === idActif);
  const toggle = (id: string) => setChoix(prev => ({ ...prev, [id]: !(prev[id] ?? (id === idActif)) }));

  return (
    <aside
      className="flex-shrink-0 h-screen flex flex-col bg-white border-r border-gray-100/80"
      style={{
        width: "252px",
        boxShadow: "2px 0 20px rgba(0,0,0,0.04)",
        fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif",
      }}
    >
      {/* En-tête */}
      <div className="h-[60px] flex items-center px-5 flex-shrink-0 border-b border-gray-100/80">
        <span
          className="text-[15px] font-bold tracking-tight leading-tight"
          style={{
            background: "linear-gradient(135deg,#111111 0%,#333333 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Build your empire here
        </span>
      </div>

      {/* Navigation — raccourcis puis groupes repliables */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-0.5 mb-1.5">
          {PRIMAIRES.map(item => (
            <LienPrincipal
              key={item.href}
              item={item}
              pathname={pathname}
              searchParams={searchParams}
              palier={palier}
            />
          ))}
        </div>

        <div className="space-y-0.5">
          {groupes.map(groupe => (
            <GroupeRepliable
              key={groupe.id}
              groupe={groupe}
              pathname={pathname}
              searchParams={searchParams}
              palier={palier}
              ouvert={estOuvert(groupe.id)}
              onToggle={() => toggle(groupe.id)}
            />
          ))}
        </div>
      </nav>

      {/* Pied — vitrine + compte */}
      <div className="flex-shrink-0 px-3.5 py-3 space-y-2" style={{ borderTop: "1px solid #F0F0F0" }}>
        <BoutiqueSwitcher />
        {boutiqueSlug && (
          <a
            href={`/${boutiqueSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl active:scale-[0.98] transition-all group"
            style={{
              background: "linear-gradient(135deg,#111111,#333333)",
              boxShadow: "0 2px 12px rgba(17,17,17,0.22)",
            }}
          >
            <ExternalLink size={14} className="text-white/80 flex-shrink-0" />
            <span className="text-[12.5px] font-bold text-white flex-1 truncate">
              {boutiqueNom || "Voir ma boutique"}
            </span>
            <ChevronRight size={13} className="text-white/40 group-hover:text-white/80 transition-all group-hover:translate-x-0.5" />
          </a>
        )}

        <Link
          href="/dashboard/parametres"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
            pathname.startsWith("/dashboard/parametres") ? "bg-[#FFF7ED]" : "hover:bg-[#FFF7ED]",
          )}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-[13px] font-bold"
            style={{
              background: "linear-gradient(135deg,#F5A623,#D4911A)",
              boxShadow: "0 2px 8px rgba(245,166,35,0.3)",
            }}
          >
            {userInitials || "A"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[#111111] leading-tight">Mon compte</div>
            <div className="text-[11px] text-[#999999] leading-none mt-1">Paramètres</div>
          </div>
          <Settings2 size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
        </Link>
      </div>
    </aside>
  );
}
