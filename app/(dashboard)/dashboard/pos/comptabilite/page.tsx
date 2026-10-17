"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, ShoppingBag, PiggyBank,
  Package, BarChart3, Calendar,
} from "lucide-react";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

import { useDevise } from "@/components/dashboard/DeviseProvider";
import { useT } from "@/components/I18nProvider";
import { EtatPos } from "@/components/pos/ui";
import { appelPos } from "@/components/pos/caisse/api";
const COMPTA_TUTORIAL_STEPS = [
  { Icon: BarChart3,  titre: "Bénéfice brut vs net",  description: "Le bénéfice brut, c'est ton revenu moins le coût d'achat des produits vendus. Le bénéfice net va plus loin : il retire aussi ta part des charges d'exploitation (loyer, salaires...)." },
  { Icon: ShoppingBag, titre: "Rentabilité par produit", description: "Vois quels produits te rapportent vraiment, une fois le coût d'achat ET la quote-part des charges pris en compte — pas juste le chiffre d'affaires." },
  { Icon: PiggyBank,   titre: "Fonds généraux",        description: "Le solde net cumulé de toute ton activité en boutique physique — entrées moins charges, depuis le début." },
];

interface ProduitRentabilite {
  produitId: string; nom: string; image: string | null;
  quantiteVendue: number; revenu: number; cout: number;
  beneficeBrut: number; beneficeBrutPct: number;
  quotePartCharges: number; beneficeNet: number; beneficeNetPct: number;
}

const PERIODES = [
  { v: "mois", l: "Ce mois-ci" },
  { v: "semaine", l: "7 derniers jours" },
  { v: "annee", l: "Cette année" },
];

function plage(periode: string): { debut: string; fin: string } {
  const now = new Date();
  const fin = now.toISOString();
  let debut: Date;
  if (periode === "semaine") debut = new Date(now.getTime() - 7 * 86400000);
  else if (periode === "annee") debut = new Date(now.getFullYear(), 0, 1);
  else debut = new Date(now.getFullYear(), now.getMonth(), 1);
  return { debut: debut.toISOString(), fin };
}

function CardResume({ label, value, Icon, color, sub }: { label: string; value: string; Icon: any; color: string; sub?: string }) {
  const t = useT();
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-[20px] font-bold text-[#111] leading-none break-words">{value}</p>
      <p className="text-[11px] text-gray-400 mt-1">{t(label)}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color }}>{t(sub)}</p>}
    </div>
  );
}

export default function ComptabilitePage() {
  const t = useT();
  const { fmt } = useDevise();
  const [periode, setPeriode] = useState("mois");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    const { debut, fin } = plage(periode);
    const r = await appelPos(`/api/pos/comptabilite?debut=${debut}&fin=${fin}`);
    if (r.ok) { setData(r.donnees); setErreur(null); } else setErreur({ code: r.code, message: r.message });
    setLoading(false);
  }, [periode]);

  useEffect(() => { void charger(); }, [charger]);

  if (erreur) return <div className="p-5 max-w-5xl mx-auto"><EtatPos code={erreur.code} message={erreur.message} onReessayer={() => void charger()} /></div>;

  if (loading || !data) {
    return <div className="p-5 max-w-5xl mx-auto py-20 text-center text-sm text-gray-400" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>{t("Chargement…")}</div>;
  }

  const r = data.resume;
  const resultatPositif = r.beneficeNet >= 0;

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <ModuleTutorial moduleKey="pos-comptabilite" titre={t("Comptabilité")} sousTitre={t("Module Point de vente")} steps={COMPTA_TUTORIAL_STEPS} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-bold text-[#111] inline-flex items-center gap-2"><BarChart3 size={17} className="text-[#F5A623]" />{" "}{t("Comptabilité boutique")}</h1>
            <BoutonRevoirTutoriel moduleKey="pos-comptabilite" />
          </div>
          <p className="text-[12px] text-gray-500">{t("Rentabilité, entrées, charges et fonds généraux de la vente physique")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 rounded-2xl p-1">
          {PERIODES.map(p => (
            <button key={p.v} onClick={() => setPeriode(p.v)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1 ${periode === p.v ? "bg-white shadow-sm text-[#111]" : "text-gray-500"}`}>
              <Calendar size={10} /> {t(p.l)}
            </button>
          ))}
        </div>
      </div>

      {/* Bénéfice net — carte hero */}
      {/* Positif : jaune AXSO, texte noir (lisible) ; négatif : rouge, texte blanc. */}
      <div className={`rounded-2xl p-6 ${resultatPositif ? "text-[#111111]" : "text-white"}`} style={{ background: resultatPositif ? "linear-gradient(135deg,#F5A623,#D4911A)" : "linear-gradient(135deg,#ef4444,#dc2626)" }}>
        <p className="text-[11px] font-semibold opacity-70 uppercase tracking-widest mb-1">{t("Bénéfice net de la période")}</p>
        <p className="text-[26px] sm:text-[32px] font-black flex items-center gap-2 break-all">
          {resultatPositif ? <TrendingUp size={26} /> : <TrendingDown size={26} />}
          {fmt(r.beneficeNet)}
        </p>
        <p className="text-[12px] opacity-70 mt-1">
          {fmt(r.revenuHT ?? r.revenu)}{" "}{t("de revenu hors taxes −")}{" "}{fmt(r.coutMarchandises)}{" "}{t("de coût d'achat −")}{" "}{fmt(r.chargesExploitation)}{" "}{t("de charges d'exploitation")}
        </p>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <CardResume label={t("Chiffre d'affaires")} value={`${fmt(r.revenu)}`} Icon={Wallet} color="#1B2A4A" sub={t("{0} vente(s)", r.nombreVentes)} />
        <CardResume label={t("Coût d'achat marchandises")} value={`${fmt(r.coutMarchandises)}`} Icon={Package} color="#8b5cf6" />
        <CardResume label={t("Bénéfice brut")} value={`${fmt(r.beneficeBrut)}`} Icon={ShoppingBag} color="#10b981" sub="Avant charges d'exploitation" />
        <CardResume label={t("Charges d'exploitation")} value={`${fmt(r.chargesExploitation)}`} Icon={TrendingDown} color="#ef4444" />
      </div>

      {/* Taxes, remises, retours — déjà pris en compte dans le chiffre d'affaires */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CardResume label={t("Taxes collectées (comprises dans le chiffre d'affaires)")} value={`${fmt(r.taxes ?? 0)}`} Icon={Wallet} color="#1B2A4A" />
        <CardResume label={t("Remises accordées (déjà déduites)")} value={`${fmt(r.remises ?? 0)}`} Icon={TrendingDown} color="#F5A623" />
        <CardResume label={t("Retours d'articles (déjà déduits)")} value={`${fmt(r.retours ?? 0)}`} Icon={TrendingDown} color="#ef4444" />
      </div>

      {(data.approximation?.lignesCoutActuel > 0 || data.approximation?.lignesSansCout > 0) && (
        <p role="note" className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-800">
          {t("Marge approchée.")}{" "}
          {data.approximation.lignesCoutActuel > 0 && <>{data.approximation.lignesCoutActuel}{" "}{t("ligne(s) vendue(s) avant la caisse 2.0 n'ont pas de coût figé : le coût actuel du produit est utilisé à la place.")}{" "}</>}
          {data.approximation.lignesSansCout > 0 && <>{data.approximation.lignesSansCout}{" "}{t("ligne(s) concernent un produit sans prix d'achat : leur coût est compté à zéro.")}</>}
        </p>
      )}

      {/* Fonds généraux cumulés */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <p className="text-[12.5px] font-bold text-[#111] mb-4 flex items-center gap-1.5"><PiggyBank size={14} className="text-[#F5A623]" />{" "}{t("Fonds généraux (tout historique)")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <p className="text-[16px] font-bold text-green-600">{fmt(data.fondsGeneraux.entreesTotales)}</p>
            <p className="text-[10.5px] text-gray-400">{t("Entrées totales")}</p>
          </div>
          <div>
            <p className="text-[16px] font-bold text-red-500">{fmt(data.fondsGeneraux.chargesTotales)}</p>
            <p className="text-[10.5px] text-gray-400">{t("Charges totales")}</p>
          </div>
          <div>
            <p className="text-[16px] font-bold text-[#111]">{fmt(data.fondsGeneraux.soldeNet)}</p>
            <p className="text-[10.5px] text-gray-400">{t("Solde net")}</p>
          </div>
        </div>
      </div>

      {/* Rentabilité par produit */}
      <div>
        <p className="text-[12.5px] font-bold text-[#111] mb-1">{t("Rentabilité par produit")}</p>
        <p className="text-[11px] text-gray-400 mb-2">{t("Bénéfice net = bénéfice brut − quote-part des charges d'exploitation, répartie au prorata du revenu de chaque produit")}</p>
        {data.parProduit.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-2xl">{t("Aucune vente sur cette période")}</div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
            {data.parProduit.map((p: ProduitRentabilite) => (
              <div key={p.produitId} className="p-3.5">
                <div className="flex items-center gap-3">
                  {p.image ? <img src={p.image} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" /> : <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><Package size={14} className="text-gray-300" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-[#111] truncate">{t(p.nom)}</p>
                    <p className="text-[10.5px] text-gray-400">{p.quantiteVendue}{" "}{t("vendu(s) ·")}{" "}{fmt(p.revenu)}{" "}{t("de revenu ·")}{" "}{fmt(p.cout)}{" "}{t("de coût d'achat")}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[13px] font-bold" style={{ color: p.beneficeNet >= 0 ? "#10b981" : "#ef4444" }}>{fmt(p.beneficeNet)}</p>
                    <p className="text-[10px] text-gray-400">{p.beneficeNetPct}{t("% net")}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 pl-12 text-[10.5px]">
                  <span className="text-gray-400">{t("Brut :")}{" "}<strong style={{ color: p.beneficeBrut >= 0 ? "#10b981" : "#ef4444" }}>{fmt(p.beneficeBrut)}</strong> ({p.beneficeBrutPct}%)</span>
                  <span className="text-gray-400">{t("Charges allouées :")}{" "}<strong className="text-red-400">-{fmt(p.quotePartCharges)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Charges par catégorie */}
      {Object.keys(data.parCategorieCharge).length > 0 && (
        <div>
          <p className="text-[12.5px] font-bold text-[#111] mb-2">{t("Charges par catégorie")}</p>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2.5">
            {Object.entries(data.parCategorieCharge).map(([cat, montant]: [string, any]) => {
              const pct = r.chargesExploitation > 0 ? Math.round((montant / r.chargesExploitation) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="capitalize text-gray-600">{t(cat)}</span>
                    <span className="font-bold text-[#111]">{fmt(montant)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#F5A623] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
