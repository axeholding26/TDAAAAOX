"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, ShoppingBag, PiggyBank,
  Package, BarChart3, Calendar,
} from "lucide-react";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

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
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-[20px] font-bold text-[#111] leading-none">{value}</p>
      <p className="text-[11px] text-gray-400 mt-1">{label}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color }}>{sub}</p>}
    </div>
  );
}

export default function ComptabilitePage() {
  const [periode, setPeriode] = useState("mois");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const charger = useCallback(() => {
    setLoading(true);
    const { debut, fin } = plage(periode);
    fetch(`/api/pos/comptabilite?debut=${debut}&fin=${fin}`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [periode]);

  useEffect(() => { charger(); }, [charger]);

  if (loading || !data) {
    return <div className="p-5 max-w-5xl mx-auto py-20 text-center text-sm text-gray-400" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>Chargement…</div>;
  }

  const r = data.resume;
  const resultatPositif = r.beneficeNet >= 0;

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <ModuleTutorial moduleKey="pos-comptabilite" titre="Comptabilité" sousTitre="Module Point de vente" steps={COMPTA_TUTORIAL_STEPS} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-bold text-[#111] inline-flex items-center gap-2"><BarChart3 size={17} className="text-[#F5A623]" /> Comptabilité boutique</h1>
            <BoutonRevoirTutoriel moduleKey="pos-comptabilite" />
          </div>
          <p className="text-[12px] text-gray-500">Rentabilité, entrées, charges et fonds généraux de la vente physique</p>
        </div>
        <div className="flex items-center gap-1.5 bg-gray-100 rounded-2xl p-1">
          {PERIODES.map(p => (
            <button key={p.v} onClick={() => setPeriode(p.v)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1 ${periode === p.v ? "bg-white shadow-sm text-[#111]" : "text-gray-500"}`}>
              <Calendar size={10} /> {p.l}
            </button>
          ))}
        </div>
      </div>

      {/* Bénéfice net — carte hero */}
      <div className="rounded-2xl p-6" style={{ background: resultatPositif ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#ef4444,#dc2626)" }}>
        <p className="text-[11px] font-semibold text-white/70 uppercase tracking-widest mb-1">Bénéfice net de la période</p>
        <p className="text-[32px] font-black text-white flex items-center gap-2">
          {resultatPositif ? <TrendingUp size={26} /> : <TrendingDown size={26} />}
          {r.beneficeNet.toLocaleString()} XAF
        </p>
        <p className="text-[12px] text-white/70 mt-1">
          {r.revenu.toLocaleString()} XAF de revenu − {r.coutMarchandises.toLocaleString()} XAF de coût d'achat − {r.chargesExploitation.toLocaleString()} XAF de charges d'exploitation
        </p>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CardResume label="Chiffre d'affaires" value={`${r.revenu.toLocaleString()} XAF`} Icon={Wallet} color="#1B2A4A" sub={`${r.nombreVentes} vente${r.nombreVentes > 1 ? "s" : ""}`} />
        <CardResume label="Coût d'achat marchandises" value={`${r.coutMarchandises.toLocaleString()} XAF`} Icon={Package} color="#8b5cf6" />
        <CardResume label="Bénéfice brut" value={`${r.beneficeBrut.toLocaleString()} XAF`} Icon={ShoppingBag} color="#10b981" sub="Avant charges d'exploitation" />
        <CardResume label="Charges d'exploitation" value={`${r.chargesExploitation.toLocaleString()} XAF`} Icon={TrendingDown} color="#ef4444" />
      </div>

      {/* Fonds généraux cumulés */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <p className="text-[12.5px] font-bold text-[#111] mb-4 flex items-center gap-1.5"><PiggyBank size={14} className="text-[#F5A623]" /> Fonds généraux (tout historique)</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[16px] font-bold text-green-600">{data.fondsGeneraux.entreesTotales.toLocaleString()} XAF</p>
            <p className="text-[10.5px] text-gray-400">Entrées totales</p>
          </div>
          <div>
            <p className="text-[16px] font-bold text-red-500">{data.fondsGeneraux.chargesTotales.toLocaleString()} XAF</p>
            <p className="text-[10.5px] text-gray-400">Charges totales</p>
          </div>
          <div>
            <p className="text-[16px] font-bold text-[#111]">{data.fondsGeneraux.soldeNet.toLocaleString()} XAF</p>
            <p className="text-[10.5px] text-gray-400">Solde net</p>
          </div>
        </div>
      </div>

      {/* Rentabilité par produit */}
      <div>
        <p className="text-[12.5px] font-bold text-[#111] mb-1">Rentabilité par produit</p>
        <p className="text-[11px] text-gray-400 mb-2">Bénéfice net = bénéfice brut − quote-part des charges d'exploitation, répartie au prorata du revenu de chaque produit</p>
        {data.parProduit.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-2xl">Aucune vente sur cette période</div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
            {data.parProduit.map((p: ProduitRentabilite) => (
              <div key={p.produitId} className="p-3.5">
                <div className="flex items-center gap-3">
                  {p.image ? <img src={p.image} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" /> : <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><Package size={14} className="text-gray-300" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-[#111] truncate">{p.nom}</p>
                    <p className="text-[10.5px] text-gray-400">{p.quantiteVendue} vendu(s) · {p.revenu.toLocaleString()} XAF de revenu · {p.cout.toLocaleString()} XAF de coût d'achat</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[13px] font-bold" style={{ color: p.beneficeNet >= 0 ? "#10b981" : "#ef4444" }}>{p.beneficeNet.toLocaleString()} XAF</p>
                    <p className="text-[10px] text-gray-400">{p.beneficeNetPct}% net</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 pl-12 text-[10.5px]">
                  <span className="text-gray-400">Brut : <strong style={{ color: p.beneficeBrut >= 0 ? "#10b981" : "#ef4444" }}>{p.beneficeBrut.toLocaleString()} XAF</strong> ({p.beneficeBrutPct}%)</span>
                  <span className="text-gray-400">Charges allouées : <strong className="text-red-400">-{p.quotePartCharges.toLocaleString()} XAF</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Charges par catégorie */}
      {Object.keys(data.parCategorieCharge).length > 0 && (
        <div>
          <p className="text-[12.5px] font-bold text-[#111] mb-2">Charges par catégorie</p>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2.5">
            {Object.entries(data.parCategorieCharge).map(([cat, montant]: [string, any]) => {
              const pct = r.chargesExploitation > 0 ? Math.round((montant / r.chargesExploitation) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="capitalize text-gray-600">{cat}</span>
                    <span className="font-bold text-[#111]">{montant.toLocaleString()} XAF</span>
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
