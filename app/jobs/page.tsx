import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { Globe, TrendingUp, DollarSign, GraduationCap, Zap, Handshake, Briefcase } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Carrières — AXSO",
  description: "Rejoignez l'équipe AXSO et construisez l'avenir du commerce africain.",
};

const POSTES = [
  { titre: "Ingénieur Full-Stack Senior", dept: "Engineering", lieu: "Dakar / Remote", type: "CDI", accent: "#F5A623" },
  { titre: "Product Designer UI/UX", dept: "Design", lieu: "Remote", type: "CDI", accent: "#7c3aed" },
  { titre: "Growth Manager — Afrique Francophone", dept: "Marketing", lieu: "Dakar / Abidjan", type: "CDI", accent: "#F5A623" },
  { titre: "Account Manager B2B", dept: "Sales", lieu: "Remote", type: "CDI", accent: "#0ea5e9" },
  { titre: "Développeur Mobile React Native", dept: "Engineering", lieu: "Remote", type: "Freelance", accent: "#7c3aed" },
  { titre: "Community Manager Anglophone", dept: "Marketing", lieu: "Lagos / Remote", type: "CDI", accent: "#25D366" },
];

const AVANTAGES: { Icon: LucideIcon; titre: string; desc: string }[] = [
  { Icon: Globe,         titre: "100% remote-first",     desc: "Travaillez depuis n'importe où en Afrique" },
  { Icon: TrendingUp,    titre: "Impact direct",          desc: "Vos décisions touchent des milliers d'entrepreneurs" },
  { Icon: DollarSign,    titre: "Salaires compétitifs",   desc: "Rémunération alignée sur les standards tech internationaux" },
  { Icon: GraduationCap, titre: "Learning & dev",         desc: "Budget formation, conférences, livres pris en charge" },
  { Icon: Zap,           titre: "Move fast",              desc: "Pas de bureaucratie — idée à production en jours" },
  { Icon: Handshake,     titre: "Équité & options",       desc: "Participation au capital pour les early employees" },
];

export default function JobsPage() {
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.09) 0%, transparent 65%)" }} />
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
              <Briefcase size={14} className="inline-block mr-1.5" />Carrières
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold mb-5 leading-tight">
              Construisons l'Afrique digitale<br />
              <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                ensemble
              </span>
            </h1>
            <p className="text-[#737373] text-xl max-w-2xl mx-auto">
              AXSO cherche des talents exceptionnels pour bâtir la plateforme e-commerce de référence en Afrique.
            </p>
          </div>

          {/* Avantages */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-20">
            {AVANTAGES.map(a => (
              <div key={a.titre} className="rounded-2xl border p-5"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                <a.Icon size={24} className="block mb-2" style={{ color: "#F5A623" }} />
                <p className="font-bold text-[#111111] text-sm mb-1">{a.titre}</p>
                <p className="text-[#808080] text-xs leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>

          {/* Postes */}
          <h2 className="text-2xl font-bold mb-7">Postes ouverts <span className="text-[#999999] font-normal text-lg">({POSTES.length})</span></h2>
          <div className="space-y-3">
            {POSTES.map(p => (
              <div key={p.titre}
                className="rounded-2xl border px-6 py-5 flex items-center justify-between group cursor-pointer hover:-translate-y-0.5 transition-all duration-200"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                <div>
                  <h3 className="font-bold text-[#111111] group-hover:text-[#F5A623] transition-colors mb-1">{p.titre}</h3>
                  <div className="flex items-center gap-3 text-xs text-[#808080]">
                    <span>{p.dept}</span><span>·</span><span>{p.lieu}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-3 py-1.5 rounded-full font-medium hidden sm:block"
                    style={{ background: `${p.accent}12`, color: p.accent, border: `1px solid ${p.accent}25` }}>{p.type}</span>
                  <span className="text-[#999999] group-hover:text-[#F5A623] transition-colors text-lg">→</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-3xl border p-8 text-center"
            style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.06), rgba(245,166,35,0.02))", borderColor: "rgba(245,166,35,0.2)" }}>
            <p className="text-[#666666] mb-2">Vous ne trouvez pas le poste idéal ?</p>
            <h3 className="text-xl font-bold text-[#111111] mb-5">Candidature spontanée</h3>
            <a href="mailto:jobs@axso.app"
              className="inline-block font-bold px-8 py-3.5 rounded-xl transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808", boxShadow: "0 8px 25px rgba(245,166,35,0.3)" }}>
              Envoyer ma candidature →
            </a>
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
