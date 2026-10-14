import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { Rocket, CreditCard, Package, Bot, Truck, Smartphone, BarChart3, Globe, Clapperboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/serveur";

export const metadata: Metadata = {
  title: "Tutoriels vidéo",
  description: "Tutoriels vidéo AXSO pas à pas (en préparation).",
};

const VIDEOS: { Icon: LucideIcon; titre: string; niveau: string; tag: string }[] = [
  { Icon: Rocket,     titre: "Créer sa boutique en 3 minutes",     niveau: "Débutant",      tag: "#F5A623" },
  { Icon: CreditCard, titre: "Configurer Orange Money & MTN MoMo", niveau: "Débutant",      tag: "#25D366" },
  { Icon: Package,    titre: "Ajouter et gérer ses produits",      niveau: "Débutant",      tag: "#F5A623" },
  { Icon: Bot,        titre: "Axia IA — onboarding automatique",   niveau: "Intermédiaire", tag: "#7c3aed" },
  { Icon: Truck,      titre: "Livraison et suivi des commandes",   niveau: "Intermédiaire", tag: "#0ea5e9" },
  { Icon: Smartphone, titre: "WhatsApp Business — configuration",  niveau: "Intermédiaire", tag: "#25D366" },
  { Icon: BarChart3,  titre: "Analytics & rapports de ventes",     niveau: "Avancé",        tag: "#F5A623" },
  { Icon: Globe,      titre: "Dropshipping Afrique — de A à Z",    niveau: "Avancé",        tag: "#7c3aed" },
];

export default async function TutorialsPage() {
  const t = await getT();
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.09) 0%, transparent 65%)" }} />
        <div className="max-w-5xl mx-auto">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
            <Clapperboard size={14} className="inline-block mr-1.5" />{t("Tutoriels vidéo")}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">
            {t("Apprenez à votre rythme,")}<br />
            <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              {t("maîtrisez AXSO")}
            </span>
          </h1>
          <p className="text-[#737373] text-xl mb-10 max-w-2xl">{t("Nos tutoriels vidéo sont en cours de tournage. Voici les sujets prévus.")}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {VIDEOS.map(v => (
              <div key={v.titre}
                className="rounded-2xl border overflow-hidden"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                {/* Thumbnail */}
                <div className="aspect-video flex items-center justify-center relative"
                  style={{ background: `linear-gradient(135deg, ${v.tag}15, ${v.tag}06)` }}>
                  <v.Icon size={48} style={{ color: v.tag }} />
                  <span className="absolute bottom-2 right-2 text-xs font-bold px-2 py-0.5 rounded"
                    style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>{t("Bientôt")}</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${v.tag}12`, color: v.tag, border: `1px solid ${v.tag}25` }}>{t(v.niveau)}</span>
                  </div>
                  <h3 className="font-bold text-[#111111] text-sm leading-snug">{t(v.titre)}</h3>
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
