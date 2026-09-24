"use client";

// Panneaux de réglages du Constructeur (couleurs, typo, mise en page, pages
// annexes…) — partagés par le constructeur boutique (boutique/) et landing.
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Save, Monitor, Tablet, Smartphone, ExternalLink, ArrowLeft,
  LayoutGrid, Palette, Type, LayoutTemplate, MousePointer2, Code2,
  ChevronDown, ChevronRight, ToggleLeft, ToggleRight, RefreshCw,
  Plus, Trash2, Check, Layers, Sparkles,
  Image as ImageIcon, X, GripVertical, Zap, Copy,
  BarChart3, Timer, Building2, Video, Star, Target, FileText,
  ArrowUpDown, Megaphone, Shield, FolderOpen, BookOpen, HelpCircle,
  MessageCircle, Mail, LucideIcon,
  ShoppingBag, Maximize2, Minimize2,
  ShoppingCart, Share2, Info, Phone, Undo2, Redo2, Rocket, AlertCircle, Images, Wand2,
} from "lucide-react";
import { type ThemeConfig, type CustomSection, type ProductPageSection } from "@/lib/theme-config";
import { SECTIONS_FICHE, TYPES_FICHE, appliquerActionFiche, sectionsFiche, typesIndisponibles, type ActionFiche } from "@/lib/fiche-produit";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { FONTS } from "@/lib/theme-fonts";
import { MANIFESTE_LIBRAIRIE } from "@/lib/axso-design-manifest";

// ─── Section library types ────────────────────────────────────────────────────
const CUSTOM_SECTION_TYPES = [
  { type: "features",      label: "Avantages / Features", Icon: Zap,          desc: "Grille de 3 à 6 caractéristiques avec icône et texte" },
  { type: "stats",         label: "Statistiques",         Icon: BarChart3,    desc: "Chiffres clés animés (clients, produits, années)" },
  { type: "countdown",     label: "Compte à rebours",     Icon: Timer,        desc: "Timer pour une vente flash ou lancement" },
  { type: "brands",        label: "Logos partenaires",    Icon: Building2,    desc: "Défilement de logos de marques ou certifications" },
  { type: "video",         label: "Vidéo showcase",       Icon: Video,        desc: "Vidéo YouTube, Vimeo ou mp4 en grand format" },
  { type: "gallery",       label: "Galerie photos",       Icon: ImageIcon,    desc: "Mosaïque ou grille de photos (lookbook, coulisses)" },
  { type: "social-proof",  label: "Preuve sociale",       Icon: Star,         desc: "Barre de confiance avec notes, certifications, médias" },
  { type: "cta-band",      label: "Bande CTA",            Icon: Target,       desc: "Bandeau pleine largeur avec appel à l'action fort" },
  { type: "richtext",      label: "Texte riche",          Icon: FileText,     desc: "Bloc de texte libre avec titre, sous-titre et bouton" },
  { type: "spacer",        label: "Espacement",           Icon: ArrowUpDown,  desc: "Espace vertical personnalisable entre deux sections" },
  { type: "tabs",          label: "Onglets",              Icon: LayoutTemplate, desc: "Contenu organisé en onglets — photos, témoignages, promo (style Shopify)" },
  { type: "columns",       label: "Colonnes",             Icon: LayoutGrid,   desc: "Colonnes personnalisables, chacune avec ses propres blocs de contenu" },
] as const;

const SOUS_BLOC_TYPES = [
  { type: "photos",     label: "Photos",       Icon: ImageIcon },
  { type: "temoignage", label: "Témoignage",   Icon: Star },
  { type: "promo",      label: "Bannière CTA", Icon: Target },
  { type: "texte",      label: "Texte",        Icon: FileText },
  { type: "video",      label: "Vidéo",        Icon: Video },
  { type: "stats",      label: "Statistiques", Icon: BarChart3 },
  { type: "features",   label: "Avantages",    Icon: Zap },
  { type: "countdown",  label: "Compte à rebours", Icon: Timer },
  { type: "logos",      label: "Logos partenaires", Icon: Building2 },
  { type: "confiance",  label: "Preuve sociale", Icon: Shield },
  { type: "liste",      label: "Liste à puces", Icon: Check },
  { type: "spacer",     label: "Espacement",   Icon: ArrowUpDown },
] as const;

// ─── Section Library ──────────────────────────────────────────────────────────
function SectionLibrary({ onAdd, onClose }: { onAdd: (t: CustomSection["type"]) => void; onClose: () => void }) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">Bibliothèque de sections</p>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={13} /></button>
      </div>
      <div className="space-y-1.5">
        {CUSTOM_SECTION_TYPES.map(t => (
          <button key={t.type} onClick={() => onAdd(t.type as CustomSection["type"])}
            className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-[#F5A623]/30 hover:bg-[#F5A623]/5 transition-all group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,166,35,0.08)" }}><t.Icon size={15} style={{ color: "#F5A623" }} /></div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 group-hover:text-[#F5A623] transition-colors">{t.label}</p>
              <p className="text-[12px] text-gray-600 mt-0.5 leading-relaxed">{t.desc}</p>
            </div>
            <Plus size={12} className="flex-shrink-0 text-gray-700 group-hover:text-[#F5A623] mt-0.5 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Custom Section Controls ──────────────────────────────────────────────────
function CustomSectionControls({ section, update }: { section: CustomSection; update: (id: string, patch: any) => void }) {
  const c = section.config;
  const up = (patch: any) => update(section.id, patch);

  if (section.type === "features") return (
    <>
      <FInp label="Titre" value={c.titre||""} onChange={v=>up({titre:v})} />
      <FSel label="Colonnes" value={String(c.colonnes||3)} onChange={v=>up({colonnes:Number(v)})} opts={[{v:"2",l:"2"},{v:"3",l:"3"},{v:"4",l:"4 colonnes"}]} />
      {(c.items||[]).map((item: any, i: number) => (
        <div key={i} className="bg-gray-50 rounded-xl p-2.5 space-y-1.5">
          <div className="flex gap-2">
            <FInp label="Emoji" value={item.icone} onChange={v=>{ const it=[...c.items]; it[i]={...it[i],icone:v}; up({items:it}); }} />
            <FInp label="Titre" value={item.titre} onChange={v=>{ const it=[...c.items]; it[i]={...it[i],titre:v}; up({items:it}); }} />
          </div>
          <FInp label="Description" value={item.texte} onChange={v=>{ const it=[...c.items]; it[i]={...it[i],texte:v}; up({items:it}); }} multiline />
        </div>
      ))}
      <button onClick={()=>up({items:[...(c.items||[]),{icone:"★",titre:"Avantage",texte:"Description"}]})} className="w-full text-[12px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1.5 hover:border-gray-300">+ Ajouter</button>
    </>
  );

  if (section.type === "stats") return (
    <>
      <FInp label="Titre" value={c.titre||""} onChange={v=>up({titre:v})} />
      {(c.items||[]).map((item: any, i: number) => (
        <div key={i} className="bg-gray-50 rounded-xl p-2.5 flex gap-2">
          <FInp label="Valeur (ex: 10K+)" value={item.valeur} onChange={v=>{ const it=[...c.items]; it[i]={...it[i],valeur:v}; up({items:it}); }} />
          <FInp label="Label" value={item.label} onChange={v=>{ const it=[...c.items]; it[i]={...it[i],label:v}; up({items:it}); }} />
        </div>
      ))}
    </>
  );

  if (section.type === "countdown") return (
    <>
      <FInp label="Titre" value={c.titre||""} onChange={v=>up({titre:v})} />
      <FInp label="Description" value={c.texte||""} onChange={v=>up({texte:v})} multiline />
      <div>
        <label className="text-[12px] text-gray-500 block mb-1.5">Date de fin</label>
        <input type="datetime-local" value={c.dateFin||""} onChange={e=>up({dateFin:e.target.value})} className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#F5A623]/50" />
      </div>
      <FInp label="Texte du bouton CTA" value={c.ctaTexte||""} onChange={v=>up({ctaTexte:v})} />
    </>
  );

  if (section.type === "brands") return (
    <>
      <FInp label="Titre (optionnel)" value={c.titre||""} onChange={v=>up({titre:v})} />
      <FSel label="Style" value={c.style||"carousel"} onChange={v=>up({style:v})} opts={[{v:"carousel",l:"Carrousel défilant"},{v:"grid",l:"Grille fixe"}]} />
      <div>
        <p className="text-[12px] text-gray-500 mb-2">URLs des logos</p>
        {(c.logos||[]).map((url: string, i: number) => (
          <div key={i} className="flex gap-1 mb-1.5">
            <FInp label="" value={url} onChange={v=>{ const l=[...c.logos]; l[i]=v; up({logos:l}); }} />
            <button onClick={()=>up({logos:c.logos.filter((_:any,j:number)=>j!==i)})} className="text-red-500/40 hover:text-red-400 flex-shrink-0 mt-3.5"><Trash2 size={11}/></button>
          </div>
        ))}
        <button onClick={()=>up({logos:[...(c.logos||[]),""]})} className="w-full text-[12px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1.5 hover:border-gray-300">+ Ajouter un logo</button>
      </div>
    </>
  );

  if (section.type === "video") return (
    <>
      <FInp label="Titre" value={c.titre||""} onChange={v=>up({titre:v})} />
      <FInp label="URL vidéo (YouTube, Vimeo ou .mp4)" value={c.videoUrl||""} onChange={v=>up({videoUrl:v})} />
      <FSel label="Style" value={c.style||"centered"} onChange={v=>up({style:v})} opts={[{v:"centered",l:"Centré (16:9)"},{v:"fullwidth",l:"Pleine largeur"},{v:"split",l:"Divisé (texte + vidéo)"}]} />
      <FCheck label="Lecture automatique" checked={c.autoplay||false} onChange={v=>up({autoplay:v})} />
    </>
  );

  if (section.type === "gallery") return (
    <>
      <FInp label="Titre" value={c.titre||""} onChange={v=>up({titre:v})} />
      <FSel label="Disposition" value={c.layout||"masonry"} onChange={v=>up({layout:v})} opts={[{v:"masonry",l:"Mosaïque"},{v:"grid",l:"Grille régulière"},{v:"carousel",l:"Carrousel"}]} />
      <div>
        <p className="text-[12px] text-gray-500 mb-2">URLs des photos</p>
        {(c.images||[]).map((url: string, i: number) => (
          <div key={i} className="flex gap-1 mb-1.5">
            <FInp label="" value={url} onChange={v=>{ const imgs=[...c.images]; imgs[i]=v; up({images:imgs}); }} />
            <button onClick={()=>up({images:c.images.filter((_:any,j:number)=>j!==i)})} className="text-red-500/40 hover:text-red-400 flex-shrink-0 mt-3.5"><Trash2 size={11}/></button>
          </div>
        ))}
        <button onClick={()=>up({images:[...(c.images||[]),""]})} className="w-full text-[12px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1.5 hover:border-gray-300">+ Ajouter une photo</button>
      </div>
    </>
  );

  if (section.type === "social-proof") return (
    <>
      <FInp label="Note moyenne (ex: 4.9/5)" value={c.note||""} onChange={v=>up({note:v})} />
      <FInp label="Nb clients (ex: 12 000+)" value={c.nbClients||""} onChange={v=>up({nbClients:v})} />
      <FInp label="Nb commandes (ex: 30 000+)" value={c.nbCommandes||""} onChange={v=>up({nbCommandes:v})} />
    </>
  );

  if (section.type === "cta-band") return (
    <>
      <FInp label="Titre" value={c.titre||""} onChange={v=>up({titre:v})} />
      <FInp label="Texte" value={c.texte||""} onChange={v=>up({texte:v})} multiline />
      <FInp label="Texte du bouton" value={c.ctaTexte||""} onChange={v=>up({ctaTexte:v})} />
      <FSel label="Style" value={c.style||"gradient"} onChange={v=>up({style:v})} opts={[{v:"gradient",l:"Dégradé"},{v:"dark",l:"Sombre"},{v:"accent",l:"Couleur accent"}]} />
    </>
  );

  if (section.type === "richtext") return (
    <>
      <FInp label="Titre" value={c.titre||""} onChange={v=>up({titre:v})} />
      <FInp label="Texte" value={c.texte||""} onChange={v=>up({texte:v})} multiline />
      <FInp label="Bouton (laisser vide si aucun)" value={c.ctaTexte||""} onChange={v=>up({ctaTexte:v})} />
    </>
  );

  if (section.type === "spacer") return (
    <FSel label="Hauteur" value={c.hauteur||"80px"} onChange={v=>up({hauteur:v})} opts={[{v:"40px",l:"Petit (40px)"},{v:"80px",l:"Moyen (80px)"},{v:"120px",l:"Grand (120px)"},{v:"160px",l:"XL (160px)"}]} />
  );

  if (section.type === "tabs") return (
    <>
      <FInp label="Titre (optionnel)" value={c.titre||""} onChange={v=>up({titre:v})} />
      {(c.onglets||[]).map((tab: any, i: number) => (
        <div key={tab.id} className="bg-gray-50 rounded-xl p-3 space-y-2.5 border border-gray-200">
          <div className="flex gap-2 items-center">
            <div className="flex-1"><FInp label="Nom de l'onglet" value={tab.label} onChange={v=>{ const t=[...c.onglets]; t[i]={...t[i],label:v}; up({onglets:t}); }} /></div>
            <button onClick={()=>up({onglets:c.onglets.filter((_:any,j:number)=>j!==i)})} className="text-red-500/40 hover:text-red-400 flex-shrink-0 mt-4"><Trash2 size={13}/></button>
          </div>
          <SousBlocsEditor blocs={tab.blocs||[]} onChange={(blocs: any[])=>{ const t=[...c.onglets]; t[i]={...t[i],blocs}; up({onglets:t}); }} />
        </div>
      ))}
      <button onClick={()=>up({onglets:[...(c.onglets||[]),{id:`tab_${Date.now()}`,label:"Nouvel onglet",blocs:[]}]})} className="w-full text-[12px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1.5 hover:border-gray-300">+ Ajouter un onglet</button>
    </>
  );

  if (section.type === "columns") return (
    <>
      <FInp label="Titre (optionnel)" value={c.titre||""} onChange={v=>up({titre:v})} />
      <FSel label="Nombre de colonnes" value={String(c.nombreColonnes||3)} onChange={v=>up({nombreColonnes:Number(v)})} opts={[{v:"2",l:"2"},{v:"3",l:"3"},{v:"4",l:"4 colonnes"}]} />
      {(c.colonnes||[]).map((col: any, i: number) => (
        <div key={col.id} className="bg-gray-50 rounded-xl p-3 space-y-2.5 border border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-gray-500 font-semibold">Colonne {i+1}</p>
            <button onClick={()=>up({colonnes:c.colonnes.filter((_:any,j:number)=>j!==i)})} className="text-red-500/40 hover:text-red-400"><Trash2 size={13}/></button>
          </div>
          <SousBlocsEditor blocs={col.blocs||[]} onChange={(blocs: any[])=>{ const cols=[...c.colonnes]; cols[i]={...cols[i],blocs}; up({colonnes:cols}); }} />
        </div>
      ))}
      <button onClick={()=>up({colonnes:[...(c.colonnes||[]),{id:`col_${Date.now()}`,blocs:[]}]})} className="w-full text-[12px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1.5 hover:border-gray-300">+ Ajouter une colonne</button>
    </>
  );

  return null;
}

// ─── Éditeur de sous-blocs (utilisé par les sections Onglets & Colonnes) ──────
function SousBlocsEditor({ blocs, onChange }: { blocs: any[]; onChange: (b: any[]) => void }) {
  const addBloc = (type: string) => {
    const defaults: Record<string, any> = {
      photos: { images: [""] },
      temoignage: { nom: "", texte: "", note: 5 },
      promo: { titre: "", texte: "", ctaTexte: "" },
      texte: { titre: "", texte: "" },
      video: { videoUrl: "" },
      stats: { items: [{ valeur: "10K+", label: "Clients" }, { valeur: "500+", label: "Produits" }] },
      features: { items: [{ icone: "★", titre: "Avantage", texte: "Description" }] },
      countdown: { texte: "Offre limitée dans le temps", dateFin: new Date(Date.now() + 7*24*3600*1000).toISOString().slice(0,16), ctaTexte: "Profiter maintenant" },
      logos: { logos: [""] },
      confiance: { note: "4.9/5", nbClients: "12 000+", certifications: ["✓ Paiement sécurisé"] },
      liste: { items: [""] },
      spacer: { hauteur: "40px" },
    };
    onChange([...blocs, { id: `bloc_${Date.now()}`, type, config: defaults[type] }]);
  };
  const updateBloc = (i: number, patch: any) => {
    const next = [...blocs]; next[i] = { ...next[i], config: { ...next[i].config, ...patch } }; onChange(next);
  };
  const removeBloc = (i: number) => onChange(blocs.filter((_, j) => j !== i));

  return (
    <div className="space-y-2 pl-2 border-l-2 border-gray-200">
      {blocs.map((b, i) => {
        const meta = SOUS_BLOC_TYPES.find(t => t.type === b.type);
        return (
          <div key={b.id} className="bg-gray-200/50 rounded-lg p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                {meta && <meta.Icon size={10} />} {meta?.label}
              </span>
              <button onClick={() => removeBloc(i)} className="text-red-500/40 hover:text-red-400"><Trash2 size={10} /></button>
            </div>
            {b.type === "photos" && (
              <div>
                {(b.config.images || [""]).map((url: string, j: number) => (
                  <div key={j} className="mb-1"><FInp label="" value={url} onChange={v => { const imgs = [...(b.config.images || [""])]; imgs[j] = v; updateBloc(i, { images: imgs }); }} /></div>
                ))}
                <button onClick={() => updateBloc(i, { images: [...(b.config.images || []), ""] })} className="text-[13px] text-gray-500 hover:text-gray-300">+ photo</button>
              </div>
            )}
            {b.type === "temoignage" && (<>
              <FInp label="Nom" value={b.config.nom || ""} onChange={v => updateBloc(i, { nom: v })} />
              <FInp label="Texte" value={b.config.texte || ""} onChange={v => updateBloc(i, { texte: v })} multiline />
            </>)}
            {b.type === "promo" && (<>
              <FInp label="Titre" value={b.config.titre || ""} onChange={v => updateBloc(i, { titre: v })} />
              <FInp label="Texte" value={b.config.texte || ""} onChange={v => updateBloc(i, { texte: v })} multiline />
              <FInp label="Bouton" value={b.config.ctaTexte || ""} onChange={v => updateBloc(i, { ctaTexte: v })} />
            </>)}
            {b.type === "texte" && (<>
              <FInp label="Titre" value={b.config.titre || ""} onChange={v => updateBloc(i, { titre: v })} />
              <FInp label="Texte" value={b.config.texte || ""} onChange={v => updateBloc(i, { texte: v })} multiline />
            </>)}
            {b.type === "video" && (
              <FInp label="URL vidéo (YouTube, Vimeo ou .mp4)" value={b.config.videoUrl || ""} onChange={v => updateBloc(i, { videoUrl: v })} />
            )}
            {b.type === "stats" && (
              <div>
                {(b.config.items || []).map((it: any, j: number) => (
                  <div key={j} className="grid grid-cols-2 gap-1 mb-1">
                    <FInp label="" value={it.valeur || ""} onChange={v => { const items = [...(b.config.items || [])]; items[j] = { ...items[j], valeur: v }; updateBloc(i, { items }); }} />
                    <FInp label="" value={it.label || ""} onChange={v => { const items = [...(b.config.items || [])]; items[j] = { ...items[j], label: v }; updateBloc(i, { items }); }} />
                  </div>
                ))}
                <button onClick={() => updateBloc(i, { items: [...(b.config.items || []), { valeur: "", label: "" }] })} className="text-[13px] text-gray-500 hover:text-gray-300">+ statistique</button>
              </div>
            )}
            {b.type === "features" && (
              <div>
                {(b.config.items || []).map((it: any, j: number) => (
                  <div key={j} className="space-y-1 mb-2 pb-2 border-b border-gray-200 last:border-0">
                    <FInp label="Icône (emoji)" value={it.icone || ""} onChange={v => { const items = [...(b.config.items || [])]; items[j] = { ...items[j], icone: v }; updateBloc(i, { items }); }} />
                    <FInp label="Titre" value={it.titre || ""} onChange={v => { const items = [...(b.config.items || [])]; items[j] = { ...items[j], titre: v }; updateBloc(i, { items }); }} />
                    <FInp label="Texte" value={it.texte || ""} onChange={v => { const items = [...(b.config.items || [])]; items[j] = { ...items[j], texte: v }; updateBloc(i, { items }); }} />
                  </div>
                ))}
                <button onClick={() => updateBloc(i, { items: [...(b.config.items || []), { icone: "★", titre: "", texte: "" }] })} className="text-[13px] text-gray-500 hover:text-gray-300">+ avantage</button>
              </div>
            )}
            {b.type === "countdown" && (<>
              <FInp label="Texte" value={b.config.texte || ""} onChange={v => updateBloc(i, { texte: v })} />
              <label className="block text-[13px] text-gray-500 mb-0.5 mt-1">Date de fin</label>
              <input type="datetime-local" value={b.config.dateFin || ""} onChange={e => updateBloc(i, { dateFin: e.target.value })} className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] text-gray-800 mb-1.5" />
              <FInp label="Bouton" value={b.config.ctaTexte || ""} onChange={v => updateBloc(i, { ctaTexte: v })} />
            </>)}
            {b.type === "logos" && (
              <div>
                {(b.config.logos || [""]).map((url: string, j: number) => (
                  <div key={j} className="mb-1"><FInp label="" value={url} onChange={v => { const logos = [...(b.config.logos || [""])]; logos[j] = v; updateBloc(i, { logos }); }} /></div>
                ))}
                <button onClick={() => updateBloc(i, { logos: [...(b.config.logos || []), ""] })} className="text-[13px] text-gray-500 hover:text-gray-300">+ logo</button>
              </div>
            )}
            {b.type === "confiance" && (<>
              <FInp label="Note" value={b.config.note || ""} onChange={v => updateBloc(i, { note: v })} />
              <FInp label="Nb clients" value={b.config.nbClients || ""} onChange={v => updateBloc(i, { nbClients: v })} />
              {(b.config.certifications || []).map((cert: string, j: number) => (
                <div key={j} className="mb-1"><FInp label="" value={cert} onChange={v => { const certs = [...(b.config.certifications || [])]; certs[j] = v; updateBloc(i, { certifications: certs }); }} /></div>
              ))}
              <button onClick={() => updateBloc(i, { certifications: [...(b.config.certifications || []), ""] })} className="text-[13px] text-gray-500 hover:text-gray-300">+ certification</button>
            </>)}
            {b.type === "liste" && (
              <div>
                {(b.config.items || [""]).map((it: string, j: number) => (
                  <div key={j} className="mb-1"><FInp label="" value={it} onChange={v => { const items = [...(b.config.items || [""])]; items[j] = v; updateBloc(i, { items }); }} /></div>
                ))}
                <button onClick={() => updateBloc(i, { items: [...(b.config.items || []), ""] })} className="text-[13px] text-gray-500 hover:text-gray-300">+ élément</button>
              </div>
            )}
            {b.type === "spacer" && (
              <FInp label="Hauteur (ex: 40px)" value={b.config.hauteur || ""} onChange={v => updateBloc(i, { hauteur: v })} />
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-1">
        {SOUS_BLOC_TYPES.map(t => (
          <button key={t.type} onClick={() => addBloc(t.type)}
            className="text-[13px] px-2 py-1 rounded-lg border border-dashed border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-300 flex items-center gap-1">
            <Plus size={9} /> {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Panel Couleurs ───────────────────────────────────────────────────────────
export function PanelCouleurs({ config, setColors }: any) {
  const FIELDS = [
    {k:"accent",            l:"Couleur principale (accent)"},
    {k:"accentSecondaire",  l:"Couleur secondaire"},
    {k:"fond",              l:"Fond (background)"},
    {k:"texte",             l:"Texte principal"},
    {k:"texteMuted",        l:"Texte secondaire / atténué"},
    {k:"surface",           l:"Surface (cartes & sections)"},
    {k:"bordure",           l:"Bordures"},
  ];
  const PRESETS = [
    {l:"Minuit",   c:{fond:"#0a0a0a",accent:"#F5A623",texte:"#f5f5f0",surface:"#111111",texteMuted:"#888888",bordure:"#222222"}},
    {l:"Crème",    c:{fond:"#fff8f0",accent:"#c2622d",texte:"#2c1503",surface:"#fef3e8",texteMuted:"#8a6248",bordure:"#f0e0d0"}},
    {l:"Ocean",    c:{fond:"#010d1f",accent:"#00b4d8",texte:"#e0f4ff",surface:"#021a33",texteMuted:"#6aa8c4",bordure:"#0a2a40"}},
    {l:"Forêt",   c:{fond:"#071a0b",accent:"#4ade80",texte:"#e8ffe0",surface:"#0d2912",texteMuted:"#6aad6a",bordure:"#163d1e"}},
    {l:"Cosmos",   c:{fond:"#1a0a2e",accent:"#1B2A4A",texte:"#f0eaff",surface:"#200a3e",texteMuted:"#9876cc",bordure:"#2d1058"}},
    {l:"Rose",     c:{fond:"#fff5f7",accent:"#e91e8c",texte:"#1a0010",surface:"#fff0f4",texteMuted:"#b0607a",bordure:"#f5c0d0"}},
    {l:"Slate",    c:{fond:"#f8fafc",accent:"#3b82f6",texte:"#0f172a",surface:"#f1f5f9",texteMuted:"#64748b",bordure:"#e2e8f0"}},
    {l:"Or royal", c:{fond:"#1a0e00",accent:"#f5a623",texte:"#fff8e8",surface:"#261400",texteMuted:"#c8a060",bordure:"#3a2200"}},
    {l:"Nude",     c:{fond:"#f5ede8",accent:"#a0522d",texte:"#2c1503",surface:"#ede0d8",texteMuted:"#8a6b55",bordure:"#e0cfc8"}},
    {l:"Neige",    c:{fond:"#ffffff",accent:"#111111",texte:"#111111",surface:"#f5f5f5",texteMuted:"#888888",bordure:"#e5e5e5"}},
    {l:"Nuit",     c:{fond:"#0d1117",accent:"#58a6ff",texte:"#c9d1d9",surface:"#161b22",texteMuted:"#8b949e",bordure:"#30363d"}},
    {l:"Lavande",  c:{fond:"#faf5ff",accent:"#9333ea",texte:"#1e0a3c",surface:"#f5eeff",texteMuted:"#7e5bab",bordure:"#dde3ee"}},
  ];

  return (
    <div className="p-4 space-y-5">
      <div className="space-y-2.5">{FIELDS.map(f=>(
        <FCol key={f.k} label={f.l} value={(config.colors as any)[f.k]||"#888888"} onChange={v=>setColors({[f.k]:v})} />
      ))}</div>
      <div>
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Palettes prêtes à l'emploi</p>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map(p=>(
            <button key={p.l} onClick={()=>setColors(p.c)} className="group flex flex-col items-center gap-1.5">
              <div className="w-full h-8 rounded-lg overflow-hidden flex border border-gray-200 group-hover:border-[#F5A623]/50 transition-all">
                <div className="flex-1" style={{backgroundColor:p.c.fond}} />
                <div className="flex-1" style={{backgroundColor:p.c.accent}} />
                <div className="flex-1" style={{backgroundColor:p.c.surface}} />
              </div>
              <span className="text-[13px] text-gray-500 group-hover:text-[#F5A623] transition-colors">{p.l}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Panel Typographie ────────────────────────────────────────────────────────
export function PanelTypo({ config, setFonts }: any) {
  const cats = [...new Set(FONTS.map(f=>f.cat))];
  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Police des titres</p>
        {cats.map(cat=>(
          <div key={cat}>
            <p className="text-[13px] text-gray-600 uppercase tracking-wider px-1 py-1">{cat}</p>
            {FONTS.filter(f=>f.cat===cat).map(f=>(
              <button key={f.v} onClick={()=>setFonts({titre:f.v})} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between ${config.fonts.titre===f.v?"bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/30":"text-gray-400 hover:bg-gray-100 hover:text-gray-300"}`}>
                <span>{f.label}</span>
                {config.fonts.titre===f.v && <Check size={10}/>}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 pt-4">
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Police du corps</p>
        {FONTS.filter(f=>f.cat==="Sans-serif").map(f=>(
          <button key={f.v} onClick={()=>setFonts({corps:f.v})} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between ${config.fonts.corps===f.v?"bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/30":"text-gray-400 hover:bg-gray-100"}`}>
            <span>{f.label}</span>{config.fonts.corps===f.v && <Check size={10}/>}
          </button>
        ))}
      </div>
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest">Paramètres</p>
        <FSel label="Poids titre" value={config.fonts.poidsTitre||"700"} onChange={v=>setFonts({poidsTitre:v})} opts={[{v:"400",l:"Normal"},{v:"500",l:"Medium"},{v:"600",l:"SemiBold"},{v:"700",l:"Bold"},{v:"800",l:"ExtraBold"},{v:"900",l:"Black"}]} />
        <FSel label="Taille de base" value={config.fonts.tailleBase||"16px"} onChange={v=>setFonts({tailleBase:v})} opts={[{v:"13px",l:"13px"},{v:"14px",l:"14px"},{v:"15px",l:"15px"},{v:"16px",l:"16px (défaut)"},{v:"17px",l:"17px"},{v:"18px",l:"18px"}]} />
        <FSel label="Espacement lettres" value={config.fonts.lettreEspacement||"normal"} onChange={v=>setFonts({lettreEspacement:v})} opts={[{v:"tight",l:"Resserré"},{v:"normal",l:"Normal"},{v:"wide",l:"Élargi"},{v:"ultra",l:"Ultra large"}]} />
        <FSel label="Hauteur de ligne" value={config.fonts.hauteurLigne||"normal"} onChange={v=>setFonts({hauteurLigne:v})} opts={[{v:"compact",l:"Compact (1.2)"},{v:"normal",l:"Normal (1.5)"},{v:"relaxed",l:"Aéré (1.8)"}]} />
        <FSel label="Casse des titres" value={config.fonts.transformTitre||"none"} onChange={v=>setFonts({transformTitre:v})} opts={[{v:"none",l:"Normal"},{v:"uppercase",l:"MAJUSCULES"},{v:"capitalize",l:"Chaque Mot"}]} />
      </div>
    </div>
  );
}

// ─── Panel Mise en page ───────────────────────────────────────────────────────
export function PanelLayout({ config, setLayout, set }: any) {
  const lay = config.layout || {};
  const RADII = [{v:"0px",l:"Aucun"},{v:"4px",l:"Légèrement"},{v:"8px",l:"Doux"},{v:"12px",l:"Standard"},{v:"16px",l:"Arrondi"},{v:"24px",l:"Pilule"},{v:"9999px",l:"Cercle"}];
  return (
    <div className="p-4 space-y-5">
      <div className="space-y-3">
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest">Conteneur</p>
        <FSel label="Largeur max" value={lay.largeurContainer||"1280px"} onChange={v=>setLayout({largeurContainer:v})} opts={[{v:"1024px",l:"1024px"},{v:"1280px",l:"1280px"},{v:"1440px",l:"1440px"},{v:"1600px",l:"1600px"},{v:"100%",l:"Pleine largeur"}]} />
        <FSel label="Padding sections" value={lay.paddingSection||"lg"} onChange={v=>setLayout({paddingSection:v})} opts={[{v:"sm",l:"Compact (2rem)"},{v:"md",l:"Normal (4rem)"},{v:"lg",l:"Large (6rem)"},{v:"xl",l:"XL (8rem)"}]} />
      </div>
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest">Produits</p>
        <FSel label="Colonnes desktop" value={String(lay.colonnesProduits||4)} onChange={v=>setLayout({colonnesProduits:Number(v)})} opts={[{v:"2",l:"2"},{v:"3",l:"3"},{v:"4",l:"4"},{v:"5",l:"5"}]} />
        <FSel label="Colonnes mobile" value={String(lay.colonnesMobile||2)} onChange={v=>setLayout({colonnesMobile:Number(v)})} opts={[{v:"1",l:"1"},{v:"2",l:"2"}]} />
        <FSel label="Style des cartes" value={lay.styleCarte||"shadow"} onChange={v=>setLayout({styleCarte:v})} opts={[{v:"shadow",l:"Ombre portée"},{v:"bordered",l:"Bordure"},{v:"flat",l:"Flat (sans relief)"},{v:"lifted",l:"Surélevé au survol"}]} />
      </div>
      <div className="border-t border-gray-200 pt-4">
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Coins arrondis</p>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {RADII.map(r=>(
            <button key={r.v} onClick={()=>set((p: ThemeConfig)=>({...p,radius:r.v}))} className={`flex flex-col items-center gap-1 p-2 border transition-all ${config.radius===r.v?"border-[#F5A623] bg-[#F5A623]/10":"border-gray-200 hover:border-gray-300"}`} style={{borderRadius:r.v==="0px"?"4px":r.v==="9999px"?"50%":r.v}}>
              <div className="w-4 h-4 border-2 border-current opacity-60" style={{borderRadius:r.v==="9999px"?"50%":r.v}} />
              <span className="text-[12px] text-gray-500">{r.l}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="number" min={0} max={999} value={parseInt(config.radius)||0} onChange={e=>set((p: ThemeConfig)=>({...p,radius:`${e.target.value}px`}))} className="w-16 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:border-[#F5A623]/50" />
          <span className="text-sm text-gray-600">px (custom)</span>
        </div>
      </div>
      <div className="border-t border-gray-200 pt-4 space-y-1.5">
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest mb-2">Ombres</p>
        {[{v:"none",l:"Aucune"},{v:"sm",l:"Légère"},{v:"md",l:"Moyenne"},{v:"lg",l:"Forte"},{v:"xl",l:"Très forte"}].map(o=>(
          <button key={o.v} onClick={()=>setLayout({ombre:o.v})} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between ${(lay.ombre||"md")===o.v?"bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/30":"text-gray-400 hover:bg-gray-100"}`}>
            <span>{o.l}</span>{(lay.ombre||"md")===o.v&&<Check size={10}/>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Panel Médias ─────────────────────────────────────────────────────────────
export function PanelMedias({ config, setSection, updateCustomSection }: any) {
  const sec = config.sections as any;
  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-[12px] text-gray-600 mb-4 leading-relaxed">Gérez les images et vidéos de chaque section. Utilisez des URLs directes (CDN, Cloudinary, Unsplash, etc.).</p>

        <div className="space-y-4">
          {/* Hero */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><ImageIcon size={12} /> Hero — Image de fond</p>
            <p className="text-[13px] text-gray-600">L'image de fond principale (bannière boutique) se configure dans <Link href="/dashboard/boutique" className="text-[#F5A623] underline">Ma boutique → Médias</Link></p>
            {sec.hero?.style === "slideshow" && (
              <div>
                <p className="text-[12px] text-gray-500 mb-2">Images du diaporama</p>
                {(sec.hero.slideshowImages||[""]).map((url: string, i: number) => (
                  <div key={i} className="flex gap-1 mb-1.5 items-center">
                    <FInp label="" value={url} onChange={v=>{ const imgs=[...(sec.hero.slideshowImages||[""])]; imgs[i]=v; setSection("hero",{slideshowImages:imgs}); }} />
                    {url && <img src={url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 border border-gray-200" onError={e=>(e.currentTarget.style.display="none")} />}
                  </div>
                ))}
                <button onClick={()=>setSection("hero",{slideshowImages:[...(sec.hero.slideshowImages||[""]),""]})} className="w-full text-[12px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1 hover:border-gray-300">+ Ajouter</button>
              </div>
            )}
          </div>

          {/* À propos */}
          {sec.about?.actif && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><BookOpen size={12} /> Notre histoire — Image</p>
              <FInp label="URL" value={sec.about?.imageUrl||""} onChange={v=>setSection("about",{imageUrl:v})} />
              {sec.about?.imageUrl && <img src={sec.about.imageUrl} alt="" className="w-full h-20 rounded-lg object-cover border border-gray-200" onError={e=>(e.currentTarget.style.display="none")} />}
            </div>
          )}

          {/* Bannière promo */}
          {sec.promo?.actif && sec.promo?.style === "image" && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Target size={12} /> Bannière promo — Image</p>
              <FInp label="URL" value={sec.promo?.imageUrl||""} onChange={v=>setSection("promo",{imageUrl:v})} />
            </div>
          )}

          {/* Custom sections with images/video */}
          {(config.customSections||[]).filter((s: any) => ["gallery","video","brands"].includes(s.type)).map((s: any) => (
            <div key={s.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold text-gray-700">{s.label}</p>
              {s.type === "video" && (
                <FInp label="URL vidéo" value={s.config.videoUrl||""} onChange={v=>updateCustomSection(s.id,{videoUrl:v})} />
              )}
              {s.type === "gallery" && (
                <div>
                  {(s.config.images||[]).map((url: string, i: number) => (
                    <div key={i} className="flex gap-1 mb-1.5 items-center">
                      <FInp label="" value={url} onChange={v=>{ const imgs=[...s.config.images]; imgs[i]=v; updateCustomSection(s.id,{images:imgs}); }} />
                      {url && <img src={url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 border border-gray-200" onError={e=>(e.currentTarget.style.display="none")} />}
                    </div>
                  ))}
                  <button onClick={()=>updateCustomSection(s.id,{images:[...(s.config.images||[]),""]})} className="w-full text-[12px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1 hover:border-gray-300">+ Ajouter</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Panel Animations ─────────────────────────────────────────────────────────
export function PanelAnimations({ config, setAnim }: any) {
  const anim = config.animations || {};

  const PRESETS = [
    { v: "luxury",   l: "Luxury",   desc: "Fade lent et élégant, tout en douceur" },
    { v: "dynamic",  l: "Dynamic",  desc: "Slides énergiques et rapides" },
    { v: "elegant",  l: "Elegant",  desc: "Montée douce avec léger délai" },
    { v: "playful",  l: "Playful",  desc: "Zoom & rebond joyeux" },
    { v: "none",     l: "Aucun",    desc: "Pas d'animation (statique)" },
  ];

  const PRESETS_SETTINGS: Record<string, any> = {
    luxury:  { global: "fade-in",   vitesse: "slow",   stagger: true,  parallax: false },
    dynamic: { global: "slide-left",vitesse: "fast",   stagger: false, parallax: true  },
    elegant: { global: "slide-up",  vitesse: "normal", stagger: true,  parallax: false },
    playful: { global: "zoom-in",   vitesse: "fast",   stagger: true,  parallax: false },
    none:    { global: "none",      vitesse: "normal", stagger: false, parallax: false },
  };

  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Présets d'animation</p>
        <div className="space-y-1.5">
          {PRESETS.map(p => (
            <button key={p.v} onClick={() => { setAnim({ preset: p.v, ...PRESETS_SETTINGS[p.v] }); }}
              className={`w-full text-left p-3 rounded-xl border transition-all ${(anim.preset||"elegant")===p.v?"border-[#F5A623]/50 bg-[#F5A623]/10":"border-gray-200 hover:border-gray-300"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{p.l}</span>
                {(anim.preset||"elegant")===p.v && <Check size={11} className="text-[#F5A623]" />}
              </div>
              <p className="text-[12px] text-gray-500 mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest">Personnalisation</p>
        <FSel label="Animation globale" value={anim.global||"slide-up"} onChange={v=>setAnim({global:v})} opts={[
          {v:"none",l:"Aucune"},{v:"fade-in",l:"Fondu"},{v:"slide-up",l:"Glissement vers le haut"},
          {v:"slide-left",l:"Glissement depuis la gauche"},{v:"zoom-in",l:"Zoom entrant"},
          {v:"flip",l:"Retournement 3D"},{v:"blur-in",l:"Apparition floue"},
        ]} />
        <FSel label="Vitesse" value={anim.vitesse||"normal"} onChange={v=>setAnim({vitesse:v})} opts={[{v:"fast",l:"Rapide (0.4s)"},{v:"normal",l:"Normal (0.6s)"},{v:"slow",l:"Lent (0.9s)"}]} />
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest">Effets avancés</p>
        <FCheck label="Décalage entre sections (stagger)" checked={anim.stagger!==false} onChange={v=>setAnim({stagger:v})} />
        <FCheck label="Effet parallaxe sur le hero" checked={anim.parallax||false} onChange={v=>setAnim({parallax:v})} />
        <FCheck label="Défilement fluide (smooth scroll)" checked={anim.smoothScroll!==false} onChange={v=>setAnim({smoothScroll:v})} />
      </div>

      <div className="border-t border-gray-200 pt-4">
        <p className="text-[13px] text-gray-600 leading-relaxed">Les animations sont appliquées via CSS injecté dans votre boutique. Sauvegardez pour voir le résultat en prévisualisation.</p>
      </div>
    </div>
  );
}

// ─── Panel Boutons & Nav ──────────────────────────────────────────────────────
export function PanelBoutons({ config, setBoutons, setNavStyle }: any) {
  const b = config.boutons || {};
  const nav = config.navigationStyle || {};

  const NAV_TYPES = [
    { v:"classic",           l:"Classique",           desc:"Logo gauche, menu droite" },
    { v:"centered",          l:"Centré",              desc:"Menu | Logo centre | CTA" },
    { v:"floating",          l:"Floating pill",       desc:"Barre flottante arrondie en haut" },
    { v:"minimal",           l:"Minimal",             desc:"Logo + hamburger uniquement" },
    { v:"mega",              l:"Mega menu",           desc:"Avec dropdown de collections" },
    { v:"transparent-scroll",l:"Transparent → Opaque",desc:"Transparente puis solide au scroll" },
  ];

  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Style des boutons</p>
        <div className="space-y-1.5">
          {[{v:"filled",l:"Plein"},{v:"outlined",l:"Contour"},{v:"ghost",l:"Fantôme"},{v:"pill",l:"Pilule (arrondi total)"},{v:"square",l:"Carré (sans arrondi)"}].map(s=>(
            <button key={s.v} onClick={()=>setBoutons({style:s.v})} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${(b.style||"filled")===s.v?"border-[#F5A623]/50 bg-[#F5A623]/10":"border-gray-200 hover:border-gray-300"}`}>
              <span className="text-sm text-gray-700">{s.l}</span>
              <div className="w-16 h-6 flex items-center justify-center text-[13px] font-semibold border"
                style={{ backgroundColor: ["outlined","ghost"].includes(s.v)?"transparent":config.colors.accent, color: ["outlined","ghost"].includes(s.v)?config.colors.accent:config.colors.fond, borderColor: s.v!=="ghost"?config.colors.accent:"transparent", borderRadius: s.v==="pill"?"999px":s.v==="square"?"0":"8px", textDecoration: s.v==="ghost"?"underline":"none" }}>
                Acheter
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest">Taille & effet</p>
        <div className="grid grid-cols-4 gap-1.5">
          {[{v:"sm",l:"XS"},{v:"md",l:"M"},{v:"lg",l:"L"},{v:"xl",l:"XL"}].map(s=>(
            <button key={s.v} onClick={()=>setBoutons({taille:s.v})} className={`py-2 rounded-xl text-sm font-semibold border transition-all ${(b.taille||"md")===s.v?"border-[#F5A623]/50 bg-[#F5A623]/10 text-[#F5A623]":"border-gray-200 text-gray-500 hover:border-gray-300"}`}>{s.l}</button>
          ))}
        </div>
        <FSel label="Effet au survol" value={b.hover||"scale"} onChange={v=>setBoutons({hover:v})} opts={[{v:"lighten",l:"Éclaircir"},{v:"darken",l:"Assombrir"},{v:"scale",l:"Agrandir"},{v:"glow",l:"Lueur (glow)"},{v:"slide",l:"Glissement"}]} />
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest">Type de navigation</p>
        <div className="space-y-1.5">
          {NAV_TYPES.map(t=>(
            <button key={t.v} onClick={()=>setNavStyle({type:t.v})} className={`w-full text-left p-3 rounded-xl border transition-all ${(nav.type||"classic")===t.v?"border-[#F5A623]/50 bg-[#F5A623]/10":"border-gray-200 hover:border-gray-300"}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{t.l}</span>
                {(nav.type||"classic")===t.v && <Check size={10} className="text-[#F5A623]"/>}
              </div>
              <p className="text-[12px] text-gray-500 mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest">Style navbar</p>
        <FSel label="Apparence" value={nav.style||"light"} onChange={v=>setNavStyle({style:v})} opts={[{v:"light",l:"Claire (fond blanc)"},{v:"dark",l:"Sombre (fond noir)"},{v:"glass",l:"Verre (glassmorphism)"},{v:"transparent",l:"Transparente"}]} />
        <FSel label="Hauteur" value={nav.hauteur||"64px"} onChange={v=>setNavStyle({hauteur:v})} opts={[{v:"48px",l:"Compact (48px)"},{v:"64px",l:"Standard (64px)"},{v:"80px",l:"Large (80px)"}]} />
        <FCheck label="Navigation fixe (sticky)" checked={nav.sticky!==false} onChange={v=>setNavStyle({sticky:v})} />
        <FCheck label="Barre de recherche" checked={nav.showSearch!==false} onChange={v=>setNavStyle({showSearch:v})} />
        <FCheck label="Wishlist / favoris" checked={nav.showWishlist||false} onChange={v=>setNavStyle({showWishlist:v})} />
      </div>
    </div>
  );
}

// ─── Panel Modèles — bibliothèque AXSO Design, applicable sans quitter le Constructeur ──
export function PanelModeles({ tenant, onApplied }: { tenant: any; onApplied: () => Promise<void> }) {
  const [applying, setApplying] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [produits, setProduits] = useState<{ nom: string; prix: number; description?: string }[]>([]);

  // Vrais produits de la boutique injectés dans les aperçus (vide → produits de démo du gabarit).
  useEffect(() => {
    fetch("/api/produits?limit=6").then((r) => r.json())
      .then((d) => setProduits((d.produits ?? []).map((p: any) => ({ nom: p.nom, prix: p.prix, description: p.description ?? "" }))))
      .catch(() => {});
  }, []);
  const apercuParams = `&nom=${encodeURIComponent(tenant?.nomBoutique || "Ma Boutique")}&devise=${encodeURIComponent(tenant?.devise || "XAF")}&produits=${encodeURIComponent(JSON.stringify(produits))}`;

  function estActif(fichier: string) {
    // Theme.slug suit la convention `axso-design-<fichier sans .html>-<timestamp>`
    // posée par provisionerThemeDepuisLibrairie (lib/axso-design-library.ts).
    return typeof tenant?.themeSlug === "string" && tenant.themeSlug.startsWith(`axso-design-${fichier.replace(".html", "")}-`);
  }

  async function appliquer(fichier: string) {
    setApplying(fichier);
    setErreur(null);
    try {
      const res = await fetch("/api/themes/provisionner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fichier }),
      });
      if (!res.ok) throw new Error();
      await onApplied();
    } catch {
      setErreur("Erreur lors de l'application du modèle — réessaie dans un instant.");
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="p-3 space-y-3">
      <p className="text-[13px] text-gray-500 leading-relaxed px-0.5">
        Les designs proposés par AXIA à la création de ta boutique — tes vrais produits sont branchés automatiquement.
      </p>
      {erreur && <p className="text-[13px] text-red-600 px-0.5">{erreur}</p>}
      <div className="grid grid-cols-2 gap-2.5">
        {MANIFESTE_LIBRAIRIE.filter((e) => !tenant?.designsOrigine?.length || tenant.designsOrigine.includes(e.fichier)).map((e) => {
          const actif = estActif(e.fichier);
          const busy = applying === e.fichier;
          return (
            <button
              key={e.fichier}
              onClick={() => !busy && !actif && appliquer(e.fichier)}
              disabled={busy}
              className={`relative rounded-xl border overflow-hidden text-left transition-all ${actif ? "border-[#F5A623] ring-1 ring-[#F5A623]" : "border-gray-200 hover:border-gray-300"} ${busy ? "opacity-60" : ""}`}
            >
              {/* Aperçu réel du design (même rendu que les propositions de l'inscription) */}
              <div className="relative h-[115px] overflow-hidden" style={{ background: e.couleurs.fond || "#f5f5f5" }}>
                <iframe
                  src={`/api/preview-theme?fichier=${encodeURIComponent(e.fichier)}${apercuParams}`}
                  title={e.nom}
                  loading="lazy"
                  sandbox="allow-same-origin allow-scripts"
                  scrolling="no"
                  className="absolute top-0 left-0 border-0 pointer-events-none origin-top-left"
                  style={{ width: 960, height: 720, transform: "scale(0.16)" }}
                />
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[13px] font-semibold text-gray-800 truncate">{e.nom}</p>
                <p className="text-[11px] text-gray-400 truncate">{e.ambiance.slice(0, 2).join(" · ")}</p>
              </div>
              {actif && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#F5A623] flex items-center justify-center">
                  <Check size={10} className="text-black" />
                </span>
              )}
              {busy && (
                <span className="absolute inset-0 bg-white/70 flex items-center justify-center">
                  <RefreshCw size={14} className="animate-spin text-[#F5A623]" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Panel Avancé ─────────────────────────────────────────────────────────────
export function PanelAvance({ config, set, tenant, onReset }: any) {
  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest mb-2">CSS personnalisé</p>
        <p className="text-[13px] text-gray-600 mb-3 leading-relaxed">Injecté dans toutes les pages de votre boutique. Utilisez les classes Tailwind ou du CSS natif.</p>
        <textarea value={config.customCss||""} onChange={e=>set((p: ThemeConfig)=>({...p,customCss:e.target.value}))} rows={14}
          placeholder={`/* Exemples */\n.hero h1 { letter-spacing: 0.05em; }\n.product-card { transition: all 0.4s; }\n\n/* Variables CSS */\n:root {\n  --radius-custom: 20px;\n}`}
          className="w-full bg-[#080810] border border-gray-200 rounded-xl px-3 py-3 text-sm text-green-400 font-mono focus:outline-none focus:border-[#F5A623]/50 resize-none leading-relaxed" />
      </div>
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <p className="text-[12px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Actions</p>
        <Link href="/dashboard/themes" className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 text-sm text-gray-400 hover:text-gray-300 transition-all">
          <span>Changer de thème de base</span><ChevronRight size={12}/>
        </Link>
        <Link href="/dashboard/boutique" className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 text-sm text-gray-400 hover:text-gray-300 transition-all">
          <span>Logo, bannière & SEO</span><ChevronRight size={12}/>
        </Link>
        <button onClick={() => { if (typeof navigator !== "undefined") navigator.clipboard.writeText(JSON.stringify(config, null, 2)); }} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 text-sm text-gray-400 hover:text-gray-300 transition-all">
          <span>Exporter la config JSON</span><Copy size={11}/>
        </button>
        <button onClick={onReset} className="w-full px-3 py-2.5 rounded-xl border border-red-500/20 hover:border-red-400/40 text-sm text-red-500/60 hover:text-red-400 transition-all">
          Réinitialiser toutes les personnalisations
        </button>
      </div>
    </div>
  );
}

// ─── Panel Fiche Produit — Shopify-style section editor ──────────────────────
const PRODUIT_SECTION_META: Record<string, { Icon: any; desc: string }> = {
  gallery:      { Icon: ImageIcon,     desc: "Photos du produit" },
  info:         { Icon: FileText,      desc: "Nom, prix, stock, fil d'Ariane" },
  variants:     { Icon: Layers,        desc: "Tailles, couleurs…" },
  quantity:     { Icon: ShoppingCart,  desc: "Quantité et boutons d'achat" },
  trust:        { Icon: Shield,        desc: "Badges de réassurance" },
  description:  { Icon: BookOpen,      desc: "Description et livraison" },
  reviews:      { Icon: Star,          desc: "Avis clients" },
  similar:      { Icon: LayoutGrid,    desc: "Produits similaires" },
  richtext:     { Icon: FileText,      desc: "Bloc de texte avec titre et bouton CTA" },
  features:     { Icon: Zap,           desc: "Grille d'avantages avec icône et description" },
  howto:        { Icon: BookOpen,      desc: "Étapes numérotées ou accordéon" },
  banner:       { Icon: ImageIcon,     desc: "Image pleine largeur avec texte overlay" },
  video:        { Icon: Video,         desc: "YouTube, Vimeo ou fichier mp4" },
  faq:          { Icon: HelpCircle,    desc: "Questions fréquentes en accordéon" },
  specs:        { Icon: BarChart3,     desc: "Tableau des spécifications techniques" },
  ingredients:  { Icon: FileText,      desc: "Liste détaillée de composition" },
  testimonials: { Icon: MessageCircle, desc: "Citations et avis clients mis en avant" },
  sizeguide:    { Icon: ArrowUpDown,   desc: "Tableau de correspondance des tailles" },
  guarantee:    { Icon: Shield,        desc: "Informations garantie et service client" },
  bundle:       { Icon: Layers,        desc: "Produits fréquemment achetés ensemble" },
  comparison:   { Icon: LayoutGrid,    desc: "Comparez avec d'autres versions" },
  countdown:    { Icon: Timer,         desc: "Urgence pour une offre limitée" },
  social:       { Icon: Share2,        desc: "Boutons Facebook, WhatsApp, lien copie" },
};

const LAYOUT_OPTIONS = [
  { v: "amazon",    l: "Amazon",       desc: "Galerie + infos côte à côte" },
  { v: "classic",   l: "Classique",    desc: "Image en haut, infos dessous" },
  { v: "minimal",   l: "Minimal",      desc: "Épuré, sans sidebar — idéal pour les services" },
  { v: "fullwidth", l: "Pleine largeur", desc: "Image en plein écran avec overlay d'infos" },
];

// Galerie et infos sont la charpente de la fiche : pas de style par section.
const STYLE_DISABLED_TYPES = new Set(["gallery", "info"]);

function ProduitSectionSettings({ section, update, updateStyle }: { section: ProductPageSection; update: (id: string, patch: Record<string, any>) => void; updateStyle: (id: string, patch: Record<string, any>) => void }) {
  return (
    <>
      <SectionTypeSettings section={section} update={update} />
      {!STYLE_DISABLED_TYPES.has(section.type) && <SectionStylePanel section={section} updateStyle={updateStyle} />}
    </>
  );
}

function SectionStylePanel({ section, updateStyle }: { section: ProductPageSection; updateStyle: (id: string, patch: Record<string, any>) => void }) {
  const st = section.style || {};
  const up = (patch: Record<string, any>) => updateStyle(section.id, patch);
  const bgActive = !!st.bgColor;
  return (
    <div className="px-3 pb-3 space-y-2.5 border-t border-gray-200 pt-2.5">
      <p className="text-[13px] text-gray-500 font-black uppercase tracking-[0.16em]">Style de la section</p>
      <FSel label="Taille du texte" value={st.fontScale || "md"} onChange={v => up({ fontScale: v })} opts={[
        { v: "sm", l: "Petite" }, { v: "md", l: "Normale" }, { v: "lg", l: "Grande" }, { v: "xl", l: "Très grande" },
      ]} />
      <div className="flex items-center justify-between py-1">
        <span className="text-[13px] text-gray-400">Fond coloré</span>
        <button onClick={() => up({ bgColor: bgActive ? undefined : "#F8F8F6" })} className="flex-shrink-0">
          {bgActive ? <ToggleRight size={17} style={{ color: "#F5A623" }} /> : <ToggleLeft size={17} className="text-gray-700" />}
        </button>
      </div>
      {bgActive && <FCol label="Couleur de fond" value={st.bgColor || "#F8F8F6"} onChange={v => up({ bgColor: v })} />}
      <FCol label="Couleur du texte" value={st.textColor || "#111111"} onChange={v => up({ textColor: v })} />
      <div className="grid grid-cols-2 gap-2">
        <FSel label="Espacement interne" value={st.paddingY || "none"} onChange={v => up({ paddingY: v })} opts={[
          { v: "none", l: "Aucun" }, { v: "sm", l: "Petit" }, { v: "md", l: "Moyen" }, { v: "lg", l: "Grand" }, { v: "xl", l: "Très grand" },
        ]} />
        <FSel label="Marge extérieure" value={st.marginY || "none"} onChange={v => up({ marginY: v })} opts={[
          { v: "none", l: "Par défaut" }, { v: "sm", l: "Petite" }, { v: "md", l: "Moyenne" }, { v: "lg", l: "Grande" },
        ]} />
      </div>
      <FSel label="Largeur du contenu" value={st.maxWidth || "full"} onChange={v => up({ maxWidth: v })} opts={[
        { v: "full", l: "Pleine largeur" }, { v: "medium", l: "Moyenne" }, { v: "narrow", l: "Étroite" },
      ]} />
      <FSel label="Alignement" value={st.align || "left"} onChange={v => up({ align: v })} opts={[
        { v: "left", l: "Gauche" }, { v: "center", l: "Centré" },
      ]} />
    </div>
  );
}

// ─── Éditeurs génériques (listes d'éléments, tableaux, icônes) ────────────────
type Champ = { cle: string; label: string; type?: "text" | "textarea" | "icone" | "image" | "note" };

function FIcone({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const estImage = /^(https?:|\/|data:image)/.test(value || "");
  return (
    <div>
      <label className="block text-[12px] text-gray-500 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        {estImage
          ? <img src={value} alt="" className="w-9 h-9 rounded-lg object-contain bg-white border border-gray-200" />
          : <input value={value || ""} onChange={e => onChange(e.target.value)} maxLength={4} placeholder="✓" className="w-12 text-center bg-gray-100 border border-gray-200 rounded-lg px-2 py-2 text-sm" />}
        <label className="text-[12px] text-[#C77C0A] font-semibold cursor-pointer hover:underline">
          {estImage ? "Changer" : "Envoyer une icône"}
          <input type="file" accept="image/*" className="hidden" onChange={async e => {
            const f = e.target.files?.[0]; if (!f) return;
            const fd = new FormData(); fd.append("file", f);
            const r = await fetch("/api/upload", { method: "POST", body: fd }).then(x => x.json()).catch(() => null);
            if (r?.url) onChange(r.url);
          }} />
        </label>
        {estImage && <button onClick={() => onChange("✓")} className="text-[12px] text-gray-500 hover:text-red-500">Retirer</button>}
      </div>
    </div>
  );
}

function ListeItems({ titre, items, champs, onChange, nouvel }: { titre: string; items: any[]; champs: Champ[]; onChange: (items: any[]) => void; nouvel: () => any }) {
  const maj = (i: number, patch: any) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const bouger = (i: number, d: number) => { const n = [...items]; const [x] = n.splice(i, 1); n.splice(Math.max(0, Math.min(n.length, i + d)), 0, x); onChange(n); };
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-gray-500 font-semibold">{titre}</p>
      {items.map((item, i) => (
        <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-2 space-y-1.5">
          <div className="flex items-center justify-end gap-1 -mb-1">
            <button onClick={() => bouger(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-[12px] px-1">↑</button>
            <button onClick={() => bouger(i, 1)} disabled={i === items.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-[12px] px-1">↓</button>
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-red-500/50 hover:text-red-500 px-1"><Trash2 size={11} /></button>
          </div>
          {champs.map(c => c.type === "icone"
            ? <FIcone key={c.cle} label={c.label} value={item[c.cle] || ""} onChange={v => maj(i, { [c.cle]: v })} />
            : c.type === "note"
              ? <FSel key={c.cle} label={c.label} value={String(item[c.cle] ?? 5)} onChange={v => maj(i, { [c.cle]: Number(v) })} opts={[5, 4, 3, 2, 1].map(n => ({ v: String(n), l: "★".repeat(n) }))} />
              : <FInp key={c.cle} label={c.label} value={item[c.cle] || ""} onChange={v => maj(i, { [c.cle]: v })} multiline={c.type === "textarea"} />)}
        </div>
      ))}
      <button onClick={() => onChange([...items, nouvel()])}
        className="w-full text-[12px] text-gray-600 border border-dashed border-gray-300 rounded-lg py-1.5 hover:border-[#F5A623] hover:text-[#C77C0A] transition-colors">
        + Ajouter
      </button>
    </div>
  );
}

function TableEdit({ headers, rows, onChange }: { headers: string[]; rows: { cells: string[] }[]; onChange: (p: { headers?: string[]; rows?: { cells: string[] }[] }) => void }) {
  const nbCol = headers.length;
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-gray-500 font-semibold">En-têtes</p>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${nbCol}, minmax(0,1fr))` }}>
        {headers.map((h, j) => <input key={j} value={h} onChange={e => onChange({ headers: headers.map((x, k) => (k === j ? e.target.value : x)) })} className="bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] font-semibold min-w-0" />)}
      </div>
      <p className="text-[12px] text-gray-500 font-semibold">Lignes</p>
      {rows.map((r, i) => (
        <div key={i} className="flex gap-1 items-center">
          <div className="grid gap-1 flex-1" style={{ gridTemplateColumns: `repeat(${nbCol}, minmax(0,1fr))` }}>
            {Array.from({ length: nbCol }, (_, j) => (
              <input key={j} value={r.cells[j] ?? ""} onChange={e => onChange({ rows: rows.map((x, k) => (k === i ? { cells: Array.from({ length: nbCol }, (_, m) => (m === j ? e.target.value : x.cells[m] ?? "")) } : x)) })} className="bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] min-w-0" />
            ))}
          </div>
          <button onClick={() => onChange({ rows: rows.filter((_, k) => k !== i) })} className="text-red-500/50 hover:text-red-500"><Trash2 size={11} /></button>
        </div>
      ))}
      <div className="flex gap-1.5">
        <button onClick={() => onChange({ rows: [...rows, { cells: Array(nbCol).fill("") }] })} className="flex-1 text-[12px] text-gray-600 border border-dashed border-gray-300 rounded-lg py-1.5 hover:border-[#F5A623]">+ Ligne</button>
        <button onClick={() => onChange({ headers: [...headers, "Colonne"], rows: rows.map(r => ({ cells: [...r.cells, ""] })) })} className="flex-1 text-[12px] text-gray-600 border border-dashed border-gray-300 rounded-lg py-1.5 hover:border-[#F5A623]">+ Colonne</button>
        {nbCol > 2 && <button onClick={() => onChange({ headers: headers.slice(0, -1), rows: rows.map(r => ({ cells: r.cells.slice(0, nbCol - 1) })) })} className="text-[12px] text-gray-500 px-2 hover:text-red-500">− Col.</button>}
      </div>
    </div>
  );
}

function Bascule({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[13px] text-gray-500">{label}</span>
      <button onClick={() => onChange(!value)} className="flex-shrink-0">
        {value ? <ToggleRight size={17} style={{ color: "#F5A623" }} /> : <ToggleLeft size={17} className="text-gray-700" />}
      </button>
    </div>
  );
}

function Bloc({ children }: { children: React.ReactNode }) {
  return <div className="px-3 pb-3 space-y-2.5 border-t border-gray-200 pt-2.5">{children}</div>;
}

function SectionTypeSettings({ section, update }: { section: ProductPageSection; update: (id: string, patch: Record<string, any>) => void }) {
  // Valeurs par défaut complétées : le marchand voit (et édite) exactement ce qui s'affiche.
  const c: Record<string, any> = { ...SECTIONS_FICHE[section.type]?.defaut(), ...section.config };
  const up = (patch: Record<string, any>) => update(section.id, patch);
  const titre = <FInp label="Titre" value={c.titre || ""} onChange={v => up({ titre: v })} />;

  switch (section.type) {
    case "gallery": return (
      <Bloc>
        <FSel label="Style de galerie" value={c.style} onChange={v => up({ style: v })} opts={[
          { v: "vertical-thumbs", l: "Miniatures verticales (Amazon)" }, { v: "horizontal-thumbs", l: "Miniatures horizontales" }, { v: "dots", l: "Points" },
        ]} />
        <Bascule label="Zoom au survol" value={c.zoom !== false} onChange={v => up({ zoom: v })} />
        <Bascule label="Panneau fixe au scroll" value={c.sticky !== false} onChange={v => up({ sticky: v })} />
      </Bloc>
    );
    case "info": return (
      <Bloc>
        <Bascule label="Fil d'Ariane" value={c.breadcrumbs !== false} onChange={v => up({ breadcrumbs: v })} />
        <Bascule label="Badges promo et confiance" value={c.badges !== false} onChange={v => up({ badges: v })} />
        <Bascule label="Indicateur de stock" value={c.stock !== false} onChange={v => up({ stock: v })} />
      </Bloc>
    );
    case "variants": return (
      <Bloc>
        <FSel label="Affichage" value={c.style} onChange={v => up({ style: v })} opts={[
          { v: "boutons", l: "Boutons" }, { v: "pastilles", l: "Pastilles arrondies" }, { v: "liste", l: "Liste déroulante" },
        ]} />
        <div className="grid grid-cols-2 gap-2">
          <FSel label="Taille du texte" value={c.taille} onChange={v => up({ taille: v })} opts={[{ v: "sm", l: "Petite" }, { v: "md", l: "Moyenne" }, { v: "lg", l: "Grande" }]} />
          <FSel label="Espacement" value={c.espacement} onChange={v => up({ espacement: v })} opts={[{ v: "serre", l: "Serré" }, { v: "normal", l: "Normal" }, { v: "large", l: "Large" }]} />
        </div>
        <Bascule label="Afficher le nom (Taille, Couleur…)" value={c.afficherLibelle !== false} onChange={v => up({ afficherLibelle: v })} />
        <p className="text-[12px] text-gray-400 leading-relaxed">Les valeurs (S, M, Rouge…) se gèrent sur chaque produit.</p>
      </Bloc>
    );
    case "quantity": return (
      <Bloc>
        <Bascule label="Sélecteur de quantité" value={c.afficherQuantite !== false} onChange={v => up({ afficherQuantite: v })} />
        <FInp label="Texte du bouton (vide = « Ajouter au panier »)" value={c.texteBouton || ""} onChange={v => up({ texteBouton: v })} />
        <FCol label="Couleur du bouton" value={c.couleurBouton || "#F5A623"} onChange={v => up({ couleurBouton: v })} />
        <FCol label="Couleur du texte du bouton" value={c.couleurTexteBouton || "#FFFFFF"} onChange={v => up({ couleurTexteBouton: v })} />
        {(c.couleurBouton || c.couleurTexteBouton) && <button onClick={() => up({ couleurBouton: "", couleurTexteBouton: "" })} className="text-[12px] text-gray-500 hover:underline">Revenir aux couleurs du thème</button>}
        <Bascule label="Bouton « Acheter maintenant »" value={c.afficherAcheterMaintenant !== false} onChange={v => up({ afficherAcheterMaintenant: v })} />
        <Bascule label="Bouton WhatsApp" value={c.afficherWhatsApp !== false} onChange={v => up({ afficherWhatsApp: v })} />
      </Bloc>
    );
    case "trust": return (
      <Bloc>
        <div className="grid grid-cols-2 gap-2">
          <FSel label="Disposition" value={c.disposition} onChange={v => up({ disposition: v })} opts={[{ v: "grille", l: "Grille" }, { v: "liste", l: "Liste" }]} />
          <FSel label="Colonnes" value={String(c.colonnes)} onChange={v => up({ colonnes: Number(v) })} opts={[{ v: "2", l: "2" }, { v: "3", l: "3" }, { v: "4", l: "4" }]} />
        </div>
        <ListeItems titre="Badges" items={c.items || []} onChange={items => up({ items })} nouvel={() => ({ icone: "✓", texte: "Nouveau badge" })}
          champs={[{ cle: "icone", label: "Icône (emoji ou image)", type: "icone" }, { cle: "texte", label: "Texte" }]} />
        <Bascule label="Encadré « Vendu par »" value={c.afficherVendeur !== false} onChange={v => up({ afficherVendeur: v })} />
      </Bloc>
    );
    case "description": return (
      <Bloc>
        <Bascule label="Description enrichie par IA" value={c.ai !== false} onChange={v => up({ ai: v })} />
        <Bascule label="Onglet « Livraison & retours »" value={c.afficherLivraison !== false} onChange={v => up({ afficherLivraison: v })} />
        {c.afficherLivraison !== false && (
          <ListeItems titre="Contenu de l'onglet livraison" items={c.livraison || []} onChange={livraison => up({ livraison })} nouvel={() => ({ titre: "Nouveau point", texte: "" })}
            champs={[{ cle: "titre", label: "Titre" }, { cle: "texte", label: "Texte", type: "textarea" }]} />
        )}
      </Bloc>
    );
    case "reviews": return (
      <Bloc>
        {titre}
        <div className="grid grid-cols-2 gap-2">
          <FSel label="Disposition" value={c.disposition} onChange={v => up({ disposition: v })} opts={[{ v: "grille", l: "Grille" }, { v: "liste", l: "Liste" }]} />
          <FSel label="Avis affichés" value={String(c.max)} onChange={v => up({ max: Number(v) })} opts={[{ v: "4", l: "4" }, { v: "8", l: "8" }, { v: "20", l: "20" }]} />
        </div>
        <FCol label="Couleur des étoiles" value={c.couleurEtoiles || "#F5A623"} onChange={v => up({ couleurEtoiles: v })} />
        <Bascule label="Résumé des notes" value={c.afficherResume !== false} onChange={v => up({ afficherResume: v })} />
        <Bascule label="Badge « Achat vérifié »" value={c.afficherVerifie !== false} onChange={v => up({ afficherVerifie: v })} />
        <Bascule label="Formulaire « Laisser un avis »" value={c.afficherFormulaire !== false} onChange={v => up({ afficherFormulaire: v })} />
      </Bloc>
    );
    case "similar": return (
      <Bloc>
        {titre}
        <FSel label="Nombre de produits" value={String(c.count)} onChange={v => up({ count: Number(v) })} opts={[{ v: "4", l: "4 produits" }, { v: "6", l: "6 produits" }, { v: "8", l: "8 produits" }]} />
      </Bloc>
    );
    case "richtext": return (
      <Bloc>{titre}<FInp label="Texte" value={c.texte || ""} onChange={v => up({ texte: v })} multiline /><FInp label="Bouton CTA (vide = masqué)" value={c.ctaTexte || ""} onChange={v => up({ ctaTexte: v })} /></Bloc>
    );
    case "features": case "guarantee": return (
      <Bloc>{titre}
        <ListeItems titre="Éléments" items={c.items || []} onChange={items => up({ items })} nouvel={() => ({ icone: "✓", titre: "Titre", texte: "" })}
          champs={[{ cle: "icone", label: "Icône", type: "icone" }, { cle: "titre", label: "Titre" }, { cle: "texte", label: "Texte", type: "textarea" }]} />
      </Bloc>
    );
    case "howto": return (
      <Bloc>{titre}
        <FSel label="Présentation" value={c.style} onChange={v => up({ style: v })} opts={[{ v: "etapes", l: "Étapes numérotées" }, { v: "accordeon", l: "Accordéon" }]} />
        <ListeItems titre="Étapes" items={c.steps || []} onChange={steps => up({ steps })} nouvel={() => ({ num: String((c.steps?.length ?? 0) + 1).padStart(2, "0"), titre: "Nouvelle étape", texte: "" })}
          champs={[{ cle: "num", label: "Numéro" }, { cle: "titre", label: "Titre" }, { cle: "texte", label: "Texte", type: "textarea" }]} />
      </Bloc>
    );
    case "banner": return (
      <Bloc>{titre}
        <FInp label="Texte" value={c.texte || ""} onChange={v => up({ texte: v })} multiline />
        <ImageUpload value={c.imageUrl || ""} onChange={(url: string) => up({ imageUrl: url })} onRemove={() => up({ imageUrl: "" })} label="Image de fond" aspectRatio="banner" />
        <FInp label="Texte du bouton" value={c.ctaTexte || ""} onChange={v => up({ ctaTexte: v })} />
      </Bloc>
    );
    case "video": return (
      <Bloc>
        <FInp label="Titre (optionnel)" value={c.titre || ""} onChange={v => up({ titre: v })} />
        <FInp label="URL (YouTube, Vimeo, .mp4)" value={c.videoUrl || ""} onChange={v => up({ videoUrl: v })} />
        <Bascule label="Lecture automatique" value={!!c.autoplay} onChange={v => up({ autoplay: v })} />
      </Bloc>
    );
    case "faq": return (
      <Bloc>{titre}
        <ListeItems titre="Questions" items={c.items || []} onChange={items => up({ items })} nouvel={() => ({ question: "Question ?", reponse: "Réponse ici." })}
          champs={[{ cle: "question", label: "Question" }, { cle: "reponse", label: "Réponse", type: "textarea" }]} />
      </Bloc>
    );
    case "specs": return (
      <Bloc>{titre}
        <ListeItems titre="Lignes" items={c.rows || []} onChange={rows => up({ rows })} nouvel={() => ({ cle: "", valeur: "" })}
          champs={[{ cle: "cle", label: "Caractéristique" }, { cle: "valeur", label: "Valeur" }]} />
      </Bloc>
    );
    case "ingredients": return (
      <Bloc>{titre}
        <FInp label="Introduction" value={c.texte || ""} onChange={v => up({ texte: v })} multiline />
        <ListeItems titre="Composants" items={c.items || []} onChange={items => up({ items })} nouvel={() => ({ nom: "Composant", desc: "" })}
          champs={[{ cle: "nom", label: "Nom" }, { cle: "desc", label: "Détail", type: "textarea" }]} />
      </Bloc>
    );
    case "testimonials": return (
      <Bloc>{titre}
        <ListeItems titre="Témoignages" items={c.items || []} onChange={items => up({ items })} nouvel={() => ({ nom: "Client", note: 5, texte: "", avatar: "" })}
          champs={[{ cle: "nom", label: "Nom" }, { cle: "note", label: "Note", type: "note" }, { cle: "texte", label: "Témoignage", type: "textarea" }, { cle: "avatar", label: "Photo (URL, optionnel)" }]} />
      </Bloc>
    );
    case "sizeguide": case "comparison": return (
      <Bloc>{titre}<TableEdit headers={c.headers || []} rows={c.rows || []} onChange={up} /></Bloc>
    );
    case "bundle": return (
      <Bloc>{titre}
        <ListeItems titre="Produits du pack" items={c.items || []} onChange={items => up({ items })} nouvel={() => ({ nom: "Produit", imageUrl: "", prix: "" })}
          champs={[{ cle: "nom", label: "Nom" }, { cle: "prix", label: "Prix affiché" }, { cle: "imageUrl", label: "Image (URL)" }]} />
        <FInp label="Texte du bouton" value={c.ctaTexte || ""} onChange={v => up({ ctaTexte: v })} />
      </Bloc>
    );
    case "countdown": return (
      <Bloc>{titre}
        <FInp label="Sous-texte" value={c.texte || ""} onChange={v => up({ texte: v })} multiline />
        <div>
          <label className="block text-[12px] text-gray-500 mb-1">Date de fin</label>
          <input type="datetime-local" value={c.dateFin || ""} onChange={e => up({ dateFin: e.target.value })}
            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-gray-800 focus:outline-none focus:border-[#F5A623]/50" />
        </div>
        <FInp label="Texte du bouton" value={c.ctaTexte || ""} onChange={v => up({ ctaTexte: v })} />
      </Bloc>
    );
    default: return null; // social : aucun contenu à régler, seulement le style
  }
}

// ─── Panel pages À propos / Contact ───────────────────────────────────────────
// Générique : édite soit config.aboutPage soit config.contactPage, qui ont
// tous les deux une liste `sections: CustomSection[]` — même bibliothèque de
// blocs que la home (SectionLibrary/CustomSectionControls déjà génériques),
// juste reciblée sur ce tableau au lieu de config.customSections.
const PAGE_SECTION_DEFAULTS: Record<string, any> = {
  richtext:     { titre: "Notre histoire", texte: "Racontez ici l'histoire de votre boutique.", ctaTexte: "", ctaLien: "" },
  features:     { titre: "Nos valeurs", items: [{ icone: "★", titre: "Valeur 1", texte: "Description" }, { icone: "→", titre: "Valeur 2", texte: "Description" }, { icone: "✓", titre: "Valeur 3", texte: "Description" }], colonnes: 3 },
  stats:        { titre: "En chiffres", items: [{ valeur: "10K+", label: "Clients" }, { valeur: "500+", label: "Produits" }, { valeur: "4.9★", label: "Note" }, { valeur: "48h", label: "Livraison" }] },
  gallery:      { titre: "Notre galerie", images: ["", "", "", "", "", ""], layout: "masonry" },
  video:        { titre: "Découvrez notre monde", videoUrl: "", style: "centered", autoplay: false },
  "cta-band":   { titre: "Une question ?", texte: "Contactez-nous, on vous répond vite", ctaTexte: "Nous écrire", ctaLien: "contact", style: "gradient" },
  brands:       { titre: "Ils nous font confiance", logos: ["", "", "", ""], style: "carousel" },
  "social-proof": { note: "4.9/5", nbClients: "12 000+", nbCommandes: "30 000+", certifications: ["✓ Paiement sécurisé", "✓ Livraison garantie"] },
  countdown:    { titre: "Offre limitée", texte: "Ne manquez pas cette opportunité unique !", dateFin: new Date(Date.now() + 7*24*3600*1000).toISOString().slice(0,16), ctaTexte: "Profiter maintenant" },
  spacer:       { hauteur: "80px" },
  tabs:         { titre: "Découvrez-en plus", onglets: [{ id: `tab_${Date.now()}_1`, label: "Photos", blocs: [] }, { id: `tab_${Date.now()}_2`, label: "Témoignages", blocs: [] }] },
  columns:      { titre: "", nombreColonnes: 3, colonnes: [{ id: `col_${Date.now()}_1`, blocs: [] }, { id: `col_${Date.now()}_2`, blocs: [] }, { id: `col_${Date.now()}_3`, blocs: [] }] },
};

export function PanelPageSections({ config, set, pageKey, titre }: { config: ThemeConfig; set: any; pageKey: "aboutPage" | "contactPage"; titre: string }) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const page: any = (config as any)[pageKey] || {};
  const sections: CustomSection[] = page.sections || [];

  const setPage = (patch: any) => set((p: ThemeConfig) => ({ ...p, [pageKey]: { ...(p as any)[pageKey], actif: (p as any)[pageKey]?.actif ?? false, sections: (p as any)[pageKey]?.sections || [], ...patch } }));
  const setSections = (next: CustomSection[]) => setPage({ sections: next });

  const addSection = (type: CustomSection["type"]) => {
    const id = `custom_${Date.now()}`;
    const label = CUSTOM_SECTION_TYPES.find(t => t.type === type)?.label || type;
    setSections([...sections, { id, type, actif: true, label, ordre: sections.length, config: PAGE_SECTION_DEFAULTS[type] || {} }]);
    setShowLibrary(false);
    setActiveSection(id);
  };
  const removeSection = (id: string) => { setSections(sections.filter(s => s.id !== id)); if (activeSection === id) setActiveSection(null); };
  const duplicateSection = (id: string) => {
    const idx = sections.findIndex(s => s.id === id);
    if (idx === -1) return;
    const src = sections[idx];
    const newId = `custom_${Date.now()}`;
    const copy: CustomSection = { ...src, id: newId, label: `${src.label} (copie)`, config: JSON.parse(JSON.stringify(src.config)) };
    const next = [...sections];
    next.splice(idx + 1, 0, copy);
    setSections(next.map((s, i) => ({ ...s, ordre: i })));
    setActiveSection(newId);
  };
  const toggleSection = (id: string) => setSections(sections.map(s => s.id === id ? { ...s, actif: !s.actif } : s));
  const updateSection = (id: string, patch: any) => setSections(sections.map(s => s.id === id ? { ...s, config: { ...s.config, ...patch } } : s));
  const reorderSection = (from: number, to: number) => {
    if (from === to) return;
    const arr = [...sections];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    setSections(arr.map((s, i) => ({ ...s, ordre: i })));
  };

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  if (showLibrary) return <SectionLibrary onAdd={addSection} onClose={() => setShowLibrary(false)} />;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-gray-700">Afficher la page {titre}</p>
          <button onClick={() => setPage({ actif: !page.actif })}>
            {page.actif ?? true ? <ToggleRight size={18} style={{ color: "#F5A623" }} /> : <ToggleLeft size={18} className="text-gray-400" />}
          </button>
        </div>
        {pageKey === "contactPage" && (
          <>
            <FInp label="Texte d'introduction" value={page.intro || ""} onChange={v => setPage({ intro: v })} multiline />
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-gray-700">Formulaire de contact</p>
              <button onClick={() => setPage({ afficherFormulaire: !(page.afficherFormulaire ?? true) })}>
                {(page.afficherFormulaire ?? true) ? <ToggleRight size={18} style={{ color: "#F5A623" }} /> : <ToggleLeft size={18} className="text-gray-400" />}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
        <p className="text-[12px] text-gray-500 font-black uppercase tracking-[0.18em]">Blocs de contenu</p>
        <button onClick={() => setShowLibrary(true)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-semibold transition-all" style={{ backgroundColor: "#F5A623", color: "#050508" }}>
          <Plus size={9} /> Ajouter
        </button>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {sections.length === 0 && (
          <p className="p-4 text-[13px] text-gray-500 leading-relaxed">Aucun bloc pour l'instant — clique sur "Ajouter" pour composer cette page (texte, chiffres clés, galerie...).</p>
        )}
        {sections.map((sec, idx) => {
          const isOpen = activeSection === sec.id;
          return (
            <div key={sec.id}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={e => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx); }}
              onDragLeave={() => setOverIdx(o => o === idx ? null : o)}
              onDrop={e => { e.preventDefault(); if (dragIdx !== null) reorderSection(dragIdx, idx); setDragIdx(null); setOverIdx(null); }}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              className={`${isOpen ? "bg-gray-50/80" : ""} transition-all ${dragIdx === idx ? "opacity-40" : ""} ${overIdx === idx && dragIdx !== null && dragIdx !== idx ? "ring-2 ring-inset ring-[#F5A623]/50" : ""}`}>
              <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 select-none" onClick={() => setActiveSection(isOpen ? null : sec.id)}>
                <div className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 flex-shrink-0" title="Glisser pour réordonner" onClick={e => e.stopPropagation()}>
                  <GripVertical size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-700 truncate">{sec.label}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => toggleSection(sec.id)}>
                    {sec.actif ? <ToggleRight size={15} style={{ color: "#F5A623" }} /> : <ToggleLeft size={15} className="text-gray-400" />}
                  </button>
                  <button onClick={() => duplicateSection(sec.id)} title="Dupliquer" className="text-gray-600 hover:text-gray-400 transition-colors"><Copy size={12} /></button>
                  <button onClick={() => removeSection(sec.id)} title="Supprimer" className="text-red-500/40 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                  {isOpen ? <ChevronDown size={10} className="text-gray-500" /> : <ChevronRight size={10} className="text-gray-400" />}
                </div>
              </div>
              {isOpen && (
                <div className="px-3 pb-4">
                  <CustomSectionControls section={sec} update={updateSection} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PanelProduit({ config, setProductPage }: any) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  // Position d'insertion de la bibliothèque (null = fermée).
  const [insertion, setInsertion] = useState<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const pp = config.productPage || {};
  const layout: string = pp.layout || "amazon";
  const sections = sectionsFiche(pp);
  const indisponibles = typesIndisponibles(sections);

  // Toutes les modifications passent par lib/fiche-produit.ts — le même code
  // qu'exécute AXIA (outil modifier_fiche_produit) : mêmes règles, mêmes ids.
  const agir = (a: ActionFiche) => {
    try {
      const { pp: next, id } = appliquerActionFiche(pp, a);
      setErreur(null);
      setProductPage(next);
      return id;
    } catch (e: any) { setErreur(e.message); }
  };
  const updateSection = (id: string, patch: Record<string, any>) => agir({ action: "configurer", section: id, config: patch });
  const updateSectionStyle = (id: string, patch: Record<string, any>) => agir({ action: "styliser", section: id, style: patch });

  const ajouter = (type: string) => {
    const id = agir({ action: "ajouter", type, index: insertion ?? sections.length });
    setInsertion(null);
    if (id) setActiveSection(id);
  };

  // Ligne d'insertion façon Shopify : avant ou après la section survolée selon la moitié visée.
  const survol = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cible = e.clientY < r.top + r.height / 2 ? idx : idx + 1;
    if (cible !== dropIdx) setDropIdx(cible);
  };
  const deposer = () => {
    if (dragId !== null && dropIdx !== null) {
      const from = sections.findIndex(s => s.id === dragId);
      agir({ action: "deplacer", section: dragId, index: dropIdx > from ? dropIdx - 1 : dropIdx });
    }
    setDragId(null); setDropIdx(null);
  };

  if (insertion !== null) return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <p className="text-[12px] font-black text-gray-500 uppercase tracking-[0.18em]">Ajouter une section</p>
        <button onClick={() => setInsertion(null)} className="text-gray-600 hover:text-gray-400"><X size={13} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {TYPES_FICHE.filter(t => !SECTIONS_FICHE[t].base).map(type => {
          const meta = PRODUIT_SECTION_META[type];
          const Li = meta?.Icon ?? FileText;
          const pris = indisponibles.has(type);
          return (
            <button key={type} onClick={() => !pris && ajouter(type)} disabled={pris}
              className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-gray-200 enabled:hover:border-[#F5A623]/40 enabled:hover:bg-[#F5A623]/5 transition-all group disabled:opacity-45 disabled:cursor-not-allowed">
              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-[#F5A623]/10">
                <Li size={14} className="text-gray-500 group-hover:text-[#F5A623]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-700">{SECTIONS_FICHE[type].label}</p>
                <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">{pris ? "Déjà sur la fiche (une seule autorisée)" : meta?.desc}</p>
              </div>
              {!pris && <Plus size={12} className="flex-shrink-0 mt-0.5 text-gray-600 group-hover:text-[#F5A623]" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const LigneInsertion = ({ idx }: { idx: number }) => (
    <div className="group/ins relative h-2 -my-0.5 flex items-center">
      {dragId !== null && dropIdx === idx
        ? <div className="w-full h-0.5 rounded-full bg-[#F5A623]" />
        : dragId === null && (
          <button onClick={() => setInsertion(idx)} title="Insérer une section ici"
            className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#F5A623] text-[#050508] flex items-center justify-center opacity-0 group-hover/ins:opacity-100 transition-opacity z-10">
            <Plus size={11} />
          </button>
        )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {/* Layout picker */}
        <div className="p-4 border-b border-gray-200">
          <p className="text-[12px] text-gray-500 font-black uppercase tracking-[0.18em] mb-2.5">Mise en page</p>
          <div className="grid grid-cols-2 gap-1.5">
            {LAYOUT_OPTIONS.map(lay => (
              <button key={lay.v} onClick={() => agir({ action: "mise_en_page", layout: lay.v })}
                className={`text-left p-2.5 rounded-xl border transition-all ${layout === lay.v ? "border-[#F5A623]/50 bg-[#F5A623]/10" : "border-gray-200 hover:border-gray-300"}`}>
                <p className="text-[13px] font-semibold text-gray-800 flex items-center gap-1">
                  {layout === lay.v && <Check size={9} style={{ color: "#F5A623" }} />} {lay.l}
                </p>
                <p className="text-[13px] text-gray-600 mt-0.5 leading-relaxed">{lay.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Section list */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[12px] text-gray-500 font-black uppercase tracking-[0.18em]">Sections de la fiche</p>
            <button onClick={() => setInsertion(sections.length)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[12px] font-semibold transition-all"
              style={{ backgroundColor: "#F5A623", color: "#050508" }}>
              <Plus size={9} /> Ajouter
            </button>
          </div>
          {erreur && <p className="mb-2 text-[12px] text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">{erreur}</p>}
          <div onDragOver={e => e.preventDefault()} onDrop={deposer}>
            <LigneInsertion idx={0} />
            {sections.map((sec, idx) => {
              const meta = PRODUIT_SECTION_META[sec.type];
              const SIcon = meta?.Icon ?? FileText;
              const isActive = activeSection === sec.id;
              const isBuiltIn = !!SECTIONS_FICHE[sec.type]?.base;
              return (
                <div key={sec.id}>
                  <div
                    draggable
                    onDragStart={e => { e.dataTransfer.effectAllowed = "move"; setDragId(sec.id); }}
                    onDragOver={e => survol(e, idx)}
                    onDragEnd={() => { setDragId(null); setDropIdx(null); }}
                    className={`rounded-xl border transition-all ${isActive ? "border-[#F5A623]/30 bg-[#F5A623]/5" : "border-gray-100 bg-gray-50"} ${dragId === sec.id ? "opacity-40" : ""}`}>
                    <div className="flex items-center gap-1.5 px-2 py-2">
                      <div className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 flex-shrink-0" title="Glisser pour réordonner">
                        <GripVertical size={13} />
                      </div>
                      <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <SIcon size={11} className="text-gray-500" />
                      </div>
                      <button onClick={() => setActiveSection(isActive ? null : sec.id)} className={`flex-1 text-left text-[13px] font-medium truncate ${sec.actif ? "text-gray-800" : "text-gray-400"}`}>
                        {SECTIONS_FICHE[sec.type]?.label ?? sec.type}
                      </button>
                      <button onClick={() => agir({ action: sec.actif ? "masquer" : "afficher", section: sec.id })} className="flex-shrink-0" title={sec.actif ? "Masquer" : "Afficher"}>
                        {sec.actif ? <ToggleRight size={16} style={{ color: "#F5A623" }} /> : <ToggleLeft size={16} className="text-gray-700" />}
                      </button>
                      {!isBuiltIn && (
                        <button onClick={() => { agir({ action: "supprimer", section: sec.id }); if (isActive) setActiveSection(null); }} title="Supprimer" className="text-red-500/40 hover:text-red-400 flex-shrink-0 transition-colors"><Trash2 size={11} /></button>
                      )}
                      <button onClick={() => setActiveSection(isActive ? null : sec.id)} className="flex-shrink-0 text-gray-600 hover:text-gray-400 transition-colors">
                        <ChevronDown size={12} className="transition-transform" style={{ transform: isActive ? "rotate(180deg)" : "" }} />
                      </button>
                    </div>
                    {isActive && <ProduitSectionSettings section={sec} update={updateSection} updateStyle={updateSectionStyle} />}
                  </div>
                  <LigneInsertion idx={idx + 1} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 pb-4">
          <p className="text-[13px] text-gray-600 leading-relaxed">Ces réglages s'appliquent à toutes les fiches produits. Survolez l'espace entre deux sections pour en insérer une à cet endroit.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Champs helper ────────────────────────────────────────────────────────────
function FInp({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div>
      {label && <label className="block text-[12px] text-gray-500 mb-1">{label}</label>}
      {multiline
        ? <textarea value={value} onChange={e=>onChange(e.target.value)} rows={2} className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#F5A623]/50 resize-none" />
        : <input value={value} onChange={e=>onChange(e.target.value)} className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#F5A623]/50" />
      }
    </div>
  );
}

function FCol({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[12px] text-gray-400 flex-1 min-w-0 truncate">{label}</label>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <input type="color" value={value} onChange={e=>onChange(e.target.value)} className="w-7 h-7 rounded-lg cursor-pointer border border-gray-300" style={{padding:"1px"}} />
        <input type="text" value={value.toUpperCase()} onChange={e=>{ if(/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value); }} className="w-16 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 text-[12px] font-mono text-gray-700 focus:outline-none focus:border-[#F5A623]/50" />
      </div>
    </div>
  );
}

function FSel({ label, value, opts, onChange }: { label: string; value: string; opts: Array<{v:string;l:string}>; onChange: (v: string) => void }) {
  return (
    <div>
      {label && <label className="block text-[12px] text-gray-500 mb-1">{label}</label>}
      <select value={value} onChange={e=>onChange(e.target.value)} className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#F5A623]/50">
        {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function FSli({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-[12px] text-gray-500 mb-1.5">{label}</label>
      <input type="range" min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none bg-gray-100 accent-[#F5A623] cursor-pointer" />
    </div>
  );
}

function FCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-600">{label}</span>
      <button onClick={()=>onChange(!checked)}>
        {checked ? <ToggleRight size={18} style={{color:"#F5A623"}} /> : <ToggleLeft size={18} className="text-gray-600" />}
      </button>
    </div>
  );
}
