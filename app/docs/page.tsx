import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import Link from "next/link";
import { Zap, ShoppingBag, CreditCard, Truck, Cpu } from "lucide-react";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/serveur";

export const metadata: Metadata = {
  title: "Documentation — AXSO",
  description: "Documentation AXSO : démarrage, boutique, paiements, livraison, IA.",
};

const SECTIONS = [
  { Icon: Zap,         titre: "Démarrage rapide", articles: ["Créer votre boutique en 3 étapes", "Configurer les paiements Mobile Money", "Ajouter vos premiers produits", "Personnaliser votre thème"], accent: "#F5A623" },
  { Icon: ShoppingBag, titre: "Boutique & produits", articles: ["Catalogue multi-type", "Gestion des variantes", "Produits digitaux", "Import en masse CSV"], accent: "#7c3aed" },
  { Icon: CreditCard,  titre: "Paiements", articles: ["Orange Money, MTN MoMo", "Carte bancaire via NotchPay", "Paiement à la livraison", "Gestion des remboursements"], accent: "#25D366" },
  { Icon: Truck,       titre: "Livraison", articles: ["Zones et tarifs de livraison", "Intégration livreurs", "Suivi de commande", "Livraison digitale automatique"], accent: "#0ea5e9" },
  { Icon: Cpu,         titre: "Axia — Intelligence artificielle", articles: ["Présentation d'Axia", "Chatbot client automatique", "Génération de descriptions", "Onboarding boutique IA"], accent: "#ef4444" },
];

export default async function DocsPage() {
  const t = await getT();
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.09) 0%, transparent 65%)" }} />
        <div className="max-w-5xl mx-auto">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
            {t("Documentation")}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
            {t("Tout ce qu'il faut savoir")}<br />
            <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              {t("pour maîtriser AXSO")}
            </span>
          </h1>
          <p className="text-[#737373] text-xl mb-12 max-w-2xl">
            {t("Les guides détaillés sont en cours de rédaction. Une question en attendant ?")}{" "}
            <Link href="/contact" className="font-bold" style={{ color: "#F5A623" }}>{t("Écrivez-nous")}</Link>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SECTIONS.map(({ Icon, titre, articles, accent }) => (
              <div key={titre} className="rounded-2xl border p-6"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${accent}12`, border: `1px solid ${accent}20` }}>
                    <Icon size={15} style={{ color: accent }} />
                  </div>
                  <h3 className="font-bold text-[#111111]">{t(titre)}</h3>
                </div>
                <ul className="space-y-2">
                  {articles.map(a => (
                    <li key={a} className="text-sm text-[#737373] flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "rgba(0,0,0,0.2)" }} />
                      {t(a)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
