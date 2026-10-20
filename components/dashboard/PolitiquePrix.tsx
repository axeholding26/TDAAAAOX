"use client";
// Rappel de la politique de prix sous le champ prix d'un produit : ce que le client paiera et ce
// que le marchand garde (calcul de lib/pricing.ts, texte complet sur /legal/politique-prix).
import Link from "next/link";
import { Info } from "lucide-react";
import { prixClient, TYPES_NUMERIQUES } from "@/lib/pricing";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { useT } from "@/components/I18nProvider";

// ponytail: taux de base de toutes les boutiques (Tenant.commissionRate = 0,10) ; le lire de la boutique si un taux négocié apparaît.
const TAUX = 0.1;

export function PolitiquePrix({ prix, type }: { prix: string | number; type: string }) {
  const tr = useT();
  const { fmt } = useDevise();
  const p = Number(prix) || 0;
  const numerique = TYPES_NUMERIQUES.has(type);
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-[12px] leading-relaxed text-[#92400E]">
      <Info size={14} className="mt-0.5 flex-shrink-0" />
      <div>
        {numerique ? (
          <p>{p > 0
            ? tr("Le client paiera {0} : votre prix + 13 % (10 % AXSO, 3 % NotchPay). Vous recevez {1}.", fmt(prixClient(p, TAUX, type)), fmt(p))
            : tr("Produit numérique : la plateforme ajoute 13 % à votre prix (10 % AXSO, 3 % NotchPay). Le client les paie, vous gardez votre prix.")}</p>
        ) : (
          <p>{p > 0
            ? tr("Payé à la livraison : le client paie {0}, sans commission. Payé en ligne : il paie {1}, votre prix + 10 % (7 % AXSO, 3 % NotchPay). Vous recevez toujours {0}.", fmt(p), fmt(prixClient(p, TAUX, "en_ligne")))
            : tr("Produit physique : rien n'est ajouté s'il est payé à la livraison ; payé en ligne, la plateforme ajoute 10 % (7 % AXSO, 3 % NotchPay). Vous gardez toujours votre prix.")}</p>
        )}
        <Link href="/legal/politique-prix" target="_blank" className="font-semibold underline">{tr("Politique de prix")}</Link>
      </div>
    </div>
  );
}
