"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { basculerBoutique } from "@/components/dashboard/BoutiqueSwitcher";
import {
  Bell, ShoppingBag, MessageCircle, AlertTriangle, DollarSign, Star, Package, Info,
} from "lucide-react";

interface NotifMarchand {
  id: string; type: string; titre: string; message: string;
  lien?: string | null; lu: boolean; createdAt: string;
  tenantId: string; nomBoutique: string; autreBoutique: boolean;
}

const NOTIF_ICONS: Record<string, { Icon: any; color: string }> = {
  nouvelle_commande: { Icon: ShoppingBag,   color: "#F5A623" },
  commande_whatsapp: { Icon: MessageCircle, color: "#25D366" },
  escalade_humain:   { Icon: AlertTriangle, color: "#ef4444" },
  paiement:          { Icon: DollarSign,    color: "#10b981" },
  avis:              { Icon: Star,          color: "#F5A623" },
  stock_bas:         { Icon: Package,       color: "#ef4444" },
};
function iconPourType(type: string) { return NOTIF_ICONS[type] ?? { Icon: Info, color: "#9CA3AF" }; }
function tempsEcoule(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

// Cloche de notifications pour l'écran AXIA plein écran — Header.tsx (le
// header du dashboard classique) a son propre système équivalent en thème
// clair, jamais monté ici puisque AXIA remplace tout le chrome habituel.
// Sans ça, un marchand qui atterrit sur AXIA (écran par défaut) n'a aucune
// visibilité sur les nouvelles commandes tant qu'il ne navigue pas ailleurs.
export function AxiaNotifBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifMarchand[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const charger = async () => {
    try {
      const res = await fetch("/api/notifications-marchand");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setNonLues(data.nonLues ?? 0);
    } catch { /* silencieux */ }
  };

  useEffect(() => {
    charger();
    const id = setInterval(charger, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function marquerLu(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n));
    setNonLues(n => Math.max(0, n - 1));
    try { await fetch("/api/notifications-marchand", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); } catch {}
  }
  async function marquerToutLu() {
    setNonLues(0);
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })));
    try { await fetch("/api/notifications-marchand", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toutMarquer: true }) }); } catch {}
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)} title="Notifications"
        className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10 flex-shrink-0">
        <Bell size={13} className="text-white/60" />
        {nonLues > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-[3px] rounded-full flex items-center justify-center text-[8px] font-extrabold text-white"
            style={{ background: "#F5A623", border: "2px solid #16233f" }}>
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[42px] w-[300px] max-w-[85vw] rounded-2xl overflow-hidden z-50"
          style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 64px rgba(0,0,0,0.45)" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-[13px] font-bold text-white">Notifications</span>
            {nonLues > 0 && (
              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}>
                {nonLues} nouvelle{nonLues > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="max-h-[340px] overflow-y-auto">
            {notifications.length === 0 && (
              <div className="py-8 text-center px-4">
                <Bell size={20} className="mx-auto mb-2 text-white/15" />
                <p className="text-[12px] text-white/35">Aucune notification pour l'instant</p>
              </div>
            )}
            {notifications.map((n, i) => {
              const { Icon, color } = iconPourType(n.type);
              const content = (
                <div
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5 cursor-pointer"
                  style={{
                    borderBottom: i < notifications.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    background: n.lu ? "transparent" : "rgba(245,166,35,0.05)",
                  }}
                  onClick={() => { if (!n.lu) marquerLu(n.id); setOpen(false); }}
                >
                  <Icon size={15} style={{ color, flexShrink: 0, marginTop: 2 }} />
                  <div className="min-w-0">
                    <p className="text-[12.5px] leading-snug" style={{ color: "rgba(255,255,255,0.9)", fontWeight: n.lu ? 400 : 700 }}>{n.titre}</p>
                    <p className="text-[11.5px] mt-0.5 leading-snug text-white/45">{n.message}</p>
                    <p className="text-[10.5px] mt-1 text-white/30">{tempsEcoule(n.createdAt)}{n.autreBoutique ? ` · ${n.nomBoutique}` : ""}</p>
                  </div>
                </div>
              );
              // Notification d'une autre boutique : on bascule dessus avant d'ouvrir le lien.
              if (n.autreBoutique) return <div key={n.id} onClick={() => basculerBoutique(n.tenantId, n.lien)}>{content}</div>;
              return n.lien
                ? <Link key={n.id} href={n.lien}>{content}</Link>
                : <div key={n.id}>{content}</div>;
            })}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <button onClick={marquerToutLu} className="text-[11.5px] font-bold" style={{ color: "#F5A623" }}>
                Tout marquer comme lu
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
