"use client";
import { useEffect, useState, useCallback } from "react";
import { Bell, Package, X, CheckCheck, Check, AlertTriangle, Bike, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

type Notif = {
  id: string;
  type: string;
  titre: string;
  message: string;
  commandeId: string | null;
  lu: boolean;
  createdAt: string;
};

interface Props {
  livreurId: string;
}

export function NotificationsPanel({ livreurId }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [nonLues, setNonLues] = useState(0);

  const charger = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications || []);
      setNonLues(data.nonLues || 0);
    }
  }, []);

  useEffect(() => {
    charger();

    // SSE pour les notifs en temps réel
    const source = new EventSource("/api/notifications/sse");

    source.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);

        if (payload.type === "notifications" && payload.data?.length > 0) {
          charger();
          // Toast pour chaque nouvelle notif
          payload.data.forEach((n: Notif) => {
            toast(n.titre, {
              description: n.message,
              icon: <Bell size={14} />,
              duration: 6000,
            });
          });
        }

        if (payload.type === "commandes" && payload.data?.length > 0) {
          payload.data.forEach((cmd: any) => {
            toast("Nouvelle commande assignée !", {
              description: `${cmd.clientNom} · ${cmd.ville}`,
              icon: <Package size={14} />,
              duration: 8000,
            });
          });
          charger();
        }
      } catch {}
    };

    source.onerror = () => source.close();

    return () => source.close();
  }, [charger]);

  async function toutMarquerLu() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNonLues(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })));
  }

  const TYPE_ICON_MAP: Record<string, LucideIcon> = {
    assignation: Package,
    nouvelle_commande: Bike,
    statut: Check,
    alerte: AlertTriangle,
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-11 h-11 rounded-2xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center text-gray-400 hover:text-white hover:border-[#F5A623]/30 transition-all"
      >
        <Bell size={18} />
        {nonLues > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#F5A623] rounded-full text-black text-[10px] font-bold flex items-center justify-center animate-pulse">
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-14 w-80 bg-[#111] border border-[#F5A623]/20 rounded-2xl shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-[#F5A623]" />
                <h3 className="text-white font-semibold text-sm">Notifications</h3>
                {nonLues > 0 && (
                  <span className="bg-[#F5A623] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">{nonLues}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {nonLues > 0 && (
                  <button onClick={toutMarquerLu} className="text-gray-500 hover:text-[#F5A623] transition-colors" title="Tout marquer lu">
                    <CheckCheck size={14} />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  <Bell size={24} className="mx-auto mb-2 opacity-30" />
                  Aucune notification
                </div>
              ) : notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-[#1a1a1a] hover:bg-[#151515] transition-colors ${!n.lu ? "bg-[#F5A623]/5" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 mt-0.5">
                      {(() => { const Icon = TYPE_ICON_MAP[n.type] || Bell; return <Icon size={16} />; })()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${!n.lu ? "text-white" : "text-gray-300"}`}>{n.titre}</p>
                      <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-gray-600 text-[10px] mt-1">
                        {new Date(n.createdAt).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                      </p>
                    </div>
                    {!n.lu && <div className="w-2 h-2 bg-[#F5A623] rounded-full flex-shrink-0 mt-1.5" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
