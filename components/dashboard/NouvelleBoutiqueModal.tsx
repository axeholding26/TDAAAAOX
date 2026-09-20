"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Store, Check, AlertCircle, Sparkles, Shirt, Utensils, Cpu, Home, Palette, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";
import { PAYS_DEVISES } from "@/lib/ai-agent";

const CATEGORIES = [
  { label: "Mode", Icon: Shirt },
  { label: "Beauté", Icon: Sparkles },
  { label: "Alimentation", Icon: Utensils },
  { label: "Électronique", Icon: Cpu },
  { label: "Maison", Icon: Home },
  { label: "Artisanat", Icon: Palette },
  { label: "Autre", Icon: MoreHorizontal },
];

const PAYS_NOMS: Record<string, string> = {
  SN: "Sénégal", CI: "Côte d'Ivoire", TG: "Togo", BJ: "Bénin", ML: "Mali", BF: "Burkina Faso", GN: "Guinée", NE: "Niger",
  CM: "Cameroun", GA: "Gabon", CG: "Congo", TD: "Tchad", CF: "Centrafrique", CD: "RD Congo",
  GH: "Ghana", NG: "Nigeria", KE: "Kenya", ZA: "Afrique du Sud", ET: "Éthiopie", TZ: "Tanzanie",
  UG: "Ouganda", RW: "Rwanda", MZ: "Mozambique", AO: "Angola", ZM: "Zambie", ZW: "Zimbabwe",
  MA: "Maroc", DZ: "Algérie", TN: "Tunisie", EG: "Égypte", LY: "Libye",
  FR: "France", DE: "Allemagne", ES: "Espagne", IT: "Italie", PT: "Portugal", NL: "Pays-Bas", BE: "Belgique",
  GB: "Royaume-Uni", CH: "Suisse", SE: "Suède", NO: "Norvège", DK: "Danemark", PL: "Pologne",
  US: "États-Unis", CA: "Canada", MX: "Mexique",
};

type StatutSlug = "idle" | "verification" | "disponible" | "pris" | "invalide";

export function NouvelleBoutiqueModal({ onClose, onCree }: { onClose: () => void; onCree: (tenantId: string) => void }) {
  const [nom, setNom] = useState("");
  const [slug, setSlug] = useState("");
  const [pays, setPays] = useState("CM");
  const [categorie, setCategorie] = useState("Mode");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [slugTouche, setSlugTouche] = useState(false);
  const [statutSlug, setStatutSlug] = useState<StatutSlug>("idle");
  const [visible, setVisible] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { const id = setTimeout(() => setVisible(true), 10); return () => clearTimeout(id); }, []);

  function changerNom(v: string) {
    setNom(v);
    if (!slugTouche) verifierSlug(slugify(v));
  }

  function verifierSlug(v: string) {
    setSlug(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!v.trim()) { setStatutSlug("idle"); return; }
    setStatutSlug("verification");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/boutiques?checkSlug=${encodeURIComponent(v)}`);
        const data = await res.json();
        setStatutSlug(data.disponible ? "disponible" : "pris");
      } catch { setStatutSlug("idle"); }
    }, 400);
  }

  async function creer() {
    if (!nom.trim() || !slug.trim() || !whatsapp.trim()) { toast.error("Remplissez tous les champs"); return; }
    if (statutSlug === "pris") { toast.error("Cette URL est déjà prise"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/boutiques", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomBoutique: nom.trim(), slug: slug.trim(), pays, categorie, whatsapp: whatsapp.trim(), devise: PAYS_DEVISES[pays] ?? "XAF" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success(`✅ Boutique "${nom}" créée !`);
      onCree(data.tenantId);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  function fermer() {
    setVisible(false);
    setTimeout(onClose, 150);
  }

  const pretAEnvoyer = nom.trim() && slug.trim() && whatsapp.trim() && statutSlug !== "pris" && statutSlug !== "verification";

  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);
  if (!monte) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-4 py-8 transition-opacity duration-150"
      style={{ background: "rgba(10,14,26,0.55)", backdropFilter: "blur(3px)", opacity: visible ? 1 : 0 }}
      onClick={fermer}>
      <div className="w-full max-w-md rounded-3xl bg-white overflow-hidden transition-all duration-200 flex flex-col my-auto"
        style={{
          maxHeight: "calc(100vh - 4rem)",
          boxShadow: "0 40px 100px rgba(0,0,0,.35)",
          transform: visible ? "translateY(0) scale(1)" : "translateY(12px) scale(.97)",
          opacity: visible ? 1 : 0,
        }}
        onClick={e => e.stopPropagation()}>

        {/* Header dégradé */}
        <div className="relative px-6 pt-6 pb-5 overflow-hidden flex-shrink-0" style={{ background: "linear-gradient(135deg,#111111 0%,#333333 100%)" }}>
          <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 85% -10%, #F5A623 0%, transparent 55%)" }} />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}>
                <Store size={18} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white text-base leading-tight">Nouvelle boutique</h2>
                <p className="text-white/50 text-xs mt-0.5">Palier 2 · multi-boutique</p>
              </div>
            </div>
            <button onClick={fermer} className="text-white/50 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Nom de la boutique</label>
            <input value={nom} onChange={e => changerNom(e.target.value)} placeholder="Ma deuxième boutique" autoFocus
              className="w-full rounded-xl px-3.5 py-2.5 text-sm border border-gray-200 focus:outline-none transition-colors"
              style={{ borderColor: nom ? "rgba(17,17,17,.25)" : undefined }}
              onFocus={e => (e.target.style.borderColor = "#F5A623")}
              onBlur={e => (e.target.style.borderColor = nom ? "rgba(17,17,17,.25)" : "#e5e7eb")} />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Adresse de la boutique</label>
            <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 border transition-colors"
              style={{ borderColor: statutSlug === "pris" ? "#f87171" : statutSlug === "disponible" ? "#34d399" : "#e5e7eb", background: "#fafafa" }}>
              <span className="text-gray-400 text-sm whitespace-nowrap">axso.vercel.app/</span>
              <input value={slug} onChange={e => { verifierSlug(slugify(e.target.value)); setSlugTouche(true); }}
                className="flex-1 bg-transparent text-sm text-gray-800 focus:outline-none min-w-0" />
              <div className="flex-shrink-0">
                {statutSlug === "verification" && <Loader2 size={14} className="animate-spin text-gray-400" />}
                {statutSlug === "disponible" && <Check size={14} className="text-emerald-500" />}
                {statutSlug === "pris" && <AlertCircle size={14} className="text-red-400" />}
              </div>
            </div>
            {statutSlug === "pris" && <p className="text-[11px] text-red-500 mt-1">Cette adresse est déjà prise</p>}
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Catégorie</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(({ label, Icon }) => (
                <button key={label} type="button" onClick={() => setCategorie(label)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={categorie === label
                    ? { background: "#111111", color: "white" }
                    : { background: "#f4f4f6", color: "#6b7280" }}>
                  <Icon size={12} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Pays</label>
              <select value={pays} onChange={e => setPays(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm border border-gray-200 focus:outline-none focus:border-[#F5A623] bg-white">
                {Object.keys(PAYS_DEVISES).map(p => <option key={p} value={p}>{PAYS_NOMS[p] ?? p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">WhatsApp</label>
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+237 6XX XXX XXX"
                className="w-full rounded-xl px-3.5 py-2.5 text-sm border border-gray-200 focus:outline-none focus:border-[#F5A623]" />
            </div>
          </div>

          <button onClick={creer} disabled={loading || !pretAEnvoyer}
            className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg,#111111,#333333)", boxShadow: pretAEnvoyer ? "0 6px 20px rgba(17,17,17,.35)" : "none" }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Store size={14} />}
            Créer la boutique
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
