"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X, Volume2, VolumeX, MessageCircle, Check, Loader2 } from "lucide-react";
import { IconAxia } from "@/components/dashboard/AppIcons";
import { useT } from "@/components/I18nProvider";
import { jouerSonNotification } from "@/components/ui/NotificationSound";

// Bulle AXIA en bas à droite du dashboard : AXIA y prend la parole d'elle-même
// (constats sur la boutique, rappels) et y demande l'accord du marchand avant
// toute action sensible. Données : app/api/axia/propositions.

type Action = { prompt?: string; lien?: string; libelle?: string; confirmation?: boolean } | null;
interface Proposition { id: string; type: string; message: string; action: Action; statut: string }

const ACCENT = "#F5A623";
const CLE_MUET = "axia_muet";

function lireMuet() {
  try { return localStorage.getItem(CLE_MUET) === "1"; } catch { return false; }
}

async function decider(id: string, decision: "vu" | "accepter" | "refuser") {
  const res = await fetch("/api/axia/propositions", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, decision }),
  });
  return res.ok ? res.json() : null;
}

export function AxiaBulle() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [liste, setListe] = useState<Proposition[]>([]);
  const [bulle, setBulle] = useState<Proposition | null>(null); // prise de parole affichée
  const [panneau, setPanneau] = useState(false);
  const [muet, setMuet] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [retour, setRetour] = useState<{ succes: boolean; texte: string } | null>(null);
  const annonces = useRef(new Set<string>());

  useEffect(() => { setMuet(lireMuet()); }, []);

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/axia/propositions");
      if (!res.ok) return;
      const { propositions } = (await res.json()) as { propositions: Proposition[] };
      setListe(propositions);
      const nouvelle = propositions.find((p) => p.statut === "nouveau" && !annonces.current.has(p.id));
      if (!nouvelle) return;
      propositions.forEach((p) => annonces.current.add(p.id));
      setRetour(null);
      setBulle(nouvelle);
      if (!lireMuet()) jouerSonNotification();
      decider(nouvelle.id, "vu").catch(() => {});
    } catch { /* réseau : prochain tour */ }
  }, []);

  useEffect(() => {
    charger();
    const id = setInterval(charger, 60_000);
    const rafraichir = () => charger();
    const auRetour = () => { if (!document.hidden) charger(); };
    window.addEventListener("axia:rafraichir", rafraichir);
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      clearInterval(id);
      window.removeEventListener("axia:rafraichir", rafraichir);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [charger]);

  function retirer(id: string) {
    setListe((l) => l.filter((p) => p.id !== id));
    setBulle((b) => (b?.id === id ? null : b));
  }

  function demanderAxia(prompt: string) {
    if (pathname === "/dashboard") window.dispatchEvent(new CustomEvent("axia:demander", { detail: prompt }));
    else router.push(`/dashboard?axia=${encodeURIComponent(prompt)}`);
  }

  async function accepter(p: Proposition) {
    setEnCours(p.id);
    const r = await decider(p.id, "accepter").catch(() => null);
    setEnCours(null);
    if (p.action?.confirmation) {
      const succes = !!r?.succes;
      setRetour({ succes, texte: succes ? t("C'est fait.") : r?.resultat || t("L'action n'a pas pu être faite.") });
      setListe((l) => l.filter((x) => x.id !== p.id));
      return;
    }
    retirer(p.id);
    setPanneau(false);
    if (p.action?.prompt) demanderAxia(p.action.prompt);
    else if (p.action?.lien) router.push(p.action.lien);
  }

  function refuser(p: Proposition) {
    retirer(p.id);
    decider(p.id, "refuser").catch(() => {});
  }

  function basculerSon() {
    const v = !muet;
    setMuet(v);
    try { localStorage.setItem(CLE_MUET, v ? "1" : "0"); } catch { /* stockage indisponible */ }
    if (!v) jouerSonNotification();
  }

  const carte = (p: Proposition) => {
    const confirmation = !!p.action?.confirmation;
    const occupe = enCours === p.id;
    const oui = confirmation ? t("Autoriser") : p.action?.prompt ? t("Oui, vas-y") : p.action?.lien ? t(p.action.libelle || "Voir") : null;
    return (
      <div key={p.id} className="rounded-xl p-3" style={{ background: confirmation ? "#FFF8EB" : "#F7F7F7", border: confirmation ? `1px solid ${ACCENT}55` : "1px solid transparent" }}>
        {confirmation && <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "#B7791F" }}>{t("Ton accord est nécessaire")}</p>}
        <p className="text-[13px] leading-snug text-[#111]">{p.message}</p>
        <div className="flex gap-2 mt-2.5">
          {oui && (
            <button onClick={() => accepter(p)} disabled={occupe}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-60" style={{ background: ACCENT }}>
              {occupe ? <Loader2 size={12} className="animate-spin" /> : confirmation && <Check size={12} />}{oui}
            </button>
          )}
          <button onClick={() => (oui && !confirmation ? (setBulle(null), setPanneau(false)) : refuser(p))} disabled={occupe}
            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#666] hover:bg-black/5">
            {confirmation ? t("Refuser") : oui ? t("Plus tard") : t("Merci")}
          </button>
          {oui && !confirmation && (
            <button onClick={() => refuser(p)} className="ml-auto p-1.5 rounded-lg text-[#AAA] hover:bg-black/5" aria-label={t("Ignorer")} title={t("Ignorer")}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed right-4 md:right-6 bottom-24 md:bottom-6 z-[60] flex flex-col items-end gap-3">
      {panneau ? (
        <div className="w-[340px] max-w-[calc(100vw-2rem)] max-h-[60vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-[#F0F0F0] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0F0F0]">
            <p className="text-[13px] font-bold text-[#111]">AXIA</p>
            <div className="flex items-center gap-1">
              <button onClick={basculerSon} className="p-1.5 rounded-lg text-[#888] hover:bg-black/5" aria-label={muet ? t("Activer le son") : t("Couper le son")} title={muet ? t("Activer le son") : t("Couper le son")}>
                {muet ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <button onClick={() => setPanneau(false)} className="p-1.5 rounded-lg text-[#888] hover:bg-black/5" aria-label={t("Fermer")}><X size={14} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {retour && <p className={`text-[12px] px-1 ${retour.succes ? "text-green-600" : "text-red-600"}`}>{retour.texte}</p>}
            {liste.length ? liste.map(carte) : <p className="text-[12px] text-[#888] px-1 py-2">{t("Rien à signaler pour le moment. Je te préviens dès que je vois quelque chose.")}</p>}
          </div>
          {pathname !== "/dashboard" && (
            <button onClick={() => { setPanneau(false); router.push("/dashboard"); }}
              className="flex items-center justify-center gap-2 px-4 py-3 text-[12px] font-semibold border-t border-[#F0F0F0] hover:bg-black/[.03] text-[#111]">
              <MessageCircle size={13} /> {t("Parler à AXIA")}
            </button>
          )}
        </div>
      ) : (bulle || retour) && (
        <div className="w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-2xl border border-[#F0F0F0] p-2 relative" role="status" aria-live="polite"
          style={{ animation: "axiaBulle .25s ease-out" }}>
          <button onClick={() => { setBulle(null); setRetour(null); }} className="absolute top-2 right-2 p-1 rounded-md text-[#AAA] hover:bg-black/5 z-10" aria-label={t("Fermer")}><X size={12} /></button>
          {retour
            ? <p className={`text-[13px] p-2 pr-6 ${retour.succes ? "text-green-600" : "text-red-600"}`}>{retour.texte}</p>
            : bulle && carte(bulle)}
        </div>
      )}

      <button onClick={() => { setPanneau((v) => !v); setBulle(null); }}
        className="relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ background: ACCENT }} aria-label={t("Ouvrir AXIA")}>
        <IconAxia size={48} />
        {liste.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">{liste.length}</span>
        )}
      </button>

      <style>{`@keyframes axiaBulle { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
