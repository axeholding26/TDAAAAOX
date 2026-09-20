import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { Rocket, CreditCard, Package, Bot, Truck, Smartphone, BarChart3, Plug, Globe, Clapperboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tutoriels vidéo — AXSO",
  description: "Apprenez à maîtriser AXSO avec nos tutoriels vidéo pas à pas.",
};

const VIDEOS: { Icon: LucideIcon; titre: string; duree: string; niveau: string; views: string; tag: string }[] = [
  { Icon: Rocket,     titre: "Créer sa boutique en 3 minutes",       duree: "3:42",  niveau: "Débutant",      views: "12.4K", tag: "#F5A623" },
  { Icon: CreditCard, titre: "Configurer Wave & Orange Money",        duree: "5:18",  niveau: "Débutant",      views: "8.9K",  tag: "#25D366" },
  { Icon: Package,    titre: "Ajouter et gérer ses produits",         duree: "7:55",  niveau: "Débutant",      views: "7.2K",  tag: "#F5A623" },
  { Icon: Bot,        titre: "Axia IA — onboarding automatique",      duree: "6:20",  niveau: "Intermédiaire", views: "5.1K",  tag: "#7c3aed" },
  { Icon: Truck,      titre: "Livraison GPS et suivi temps réel",     duree: "8:44",  niveau: "Intermédiaire", views: "4.3K",  tag: "#0ea5e9" },
  { Icon: Smartphone, titre: "WhatsApp Business — configuration",     duree: "10:12", niveau: "Intermédiaire", views: "3.8K",  tag: "#25D366" },
  { Icon: BarChart3,  titre: "Analytics & rapports de ventes",        duree: "9:30",  niveau: "Avancé",        views: "2.9K",  tag: "#F5A623" },
  { Icon: Plug,       titre: "API & webhooks — développeurs",         duree: "15:00", niveau: "Avancé",        views: "1.7K",  tag: "#ef4444" },
  { Icon: Globe,      titre: "Dropshipping Afrique — de A à Z",      duree: "18:30", niveau: "Avancé",        views: "6.5K",  tag: "#7c3aed" },
];

const NIVEAUX = ["Tous", "Débutant", "Intermédiaire", "Avancé"];

export default function TutorialsPage() {
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.09) 0%, transparent 65%)" }} />
        <div className="max-w-5xl mx-auto">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
            <Clapperboard size={14} className="inline-block mr-1.5" />Tutoriels vidéo
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
            Apprenez à votre rythme,<br />
            <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              maîtrisez AXSO
            </span>
          </h1>
          <p className="text-[#737373] text-xl mb-10 max-w-2xl">{VIDEOS.length} tutoriels pour passer de zéro à expert.</p>

          {/* Filtres */}
          <div className="flex flex-wrap gap-2 mb-12">
            {NIVEAUX.map((n, i) => (
              <button key={n} className="px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={i === 0
                  ? { background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808" }
                  : { background: "rgba(0,0,0,0.05)", color: "rgba(0,0,0,0.5)", border: "1px solid rgba(0,0,0,0.1)" }}>
                {n}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {VIDEOS.map(v => (
              <div key={v.titre}
                className="rounded-2xl border overflow-hidden group cursor-pointer hover:-translate-y-1 transition-all duration-300"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                {/* Thumbnail */}
                <div className="aspect-video flex items-center justify-center relative"
                  style={{ background: `linear-gradient(135deg, ${v.tag}15, ${v.tag}06)` }}>
                  <v.Icon size={48} style={{ color: v.tag }} />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: "rgba(0,0,0,0.5)" }}>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl"
                      style={{ background: "rgba(245,166,35,0.9)" }}>▶</div>
                  </div>
                  <span className="absolute bottom-2 right-2 text-xs font-bold px-2 py-0.5 rounded"
                    style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>{v.duree}</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${v.tag}12`, color: v.tag, border: `1px solid ${v.tag}25` }}>{v.niveau}</span>
                    <span className="text-xs text-[#A6A6A6]">{v.views} vues</span>
                  </div>
                  <h3 className="font-bold text-[#111111] text-sm leading-snug group-hover:text-[#F5A623] transition-colors">{v.titre}</h3>
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
