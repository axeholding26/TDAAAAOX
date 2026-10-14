import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { Newspaper } from "lucide-react";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/serveur";

export const metadata: Metadata = {
  title: "Presse — AXSO",
  description: "Contact presse AXSO : demandes d'interviews et informations sur la plateforme.",
};

export default async function PressPage() {
  const t = await getT();
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.09) 0%, transparent 65%)" }} />
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
              <Newspaper size={14} className="inline-block mr-1.5" />{t("Espace presse")}
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold mb-5 leading-tight">
              {t("Ressources pour")}<br />
              <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                {t("les médias")}
              </span>
            </h1>
            <p className="text-[#737373] text-xl max-w-2xl mx-auto">{t("Une demande d'interview, de logo ou d'information ? Écrivez-nous, nous vous répondrons directement.")}</p>
          </div>

          {/* Contact presse */}
          <div className="rounded-3xl border p-8 text-center"
            style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.06), rgba(245,166,35,0.02))", borderColor: "rgba(245,166,35,0.2)" }}>
            <h3 className="text-xl font-bold text-[#111111] mb-2">{t("Contact presse")}</h3>
            <p className="text-[#737373] mb-5">{t("Demandes d'interviews, citations officielles et informations complémentaires.")}</p>
            <a href="mailto:presse@axsoafrica.com"
              className="inline-block font-bold px-8 py-3.5 rounded-xl transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808", boxShadow: "0 8px 25px rgba(245,166,35,0.3)" }}>
              {t("presse@axsoafrica.com →")}
            </a>
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
