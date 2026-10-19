"use client";
// Cloche d'alertes : critiques et avertissements du contexte courant (chargés au montage,
// rechargés à chaque ouverture). Les alertes restent tant que leur cause dure ; la pastille ne
// compte que celles pas encore vues (vues = cloche ouverte, mémorisé dans ce navigateur).
// Une alerte dont le chiffre change (titre différent) redevient nouvelle.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, AlertOctagon, AlertTriangle, Lightbulb, Rocket } from "lucide-react";
import { avecQs } from "@/lib/command-center/contexte";
import { useT } from "@/components/I18nProvider";

type Alerte = { id: string; categorie: "critique" | "alerte" | "opportunite" | "insight"; titre: string; detail: string; lien: string };
const ICONE = { critique: AlertOctagon, alerte: AlertTriangle, opportunite: Rocket, insight: Lightbulb };
const TON = { critique: "var(--cc-bad)", alerte: "var(--cc-warn)", opportunite: "var(--cc-good)", insight: "var(--cc-info)" };

const CLE_VUES = "cc_alertes_vues";
const cleVue = (a: Alerte) => `${a.id}|${a.titre}`;
function lireVues(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(CLE_VUES) || "[]")); } catch { return new Set(); }
}

export function Notifications({ contexte }: { contexte: string }) {
  const t = useT();
  const [ouvert, setOuvert] = useState(false);
  const [alertes, setAlertes] = useState<Alerte[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [vues, setVues] = useState<Set<string>>(new Set());
  const boite = useRef<HTMLDivElement>(null);
  const chargePour = useRef<string | null>(null);
  useEffect(() => { setVues(lireVues()); }, []);

  // Rechargé au changement de filtres et à chaque ouverture (les alertes évoluent pendant la session).
  useEffect(() => {
    if (!ouvert && chargePour.current === contexte) return;
    const c = new AbortController();
    fetch(`/api/admin/command-center/alertes${contexte}`, { signal: c.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { chargePour.current = contexte; setAlertes(d.alertes ?? []); setErreur(false); })
      .catch(() => { if (!c.signal.aborted) setErreur(true); });
    return () => c.abort();
  }, [contexte, ouvert]);

  // Cloche ouverte = tout vu : on ne garde que les clés des alertes encore actives.
  useEffect(() => {
    if (!ouvert || !alertes?.length) return;
    const v = new Set(alertes.map(cleVue));
    setVues(v);
    try { localStorage.setItem(CLE_VUES, JSON.stringify([...v])); } catch { /* stockage indisponible */ }
  }, [ouvert, alertes]);

  // Fermeture au clic hors de la cloche ou avec Échap.
  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: PointerEvent) => { if (!boite.current?.contains(e.target as Node)) setOuvert(false); };
    const touche = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    document.addEventListener("pointerdown", clic);
    document.addEventListener("keydown", touche);
    return () => { document.removeEventListener("pointerdown", clic); document.removeEventListener("keydown", touche); };
  }, [ouvert]);

  const urgentes = alertes?.filter((a) => (a.categorie === "critique" || a.categorie === "alerte") && !vues.has(cleVue(a))).length ?? 0;

  return (
    <div className="relative" ref={boite}>
      <button onClick={() => setOuvert(!ouvert)} className="cc-btn cc-btn-ghost cc-btn-sm relative" aria-label={urgentes ? t("Alertes : {0} à traiter", urgentes) : t("Alertes")} aria-expanded={ouvert}>
        <Bell size={15} />
        {urgentes > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ background: "var(--cc-bad)", color: "#fff" }}>{urgentes}</span>}
      </button>
      {ouvert && (
        <div className="fixed left-2 right-2 top-14 sm:absolute sm:left-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[380px] cc-card z-50 overflow-hidden" style={{ boxShadow: "var(--cc-shadow)" }}>
          <div className="px-3 py-2.5 border-b cc-sep flex items-center justify-between"><p className="text-[13px] font-semibold">{t("Alertes")}</p><Link href={`/admin/alertes${contexte}`} onClick={() => setOuvert(false)} className="text-[12px]" style={{ color: "var(--cc-accent-text)" }}>{t("Tout voir")}</Link></div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {erreur && !alertes && <li className="p-6 text-center text-[12.5px] cc-bad">{t("Impossible de charger les alertes.")}</li>}
            {!alertes && !erreur && Array.from({ length: 3 }, (_, i) => <li key={i} className="p-3"><div className="cc-skel h-10" /></li>)}
            {alertes?.length === 0 && <li className="p-6 text-center text-[12.5px] cc-faint">{t("Aucune alerte sur ce périmètre.")}</li>}
            {alertes?.slice(0, 12).map((a) => {
              const I = ICONE[a.categorie];
              return (
                <li key={a.id} className="border-b cc-sep last:border-0">
                  <Link href={avecQs(a.lien, contexte)} onClick={() => setOuvert(false)} className="flex gap-2.5 p-3 cc-hover">
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
