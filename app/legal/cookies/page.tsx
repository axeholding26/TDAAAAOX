import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { Cookie } from "lucide-react";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/serveur";

export const metadata: Metadata = {
  title: "Politique Cookies",
};

// Liste vérifiée dans le code (cookies posés par Auth.js, proxy.ts, app/api/**, LangueSelecteur, DeviseVitrine…).
const COOKIES = [
  { nom: "authjs.session-token", type: "Essentiel", duree: "30 jours", desc: "Maintient votre connexion (préfixé __Secure- en HTTPS)." },
  { nom: "authjs.csrf-token", type: "Essentiel", duree: "Session", desc: "Protège les formulaires de connexion (préfixé __Host- en HTTPS)." },
  { nom: "axso_pos_appareil", type: "Essentiel", duree: "180 jours", desc: "Reconnaît un appareil de caisse autorisé par le marchand." },
  { nom: "axso_oauth_etat", type: "Essentiel", duree: "10 minutes", desc: "Sécurise la connexion d'un outil externe à votre compte." },
  { nom: "langue", type: "Fonctionnel", duree: "1 an", desc: "Mémorise la langue choisie (français ou anglais)." },
  { nom: "axso_pays", type: "Fonctionnel", duree: "1 an", desc: "Mémorise le pays choisi sur une boutique pour afficher les prix dans votre devise." },
  { nom: "axso_apercu", type: "Fonctionnel", duree: "Session", desc: "Affiche l'aperçu de la boutique dans l'éditeur (marchands)." },
  { nom: "axso_brouillon", type: "Fonctionnel", duree: "1 heure", desc: "Donne accès à l'aperçu d'une version brouillon de la boutique (marchands)." },
  { nom: "aff_ref", type: "Mesure", duree: "30 jours (selon le programme)", desc: "Attribue votre commande à l'affilié qui vous a recommandé la boutique." },
  { nom: "axso_xp", type: "Mesure", duree: "1 an", desc: "Nombre aléatoire, sans donnée personnelle, qui fixe la version vue lors d'un test A/B de boutique." },
  { nom: "Pixels Facebook, TikTok, Snapchat, Google", type: "Tiers", duree: "Selon le service", desc: "Ajoutés par certains marchands sur leur boutique uniquement, pour mesurer leurs publicités." },
];

const TYPES: Record<string, { color: string; desc: string }> = {
  Essentiel:   { color: "#F5A623", desc: "Indispensables au fonctionnement : connexion et sécurité." },
  Fonctionnel: { color: "#7c3aed", desc: "Mémorisent vos choix : langue, pays, aperçus." },
  Mesure:      { color: "#0ea5e9", desc: "Attribution des ventes aux affiliés et tests A/B des boutiques." },
  Tiers:       { color: "#10b981", desc: "Déposés par les services publicitaires choisis par un marchand, sur sa boutique seulement." },
};

export default async function CookiesPage() {
  const t = await getT();
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
            <Cookie size={14} className="inline-block mr-1.5" />{t("Légal")}
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{t("Politique Cookies")}</h1>
          <p className="text-[#8C8C8C] text-sm mb-14">{t("Dernière mise à jour : 14 octobre 2026")}</p>

          <div className="prose max-w-none space-y-10">
            <div className="pb-10 border-b" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
              <h2 className="text-lg font-bold mb-4" style={{ color: "#F5A623" }}>{t("Qu'est-ce qu'un cookie ?")}</h2>
              <p className="text-[#595959] leading-relaxed text-sm">{t("Un cookie est un petit fichier texte déposé sur votre appareil lors de la visite d'un site web. AXSO utilise des cookies pour assurer le bon fonctionnement de la plateforme et mémoriser vos préférences.")}</p>
            </div>

            <div className="pb-10 border-b" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
              <h2 className="text-lg font-bold mb-6" style={{ color: "#F5A623" }}>{t("Types de cookies utilisés")}</h2>
              <div className="space-y-4">
                {Object.entries(TYPES).map(([type, info]) => (
                  <div key={type} className="rounded-xl p-4 border"
                    style={{ background: "rgba(0,0,0,0.02)", borderColor: "rgba(0,0,0,0.07)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${info.color}12`, color: info.color, border: `1px solid ${info.color}25` }}>{t(type)}</span>
                    </div>
                    <p className="text-[#666666] text-sm">{t(info.desc)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pb-10 border-b" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
              <h2 className="text-lg font-bold mb-6" style={{ color: "#F5A623" }}>{t("Liste détaillée des cookies")}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                      {["Cookie", "Type", "Durée", "Finalité"].map(h => (
                        <th key={h} className="text-left py-3 pr-4 text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(0,0,0,0.3)" }}>{t(h)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COOKIES.map(c => (
                      <tr key={c.nom} className="border-b" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
                        <td className="py-3 pr-4 font-mono text-xs text-[#444444]">{t(c.nom)}</td>
                        <td className="py-3 pr-4">
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: `${TYPES[c.type]?.color}12`, color: TYPES[c.type]?.color }}>{t(c.type)}</span>
                        </td>
                        <td className="py-3 pr-4 text-[#737373] text-xs">{t(c.duree)}</td>
                        <td className="py-3 text-[#737373] text-xs">{t(c.desc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold mb-4" style={{ color: "#F5A623" }}>{t("Gestion de vos préférences")}</h2>
              <p className="text-[#595959] leading-relaxed text-sm mb-4">
                {t("Vous pouvez gérer vos préférences cookies à tout moment depuis les paramètres de votre navigateur. La désactivation des cookies essentiels peut affecter le fonctionnement de la plateforme.")}
              </p>
              <p className="text-[#595959] leading-relaxed text-sm">
                {t("Pour plus d'informations :")}{" "}<a href="mailto:privacy@axsoafrica.com" className="font-bold hover:opacity-80" style={{ color: "#F5A623" }}>privacy@axsoafrica.com</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
