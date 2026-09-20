/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  TrendingUp, 
  Box, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Send, 
  Users, 
  ArrowLeftRight, 
  Coins, 
  ChevronRight, 
  Cpu, 
  MessageCircle, 
  Check, 
  Store, 
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Product, Order, ReturnRequest, Customer, Message, ECommerceState } from "./types";

export default function App() {
  // ---------------------------------------------------------
  // Application State
  // ---------------------------------------------------------
  const [state, setState] = useState<ECommerceState>({
    products: [],
    orders: [],
    returnRequests: [],
    customers: [],
    messages: []
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [chatInput, setChatInput] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);

  // Voice Agent State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(true);
  const [voicePersona, setVoicePersona] = useState<'concierge' | 'conseillere' | 'expert'>('concierge');
  const [webhookToast, setWebhookToast] = useState<string | null>(null);

  // Support references
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const speakUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // ---------------------------------------------------------
  // Lifecycle & Live Data Polling
  // ---------------------------------------------------------
  const fetchState = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      setState(data);
    } catch (err) {
      console.error("Error fetching live state:", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(() => {
      fetchState(true);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom of chat log
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // ---------------------------------------------------------
  // Web Speech API - Voice recognition setup
  // ---------------------------------------------------------
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.lang = "fr-FR";
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsListening(true);
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      };

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text && text.trim() !== "") {
          sendAgentMessage(text);
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Browser Text-to-Speech synthesis
  const speakResponseText = (text: string) => {
    if (!speechEnabled) return;
    
    // Remove formatting stars and marks for a clean oral stream
    const cleanText = text
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/- /g, "")
      .replace(/#/g, "");

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "fr-FR";
    
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;

    if (voicePersona === 'concierge') {
      selectedVoice = voices.find(v => v.lang.startsWith("fr") && (v.name.includes("Laurent") || v.name.includes("Microsoft") || v.name.includes("Google")));
      utterance.pitch = 0.95;
      utterance.rate = 1.0;
    } else if (voicePersona === 'conseillere') {
      selectedVoice = voices.find(v => v.lang.startsWith("fr") && (v.name.includes("Hortense") || v.name.includes("Julie") || v.name.includes("Celine") || v.name.includes("Google")));
      utterance.pitch = 1.05;
      utterance.rate = 1.02;
    } else {
      selectedVoice = voices.find(v => v.lang.startsWith("fr") && (v.name.includes("Paul") || v.name.includes("Claude") || v.name.includes("Microsoft")));
      utterance.pitch = 1.0;
      utterance.rate = 1.08;
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    speakUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("La reconnaissance vocale n'est pas pleinement supportée par votre navigateur ou vos permissions actuelles. Utilisez la console de saisie de texte.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
      }
    }
  };

  // Send request message to server
  const sendAgentMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isSending) return;

    setIsSending(true);
    setChatInput("");
    
    // Add user message locally for responsive UI feedback
    const localUserMsg: Message = {
      id: `temp_user_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, localUserMsg]
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: state.messages.filter(m => m.sender !== 'system')
        })
      });

      const data = await response.json();
      
      // Update data state
      setState(data.state);
      
      // Speak response aloud
      speakResponseText(data.reply);

    } catch (err) {
      console.error("Chat communication failure:", err);
    } finally {
      setIsSending(false);
    }
  };

  // Direct backend mutators for fallback click actions
  const handleRestockProduct = async (productId: string, quantity: number) => {
    try {
      const res = await fetch("/api/stock/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity })
      });
      const data = await res.json();
      if (data.success) {
        fetchState(true);
        showToast("Réapprovisionnement enregistré !");
      }
    } catch (err) {
      console.error("Restock failed:", err);
    }
  };

  const handleEvaluateReturn = async (returnId: string, decision: 'Approved' | 'Rejected', shouldRestock: boolean) => {
    try {
      const res = await fetch("/api/returns/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnId, decision, shouldRestock })
      });
      const data = await res.json();
      if (data.success) {
        fetchState(true);
        showToast(`Retour ${returnId} ${decision === 'Approved' ? 'approuvé' : 'rejeté'} !`);
      }
    } catch (err) {
      console.error("Evaluation failed:", err);
    }
  };

  const showToast = (message: string) => {
    setWebhookToast(message);
    setTimeout(() => {
      setWebhookToast(null);
    }, 4500);
  };

  // Statistics
  const alertStockItems = state.products.filter(p => p.status !== 'Optimal').length;
  const pendingReturnsCount = state.returnRequests.filter(r => r.status === 'Pending').length;
  const totalRevenue = state.orders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="min-h-screen bg-luxury-charcoal text-gray-200 font-sans flex flex-col selection:bg-indigo-500/30 selection:text-white">
      
      {/* Toast Alert overlay */}
      <AnimatePresence>
        {webhookToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 max-w-md bg-gradient-to-r from-indigo-950 to-slate-900 border border-indigo-500/40 p-4 rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.25)] flex items-start gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold font-mono block mb-0.5">
                Confirmation Action
              </span>
              <p className="text-xs text-white/90 leading-relaxed font-mono">
                {webhookToast}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* HEADER BAR (Ultra Premium Brand Styling) */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-500 to-pink-500 shadow-[0_0_15px_rgba(139,92,246,0.5)] flex items-center justify-center animate-pulse">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-light tracking-[0.2em] text-white uppercase">
                AURA <span className="font-bold text-indigo-400">Élite</span>
              </span>
              <span className="text-[9px] uppercase tracking-[0.25em] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono font-bold">
                Console Vocale v3.5
              </span>
            </div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Assistant IA d'Action & Concierge E-Commerce VIP</p>
          </div>
        </div>

        {/* Real-time system telemetry and metrics */}
        <div className="flex items-center gap-4 flex-wrap justify-center text-xs">
          <div className="flex items-center gap-2 text-[10px] text-white/50 uppercase tracking-widest font-mono bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
            <span>Console Vocale Active</span>
          </div>

          <div className="bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-colors px-3.5 py-1.5 rounded-full flex items-center gap-2 text-[11px]">
            <Coins className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-white/60 font-mono">Chiffre d'Affaires : <strong className="text-white font-bold">{totalRevenue.toLocaleString()} €</strong></span>
          </div>

          <button 
            onClick={() => fetchState()} 
            disabled={isLoading}
            className="p-2 bg-white/5 hover:bg-white/10 active:scale-95 rounded-full border border-white/10 transition duration-200 flex items-center justify-center cursor-pointer disabled:opacity-50"
            title="Synchroniser les données"
            id="refresh-button"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* MAIN UNIFIED CONTROL BOARD & GRID */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        
        {/* TOP LEVEL AGENT WRAPPER SCREEN */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* SECTION 1: AUDIO WAVEFORM & PERSONA CONTROLLER (Left 5 Columns) */}
          <section id="audio-console-card" className="lg:col-span-5 bg-gradient-to-b from-white/5 to-transparent border border-white/10 p-6 rounded-xl flex flex-col justify-between items-center text-center shadow-2xl relative overflow-hidden min-h-[500px]">
            
            {/* Ambient background blur circles */}
            <div className="absolute inset-0 bg-radial-gradient from-indigo-900/10 via-transparent to-transparent pointer-events-none" />
            
            <div className="w-full flex items-center justify-between z-10">
              <span className="text-[9px] font-mono tracking-widest text-indigo-400 uppercase bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                Hologramme Audio
              </span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSpeechEnabled(!speechEnabled)}
                  className={`p-2 rounded-full border transition cursor-pointer ${speechEnabled ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-white/30 bg-white/5 border-white/5'}`}
                  title={speechEnabled ? "Mettre l'agent en sourdine" : "Activer la synthèse vocale"}
                  id="mute-speech-toggle"
                >
                  {speechEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Glowing Concentric Orb Web Waveform */}
            <div className="my-6 flex flex-col items-center justify-center relative z-10">
              
              <div className="relative w-52 h-52 flex items-center justify-center">
                <div className={`absolute w-full h-full rounded-full border border-indigo-500/10 ${isListening || isSpeaking ? 'scale-105 animate-pulse' : ''}`} />
                <div className="absolute w-[160px] h-[160px] rounded-full border border-indigo-500/20 animate-pulse" />
                <div className="absolute w-[120px] h-[120px] rounded-full border border-indigo-400/30" />
                
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-950 to-indigo-600 shadow-[0_0_40px_rgba(79,70,229,0.45)] flex items-center justify-center overflow-hidden">
                  {isListening ? (
                    <div className="text-white animate-pulse flex flex-col items-center gap-1">
                      <Mic className="w-5 h-5 text-white animate-bounce" />
                      <span className="text-[7px] uppercase tracking-[0.2em] font-mono font-bold">ÉCOUTE...</span>
                    </div>
                  ) : isSpeaking ? (
                    <div className="text-white flex flex-col items-center gap-1">
                      <Volume2 className="w-5 h-5 text-white animate-pulse" />
                      <span className="text-[7px] uppercase tracking-[0.2em] font-mono font-bold">SYNTHÈSE</span>
                    </div>
                  ) : (
                    <div className="text-white/40 flex flex-col items-center gap-1">
                      <Sparkles className="w-5 h-5 text-indigo-400/80 animate-pulse" />
                      <span className="text-[7px] uppercase tracking-[0.2em] font-mono">VEILLE</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Holographic Signal Bars */}
              <div className="h-8 flex items-center justify-center space-x-1 mt-4 w-[160px]">
                {Array.from({ length: 11 }).map((_, i) => {
                  let heightClass = "h-1.5";
                  let animClass = "";
                  
                  if (isListening) {
                    heightClass = i % 2 === 0 ? "h-6" : "h-3";
                    animClass = i % 3 === 0 ? "pulse-bar-fast" : "pulse-bar";
                  } else if (isSpeaking) {
                    heightClass = i % 3 === 0 ? "h-8" : i % 2 === 0 ? "h-5" : "h-2.5";
                    animClass = i % 4 === 0 ? "pulse-bar-slow" : "pulse-bar";
                  }
                  
                  return (
                    <div 
                      key={i} 
                      className={`w-1 rounded-full transition-all duration-300 ${
                        isListening ? 'bg-indigo-400 shadow-[0_0_8px_#818cf8]' :
                        isSpeaking ? 'bg-white shadow-[0_0_12px_#fff]' : 'bg-white/10'
                      } ${heightClass} ${animClass}`}
                      style={{ animationDelay: `${i * 0.08}s` }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Persona and Voice Activation Controls */}
            <div className="w-full flex flex-col gap-4 z-10">
              
              {/* Profile identity choice */}
              <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
                <span className="text-[8px] text-white/40 uppercase tracking-[0.2em] block mb-1.5 font-mono">Identité Vocale de l'Agent</span>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {([
                    { key: 'concierge', name: "Laurent" },
                    { key: 'conseillere', name: "Chloé" },
                    { key: 'expert', name: "Pierre" }
                  ] as const).map((persona) => (
                    <button
                      key={persona.key}
                      onClick={() => setVoicePersona(persona.key)}
                      className={`py-1 rounded-lg cursor-pointer transition font-mono text-[9px] uppercase tracking-wider ${voicePersona === persona.key ? 'bg-indigo-600 text-white font-bold shadow-[0_0_10px_rgba(79,70,229,0.5)]' : 'hover:bg-white/5 text-white/50'}`}
                    >
                      {persona.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary vocal activation trigger */}
              <button
                onClick={toggleListening}
                className={`w-full py-3.5 rounded-xl text-xs uppercase tracking-[0.2em] font-bold shadow-[0_0_15px_rgba(79,70,229,0.25)] transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 ${
                  isListening 
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)] border-none' 
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.01] text-white border-none'
                }`}
                id="mic-activation-button"
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    Désactiver le Micro
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 animate-pulse" />
                    Activer la Voix Live
                  </>
                )}
              </button>
              
              <p className="text-[9px] text-white/30 italic font-mono">
                {isListening ? "AURA analyse vos consignes vocales..." : "Parlez ou utilisez les raccourcis ci-dessous."}
              </p>

              {/* Dynamic Interactive Shortcuts / Preset Commands */}
              <div className="border-t border-white/5 pt-3.5 flex flex-col gap-1.5 text-left">
                <span className="text-[8px] uppercase tracking-widest text-indigo-400 font-bold block mb-1 font-mono">
                  Consignes de Test d'Actions Vocales
                </span>
                
                <div className="flex flex-col gap-1 text-[11px]">
                  <button 
                    onClick={() => sendAgentMessage("Analyse l'état global de nos stocks s'il te plaît")}
                    className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-indigo-500/10 border border-white/5 hover:border-indigo-500/30 text-white/70 hover:text-white transition cursor-pointer font-mono truncate text-left"
                  >
                    ⚡ "Analyse l'état de nos stocks"
                  </button>
                  <button 
                    onClick={() => sendAgentMessage("Commande 15 unités de Parfum Essence Noire")}
                    className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-indigo-500/10 border border-white/5 hover:border-indigo-500/30 text-white/70 hover:text-white transition cursor-pointer font-mono truncate text-left"
                  >
                    📦 "Commande 15 u de Parfum Essence Noire"
                  </button>
                  <button 
                    onClick={() => sendAgentMessage("Approuve la demande de retour de Dubois")}
                    className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-indigo-500/10 border border-white/5 hover:border-indigo-500/30 text-white/70 hover:text-white transition cursor-pointer font-mono truncate text-left"
                  >
                    💸 "Approuve la demande de retour de Dubois"
                  </button>
                  <button 
                    onClick={() => sendAgentMessage("Renseigne-moi sur le profil d'Hélène de Montaigne")}
                    className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-indigo-500/10 border border-white/5 hover:border-indigo-500/30 text-white/70 hover:text-white transition cursor-pointer font-mono truncate text-left"
                  >
                    👤 "Profil de Hélène de Montaigne"
                  </button>
                </div>
              </div>

            </div>

          </section>

          {/* SECTION 2: CONVERSATIONAL LOG TERMINAL (Right 7 Columns) */}
          <section id="chat-console-card" className="lg:col-span-7 bg-white/5 border border-white/10 rounded-xl flex flex-col justify-between shadow-2xl overflow-hidden min-h-[500px]">
            
            {/* Conversation Terminal Header */}
            <div className="border-b border-white/10 bg-white/5 px-4.5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-indigo-400" />
                <span className="text-xs uppercase tracking-widest font-semibold text-white font-mono">Console de Log Vocal & Actions</span>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-indigo-400 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                Live Sync
              </span>
            </div>

            {/* Scrollable Conversation Feed */}
            <div className="flex-1 p-4 overflow-y-auto max-h-[380px] flex flex-col gap-4">
              {state.messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col max-w-[85%] ${
                    msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'
                  }`}
                >
                  <span className="text-[8px] text-white/40 mb-1 px-1 font-mono uppercase tracking-wider">
                    {msg.sender === 'user' ? 'Vous' : msg.sender === 'system' ? 'Système' : 'AURA'} • {msg.timestamp}
                  </span>

                  <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-[0_0_15px_rgba(99,102,241,0.25)] font-medium' 
                      : msg.sender === 'system'
                      ? 'bg-red-500/10 border border-red-500/20 text-red-400 font-mono rounded-tl-none text-[11px]'
                      : 'bg-white/5 border border-white/10 text-white/90 rounded-tl-none shadow-md'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    
                    {/* Tool executions indicators embedded inside speech balloon */}
                    {msg.toolExecuted && (
                      <div className="mt-3.5 pt-2 border-t border-white/10 flex items-center gap-2 text-[10px] font-mono text-indigo-400">
                        <Cpu className="w-3.5 h-3.5 animate-pulse" />
                        <span>{msg.toolExecuted.description}</span>
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded text-[8px] uppercase font-bold">
                          {msg.toolExecuted.status.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Command Text Input fallback */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                sendAgentMessage(chatInput);
              }}
              className="p-3 border-t border-white/10 bg-white/5 flex items-center gap-2"
              id="chat-input-form"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Exemple : 'Vérifie notre stock', 'Approuve le retour Dubois'..."
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition placeholder-white/20 font-mono"
                id="chat-input-field"
              />
              <button
                type="submit"
                disabled={isSending || !chatInput.trim()}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition disabled:opacity-40 flex items-center justify-center cursor-pointer font-medium shadow-[0_0_15px_rgba(99,102,241,0.25)] hover:scale-105 active:scale-95"
                id="submit-message-button"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </section>

        </div>

        {/* BOTTOM LEVEL: LIVE STORE STATE MONITOR PANEL */}
        {/* Satisfies "qui pourra poser les actions que je vais lui demander de faire" by letting users watch database states sync in real-time */}
        <section id="database-registry-panel" className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-xl p-5 shadow-xl flex flex-col gap-4">
          
          <div className="border-b border-white/10 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Box className="w-4 h-4 text-indigo-400" />
                Moniteur de Base de Données AXSO en Direct
              </h3>
              <p className="text-[10px] text-white/40 font-mono">
                Visualisez l'application immédiate des ordres et des actions passés à l'agent vocal
              </p>
            </div>
            
            <div className="flex gap-4 text-[10px] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>Alertes de Stock : <strong className="text-white">{alertStockItems}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Retours en attente : <strong className="text-white">{pendingReturnsCount}</strong></span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            
            {/* SUB-PANEL 1: COLLECTION & STOCKS (Live inventory stats) */}
            <div className="bg-black/30 border border-white/5 rounded-lg p-3.5 flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-bold font-mono">Inventaire &amp; Sourcing de Luxe</span>
                <span className="text-[9px] font-mono text-white/40">5 articles</span>
              </div>

              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {state.products.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded bg-white/5 hover:bg-white/10 transition text-xs border border-white/5">
                    <div className="flex flex-col gap-0.5 truncate mr-2">
                      <span className="font-semibold text-white truncate">{p.name}</span>
                      <span className="text-[9px] text-white/40 font-mono">{p.sku} • {p.price.toLocaleString()} €</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-end">
                        <span className="font-mono font-bold text-white text-[11px]">{p.stock} / {p.safetyStock} u</span>
                        <span className={`text-[8px] px-1 rounded uppercase font-semibold font-mono ${
                          p.status === 'Optimal' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' :
                          p.status === 'Low Stock' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10' :
                          'bg-red-500/10 text-red-400 border border-red-500/10'
                        }`}>
                          {p.status === 'Optimal' ? 'Optimal' : p.status === 'Low' || p.status === 'Low Stock' ? 'Alerte' : 'Rupture'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRestockProduct(p.id, 10)}
                        className="py-1 px-1.5 text-[9px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded hover:bg-indigo-600 hover:text-white transition cursor-pointer font-mono font-bold"
                        title="Commander express +10 u"
                      >
                        +10
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SUB-PANEL 2: GESTION DES RETOURS CLIENTS (Active returns) */}
            <div className="bg-black/30 border border-white/5 rounded-lg p-3.5 flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-bold font-mono">Flux de Retours à Évaluer</span>
                <span className="text-[9px] font-mono text-white/40">{state.returnRequests.length} dossiers</span>
              </div>

              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {state.returnRequests.map(r => (
                  <div key={r.id} className="flex flex-col gap-2 p-2.5 rounded bg-white/5 hover:bg-white/10 transition text-xs border border-white/5">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{r.customerName}</span>
                        <span className="text-[9px] font-mono text-white/40">{r.id} • {r.date}</span>
                      </div>
                      <span className={`text-[8px] uppercase font-bold px-1.5 py-0.2 rounded font-mono border ${
                        r.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        r.status === 'Rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                      }`}>
                        {r.status === 'Approved' ? 'Approuvé' : r.status === 'Rejected' ? 'Rejeté' : 'À Évaluer'}
                      </span>
                    </div>
                    
                    <p className="text-[10px] text-white/50 italic leading-relaxed truncate">"{r.reason}"</p>
                    
                    {r.status === 'Pending' && (
                      <div className="flex gap-1.5 pt-1">
                        <button
                          onClick={() => handleEvaluateReturn(r.id, 'Approved', true)}
                          className="flex-1 py-1 rounded bg-emerald-600/30 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-600 hover:text-white text-[9px] font-bold uppercase cursor-pointer transition"
                        >
                          Approuver (+Stock)
                        </button>
                        <button
                          onClick={() => handleEvaluateReturn(r.id, 'Rejected', false)}
                          className="py-1 px-2 rounded bg-red-950/40 text-red-400 border border-red-500/20 hover:bg-red-900/60 text-[9px] font-bold uppercase cursor-pointer transition"
                        >
                          Rejeter
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {state.returnRequests.length === 0 && (
                  <div className="py-8 text-center text-[11px] text-white/30 font-mono">
                    Aucune demande de retour client active.
                  </div>
                )}
              </div>
            </div>

            {/* SUB-PANEL 3: CRM DE PRESTIGE & HISTORIQUE (VIP customers ledger) */}
            <div className="bg-black/30 border border-white/5 rounded-lg p-3.5 flex flex-col gap-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-bold font-mono font-bold text-pink-400/80">Registre VIP &amp; Clienteling</span>
                <span className="text-[9px] font-mono text-white/40">Maison Élite</span>
              </div>

              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {state.customers.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded bg-white/5 hover:bg-white/10 transition text-xs border border-white/5">
                    <div className="flex items-center gap-2 truncate">
                      <img src={c.avatarUrl} alt={c.name} className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/10" referrerPolicy="no-referrer" />
                      <div className="flex flex-col gap-0.5 truncate">
                        <span className="font-semibold text-white truncate">{c.name}</span>
                        <span className="text-[8px] text-indigo-300 font-mono font-bold bg-indigo-500/10 border border-indigo-500/20 px-1 py-0.2 rounded w-fit">{c.loyaltyTier}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="font-mono text-[10px] font-bold text-white">{c.totalSpent.toLocaleString()} €</span>
                      <span className={`text-[8px] font-semibold ${
                        c.sentiment === 'Delighted' ? 'text-emerald-400' :
                        c.sentiment === 'Neutral' ? 'text-white/40' : 'text-red-400 animate-pulse font-bold'
                      }`}>
                        {c.sentiment === 'Delighted' ? '✨ Enchanté' : c.sentiment === 'Neutral' ? '⚖️ Neutre' : '⚠️ Insatisfait'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </section>

      </main>

      {/* FOOTER BAR */}
      <footer className="border-t border-white/10 bg-black/40 py-6 px-8 mt-12 text-center text-xs text-white/40 flex flex-col md:flex-row items-center justify-between gap-4 font-mono uppercase tracking-wider">
        <p>© 2026 AXSO S.A. • Console de Contrôle AURA.</p>
        <p className="flex items-center gap-2 text-indigo-400/80">
          <Cpu className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          Propulsé par Gemini 3.5 Flash • Agent conversationnel intelligent d'action
        </p>
      </footer>

    </div>
  );
}
