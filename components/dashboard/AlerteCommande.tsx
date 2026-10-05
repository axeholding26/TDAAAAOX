"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShoppingBag, MessageCircle, X } from "lucide-react";
import { useT } from "@/components/I18nProvider";

// Alerte « nouvelle commande » — distincte des autres notifications (qui
// passent par un toast + le carillon de NotificationSound) : son de commande
// (public/son-commande.mp3), carte bien visible et notification système si la page est en
// arrière-plan. Montée une fois pour tout le dashboard (DashboardShell).
const TYPES_COMMANDE = new Set(["nouvelle_commande", "commande_whatsapp"]);

interface Notif { id: string; type: string; titre: string; message: string; lien?: string | null; nomBoutique?: string }

// Une seule interrogation des notifications pour tout le dashboard : les
// cloches (Header, AxiaNotifBell) s'abonnent ici au lieu d'interroger le
// serveur chacune de leur côté.
type Donnees = { notifications: any[]; nonLues: number };
let derniere: Donnees | null = null;
const abonnes = new Set<(d: Donnees) => void>();
export function ecouterNotifications(cb: (d: Donnees) => void) {
  abonnes.add(cb);
  if (derniere) cb(derniere);
  return () => { abonnes.delete(cb); };
}

function sonCaisse() {
  new Audio("/son-commande.mp3").play().catch(() => { /* lecture bloquée ou audio indisponible */ });
}

export function AlerteCommande() {
  const tr = useT();
  const [alertes, setAlertes] = useState<Notif[]>([]);
  const vues = useRef<Set<string> | null>(null); // null : premier chargement (rien d'ancien n'alerte)

  useEffect(() => {
    let actif = true;
    const verifier = async () => {
      try {
        const res = await fetch("/api/notifications-marchand");
        if (!res.ok) return;
        const donnees = await res.json();
        const liste: (Notif & { lu: boolean })[] = donnees.notifications ?? [];
        if (!actif) return;
        derniere = { notifications: liste, nonLues: donnees.nonLues ?? 0 };
        abonnes.forEach((cb) => cb(derniere!));
        if (!vues.current) { vues.current = new Set(liste.map((n) => n.id)); return; }
        const nouvelles = liste.filter((n) => !vues.current!.has(n.id) && !n.lu && TYPES_COMMANDE.has(n.type));
        liste.forEach((n) => vues.current!.add(n.id));
        if (!nouvelles.length) return;
        sonCaisse();
        setAlertes((a) => [...nouvelles, ...a].slice(0, 3));
        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          for (const n of nouvelles) new Notification(`🛒 ${n.titre}`, { body: n.message, tag: n.id });
        }
      } catch { /* réseau : on réessaie au prochain tour */ }
    };
    verifier();
    const id = setInterval(verifier, 20_000);
    return () => { actif = false; clearInterval(id); };
  }, []);

  if (!alertes.length) return null;
  const fermer = (id: string) => setAlertes((a) => a.filter((n) => n.id !== id));

  return (
    <div className="fixed top-4 right-4 z-[10000] w-[340px] max-w-[calc(100vw-2rem)] space-y-3" aria-live="assertive">
      {alertes.map((n) => {
        const Icone = n.type === "commande_whatsapp" ? MessageCircle : ShoppingBag;
        return (
          <div key={n.id} role="alert" className="rounded-2xl p-4 shadow-2xl border-2 animate-in slide-in-from-right-8 fade-in"
            style={{ background: "#111111", borderColor: "#F5A623", color: "#FFFFFF", fontFamily: "'Poppins',system-ui,sans-serif" }}>
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#F5A623", color: "#111111" }}><Icone size={20} /></span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "#F5A623" }}>{tr("Nouvelle commande")}</p>
                <p className="text-[14px] font-semibold leading-snug mt-0.5">{tr(n.titre)}</p>
                <p className="text-[12.5px] text-white/70 leading-snug mt-0.5 line-clamp-2">{tr(n.message)}</p>
              </div>
              <button onClick={() => fermer(n.id)} aria-label={tr("Fermer")} className="text-white/50 hover:text-white flex-shrink-0"><X size={16} /></button>
            </div>
            <Link href={n.lien || "/dashboard/commandes"} onClick={() => fermer(n.id)}
              className="mt-3 w-full h-10 flex items-center justify-center rounded-xl text-[13.5px] font-bold" style={{ background: "#F5A623", color: "#111111" }}>
              {tr("Voir la commande")}
            </Link>
            {"Notification" in globalThis && Notification.permission === "default" && (
              <button onClick={() => Notification.requestPermission()} className="mt-2 w-full text-[12px] text-white/60 hover:text-white underline">
                {tr("Activer les alertes système (quand l’onglet est en arrière-plan)")}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
