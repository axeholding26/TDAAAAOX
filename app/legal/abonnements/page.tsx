import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { CreditCard } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions d'abonnement — AXSO",
};

const PLANS = [
  { nom: "Essentiel", prix: "Gratuit", engagement: "Sans engagement", inclus: ["30 commandes/mois", "1 boutique", "Axia essentielle", "Support communauté"], accent: "#6b7280" },
  { nom: "Pro", prix: "6 000 XOF/mois", engagement: "Mensuel, résiliable à tout moment", inclus: ["Commandes illimitées", "Axia avancée", "Analytics", "Support prioritaire"], accent: "#F5A623", popular: true },
  { nom: "Illimité", prix: "20 000 XOF/mois", engagement: "Mensuel, résiliable à tout moment", inclus: ["Tout inclus sans limite", "Axia complète", "Boutiques illimitées", "Support 24/7"], accent: "#7c3aed" },
];

const SECTIONS = [
  {
    titre: "1. Souscription",
    contenu: `L'abonnement à AXSO est souscrit en ligne via notre plateforme. Vous choisissez votre plan au moment de l'inscription ou depuis votre tableau de bord. L'activation est immédiate. Le plan Essentiel est gratuit et sans limite de durée.`,
  },
  {
    titre: "2. Facturation",
    contenu: `Les abonnements payants sont facturés mensuellement, par anticipation, via Mobile Money (Wave, Orange Money, MTN MoMo) ou carte bancaire (Stripe). La facture est émise le 1er de chaque mois et disponible dans votre espace marchand.`,
  },
  {
    titre: "3. Résiliation",
    contenu: `Vous pouvez résilier votre abonnement à tout moment depuis votre tableau de bord (Paramètres > Abonnement > Résilier). La résiliation prend effet à la fin de la période en cours. Aucun remboursement prorata n'est effectué pour le mois en cours, sauf erreur de notre part.`,
  },
  {
    titre: "4. Changement de plan",
    contenu: `Vous pouvez upgrader ou downgrader votre plan à tout moment. L'upgrade est immédiat et proratisé. Le downgrade prend effet à la fin de la période en cours. Un downgrade vers le plan Essentiel est toujours possible gratuitement.`,
  },
  {
    titre: "5. Défaut de paiement",
    contenu: `En cas de défaut de paiement, AXSO adresse une notification et accorde un délai de 7 jours pour régulariser. Passé ce délai, l'accès aux fonctionnalités payantes est suspendu. Les données sont conservées 30 jours supplémentaires pour permettre la régularisation ou l'export.`,
  },
  {
    titre: "6. Modifications tarifaires",
    contenu: `AXSO se réserve le droit de modifier ses tarifs. Toute modification est notifiée 30 jours à l'avance par email. Sans opposition dans ce délai, les nouveaux tarifs s'appliquent. Vous restez libre de résilier si les nouveaux tarifs ne vous conviennent pas.`,
  },
];

export default function AbonnementsPage() {
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
            <CreditCard size={14} className="inline-block mr-1.5" />Légal
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Conditions d'abonnement</h1>
          <p className="text-[#8C8C8C] text-sm mb-14">Dernière mise à jour : 1er juillet 2026</p>

          {/* Plans recap */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
            {PLANS.map(p => (
              <div key={p.nom} className="rounded-2xl border p-5"
                style={{ background: p.popular ? `${p.accent}08` : "rgba(0,0,0,0.02)", borderColor: p.popular ? `${p.accent}25` : "rgba(0,0,0,0.07)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${p.accent}15`, color: p.accent, border: `1px solid ${p.accent}25` }}>{p.nom}</span>
                  {p.popular && <span className="text-xs text-[#999999]">⭐ Populaire</span>}
                </div>
                <p className="text-xl font-black mb-1" style={{ color: p.accent }}>{p.prix}</p>
                <p className="text-[#8C8C8C] text-xs mb-4">{p.engagement}</p>
                <ul className="space-y-1.5">
                  {p.inclus.map(i => (
                    <li key={i} className="text-xs text-[#666666] flex items-center gap-2">
                      <span style={{ color: p.accent }}>✓</span> {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Sections légales */}
          <div className="space-y-10">
            {SECTIONS.map(s => (
              <div key={s.titre} className="pb-10 border-b" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
                <h2 className="text-lg font-bold mb-4" style={{ color: "#F5A623" }}>{s.titre}</h2>
                <p className="text-[#595959] leading-relaxed text-sm">{s.contenu}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 rounded-2xl p-6 border"
              style={{ background: "rgba(245,166,35,0.04)", borderColor: "rgba(245,166,35,0.15)" }}>
              <p className="text-[#666666] text-sm">Questions sur votre abonnement ? <a href="mailto:facturation@axso.app" className="font-bold" style={{ color: "#F5A623" }}>facturation@axso.app</a></p>
            </div>
            <Link href="/#tarifs"
              className="flex-1 rounded-2xl p-6 flex items-center justify-center font-bold text-center transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808" }}>
              Voir les plans →
            </Link>
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
