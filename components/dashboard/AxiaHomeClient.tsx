"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Send, Loader2, Mic, MicOff, LayoutDashboard, History, Sparkles, PanelLeft, Plus,
  Volume2, VolumeX, Phone, Paperclip, X, Copy, Check, RotateCcw, Square, Image as ImageIcon, Video,
  MessageSquare, Bell,
} from "lucide-react";
import { renderMarkdown, parseContent } from "@/lib/axia-format";
import { useAxiaConversations } from "@/hooks/useAxiaConversations";
import { AxiaConversationSidebar } from "@/components/dashboard/AxiaConversationSidebar";
import { AxiaNotifBell } from "@/components/dashboard/AxiaNotifBell";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

const AXIA_TUTORIAL_STEPS = [
  { Icon: MessageSquare, titre: "Discute avec AXIA", description: "Pose n'importe quelle question sur ta boutique — ventes, stock, clients — ou demande-lui d'agir directement : créer un produit, lancer une promo, relancer un client." },
  { Icon: Mic,           titre: "Mode vocal",         description: "Touche l'icône téléphone pour parler à AXIA à voix haute — elle t'écoute, réfléchit et te répond, comme un vrai appel." },
  { Icon: History,       titre: "Historique & Journal", description: "Toutes tes conversations sont sauvegardées (icône panneau à gauche). Le Journal liste chaque action qu'AXIA a effectuée pour toi, en toute transparence." },
  { Icon: Bell,          titre: "Notifications",      description: "La cloche en haut t'alerte en temps réel dès qu'une nouvelle commande ou un événement important arrive, même depuis cet écran." },
];

interface Msg {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  imageUrl?: string;
  images?: string[];
  videos?: string[];
  audios?: string[];
  actions?: string[];
}

type VoicePhase = "idle" | "listening" | "thinking" | "speaking";

const SUGGESTIONS = [
  "Fais un rapport complet de mes ventes",
  "Quels produits risquent d'être en rupture ?",
  "Génère un post Instagram pour mes produits",
  "Quels clients relancer aujourd'hui ?",
  "Crée un code promo flash de 20% pendant 24h",
  "Résume l'activité d'aujourd'hui",
];

const THINKING_MSGS = [
  "AXIA réfléchit…",
  "AXIA analyse les données…",
  "AXIA vérifie ta boutique…",
  "AXIA prépare sa réponse…",
  "AXIA compare les options…",
  "AXIA consulte le catalogue…",
];

const THINKING_VOICE_FILLERS = [
  "Laisse-moi vérifier ça.",
  "Un instant, je regarde tes données.",
  "Je consulte ta boutique.",
  "Je jette un œil à ça tout de suite.",
];

const WAVE_HEIGHTS = Array.from({ length: 20 }, () => 8 + Math.floor(Math.random() * 28));

const PHASE_CONFIG: Record<VoicePhase, { orbGrad: string; orbShadow: string; ringColor: string }> = {
  idle:      { orbGrad: "radial-gradient(circle at 35% 35%, #333333, #111111)", orbShadow: "0 0 40px rgba(17,17,17,0.5), inset 0 1px 1px rgba(255,255,255,0.12)", ringColor: "#666666" },
  listening: { orbGrad: "radial-gradient(circle at 35% 35%, #444444, #111111)", orbShadow: "0 0 90px rgba(17,17,17,0.75), 0 0 180px rgba(17,17,17,0.35), inset 0 1px 1px rgba(255,255,255,0.2)", ringColor: "#F5A623" },
  thinking:  { orbGrad: "radial-gradient(circle at 35% 35%, #F5A623, #D4911A)", orbShadow: "0 0 60px rgba(245,166,35,0.45)", ringColor: "#F5A623" },
  speaking:  { orbGrad: "radial-gradient(circle at 35% 35%, #10b981, #059669)", orbShadow: "0 0 90px rgba(16,185,129,0.55)", ringColor: "#10b981" },
};

// Écran d'accueil du dashboard — AXIA est le point d'entrée principal et
// UNIQUE (plus de bulle flottante redondante ailleurs dans le dashboard) :
// conversation texte + voix, pièces jointes, historique multi-fils.
// Le contrôle d'accès Pro (palier0 → redirection) vit désormais en amont,
// côté serveur, dans app/(dashboard)/dashboard/page.tsx — ce composant n'est
// jamais monté pour un compte palier0.
export function AxiaHomeClient() {
  const [nomBoutique, setNomBoutique] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("idle");
  const [ttsOn, setTtsOn] = useState(true);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [interimText, setInterimText] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [thinkingMsgIdx, setThinkingMsgIdx] = useState(0);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const voiceScrollRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const fileRef        = useRef<HTMLInputElement>(null);
  const recognRef      = useRef<any>(null);
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const bestVoiceRef   = useRef<SpeechSynthesisVoice | null>(null);
  const premiumTtsFailedRef = useRef(false);
  const abortRef       = useRef<AbortController | null>(null);
  const sendRef        = useRef<(text: string) => void>(() => {});
  const voiceModeRef   = useRef(voiceMode);
  const ttsRef         = useRef(ttsOn);
  const loadingRef     = useRef(loading);
  const messagesRef    = useRef(messages);
  const activeIdRef    = useRef<string | null>(null);

  const {
    conversations, activeId, loadingList,
    creerConversation, chargerConversation, sauvegarder, renommer, supprimer, setActiveId,
  } = useAxiaConversations();

  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { ttsRef.current = ttsOn; }, [ttsOn]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => {
    if (!loading) { setThinkingMsgIdx(0); return; }
    const id = setInterval(() => setThinkingMsgIdx(i => (i + 1) % THINKING_MSGS.length), 2200);
    return () => clearInterval(id);
  }, [loading]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { voiceScrollRef.current?.scrollTo({ top: 9999, behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    fetch("/api/tenants/moi").then(r => r.json()).then(d => setNomBoutique(d?.nomBoutique ?? null)).catch(() => {});
  }, []);

  // Sélectionne la meilleure voix française du navigateur (fallback si le TTS premium est indisponible)
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const pickBestVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const fr = voices.filter(v => v.lang?.toLowerCase().startsWith("fr"));
      if (!fr.length) return;
      const scored = fr.map(v => {
        let score = 0;
        if (/google/i.test(v.name)) score += 3;
        if (/natural|neural|enhanced|premium/i.test(v.name)) score += 3;
        if (/fr-FR/i.test(v.lang)) score += 1;
        if (v.localService === false) score += 1;
        return { v, score };
      }).sort((a, b) => b.score - a.score);
      bestVoiceRef.current = scored[0]?.v ?? fr[0];
    };
    pickBestVoice();
    window.speechSynthesis.onvoiceschanged = pickBestVoice;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // Persistance serveur — débouncée dans le hook
  useEffect(() => { if (activeId) sauvegarder(activeId, messages); }, [messages, activeId, sauvegarder]);

  // ── TTS ─────────────────────────────────────────────────────────────────────
  const speakBrowserFallback = useCallback((cleanText: string, onDone?: () => void) => {
    if (typeof window === "undefined" || !window.speechSynthesis) { onDone?.(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(cleanText.slice(0, 600));
    utt.lang = "fr-FR"; utt.rate = 1.08; utt.pitch = 1.03;
    if (bestVoiceRef.current) utt.voice = bestVoiceRef.current;
    utt.onend = () => onDone?.();
    utt.onerror = () => onDone?.();
    window.speechSynthesis.speak(utt);
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (typeof window === "undefined") return;
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    if (!ttsRef.current) { onDone?.(); return; }
    const cleanText = text.replace(/[*_`#>\-]/g, "").trim();
    if (!cleanText) { onDone?.(); return; }
    if (premiumTtsFailedRef.current) { speakBrowserFallback(cleanText, onDone); return; }
    (async () => {
      try {
        const res = await fetch("/api/ai/axia/voix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texte: cleanText }),
        });
        if (!res.ok) throw new Error(`tts ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); onDone?.(); };
        audio.onerror = () => { URL.revokeObjectURL(url); speakBrowserFallback(cleanText, onDone); };
        await audio.play();
      } catch {
        premiumTtsFailedRef.current = true;
        speakBrowserFallback(cleanText, onDone);
      }
    })();
  }, [speakBrowserFallback]);

  const speakThenListen = useCallback((text: string) => {
    setVoicePhase("speaking");
    speak(text, () => { if (voiceModeRef.current) setTimeout(() => startListening(), 250); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak]);

  const speakThinkingFiller = useCallback(() => {
    if (!ttsRef.current) return;
    speak(THINKING_VOICE_FILLERS[Math.floor(Math.random() * THINKING_VOICE_FILLERS.length)]);
  }, [speak]);

  // ── Envoi vers l'API (SSE) ─────────────────────────────────────────────────
  const callAI = useCallback(async (text: string, historyBefore: Msg[], imgUrl?: string | null) => {
    if (loadingRef.current) return;
    setLoading(true);
    setInterimText("");
    abortRef.current = new AbortController();
    let firstToken = true;
    let streamingContent = "";
    let finalActions: string[] = [];

    try {
      const res = await fetch("/api/ai/axia", {
        method: "POST",
        signal: abortRef.current.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyBefore.map(m => ({ role: m.role, content: m.content })),
          imageUrl: imgUrl ?? undefined,
          fast: false,
          stream: true,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Erreur ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let evt: any;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }
          if (evt.type === "token") {
            streamingContent += evt.text as string;
            if (firstToken) {
              firstToken = false;
              setLoading(false);
              setMessages(prev => [...prev, { role: "assistant", content: streamingContent }]);
            } else {
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { ...next[next.length - 1], content: streamingContent };
                return next;
              });
            }
          } else if (evt.type === "done") {
            finalActions = (evt.actions as string[]) ?? [];
          } else if (evt.type === "error") {
            throw new Error((evt.text as string) || "Erreur Axia");
          }
        }
      }

      const { text: txt, images, videos, audios } = parseContent(streamingContent || "Je n'ai pas pu répondre.");
      setMessages(prev => {
        const next = [...prev];
        const msg: Msg = { role: "assistant", content: txt, images, videos, audios, actions: finalActions };
        if (!firstToken) next[next.length - 1] = msg;
        else next.push(msg);
        return next;
      });
      if (voiceModeRef.current) speakThenListen(txt);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        if (streamingContent) {
          const { text: txt, images, videos, audios } = parseContent(streamingContent);
          setMessages(prev => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: txt, images, videos, audios };
            return next;
          });
        }
      } else {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant" && !last.content) next[next.length - 1] = { role: "assistant", content: `Erreur : ${err.message}` };
          else next.push({ role: "assistant", content: `Erreur : ${err.message}` });
          return next;
        });
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakThenListen]);

  // ── Envoi utilisateur ─────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string, imgUrl?: string | null) => {
    const t = text.trim();
    if (!t || loadingRef.current) return;
    if (!activeIdRef.current) {
      const id = await creerConversation();
      activeIdRef.current = id;
    }
    const userMsg: Msg = { role: "user", content: t, imageUrl: imgUrl ?? undefined };
    const nextMessages = [...messagesRef.current, userMsg];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    if (voiceModeRef.current) { setVoicePhase("thinking"); speakThinkingFiller(); }
    callAI(t, nextMessages, imgUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callAI, speakThinkingFiller, creerConversation]);

  useEffect(() => { sendRef.current = (t) => sendMessage(t); }, [sendMessage]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  const regenerateLast = useCallback(() => {
    setMessages(prev => {
      const lastUser = [...prev].reverse().find(m => m.role === "user");
      if (!lastUser) return prev;
      const lastAssIdx = prev.map(m => m.role).lastIndexOf("assistant");
      const msgs = prev.filter((_, i) => i !== lastAssIdx);
      setTimeout(() => callAI(lastUser.content, msgs), 0);
      return msgs;
    });
  }, [callAI]);

  // ── Reconnaissance vocale ─────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!voiceModeRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setVoicePhase("idle"); return; }
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    const rec = new SR();
    rec.lang = "fr-FR"; rec.continuous = false; rec.interimResults = true;
    rec.onresult = (e: any) => {
      let interim = "", final = "";
      for (const r of e.results) {
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInterimText(interim || final);
      if (final) { setInterimText(""); sendRef.current(final); }
    };
    rec.onend = () => { if (voiceModeRef.current && !loadingRef.current) setVoicePhase("idle"); };
    rec.onerror = () => setVoicePhase("idle");
    recognRef.current = rec;
    setVoicePhase("listening");
    setInterimText("");
    rec.start();
  }, []);

  const stopListening = useCallback(() => {
    recognRef.current?.stop();
    setVoicePhase("idle");
    setInterimText("");
  }, []);

  const openVoiceMode = () => {
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    setVoiceMode(true);
    setVoicePhase("idle");
    setTimeout(() => startListening(), 600);
  };
  const closeVoiceMode = () => {
    stopListening();
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    setVoiceMode(false);
    setVoicePhase("idle");
    setInterimText("");
  };
  const handleOrbTap = () => {
    if (voicePhase === "speaking") { window.speechSynthesis?.cancel(); audioRef.current?.pause(); setTimeout(() => startListening(), 200); }
    else if (voicePhase === "listening") stopListening();
    else if (voicePhase === "idle") startListening();
  };

  // ── Pièce jointe ──────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPendingImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const autoGrowInput = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const handleSendChat = () => {
    const t = input.trim();
    if ((!t && !pendingImage) || loading) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    const img = pendingImage;
    setPendingImage(null);
    if (t) sendMessage(t, img);
  };

  // ── Conversations ─────────────────────────────────────────────────────────
  async function ouvrirConversation(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
    const conv = await chargerConversation(id);
    setMessages(conv?.messages ?? []);
  }
  function nouvelleConversation() {
    setActiveId(null);
    setMessages([]);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  async function supprimerConversation(id: string) {
    await supprimer(id);
    if (activeIdRef.current === id) { setActiveId(null); setMessages([]); }
  }

  const isEmpty = messages.length === 0;
  const phase = PHASE_CONFIG[voicePhase];
  const isOrb = voicePhase === "listening" || voicePhase === "speaking";

  return (
    <div className="h-full flex min-h-0" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>

      <ModuleTutorial
        moduleKey="axia"
        titre="AXIA"
        sousTitre="Ton assistant boutique intelligent"
        steps={AXIA_TUTORIAL_STEPS}
      />

      {/* ── Mode vocal plein écran ─────────────────────────────────────────── */}
      {voiceMode && (
        <div className="fixed inset-0 z-[9990] flex flex-col select-none"
          style={{ background: "radial-gradient(ellipse at 50% 38%, #2a2a2a 0%, #060606 100%)" }}>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
            {[180, 260, 340, 430].map((s, i) => (
              <div key={i} className="absolute rounded-full border"
                style={{ width: s, height: s, borderColor: phase.ringColor, opacity: isOrb ? 0.22 - i * 0.04 : 0.06,
                  animation: isOrb ? `axiaRing ${2.4 + i * 0.5}s ${i * 0.3}s ease-in-out infinite` : undefined,
                  transition: "opacity 0.6s" }} />
            ))}
          </div>

          <div className="absolute top-5 right-5 flex gap-2 z-20">
            <button onClick={() => setTtsOn(v => !v)}
              className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
              {ttsOn ? <Volume2 size={16} className="text-white/70" /> : <VolumeX size={16} className="text-white/30" />}
            </button>
            <button onClick={closeVoiceMode} type="button"
              className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
              <X size={18} className="text-white/70" />
            </button>
          </div>

          {messages.length > 0 && (
            <div ref={voiceScrollRef}
              className="absolute top-0 left-0 right-0 bottom-[380px] overflow-y-auto px-5 pt-16 pb-4 flex flex-col justify-end gap-2 z-10 pointer-events-none">
              {messages.slice(-6).map((m, i) => {
                const { text } = parseContent(m.content);
                if (!text) return null;
                return (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                      style={m.role === "user"
                        ? { background: "rgba(245,166,35,0.18)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(245,166,35,0.25)" }
                        : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {text}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 h-[380px] flex flex-col items-center justify-center gap-6">
            <div onClick={handleOrbTap}
              className="relative w-36 h-36 rounded-full flex items-center justify-center cursor-pointer p-2"
              style={{ background: phase.orbGrad, boxShadow: phase.orbShadow,
                transform: voicePhase === "listening" ? "scale(1.1)" : voicePhase === "speaking" ? "scale(1.05)" : "scale(1)",
                transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
              {voicePhase === "thinking"
                ? <div className="w-10 h-10 rounded-full border-4 border-white/20 border-t-white animate-spin" />
                : (
                  <div className="w-full h-full rounded-full overflow-hidden border-2 border-white/25">
                    <img src="/axia-icon.png" alt="Axia" className="w-full h-full object-cover" />
                  </div>
                )}
              {voicePhase === "listening" && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg">
                  <Mic size={14} className="text-[#111111]" />
                </div>
              )}
              {voicePhase === "speaking" && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg">
                  <Volume2 size={14} className="text-emerald-600" />
                </div>
              )}
            </div>

            {voicePhase === "listening" && (
              <div className="flex items-end justify-center gap-[3px] h-12">
                {WAVE_HEIGHTS.map((h, i) => (
                  <div key={i} className="rounded-full"
                    style={{ width: 3, height: h, background: "linear-gradient(to top, #F5A623, #FFD280)",
                      animation: `axiaWave ${0.5 + (i % 4) * 0.2}s ${i * 0.06}s ease-in-out infinite alternate` }} />
                ))}
              </div>
            )}
            {voicePhase === "speaking" && (
              <div className="flex items-center justify-center gap-[4px] h-12">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="rounded-full"
                    style={{ width: 4, background: "linear-gradient(to top, #10b981, #6ee7b7)",
                      animation: `axiaSpeak ${0.7 + (i % 3) * 0.3}s ${i * 0.09}s ease-in-out infinite alternate`,
                      height: 8 + (i % 6) * 7 }} />
                ))}
              </div>
            )}

            <p className="text-white/50 text-sm text-center px-8 max-w-sm min-h-[1.5em]">
              {interimText || (
                voicePhase === "idle" ? "Touche l'orbe pour parler"
                : voicePhase === "listening" ? "Je t'écoute…"
                : voicePhase === "speaking" ? "Touche l'orbe pour interrompre"
                : "Traitement en cours…"
              )}
            </p>
          </div>

          <style>{`
            @keyframes axiaRing { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
            @keyframes axiaWave { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }
            @keyframes axiaSpeak { from { transform: scaleY(0.3); } to { transform: scaleY(1); } }
          `}</style>
        </div>
      )}

      {/* ── Sidebar conversations ────────────────────────────────────────── */}
      <div className={`flex-shrink-0 overflow-hidden transition-all duration-300 ${sidebarOpen ? "w-[260px]" : "w-0"} hidden lg:block`}>
        <div className="w-[260px] h-full">
          <AxiaConversationSidebar
            conversations={conversations} activeId={activeId} loading={loadingList}
            onSelect={ouvrirConversation} onNew={nouvelleConversation}
            onDelete={supprimerConversation} onRename={renommer}
          />
        </div>
      </div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setSidebarOpen(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-[80%] max-w-[300px]" onClick={e => e.stopPropagation()}>
            <AxiaConversationSidebar
              conversations={conversations} activeId={activeId} loading={loadingList}
              onSelect={ouvrirConversation} onNew={nouvelleConversation}
              onDelete={supprimerConversation} onRename={renommer} onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 h-full flex flex-col min-h-0" style={{ background: "linear-gradient(160deg,#111111 0%,#1a1a1a 55%,#0a0a0a 100%)" }}>
        {/* Barre supérieure */}
        <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 gap-2">
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <button onClick={() => setSidebarOpen(v => !v)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10 flex-shrink-0"
              title="Historique des conversations">
              <PanelLeft size={14} className="text-white/60" />
            </button>
            <button onClick={nouvelleConversation}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10 flex-shrink-0"
              title="Nouvelle conversation">
              <Plus size={14} className="text-white/60" />
            </button>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl overflow-hidden flex-shrink-0 ml-0.5 sm:ml-1" style={{ boxShadow: "0 0 20px rgba(245,166,35,0.25)" }}>
              <img src="/axia-icon.png" alt="Axia" className="w-full h-full object-cover" />
            </div>
            <span className="hidden sm:inline text-white font-bold text-sm tracking-tight">AXIA</span>
            <span className="hidden sm:block ml-0.5"><BoutonRevoirTutoriel moduleKey="axia" dark /></span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <AxiaNotifBell />
            <button onClick={() => setTtsOn(v => !v)} title="Réponses vocales"
              className="flex w-7 h-7 sm:w-8 sm:h-8 rounded-xl items-center justify-center transition-colors hover:bg-white/10 flex-shrink-0">
              {ttsOn ? <Volume2 size={13} className="text-white/60" /> : <VolumeX size={13} className="text-white/25" />}
            </button>
            <button onClick={openVoiceMode} title="Mode vocal"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
              style={{ background: "rgba(245,166,35,0.15)" }}>
              <Phone size={12} className="text-[#F5A623]" />
            </button>
            <Link href="/dashboard/axia/journal" title="Journal"
              className="hidden sm:flex items-center gap-1.5 text-[11.5px] font-semibold text-white/60 hover:text-white border border-white/10 hover:border-white/25 rounded-full px-3 py-1.5 transition-all flex-shrink-0">
              <History size={12} /> Journal
            </Link>
            <Link href="/dashboard/accueil" title="Tableau de bord"
              className="flex items-center gap-1.5 text-[11.5px] font-bold rounded-full px-2.5 sm:px-3.5 py-1.5 transition-all hover:opacity-90 flex-shrink-0"
              style={{ background: "#F5A623", color: "#111111" }}>
              <LayoutDashboard size={12} /> <span className="hidden sm:inline">Tableau de bord</span>
            </Link>
          </div>
        </div>

        {isEmpty ? (
          /* ── Écran d'accueil centré ────────────────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0">
            <div className="ax-axia-mascot w-20 h-20 sm:w-24 sm:h-24 mb-5 rounded-3xl overflow-hidden"
              style={{ boxShadow: "0 0 50px rgba(245,166,35,0.35), 0 8px 30px rgba(0,0,0,0.3)" }}>
              <img src="/axia-icon.png" alt="Axia" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white text-center mb-1.5">
              {nomBoutique ? `Bonjour, ${nomBoutique}` : "Bonjour"}
            </h1>
            <p className="text-white/40 text-sm text-center mb-8">Que veux-tu faire pour ta boutique aujourd'hui ?</p>

            <ChatInput
              input={input} setInput={setInput} loading={loading} pendingImage={pendingImage} setPendingImage={setPendingImage}
              inputRef={inputRef} fileRef={fileRef} onFile={handleFileChange} onSend={handleSendChat} onStop={stopGeneration}
              autoGrow={autoGrowInput} centered
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full max-w-2xl">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="flex items-center gap-2 text-left px-4 py-3 rounded-2xl text-[13px] text-white/70 hover:text-white transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Sparkles size={12} className="flex-shrink-0" style={{ color: "#F5A623" }} />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Conversation ──────────────────────────────────────────── */
          <>
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4 min-h-0 max-w-3xl w-full mx-auto">
              {messages.map((m, i) => {
                const { text, images: pImgs, videos: pVids } = parseContent(m.content);
                const allImages = [...(pImgs ?? []), ...(m.images ?? [])];
                const allVideos = [...(pVids ?? []), ...(m.videos ?? [])];
                const isLast = i === messages.length - 1;
                return (
                  <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden"
                      style={m.role === "user" ? { background: "#F5A623" } : { background: "rgba(255,255,255,0.08)" }}>
                      {m.role === "assistant"
                        ? <img src="/axia-icon.png" alt="Axia" className="w-full h-full object-cover" />
                        : <span className="text-[11px] font-bold text-[#111111]">{(nomBoutique ?? "M")[0]}</span>}
                    </div>
                    <div className="flex flex-col gap-1.5" style={{ maxWidth: "85%" }}>
                      {m.imageUrl && (
                        <div className={`rounded-xl overflow-hidden border border-white/10 ${m.role === "user" ? "self-end" : ""}`} style={{ maxWidth: 200 }}>
                          <img src={m.imageUrl} alt="" className="w-full object-cover" />
                        </div>
                      )}
                      {text && (
                        <div className="relative group">
                          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "text-[#111111] font-medium" : "text-white/90"}`}
                            style={m.role === "user" ? { background: "#F5A623" } : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            {m.role === "assistant"
                              ? <div className="axia-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(text || (m.streaming ? "" : m.content)) }} />
                              : <span className="whitespace-pre-wrap">{text}</span>}
                            {m.streaming && (
                              <span className="inline-flex gap-0.5 ml-1 align-middle">
                                {[0, 1, 2].map(k => (
                                  <span key={k} className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "rgba(255,255,255,0.4)", animation: `xdot 1s ${k * 0.15}s ease-in-out infinite` }} />
                                ))}
                              </span>
                            )}
                          </div>
                          {m.role === "assistant" && text && !m.streaming && (
                            <div className="absolute -bottom-2 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <button onClick={() => { navigator.clipboard.writeText(text); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 1500); }}
                                className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(20,20,20,0.9)", border: "1px solid rgba(255,255,255,0.1)" }} title="Copier">
                                {copiedIdx === i ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} className="text-white/50" />}
                              </button>
                              {isLast && !loading && (
                                <button onClick={regenerateLast}
                                  className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(20,20,20,0.9)", border: "1px solid rgba(255,255,255,0.1)" }} title="Régénérer">
                                  <RotateCcw size={10} className="text-white/50" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {allImages.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {allImages.map((src, j) => <img key={j} src={src} alt="" className="rounded-xl max-w-[200px]" loading="lazy" />)}
                        </div>
                      )}
                      {allVideos.map((src, j) => <video key={j} src={src} controls className="rounded-xl max-w-full max-h-56" />)}
                      {m.actions && m.actions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {m.actions.map((a, j) => (
                            <span key={j} className="inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-lg font-medium" style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}>
                              <Sparkles size={9} /> {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl flex-shrink-0 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <img src="/axia-icon.png" alt="Axia" className="w-full h-full object-cover" />
                  </div>
                  <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2].map(j => (
                        <div key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: "#F5A623", animation: `xdot 1s ${j * 0.18}s ease-in-out infinite` }} />
                      ))}
                    </div>
                    <span className="text-[12px] text-white/40">{THINKING_MSGS[thinkingMsgIdx]}</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <ChatInput
              input={input} setInput={setInput} loading={loading} pendingImage={pendingImage} setPendingImage={setPendingImage}
              inputRef={inputRef} fileRef={fileRef} onFile={handleFileChange} onSend={handleSendChat} onStop={stopGeneration}
              autoGrow={autoGrowInput}
            />
          </>
        )}

        <style>{`
          @keyframes xdot{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}}
          .axia-md .axia-p{margin:0 0 8px}
          .axia-md .axia-p:last-child{margin-bottom:0}
          .axia-md .axia-h1,.axia-md .axia-h2,.axia-md .axia-h3{font-weight:700;margin:10px 0 4px;color:#fff}
          .axia-md .axia-ul{margin:4px 0 8px;padding-left:18px}
          .axia-md .axia-li{margin:2px 0}
          .axia-md .axia-link{color:#F5A623;text-decoration:underline}
          .axia-md .axia-inline-code{background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:5px;font-size:0.85em}
          .axia-md .axia-pre{background:rgba(0,0,0,0.3);border-radius:10px;padding:10px 12px;overflow-x:auto;margin:6px 0}
          .axia-md .axia-bq{border-left:2px solid #F5A623;padding-left:10px;opacity:0.8;margin:6px 0}
        `}</style>
      </div>
    </div>
  );
}

// ── Barre de saisie — texte, pièce jointe, envoi/stop ─────────────────────
function ChatInput({
  input, setInput, loading, pendingImage, setPendingImage, inputRef, fileRef, onFile, onSend, onStop, autoGrow, centered,
}: {
  input: string; setInput: (v: string) => void; loading: boolean;
  pendingImage: string | null; setPendingImage: (v: string | null) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>; fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void; onSend: () => void; onStop: () => void;
  autoGrow: (el: HTMLTextAreaElement) => void; centered?: boolean;
}) {
  return (
    <div className={centered ? "w-full max-w-2xl mx-auto" : "flex-shrink-0 px-4 sm:px-6 pb-4 sm:pb-6 pt-2 max-w-3xl w-full mx-auto"}>
      {pendingImage && (
        <div className="mb-2 relative inline-block">
          <img src={pendingImage} alt="" className="h-16 rounded-xl border border-white/15" />
          <button onClick={() => setPendingImage(null)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center">
            <X size={10} className="text-white" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2 rounded-2xl px-3 py-2.5 transition-colors"
        style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(10px)" }}>
        <button onClick={() => fileRef.current?.click()}
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors mb-0.5" title="Joindre une image">
          <Paperclip size={14} className="text-white/50" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          onChange={e => { setInput(e.target.value); autoGrow(e.target); }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Demande n'importe quoi à AXIA…"
          disabled={loading}
          className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35 resize-none py-1 leading-relaxed min-w-0"
          style={{ maxHeight: 140 }}
        />
        {loading ? (
          <button onClick={onStop}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5"
            style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)" }} title="Arrêter">
            <Square size={11} className="text-white" fill="white" />
          </button>
        ) : (
          <button onClick={onSend} disabled={!input.trim() && !pendingImage}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 flex-shrink-0 mb-0.5"
            style={{ background: input.trim() || pendingImage ? "#F5A623" : "rgba(255,255,255,0.06)" }}>
            <Send size={13} className={input.trim() || pendingImage ? "text-[#111111]" : "text-white/40"} />
          </button>
        )}
      </div>
    </div>
  );
}
