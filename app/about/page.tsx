import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { Globe, Zap, Cpu, Shield } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "À propos — AXSO",
  description: "AXSO est la plateforme e-commerce pensée pour les entrepreneurs africains. Notre mission : donner à chaque commerçant africain les outils pour bâtir son empire digital.",
};

const VALEURS = [
  { Icon: Globe,  accent: "#F5A623", titre: "Africa-first", desc: "Tout ce que nous construisons est pensé pour les réalités du marché africain — Mobile Money, langues locales, logistique adaptée." },
  { Icon: Zap,    accent: "#F5A623", titre: "Simplicité radicale", desc: "Un entrepreneur à Dakar ou Douala ne doit pas avoir besoin d'un développeur. AXSO est puissant et simple à la fois." },
  { Icon: Cpu,    accent: "#7c3aed", titre: "IA au service du marchand", desc: "Axia, notre IA embarquée, automatise ce qui prend du temps — descriptions, réponses clients, gestion des commandes." },
  { Icon: Shield, accent: "#10b981", titre: "Confiance & transparence", desc: "Pas de frais cachés. Pas de commissions surprises. Votre boutique, vos données, votre argent." },
];

const CHIFFRES = [
  { n: "1 247+", label: "boutiques actives" },
  { n: "12",     label: "pays couverts" },
  { n: "98%",    label: "satisfaction client" },
  { n: "< 3min", label: "pour lancer" },
];

export default function AboutPage() {
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      {/* Hero */}
      <section className="pt-36 pb-28 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.09) 0%, transparent 65%)" }} />
        <div className="max-w-3xl mx-auto text-center relative">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
            Notre histoire
          </span>
          <h1 className="text-4xl sm:text-6xl font-bold mb-7 leading-tight">
            Bâtir l'Afrique digitale,<br />
            <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              un empire à la fois
            </span>
          </h1>
          <p className="text-[#666666] text-xl leading-relaxed max-w-2xl mx-auto">
            AXSO est né d'un constat simple : les entrepreneurs africains méritent des outils aussi puissants que ceux disponibles en Europe ou aux États-Unis — et adaptés à leur réalité.
          </p>
        </div>
      </section>

      {/* Chiffres */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-24">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-5 mb-28">
          {CHIFFRES.map(c => (
            <div key={c.n} className="text-center rounded-2xl p-6 border"
              style={{ background: "rgba(245,166,35,0.04)", borderColor: "rgba(245,166,35,0.15)" }}>
              <p className="text-3xl font-black mb-1" style={{ color: "#F5A623" }}>{c.n}</p>
              <p className="text-[#737373] text-sm">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Mission */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-28">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: "#F5A623" }}>Notre mission</p>
            <h2 className="text-3xl font-bold text-[#111111] mb-5 leading-snug">
              Chaque entrepreneur africain mérite son empire digital
            </h2>
            <p className="text-[#666666] leading-relaxed text-lg">
              Nous croyons que le commerce africain est le moteur de la prochaine décennie. AXSO donne à chaque marchand — qu'il soit à Dakar, Abidjan, Lagos ou Casablanca — les outils pour vendre en ligne, automatiser sa gestion et croître sans limite.
            </p>
          </div>
          <div className="rounded-3xl p-8 border relative overflow-hidden"
            style={{ background: "rgba(245,166,35,0.04)", borderColor: "rgba(245,166,35,0.2)" }}>
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-1/2 translate-x-1/2"
              style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.2), transparent)" }} />
            <p className="text-5xl font-black leading-none mb-3" style={{ color: "#F5A623" }}>2023</p>
            <p className="text-[#111111] font-bold text-xl mb-2">Fondée à Dakar</p>
            <p className="text-[#737373] text-sm leading-relaxed">
              AXSO a été fondée par une équipe d'ingénieurs et d'entrepreneurs africains qui ont vécu les frustrations de vendre en ligne sur le continent.
            </p>
          </div>
        </div>

        {/* Valeurs */}
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] mb-12" style={{ color: "#F5A623" }}>Nos valeurs</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {VALEURS.map(({ Icon, accent, titre, desc }) => (
              <div key={titre} className="rounded-2xl p-7 border transition-all duration-300 hover:-translate-y-0.5"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: `${accent}12`, border: `1px solid ${accent}25` }}>
                  <Icon size={20} style={{ color: accent }} />
                </div>
                <h3 className="font-bold text-[#111111] text-lg mb-2">{titre}</h3>
                <p className="text-[#737373] text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
