import React, { useState, useEffect } from "react";
import { 
  DollarSign, 
  TrendingUp, 
  Flame, 
  Sparkles, 
  Coins, 
  MessageSquare, 
  Mail, 
  Target, 
  Calculator, 
  Percent, 
  Smartphone, 
  Inbox, 
  Search, 
  ArrowUpRight, 
  Briefcase, 
  Check, 
  Cpu, 
  Users, 
  ChevronRight, 
  Plus
} from "lucide-react";
import { Customer, Product } from "../types";

interface MillionaireSuiteProps {
  customers: Customer[];
  products: Product[];
  showToast: (message: string) => void;
  onAddProduct?: (product: Partial<Product>) => void;
}

export default function MillionaireSuite({ customers, products, showToast, onAddProduct }: MillionaireSuiteProps) {
  const [suiteTab, setSuiteTab] = useState<'calculator' | 'winners' | 'relances' | 'copywriting'>('calculator');

  // Calculator State
  const [adBudget, setAdBudget] = useState<number>(5000);
  const [cpc, setCpc] = useState<number>(0.85);
  const [convRate, setConvRate] = useState<number>(2.5); // in %
  const [aov, setAov] = useState<number>(450); // Average Order Value
  const [cogsPercent, setCogsPercent] = useState<number>(20); // COGS as % of AOV

  // Computed Calculator Metrics
  const visitors = Math.round(adBudget / cpc);
  const ordersCount = Math.round(visitors * (convRate / 100));
  const revenue = ordersCount * aov;
  const cogs = ordersCount * (aov * (cogsPercent / 100));
  const netProfit = revenue - adBudget - cogs;
  const roas = adBudget > 0 ? (revenue / adBudget).toFixed(1) : "0";
  const marginPercent = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0";
  const cac = ordersCount > 0 ? (adBudget / ordersCount).toFixed(1) : "0";

  // Timeline to reach Millionaire status
  const monthsTo1MRevenue = revenue > 0 ? Math.ceil(1000000 / revenue) : 999;
  const monthsTo1MProfit = netProfit > 0 ? Math.ceil(1000000 / netProfit) : 999;
  const monthsTo5MProfit = netProfit > 0 ? Math.ceil(5000000 / netProfit) : 999;

  // Winner Finder State
  const [isSearchingWinner, setIsSearchingWinner] = useState<boolean>(false);
  const [generatedWinner, setGeneratedWinner] = useState<{
    name: string;
    tagline: string;
    category: string;
    cogs: number;
    retailPrice: number;
    margin: number;
    targetAudience: string;
    marketingAngle: string;
    cpc: number;
    conversionRate: number;
    pathToMillionaire: string;
  } | null>(null);

  // Relances State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || "");
  const [relanceChannel, setRelanceChannel] = useState<'whatsapp' | 'gmail'>('whatsapp');
  const [relanceScenario, setRelanceScenario] = useState<'abandoned_cart' | 'vip_birthday' | 'loyalty_cross_sell' | 'private_event'>('abandoned_cart');
  const [isGeneratingRelance, setIsGeneratingRelance] = useState<boolean>(false);
  const [generatedRelanceText, setGeneratedRelanceText] = useState<string>("");

  // Copywriting state
  const [copyProduct, setCopyProduct] = useState<string>(products[0]?.id || "");
  const [copyType, setCopyType] = useState<'tiktok' | 'facebook' | 'story' | 'email'>('tiktok');
  const [isGeneratingCopy, setIsGeneratingCopy] = useState<boolean>(false);
  const [generatedCopy, setGeneratedCopy] = useState<{
    hook: string;
    body: string;
    cta: string;
    bonusTips: string;
  } | null>(null);

  // Preset winners list
  const presetWinners = [
    {
      name: "Le Chronographe Astral - Édition Céleste",
      tagline: "Le temps sculpté dans une météorite lunaire.",
      category: "Horlogerie",
      cogs: 280,
      retailPrice: 3400,
      margin: 91.7,
      growth: "Forte Traction Instagram",
      cpc: 1.25,
      conversion: 2.2
    },
    {
      name: "Le Sac Cabas Impérial en Cuir Végétal",
      tagline: "Une silhouette intemporelle, un engagement d'avenir.",
      category: "Maroquinerie",
      cogs: 120,
      retailPrice: 1650,
      margin: 92.7,
      growth: "Viral sur Pinterest & TikTok",
      cpc: 0.65,
      conversion: 2.8
    },
    {
      name: "L'Essence de Grasse - Coffret Oud Impérial",
      tagline: "Un sillage royal d'or noir de Grasse.",
      category: "Parfumerie",
      cogs: 45,
      retailPrice: 420,
      margin: 89.2,
      growth: "Idéal pour WhatsApp & Retargeting VIP",
      cpc: 0.45,
      conversion: 3.5
    }
  ];

  // Fetch AI generated winning product
  const handleBrainstormWinner = async () => {
    setIsSearchingWinner(true);
    try {
      const res = await fetch("/api/ai/find-winning-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      setGeneratedWinner(data);
      showToast("Produit Gagnant d'Exception trouvé par l'IA AXIA !");
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de la recherche du produit gagnant.");
    } finally {
      setIsSearchingWinner(false);
    }
  };

  // Add generated product to catalog
  const handleImportWinnerToCatalog = () => {
    if (!generatedWinner || !onAddProduct) return;
    
    const newProduct: Partial<Product> = {
      name: generatedWinner.name,
      sku: "WIN-" + generatedWinner.name.substring(0, 3).toUpperCase() + "-" + Math.floor(Math.random() * 900 + 100),
      category: generatedWinner.category,
      stock: 15,
      safetyStock: 5,
      price: generatedWinner.retailPrice,
      cost: generatedWinner.cogs,
      supplier: "Sourcing Premium AXSO",
      salesVelocity: 1.2,
      reorderPoint: 5,
      leadTime: 10
    };

    onAddProduct(newProduct);
    showToast(`Produit Gagnant "${generatedWinner.name}" importé avec succès dans votre boutique AXSO !`);
  };

  // Fetch AI follow-up draft
  const handleGenerateFollowup = async () => {
    setIsGeneratingRelance(true);
    try {
      const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
      const randomProduct = products[Math.floor(Math.random() * products.length)]?.name || "Montre Solaire d'Exception";
      
      const res = await fetch("/api/ai/draft-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          channel: relanceChannel,
          scenario: relanceScenario,
          productName: randomProduct
        })
      });
      const data = await res.json();
      if (data.text) {
        setGeneratedRelanceText(data.text);
        showToast("Relance de prestige rédigée par l'IA !");
      }
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de la génération de la relance.");
    } finally {
      setIsGeneratingRelance(false);
    }
  };

  // Generate Ad copy
  const handleGenerateAdCopy = async () => {
    setIsGeneratingCopy(true);
    try {
      const product = products.find(p => p.id === copyProduct) || products[0];
      const res = await fetch("/api/ai/generate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: `Millionaire Scale - ${product?.name}`,
          platform: copyType === 'tiktok' ? 'Instagram' : copyType === 'facebook' ? 'Facebook' : 'Google Search',
          audience: "Acheteurs impulsifs de luxe & VIP à haut pouvoir d'achat",
          productId: product?.id || "p1",
          budget: 5000
        })
      });
      const data = await res.json();
      
      setGeneratedCopy({
        hook: `⚡ ACCROCHE EMPIRE [${copyType.toUpperCase()}] : "${data.headline || 'Le luxe absolu.'}"`,
        body: data.primaryText || "Une expérience sensorielle unique...",
        cta: `🎯 CALL TO ACTION : ${data.description || 'Commandez maintenant.'}`,
        bonusTips: `💡 CONSEIL MILLIONNAIRE :\nCiblez les intérêts ${data.keywords?.join(', ')}. ROI projeté de 5.5x avec tunnel de vente AXSO.`
      });
      showToast("Arguments publicitaires haute-conversion prêts !");
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de la génération du copywriting.");
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  // Simulate follow-up message submission
  const handleSimulateSubmitRelance = () => {
    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    showToast(`✓ Relance ${relanceChannel.toUpperCase()} envoyée avec succès à ${selectedCustomer?.name || 'Client'} !`);
  };

  // Generate follow-up automatically on customer / scenario change
  useEffect(() => {
    if (selectedCustomerId) {
      handleGenerateFollowup();
    }
  }, [selectedCustomerId, relanceChannel, relanceScenario]);

  // Set initial customer if available
  useEffect(() => {
    if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Tab Navigation header */}
      <div className="lg:col-span-12 flex flex-wrap gap-2.5 border-b border-white/10 pb-4">
        <button
          onClick={() => setSuiteTab('calculator')}
          className={`px-4 py-2 rounded-xl border font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            suiteTab === 'calculator' 
              ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
              : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/60'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          Planificateur Millionnaire & ROI
        </button>
        <button
          onClick={() => setSuiteTab('winners')}
          className={`px-4 py-2 rounded-xl border font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            suiteTab === 'winners' 
              ? 'bg-red-500/10 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
              : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/60'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          Dénicheur de Winners
        </button>
        <button
          onClick={() => setSuiteTab('relances')}
          className={`px-4 py-2 rounded-xl border font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            suiteTab === 'relances' 
              ? 'bg-green-500/10 border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.15)]' 
              : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/60'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Relances Clientèle VIP (WhatsApp / Gmail)
        </button>
        <button
          onClick={() => setSuiteTab('copywriting')}
          className={`px-4 py-2 rounded-xl border font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            suiteTab === 'copywriting' 
              ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
              : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Copywriting Empire
        </button>
      </div>

      {/* ----------------- SUB-TAB 1: WEALTH CALCULATOR ----------------- */}
      {suiteTab === 'calculator' && (
        <>
          {/* Sliders Inputs Left */}
          <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-xl p-5 shadow-xl flex flex-col gap-4.5">
            <div className="border-b border-white/10 pb-3 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Simulateur d'Hyper-Croissance</h3>
                <p className="text-[10px] text-white/40 font-mono">Pilotez votre escalade vers le statut multi-millionnaire</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Ad Budget Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between font-mono text-xs text-white/60">
                  <span>Budget Publicitaire Mensuel :</span>
                  <span className="text-amber-400 font-bold">{adBudget.toLocaleString()} €</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="150000"
                  step="1000"
                  value={adBudget}
                  onChange={(e) => setAdBudget(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                />
              </div>

              {/* CPC Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between font-mono text-xs text-white/60">
                  <span>Coût par Clic (CPC moyen Meta/Google) :</span>
                  <span className="text-amber-400 font-bold">{cpc.toFixed(2)} €</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="4.00"
                  step="0.05"
                  value={cpc}
                  onChange={(e) => setCpc(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                />
              </div>

              {/* Conversion Rate Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between font-mono text-xs text-white/60">
                  <span>Taux de Conversion de la Boutique :</span>
                  <span className="text-emerald-400 font-bold">{convRate.toFixed(1)} %</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="10.0"
                  step="0.1"
                  value={convRate}
                  onChange={(e) => setConvRate(Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                />
              </div>

              {/* AOV (Panier Moyen) Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between font-mono text-xs text-white/60">
                  <span>Panier Moyen (AOV High-Ticket) :</span>
                  <span className="text-indigo-400 font-bold">{aov.toLocaleString()} €</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="5000"
                  step="50"
                  value={aov}
                  onChange={(e) => setAov(Number(e.target.value))}
                  className="w-full accent-indigo-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                />
              </div>

              {/* COGS Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between font-mono text-xs text-white/60">
                  <span>Coût Produit (COGS % du prix de vente) :</span>
                  <span className="text-red-400 font-bold">{cogsPercent} % (Marge brute {(100 - cogsPercent)}%)</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="1"
                  value={cogsPercent}
                  onChange={(e) => setCogsPercent(Number(e.target.value))}
                  className="w-full accent-red-400 cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                />
              </div>
            </div>
          </div>

          {/* Computed Results Right */}
          <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-xl p-5 shadow-xl flex flex-col gap-5 justify-between">
            <div>
              <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-mono font-bold block mb-4 text-amber-400">Rapport de Rentabilité & de Scaling Mensuel</span>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                  <span className="text-[9px] uppercase font-mono text-white/40 block">Visiteurs</span>
                  <span className="font-mono text-sm font-bold text-white">{visitors.toLocaleString()}</span>
                </div>
                <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                  <span className="text-[9px] uppercase font-mono text-white/40 block">Commandes</span>
                  <span className="font-mono text-sm font-bold text-white">{ordersCount.toLocaleString()}</span>
                </div>
                <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                  <span className="text-[9px] uppercase font-mono text-white/40 block">Coût Acquisition (CAC)</span>
                  <span className="font-mono text-sm font-bold text-white">{cac} €</span>
                </div>
                <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                  <span className="text-[9px] uppercase font-mono text-white/40 block">Chiffre d'Affaires</span>
                  <span className="font-mono text-sm font-bold text-white text-emerald-400">{revenue.toLocaleString()} €</span>
                </div>
                <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                  <span className="text-[9px] uppercase font-mono text-amber-400/80 block">Bénéfice Net</span>
                  <span className={`font-mono text-sm font-bold block ${netProfit > 0 ? "text-amber-400" : "text-red-400"}`}>
                    {netProfit.toLocaleString()} €
                  </span>
                </div>
                <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                  <span className="text-[9px] uppercase font-mono text-white/40 block">ROAS Global</span>
                  <span className="font-mono text-sm font-bold text-indigo-400">{roas}x</span>
                </div>
              </div>

              {/* Path to Millionaire Timeline */}
              <div className="border-t border-white/10 pt-4">
                <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-mono font-bold block mb-3">Feuille de Route pour Devenir Multi-Millionnaire</span>
                
                <div className="flex flex-col gap-3">
                  {/* Timeline step 1 */}
                  <div className="flex items-center gap-3 bg-white/5 border border-white/5 p-3 rounded-xl transition-all hover:bg-white/10">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center border border-emerald-500/20">
                      1M
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-bold text-white block">Cap d'1 Million d'Euros de CA</span>
                      <p className="text-[11px] text-white/60 font-mono">
                        Atteint en <strong className="text-emerald-400 font-bold">{monthsTo1MRevenue} mois</strong> au rythme de vente actuel.
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-white/20" />
                  </div>

                  {/* Timeline step 2 */}
                  <div className="flex items-center gap-3 bg-white/5 border border-white/5 p-3 rounded-xl transition-all hover:bg-white/10">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 font-mono font-bold text-xs flex items-center justify-center border border-amber-500/20">
                      Prof
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-bold text-white block">Premier Million d'Euros NET de Bénéfice</span>
                      <p className="text-[11px] text-white/60 font-mono">
                        Atteint en <strong className="text-amber-400 font-bold">{netProfit > 0 ? `${monthsTo1MProfit} mois` : "Inaccessible (bénéfice négatif)"}</strong> de scaling sain.
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-white/20" />
                  </div>

                  {/* Timeline step 3 */}
                  <div className="flex items-center gap-3 bg-white/5 border border-white/5 p-3 rounded-xl transition-all hover:bg-white/10">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 font-mono font-bold text-xs flex items-center justify-center border border-indigo-500/20">
                      VIP
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-bold text-white block">Statut Multi-Millionnaire d'Élite (5 Millions € Net)</span>
                      <p className="text-[11px] text-white/60 font-mono">
                        Atteint en <strong className="text-indigo-400 font-bold">{netProfit > 0 ? `${monthsTo5MProfit} mois` : "Inaccessible"}</strong> de croissance mondiale.
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-white/20" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-lg text-[10px] text-amber-300 font-mono leading-relaxed mt-4">
              ✨ <strong>Conseil Empire d'AXIA :</strong> Dans l'e-commerce haut de gamme, augmenter votre panier moyen (AOV) de 20% par des offres complémentaires exclusives augmente votre marge nette de plus de 45% sans dépenser 1€ de plus en publicité Meta ou Google.
            </div>
          </div>
        </>
      )}

      {/* ----------------- SUB-TAB 2: WINNERS PRODUCT FINDER ----------------- */}
      {suiteTab === 'winners' && (
        <>
          {/* Preset Winner list */}
          <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-xl p-5 shadow-xl flex flex-col gap-4">
            <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 font-mono font-bold">
              Base de Données des Winners de l'Écosystème
            </h3>
            
            <div className="flex flex-col gap-3">
              {presetWinners.map((winner, idx) => (
                <div key={idx} className="p-4 bg-black/40 border border-white/5 rounded-xl hover:border-red-500/30 transition duration-300">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-bold text-white block">{winner.name}</span>
                      <span className="text-[9px] text-red-400 font-mono uppercase tracking-wider">{winner.category}</span>
                    </div>
                    <span className="text-[9px] bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-mono font-bold">
                      +{winner.margin}% Marge
                    </span>
                  </div>
                  
                  <p className="text-[11px] text-white/60 italic mb-3">"{winner.tagline}"</p>
                  
                  <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-2.5 text-[10px] font-mono text-white/40">
                    <div>
                      <span>COGS (Sourcing) :</span>
                      <strong className="text-white block mt-0.5">{winner.cogs} €</strong>
                    </div>
                    <div>
                      <span>Prix Public :</span>
                      <strong className="text-emerald-400 block mt-0.5">{winner.retailPrice} €</strong>
                    </div>
                    <div>
                      <span>Traction :</span>
                      <strong className="text-indigo-400 block mt-0.5">{winner.cpc}€ CPC / {winner.conversion}% Conv</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI brainstorm panel */}
          <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-xl p-5 shadow-xl flex flex-col gap-5 justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-red-500" />
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Brainstorming d'Élite IA</h3>
                    <p className="text-[10px] text-white/40 font-mono">Recherchez de nouvelles pépites e-commerce ultra profitables</p>
                  </div>
                </div>
                
                <button
                  onClick={handleBrainstormWinner}
                  disabled={isSearchingWinner}
                  className="py-2 px-4 bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition hover:scale-[1.01] active:scale-95 disabled:opacity-50 uppercase tracking-wider font-mono shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse"
                >
                  <Cpu className="w-4 h-4" />
                  {isSearchingWinner ? "Analyse en cours..." : "Lancer IA Dénicheur"}
                </button>
              </div>

              {generatedWinner ? (
                <div className="bg-black/40 border border-white/10 p-4 rounded-xl flex flex-col gap-4.5">
                  <div className="flex justify-between items-start border-b border-white/5 pb-3">
                    <div>
                      <span className="text-sm font-bold text-white block">{generatedWinner.name}</span>
                      <span className="text-[10px] font-mono text-red-400 italic block mt-0.5">{generatedWinner.tagline}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-white/40 block font-mono">Marge Brute :</span>
                      <span className="font-mono text-lg font-black text-emerald-400">{generatedWinner.margin}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-black/60 p-3 rounded-lg border border-white/5 flex flex-col gap-1.5">
                      <span className="text-[9px] uppercase tracking-wider text-white/40 block font-mono">Fiche Financière :</span>
                      <div className="text-xs font-mono flex flex-col gap-1 text-white/80">
                        <div className="flex justify-between">
                          <span>Coût Revient (COGS) :</span>
                          <strong className="text-white">{generatedWinner.cogs} €</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Prix Recommandé :</span>
                          <strong className="text-emerald-400">{generatedWinner.retailPrice} €</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Bénéfice par Vente :</span>
                          <strong className="text-amber-400">{generatedWinner.retailPrice - generatedWinner.cogs} €</strong>
                        </div>
                      </div>
                    </div>

                    <div className="bg-black/60 p-3 rounded-lg border border-white/5 flex flex-col gap-1.5">
                      <span className="text-[9px] uppercase tracking-wider text-white/40 block font-mono">Vecteurs Publicitaires :</span>
                      <div className="text-xs font-mono flex flex-col gap-1 text-white/80">
                        <div className="flex justify-between">
                          <span>CPC Estimé :</span>
                          <strong className="text-white">{generatedWinner.cpc} €</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Taux Conv Target :</span>
                          <strong className="text-indigo-400">{generatedWinner.conversionRate}%</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Audience Cible :</span>
                          <strong className="text-white text-right truncate max-w-[120px]" title={generatedWinner.targetAudience}>{generatedWinner.targetAudience}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                    <span className="text-[9px] uppercase tracking-wider text-amber-400 block font-mono font-bold mb-1">Angle Psychologique & Conversion :</span>
                    <p className="text-xs text-white/80 leading-relaxed font-mono text-[11px]">{generatedWinner.marketingAngle}</p>
                  </div>

                  <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                    <span className="text-[9px] uppercase tracking-wider text-indigo-400 block font-mono font-bold mb-1">Plan de Scaling Millionnaire (Timeline) :</span>
                    <p className="text-xs text-white/70 leading-relaxed font-mono text-[11px] whitespace-pre-line">{generatedWinner.pathToMillionaire}</p>
                  </div>

                  {onAddProduct && (
                    <button
                      onClick={handleImportWinnerToCatalog}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:scale-[1.01] transition text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer uppercase tracking-widest font-mono shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    >
                      <Plus className="w-4 h-4" />
                      Importer et lancer ce produit gagnant sur AXSO
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-white/20 py-24 border border-dashed border-white/10 rounded-xl bg-black/10">
                  <Flame className="w-16 h-16 mb-3 text-white/5" />
                  <span className="font-mono text-xs">Prêt pour la prospection de produits à haut rendement. Cliquez sur lancer pour interroger le radar AXIA.</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ----------------- SUB-TAB 3: WHATSAPP & GMAIL RELANCES ----------------- */}
      {suiteTab === 'relances' && (
        <>
          {/* Inputs Left */}
          <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-xl p-5 shadow-xl flex flex-col gap-4.5">
            <div className="border-b border-white/10 pb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-400" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Configurez la Relance de Luxe</h3>
                <p className="text-[10px] text-white/40 font-mono">Ciblez vos paniers abandonnés ou fidélisez les VIP</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Select Customer */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/50 font-mono flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  Destinataire CRM :
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white focus:outline-none focus:border-green-500 font-mono"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#050505]">{c.name} ({c.loyaltyTier})</option>
                  ))}
                </select>
              </div>

              {/* Select Channel */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/50 font-mono">Canal de Diffusion Haute-Conversion :</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setRelanceChannel('whatsapp')}
                    className={`py-2.5 px-3 rounded-lg border font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      relanceChannel === 'whatsapp'
                        ? 'bg-green-500/10 border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/60'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-green-400" />
                    WhatsApp VIP
                  </button>
                  <button
                    onClick={() => setRelanceChannel('gmail')}
                    className={`py-2.5 px-3 rounded-lg border font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      relanceChannel === 'gmail'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-white/60'
                    }`}
                  >
                    <Mail className="w-4 h-4 text-blue-400" />
                    Gmail Prestige
                  </button>
                </div>
              </div>

              {/* Select Scenario */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/50 font-mono">Scénario de Relance :</label>
                <select
                  value={relanceScenario}
                  onChange={(e) => setRelanceScenario(e.target.value as any)}
                  className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white focus:outline-none focus:border-green-500 font-mono"
                >
                  <option value="abandoned_cart">🛒 Relancer Panier d'Exception Abandonné</option>
                  <option value="vip_birthday">🎂 Célébration Anniversaire VIP (+Cadeau)</option>
                  <option value="loyalty_cross_sell">💎 Remerciement Fidélité & Complémentarité</option>
                  <option value="private_event">🥂 Invitation Exclusive Salon Privé AXSO</option>
                </select>
              </div>

              <button
                onClick={handleGenerateFollowup}
                disabled={isGeneratingRelance}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:scale-[1.01] transition-transform text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase tracking-widest mt-2"
              >
                <Sparkles className="w-4 h-4" />
                {isGeneratingRelance ? "Rédaction d'exception par Gemini..." : "Régénérer par l'IA"}
              </button>
            </div>
          </div>

          {/* High Fidelity Previews Right */}
          <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-xl p-5 shadow-xl flex flex-col gap-5 justify-between">
            <div className="flex flex-col gap-4">
              <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-mono font-bold block text-green-400">
                Aperçu de la Relance {relanceChannel === 'whatsapp' ? 'WhatsApp' : 'Gmail'} • Haute-Fidélité
              </span>

              {isGeneratingRelance ? (
                <div className="flex flex-col items-center justify-center text-center py-24 gap-4">
                  <div className="w-10 h-10 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
                  <span className="font-mono text-xs text-green-400 animate-pulse">AXIA brode un message de prestige chirurgical...</span>
                </div>
              ) : generatedRelanceText ? (
                /* Dynamic mockups */
                relanceChannel === 'whatsapp' ? (
                  /* WhatsApp Mockup */
                  <div className="w-full max-w-sm mx-auto bg-[#0b141a] rounded-2xl overflow-hidden border border-[#232d36] shadow-2xl font-sans">
                    {/* Top Header */}
                    <div className="bg-[#1f2c34] px-4 py-3 flex items-center justify-between border-b border-[#2d3a43]">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 flex items-center justify-center text-xs font-bold font-mono">
                          AX
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">Conciergerie AXSO</span>
                          <span className="text-[9px] text-green-400 animate-pulse block">● en ligne</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-white/60 text-xs">
                        <Smartphone className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Chat Body */}
                    <div className="p-4 bg-[#0b141a] h-72 overflow-y-auto flex flex-col justify-end font-sans">
                      <div className="bg-[#005c4b] text-white text-[12px] p-3 rounded-2xl rounded-tr-none self-end max-w-[85%] shadow-md relative leading-relaxed whitespace-pre-wrap">
                        {generatedRelanceText}
                        <div className="text-[8px] text-white/50 text-right mt-1 font-mono flex items-center justify-end gap-1">
                          {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          <span className="text-sky-400">✓✓</span>
                        </div>
                      </div>
                    </div>

                    {/* Chat Input simulator bar */}
                    <div className="bg-[#1f2c34] p-3 flex items-center gap-2 border-t border-[#2d3a43]">
                      <div className="flex-1 bg-[#2a3942] rounded-full px-4 py-1.5 text-[11px] text-white/40">
                        Répondre en privé...
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Gmail Mockup */
                  <div className="w-full bg-[#18181b] rounded-xl border border-white/10 shadow-2xl font-mono overflow-hidden">
                    {/* Header bar */}
                    <div className="bg-black/60 px-4 py-2 border-b border-white/5 flex items-center gap-1.5 text-[10px] text-white/40">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                      <span className="ml-2">Nouveau Message d'Exception</span>
                    </div>

                    <div className="p-4 flex flex-col gap-3 text-xs">
                      <div className="flex border-b border-white/5 pb-2">
                        <span className="text-white/40 w-16">De :</span>
                        <span className="text-white">relations-clients@axso-prestige.com</span>
                      </div>
                      <div className="flex border-b border-white/5 pb-2">
                        <span className="text-white/40 w-16">À :</span>
                        <span className="text-indigo-300 font-bold">
                          {customers.find(c => c.id === selectedCustomerId)?.email || 'client@vip.com'}
                        </span>
                      </div>
                      
                      <div className="bg-black/40 p-3.5 rounded-lg border border-white/5 text-[11px] text-white/95 leading-relaxed whitespace-pre-wrap font-sans h-60 overflow-y-auto">
                        {generatedRelanceText}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-white/20 py-24 border border-dashed border-white/10 rounded-xl bg-black/10">
                  <Inbox className="w-16 h-16 mb-3 text-white/5" />
                  <span className="font-mono text-xs">Sélectionnez vos critères et cliquez sur Générer pour afficher l'aperçu du message d'exception.</span>
                </div>
              )}
            </div>

            {generatedRelanceText && !isGeneratingRelance && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedRelanceText);
                    showToast("Message copié dans le presse-papiers.");
                  }}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold rounded-lg font-mono transition cursor-pointer text-center"
                >
                  Copier le Message
                </button>
                <button
                  onClick={handleSimulateSubmitRelance}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg font-mono transition cursor-pointer text-center"
                >
                  Simuler l'envoi de la Relance
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ----------------- SUB-TAB 4: AD COPYWRITING EMPIRE ----------------- */}
      {suiteTab === 'copywriting' && (
        <>
          <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-xl p-5 shadow-xl flex flex-col gap-4.5">
            <div className="border-b border-white/10 pb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Configurez le Copywriting</h3>
                <p className="text-[10px] text-white/40 font-mono">Générez des annonces publicitaires de niveau millionnaire</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Product selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/50 font-mono">Produit cible :</label>
                <select
                  value={copyProduct}
                  onChange={(e) => setCopyProduct(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 p-2.5 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id} className="bg-[#050505]">{p.name} ({p.price} €)</option>
                  ))}
                </select>
              </div>

              {/* Format selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-white/50 font-mono">Format publicitaire :</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => setCopyType('tiktok')}
                    className={`py-2 px-3 rounded-lg border font-mono font-bold transition cursor-pointer ${
                      copyType === 'tiktok' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/5 text-white/60'
                    }`}
                  >
                    TikTok Hook & Script
                  </button>
                  <button
                    onClick={() => setCopyType('facebook')}
                    className={`py-2 px-3 rounded-lg border font-mono font-bold transition cursor-pointer ${
                      copyType === 'facebook' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/5 text-white/60'
                    }`}
                  >
                    Facebook Ads Copy
                  </button>
                  <button
                    onClick={() => setCopyType('story')}
                    className={`py-2 px-3 rounded-lg border font-mono font-bold transition cursor-pointer ${
                      copyType === 'story' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/5 text-white/60'
                    }`}
                  >
                    Insta Story Slide Hook
                  </button>
                  <button
                    onClick={() => setCopyType('email')}
                    className={`py-2 px-3 rounded-lg border font-mono font-bold transition cursor-pointer ${
                      copyType === 'email' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/5 text-white/60'
                    }`}
                  >
                    Mail de Vente Privée
                  </button>
                </div>
              </div>

              <button
                onClick={handleGenerateAdCopy}
                disabled={isGeneratingCopy}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.01] transition-transform text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase tracking-widest mt-2"
              >
                <Sparkles className="w-4 h-4" />
                {isGeneratingCopy ? "Création publicitaire..." : "Générer les arguments"}
              </button>
            </div>
          </div>

          {/* Copywriter Outputs Right */}
          <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-xl p-5 shadow-xl flex flex-col gap-4">
            <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-mono font-bold block text-indigo-400">Copywriting Haute-Conversion Généré par AXIA</span>

            {isGeneratingCopy ? (
              <div className="flex flex-col items-center justify-center text-center py-24 gap-4">
                <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <span className="font-mono text-xs text-indigo-400 animate-pulse">AXIA assemble une formule hypnotique...</span>
              </div>
            ) : generatedCopy ? (
              <div className="flex flex-col gap-3">
                <div className="bg-black/60 p-4.5 border border-white/10 rounded-xl flex flex-col gap-3.5">
                  <div className="text-xs text-amber-400 font-mono font-bold p-2 bg-amber-500/10 rounded border border-amber-500/20">
                    {generatedCopy.hook}
                  </div>
                  <div className="text-xs text-white/95 leading-relaxed font-sans font-medium whitespace-pre-wrap border-t border-white/5 pt-3">
                    {generatedCopy.body}
                  </div>
                  <div className="text-xs text-emerald-400 font-mono font-bold border-t border-white/5 pt-3 flex justify-between">
                    <span>{generatedCopy.cta}</span>
                  </div>
                </div>

                <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-xl text-xs font-mono text-indigo-300 whitespace-pre-wrap leading-relaxed">
                  {generatedCopy.bonusTips}
                </div>

                <button
                  onClick={() => {
                    const fullText = `${generatedCopy.hook}\n\n${generatedCopy.body}\n\n${generatedCopy.cta}`;
                    navigator.clipboard.writeText(fullText);
                    showToast("Texte publicitaire copié dans le presse-papiers.");
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer uppercase tracking-widest font-mono shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                >
                  Copier l'Annonce Complète
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-white/20 py-24 border border-dashed border-white/10 rounded-xl bg-black/10">
                <Sparkles className="w-16 h-16 mb-3 text-white/5" />
                <span className="font-mono text-xs">Configurez vos critères à gauche puis cliquez sur Générer pour obtenir vos textes de conversion à fort ROI.</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
