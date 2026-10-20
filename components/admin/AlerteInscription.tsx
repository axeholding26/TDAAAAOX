"use client";

import { abonnePush, ouvrirReglagePush } from "@/components/ActivationPush";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserPlus, X, Volume2, VolumeX } from "lucide-react";
import { useT } from "@/components/I18nProvider";

// Alerte « nouvel inscrit » du Command Center : son fort, carte bien visible et
// notification système si l'onglet est en arrière-plan. Interroge
// /api/admin/command-center/inscriptions toutes les 20 s. Montée dans le layout admin.

interface Inscrit { id: string; nom: string | null; email: string | null; role: string; boutique: string | null; lien: string }

const CLE_MUET = "cc_inscription_muet";
let ctx: AudioContext | null = null;

// Le navigateur n'autorise le son qu'après un geste de l'utilisateur : le contexte audio
// est créé (débloqué) au premier clic ou appui sur la page.
function debloquerAudio() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!ctx && Ctx) ctx = new Ctx();
    ctx?.resume().catch(() => {});
  } catch { /* audio indisponible */ }
}

// Fanfare montante jouée deux fois, poussée au maximum via un compresseur (plus fort
// qu'un simple <audio>, dont le volume plafonne à 100 %).
function sonInscription() {
  if (!ctx) return;
  const compresseur = ctx.createDynamicsCompressor();
  compresseur.threshold.value = -10;
  compresseur.ratio.value = 12;
  const general = ctx.createGain();
  general.gain.value = 1.6;
  compresseur.connect(general);
  general.connect(ctx.destination);
  const notes = [784, 988, 1175, 1568];
  for (let tour = 0; tour < 2; tour++) {
    notes.forEach((freq, i) => {
      const t = ctx!.currentTime + tour * 0.9 + i * 0.13;
      for (const type of ["square", "triangle"] as OscillatorType[]) {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(type === "square" ? 0.35 : 0.6, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + (i === notes.length - 1 ? 0.6 : 0.25));
        osc.connect(gain);
        gain.connect(compresseur);
        osc.start(t);
        osc.stop(t + 0.65);
      }
    });
  }
}

function lireMuet() {
  try { return localStorage.getItem(CLE_MUET) === "1"; } catch { return false; }
}

export function AlerteInscription() {
  const t = useT();
  const [alertes, setAlertes] = useState<Inscrit[]>([]);
  const [muet, setMuet] = useState(false);
  const depuis = useRef<string | null>(null);
  const vus = useRef(new Set<string>());

  useEffect(() => {
    setMuet(lireMuet());
    window.addEventListener("pointerdown", debloquerAudio);
    window.addEventListener("keydown", debloquerAudio);
    return () => {
      window.removeEventListener("pointerdown", debloquerAudio);
      window.removeEventListener("keydown", debloquerAudio);
    };
  }, []);

  useEffect(() => {
    let actif = true;
    const verifier = async () => {
      try {
        const res = await fetch(`/api/admin/command-center/inscriptions${depuis.current ? `?depuis=${encodeURIComponent(depuis.current)}` : ""}`);
        if (!res.ok || !actif) return;
        const d = (await res.json()) as { a: string; inscrits: Inscrit[] };
        const premier = depuis.current === null;
        depuis.current = d.a;
        const nouveaux = d.inscrits.filter((u) => !vus.current.has(u.id));
        nouveaux.forEach((u) => vus.current.add(u.id));
        if (premier || !nouveaux.length) return;
        if (!lireMuet()) sonInscription();
        setAlertes((a) => [...nouveaux.reverse(), ...a].slice(0, 4));
        if (document.hidden && "Notification" in window && Notification.permission === "granted" && !(await abonnePush())) {
          for (const u of nouveaux) new Notification(`🎉 ${t(u.role === "livreur" ? "Nouveau livreur" : "Nouveau marchand")}`, { body: [u.nom, u.boutique, u.email].filter(Boolean).join(" · "), tag: u.id });
        }
      } catch { /* réseau : prochain tour */ }
    };
    verifier();
    const id = setInterval(verifier, 20_000);
    return () => { actif = false; clearInterval(id); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function basculerSon() {
    const v = !muet;
    setMuet(v);
    try { localStorage.setItem(CLE_MUET, v ? "1" : "0"); } catch { /* stockage indisponible */ }
    if (!v) { debloquerAudio(); sonInscription(); }
  }

  if (!alertes.length) return null;
  const fermer = (id: string) => setAlertes((a) => a.filter((u) => u.id !== id));

  return (
    <div className="fixed top-4 right-4 z-[10000] w-[340px] max-w-[calc(100vw-2rem)] space-y-3" aria-live="assertive">
      {alertes.map((u) => (
        <div key={u.id} role="alert" className="rounded-2xl p-4 shadow-2xl border-2 animate-in slide-in-from-right-8 fade-in"
          style={{ background: "#111111", borderColor: "#F5A623", color: "#FFFFFF" }}>
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#F5A623", color: "#111111" }}><UserPlus size={20} /></span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: "#F5A623" }}>{t(u.role === "livreur" ? "Nouveau livreur" : "Nouveau marchand")}</p>
              <p className="text-[14px] font-semibold leading-snug mt-0.5 [overflow-wrap:anywhere]">{u.nom || u.email}</p>
              <p className="text-[12.5px] text-white/70 leading-snug mt-0.5 [overflow-wrap:anywhere]">{[u.boutique, u.email].filter(Boolean).join(" · ")}</p>
            </div>
            <button onClick={basculerSon} aria-label={muet ? t("Activer le son") : t("Couper le son")} title={muet ? t("Activer le son") : t("Couper le son")} className="text-white/50 hover:text-white flex-shrink-0">
              {muet ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button onClick={() => fermer(u.id)} aria-label={t("Fermer")} className="text-white/50 hover:text-white flex-shrink-0"><X size={16} /></button>
          </div>
          <Link href={u.lien} onClick={() => fermer(u.id)}
            className="mt-3 w-full h-10 flex items-center justify-center rounded-xl text-[13.5px] font-bold" style={{ background: "#F5A623", color: "#111111" }}>
            {t("Voir la fiche")}
          </Link>
          {"Notification" in globalThis && Notification.permission === "default" && (
            <button onClick={ouvrirReglagePush} className="mt-2 w-full text-[12px] text-white/60 hover:text-white underline">
              {t("Activer les notifications sur cet appareil (même appli fermée)")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
