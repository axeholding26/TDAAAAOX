import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { Cookie } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique Cookies — AXSO",
};

const COOKIES = [
  { nom: "session_token", type: "Essentiel", duree: "Session", desc: "Maintient votre session de connexion. Nécessaire au fonctionnement." },
  { nom: "csrf_token", type: "Essentiel", duree: "Session", desc: "Protection contre les attaques CSRF. Nécessaire à la sécurité." },
  { nom: "tenant_pref", type: "Fonctionnel", duree: "1 an", desc: "Mémorise vos préférences d'interface (langue, thème)." },
  { nom: "_axso_analytics", type: "Analyse", duree: "13 mois", desc: "Statistiques d'utilisation anonymisées pour améliorer la plateforme." },
  { nom: "cart_id", type: "Fonctionnel", duree: "30 jours", desc: "Sauvegarde le contenu de votre panier." },
];

const TYPES: Record<string, { color: string; desc: string }> = {
  Essentiel:   { color: "#F5A623", desc: "Indispensables au fonctionnement — ne peuvent pas être refusés." },
  Fonctionnel: { color: "#7c3aed", desc: "Améliorent votre expérience — peuvent être désactivés." },
  Analyse:     { color: "#0ea5e9", desc: "Statistiques anonymisées — peuvent être refusés." },
};

export default function CookiesPage() {
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
            <Cookie size={14} className="inline-block mr-1.5" />Légal
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Politique Cookies</h1>
          <p className="text-[#8C8C8C] text-sm mb-14">Dernière mise à jour : 1er juillet 2026</p>

          <div className="prose max-w-none space-y-10">
            <div className="pb-10 border-b" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
              <h2 className="text-lg font-bold mb-4" style={{ color: "#F5A623" }}>Qu'est-ce qu'un cookie ?</h2>
              <p className="text-[#595959] leading-relaxed text-sm">Un cookie est un petit fichier texte déposé sur votre appareil lors de la visite d'un site web. AXSO utilise des cookies pour assurer le bon fonctionnement de la plateforme, mémoriser vos préférences et analyser l'utilisation de nos services de façon anonymisée.</p>
            </div>

            <div className="pb-10 border-b" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
              <h2 className="text-lg font-bold mb-6" style={{ color: "#F5A623" }}>Types de cookies utilisés</h2>
              <div className="space-y-4">
                {Object.entries(TYPES).map(([type, info]) => (
                  <div key={type} className="rounded-xl p-4 border"
                    style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${info.color}12`, color: info.color, border: `1px solid ${info.color}25` }}>{type}</span>
                    </div>
                    <p className="text-[#666666] text-sm">{info.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pb-10 border-b" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
              <h2 className="text-lg font-bold mb-6" style={{ color: "#F5A623" }}>Liste détaillée des cookies</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                      {["Cookie", "Type", "Durée", "Finalité"].map(h => (
                        <th key={h} className="text-left py-3 pr-4 text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(0,0,0,0.3)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COOKIES.map(c => (
                      <tr key={c.nom} className="border-b" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
                        <td className="py-3 pr-4 font-mono text-xs text-[#444444]">{c.nom}</td>
                        <td className="py-3 pr-4">
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: `${TYPES[c.type]?.color}12`, color: TYPES[c.type]?.color }}>{c.type}</span>
                        </td>
                        <td className="py-3 pr-4 text-[#737373] text-xs">{c.duree}</td>
                        <td className="py-3 text-[#737373] text-xs">{c.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold mb-4" style={{ color: "#F5A623" }}>Gestion de vos préférences</h2>
              <p className="text-[#595959] leading-relaxed text-sm mb-4">
                Vous pouvez gérer vos préférences cookies à tout moment depuis les paramètres de votre navigateur. La désactivation des cookies essentiels peut affecter le fonctionnement de la plateforme.
              </p>
              <p className="text-[#595959] leading-relaxed text-sm">
                Pour plus d'informations : <a href="mailto:privacy@axso.app" className="font-bold hover:opacity-80" style={{ color: "#F5A623" }}>privacy@axso.app</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
