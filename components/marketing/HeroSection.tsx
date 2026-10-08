"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Bell, Check, Search, ShoppingBag, TrendingUp } from "lucide-react";
import { useT } from "@/components/I18nProvider";

// Vitrine fictive « Awa Créations » — la même boutique que dans la vidéo de démo.
const PRODUITS = [
  { src: "/hero-bags.webp",       nom: "Sac cabas en cuir",  prix: "24 900" },
  { src: "/hero-argan.webp",      nom: "Huile d'argan pure", prix: "8 500" },
  { src: "/hero-headphones.webp", nom: "Casque artisanal",   prix: "32 000" },
  { src: "/hero-coffee.webp",     nom: "Café de Kribi",      prix: "6 000" },
];

const PAIEMENTS = [
  { nom: "Orange Money", couleur: "#FF7900" },
  { nom: "MTN MoMo",     couleur: "#FFCC00" },
  { nom: "À la livraison", couleur: "#111111" },
  { nom: "WhatsApp",     couleur: "#25D366" },
];

export function HeroSection() {
  const tr = useT();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  function demarrer(e: React.FormEvent) {
    e.preventDefault();
    router.push(email ? `/inscription?email=${encodeURIComponent(email)}` : "/inscription");
  }

  const entree = (delai: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "none" : "translateY(18px)",
    transition: `opacity 0.8s ${delai}ms cubic-bezier(0.23,1,0.32,1), transform 0.8s ${delai}ms cubic-bezier(0.23,1,0.32,1)`,
  });

  return (
    <section className="relative w-full pt-28 pb-16 sm:pt-36 sm:pb-24 bg-white overflow-hidden">
      {/* Fond animé : nappes de lumière ambrée qui dérivent, lueur centrale qui
          porte le texte et le téléphone, grille qui glisse, fondu vers le blanc. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="ax-nappe ax-nappe-1" />
        <div className="ax-nappe ax-nappe-2" />
        <div className="ax-nappe ax-nappe-3" />
        <div className="ax-lueur" />
        <div className="ax-grille"><div className="ax-grille-motif" /></div>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />
      </div>

      <div className="relative px-4 sm:px-10 lg:px-16 max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-8 items-center">

        {/* ─── Texte ─── */}
        <div className="text-center lg:text-left">
          <h1 style={entree(0)} className="text-[34px] sm:text-[50px] xl:text-[60px] font-extrabold leading-[1.02] tracking-tight text-[#111111]">
            {tr("Ta boutique en ligne,")}<br />
            <span style={{ color: "#F5A623" }}>{tr("prête à vendre")}</span>{" "}
            {tr("dès aujourd'hui.")}
          </h1>

          <p style={entree(160)} className="mt-6 text-[16px] sm:text-[18px] text-gray-500 leading-relaxed max-w-xl mx-auto lg:mx-0">
            {tr("Crée ta boutique en 3 minutes, encaisse en Mobile Money ou à la livraison, et suis chaque commande jusqu'à ton client. Tout au même endroit.")}
          </p>

          <form onSubmit={demarrer} style={entree(240)}
            className="mt-8 flex items-center w-full max-w-[560px] mx-auto lg:mx-0 rounded-full bg-white border border-gray-200 shadow-[0_10px_40px_-12px_rgba(17,17,17,0.25)] pl-6 pr-1.5 py-1.5 focus-within:border-[#F5A623]">
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder={tr("Entre ton email")} aria-label={tr("Entre ton email")}
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-[#111111] placeholder:text-gray-400"
            />
            <button type="submit"
              className="flex items-center gap-1.5 rounded-full px-4 sm:px-6 h-12 text-[14px] font-bold text-white flex-shrink-0 transition-transform hover:scale-[1.03]"
              style={{ background: "#111111" }}>
              <span className="hidden sm:inline">{tr("Commencer gratuitement")}</span>
              <span className="sm:hidden">{tr("Commencer")}</span>
              <ArrowRight size={16} style={{ color: "#F5A623" }} />
            </button>
          </form>
          <p style={entree(280)} className="mt-3 text-[12.5px] text-gray-400">
            {tr("Gratuit pour commencer · Sans carte bancaire")}
          </p>

          <div style={entree(340)} className="mt-9 flex flex-wrap items-center justify-center lg:justify-start gap-2">
            <span className="text-[13px] text-gray-400 mr-1">{tr("Fonctionne avec")}</span>
            {PAIEMENTS.map(p => (
              <span key={p.nom} className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 px-3 py-1 text-[12.5px] font-semibold text-gray-700">
                <span className="w-2 h-2 rounded-full" style={{ background: p.couleur }} /> {p.nom}
              </span>
            ))}
          </div>
        </div>

        {/* ─── Visuel : vitrine sur téléphone + notifications ─── */}
        <div style={entree(200)} className="relative h-[520px] sm:h-[620px] flex items-center justify-center" aria-hidden>
          {/* Photos d'ambiance derrière */}
          <div className="absolute left-[4%] top-[8%] w-[46%] h-[62%] rounded-[28px] overflow-hidden rotate-[-6deg] shadow-xl hidden sm:block">
            <img src="/hero-market.webp" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="absolute right-[2%] bottom-[6%] w-[38%] h-[44%] rounded-[28px] overflow-hidden rotate-[5deg] shadow-xl hidden sm:block">
            <img src="/hero-moto.webp" alt="" className="w-full h-full object-cover" />
          </div>

          {/* Téléphone */}
          <div className="relative z-10 w-[250px] sm:w-[290px] h-[510px] sm:h-[590px] rounded-[44px] bg-[#111111] p-[10px] shadow-[0_40px_80px_-20px_rgba(17,17,17,0.55)]">
            <div className="w-full h-full rounded-[34px] overflow-hidden bg-white flex flex-col">
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <span className="text-[10px] font-semibold text-gray-900">9:41</span>
                <span className="w-16 h-4 rounded-full bg-[#111111]" />
                <span className="text-[10px] font-semibold text-gray-900">5G</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-extrabold text-[#111111]" style={{ background: "#F5A623" }}>A</span>
                  <span className="text-[12px] font-extrabold text-[#111111]">Awa Créations</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700"><Search size={13} /><ShoppingBag size={13} /></div>
              </div>
              <div className="relative mx-3 mt-3 h-[120px] sm:h-[140px] rounded-2xl overflow-hidden">
                <img src="/hero-kente.webp" alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute left-3 bottom-3">
                  <p className="text-[8.5px] font-bold uppercase tracking-wider" style={{ color: "#F5A623" }}>{tr("Collection artisanale")}</p>
                  <p className="text-[14px] font-extrabold text-white leading-tight">{tr("Cuir & Kente, faits main")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 p-3">
                {PRODUITS.map(p => (
                  <div key={p.nom}>
                    <div className="aspect-square rounded-xl overflow-hidden bg-gray-100"><img src={p.src} alt="" className="w-full h-full object-cover" /></div>
                    <p className="mt-1.5 text-[9.5px] font-semibold text-gray-800 truncate">{tr(p.nom)}</p>
                    <p className="text-[9.5px] font-extrabold" style={{ color: "#F5A623" }}>{p.prix} XOF</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Notification commande */}
          <div className="ax-float absolute z-20 left-0 sm:left-[-4%] top-0 sm:top-[1%] w-[220px] sm:w-[250px] rounded-2xl bg-white/95 backdrop-blur border border-gray-100 shadow-2xl p-3 flex gap-3">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#111111" }}><Bell size={15} style={{ color: "#F5A623" }} /></span>
            <div className="min-w-0">
              <p className="text-[12px] font-extrabold text-[#111111]">{tr("Nouvelle commande")}</p>
              <p className="text-[11px] text-gray-500 truncate">{tr("Sac cabas en cuir")} · 24 900 XOF</p>
            </div>
          </div>

          {/* Paiement reçu */}
          <div className="ax-float ax-float-2 absolute z-20 right-0 sm:right-[-2%] top-[42%] w-[200px] sm:w-[220px] rounded-2xl bg-white/95 backdrop-blur border border-gray-100 shadow-2xl p-3 flex gap-3 items-center">
            <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#FF7900" }}><Check size={16} className="text-white" strokeWidth={3} /></span>
            <div>
              <p className="text-[12px] font-extrabold text-[#111111]">{tr("Orange Money reçu")}</p>
              <p className="text-[11px] text-gray-500">+24 900 XOF</p>
            </div>
          </div>

          {/* Revenus */}
          <div className="ax-float ax-float-3 absolute z-20 left-[-3%] bottom-[2%] w-[165px] rounded-2xl p-4 shadow-2xl hidden sm:block" style={{ background: "#111111" }}>
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-white/50">{tr("Revenus")}</p>
              <TrendingUp size={13} style={{ color: "#F5A623" }} />
            </div>
            <p className="text-2xl font-extrabold text-white mt-1">+24%</p>
            <div className="flex items-end gap-1 h-10 mt-2">
              {[35, 55, 42, 78, 60, 90, 100].map((h, i) => (
                <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 6 ? "#F5A623" : "#F5A62340" }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes axFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        .ax-float { animation: axFloat 6s ease-in-out infinite; }
        .ax-float-2 { animation-delay: -2s; }
        .ax-float-3 { animation-delay: -4s; }
        .ax-nappe { position: absolute; border-radius: 9999px; filter: blur(70px); will-change: transform; }
        .ax-nappe-1 { width: 620px; height: 620px; left: -8%; top: -18%; background: rgba(245,166,35,0.30); animation: axDerive1 22s ease-in-out infinite; }
        .ax-nappe-2 { width: 540px; height: 540px; right: -6%; top: 6%; background: rgba(255,122,61,0.20); animation: axDerive2 27s ease-in-out infinite; }
        .ax-nappe-3 { width: 480px; height: 480px; left: 34%; bottom: -22%; background: rgba(255,204,0,0.22); animation: axDerive3 31s ease-in-out infinite; }
        @keyframes axDerive1 { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(18%,14%) scale(1.15) } }
        @keyframes axDerive2 { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(-16%,18%) scale(0.9) } }
        @keyframes axDerive3 { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(-20%,-16%) scale(1.12) } }
        .ax-lueur { position: absolute; left: 50%; top: 50%; width: 1100px; height: 1100px; margin: -550px 0 0 -550px; border-radius: 9999px;
          background: conic-gradient(from 0deg, rgba(245,166,35,0.00), rgba(245,166,35,0.16), rgba(255,255,255,0), rgba(255,170,60,0.14), rgba(245,166,35,0.00));
          filter: blur(40px); animation: axTourne 40s linear infinite; will-change: transform; }
        @keyframes axTourne { to { transform: rotate(360deg) } }
        .ax-grille { position: absolute; inset: 0; opacity: 0.5; overflow: hidden;
          mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, black 25%, transparent 75%);
          -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 45%, black 25%, transparent 75%); }
        /* Le motif glisse par transform (carte graphique) — animer background-position redessinait toute la zone à chaque image. */
        .ax-grille-motif { position: absolute; inset: -56px 0 0 -56px;
          background-image: linear-gradient(#11111109 1px, transparent 1px), linear-gradient(90deg, #11111109 1px, transparent 1px);
          background-size: 56px 56px; animation: axGlisse 30s linear infinite; will-change: transform; }
        @keyframes axGlisse { to { transform: translate(56px, 56px) } }
        @media (prefers-reduced-motion: reduce) { .ax-float, .ax-nappe, .ax-lueur, .ax-grille-motif { animation: none; } }
      `}</style>
    </section>
  );
}
