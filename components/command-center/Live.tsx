"use client";
// Mode LIVE : compteurs de la dernière heure, interrogés toutes les 15 s tant que le
// panneau est ouvert. Distingué visuellement des données historiques (pastille verte,
// horodatage de chaque actualisation).
import { useEffect, useState } from "react";
import { Radio, X } from "lucide-react";
import type { Source } from "@/lib/command-center/types";
import { useT } from "@/components/I18nProvider";

interface DonneesLive { a: number; simule: boolean; fenetreMin: number; compteurs: { cle: string; nom: string; valeur: number }[] }

export function Live({ source }: { source: Source }) {
  const t = useT();
  const [ouvert, setOuvert] = useState(false);
  const [d, setD] = useState<DonneesLive | null>(null);
  const [erreur, setErreur] = useState(false);
  const [, tic] = useState(0);

  useEffect(() => {
    if (!ouvert) return;
    let vivant = true;
    const charger = () => fetch(`/api/admin/command-center/live?source=${source}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((x) => { if (vivant) { setD(x); setErreur(false); } }).catch(() => vivant && setErreur(true));
    charger();
    const i = setInterval(charger, 15_000), s = setInterval(() => tic((n) => n + 1), 1000);
    return () => { vivant = false; clearInterval(i); clearInterval(s); };
  }, [ouvert, source]);

  const age = d ? Math.round((Date.now() - d.a) / 1000) : null;
  return (
    <div className="relative">
      <button onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} className="cc-btn cc-btn-sm" style={ouvert ? { borderColor: "var(--cc-good)", color: "var(--cc-good)" } : undefined}>
        {ouvert ? <span className="cc-live-dot" aria-hidden /> : <Radio size={13} aria-hidden />}<span className="font-semibold tracking-wide text-[11px] hidden sm:inline">LIVE</span>
      </button>
      {ouvert && (
        <div className="absolute right-0 mt-2 w-[min(340px,92vw)] cc-card p-3 z-50" style={{ boxShadow: "var(--cc-shadow)" }} role="region" aria-label={t("Activité en direct")}>
          <div className="flex items-center gap-2 mb-2">
            <span className="cc-live-dot" aria-hidden />
            <p className="text-[13px] font-semibold">{t("En direct")}</p>
            <span className="cc-badge cc-badge-good">{t("temps réel")}</span>
            <button onClick={() => setOuvert(false)} className="ml-auto cc-btn cc-btn-ghost cc-btn-sm" aria-label={t("Fermer")}><X size={13} /></button>
          </div>
          {d?.simule && <p className="text-[11.5px] mb-2 px-2 py-1 rounded" style={{ background: "var(--cc-violet-bg)", color: "var(--cc-violet)" }}>{t("Démo : activité simulée.")}</p>}
          {!d && !erreur && <div className="grid grid-cols-2 gap-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="cc-skel h-14" />)}</div>}
          {erreur && !d && <p className="text-[12.5px] cc-bad">{t("Flux indisponible. Nouvelle tentative dans 15 s.")}</p>}
          {d && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {d.compteurs.map((c) => (
                  <div key={c.cle} className="rounded-lg border cc-sep px-2.5 py-2">
                    <p className="text-[11px] cc-faint">{t(c.nom)}</p>
                    <p className="text-[18px] font-semibold cc-num">{c.valeur.toLocaleString(t.loc)}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] cc-faint mt-2">{t("{0} dernières minutes · actualisé il y a {1} s", d.fenetreMin, age)}{erreur ? " · " + t("dernière actualisation échouée") : ""}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
