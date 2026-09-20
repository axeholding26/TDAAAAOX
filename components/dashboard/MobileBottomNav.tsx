"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, ShoppingCart,
  X, BarChart3, TrendingUp, Megaphone, Truck, Star,
  Settings, Bike, Palette, Globe2, Calendar,
  Search, MessageSquare, Store, Paintbrush, CreditCard,
  Package2, Bot, Zap, Wallet,
} from "lucide-react";
import {
  IconAccueil, IconProduits, IconAxia, IconCommandes,
} from "@/components/dashboard/AppIcons";

const GROUPS = [
  {
    label: "Intelligence IA", color: "#111111",
    items: [
      { href: "/dashboard",            label: "Axia — Assistante IA", icon: Zap },
      { href: "/dashboard/scheduler", label: "Planificateur",    icon: Calendar },
    ],
  },
  {
    label: "Boutique", color: "#F5A623",
    items: [
      { href: "/dashboard/accueil",    label: "Accueil",          icon: LayoutDashboard },
      { href: "/dashboard/produits",   label: "Produits",         icon: Package },
      { href: "/dashboard/commandes",  label: "Commandes",        icon: ShoppingCart },
      { href: "/dashboard/clients",    label: "Clients",          icon: Bot },
      { href: "/dashboard/avis",       label: "Avis clients",     icon: Star },
    ],
  },
  {
    label: "Design", color: "#ec4899",
    items: [
      { href: "/dashboard/boutique",   label: "Ma Boutique",      icon: Store },
      { href: "/dashboard/builder",    label: "Constructeur",     icon: Paintbrush },
      { href: "/dashboard/themes",     label: "Thèmes",           icon: Palette },
    ],
  },
  {
    label: "Finance", color: "#34d399",
    items: [
      { href: "/dashboard/paiements",  label: "Paiements",        icon: CreditCard },
      { href: "/dashboard/revenus",    label: "Revenus",          icon: TrendingUp },
      { href: "/dashboard/wallet",     label: "Wallet",           icon: Wallet },
    ],
  },
  {
    label: "Croissance", color: "#f472b6",
    items: [
      { href: "/dashboard/marketing",    label: "Marketing",      icon: Megaphone },
      { href: "/dashboard/publicite",    label: "Publicité Ads",  icon: Megaphone },
      { href: "/dashboard/sms",          label: "SMS / WhatsApp", icon: MessageSquare },
      { href: "/dashboard/feeds",        label: "Flux Produits",  icon: Globe2 },
      { href: "/dashboard/veille",       label: "Veille Concurr.",icon: Search },
      { href: "/dashboard/dropshipping", label: "Dropshipping",   icon: Package2 },
    ],
  },
  {
    label: "Opérations", color: "#fb923c",
    items: [
      { href: "/dashboard/logistique",   label: "Logistique",     icon: Truck },
      { href: "/dashboard/affiliation",  label: "Affiliation",    icon: TrendingUp },
      { href: "/dashboard/campagnes",    label: "Campagnes",      icon: Megaphone },
    ],
  },
  {
    label: "Analytiques", color: "#FFD280",
    items: [
      { href: "/dashboard/analytics",  label: "Analytics",        icon: BarChart3 },
      { href: "/dashboard/parametres", label: "Paramètres",       icon: Settings },
    ],
  },
];

const MAIN_TABS = [
  { href: "/dashboard/accueil",   label: "Accueil",   AppIcon: IconAccueil,   exact: true },
  { href: "/dashboard/produits",  label: "Produits",  AppIcon: IconProduits },
  { href: "/dashboard/commandes", label: "Commandes", AppIcon: IconCommandes },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // "/dashboard" est l'interface AXIA plein écran réelle (voir
  // app/(dashboard)/dashboard/page.tsx) — /dashboard/axia est une ancienne
  // page de chat basique conservée pour compatibilité mais plus utilisée
  // comme point d'entrée. Un compte palier0 tapant ce bouton est redirigé
  // côté serveur vers le tableau de bord avec le toast explicatif Pro.
  const axiaActive = pathname === "/dashboard";

  return (
    <>
      {/* ── Îlot flottant ── */}
      <div
        className="md:hidden fixed z-50 left-1/2 -translate-x-1/2"
        style={{ bottom: `calc(env(safe-area-inset-bottom) + 16px)` }}
      >
        <div className="relative flex items-end">

          {/* Axia — flottante au-dessus du centre */}
          <Link
            href="/dashboard"
            className="absolute left-1/2 -translate-x-1/2 -top-10 z-10 flex flex-col items-center gap-0.5"
          >
            <div
              className="transition-transform active:scale-90"
              style={{ filter: `drop-shadow(0 4px 14px rgba(17,17,17,${axiaActive ? "0.55" : "0.35"}))` }}
            >
              <IconAxia size={52} />
            </div>
          </Link>

          {/* Pilule */}
          <div
            className="flex items-center gap-0 px-2 pt-2 pb-1.5 rounded-[32px]"
            style={{
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
              border: "1px solid rgba(235,235,235,0.8)",
            }}
          >
            {/* Tabs gauche */}
            {MAIN_TABS.slice(0, 2).map((tab) => {
              const active = tab.exact
                ? pathname === tab.href
                : pathname.startsWith(tab.href);
              const AppIcon = tab.AppIcon!;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-2xl transition-all"
                >
                  <div className={`transition-all duration-200 ${active ? "scale-105" : "scale-90 opacity-50"}`}>
                    <AppIcon size={28} />
                  </div>
                  <span
                    className="text-[9.5px] font-bold leading-none"
                    style={{ color: active ? "#F5A623" : "#BBBBBB" }}
                  >
                    {tab.label}
                  </span>
                  {active && (
                    <div className="w-1 h-1 rounded-full bg-[#F5A623] mt-0.5" />
                  )}
                </Link>
              );
            })}

            {/* Espace central pour Axia */}
            <div className="w-14 flex-shrink-0 flex flex-col items-center pt-1 pb-0.5">
              <span
                className="text-[9.5px] font-bold leading-none"
                style={{ color: axiaActive ? "#111111" : "#CCCCCC" }}
              >
                Axia
              </span>
              {axiaActive && (
                <div className="w-1 h-1 rounded-full bg-[#111111] mt-0.5" />
              )}
            </div>

            {/* Tab droite — Commandes */}
            {MAIN_TABS.slice(2).map((tab) => {
              const active = pathname.startsWith(tab.href);
              const AppIcon = tab.AppIcon!;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-2xl transition-all"
                >
                  <div className={`transition-all duration-200 ${active ? "scale-105" : "scale-90 opacity-50"}`}>
                    <AppIcon size={28} />
                  </div>
                  <span
                    className="text-[9.5px] font-bold leading-none"
                    style={{ color: active ? "#F5A623" : "#BBBBBB" }}
                  >
                    {tab.label}
                  </span>
                  {active && (
                    <div className="w-1 h-1 rounded-full bg-[#F5A623] mt-0.5" />
                  )}
                </Link>
              );
            })}

            {/* Bouton Plus */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-2xl transition-all"
            >
              <div
                className={`w-7 h-7 flex items-center justify-center rounded-xl transition-all ${drawerOpen ? "bg-[#F5A623]/12 scale-105" : "scale-90 opacity-50"}`}
              >
                <div className="flex flex-col gap-[3px]">
                  <div className="flex gap-[3px]">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: drawerOpen ? "#F5A623" : "#AAAAAA" }} />
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: drawerOpen ? "#F5A623" : "#AAAAAA" }} />
                  </div>
                  <div className="flex gap-[3px]">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: drawerOpen ? "#F5A623" : "#AAAAAA" }} />
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: drawerOpen ? "#F5A623" : "#AAAAAA" }} />
                  </div>
                </div>
              </div>
              <span
                className="text-[9.5px] font-bold leading-none"
                style={{ color: drawerOpen ? "#F5A623" : "#BBBBBB" }}
              >
                Plus
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Drawer tous les modules ── */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60] flex flex-col justify-end"
          onClick={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
        >
          <div
            className="bg-white rounded-t-[28px] overflow-hidden"
            style={{ maxHeight: "82vh", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" }}
          >
            {/* Handle + header */}
            <div className="px-5 pt-3 pb-4 border-b border-[#F5F5F5]">
              <div className="w-10 h-1 bg-[#E5E5E5] rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-bold text-[#111111]">Tous les modules</h2>
                  <p className="text-[11.5px] text-[#AAAAAA] mt-0.5">Accédez à toutes les fonctionnalités</p>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 flex items-center justify-center bg-[#F5F5F7] rounded-xl text-[#666]"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Modules */}
            <div className="overflow-y-auto pb-10" style={{ maxHeight: "calc(82vh - 90px)" }}>
              {GROUPS.map((group) => (
                <div key={group.label} className="px-4 pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-3 rounded-full" style={{ background: group.color }} />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#AAAAAA]">
                      {group.label}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = item.href === "/dashboard/accueil" || item.href === "/dashboard"
                        ? pathname === item.href
                        : pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setDrawerOpen(false)}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all"
                          style={{
                            background: active ? group.color + "12" : "#F9F9F9",
                            border: `1px solid ${active ? group.color + "35" : "#F0F0F0"}`,
                          }}
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{
                              background: active ? group.color + "18" : "white",
                              border: `1px solid ${active ? group.color + "30" : "#EBEBEB"}`,
                            }}
                          >
                            <Icon size={16} style={{ color: active ? group.color : "#888" }} />
                          </div>
                          <span
                            className="text-[10px] font-semibold text-center leading-tight"
                            style={{ color: active ? group.color : "#777" }}
                          >
                            {item.label}
                          </span>
                          {active && (
                            <div className="w-1 h-1 rounded-full" style={{ background: group.color }} />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
