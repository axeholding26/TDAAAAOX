"use client";
import { useEffect, useRef, useState } from "react";
import {
  Plus, Trash2, Globe, Star, RefreshCw, ExternalLink,
  Package, Upload, Zap, Send, TrendingUp, ShoppingBag,
  ChevronRight, Sparkles, Search, BarChart2, DollarSign,
  ArrowUpRight, CheckCircle2, Loader2, X, Info,
} from "lucide-react";
import { AgentActiveIndicator } from "@/components/dashboard/AgentActiveIndicator";

import { useDevise } from "@/components/dashboard/DeviseProvider";
const TABS = [
  { id: "agent", label: "Agent IA", icon: Zap },
  { id: "fournisseurs", label: "Fournisseurs", icon: Globe },
  { id: "commandes", label: "Commandes", icon: Package },
  { id: "import", label: "Import CSV", icon: Upload },
];

/* ─────────────────────────────────────────────────────────────────────────────
   ONGLET AGENT IA
───────────────────────────────────────────────────────────────────────────── */
const SUGGESTIONS_RAPIDES = [
  { label: "Produits tendance Afrique 2026", prompt: "Quels sont les 5 produits dropshipping les plus tendance en Afrique de l'Ouest en 2026 avec de bonnes marges ?" },
  { label: "Mode femme Côte d'Ivoire", prompt: "Trouve-moi des produits de mode femme gagnants pour la Côte d'Ivoire avec des fournisseurs fiables et une marge minimum de 60%." },
  { label: "Tech & Gadgets", prompt: "Suggère des gadgets tech et accessoires smartphone à vendre en dropshipping avec une forte demande au Sénégal." },
  { label: "Cosmétiques naturels", prompt: "Je veux vendre des cosmétiques naturels en dropshipping. Quels produits ont le meilleur potentiel au Cameroun ?" },
  { label: "Niche Sport & Fitness", prompt: "Analyse la niche sport et fitness pour le Togo. Quels produits dropshipping recommandes-tu avec un budget achat max de 10 000 XOF ?" },
  { label: "Maison & Déco africaine", prompt: "Identifie des produits maison et déco à fort potentiel pour le marché africain — idéalement sourcés localement ou avec des délais courts." },
];

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: string[];
}

function OngletAgentIA() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [importingIdx, setImportingIdx] = useState<Record<string, boolean>>({});
  const [imported, setImported] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(prompt?: string) {
    const text = (prompt ?? input).trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text, timestamp: new Date() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/agent-dropshipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reponse ?? data.message ?? "Aucune réponse.",
          timestamp: new Date(),
          actions: data.actions,
        },
      ]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Connexion à l'agent impossible. Vérifiez votre connexion.",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function importerProduit(produitKey: string, nom: string, prix: number, prixAchat: number, description: string, categorie: string) {
    setImportingIdx((p) => ({ ...p, [produitKey]: true }));
    try {
      await fetch("/api/ai/agent-dropshipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            {
              role: "user",
              content: `Importe maintenant ce produit dans mon catalogue : nom="${nom}", prix=${prix}, prixAchat=${prixAchat}, description="${description}", categorie="${categorie}". Utilise l'outil importer_produit.`,
            },
          ],
        }),
      });
      setImported((p) => ({ ...p, [produitKey]: true }));
    } catch {
      alert("Erreur lors de l'import.");
    } finally {
      setImportingIdx((p) => ({ ...p, [produitKey]: false }));
    }
  }

  function renderContent(text: string, msgIdx: number) {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Détecte un bloc produit : ligne commençant par **Produit N°** ou **1.** ou "Produit :"
      const isProduitHeader =
        /^\*\*\d+[\.\)]/i.test(line) ||
        /^#{1,3}\s*\d+[\.\)]/i.test(line) ||
        /^Produit\s*\d*/i.test(line.trim()) ||
        /^\d+[\.\)]\s+\*\*/i.test(line);

      if (isProduitHeader) {
        // Collecte les lignes du bloc produit
        const blockLines: string[] = [line];
        i++;
        while (i < lines.length && lines[i].trim() !== "" && !(/^\d+[\.\)]\s/.test(lines[i]) && i !== 0)) {
          blockLines.push(lines[i]);
          i++;
        }

        // Extrait les données
        const blockText = blockLines.join("\n");
        const nomMatch = blockText.match(/\*{0,2}(.+?)\*{0,2}(?:\n|$)/);
        const nomProduit = nomMatch?.[1]?.replace(/^\d+[\.\)]\s*/, "").replace(/\*/g, "").trim() ?? "Produit";

        const prixAchatMatch = blockText.match(/[Pp]rix\s*(?:achat|d.achat)\s*:?\s*[\~≈]?\s*([\d\s]+)/);
        const prixVenteMatch = blockText.match(/[Pp]rix\s*(?:vente|de\s*vente)\s*:?\s*[\~≈]?\s*([\d\s]+)/);
        const margeMatch = blockText.match(/[Mm]arge\s*:?\s*([\d]+)\s*%/);
        const catMatch = blockText.match(/[Cc]atégorie\s*:?\s*([^\n]+)/);
        const fournMatch = blockText.match(/[Ff]ournisseur\s*:?\s*([^\n]+)/);

        const prixAchat = parseInt(prixAchatMatch?.[1]?.replace(/\s/g, "") ?? "5000", 10);
        const prixVente = parseInt(prixVenteMatch?.[1]?.replace(/\s/g, "") ?? "15000", 10);
        const marge = parseInt(margeMatch?.[1] ?? "65", 10);
        const categorie = catMatch?.[1]?.trim() ?? "Mode";
        const fournisseur = fournMatch?.[1]?.trim() ?? "AliExpress";
        const produitKey = `${msgIdx}-${nomProduit}`;

        elements.push(
          <ProductCard
            key={produitKey}
            produitKey={produitKey}
            nom={nomProduit}
            prixAchat={prixAchat}
            prixVente={prixVente}
            marge={marge}
            categorie={categorie}
            fournisseur={fournisseur}
            blockText={blockText}
            onImport={() => importerProduit(produitKey, nomProduit, prixVente, prixAchat, blockText.slice(0, 200), categorie)}
            importing={!!importingIdx[produitKey]}
            imported={!!imported[produitKey]}
          />
        );
        continue;
      }

      // Ligne normale — rendu markdown simplifié
      if (line.trim() === "") {
        elements.push(<div key={i} className="h-2" />);
      } else if (line.startsWith("## ") || line.startsWith("### ")) {
        elements.push(<p key={i} className="font-bold text-[13px] text-[#111] mt-3 mb-1">{line.replace(/^#+\s/, "")}</p>);
      } else if (line.startsWith("**") && line.endsWith("**")) {
        elements.push(<p key={i} className="font-semibold text-[12px] text-[#222] mt-1">{line.replace(/\*\*/g, "")}</p>);
      } else if (line.startsWith("- ") || line.startsWith("• ")) {
        elements.push(
          <div key={i} className="flex items-start gap-2 text-[12px] text-gray-600">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#F5A623] flex-shrink-0" />
            <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />
          </div>
        );
      } else {
        elements.push(
          <p key={i} className="text-[12px] text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />
        );
      }
      i++;
    }

    return <div className="space-y-1">{elements}</div>;
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] min-h-[520px]" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>

      {/* ── Header agent ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 mb-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0d0d12 0%, #13101a 100%)", border: "1px solid rgba(17,17,17,0.25)" }}>
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(17,17,17,0.15), transparent)", transform: "translate(30%,-30%)" }} />
        <div className="absolute top-0 left-0 w-64 h-32 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at left top, rgba(245,166,35,0.08), transparent)" }} />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#111111,#FFD280)", boxShadow: "0 4px 16px rgba(17,17,17,0.4)" }}>
              <Zap size={18} color="#fff" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-white text-[14px]">Agent Dropshipping IA</h2>
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  En ligne
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                Recherche, analyse et importe des produits gagnants pour ton marché
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {[
              { icon: TrendingUp,  label: "Tendances", val: "Temps réel" },
              { icon: DollarSign,  label: "Marges",    val: "Auto-calcul" },
              { icon: ShoppingBag, label: "Import",    val: "1 clic" },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="text-center hidden sm:block">
                <Icon size={14} style={{ color: "#FFD280", margin: "0 auto 2px" }} />
                <p className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>{label}</p>
                <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>{val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Zone messages ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        {isEmpty && (
          <div className="py-6">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "linear-gradient(135deg,rgba(17,17,17,0.15),rgba(245,166,35,0.1))", border: "1px solid rgba(17,17,17,0.2)" }}>
                <Sparkles size={24} style={{ color: "#FFD280" }} />
              </div>
              <h3 className="font-bold text-[14px] text-[#111] mb-1">Commence par une question</h3>
              <p className="text-[12px] text-gray-400">L'agent analyse les tendances et te propose des produits gagnants à importer directement.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTIONS_RAPIDES.map((s) => (
                <button key={s.label} onClick={() => sendMessage(s.prompt)}
                  className="text-left px-4 py-3 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 group"
                  style={{ background: "rgba(17,17,17,0.03)", borderColor: "rgba(17,17,17,0.12)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(17,17,17,0.3)"; (e.currentTarget as HTMLElement).style.background = "rgba(17,17,17,0.07)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(17,17,17,0.12)"; (e.currentTarget as HTMLElement).style.background = "rgba(17,17,17,0.03)"; }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-gray-700">{s.label}</span>
                    <ChevronRight size={13} className="text-gray-300 group-hover:text-[#111111] transition-colors" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{s.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                style={{ background: "linear-gradient(135deg,#111111,#FFD280)", boxShadow: "0 2px 8px rgba(17,17,17,0.3)" }}>
                <Zap size={12} color="#fff" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === "user"
                ? "text-white rounded-tr-sm"
                : "bg-white border border-gray-100 rounded-tl-sm shadow-sm"
              }`}
              style={msg.role === "user" ? { background: "linear-gradient(135deg,#111111,#1a1a1a)" } : {}}>
              {msg.role === "user" ? (
                <p className="text-[12px] leading-relaxed">{msg.content}</p>
              ) : (
                <div>
                  {renderContent(msg.content, idx)}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3 pt-2 border-t border-gray-100">
                      {msg.actions.slice(0, 4).map((a, ai) => (
                        <span key={ai} className="text-[9px] px-2 py-0.5 rounded-full font-mono"
                          style={{ background: "rgba(17,17,17,0.08)", color: "#111111" }}>
                          {a.split("(")[0]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <p className="text-[9px] mt-1.5 opacity-40">
                {msg.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mr-2"
              style={{ background: "linear-gradient(135deg,#111111,#FFD280)" }}>
              <Zap size={12} color="#fff" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 size={13} className="animate-spin" style={{ color: "#111111" }} />
                <span className="text-[12px] text-gray-400">Analyse en cours…</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ───────────────────────────────────────────────────────────── */}
      <div className="border rounded-2xl p-3 flex gap-2 items-end"
        style={{ background: "#fff", borderColor: "rgba(17,17,17,0.2)", boxShadow: "0 0 0 3px rgba(17,17,17,0.05)" }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Ex: Quels produits de mode femme vendre au Sénégal avec 70% de marge…"
          className="flex-1 resize-none text-[12px] text-gray-800 placeholder-gray-400 outline-none leading-relaxed bg-transparent"
          style={{ maxHeight: 96 }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 disabled:scale-95 hover:scale-105"
          style={{ background: "linear-gradient(135deg,#111111,#1a1a1a)", boxShadow: "0 3px 12px rgba(17,17,17,0.35)" }}>
          <Send size={14} color="#fff" />
        </button>
      </div>
      <p className="text-center text-[10px] text-gray-400 mt-2">
        Entrée pour envoyer · Maj+Entrée pour saut de ligne
      </p>
    </div>
  );
}

/* ── Carte produit extractée de la réponse IA ──────────────────────────────── */
function ProductCard({
  produitKey, nom, prixAchat, prixVente, marge, categorie, fournisseur, blockText, onImport, importing, imported,
}: {
  produitKey: string; nom: string; prixAchat: number; prixVente: number;
  marge: number; categorie: string; fournisseur: string; blockText: string;
  onImport: () => void; importing: boolean; imported: boolean;
}) {
  const { devise, fmt } = useDevise();
  const [expanded, setExpanded] = useState(false);
  const benefice = prixVente - prixAchat;

  return (
    <div className="rounded-2xl border overflow-hidden my-2"
      style={{ background: "linear-gradient(135deg,rgba(245,166,35,0.04),rgba(17,17,17,0.03))", borderColor: "rgba(245,166,35,0.2)" }}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.2)" }}>
              <ShoppingBag size={14} style={{ color: "#F5A623" }} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[12px] text-[#111] truncate">{nom}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(245,166,35,0.12)", color: "#b45309" }}>{categorie}</span>
                <span className="text-[9px] text-gray-400">{fournisseur}</span>
              </div>
            </div>
          </div>
          <button onClick={() => setExpanded((v) => !v)} className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5">
            <Info size={13} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: "Achat",   val: `${fmt(prixAchat)}`, sub: "fournisseur" },
            { label: "Vente",   val: `${fmt(prixVente)}`, sub: "suggéré", accent: true },
            { label: "Marge",   val: `+${marge}%`, sub: `${fmt(benefice)}`, green: true },
          ].map(({ label, val, sub, accent, green }) => (
            <div key={label} className="rounded-xl px-2.5 py-2 text-center"
              style={{ background: green ? "rgba(34,197,94,0.07)" : accent ? "rgba(245,166,35,0.08)" : "rgba(255,255,255,0.6)", border: `1px solid ${green ? "rgba(34,197,94,0.15)" : accent ? "rgba(245,166,35,0.2)" : "rgba(0,0,0,0.06)"}` }}>
              <p className="text-[10px] text-gray-400">{label}</p>
              <p className="text-[11px] font-black leading-tight mt-0.5"
                style={{ color: green ? "#16a34a" : accent ? "#b45309" : "#111" }}>{val}</p>
              <p className="text-[9px] text-gray-400">{sub}</p>
            </div>
          ))}
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap">{blockText.slice(0, 500)}</p>
          </div>
        )}

        <button
          onClick={onImport}
          disabled={importing || imported}
          className="mt-3 w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:scale-100"
          style={imported
            ? { background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.2)" }
            : { background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#fff", boxShadow: "0 4px 14px rgba(245,166,35,0.3)" }
          }>
          {importing ? (
            <><Loader2 size={13} className="animate-spin" /> Import en cours…</>
          ) : imported ? (
            <><CheckCircle2 size={13} /> Importé dans le catalogue</>
          ) : (
            <><ArrowUpRight size={13} /> Importer dans ma boutique</>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ONGLET FOURNISSEURS (inchangé)
───────────────────────────────────────────────────────────────────────────── */
interface Fournisseur {
  id: string; nom: string; pays: string; type: string;
  url: string | null; email: string | null; delaiLivraison: number;
  fiabilite: number; margeAuto: number; actif: boolean;
  livraisonsTotal: number; livraisonsOk: number;
  notes: string | null; _count?: { produits: number };
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  aliexpress: { label: "AliExpress", color: "#FF6A00" },
  cj:         { label: "CJ Dropshipping", color: "#1677FF" },
  jumia:      { label: "Jumia", color: "#EF6C00" },
  local:      { label: "Local", color: "#10b981" },
  autre:      { label: "Autre", color: "#888" },
};

function Stars({ n }: { n: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => <Star key={i} size={10} fill={i<=n?"#F5A623":"none"} stroke={i<=n?"#F5A623":"#DDD"} />)}
    </span>
  );
}

function OngletFournisseurs() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nom:"", pays:"Chine", type:"aliexpress", url:"", email:"", telephone:"", delaiLivraison:15, margeAuto:30, notes:"" });

  useEffect(() => {
    fetch("/api/fournisseurs").then(r=>r.json()).then(d=>setFournisseurs(d.fournisseurs??[])).finally(()=>setLoading(false));
  }, []);

  async function saveFournisseur() {
    setSaving(true);
    const res = await fetch("/api/fournisseurs",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({...form, margeAuto:form.margeAuto/100}) });
    const data = await res.json();
    if (data.fournisseur) {
      setFournisseurs(prev=>[data.fournisseur,...prev]);
      setForm({ nom:"", pays:"Chine", type:"aliexpress", url:"", email:"", telephone:"", delaiLivraison:15, margeAuto:30, notes:"" });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function deleteFournisseur(id: string) {
    await fetch(`/api/fournisseurs/${id}`,{ method:"DELETE" });
    setFournisseurs(prev=>prev.filter(f=>f.id!==id));
  }

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-5 h-5 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-500">{fournisseurs.length} fournisseurs</p>
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-[12px] font-semibold" style={{background:"#F5A623"}}>
          <Plus size={13}/> Ajouter
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[{label:"Nom *",key:"nom",ph:"Fournisseur SAS"},{label:"Pays",key:"pays",ph:"Chine"},{label:"URL catalogue",key:"url",ph:"https://..."},{label:"Email",key:"email",ph:"contact@..."},{label:"Notes",key:"notes",ph:"Délais fiables..."}].map(({label,key,ph})=>(
              <div key={key}>
                <label className="block text-[10px] text-gray-400 mb-1">{label}</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#F5A623]/50" placeholder={ph} value={(form as any)[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} />
              </div>
            ))}
            <div>
              <label className="block text-[10px] text-gray-400 mb-1">Type</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-1">Délai (jours)</label>
              <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none" value={form.delaiLivraison} onChange={e=>setForm(f=>({...f,delaiLivraison:+e.target.value}))} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-1">Marge auto (%)</label>
              <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none" value={form.margeAuto} min={0} max={500} onChange={e=>setForm(f=>({...f,margeAuto:+e.target.value}))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveFournisseur} disabled={saving||!form.nom} className="px-4 py-2 rounded-xl text-white text-[12px] font-semibold disabled:opacity-50" style={{background:"#F5A623"}}>{saving?"...":"Ajouter"}</button>
            <button onClick={()=>setShowForm(false)} className="px-4 py-2 rounded-xl text-[12px] text-gray-500 border border-gray-200">Annuler</button>
          </div>
        </div>
      )}

      {fournisseurs.length===0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
          <Globe size={28} className="mx-auto mb-3 text-gray-300"/>
          <p className="text-[13px] text-gray-400">Aucun fournisseur. <button onClick={()=>setShowForm(true)} className="text-[#F5A623] font-semibold">Ajouter</button></p>
        </div>
      ) : (
        <div className="space-y-2">
          {fournisseurs.map(f => {
            const tc = TYPE_LABELS[f.type]??{label:f.type,color:"#888"};
            const fiabiliteOk = f.livraisonsTotal>0 ? Math.round(f.livraisonsOk/f.livraisonsTotal*100) : null;
            return (
              <div key={f.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><Globe size={16} className="text-gray-400"/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[12px] font-semibold text-[#111]">{f.nom}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white" style={{background:tc.color}}>{tc.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Stars n={Math.round(f.fiabilite)}/>
                    <span className="text-[10px] text-gray-400">{f.pays} · {f.delaiLivraison}j</span>
                    {fiabiliteOk!==null && <span className="text-[10px] text-gray-400">{fiabiliteOk}% OK</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-bold text-[#111]">+{Math.round(f.margeAuto*100)}% marge</p>
                  <p className="text-[10px] text-gray-400">{f._count?.produits??0} produits</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100"><ExternalLink size={12} className="text-gray-400"/></a>}
                  <button onClick={()=>deleteFournisseur(f.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={12} className="text-red-400"/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-[#FFFBF0] border border-[#F5A623]/20 rounded-xl p-4 flex items-start gap-3">
        <RefreshCw size={14} className="text-[#F5A623] mt-0.5 shrink-0"/>
        <p className="text-[11px] text-gray-600">Routage automatique activé — AXIA crée automatiquement la commande fournisseur à chaque vente dropshipping.</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ONGLET COMMANDES (inchangé)
───────────────────────────────────────────────────────────────────────────── */
const STATUTS_CF = ["en_attente","envoye","confirme","expedie","livre","annule"];
const STATUT_COLORS: Record<string,string> = { en_attente:"#F5A623", envoye:"#3b82f6", confirme:"#8b5cf6", expedie:"#f59e0b", livre:"#22c55e", annule:"#ef4444" };

function OngletCommandes() {
  const [commandes, setCommandes] = useState<any[]>([]);
  const [stats, setStats] = useState({ total:0, en_attente:0, expedie:0, livre:0 });
  const [filterStatut, setFilterStatut] = useState("");
  const [expanded, setExpanded] = useState<string|null>(null);
  const [tracking, setTracking] = useState<Record<string,string>>({});
  const [ref, setRef] = useState<Record<string,string>>({});

  async function load() {
    const url = filterStatut ? `/api/dropshipping/commandes-fournisseur?statut=${filterStatut}` : "/api/dropshipping/commandes-fournisseur";
    const r = await fetch(url).then(r=>r.json());
    setCommandes(r.commandes??[]); setStats(r.stats??{});
  }
  useEffect(()=>{ load(); },[filterStatut]);

  async function updateStatut(id: string, statut: string, cf: any) {
    await fetch("/api/dropshipping/commandes-fournisseur",{ method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id,statut,trackingNo:tracking[id]??cf.trackingNo,reference:ref[id]??cf.reference}) });
    load();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {[{label:"Total",v:stats.total},{label:"En attente",v:stats.en_attente},{label:"Expédiés",v:stats.expedie},{label:"Livrés",v:stats.livre}].map(s=>(
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-3">
            <p className="text-[10px] text-gray-400">{s.label}</p>
            <p className="text-[18px] font-bold text-[#111]">{s.v}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={()=>setFilterStatut("")} className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${!filterStatut?"bg-[#111] text-white":"bg-gray-100 text-gray-500"}`}>Tous</button>
        {STATUTS_CF.map(s=>(
          <button key={s} onClick={()=>setFilterStatut(s)} className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${filterStatut===s?"text-white":"bg-gray-100 text-gray-500"}`}
            style={filterStatut===s?{background:STATUT_COLORS[s]}:{}}>
            {s.replace(/_/g," ")}
          </button>
        ))}
      </div>

      {commandes.length===0 ? <p className="text-center text-sm text-gray-400 py-8">Aucune commande fournisseur</p> : (
        <div className="space-y-2">
          {commandes.map(cf=>(
            <div key={cf.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={()=>setExpanded(expanded===cf.id?null:cf.id)}>
                <Package size={13} className="text-gray-400 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#111] truncate">{cf.commande?.numero} → {cf.fournisseur?.nom}</p>
                  <p className="text-[10px] text-gray-400">{cf.commande?.clientNom}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{background:STATUT_COLORS[cf.statut]??"#888"}}>{cf.statut.replace(/_/g," ")}</span>
              </button>

              {expanded===cf.id && (
                <div className="px-4 pb-4 space-y-2 border-t border-gray-50">
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input placeholder="N° suivi" value={tracking[cf.id]??cf.trackingNo??""} onChange={e=>setTracking(t=>({...t,[cf.id]:e.target.value}))}
                      className="border border-gray-200 rounded-xl px-3 py-1.5 text-[11px] outline-none"/>
                    <input placeholder="Réf. fournisseur" value={ref[cf.id]??cf.reference??""} onChange={e=>setRef(r=>({...r,[cf.id]:e.target.value}))}
                      className="border border-gray-200 rounded-xl px-3 py-1.5 text-[11px] outline-none"/>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {STATUTS_CF.filter(s=>s!==cf.statut).map(s=>(
                      <button key={s} onClick={()=>updateStatut(cf.id,s,cf)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white" style={{background:STATUT_COLORS[s]}}>
                        → {s.replace(/_/g," ")}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ONGLET IMPORT CSV (inchangé)
───────────────────────────────────────────────────────────────────────────── */
function OngletImportCSV() {
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [fournisseurId, setFournisseurId] = useState("");
  const [csv, setCsv] = useState("");
  const [marge, setMarge] = useState("30");
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState<any>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { fetch("/api/fournisseurs").then(r=>r.json()).then(d=>setFournisseurs(d.fournisseurs??[])); }, []);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => setCsv(e.target?.result as string??"");
    reader.readAsText(file);
  }

  async function importer() {
    if (!csv) return;
    setLoading(true); setResultat(null);
    const res = await fetch("/api/fournisseurs/import-csv",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({fournisseurId:fournisseurId||null,csv,marge:parseFloat(marge)}) });
    setResultat(await res.json()); setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Fournisseur</label>
          <select value={fournisseurId} onChange={e=>setFournisseurId(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#F5A623]/50">
            <option value="">Sans lien fournisseur</option>
            {fournisseurs.map(f=><option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Marge %</label>
          <input type="number" min="0" max="500" value={marge} onChange={e=>setMarge(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#F5A623]/50"/>
        </div>
      </div>

      <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragging?"border-[#F5A623] bg-[#FFF8EC]":"border-gray-200 hover:border-[#F5A623]/40"}`}
        onClick={()=>document.getElementById("csvInput2")?.click()}>
        <input id="csvInput2" type="file" accept=".csv,.txt" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}}/>
        <Upload size={20} className="mx-auto mb-2 text-gray-300"/>
        {csv ? (
          <div>
            <p className="text-[13px] font-semibold text-green-600">✓ Fichier chargé</p>
            <p className="text-[11px] text-gray-400">{csv.split("\n").length-1} lignes</p>
          </div>
        ) : (
          <div>
            <p className="text-[12px] text-gray-400">Glissez votre CSV ou cliquez</p>
            <p className="text-[10px] text-gray-300 mt-1">nom, description, prix, stock, sku, categorie, image</p>
          </div>
        )}
      </div>

      {csv && (
        <button onClick={importer} disabled={loading}
          className="w-full py-3 bg-[#F5A623] text-white rounded-xl text-[13px] font-bold hover:bg-[#e09520] disabled:opacity-50 transition-all">
          {loading?"Import en cours…":"Importer les produits"}
        </button>
      )}

      {resultat && (
        <div className={`rounded-2xl p-4 border ${resultat.ok?"bg-green-50 border-green-200":"bg-red-50 border-red-200"}`}>
          {resultat.ok ? (
            <p className="text-[13px] font-bold text-green-700">{resultat.importes} produit(s) importé(s)</p>
          ) : <p className="text-[12px] text-red-600">{resultat.message}</p>}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE PRINCIPALE
───────────────────────────────────────────────────────────────────────────── */
export default function DropshippingPage() {
  const [onglet, setOnglet] = useState("agent");

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[18px] font-bold text-[#111] inline-flex items-center gap-2">Dropshipping <AgentActiveIndicator label="Agent Dropshipping actif" /></h1>
          <p className="text-[12px] text-gray-500">Agent IA, fournisseurs, commandes et import catalogue</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background: "rgba(17,17,17,0.06)", border: "1px solid rgba(17,17,17,0.15)" }}>
          <Zap size={11} style={{ color: "#111111" }} />
          <span className="text-[11px] font-semibold" style={{ color: "#111111" }}>Propulsé par AXIA</span>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setOnglet(id)}
            className={`flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 ${onglet === id ? "bg-white shadow-sm text-[#111]" : "text-gray-500 hover:text-gray-700"}`}
            style={onglet === id && id === "agent" ? { boxShadow: "0 1px 4px rgba(17,17,17,0.15)" } : {}}>
            <Icon size={13} style={{ color: onglet === id && id === "agent" ? "#111111" : "inherit" }} />
            <span className="hidden sm:inline">{label}</span>
            {id === "agent" && onglet !== "agent" && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#F5A623] animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {onglet === "agent"       && <OngletAgentIA />}
      {onglet === "fournisseurs" && <OngletFournisseurs />}
      {onglet === "commandes"   && <OngletCommandes />}
      {onglet === "import"      && <OngletImportCSV />}
    </div>
  );
}
