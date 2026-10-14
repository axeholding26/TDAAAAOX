import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { Mail, Phone, Clock, ArrowRight, Shield } from "lucide-react";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/serveur";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez l'équipe AXSO : support, partenariats, presse.",
};

const CHANNELS = [
  {
    Icon: Mail,
    titre: "Email support",
    desc: "support@axsoafrica.com",
    lien: "mailto:support@axsoafrica.com",
    label: "Envoyer un email",
    accent: "#7c3aed",
  },
  {
    Icon: Phone,
    titre: "WhatsApp Business",
    desc: "+237 6 98 67 73 55 · Lun–Ven 8h–20h",
    lien: "https://wa.me/237698677355",
    label: "Envoyer un message",
    accent: "#25D366",
  },
];

const FAQ = [
  { q: "Puis-je tester AXSO gratuitement ?", r: "Oui, le plan Essentiel est gratuit pour toujours. Aucune carte bancaire requise pour démarrer." },
  { q: "Comment fonctionne l'IA Axia ?", r: "Axia est un agent conversationnel qui exécute de vraies actions dans votre boutique — créer des produits, répondre aux clients, analyser vos ventes — sans formation technique." },
];

export default async function ContactPage() {
  const t = await getT();
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      {/* ── Hero ── */}
      <section className="pt-36 pb-20 px-6 sm:px-10 lg:px-16 xl:px-24 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[450px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at top, rgba(245,166,35,0.1) 0%, transparent 65%)" }} />
        <div className="max-w-2xl mx-auto text-center relative">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] mb-6 px-3 py-1.5 rounded-full"
            style={{ color: "#F5A623", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)" }}>
            <Mail size={11} />{" "}{t("Contactez-nous")}
          </span>
          <h1 className="text-4xl sm:text-5xl font-black mb-5 leading-tight">
            {t("Une question ?")}<br />
            <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              {t("Nous sommes là.")}
            </span>
          </h1>
          <p className="text-[#666666] text-lg leading-relaxed">
            {t("Écrivez-nous par email ou sur WhatsApp, notre équipe vous répond pendant les heures d'assistance.")}
          </p>
        </div>
      </section>

      {/* ── Channels ── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-20">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5 mb-24">
          {CHANNELS.map(({ Icon, titre, desc, lien, label, accent }) => (
            <a key={titre} href={lien} target={lien.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="group rounded-3xl p-7 border transition-all duration-300 hover:-translate-y-1 block"
              style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-all group-hover:scale-110"
                style={{ background: `${accent}12`, border: `1px solid ${accent}25` }}>
                <Icon size={22} style={{ color: accent }} />
              </div>
              <h3 className="font-bold text-[#111111] mb-1.5">{t(titre)}</h3>
              <p className="text-[#808080] text-sm mb-5 leading-relaxed">{t(desc)}</p>
              <span className="text-xs font-bold px-4 py-2 rounded-full inline-flex items-center gap-1.5 transition-all group-hover:scale-105"
                style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}25` }}>
                {t(label)} <ArrowRight size={11} />
              </span>
            </a>
          ))}
        </div>

        {/* ── Infos pratiques + Formulaire ── */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8">

          {/* Colonne gauche — Infos */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl p-6 border" style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,166,35,0.1)" }}>
                  <Clock size={16} style={{ color: "#F5A623" }} />
                </div>
                <h3 className="font-bold text-[#111111] text-sm">{t("Horaires d'assistance")}</h3>
              </div>
              <div className="space-y-2 text-sm text-[#666666]">
                <div className="flex justify-between"><span>{t("Lun – Ven")}</span><span className="text-[#444444]">{t("08h00 – 20h00")}</span></div>
                <div className="flex justify-between"><span>{t("Samedi")}</span><span className="text-[#8C8C8C]">{t("Fermé")}</span></div>
                <div className="flex justify-between"><span>{t("Dimanche")}</span><span className="text-[#8C8C8C]">{t("Fermé")}</span></div>
              </div>
            </div>

            <div className="rounded-2xl p-6 border" style={{ background: "rgba(37,211,102,0.04)", borderColor: "rgba(37,211,102,0.15)" }}>
              <h3 className="font-bold text-[#111111] text-sm mb-2">{t("Partenariats & Presse")}</h3>
              <p className="text-[#737373] text-xs leading-relaxed mb-3">{t("Pour les demandes médias, partenariats ou investisseurs :")}</p>
              <a href="mailto:hello@axsoafrica.com" className="text-xs font-bold" style={{ color: "#F5A623" }}>{t("hello@axsoafrica.com →")}</a>
            </div>
          </div>

          {/* Formulaire */}
          <div className="lg:col-span-3">
            <div className="rounded-3xl p-8 border"
              style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(245,166,35,0.15)" }}>
              <h2 className="text-2xl font-black mb-1 text-[#111111]">{t("Envoyer un message")}</h2>
              <p className="text-[#808080] text-sm mb-7">{t("Le bouton ouvre votre application email avec votre message prêt à envoyer.")}</p>

              <style>{`
                .axso-input { background:#fff; border:1px solid rgba(0,0,0,0.1); color:#111111; width:100%; border-radius:12px; padding:14px 16px; font-size:14px; outline:none; transition:all .2s; font-family:inherit; }
                .axso-input::placeholder { color:rgba(0,0,0,0.3); }
                .axso-input:focus { border-color:rgba(245,166,35,0.5); box-shadow:0 0 0 3px rgba(245,166,35,0.08); }
              `}</style>

              <form className="space-y-4" action="mailto:support@axsoafrica.com" method="get">
                <div>
                  <label htmlFor="contact-sujet" className="block text-[#595959] text-xs font-semibold mb-1.5 uppercase tracking-wide">{t("Sujet")}</label>
                  <input id="contact-sujet" type="text" name="subject" required placeholder={t("Support technique, partenariat, presse...")} className="axso-input" />
                </div>
                <div>
                  <label htmlFor="contact-message" className="block text-[#595959] text-xs font-semibold mb-1.5 uppercase tracking-wide">{t("Message")}</label>
                  <textarea id="contact-message" rows={5} name="body" required placeholder={t("Décrivez votre demande en détail...")} className="axso-input" style={{ resize: "none" }} />
                </div>
                <button type="submit"
                  className="w-full font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808", boxShadow: "0 8px 30px rgba(245,166,35,0.25)" }}>
                  {t("Envoyer le message")}{" "}<ArrowRight size={17} />
                </button>
                <p className="text-center text-[#B3B3B3] text-xs flex items-center justify-center gap-1.5">
                  <Shield size={10} />
                  {t("Vos données sont protégées et ne sont jamais partagées.")}
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-28">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-[#111111] text-center mb-10">{t("Questions fréquentes")}</h2>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="rounded-2xl p-6 border"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                <h3 className="font-bold text-[#111111] mb-2 text-sm">{t(item.q)}</h3>
                <p className="text-[#666666] text-sm leading-relaxed">{t(item.r)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
