import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { Lock } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de Confidentialité — AXSO",
};

const SECTIONS = [
  {
    titre: "1. Responsable du traitement",
    contenu: `AXSO Technologies SAS, dont le siège social est situé à Dakar, Sénégal, est responsable du traitement de vos données personnelles. Contact : privacy@axso.app`,
  },
  {
    titre: "2. Données collectées",
    contenu: `Nous collectons : vos coordonnées (nom, email, téléphone WhatsApp), les données de votre boutique (produits, commandes, clients), vos données de navigation sur la plateforme, les informations de paiement (traitées de façon sécurisée par nos partenaires de paiement), et les données de localisation GPS des commandes (avec consentement explicite).`,
  },
  {
    titre: "3. Finalités du traitement",
    contenu: `Vos données sont utilisées pour : la fourniture et l'amélioration de nos services, la gestion de votre compte et de votre boutique, l'envoi de communications transactionnelles (confirmations, factures), l'envoi de communications marketing (avec consentement), la prévention de la fraude et la sécurité de la plateforme, l'amélioration de notre IA Axia.`,
  },
  {
    titre: "4. Base légale du traitement",
    contenu: `Le traitement de vos données est fondé sur : l'exécution du contrat (CGU acceptées), votre consentement explicite (marketing, géolocalisation), notre intérêt légitime (sécurité, amélioration des services), et nos obligations légales.`,
  },
  {
    titre: "5. Partage des données",
    contenu: `Vos données peuvent être partagées avec : nos partenaires de paiement (Wave, Orange Money, Stripe) pour le traitement des transactions, nos partenaires logistiques pour la gestion des livraisons, nos prestataires techniques (hébergement, IA) dans le cadre de contrats conformes au RGPD. Aucune vente de données à des tiers.`,
  },
  {
    titre: "6. Conservation des données",
    contenu: `Vos données sont conservées pendant la durée de votre abonnement, puis 3 ans après la résiliation du compte pour des raisons légales et comptables. Les données de commandes sont conservées 10 ans conformément aux obligations fiscales.`,
  },
  {
    titre: "7. Vos droits",
    contenu: `Conformément au RGPD, vous disposez des droits suivants : accès, rectification, effacement, portabilité, opposition et limitation du traitement. Pour exercer ces droits, contactez privacy@axso.app. Vous pouvez également adresser une réclamation à l'autorité de protection des données compétente.`,
  },
  {
    titre: "8. Cookies et traceurs",
    contenu: `AXSO utilise des cookies essentiels au fonctionnement de la plateforme, des cookies d'analyse (anonymisés) et des cookies de personnalisation. Consultez notre Politique Cookies pour plus d'informations.`,
  },
];

export default function PrivacyPage() {
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
            <Lock size={14} className="inline-block mr-1.5" />Légal
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Politique de Confidentialité</h1>
          <p className="text-[#8C8C8C] text-sm mb-14">Dernière mise à jour : 1er juillet 2026</p>

          <div className="space-y-10">
            {SECTIONS.map(s => (
              <div key={s.titre} className="pb-10 border-b" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
                <h2 className="text-lg font-bold mb-4" style={{ color: "#F5A623" }}>{s.titre}</h2>
                <p className="text-[#595959] leading-relaxed text-sm">{s.contenu}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-2xl p-6 border"
            style={{ background: "rgba(245,166,35,0.04)", borderColor: "rgba(245,166,35,0.15)" }}>
            <p className="text-[#666666] text-sm">Pour toute question relative à vos données personnelles :{" "}
              <a href="mailto:privacy@axso.app" className="font-bold hover:opacity-80" style={{ color: "#F5A623" }}>privacy@axso.app</a>
            </p>
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
