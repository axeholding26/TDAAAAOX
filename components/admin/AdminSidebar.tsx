"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import {
  LayoutDashboard, Store, ShoppingCart, Users, DollarSign,
  Truck, Settings, LogOut, ChevronRight,
  BarChart3, Lock
} from "lucide-react";

type IconComponent = React.FC<{ size?: number; className?: string }>;
type NavItem = { href: string; label: string; icon: IconComponent; exact?: boolean };
type Section = { label: string; items: NavItem[] };

const SECTIONS: Section[] = [
  {
    label: "Vue d'ensemble",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Analytique",
    items: [
      { href: "/admin/boutiques", label: "Boutiques", icon: Store },
      { href: "/admin/commandes", label: "Commandes", icon: ShoppingCart },
      { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
    ],
  },
  {
    label: "Finances",
    items: [
      { href: "/admin/finances", label: "Revenus & Commissions", icon: DollarSign },
    ],
  },
  {
    label: "Opérations",
    items: [
      { href: "/admin/livreurs", label: "Livreurs", icon: Truck },
    ],
  },
  {
    label: "Système",
    items: [
      { href: "/admin/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-[#080810] border-r border-white/5 flex flex-col fixed inset-y-0 left-0 z-40">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <img
            src="/logo-dark.png" alt="Axso"
            style={{ height: "28px", width: "auto", objectFit: "contain", flexShrink: 0 }}
          />
          <p className="text-[#F5A623]/60 text-[10px] uppercase tracking-widest">Admin Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-6 overflow-y-auto">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest px-3 mb-2">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group relative ${
                      active
                        ? "bg-[#F5A623]/10 text-[#F5A623]"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#F5A623] rounded-r-full" />
                    )}
                    <Icon size={15} className="flex-shrink-0" />
                    <span className="flex-1 font-medium">{item.label}</span>
                    {active && <ChevronRight size={12} className="opacity-60" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/5 space-y-0.5">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all text-sm"
        >
          <LogOut size={14} />
          <span>Retour tableau de bord</span>
        </Link>
      </div>
    </aside>
  );
}
