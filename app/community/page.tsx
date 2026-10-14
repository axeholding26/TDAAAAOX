import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import Link from "next/link";
import { Globe } from "lucide-react";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/serveur";

export const metadata: Metadata = {
  title: "Communauté — AXSO",
  description: "La communauté des entrepreneurs africains qui vendent en ligne avec AXSO.",
};

export default async function CommunityPage() {
  const tr = await getT();
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.09) 0%, transparent 65%)" }} />
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
              <Globe size={14} className="inline-block mr-1.5" />{tr("Communauté")}
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold mb-5 leading-tight">
              {tr("Des bâtisseurs")}<br />
              <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                {tr("qui grandissent ensemble")}
              </span>
            </h1>
            <p className="text-[#737373] text-xl max-w-2xl mx-auto">
              {tr("Un espace d'entraide entre marchands AXSO : stratégies, questions et retours d'expérience.")}
            </p>
          </div>

          <div className="rounded-3xl border p-8 text-center"
            style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.06), rgba(245,166,35,0.02))", borderColor: "rgba(245,166,35,0.2)" }}>
            <h2 className="text-xl font-bold text-[#111111] mb-2">{tr("Les espaces communauté arrivent bientôt")}</h2>
            <p className="text-[#737373] mb-5">{tr("En attendant, posez vos questions à notre équipe sur WhatsApp ou par email.")}</p>
            <Link href="/contact"
              className="inline-block font-bold px-8 py-3.5 rounded-xl transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808" }}>
              {tr("Nous contacter →")}
            </Link>
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
