"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Download, Plus, PackagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubNavItem {
  href: string;
  label: string;
  Icon: React.ElementType;
  exact?: boolean;
  excludePrefix?: string;
}

// Sous-navigation du module Produits — pilote du pattern sidebar à deux
// niveaux (voir doc navigation AXSO). Ne référence que des pages qui
// existent réellement aujourd'hui ; pas de fausse destination (ex: pas de
// "Catégories" tant qu'il n'y a pas de CRUD dédié, pas de "Variantes de
// prix" tant que ça reste une gestion par produit sans liste autonome).
const SOUS_NAV: SubNavItem[] = [
  { href: "/dashboard/produits", label: "Tous les produits", Icon: Package, excludePrefix: "/dashboard/produits/digital" },
  { href: "/dashboard/produits/digital", label: "Produits digitaux", Icon: Download },
  { href: "/dashboard/produits/nouveau", label: "Nouveau produit", Icon: Plus },
  { href: "/dashboard/produits/creer", label: "Nouveau produit digital", Icon: PackagePlus },
];

function isActive(item: SubNavItem, pathname: string) {
  if (item.excludePrefix && pathname.startsWith(item.excludePrefix)) return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ProduitsSubSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex-shrink-0 hidden lg:flex flex-col"
      style={{ width: "196px" }}
    >
      <p className="text-[10.5px] font-bold tracking-[0.15em] uppercase text-gray-400 px-1 mb-3">Produits</p>
      <nav className="space-y-0.5">
        {SOUS_NAV.map(item => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150",
                active ? "bg-[#FFF7ED] text-[#92400E]" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              )}
            >
              <item.Icon size={15} style={{ color: active ? "#F5A623" : "#9CA3AF" }} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
