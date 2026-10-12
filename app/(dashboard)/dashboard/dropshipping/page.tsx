"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Globe, RefreshCw, ExternalLink, Package, Upload, TrendingUp } from "lucide-react";
import Link from "next/link";
import { TableauDeBordProfit } from "@/components/dashboard/sourcing/TableauDeBordProfit";

import { useT } from "@/components/I18nProvider";
const TABS = [
  { id: "profit", label: "Tableau de bord", icon: TrendingUp },
  { id: "fournisseurs", label: "Fournisseurs", icon: Globe },
  { id: "commandes", label: "Commandes", icon: Package },
  { id: "import", label: "Import CSV", icon: Upload },
];

/* ─────────────────────────────────────────────────────────────────────────────
   ONGLET FOURNISSEURS (inchangé)
───────────────────────────────────────────────────────────────────────────── */
interface Fournisseur {
  id: string; nom: string; pays: string; type: string;
  url: string | null; email: string | null; delaiLivraison: number;
  fiabilite: number; margeAuto: number; actif: boolean;
  livraisonsTotal: number; livraisonsOk: number;
  notes: string | null; _count?: { produits: number };
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  aliexpress: { label: "AliExpress", color: "#FF6A00" },
  cj:         { label: "CJ Dropshipping", color: "#1677FF" },
  jumia:      { label: "Jumia", color: "#EF6C00" },
  local:      { label: "Local", color: "#10b981" },
  autre:      { label: "Autre", color: "#888" },
};

function OngletFournisseurs() {
  const tr = useT();
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nom:"", pays:"Chine", type:"aliexpress", url:"", email:"", telephone:"", delaiLivraison:15, margeAuto:30, notes:"" });

  useEffect(() => {
    fetch("/api/fournisseurs").then(r=>r.json()).then(d=>setFournisseurs(d.fournisseurs??[])).finally(()=>setLoading(false));
  }, []);

  async function saveFournisseur() {
    setSaving(true);
    const res = await fetch("/api/fournisseurs",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({...form, margeAuto:form.margeAuto/100}) });
    const data = await res.json();
    if (data.fournisseur) {
      setFournisseurs(prev=>[data.fournisseur,...prev]);
      setForm({ nom:"", pays:"Chine", type:"aliexpress", url:"", email:"", telephone:"", delaiLivraison:15, margeAuto:30, notes:"" });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function deleteFournisseur(id: string) {
    await fetch(`/api/fournisseurs/${id}`,{ method:"DELETE" });
    setFournisseurs(prev=>prev.filter(f=>f.id!==id));
  }

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-5 h-5 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-500">{fournisseurs.length} fournisseurs</p>
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-[12px] font-semibold" style={{background:"#F5A623"}}>
          <Plus size={13}/>{" "}{tr("Ajouter")}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[{label:"Nom *",key:"nom",ph:"Fournisseur SAS"},{label:"Pays",key:"pays",ph:"Chine"},{label:"URL catalogue",key:"url",ph:"https://..."},{label:"Email",key:"email",ph:"contact@..."},{label:"Notes",key:"notes",ph:"Délais fiables..."}].map(({label,key,ph})=>(
              <div key={key}>
                <label className="block text-[10px] text-gray-400 mb-1">{tr(label)}</label>
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#F5A623]/50" placeholder={ph} value={(form as any)[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} />
              </div>
            ))}
            <div>
              <label className="block text-[10px] text-gray-400 mb-1">{tr("Type")}</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{tr(v.label)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-1">{tr("Délai (jours)")}</label>
              <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none" value={form.delaiLivraison} onChange={e=>setForm(f=>({...f,delaiLivraison:+e.target.value}))} />
            </div>
            <div>
              <label className="block text-[10px] text-gray-400 mb-1">{tr("Marge auto (%)")}</label>
              <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none" value={form.margeAuto} min={0} max={500} onChange={e=>setForm(f=>({...f,margeAuto:+e.target.value}))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={saveFournisseur} disabled={saving||!form.nom} className="px-4 py-2 rounded-xl text-white text-[12px] font-semibold disabled:opacity-50" style={{background:"#F5A623"}}>{saving?"...":tr("Ajouter")}</button>
            <button onClick={()=>setShowForm(false)} className="px-4 py-2 rounded-xl text-[12px] text-gray-500 border border-gray-200">{tr("Annuler")}</button>
          </div>
        </div>
      )}

      {fournisseurs.length===0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
          <Globe size={28} className="mx-auto mb-3 text-gray-300"/>
          <p className="text-[13px] text-gray-400">{tr("Aucun fournisseur.")}{" "}<button onClick={()=>setShowForm(true)} className="text-[#F5A623] font-semibold">{tr("Ajouter")}</button></p>
        </div>
      ) : (
        <div className="space-y-2">
          {fournisseurs.map(f => {
            const tc = TYPE_LABELS[f.type]??{label:f.type,color:"#888"};
            const fiabiliteOk = f.livraisonsTotal>0 ? Math.round(f.livraisonsOk/f.livraisonsTotal*100) : null;
            return (
              <div key={f.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center shrink-0"><Globe size={16} className="text-gray-400"/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[12px] font-semibold text-[#111]">{tr(f.nom)}</p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white" style={{background:tc.color}}>{tr(tc.label)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-gray-400">{tr(f.pays)}{f.delaiLivraison != null && <> · {tr(f.delaiLivraison)}j</>}</span>
                    {fiabiliteOk!==null && <span className="text-[10px] text-gray-400">{tr(fiabiliteOk)}{tr("% OK")}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-bold text-[#111]">+{Math.round(f.margeAuto*100)}{tr("% marge")}</p>
                  <p className="text-[10px] text-gray-400">{tr(f._count?.produits)??0} produits</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100"><ExternalLink size={12} className="text-gray-400"/></a>}
                  <button onClick={()=>deleteFournisseur(f.id)} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={12} className="text-red-400"/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-[#FFFBF0] border border-[#F5A623]/20 rounded-xl p-4 flex items-start gap-3">
        <RefreshCw size={14} className="text-[#F5A623] mt-0.5 shrink-0"/>
        <p className="text-[11px] text-gray-600">{tr("Routage automatique activé — AXIA crée automatiquement la commande fournisseur à chaque vente dropshipping.")}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ONGLET COMMANDES (inchangé)
───────────────────────────────────────────────────────────────────────────── */
const STATUTS_CF = ["en_attente","envoye","confirme","expedie","livre","annule"];
const STATUT_COLORS: Record<string,string> = { en_attente:"#F5A623", envoye:"#3b82f6", confirme:"#8b5cf6", expedie:"#f59e0b", livre:"#22c55e", annule:"#ef4444" };

function OngletCommandes() {
  const tr = useT();
  const [commandes, setCommandes] = useState<any[]>([]);
  const [stats, setStats] = useState({ total:0, en_attente:0, expedie:0, livre:0 });
  const [filterStatut, setFilterStatut] = useState("");
  const [expanded, setExpanded] = useState<string|null>(null);
  const [tracking, setTracking] = useState<Record<string,string>>({});
  const [ref, setRef] = useState<Record<string,string>>({});

  async function load() {
    const url = filterStatut ? `/api/dropshipping/commandes-fournisseur?statut=${filterStatut}` : "/api/dropshipping/commandes-fournisseur";
    const r = await fetch(url).then(r=>r.json());
    setCommandes(r.commandes??[]); setStats(r.stats??{});
  }
  useEffect(()=>{ load(); },[filterStatut]);

  async function updateStatut(id: string, statut: string, cf: any) {
    await fetch("/api/dropshipping/commandes-fournisseur",{ method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({id,statut,trackingNo:tracking[id]??cf.trackingNo,reference:ref[id]??cf.reference}) });
    load();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {[{label:"Total",v:stats.total},{label:"En attente",v:stats.en_attente},{label:"Expédiés",v:stats.expedie},{label:"Livrés",v:stats.livre}].map(s=>(
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-3">
            <p className="text-[10px] text-gray-400">{tr(s.label)}</p>
            <p className="text-[18px] font-bold text-[#111]">{tr(s.v)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={()=>setFilterStatut("")} className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${!filterStatut?"bg-[#111] text-white":"bg-gray-100 text-gray-500"}`}>{tr("Tous")}</button>
        {STATUTS_CF.map(s=>(
          <button key={s} onClick={()=>setFilterStatut(s)} className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${filterStatut===s?"text-white":"bg-gray-100 text-gray-500"}`}
            style={filterStatut===s?{background:STATUT_COLORS[s]}:{}}>
            {s.replace(/_/g," ")}
          </button>
        ))}
      </div>

      {commandes.length===0 ? <p className="text-center text-sm text-gray-400 py-8">{tr("Aucune commande fournisseur")}</p> : (
        <div className="space-y-2">
          {commandes.map(cf=>(
            <div key={cf.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={()=>setExpanded(expanded===cf.id?null:cf.id)}>
                <Package size={13} className="text-gray-400 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#111] truncate">{cf.commande?.numero} → {tr(cf.fournisseur?.nom)}</p>
                  <p className="text-[10px] text-gray-400">{tr(cf.commande?.clientNom)}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{background:STATUT_COLORS[cf.statut]??"#888"}}>{cf.statut.replace(/_/g," ")}</span>
              </button>

              {expanded===cf.id && (
                <div className="px-4 pb-4 space-y-2 border-t border-gray-50">
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input placeholder={tr("N° suivi")} value={tracking[cf.id]??cf.trackingNo??""} onChange={e=>setTracking(t=>({...t,[cf.id]:e.target.value}))}
                      className="border border-gray-200 rounded-xl px-3 py-1.5 text-[11px] outline-none"/>
                    <input placeholder={tr("Réf. fournisseur")} value={ref[cf.id]??cf.reference??""} onChange={e=>setRef(r=>({...r,[cf.id]:e.target.value}))}
                      className="border border-gray-200 rounded-xl px-3 py-1.5 text-[11px] outline-none"/>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {STATUTS_CF.filter(s=>s!==cf.statut).map(s=>(
                      <button key={s} onClick={()=>updateStatut(cf.id,s,cf)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white" style={{background:STATUT_COLORS[s]}}>
                        → {s.replace(/_/g," ")}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ONGLET IMPORT CSV (inchangé)
───────────────────────────────────────────────────────────────────────────── */
function OngletImportCSV() {
  const tr = useT();
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [fournisseurId, setFournisseurId] = useState("");
  const [csv, setCsv] = useState("");
  const [marge, setMarge] = useState("30");
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState<any>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { fetch("/api/fournisseurs").then(r=>r.json()).then(d=>setFournisseurs(d.fournisseurs??[])); }, []);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => setCsv(e.target?.result as string??"");
    reader.readAsText(file);
  }

  async function importer() {
    if (!csv) return;
    setLoading(true); setResultat(null);
    const res = await fetch("/api/fournisseurs/import-csv",{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({fournisseurId:fournisseurId||null,csv,marge:parseFloat(marge)}) });
    setResultat(await res.json()); setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{tr("Fournisseur")}</label>
          <select value={fournisseurId} onChange={e=>setFournisseurId(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#F5A623]/50">
            <option value="">{tr("Sans lien fournisseur")}</option>
            {fournisseurs.map(f=><option key={f.id} value={f.id}>{tr(f.nom)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{tr("Marge %")}</label>
          <input type="number" min="0" max="500" value={marge} onChange={e=>setMarge(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#F5A623]/50"/>
        </div>
      </div>

      <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragging?"border-[#F5A623] bg-[#FFF8EC]":"border-gray-200 hover:border-[#F5A623]/40"}`}
        onClick={()=>document.getElementById("csvInput2")?.click()}>
        <input id="csvInput2" type="file" accept=".csv,.txt" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);}}/>
        <Upload size={20} className="mx-auto mb-2 text-gray-300"/>
        {csv ? (
          <div>
            <p className="text-[13px] font-semibold text-green-600">{tr("✓ Fichier chargé")}</p>
            <p className="text-[11px] text-gray-400">{csv.split("\n").length-1} lignes</p>
          </div>
        ) : (
          <div>
            <p className="text-[12px] text-gray-400">{tr("Glissez votre CSV ou cliquez")}</p>
            <p className="text-[10px] text-gray-300 mt-1">{tr("nom, description, prix, stock, sku, categorie, image")}</p>
          </div>
        )}
      </div>

      {csv && (
        <button onClick={importer} disabled={loading}
          className="w-full py-3 bg-[#F5A623] text-white rounded-xl text-[13px] font-bold hover:bg-[#e09520] disabled:opacity-50 transition-all">
          {loading?tr("Import en cours…"):tr("Importer les produits")}
        </button>
      )}

      {resultat && (
        <div className={`rounded-2xl p-4 border ${resultat.ok?"bg-green-50 border-green-200":"bg-red-50 border-red-200"}`}>
          {resultat.ok ? (
            <p className="text-[13px] font-bold text-green-700">{tr(resultat.importes)}{" "}{tr("produit(s) importé(s)")}</p>
          ) : <p className="text-[12px] text-red-600">{tr(resultat.message)}</p>}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE PRINCIPALE
───────────────────────────────────────────────────────────────────────────── */
export default function DropshippingPage() {
  const tr = useT();
  const [onglet, setOnglet] = useState("profit");

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[18px] font-bold text-[#111] inline-flex items-center gap-2">{tr("Dropshipping")}</h1>
          <p className="text-[12px] text-gray-500">{tr("Fournisseurs, commandes et import catalogue")}</p>
        </div>
        <Link href="/dashboard/sourcing/catalogue" className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-[#F5A623] text-[#111111]">{tr("Trouver et analyser un produit")}</Link>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setOnglet(id)}
            className={`flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all flex items-center justify-center gap-1.5 ${onglet === id ? "bg-white shadow-sm text-[#111]" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon size={13} />
            <span className="hidden sm:inline">{tr(label)}</span>
          </button>
        ))}
      </div>

      {onglet === "profit"      && <TableauDeBordProfit />}
      {onglet === "fournisseurs" && <OngletFournisseurs />}
      {onglet === "commandes"   && <OngletCommandes />}
      {onglet === "import"      && <OngletImportCSV />}
    </div>
  );
}
