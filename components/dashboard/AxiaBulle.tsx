"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X, Volume2, VolumeX, MessageCircle, Check, Loader2, Send } from "lucide-react";
import { IconAxia } from "@/components/dashboard/AppIcons";
import { useT } from "@/components/I18nProvider";
import { useAbonnementOverlay } from "@/components/dashboard/AbonnementOverlayProvider";
import { palierAuMoins } from "@/lib/plans";
import { pageAOuvrir, ouvrirPage } from "@/lib/axia/pages";

// Bulle AXIA en bas à droite du dashboard : AXIA y prend la parole d'elle-même
// (constats sur la boutique, rappels) et y demande l'accord du marchand avant
// toute action sensible. Données : app/api/axia/propositions.
// Sa fenêtre sert aussi à discuter avec AXIA sans quitter la page (« Assister ») :
// sur mobile, le bouton rond est masqué et la fenêtre s'ouvre depuis le bouton
// central de la barre du bas (MobileBottomNav, évènement « axia:assister »).

type Action = { prompt?: string; lien?: string; libelle?: string; confirmation?: boolean } | null;
interface Proposition { id: string; type: string; message: string; action: Action; statut: string }

const ACCENT = "#F5A623";
export const MESSAGE_PRO = "AXIA, ton associée qui surveille ta boutique et te propose des actions, est disponible à partir du Palier Pro.";
const CLE_MUET = "axia_muet";

// Son propre à AXIA (trois notes montantes, douces), distinct du carillon
// des notifications et du son de commande.
function sonAxia() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [1047, 1319, 1568].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch { /* audio indisponible ou bloqué avant toute interaction */ }
}

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
  const { palier, openAbonnement } = useAbonnementOverlay();
  // Palier Essentiel : AXIA est réservé au Pro — la bulle ne fait qu'inviter à passer au Pro.
  const pro = palierAuMoins(palier, "palier1");
  const [liste, setListe] = useState<Proposition[]>([]);
  const [bulle, setBulle] = useState<Proposition | null>(null); // prise de parole affichée
  const [panneau, setPanneau] = useState(false);
  const [muet, setMuet] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [retour, setRetour] = useState<{ succes: boolean; texte: string } | null>(null);
  const annonces = useRef(new Set<string>());
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [saisie, setSaisie] = useState("");
  const [reflechit, setReflechit] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  // Le Constructeur a sa propre bulle AXIA au même endroit : ici, seules les demandes
  // d'accord s'affichent (au-dessus d'elle) ; les constats attendent la sortie du Constructeur.
  const surConstructeur = !!pathname?.startsWith("/dashboard/builder");
  const constructeurRef = useRef(surConstructeur);
  useEffect(() => { constructeurRef.current = surConstructeur; }, [surConstructeur]);

  useEffect(() => { setMuet(lireMuet()); }, []);

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/axia/propositions");
      if (!res.ok) return;
      const { propositions } = (await res.json()) as { propositions: Proposition[] };
      setListe(propositions);
      const nouvelle = propositions.find((p) => p.statut === "nouveau" && !annonces.current.has(p.id)
        && (!constructeurRef.current || p.type === "confirmation"));
      if (!nouvelle) return;
      propositions.forEach((p) => { if (!constructeurRef.current || p.type === "confirmation") annonces.current.add(p.id); });
      setRetour(null);
      setBulle(nouvelle);
      if (!lireMuet()) sonAxia();
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

  // Compteur pour le bouton AXIA de la barre du bas (mobile).
  useEffect(() => { window.dispatchEvent(new CustomEvent("axia:compte", { detail: liste.length })); }, [liste]);

  useEffect(() => {
    const assister = () => {
      if (!pro) return openAbonnement("palier1", MESSAGE_PRO);
      setPanneau(true);
      setBulle(null);
    };
    window.addEventListener("axia:assister", assister);
    return () => window.removeEventListener("axia:assister", assister);
  }, [pro, openAbonnement]);

  useEffect(() => { finRef.current?.scrollIntoView({ block: "end" }); }, [messages, reflechit, panneau]);

  async function envoyer() {
    const contenu = saisie.trim();
    if (!contenu || reflechit) return;
    const historique = [...messages, { role: "user" as const, content: contenu }];
    setMessages(historique);
    setSaisie("");
    setReflechit(true);
    try {
      const envoyes = historique.map((m, i) => i === historique.length - 1
        ? { ...m, content: `[Contexte : le marchand est sur la page ${pathname} du dashboard et te parle depuis la fenêtre AXIA, sans la quitter.] ${m.content}` }
        : m);
      const res = await fetch("/api/ai/axia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: envoyes, stream: false, fast: false }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reponse || t("Je n'ai pas pu traiter cette demande.") }]);
      // AXIA a pu agir (produit, promo…) : la page et les propositions se mettent à jour.
      router.refresh();
      charger();
      // ouvrir_page : AXIA amène le marchand sur la page demandée, la fenêtre reste ouverte.
      const lien = pageAOuvrir(data.actions);
      if (lien) ouvrirPage(lien, router.push);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: t("AXIA a rencontré une erreur momentanée — réessaie dans un instant.") }]);
    } finally {
      setReflechit(false);
    }
  }

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
    // tel:, wa.me… : hors de l'application, le routeur ne sait pas les ouvrir
    else if (p.action?.lien) p.action.lien.startsWith("/") ? router.push(p.action.lien) : window.open(p.action.lien, "_blank", "noopener");
  }

  function refuser(p: Proposition) {
    retirer(p.id);
    decider(p.id, "refuser").catch(() => {});
  }

  function basculerSon() {
    const v = !muet;
    setMuet(v);
    try { localStorage.setItem(CLE_MUET, v ? "1" : "0"); } catch { /* stockage indisponible */ }
    if (!v) sonAxia();
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

  if (surConstructeur) {
    if (!(retour || bulle?.action?.confirmation)) return null;
    return (
      <div className="fixed right-5 bottom-24 z-[60] w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-2xl border border-[#F0F0F0] p-2" role="status" aria-live="polite">
        <button onClick={() => { setBulle(null); setRetour(null); }} className="absolute top-2 right-2 p-1 rounded-md text-[#AAA] hover:bg-black/5 z-10" aria-label={t("Fermer")}><X size={12} /></button>
        {retour
          ? <p className={`text-[13px] p-2 pr-6 ${retour.succes ? "text-green-600" : "text-red-600"}`}>{retour.texte}</p>
          : bulle && carte(bulle)}
      </div>
    );
  }

  return (
    <div className="fixed right-4 md:right-6 bottom-[calc(env(safe-area-inset-bottom)+8.5rem)] md:bottom-6 z-[60] flex flex-col items-end gap-3">
      {panneau ? (
        <div className="w-[360px] max-w-[calc(100vw-2rem)] h-[480px] max-h-[calc(100dvh-11rem)] md:max-h-[70vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-[#F0F0F0] overflow-hidden">
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
            {liste.map(carte)}
            {!liste.length && !messages.length && <p className="text-[12px] text-[#888] px-1 py-2">{t("Rien à signaler pour le moment. Pose-moi une question ou demande-moi d'agir, sans quitter cette page.")}</p>}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] ${m.role === "user" ? "bg-[#111] text-white rounded-br-md" : "bg-[#F4F4F5] text-[#111] rounded-bl-md"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {reflechit && (
              <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#666]"><Loader2 size={13} className="animate-spin" style={{ color: ACCENT }} />{t("AXIA réfléchit…")}</div>
            )}
            <div ref={finRef} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); envoyer(); }} className="flex items-center gap-2 p-2.5 border-t border-[#F0F0F0]">
            <input value={saisie} onChange={(e) => setSaisie(e.target.value)} disabled={reflechit}
              placeholder={t("Demande n'importe quoi à AXIA…")} aria-label={t("Message pour AXIA")}
              className="flex-1 min-w-0 h-10 px-3 text-base md:text-[13px] rounded-xl border border-[#E0E0E0] outline-none focus:border-[#F5A623] disabled:opacity-50" />
            <button type="submit" disabled={reflechit || !saisie.trim()} aria-label={t("Envoyer")}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-white disabled:opacity-40" style={{ background: ACCENT }}>
              <Send size={15} />
            </button>
          </form>
          {pathname !== "/dashboard" && (
            <button onClick={() => { setPanneau(false); if (pro) router.push("/dashboard"); else openAbonnement("palier1", MESSAGE_PRO); }}
              className="flex items-center justify-center gap-2 px-4 py-3 text-[12px] font-semibold border-t border-[#F0F0F0] hover:bg-black/[.03] text-[#111]">
              <MessageCircle size={13} /> {t("Ouvrir en plein écran")}
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

      <button onClick={() => { if (!pro) return openAbonnement("palier1", MESSAGE_PRO); setPanneau((v) => !v); setBulle(null); }}
        className="relative w-14 h-14 rounded-full shadow-lg hidden md:flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
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
