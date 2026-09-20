"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Store, DollarSign, Truck, CreditCard,
  UserPlus, LogOut, Megaphone,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Vue globale", icon: LayoutDashboard, exact: true },
  { href: "/admin/boutiques", label: "Boutiques", icon: Store },
  { href: "/admin/abonnements", label: "Abonnements", icon: CreditCard },
  { href: "/admin/finances", label: "Finances & Wallet", icon: DollarSign },
  { href: "/admin/axsocial", label: "Axsocial", icon: Megaphone },
  { href: "/admin/livreurs", label: "Livreurs", icon: Truck },
  { href: "/admin/equipe", label: "Équipe", icon: UserPlus },
];

export function AdminNav({ email, role }: { email: string; role: "admin" | "admin_lecteur" }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col border-r"
      style={{ background: "linear-gradient(180deg,#1A1A1A,#111111)", borderColor: "rgba(245,166,35,0.12)" }}
    >
      <div className="p-6 border-b" style={{ borderColor: "rgba(245,166,35,0.12)" }}>
        <div className="flex items-center gap-3">
          <img
            src="/logo-dark.png" alt="Axso"
            style={{ height: "30px", width: "auto", objectFit: "contain", flexShrink: 0 }}
          />
          <p className="text-[10px] font-medium" style={{ color: "#AAAAAA" }}>Contrôle plateforme</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={
                active
                  ? { background: "rgba(245,166,35,0.12)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.25)" }
                  : { color: "#AAAAAA", border: "1px solid transparent" }
              }
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t space-y-1" style={{ borderColor: "rgba(245,166,35,0.12)" }}>
        <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}>
            {email.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{email}</p>
            <p className="text-[10px] font-medium" style={{ color: role === "admin" ? "#16A34A" : "#AAAAAA" }}>
              {role === "admin" ? "Super Admin" : "Lecture seule"}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/connexion" })}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-white/5"
          style={{ color: "#AAAAAA" }}
        >
          <LogOut size={16} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
