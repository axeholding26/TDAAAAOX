"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShoppingBag, MessageCircle, X } from "lucide-react";
import { useT } from "@/components/I18nProvider";

// Alerte « nouvelle commande » — distincte des autres notifications (qui
// passent par un toast + le carillon de NotificationSound) : son de caisse
// propre, carte bien visible et notification système si la page est en
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
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const sortie = ctx.createDynamicsCompressor();
    sortie.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.02;
    const note = (f: number, t: number, vol: number, duree: number, type: OscillatorType = "sine") => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.value = f;
      osc.connect(gain); gain.connect(sortie);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
      osc.start(t); osc.stop(t + duree + 0.05);
    };
    // « Ka » : tiroir-caisse qui claque (bruit filtré + choc sourd).
    const bruit = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    bruit.getChannelData(0).forEach((_, i, d) => { d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3; });
    const src = ctx.createBufferSource(), filtre = ctx.createBiquadFilter(), gBruit = ctx.createGain();
    src.buffer = bruit; filtre.type = "bandpass"; filtre.frequency.value = 2200; filtre.Q.value = 1.2; gBruit.gain.value = 0.9;
    src.connect(filtre); filtre.connect(gBruit); gBruit.connect(sortie); src.start(t0);
    note(140, t0, 0.5, 0.09, "triangle");
    // « Ching » : cloche de caisse — partiels inharmoniques d'une cloche, doublée et légèrement désaccordée pour le scintillement.
    const tc = t0 + 0.11;
    [[1, 0.32], [2.76, 0.18], [5.4, 0.09], [8.93, 0.05]].forEach(([r, v]) => {
      note(1568 * r, tc, v, 1.6 / Math.sqrt(r));
      note(1574 * r, tc, v * 0.6, 1.4 / Math.sqrt(r));
    });
    // Pluie de pièces qui tombent dans le tiroir (motif fixe : même signature à chaque commande).
    [[0.32, 4186], [0.38, 5274], [0.43, 3951], [0.47, 4699], [0.52, 5588], [0.55, 4435], [0.61, 5920], [0.66, 4978], [0.74, 5274]].forEach(([dt, f], i) => {
      const v = 0.14 * (1 - i / 12);
      note(f, tc + dt, v, 0.14);
      note(f * 1.51, tc + dt, v * 0.4, 0.08);
    });
    setTimeout(() => ctx.close().catch(() => {}), 2500);
  } catch { /* audio indisponible */ }
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
