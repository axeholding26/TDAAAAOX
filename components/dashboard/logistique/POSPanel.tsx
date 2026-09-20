"use client";
import { useEffect, useState, useRef } from "react";
import { Search, Plus, Minus, Trash2, ShoppingCart, X, Check, Printer, Banknote, Smartphone, CreditCard, Building2, ShoppingBag, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";
import { BarcodeScanner } from "@/components/dashboard/logistique/BarcodeScanner";

const POS_TUTORIAL_STEPS = [
  { Icon: Search,       titre: "Trouve un produit",     description: "Recherche par nom, SKU ou catégorie, puis clique sur une carte produit pour l'ajouter au panier." },
  { Icon: ShoppingCart, titre: "Gère le panier",         description: "Ajuste les quantités, retire un article et applique une réduction avant d'encaisser." },
  { Icon: Banknote,     titre: "Encaisse le paiement",   description: "Choisis le moyen de paiement (espèces, mobile money, carte, virement) puis valide la vente." },
  { Icon: Printer,      titre: "Imprime le reçu",        description: "Une fois la vente enregistrée, imprime le reçu client ou lance directement une nouvelle vente." },
];

interface Produit {
  id: string;
  nom: string;
  prix: number;
  stock: number;
  sku: string | null;
  images: string[];
  categorie: string | null;
  variantes: { id: string; nom: string; valeur: string; prix: number | null; stock: number }[];
}

interface LigneCart {
  produitId: string;
  nom: string;
  prix: number;
  quantite: number;
  imageUrl?: string;
  varianteId?: string;
  variante?: string;
}

const METHODES = [
  { id: "especes", label: "Espèces", Icon: Banknote },
  { id: "mobile_money", label: "Mobile Money", Icon: Smartphone },
  { id: "carte", label: "Carte bancaire", Icon: CreditCard },
  { id: "virement", label: "Virement", Icon: Building2 },
];

export function POSPanel() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [recherche, setRecherche] = useState("");
  const [cart, setCart] = useState<LigneCart[]>([]);
  const [methode, setMethode] = useState("especes");
  const [clientNom, setClientNom] = useState("");
  const [clientTel, setClientTel] = useState("");
  const [reduction, setReduction] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [derniereCommande, setDerniereCommande] = useState<string | null>(null);
  const [varianteModal, setVarianteModal] = useState<Produit | null>(null);
  const [scannerOuvert, setScannerOuvert] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/produits?limit=200&type=physique")
      .then(r => r.json())
      .then(d => setProduits(d.produits ?? []));
    searchRef.current?.focus();
  }, []);

  const produitsFiltres = produits.filter(p =>
    !recherche || p.nom.toLowerCase().includes(recherche.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(recherche.toLowerCase())) ||
    (p.categorie && p.categorie.toLowerCase().includes(recherche.toLowerCase()))
  );

  function ajouterAuCart(p: Produit, varianteId?: string, varianteLabel?: string) {
    const prix = (varianteId ? p.variantes.find(v => v.id === varianteId)?.prix : null) ?? p.prix;
    const key = p.id + (varianteId ?? "");
    setCart(c => {
      const idx = c.findIndex(l => l.produitId + (l.varianteId ?? "") === key);
      if (idx >= 0) {
        const next = [...c];
        next[idx] = { ...next[idx], quantite: next[idx].quantite + 1 };
        return next;
      }
      return [...c, { produitId: p.id, nom: p.nom + (varianteLabel ? ` — ${varianteLabel}` : ""), prix, quantite: 1, imageUrl: p.images[0], varianteId, variante: varianteLabel }];
    });
    setVarianteModal(null);
    setRecherche("");
  }

  function handleProduitClick(p: Produit) {
    if (p.variantes.length > 0) { setVarianteModal(p); return; }
    ajouterAuCart(p);
  }

  // Champ de recherche = aussi champ de scan : un scanner physique (ou une
  // appli photo qui décode un code-barres directement en texte) "tape" le
  // code dans le champ actif puis envoie Entrée — exactement comme en
  // caisse supermarché. Sur Entrée, on tente une correspondance EXACTE
  // (code-barres ou SKU) via /api/pos/scan avant de retomber sur le simple
  // filtre flou existant, qui reste inchangé pour la recherche par nom.
  const [scanEnCours, setScanEnCours] = useState(false);
  async function tenterScanDirect() {
    const code = recherche.trim();
    if (!code || scanEnCours) return;
    setScanEnCours(true);
    try {
      const res = await fetch(`/api/pos/scan?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (res.ok && data.produit) {
        handleProduitClick(data.produit);
        setRecherche("");
      } else if (code.length >= 4) {
        toast.error(data.error || "Aucun produit pour ce code");
      }
    } catch {
      /* pas de réseau — le filtre flou local reste affiché, pas d'erreur bruyante */
    } finally {
      setScanEnCours(false);
    }
  }

  function modifQte(idx: number, delta: number) {
    setCart(c => {
      const next = [...c];
      next[idx] = { ...next[idx], quantite: Math.max(1, next[idx].quantite + delta) };
      return next;
    });
  }

  function supprimer(idx: number) { setCart(c => c.filter((_, i) => i !== idx)); }

  const sousTotal = cart.reduce((s, l) => s + l.prix * l.quantite, 0);
  const remise = parseFloat(reduction) || 0;
  const total = Math.max(0, sousTotal - remise);

  async function validerVente() {
    if (!cart.length) return;
    setLoading(true);
    try {
      const res = await fetch("/api/commandes/pos-creer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientNom: clientNom || "Client POS",
          clientTelephone: clientTel || "—",
          items: cart.map(l => ({ produitId: l.produitId, nom: l.nom, prix: l.prix, quantite: l.quantite, variante: l.variante, imageUrl: l.imageUrl })),
          methode,
          montantTotal: total,
          montantReduction: remise,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erreur");
      setDerniereCommande(d.numero);
      setSuccess(true);
      setCart([]);
      setClientNom("");
      setClientTel("");
      setReduction("");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  function nouvelleVente() { setSuccess(false); setDerniereCommande(null); searchRef.current?.focus(); }

  const inp = "border border-[#E8E8E8] rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#F5A623]/60 bg-white";

  if (success) return (
    <div className="flex items-center justify-center py-16">
      <div className="bg-white rounded-3xl shadow-xl border border-[#F0F0F0] p-10 text-center max-w-sm w-full mx-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check size={28} className="text-green-600" />
        </div>
        <h2 className="text-[20px] font-bold text-[#111] mb-1">Vente enregistrée</h2>
        <p className="text-[13px] text-[#888] mb-1">Commande <strong>{derniereCommande}</strong></p>
        <p className="text-[22px] font-bold text-[#F5A623] my-3">{total.toLocaleString()} XAF</p>
        <p className="text-[12px] text-[#AAA] mb-6">via {METHODES.find(m => m.id === methode)?.label}</p>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="flex-1 border border-[#E8E8E8] rounded-xl py-2.5 text-[13px] text-[#666] flex items-center justify-center gap-2">
            <Printer size={14} /> Reçu
          </button>
          <button onClick={nouvelleVente} className="flex-1 bg-[#F5A623] text-white rounded-xl py-2.5 text-[13px] font-semibold">
            Nouvelle vente
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid md:grid-cols-[1fr_340px] gap-4 items-start">
      <ModuleTutorial moduleKey="logistique-pos" titre="Caisse POS" sousTitre="Module Point de vente" steps={POS_TUTORIAL_STEPS} />
      {/* ─── Catalogue ─── */}
      <div className="bg-white border border-[#F0F0F0] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0F0F0]">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAA]" />
              <input
                ref={searchRef}
                className="w-full border border-[#E8E8E8] rounded-xl pl-9 pr-4 py-2.5 text-[13px] outline-none focus:border-[#F5A623]/60"
                placeholder="Rechercher par nom, SKU, catégorie... ou scanner un code-barres"
                value={recherche}
                onChange={e => setRecherche(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); tenterScanDirect(); } }}
              />
            </div>
            <button
              onClick={() => setScannerOuvert(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-white font-semibold text-[12.5px] transition-all shrink-0 hover:opacity-90"
              style={{ background: "#F5A623" }}
              title="Scanner un code-barres"
            >
              <ScanLine size={14} /> Scanner
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {produitsFiltres.map(p => (
              <button
                key={p.id}
                onClick={() => handleProduitClick(p)}
                disabled={p.stock <= 0 && p.variantes.length === 0}
                className="bg-white border border-[#F0F0F0] rounded-2xl p-3 text-left hover:border-[#F5A623]/40 hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {p.images[0] ? (
                  <img src={p.images[0]} alt={p.nom} className="w-full h-24 object-cover rounded-xl mb-2" />
                ) : (
                  <div className="w-full h-24 bg-[#F5F5F5] rounded-xl mb-2 flex items-center justify-center"><ShoppingBag size={28} className="text-gray-400" /></div>
                )}
                <p className="text-[12px] font-semibold text-[#111] leading-tight line-clamp-2">{p.nom}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[13px] font-bold text-[#F5A623]">{p.prix.toLocaleString()}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.stock > 5 ? "bg-green-100 text-green-600" : p.stock > 0 ? "bg-orange-100 text-orange-600" : "bg-red-100 text-red-500"}`}>
                    {p.variantes.length > 0 ? `${p.variantes.length} var.` : `S:${p.stock}`}
                  </span>
                </div>
              </button>
            ))}
            {!produitsFiltres.length && (
              <div className="col-span-full text-center py-12 text-[13px] text-[#AAA]">Aucun produit trouvé</div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Panier POS ─── */}
      <div className="bg-white border border-[#F0F0F0] rounded-2xl overflow-hidden md:sticky md:top-4">
        <div className="px-4 py-4 border-b border-[#F0F0F0]">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-[#F5A623]" />
            <span className="text-[14px] font-bold text-[#111]">Panier ({cart.reduce((s,l)=>s+l.quantite,0)})</span>
          </div>
        </div>

        {/* Lignes panier */}
        <div className="max-h-[320px] overflow-y-auto p-3 space-y-2">
          {cart.map((l, idx) => (
            <div key={idx} className="bg-[#FAFAFA] rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[#111] leading-tight truncate">{l.nom}</p>
                <p className="text-[12px] text-[#F5A623] font-bold mt-0.5">{(l.prix * l.quantite).toLocaleString()} XAF</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => modifQte(idx, -1)} className="w-6 h-6 rounded-lg bg-white border border-[#E8E8E8] flex items-center justify-center">
                  <Minus size={10} className="text-[#666]" />
                </button>
                <span className="text-[12px] font-bold text-[#111] w-5 text-center">{l.quantite}</span>
                <button onClick={() => modifQte(idx, 1)} className="w-6 h-6 rounded-lg bg-white border border-[#E8E8E8] flex items-center justify-center">
                  <Plus size={10} className="text-[#666]" />
                </button>
                <button onClick={() => supprimer(idx)} className="w-6 h-6 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center ml-1">
                  <Trash2 size={10} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
          {!cart.length && (
            <div className="text-center py-8 text-[13px] text-[#CCC]">Panier vide — clique sur un produit</div>
          )}
        </div>

        {/* Client + options */}
        <div className="p-4 border-t border-[#F0F0F0] space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input className={inp} placeholder="Nom client" value={clientNom} onChange={e => setClientNom(e.target.value)} />
            <input className={inp} placeholder="Téléphone" value={clientTel} onChange={e => setClientTel(e.target.value)} />
          </div>
          <input className={`${inp} w-full`} placeholder="Réduction (XAF)" type="number" value={reduction} onChange={e => setReduction(e.target.value)} />

          {/* Méthode de paiement */}
          <div className="grid grid-cols-2 gap-1.5">
            {METHODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMethode(m.id)}
                className={`py-2 px-2 rounded-xl border text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${methode === m.id ? "bg-[#F5A623] text-white border-[#F5A623]" : "border-[#E8E8E8] text-[#666]"}`}
              >
                <m.Icon size={12} /> {m.label}
              </button>
            ))}
          </div>

          {/* Total */}
          <div className="bg-[#FAFAFA] rounded-xl p-3">
            <div className="flex justify-between text-[12px] text-[#888] mb-1">
              <span>Sous-total</span><span>{sousTotal.toLocaleString()} XAF</span>
            </div>
            {remise > 0 && (
              <div className="flex justify-between text-[12px] text-red-500 mb-1">
                <span>Réduction</span><span>−{remise.toLocaleString()} XAF</span>
              </div>
            )}
            <div className="flex justify-between text-[15px] font-bold text-[#111] border-t border-[#E8E8E8] pt-2 mt-1">
              <span>Total</span><span style={{ color: "#F5A623" }}>{total.toLocaleString()} XAF</span>
            </div>
          </div>

          <button
            onClick={validerVente}
            disabled={!cart.length || loading}
            className="w-full py-3 rounded-xl text-white font-bold text-[14px] disabled:opacity-40 transition-all"
            style={{ background: "#F5A623" }}
          >
            {loading ? "Enregistrement..." : `Valider la vente — ${total.toLocaleString()} XAF`}
          </button>
        </div>
      </div>

      {/* ─── Modal variantes ─── */}
      {varianteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setVarianteModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-[#111]">{varianteModal.nom}</h3>
              <button onClick={() => setVarianteModal(null)} className="p-1 rounded-lg hover:bg-[#F5F5F5]"><X size={15} className="text-[#888]" /></button>
            </div>
            <p className="text-[12px] text-[#888] mb-3">Choisir une variante :</p>
            <div className="space-y-2">
              {varianteModal.variantes.map(v => (
                <button
                  key={v.id}
                  disabled={v.stock <= 0}
                  onClick={() => ajouterAuCart(varianteModal, v.id, `${v.nom}: ${v.valeur}`)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-[#E8E8E8] hover:border-[#F5A623]/50 hover:bg-[#FFF8EC] transition-all disabled:opacity-40"
                >
                  <span className="text-[13px] font-medium text-[#111]">{v.nom}: {v.valeur}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-[#F5A623]">{((v.prix ?? varianteModal.prix)).toLocaleString()} XAF</span>
                    <span className="text-[10px] text-[#AAA]">S:{v.stock}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Scanner code-barres ─── */}
      <BarcodeScanner
        open={scannerOuvert}
        onClose={() => setScannerOuvert(false)}
        onProduitScanne={p => ajouterAuCart(p)}
      />
    </div>
  );
}
