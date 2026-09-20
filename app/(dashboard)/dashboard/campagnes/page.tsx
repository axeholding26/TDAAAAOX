"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, MousePointer, Megaphone, Zap, Mail, MessageSquare, Phone, Trophy, ShoppingCart, Smile, Package, Gift, Clock, Sparkles } from "lucide-react";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

const CAMPAGNES_TUTORIAL_STEPS = [
  { Icon: Megaphone,   titre: "Créez des popups",              description: "Popup centré, bandeau ou slide-in : affichez une offre au bon moment (délai, exit intent, scroll, 1ère visite)." },
  { Icon: ShoppingCart, titre: "Automatisez vos relances",       description: "Panier abandonné, bienvenue, après achat, anniversaire, client inactif — un message envoyé automatiquement par email, SMS ou WhatsApp." },
  { Icon: Trophy,       titre: "Débloquez des badges",           description: "Gagnez des badges au fil de vos performances pour suivre votre progression de marchand." },
];

const TABS = [
  { id: "popups", label: "Popups" },
  { id: "automation", label: "Automation" },
  { id: "badges", label: "Badges" },
];

// ─── Onglet Popups ────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = { popup: "Popup centré", bandeau: "Bandeau haut", slide_in: "Slide-in coin" };
const DECL_LABELS: Record<string, string> = { delai: "Après délai", exit_intent: "Exit intent", scroll: "Au scroll", premiere_visite: "1ère visite" };

function OngletPopups() {
  const [popups, setPopups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nom:"", type:"popup", declencheur:"delai", delaiSec:5, titre:"", message:"", ctaTexte:"", ctaUrl:"", codePromo:"" });

  const charger = () => fetch("/api/popups").then(r=>r.json()).then(d=>{setPopups(d.popups??[]);setLoading(false);});
  useEffect(()=>{charger();},[]);

  async function creer() {
    setSaving(true);
    await fetch("/api/popups",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    await charger(); setShowForm(false); setSaving(false);
    setForm({nom:"",type:"popup",declencheur:"delai",delaiSec:5,titre:"",message:"",ctaTexte:"",ctaUrl:"",codePromo:""});
  }

  async function supprimer(id: string) {
    await fetch(`/api/popups/${id}`,{method:"DELETE"});
    setPopups(p=>p.filter(x=>x.id!==id));
  }

  async function toggle(id: string, actif: boolean) {
    await fetch("/api/popups",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,actif:!actif})});
    setPopups(p=>p.map(x=>x.id===id?{...x,actif:!actif}:x));
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Chargement…</div>;

  return (
    <div className="space-y-3">
      <button onClick={()=>setShowForm(!showForm)}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-[#F5A623]/40 text-[12px] text-[#F5A623] font-semibold hover:bg-[#FFF8EC] transition-all">
        + Nouveau popup
      </button>

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Nom interne" value={form.nom} onChange={e=>setForm(v=>({...v,nom:e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none col-span-2"/>
            <select value={form.type} onChange={e=>setForm(v=>({...v,type:e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none">
              {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
            <select value={form.declencheur} onChange={e=>setForm(v=>({...v,declencheur:e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none">
              {Object.entries(DECL_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
            <input placeholder="Titre" value={form.titre} onChange={e=>setForm(v=>({...v,titre:e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none col-span-2"/>
            <textarea placeholder="Message" value={form.message} onChange={e=>setForm(v=>({...v,message:e.target.value}))}
              rows={2} className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none resize-none col-span-2"/>
            <input placeholder="Texte CTA" value={form.ctaTexte} onChange={e=>setForm(v=>({...v,ctaTexte:e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none"/>
            <input placeholder="Code promo" value={form.codePromo} onChange={e=>setForm(v=>({...v,codePromo:e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none"/>
          </div>
          <div className="flex gap-2">
            <button onClick={creer} disabled={!form.nom||saving}
              className="flex-1 py-2 bg-[#F5A623] text-white rounded-xl text-[12px] font-semibold disabled:opacity-50">{saving?"…":"Créer"}</button>
            <button onClick={()=>setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-[12px] text-gray-500">Annuler</button>
          </div>
        </div>
      )}

      {popups.length === 0 && !showForm && <p className="text-center text-sm text-gray-400 py-8">Aucun popup créé</p>}
      {popups.map(p => (
        <div key={p.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
          <Megaphone size={14} className="text-[#F5A623] shrink-0"/>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[#111] truncate">{p.nom}</p>
            <p className="text-[11px] text-gray-400">{TYPE_LABELS[p.type]} · {DECL_LABELS[p.declencheur]}</p>
          </div>
          <span className="text-[10px] text-gray-400 flex items-center gap-1"><Eye size={10}/> {p.affichages}</span>
          <span className="text-[10px] text-gray-400 flex items-center gap-1"><MousePointer size={10}/> {p.clics}</span>
          <button onClick={()=>toggle(p.id,p.actif)}
            className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${p.actif?"bg-[#F5A623]":"bg-gray-200"}`}>
            <span className={`inline-block h-4 w-4 m-0.5 rounded-full bg-white shadow transition-transform ${p.actif?"translate-x-4":""}`}/>
          </button>
          <button onClick={()=>supprimer(p.id)}><Trash2 size={12} className="text-gray-300 hover:text-red-400"/></button>
        </div>
      ))}
    </div>
  );
}

// ─── Onglet Automation ────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string,{label:string;icon:any}> = {
  panier_abandonne:{label:"Panier abandonné",icon:ShoppingCart},
  bienvenue:{label:"Bienvenue",icon:Smile},
  apres_achat:{label:"Après achat",icon:Package},
  anniversaire:{label:"Anniversaire",icon:Gift},
  inactif:{label:"Client inactif",icon:Clock},
};
const CANAL_ICONS: Record<string,any> = { email:Mail, sms:Phone, whatsapp:MessageSquare };

function OngletAutomation() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nom:"", type:"panier_abandonne", delaiHeures:1, canal:"email", sujet:"", message:"" });

  const charger = () => fetch("/api/automation").then(r=>r.json()).then(d=>{setWorkflows(d.workflows??[]);setLoading(false);});
  useEffect(()=>{charger();},[]);

  async function creer() {
    setSaving(true);
    await fetch("/api/automation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    await charger(); setShowForm(false); setSaving(false);
    setForm({nom:"",type:"panier_abandonne",delaiHeures:1,canal:"email",sujet:"",message:""});
  }

  async function toggle(id: string, actif: boolean) {
    await fetch("/api/automation",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,actif:!actif})});
    setWorkflows(w=>w.map(x=>x.id===id?{...x,actif:!actif}:x));
  }

  async function supprimer(id: string) {
    await fetch(`/api/automation/${id}`,{method:"DELETE"});
    setWorkflows(w=>w.filter(x=>x.id!==id));
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Chargement…</div>;

  return (
    <div className="space-y-3">
      <button onClick={()=>setShowForm(!showForm)}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-[#F5A623]/40 text-[12px] text-[#F5A623] font-semibold hover:bg-[#FFF8EC] transition-all">
        + Nouveau workflow
      </button>

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Nom du workflow" value={form.nom} onChange={e=>setForm(v=>({...v,nom:e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none col-span-2"/>
            <select value={form.type} onChange={e=>setForm(v=>({...v,type:e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none">
              {Object.entries(TYPE_CONFIG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={form.canal} onChange={e=>setForm(v=>({...v,canal:e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none">
              {["email","sms","whatsapp"].map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="Délai (heures)" type="number" value={form.delaiHeures} onChange={e=>setForm(v=>({...v,delaiHeures:+e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none"/>
            {form.canal==="email" && <input placeholder="Sujet email" value={form.sujet} onChange={e=>setForm(v=>({...v,sujet:e.target.value}))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none"/>}
            <textarea placeholder="Message" value={form.message} onChange={e=>setForm(v=>({...v,message:e.target.value}))}
              rows={3} className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none resize-none col-span-2"/>
          </div>
          <div className="flex gap-2">
            <button onClick={creer} disabled={!form.nom||saving}
              className="flex-1 py-2 bg-[#F5A623] text-white rounded-xl text-[12px] font-semibold disabled:opacity-50">{saving?"…":"Créer"}</button>
            <button onClick={()=>setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-[12px] text-gray-500">Annuler</button>
          </div>
        </div>
      )}

      {workflows.length === 0 && !showForm && <p className="text-center text-sm text-gray-400 py-8">Aucun workflow</p>}
      {workflows.map(w => {
        const tc = TYPE_CONFIG[w.type]??{label:w.type,icon:Zap};
        const CanalIcon = CANAL_ICONS[w.canal]??Zap;
        const TcIcon = tc.icon;
        return (
          <div key={w.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
            <TcIcon size={18} className="text-[#F5A623] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#111] truncate">{w.nom}</p>
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <CanalIcon size={10}/> {tc.label} · {w.delaiHeures}h · {w.declenchements} déclenchements
              </p>
            </div>
            <button onClick={()=>toggle(w.id,w.actif)}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${w.actif?"bg-[#F5A623]":"bg-gray-200"}`}>
              <span className={`inline-block h-4 w-4 m-0.5 rounded-full bg-white shadow transition-transform ${w.actif?"translate-x-4":""}`}/>
            </button>
            <button onClick={()=>supprimer(w.id)}><Trash2 size={12} className="text-gray-300 hover:text-red-400"/></button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Onglet Badges ────────────────────────────────────────────────────────────
function OngletBadges() {
  const [badges, setBadges] = useState<any[]>([]);
  const [nouveaux, setNouveaux] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/badges").then(r=>r.json()).then(d=>{setBadges(d.badges??[]);setNouveaux(d.nouveaux??[]);setLoading(false);});
  }, []);

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Chargement…</div>;

  const obtenus = badges.filter(b=>b.obtenu);
  const restants = badges.filter(b=>!b.obtenu);

  return (
    <div className="space-y-5">
      {nouveaux.length > 0 && (
        <div className="bg-gradient-to-r from-[#F5A623]/10 to-[#111111]/10 border border-[#F5A623]/20 rounded-2xl p-4">
          <p className="text-[13px] font-bold text-[#111] mb-2 flex items-center gap-1.5"><Sparkles size={14} className="text-[#F5A623]" /> Nouveaux badges !</p>
          <div className="flex gap-2 flex-wrap">
            {nouveaux.map(b=>(
              <div key={b.type} className="bg-white rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm">
                <span className="text-xl">{b.emoji}</span>
                <div><p className="text-[12px] font-bold text-[#111]">{b.titre}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {obtenus.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Obtenus ({obtenus.length})</p>
          <div className="grid grid-cols-2 gap-2">
            {obtenus.map(b=>(
              <div key={b.type} className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">{b.emoji}</span>
                <div><p className="text-[12px] font-semibold text-[#111]">{b.titre}</p><p className="text-[10px] text-gray-400">{b.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {restants.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">À obtenir ({restants.length})</p>
          <div className="grid grid-cols-2 gap-2">
            {restants.map(b=>(
              <div key={b.type} className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-center gap-3 opacity-60">
                <span className="text-2xl grayscale">{b.emoji}</span>
                <div><p className="text-[12px] font-semibold text-gray-500">{b.titre}</p><p className="text-[10px] text-gray-400">{b.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {badges.length === 0 && <div className="text-center py-10"><Trophy size={32} className="mx-auto text-gray-200 mb-3"/><p className="text-sm text-gray-400">Aucun badge disponible</p></div>}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function CampagnesPage() {
  const [onglet, setOnglet] = useState("popups");

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <ModuleTutorial moduleKey="campagnes" titre="Campagnes" sousTitre="Notifications & relances" steps={CAMPAGNES_TUTORIAL_STEPS} />
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-[18px] font-bold text-[#111]">Campagnes</h1>
          <BoutonRevoirTutoriel moduleKey="campagnes" />
        </div>
        <p className="text-[12px] text-gray-500">Popups, workflows automatisés et badges marchands</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
        {TABS.map(({id,label})=>(
          <button key={id} onClick={()=>setOnglet(id)}
            className={`flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all ${onglet===id?"bg-white shadow-sm text-[#111]":"text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {onglet==="popups" && <OngletPopups/>}
      {onglet==="automation" && <OngletAutomation/>}
      {onglet==="badges" && <OngletBadges/>}
    </div>
  );
}
