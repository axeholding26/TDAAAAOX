import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { Zap, ShoppingBag, CreditCard, Truck, Cpu, Plug } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation — AXSO",
  description: "Documentation complète AXSO : démarrage, boutique, paiements, livraison, IA, API.",
};

const SECTIONS = [
  { Icon: Zap,         titre: "Démarrage rapide", articles: ["Créer votre boutique en 3 étapes", "Configurer les paiements Mobile Money", "Ajouter vos premiers produits", "Personnaliser votre thème"], accent: "#F5A623" },
  { Icon: ShoppingBag, titre: "Boutique & produits", articles: ["Catalogue multi-type", "Gestion des variantes", "Produits digitaux", "Import en masse CSV"], accent: "#7c3aed" },
  { Icon: CreditCard,  titre: "Paiements", articles: ["Wave, Orange Money, MTN MoMo", "Stripe — cartes internationales", "CinetPay & CampPay", "Gestion des remboursements"], accent: "#25D366" },
  { Icon: Truck,       titre: "Livraison", articles: ["Zones et tarifs de livraison", "Intégration livreurs", "Suivi GPS temps réel", "Livraison digitale automatique"], accent: "#0ea5e9" },
  { Icon: Cpu,         titre: "Axia — Intelligence artificielle", articles: ["Présentation d'Axia", "Chatbot client automatique", "Génération de descriptions", "Onboarding boutique IA"], accent: "#ef4444" },
  { Icon: Plug,        titre: "API & intégrations", articles: ["API REST v1 — authentification", "Webhooks — événements", "Connecteurs WhatsApp Business", "SDK JavaScript"], accent: "#F5A623" },
];

export default function DocsPage() {
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.09) 0%, transparent 65%)" }} />
        <div className="max-w-5xl mx-auto">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
            Documentation
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
            Tout ce qu'il faut savoir<br />
            <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              pour maîtriser AXSO
            </span>
          </h1>
          <p className="text-[#737373] text-xl mb-5 max-w-2xl">Guides pas à pas, références API, tutoriels vidéo.</p>

          {/* Search */}
          <div className="relative max-w-lg mb-16">
            <style>{`
              .docs-search { background:rgba(0,0,0,0.04); border:1px solid rgba(0,0,0,0.1); color:#fff; width:100%; border-radius:16px; padding:16px 50px 16px 20px; font-size:14px; outline:none; transition:all .2s; }
              .docs-search::placeholder { color:rgba(0,0,0,0.3); }
              .docs-search:focus { border-color:rgba(245,166,35,0.5); box-shadow:0 0 0 3px rgba(245,166,35,0.08); }
            `}</style>
            <input type="search" placeholder="Chercher dans la doc..." className="docs-search" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A6A6A6] text-sm">⌘K</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SECTIONS.map(({ Icon, titre, articles, accent }) => (
              <div key={titre} className="rounded-2xl border p-6 hover:-translate-y-0.5 transition-all duration-300"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${accent}12`, border: `1px solid ${accent}20` }}>
                    <Icon size={15} style={{ color: accent }} />
                  </div>
                  <h3 className="font-bold text-[#111111]">{titre}</h3>
                </div>
                <ul className="space-y-2">
                  {articles.map(a => (
                    <li key={a}>
                      <a href="#" className="text-sm text-[#737373] hover:text-[#111111] transition-colors flex items-center gap-2 group">
                        <span className="w-1 h-1 rounded-full flex-shrink-0 transition-colors" style={{ background: "rgba(0,0,0,0.2)" }} />
                        {a}
                      </a>
                    </li>
                  ))}
                </ul>
                <a href="#" className="inline-flex items-center gap-1.5 mt-5 text-xs font-bold transition-opacity hover:opacity-70"
                  style={{ color: accent }}>
                  Voir tout <span>→</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
