import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import Link from "next/link";
import { Package, CreditCard, Cpu, Truck, Globe, MessageCircle, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/serveur";

export const metadata: Metadata = {
  title: "Blog",
  description: "Le blog AXSO : conseils pour les entrepreneurs e-commerce africains. Premiers articles bientôt disponibles.",
};

// Aucun article n'est encore publié : on n'affiche que des titres « à paraître », sans date.
const A_PARAITRE = [
  { tag: "Stratégie", tagColor: "#F5A623", titre: "Comment lancer une boutique rentable en Afrique en 2026", Icon: Package },
  { tag: "Mobile Money", tagColor: "#25D366", titre: "Wave, Orange Money, MTN MoMo : lequel choisir pour votre boutique ?", Icon: CreditCard },
  { tag: "IA", tagColor: "#7c3aed", titre: "Axia IA : comment l'intelligence artificielle booste vos ventes", Icon: Cpu },
  { tag: "Livraison", tagColor: "#0ea5e9", titre: "Livraison en Afrique subsaharienne : les vrais défis et comment les dépasser", Icon: Truck },
  { tag: "Marketing", tagColor: "#ef4444", titre: "Dropshipping en Afrique : fournisseurs, marges et pièges à éviter", Icon: Globe },
  { tag: "Tutoriel", tagColor: "#F5A623", titre: "Configurer WhatsApp Business avec AXSO en 10 minutes", Icon: MessageCircle },
];

export default async function BlogPage() {
  const t = await getT();
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-16 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.09) 0%, transparent 65%)" }} />
        <div className="max-w-5xl mx-auto relative">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] mb-5 px-3 py-1.5 rounded-full"
            style={{ color: "#F5A623", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)" }}>
            <TrendingUp size={11} />{" "}{t("Blog AXSO")}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 leading-tight">{t("Articles bientôt disponibles")}</h1>
          <p className="text-[#737373] text-xl mb-14 max-w-2xl">{t("Nous préparons nos premiers articles sur la vente en ligne en Afrique. En attendant, une question ?")}{" "}
            <Link href="/contact" className="font-bold" style={{ color: "#F5A623" }}>{t("Écrivez-nous")}</Link>
          </p>

          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#999999] mb-5">{t("À paraître")}</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {A_PARAITRE.map(({ tag, tagColor, titre, Icon }) => (
              <li key={titre} className="rounded-2xl border p-5 flex items-start gap-4"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${tagColor}12`, border: `1px solid ${tagColor}20` }}>
                  <Icon size={18} style={{ color: tagColor }} />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold" style={{ color: tagColor }}>{t(tag)}</span>
                  <p className="font-bold text-[#111111] leading-snug mt-1">{t(titre)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
