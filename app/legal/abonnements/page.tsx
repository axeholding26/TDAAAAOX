import { NavbarMarketing } from "@/components/marketing/NavbarMarketing";
import { FooterMarketing } from "@/components/marketing/FooterMarketing";
import { CreditCard } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/serveur";

export const metadata: Metadata = {
  title: "Conditions d'abonnement",
};

const SUPPORT = "Support WhatsApp (lun-ven, 8h-20h)";
const PLANS = [
  { nom: "Essentiel", prix: "Gratuit", engagement: "Sans engagement ni limite de durée", inclus: ["60 commandes/mois", "1 boutique", "Axia essentielle", SUPPORT], accent: "#6b7280" },
  { nom: "Pro", prix: "6 000 FCFA / 30 jours", engagement: "Prépayé, sans renouvellement automatique", inclus: ["Commandes illimitées", "Axia avancée", "Analytics avancés", SUPPORT], accent: "#F5A623", popular: true },
  { nom: "Illimité", prix: "20 000 FCFA / 30 jours", engagement: "Prépayé, sans renouvellement automatique", inclus: ["Tout inclus sans limite", "Axia complète", "Boutiques illimitées", SUPPORT], accent: "#7c3aed" },
];

// Reflète lib/abonnement.ts (planActif, expirationApresPaiement) et lib/abonnement-paiement.ts (30 jours, XAF).
const SECTIONS = [
  {
    titre: "1. Souscription",
    contenu: `Vous choisissez votre plan depuis votre tableau de bord (Abonnement). Le plan Essentiel est gratuit, sans limite de durée, et permet jusqu'à 60 commandes par mois calendaire. Les plans Pro et Illimité sont activés dès la confirmation de votre paiement. L'abonnement vaut pour votre compte : toutes les boutiques dont vous êtes propriétaire bénéficient du meilleur plan en cours.`,
  },
  {
    titre: "2. Paiement",
    contenu: `Les plans payants sont prépayés pour 30 jours, en FCFA, via NotchPay par Orange Money ou MTN Mobile Money. Il n'y a aucun prélèvement automatique : rien n'est débité sans une action de votre part, et il n'y a donc rien à résilier. Pour continuer après 30 jours, vous effectuez simplement un nouveau paiement.`,
  },
  {
    titre: "3. Renouvellement",
    contenu: `Si vous renouvelez le même plan avant son expiration, les 30 nouveaux jours s'ajoutent aux jours qu'il vous restait : vous ne perdez aucun jour payé.`,
  },
  {
    titre: "4. Changement de plan",
    contenu: `Passer à un autre plan payant prend effet dès la confirmation du paiement, pour 30 jours à compter de ce jour. Ce changement n'est pas proratisé : les jours restants du plan précédent ne sont ni reportés ni remboursés. Revenir au plan Essentiel est gratuit et immédiat depuis votre tableau de bord ; les jours payés restants sont alors perdus.`,
  },
  {
    titre: "5. Fin de la période payée",
    contenu: `À la fin des 30 jours, si vous n'avez pas renouvelé, votre compte repasse automatiquement au plan Essentiel. Vos boutiques, produits et commandes sont conservés ; les limites du plan Essentiel s'appliquent de nouveau, notamment 60 commandes par mois. Vous pouvez reprendre un plan payant à tout moment.`,
  },
  {
    titre: "6. Modifications tarifaires",
    contenu: `AXSO peut faire évoluer ses tarifs. Une période déjà payée n'est jamais affectée : un nouveau tarif ne s'applique qu'aux paiements suivants.`,
  },
];

export default async function AbonnementsPage() {
  const t = await getT();
  return (
    <main className="bg-white text-[#111111] min-h-screen" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <NavbarMarketing />

      <section className="pt-36 pb-24 px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block text-xs font-bold uppercase tracking-[0.2em] mb-5" style={{ color: "#F5A623" }}>
            <CreditCard size={14} className="inline-block mr-1.5" />{t("Légal")}
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{t("Conditions d'abonnement")}</h1>
          <p className="text-[#8C8C8C] text-sm mb-14">{t("Dernière mise à jour : 14 octobre 2026")}</p>

          {/* Plans recap */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16">
            {PLANS.map(p => (
              <div key={p.nom} className="rounded-2xl border p-5"
                style={{ background: p.popular ? `${p.accent}08` : "rgba(0,0,0,0.02)", borderColor: p.popular ? `${p.accent}25` : "rgba(0,0,0,0.07)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${p.accent}15`, color: p.accent, border: `1px solid ${p.accent}25` }}>{t(p.nom)}</span>
                  {p.popular && <span className="text-xs text-[#999999]">{t("⭐ Populaire")}</span>}
                </div>
                <p className="text-xl font-black mb-1" style={{ color: p.accent }}>{t(p.prix)}</p>
                <p className="text-[#8C8C8C] text-xs mb-4">{t(p.engagement)}</p>
                <ul className="space-y-1.5">
                  {p.inclus.map(i => (
                    <li key={i} className="text-xs text-[#666666] flex items-center gap-2">
                      <span style={{ color: p.accent }}>✓</span> {t(i)}
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
                <h2 className="text-lg font-bold mb-4" style={{ color: "#F5A623" }}>{t(s.titre)}</h2>
                <p className="text-[#595959] leading-relaxed text-sm">{t(s.contenu)}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 rounded-2xl p-6 border"
              style={{ background: "rgba(245,166,35,0.04)", borderColor: "rgba(245,166,35,0.15)" }}>
              <p className="text-[#666666] text-sm">{t("Questions sur votre abonnement ?")}{" "}<a href="mailto:facturation@axsoafrica.com" className="font-bold" style={{ color: "#F5A623" }}>facturation@axsoafrica.com</a></p>
            </div>
            <Link href="/#tarifs"
              className="flex-1 rounded-2xl p-6 flex items-center justify-center font-bold text-center transition-all hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808" }}>
              {t("Voir les plans →")}
            </Link>
          </div>
        </div>
      </section>

      <FooterMarketing />
    </main>
  );
}
