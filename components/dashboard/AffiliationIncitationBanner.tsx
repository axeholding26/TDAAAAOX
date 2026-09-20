import Link from "next/link";
import { Rocket, ArrowRight } from "lucide-react";

// Incite les marchands sans programme d'affiliation actif à en créer un —
// c'est ce qui alimente le marketplace public /affiliation en produits
// promouvables. Sans ça, le marketplace reste vide de contenu.
export function AffiliationIncitationBanner() {
  return (
    <Link href="/dashboard/affiliation"
      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all hover:opacity-90"
      style={{ background: "rgba(245,166,35,0.06)", borderColor: "rgba(245,166,35,0.22)" }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,166,35,0.14)" }}>
        <Rocket size={16} style={{ color: "#F5A623" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: "#8a5c10" }}>Faites vendre vos produits par d'autres — gratuitement</p>
        <p className="text-xs leading-snug" style={{ color: "rgba(138,92,16,0.75)" }}>
          Activez votre programme d'affiliation : vos produits apparaissent sur le marketplace AXSO, des affiliés les recommandent, vous ne payez qu'à la vente.
        </p>
      </div>
      <span className="flex-shrink-0 text-xs font-bold px-3.5 py-2 rounded-full text-white whitespace-nowrap flex items-center gap-1.5" style={{ background: "#F5A623" }}>
        Activer <ArrowRight size={12} />
      </span>
    </Link>
  );
}
