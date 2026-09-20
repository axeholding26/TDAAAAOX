import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { MessageCircle, Users2, Target, Video, Globe, Calendar } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Communauté — AXSO",
  description: "Rejoignez des milliers d'entrepreneurs africains qui vendent en ligne avec AXSO.",
};

const CHANNELS: { Icon: LucideIcon; nom: string; desc: string; membres: string; lien: string; color: string }[] = [
  { Icon: MessageCircle, nom: "WhatsApp AXSO", desc: "Groupe principal — entraide quotidienne", membres: "3 400+", lien: "#", color: "#25D366" },
  { Icon: Users2, nom: "Groupe Facebook", desc: "Partage de succès, conseils, stratégies", membres: "8 200+", lien: "#", color: "#1877F2" },
  { Icon: Target, nom: "Discord", desc: "Discussions techniques & entraide", membres: "1 800+", lien: "#", color: "#5865F2" },
  { Icon: Video, nom: "YouTube AXSO", desc: "Tutoriels & success stories", membres: "14K abonnés", lien: "#", color: "#FF0000" },
];

const TEMOIGNAGES = [
  { nom: "Fatou B.", ville: "Dakar, Sénégal", texte: "Grâce à la communauté AXSO, j'ai multiplié mon CA par 3 en 4 mois. L'entraide est incroyable.", emoji: "F" },
  { nom: "Kwame A.", ville: "Accra, Ghana", texte: "J'avais zéro connaissance en e-commerce. La communauté m'a tout appris. Aujourd'hui 200 commandes/mois.", emoji: "K" },
  { nom: "Marie-Claire N.", ville: "Douala, Cameroun", texte: "Les live hebdomadaires sont une mine d'or. J'en apprends à chaque session.", emoji: "M" },
];

export default function CommunityPage() {
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.09) 0%, transparent 65%)" }} />
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
              <Globe size={14} className="inline-block mr-1.5" />Communauté
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold mb-5 leading-tight">
              20 000+ bâtisseurs<br />
              <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                qui grandissent ensemble
              </span>
            </h1>
            <p className="text-[#737373] text-xl max-w-2xl mx-auto">
              Rejoignez la plus grande communauté e-commerce d'Afrique. Entraide, stratégies, success stories — tous les jours.
            </p>
          </div>

          {/* Channels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-20">
            {CHANNELS.map(c => (
              <a key={c.nom} href={c.lien}
                className="rounded-2xl border p-6 flex items-start gap-5 group hover:-translate-y-0.5 transition-all duration-300"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                <span className="flex-shrink-0" style={{ color: c.color }}><c.Icon size={30} /></span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-[#111111] group-hover:text-[#F5A623] transition-colors">{c.nom}</h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${c.color}15`, color: c.color }}>{c.membres}</span>
                  </div>
                  <p className="text-[#737373] text-sm">{c.desc}</p>
                  <span className="inline-block mt-3 text-xs font-bold" style={{ color: c.color }}>Rejoindre →</span>
                </div>
              </a>
            ))}
          </div>

          {/* Événements */}
          <div className="rounded-3xl border p-8 mb-16"
            style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.06), rgba(245,166,35,0.02))", borderColor: "rgba(245,166,35,0.2)" }}>
            <h2 className="text-2xl font-bold mb-2"><Calendar size={22} className="inline-block mr-2" />Événements communauté</h2>
            <p className="text-[#737373] mb-6">Chaque semaine, des sessions live pour apprendre et grandir.</p>
            <div className="space-y-3">
              {[
                { jour: "Lundi 19h", titre: "Live Q&A stratégie e-commerce", tag: "Hebdo" },
                { jour: "Mercredi 18h", titre: "Atelier : optimiser ses conversions", tag: "Workshop" },
                { jour: "Vendredi 20h", titre: "Success story — retour d'expérience", tag: "Inspiration" },
              ].map(ev => (
                <div key={ev.titre} className="flex items-center justify-between rounded-xl px-5 py-3.5"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,0,0,0.06)" }}>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold w-28" style={{ color: "#F5A623" }}>{ev.jour}</span>
                    <span className="text-sm text-[#444444]">{ev.titre}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(245,166,35,0.1)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}>
                    {ev.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Témoignages */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TEMOIGNAGES.map(t => (
              <div key={t.nom} className="rounded-2xl border p-6"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                <p className="text-[#4D4D4D] text-sm leading-relaxed mb-4">"{t.texte}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808" }}>{t.emoji}</div>
                  <div>
                    <p className="text-[#111111] text-xs font-bold">{t.nom}</p>
                    <p className="text-[#8C8C8C] text-xs">{t.ville}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
