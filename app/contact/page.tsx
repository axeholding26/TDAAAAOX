import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { MessageCircle, Mail, Phone, Clock, MapPin, ArrowRight, Shield } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — AXSO",
  description: "Contactez l'équipe AXSO. Support, partenariats, presse : nous répondons en moins de 24h.",
};

const CHANNELS = [
  {
    Icon: MessageCircle,
    titre: "Chat en direct",
    desc: "Réponse en quelques minutes pendant les heures ouvrées",
    lien: "#",
    label: "Ouvrir le chat",
    accent: "#F5A623",
  },
  {
    Icon: Mail,
    titre: "Email support",
    desc: "support@axso.app · Réponse garantie en 24h",
    lien: "mailto:support@axso.app",
    label: "Envoyer un email",
    accent: "#7c3aed",
  },
  {
    Icon: Phone,
    titre: "WhatsApp Business",
    desc: "+221 77 000 00 00 · Lun–Ven 8h–20h",
    lien: "https://wa.me/221770000000",
    label: "Envoyer un message",
    accent: "#25D366",
  },
];

const FAQ = [
  { q: "Puis-je tester AXSO gratuitement ?", r: "Oui, le plan Essentiel est gratuit pour toujours. Aucune carte bancaire requise pour démarrer." },
  { q: "AXSO fonctionne-t-il dans mon pays ?", r: "AXSO est disponible dans 12 pays africains : Sénégal, Côte d'Ivoire, Cameroun, Mali, Togo, Burkina Faso, Guinée, Ghana, Bénin, Niger, RDC, Maroc." },
  { q: "Comment fonctionne l'IA Axia ?", r: "Axia est un agent conversationnel qui exécute de vraies actions dans votre boutique — créer des produits, répondre aux clients, analyser vos ventes — sans formation technique." },
  { q: "Puis-je migrer depuis une autre plateforme ?", r: "Notre équipe vous accompagne gratuitement pour migrer vos produits, clients et commandes depuis Shopify, WooCommerce ou votre boutique actuelle." },
];

export default function ContactPage() {
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
            <Mail size={11} /> Contactez-nous
          </span>
          <h1 className="text-4xl sm:text-5xl font-black mb-5 leading-tight">
            Une question ?<br />
            <span style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Nous sommes là.
            </span>
          </h1>
          <p className="text-[#666666] text-lg leading-relaxed">
            Notre équipe répond en moins de 24h ouvrées. Pour les urgences, le chat en direct est disponible dès 8h.
          </p>
        </div>
      </section>

      {/* ── Channels ── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-20">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5 mb-24">
          {CHANNELS.map(({ Icon, titre, desc, lien, label, accent }) => (
            <a key={titre} href={lien} target={lien.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="group rounded-3xl p-7 border transition-all duration-300 hover:-translate-y-1 block"
              style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-all group-hover:scale-110"
                style={{ background: `${accent}12`, border: `1px solid ${accent}25` }}>
                <Icon size={22} style={{ color: accent }} />
              </div>
              <h3 className="font-bold text-[#111111] mb-1.5">{titre}</h3>
              <p className="text-[#808080] text-sm mb-5 leading-relaxed">{desc}</p>
              <span className="text-xs font-bold px-4 py-2 rounded-full inline-flex items-center gap-1.5 transition-all group-hover:scale-105"
                style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}25` }}>
                {label} <ArrowRight size={11} />
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
                <h3 className="font-bold text-[#111111] text-sm">Horaires d'assistance</h3>
              </div>
              <div className="space-y-2 text-sm text-[#666666]">
                <div className="flex justify-between"><span>Lun – Ven</span><span className="text-[#444444]">08h00 – 20h00</span></div>
                <div className="flex justify-between"><span>Samedi</span><span className="text-[#444444]">09h00 – 17h00</span></div>
                <div className="flex justify-between"><span>Dimanche</span><span className="text-[#8C8C8C]">Fermé</span></div>
              </div>
            </div>

            <div className="rounded-2xl p-6 border" style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.1)" }}>
                  <MapPin size={16} style={{ color: "#7c3aed" }} />
                </div>
                <h3 className="font-bold text-[#111111] text-sm">Localisation</h3>
              </div>
              <p className="text-[#666666] text-sm leading-relaxed">Dakar, Sénégal<br />Équipe distribuée sur 12 pays</p>
            </div>

            <div className="rounded-2xl p-6 border" style={{ background: "rgba(37,211,102,0.04)", borderColor: "rgba(37,211,102,0.15)" }}>
              <h3 className="font-bold text-[#111111] text-sm mb-2">Partenariats & Presse</h3>
              <p className="text-[#737373] text-xs leading-relaxed mb-3">Pour les demandes médias, partenariats ou investisseurs :</p>
              <a href="mailto:hello@axso.app" className="text-xs font-bold" style={{ color: "#F5A623" }}>hello@axso.app →</a>
            </div>
          </div>

          {/* Formulaire */}
          <div className="lg:col-span-3">
            <div className="rounded-3xl p-8 border"
              style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(245,166,35,0.15)" }}>
              <h2 className="text-2xl font-black mb-1 text-[#111111]">Envoyer un message</h2>
              <p className="text-[#808080] text-sm mb-7">Nous répondons sous 24h en jours ouvrés.</p>

              <style>{`
                .axso-input { background:#fff; border:1px solid rgba(0,0,0,0.1); color:#111111; width:100%; border-radius:12px; padding:14px 16px; font-size:14px; outline:none; transition:all .2s; font-family:inherit; }
                .axso-input::placeholder { color:rgba(0,0,0,0.3); }
                .axso-input:focus { border-color:rgba(245,166,35,0.5); box-shadow:0 0 0 3px rgba(245,166,35,0.08); }
              `}</style>

              <form className="space-y-4" action="mailto:support@axso.app" method="get">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#595959] text-xs font-semibold mb-1.5 uppercase tracking-wide">Prénom</label>
                    <input type="text" name="fname" placeholder="Aminata" className="axso-input" />
                  </div>
                  <div>
                    <label className="block text-[#595959] text-xs font-semibold mb-1.5 uppercase tracking-wide">Nom</label>
                    <input type="text" name="lname" placeholder="Diallo" className="axso-input" />
                  </div>
                </div>
                <div>
                  <label className="block text-[#595959] text-xs font-semibold mb-1.5 uppercase tracking-wide">Email</label>
                  <input type="email" name="email" placeholder="aminata@example.com" className="axso-input" />
                </div>
                <div>
                  <label className="block text-[#595959] text-xs font-semibold mb-1.5 uppercase tracking-wide">Sujet</label>
                  <input type="text" name="subject" placeholder="Support technique, partenariat, presse..." className="axso-input" />
                </div>
                <div>
                  <label className="block text-[#595959] text-xs font-semibold mb-1.5 uppercase tracking-wide">Message</label>
                  <textarea rows={5} name="body" placeholder="Décrivez votre demande en détail..." className="axso-input" style={{ resize: "none" }} />
                </div>
                <button type="submit"
                  className="w-full font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808", boxShadow: "0 8px 30px rgba(245,166,35,0.25)" }}>
                  Envoyer le message <ArrowRight size={17} />
                </button>
                <p className="text-center text-[#B3B3B3] text-xs flex items-center justify-center gap-1.5">
                  <Shield size={10} />
                  Vos données sont protégées et ne sont jamais partagées.
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-6 sm:px-10 lg:px-16 xl:px-24 pb-28">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-[#111111] text-center mb-10">Questions fréquentes</h2>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="rounded-2xl p-6 border"
                style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                <h3 className="font-bold text-[#111111] mb-2 text-sm">{item.q}</h3>
                <p className="text-[#666666] text-sm leading-relaxed">{item.r}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
