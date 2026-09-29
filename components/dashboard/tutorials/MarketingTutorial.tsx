"use client";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";
import { Tag, Mail, Target, TrendingUp } from "lucide-react";
import { useT } from "@/components/I18nProvider";

const MARKETING_TUTORIAL_STEPS = [
  { Icon: Tag,        titre: "Codes promo",         description: "Créez des remises en pourcentage ou en montant fixe pour fidéliser vos clients et booster vos ventes." },
  { Icon: Mail,        titre: "Email marketing",      description: "Envoyez des campagnes ciblées à votre base clients directement depuis votre boutique." },
  { Icon: Target,       titre: "Tracking & pixels",     description: "Branchez Meta, TikTok, Snapchat ou Google Tag Manager pour mesurer vos publicités." },
  { Icon: TrendingUp,   titre: "SEO & visibilité",       description: "Optimisez vos fiches produits pour attirer plus de visiteurs depuis les moteurs de recherche." },
];

export function MarketingTutorial() {
  const t = useT();
  return <ModuleTutorial moduleKey="marketing" titre={t("Marketing")} sousTitre={t("Codes promo, email, publicité")} steps={MARKETING_TUTORIAL_STEPS} />;
}
