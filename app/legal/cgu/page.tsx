import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — AXSO",
};

const SECTIONS = [
  {
    titre: "1. Objet",
    contenu: `Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme AXSO, éditée par AXSO Technologies SAS, ci-après dénommée "AXSO". En accédant à la plateforme, vous acceptez sans réserve les présentes CGU.`,
  },
  {
    titre: "2. Accès à la plateforme",
    contenu: `L'accès à AXSO est réservé aux personnes physiques ou morales ayant la capacité juridique de contracter. L'inscription est gratuite et sans engagement. AXSO se réserve le droit de suspendre ou résilier tout compte ne respectant pas les présentes CGU.`,
  },
  {
    titre: "3. Services proposés",
    contenu: `AXSO propose une plateforme SaaS permettant la création et la gestion de boutiques en ligne, incluant : la gestion de catalogue produits, le traitement des paiements via Mobile Money et cartes bancaires, la gestion logistique et de livraison, des outils de marketing et d'analyse, une assistance par intelligence artificielle (Axia).`,
  },
  {
    titre: "4. Obligations de l'utilisateur",
    contenu: `L'utilisateur s'engage à : fournir des informations exactes lors de l'inscription, ne pas utiliser la plateforme à des fins illicites, respecter les droits de propriété intellectuelle, ne pas tenter de nuire au fonctionnement de la plateforme, signaler tout incident de sécurité à security@axso.app.`,
  },
  {
    titre: "5. Tarification et facturation",
    contenu: `AXSO propose plusieurs plans tarifaires. Le plan Essentiel est gratuit. Les plans Pro et Illimité font l'objet d'un abonnement mensuel prélevé par anticipation. Les prix sont affichés en FCFA et peuvent être convertis en EUR. Toute modification tarifaire est notifiée 30 jours à l'avance.`,
  },
  {
    titre: "6. Données personnelles",
    contenu: `AXSO traite les données personnelles conformément au RGPD et aux législations africaines applicables. Pour toute demande relative à vos données, contactez privacy@axso.app. Consultez notre Politique de Confidentialité pour plus d'informations.`,
  },
  {
    titre: "7. Limitation de responsabilité",
    contenu: `AXSO ne saurait être tenu responsable des dommages indirects résultant de l'utilisation de la plateforme. La responsabilité d'AXSO est limitée au montant des sommes versées par l'utilisateur au cours des 12 derniers mois.`,
  },
  {
    titre: "8. Droit applicable",
    contenu: `Les présentes CGU sont régies par le droit sénégalais. Tout litige relève de la compétence exclusive des tribunaux de Dakar, sauf disposition légale contraire.`,
  },
];

export default function CguPage() {
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
            ⚖️ Légal
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Conditions Générales d'Utilisation</h1>
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
            <p className="text-[#666666] text-sm">Des questions sur ces conditions ? Contactez-nous à{" "}
              <a href="mailto:legal@axso.app" className="font-bold hover:opacity-80" style={{ color: "#F5A623" }}>legal@axso.app</a>
            </p>
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
