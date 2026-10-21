"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Package, ShoppingCart, X, BarChart3, TrendingUp, Megaphone, Truck, Star, Settings, Palette, Globe2, Calendar, Search, MessageSquare, Store, Paintbrush, CreditCard, Package2, Bot, Zap, Wallet, LifeBuoy } from "lucide-react";
import {
  IconAccueil, IconProduits, IconAxia, IconCommandes,
} from "@/components/dashboard/AppIcons";
import { useT } from "@/components/I18nProvider";
import { useAbonnementOverlay } from "@/components/dashboard/AbonnementOverlayProvider";
import { MESSAGE_PRO } from "@/components/dashboard/AxiaBulle";
import { palierAuMoins, type Palier } from "@/lib/plans";
import type { ModuleKey, Niveau } from "@/lib/permissions";

// Mêmes règles que la Sidebar : un lien disparaît si le membre d'équipe n'a aucun accès
// au module, et un lien au-dessus du palier ouvre l'offre d'abonnement au lieu de la page.
type ItemMobile = { href: string; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; moduleKey?: ModuleKey; requiresPalier?: Palier };

const GROUPS: { label: string; color: string; items: ItemMobile[] }[] = [
  {
    label: "Intelligence IA", color: "#111111",
    items: [
      { href: "/dashboard",            label: "Axia — Assistante IA", icon: Zap, requiresPalier: "palier1" },
      { href: "/dashboard/scheduler", label: "Planificateur",    icon: Calendar, moduleKey: "marketing" },
    ],
  },
  {
    label: "Boutique", color: "#F5A623",
    items: [
      { href: "/dashboard/accueil",    label: "Accueil",          icon: LayoutDashboard },
      { href: "/dashboard/produits",   label: "Produits",         icon: Package, moduleKey: "produits" },
      { href: "/dashboard/commandes",  label: "Commandes",        icon: ShoppingCart, moduleKey: "commandes" },
      { href: "/dashboard/clients",    label: "Clients",          icon: Bot, moduleKey: "clients" },
      { href: "/dashboard/avis",       label: "Avis clients",     icon: Star, moduleKey: "clients" },
    ],
  },
  {
    label: "Design", color: "#ec4899",
    items: [
      { href: "/dashboard/boutique",   label: "Ma Boutique",      icon: Store, moduleKey: "boutique" },
      { href: "/dashboard/builder",    label: "Constructeur",     icon: Paintbrush, moduleKey: "boutique" },
      { href: "/dashboard/themes",     label: "Thèmes",           icon: Palette, moduleKey: "boutique" },
    ],
  },
  {
    label: "Finance", color: "#34d399",
    items: [
      { href: "/dashboard/paiements",  label: "Paiements",        icon: CreditCard, moduleKey: "finance" },
      { href: "/dashboard/revenus",    label: "Revenus",          icon: TrendingUp, moduleKey: "finance" },
      { href: "/dashboard/wallet",     label: "Wallet",           icon: Wallet, moduleKey: "finance" },
    ],
  },
  {
    label: "Croissance", color: "#f472b6",
    items: [
      { href: "/dashboard/marketing",    label: "Marketing",      icon: Megaphone, moduleKey: "marketing", requiresPalier: "palier1" },
      { href: "/dashboard/publicite",    label: "Publicité Ads",  icon: Megaphone, moduleKey: "marketing" },
      { href: "/dashboard/sms",          label: "SMS / WhatsApp", icon: MessageSquare, moduleKey: "marketing" },
      { href: "/dashboard/feeds",        label: "Flux Produits",  icon: Globe2, moduleKey: "boutique" },
      { href: "/dashboard/veille",       label: "Veille Concurr.",icon: Search, moduleKey: "marketing" },
      { href: "/dashboard/sourcing",     label: "Sourcing",       icon: Package2, moduleKey: "produits", requiresPalier: "palier2" },
    ],
  },
  {
    label: "Opérations", color: "#fb923c",
    items: [
      { href: "/dashboard/logistique",   label: "Logistique",     icon: Truck, moduleKey: "commandes" },
      { href: "/dashboard/affiliation",  label: "Affiliation",    icon: TrendingUp, moduleKey: "marketing" },
      { href: "/dashboard/campagnes",    label: "Campagnes",      icon: Megaphone, moduleKey: "marketing" },
    ],
  },
  {
    label: "Analytiques", color: "#FFD280",
    items: [
      { href: "/dashboard/analytics",  label: "Analytics",        icon: BarChart3, moduleKey: "produits" },
      { href: "/dashboard/parametres", label: "Paramètres",       icon: Settings, moduleKey: "parametres" },
      { href: "/dashboard/support",    label: "Signaler un problème", icon: LifeBuoy },
    ],
  },
];

const MAIN_TABS = [
  { href: "/dashboard/accueil",   label: "Accueil",   AppIcon: IconAccueil,   exact: true },
  { href: "/dashboard/produits",  label: "Produits",  AppIcon: IconProduits, moduleKey: "produits" as ModuleKey },
  { href: "/dashboard/commandes", label: "Commandes", AppIcon: IconCommandes, moduleKey: "commandes" as ModuleKey },
];

export function MobileBottomNav({ permissions }: { permissions?: Record<ModuleKey, Niveau> }) {
  const t = useT();
  const { openAbonnement, palier } = useAbonnementOverlay();
  const autorise = (it: { moduleKey?: ModuleKey }) => !permissions || !it.moduleKey || permissions[it.moduleKey] !== "aucun";
  const onglets = MAIN_TABS.filter(autorise);
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  // Bouton AXIA : choix « Discuter » (page AXIA) ou « Assister » (fenêtre sur la page en cours,
  // gérée par AxiaBulle). Le compteur vient d'AxiaBulle (propositions en attente).
  const [choixAxia, setChoixAxia] = useState(false);
  const [compteAxia, setCompteAxia] = useState(0);
  useEffect(() => {
    const maj = (e: Event) => setCompteAxia((e as CustomEvent<number>).detail || 0);
    window.addEventListener("axia:compte", maj);
    window.dispatchEvent(new Event("axia:rafraichir"));
    return () => window.removeEventListener("axia:compte", maj);
  }, []);
  useEffect(() => { setChoixAxia(false); }, [pathname]);
  const ouvrirAxia = () => (palierAuMoins(palier, "palier1") ? setChoixAxia((v) => !v) : openAbonnement("palier1", MESSAGE_PRO));

  // "/dashboard" est l'interface AXIA plein écran réelle (voir
  // app/(dashboard)/dashboard/page.tsx) — /dashboard/axia est une ancienne
  // page de chat basique conservée pour compatibilité mais plus utilisée
  // comme point d'entrée. Un compte palier0 tapant ce bouton est redirigé
  // côté serveur vers le tableau de bord avec le toast explicatif Pro.
  const axiaActive = pathname === "/dashboard";

  return (
    <>
      {choixAxia && <div className="md:hidden fixed inset-0 z-40" onClick={() => setChoixAxia(false)} aria-hidden />}

      {/* ── Îlot flottant ── */}
      <div
        className="md:hidden fixed z-50 left-1/2 -translate-x-1/2"
        style={{ bottom: `calc(env(safe-area-inset-bottom) + 16px)` }}
      >
        <div className="relative flex items-end">

          {/* Axia — flottante au-dessus du centre */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-10 z-10 flex flex-col items-center">
            {choixAxia && (
              <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 flex gap-2" style={{ animation: "axiaChoix .18s ease-out" }}>
                <button onClick={() => { setChoixAxia(false); router.push("/dashboard"); }}
                  className="px-4 py-2.5 rounded-full bg-[#111111] text-white text-[13px] font-semibold shadow-lg whitespace-nowrap active:scale-95 transition-transform">
                  {t("Discuter")}
                </button>
                <button onClick={() => { setChoixAxia(false); window.dispatchEvent(new Event("axia:assister")); }}
                  className="px-4 py-2.5 rounded-full bg-[#F5A623] text-white text-[13px] font-semibold shadow-lg whitespace-nowrap active:scale-95 transition-transform">
                  {t("Assister")}
                </button>
              </div>
            )}
            <button
              onClick={ouvrirAxia}
              aria-label={t("Ouvrir AXIA")}
              aria-expanded={choixAxia}
              className="relative transition-transform active:scale-90"
              style={{ filter: `drop-shadow(0 4px 14px rgba(17,17,17,${axiaActive || choixAxia ? "0.55" : "0.35"}))` }}
            >
              <IconAxia size={52} />
              {compteAxia > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">{compteAxia}</span>
              )}
            </button>
            <style>{`@keyframes axiaChoix { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>
          </div>

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
            {onglets.filter(o => o.href !== "/dashboard/commandes").map((tab) => {
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
                    {t(tab.label)}
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
                {t("Axia")}
              </span>
              {axiaActive && (
                <div className="w-1 h-1 rounded-full bg-[#111111] mt-0.5" />
              )}
            </div>

            {/* Tab droite — Commandes */}
            {onglets.filter(o => o.href === "/dashboard/commandes").map((tab) => {
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
                    {t(tab.label)}
                  </span>
                  {active && (
                    <div className="w-1 h-1 rounded-full bg-[#F5A623] mt-0.5" />
                  )}
                </Link>
              );
            })}

            {/* Bouton Plus */}
            <button
              type="button"
              aria-label={t("Tous les modules")}
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
                {t("Plus")}
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
                  <h2 className="text-[15px] font-bold text-[#111111]">{t("Tous les modules")}</h2>
                  <p className="text-[11.5px] text-[#AAAAAA] mt-0.5">{t("Accédez à toutes les fonctionnalités")}</p>
                </div>
                <button
                  type="button"
                  aria-label={t("Fermer")}
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 flex items-center justify-center bg-[#F5F5F7] rounded-xl text-[#666]"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Modules */}
            <div className="overflow-y-auto pb-10" style={{ maxHeight: "calc(82vh - 90px)" }}>
              {GROUPS.map((g) => ({ ...g, items: g.items.filter(autorise) })).filter((g) => g.items.length > 0).map((group) => (
                <div key={group.label} className="px-4 pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-3 rounded-full" style={{ background: group.color }} />
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#AAAAAA]">
                      {t(group.label)}
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
                          onClick={(e) => {
                            setDrawerOpen(false);
                            if (item.requiresPalier && !palierAuMoins(palier, item.requiresPalier)) {
                              e.preventDefault();
                              openAbonnement(item.requiresPalier);
                            }
                          }}
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
                            {t(item.label)}
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
