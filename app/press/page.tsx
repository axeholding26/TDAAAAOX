import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { Newspaper, Globe, Image as ImageIcon, Palette, Camera } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/serveur";

export const metadata: Metadata = {
  title: "Presse — AXSO",
  description: "Kit presse AXSO : logos, visuels, chiffres clés et contacts médias.",
};

const MENTIONS = [
  { media: "TechCabal",       pays: "NG",  titre: "AXSO : la startup qui veut démocratiser le e-commerce en Afrique", date: "Mars 2026" },
  { media: "Jeune Afrique",   pays: "INT", titre: "Les 10 startups africaines à surveiller en 2026",                  date: "Fév. 2026" },
  { media: "Le Monde Afrique", pays: "FR",  titre: "L'intelligence artificielle au service des commerçants africains", date: "Jan. 2026" },
  { media: "Disrupt Africa",  pays: "INT", titre: "AXSO raises seed round to expand across West Africa",              date: "Déc. 2025" },
];

const CHIFFRES = [
  { n: "1 247+", label: "boutiques actives" },
  { n: "12",     label: "pays couverts" },
  { n: "2023",   label: "année de fondation" },
  { n: "Dakar",  label: "siège social" },
];

const KIT_ITEMS: { Icon: LucideIcon; titre: string; desc: string; taille: string }[] = [
  { Icon: ImageIcon, titre: "Logo AXSO",        desc: "PNG, SVG, fond blanc et transparent",       taille: "2.4 MB" },
  { Icon: Palette,   titre: "Charte graphique", desc: "Couleurs, typographies, composants",         taille: "5.1 MB" },
  { Icon: Camera,    titre: "Photos d'équipe",  desc: "Portraits et photos lifestyle HD",           taille: "18 MB"  },
];

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
            <p className="text-[#737373] text-xl max-w-2xl mx-auto">{t("Logos, visuels, chiffres clés et contact presse. Tout ce dont vous avez besoin pour parler d'AXSO.")}</p>
          </div>

          {/* Chiffres */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-20">
            {CHIFFRES.map(c => (
              <div key={c.n} className="text-center rounded-2xl p-5 border"
                style={{ background: "rgba(245,166,35,0.04)", borderColor: "rgba(245,166,35,0.15)" }}>
                <p className="text-2xl font-black mb-1" style={{ color: "#F5A623" }}>{c.n}</p>
                <p className="text-[#737373] text-xs">{t(c.label)}</p>
              </div>
            ))}
          </div>

          {/* Kit téléchargement */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-20">
            {KIT_ITEMS.map(kit => (
              <div key={kit.titre} className="rounded-2xl border p-6 flex flex-col"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                <kit.Icon size={30} className="mb-4" style={{ color: "#F5A623" }} />
                <h3 className="font-bold text-[#111111] mb-1">{t(kit.titre)}</h3>
                <p className="text-[#808080] text-sm flex-1 mb-4">{t(kit.desc)}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#999999]">{kit.taille}</span>
                  <button className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:scale-105"
                    style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}>
                    {t("Télécharger ↓")}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Mentions presse */}
          <h2 className="text-2xl font-bold mb-7">{t("Ils parlent de nous")}</h2>
          <div className="space-y-3 mb-16">
            {MENTIONS.map(m => (
              <div key={m.titre} className="rounded-xl border px-6 py-4 flex items-center justify-between"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                <div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold mr-2 text-[#666666]">
                    <Globe size={12} />{t(m.pays)}
                  </span>
                  <span className="font-bold text-sm" style={{ color: "#F5A623" }}>{t(m.media)}</span>
                  <p className="text-[#595959] text-sm mt-0.5">{t(m.titre)}</p>
                </div>
                <span className="text-xs text-[#999999] flex-shrink-0 ml-4">{m.date}</span>
              </div>
            ))}
          </div>

          {/* Contact presse */}
          <div className="rounded-3xl border p-8 text-center"
            style={{ background: "linear-gradient(135deg, rgba(245,166,35,0.06), rgba(245,166,35,0.02))", borderColor: "rgba(245,166,35,0.2)" }}>
            <h3 className="text-xl font-bold text-[#111111] mb-2">{t("Contact presse")}</h3>
            <p className="text-[#737373] mb-5">{t("Demandes d'interviews, citations officielles et informations complémentaires.")}</p>
            <a href="mailto:presse@axso.app"
              className="inline-block font-bold px-8 py-3.5 rounded-xl transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808", boxShadow: "0 8px 25px rgba(245,166,35,0.3)" }}>
              {t("presse@axso.app →")}
            </a>
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
