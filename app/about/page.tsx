import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { Globe, Zap, Cpu, Shield } from "lucide-react";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/serveur";

export const metadata: Metadata = {
  title: "À propos",
  description: "AXSO est la plateforme e-commerce pensée pour les entrepreneurs africains. Notre mission : donner à chaque commerçant africain les outils pour bâtir son empire digital.",
};

const VALEURS = [
  { Icon: Globe,  accent: "#F5A623", titre: "Africa-first", desc: "Tout ce que nous construisons est pensé pour les réalités du marché africain — Mobile Money, paiement à la livraison, livraison par quartier." },
  { Icon: Zap,    accent: "#F5A623", titre: "Simplicité radicale", desc: "Un entrepreneur à Dakar ou Douala ne doit pas avoir besoin d'un développeur. AXSO est puissant et simple à la fois." },
  { Icon: Cpu,    accent: "#7c3aed", titre: "IA au service du marchand", desc: "Axia, notre IA embarquée, automatise ce qui prend du temps — descriptions, réponses clients, gestion des commandes." },
  { Icon: Shield, accent: "#10b981", titre: "Confiance & transparence", desc: "Pas de frais cachés. Pas de commissions surprises. Votre boutique, vos données, votre argent." },
];

export default async function AboutPage() {
  const t = await getT();
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      {/* Hero */}
      <section className="pt-36 pb-28 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.09) 0%, transparent 65%)" }} />
        <div className="max-w-3xl mx-auto text-center relative">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
            {t("Notre histoire")}
          </span>
          <h1 className="text-4xl sm:text-6xl font-bold mb-7 leading-tight">
            {t("Bâtir l'Afrique digitale,")}<br />
            <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              {t("un empire à la fois")}
            </span>
          </h1>
          <p className="text-[#666666] text-xl leading-relaxed max-w-2xl mx-auto">
            {t("AXSO est né d'un constat simple : les entrepreneurs africains méritent des outils aussi puissants que ceux disponibles en Europe ou aux États-Unis — et adaptés à leur réalité.")}
          </p>
        </div>
      </section>

      {/* Mission & valeurs */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-24">
        {/* Mission */}
        <div className="max-w-4xl mx-auto mb-28">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] mb-4" style={{ color: "#F5A623" }}>{t("Notre mission")}</p>
            <h2 className="text-3xl font-bold text-[#111111] mb-5 leading-snug">
              {t("Chaque entrepreneur africain mérite son empire digital")}
            </h2>
            <p className="text-[#666666] leading-relaxed text-lg">
              {t("Nous croyons que le commerce africain est le moteur de la prochaine décennie. AXSO donne à chaque marchand — qu'il soit à Dakar, Abidjan, Lagos ou Casablanca — les outils pour vendre en ligne, automatiser sa gestion et croître sans limite.")}
            </p>
          </div>
        </div>

        {/* Valeurs */}
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] mb-12" style={{ color: "#F5A623" }}>{t("Nos valeurs")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {VALEURS.map(({ Icon, accent, titre, desc }) => (
              <div key={titre} className="rounded-2xl p-7 border transition-all duration-300 hover:-translate-y-0.5"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: `${accent}12`, border: `1px solid ${accent}25` }}>
                  <Icon size={20} style={{ color: accent }} />
                </div>
                <h3 className="font-bold text-[#111111] text-lg mb-2">{t(titre)}</h3>
                <p className="text-[#737373] text-sm leading-relaxed">{t(desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
