"use client";
// Cloche d'alertes : critiques et avertissements du contexte courant (chargés à l'ouverture
// + un comptage au montage).
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, AlertOctagon, AlertTriangle, Lightbulb, Rocket } from "lucide-react";

type Alerte = { id: string; categorie: "critique" | "alerte" | "opportunite" | "insight"; titre: string; detail: string; lien: string };
const ICONE = { critique: AlertOctagon, alerte: AlertTriangle, opportunite: Rocket, insight: Lightbulb };
const TON = { critique: "var(--cc-bad)", alerte: "var(--cc-warn)", opportunite: "var(--cc-good)", insight: "var(--cc-info)" };

export function Notifications({ contexte }: { contexte: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [alertes, setAlertes] = useState<Alerte[] | null>(null);

  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/admin/command-center/alertes${contexte}`, { signal: c.signal }).then((r) => (r.ok ? r.json() : { alertes: [] })).then((d) => setAlertes(d.alertes ?? [])).catch(() => {});
    return () => c.abort();
  }, [contexte]);

  const urgentes = alertes?.filter((a) => a.categorie === "critique" || a.categorie === "alerte").length ?? 0;
  return (
    <div className="relative">
      <button onClick={() => setOuvert(!ouvert)} className="cc-btn cc-btn-ghost cc-btn-sm relative" aria-label={`Alertes${urgentes ? ` : ${urgentes} à traiter` : ""}`} aria-expanded={ouvert}>
        <Bell size={15} />
        {urgentes > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: "var(--cc-bad)", color: "#fff" }}>{urgentes}</span>}
      </button>
      {ouvert && (
        <div className="absolute right-0 mt-2 w-[min(380px,92vw)] cc-card z-50 overflow-hidden" style={{ boxShadow: "var(--cc-shadow)" }}>
          <div className="px-3 py-2.5 border-b cc-sep flex items-center justify-between"><p className="text-[13px] font-semibold">Alertes</p><Link href={`/admin/alertes${contexte}`} onClick={() => setOuvert(false)} className="text-[12px]" style={{ color: "var(--cc-accent-text)" }}>Tout voir</Link></div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {!alertes && Array.from({ length: 3 }, (_, i) => <li key={i} className="p-3"><div className="cc-skel h-10" /></li>)}
            {alertes?.length === 0 && <li className="p-6 text-center text-[12.5px] cc-faint">Aucune alerte sur ce périmètre.</li>}
            {alertes?.slice(0, 12).map((a) => {
              const I = ICONE[a.categorie];
              return (
                <li key={a.id} className="border-b cc-sep last:border-0">
                  <Link href={a.lien + contexte} onClick={() => setOuvert(false)} className="flex gap-2.5 p-3 cc-hover">
                    <I size={15} style={{ color: TON[a.categorie] }} className="shrink-0 mt-0.5" aria-hidden />
                    <span className="min-w-0"><span className="block text-[12.5px] font-medium">{a.titre}</span><span className="block text-[11.5px] cc-faint">{a.detail}</span></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
