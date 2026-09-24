"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight, Check, Loader2, Sparkles, Send, CheckCircle2,
  Store, Globe, Palette, User, Lock, Phone, Mail, ChevronRight, Eye, EyeOff,
  X, Bell, Info, AlertCircle, Wand2, Star, Package, Download,
  type LucideIcon,
} from "lucide-react";
import type { PlanBoutique } from "@/lib/ai-agent";
import { PAYS_DEVISES, PAYS_OPTIONS } from "@/lib/ai-agent";
import { MANIFESTE_LIBRAIRIE, detecterCategorie, choisir4Themes } from "@/lib/axso-design-manifest";
import { DIGITAL_TEMPLATES } from "@/lib/digital-templates";

// ─── Palette AXSO (couleurs du logo) ─────────────────────────────────────────
const NAVY    = "#111111";   // noir AXSO (--axso-navy)
const YELLOW  = "#F5A623";   // ambre jaune — accent principal (--accent)
const YELLOW_D= "#D4911A";   // ambre foncé (--accent-dark)
const YELLOW_L= "#FFD280";   // ambre clair (--axso-amber-light)
const BG      = "#FFFDF8";   // fond global ivoire très chaud
const SURFACE = "#FFFFFF";   // cartes
const BORDER  = "#F0E0B8";   // bordures ambrées
const BORDER_L= "#FBF5E8";   // bordures légères
const MID     = "#666666";   // texte secondaire
const MUTED   = "#AAAAAA";   // texte discret
const SUCCESS = "#16A34A";
const ERROR   = "#DC2626";

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@400;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }

  @keyframes fadeUp {
    from { opacity:0; transform:translateY(16px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes dotBlink {
    0%,80%,100% { opacity:.2; transform:scale(.7); }
    40%         { opacity:1;  transform:scale(1); }
  }
  @keyframes toastIn {
    from { opacity:0; transform:translateX(120%); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes fadeIn  { from{opacity:0}            to{opacity:1} }
  @keyframes scaleUp { from{opacity:0;transform:scale(.93)} to{opacity:1;transform:scale(1)} }
  @keyframes heroIn  {
    from { opacity:0; transform:translateY(32px) scale(.96); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  @keyframes glowPulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(245,166,35,.0); }
    50%     { box-shadow: 0 0 0 8px rgba(245,166,35,.16); }
  }

  .msg-in   { animation: fadeUp  .45s cubic-bezier(.34,1.3,.64,1) both; }
  .fade-in  { animation: fadeIn  .4s ease both; }
  .scale-up { animation: scaleUp .38s cubic-bezier(.34,1.3,.64,1) both; }
  .hero-in  { animation: heroIn  .65s cubic-bezier(.22,1,.36,1) both; }
  .dot      { animation: dotBlink 1.4s ease-in-out infinite; }

  .btn-primary {
    background: linear-gradient(135deg, ${YELLOW} 0%, ${YELLOW_D} 100%);
    color: ${NAVY}; border: none; cursor: pointer;
    font-family: 'Sora', sans-serif; font-weight: 700;
    letter-spacing: .02em; transition: all .2s;
  }
  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(245,166,35,.38);
  }
  .btn-primary:active:not(:disabled) { transform: translateY(0); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; }

  .btn-ghost {
    background: transparent;
    border: 1.5px solid ${BORDER}; color: ${MID};
    cursor: pointer; font-family: 'Inter', sans-serif;
    font-weight: 500; transition: all .18s;
  }
  .btn-ghost:hover { border-color: ${YELLOW}; color: ${YELLOW_D}; }

  .field {
    width: 100%; background: ${SURFACE};
    border: 1.5px solid ${BORDER}; border-radius: 12px;
    padding: 13px 14px 13px 44px;
    font-family: 'Inter', sans-serif; font-size: 14px;
    color: ${NAVY}; outline: none;
    transition: border-color .18s, box-shadow .18s;
  }
  .field:focus { border-color: ${YELLOW}; box-shadow: 0 0 0 3px rgba(245,166,35,.15); }
  .field::placeholder { color: ${MUTED}; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${BG}; }
  ::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 2px; }
`;

// ─── Pays ─────────────────────────────────────────────────────────────────────
const PAYS_LIST = [
  { code:"SN", nom:"Sénégal",       flag:"🇸🇳", devise:"XOF" },
  { code:"CI", nom:"Côte d'Ivoire", flag:"🇨🇮", devise:"XOF" },
  { code:"CM", nom:"Cameroun",      flag:"🇨🇲", devise:"XAF" },
  { code:"MA", nom:"Maroc",         flag:"🇲🇦", devise:"MAD" },
  { code:"NG", nom:"Nigeria",       flag:"🇳🇬", devise:"NGN" },
  { code:"GH", nom:"Ghana",         flag:"🇬🇭", devise:"GHS" },
  { code:"TG", nom:"Togo",          flag:"🇹🇬", devise:"XOF" },
  { code:"BJ", nom:"Bénin",         flag:"🇧🇯", devise:"XOF" },
  { code:"ML", nom:"Mali",          flag:"🇲🇱", devise:"XOF" },
  { code:"KE", nom:"Kenya",         flag:"🇰🇪", devise:"KES" },
  { code:"CD", nom:"RDC",           flag:"🇨🇩", devise:"CDF" },
  { code:"AUTRE_AFRIQUE", nom:"Autre pays d'Afrique", flag:"🌍", devise:"" },
];

// Liste complète des 54 pays membres de l'Union africaine — affichée quand le
// marchand clique "Autre pays d'Afrique" dans PaysSelector (les pays déjà
// présents dans PAYS_LIST ci-dessus, comme le Sénégal ou le Maroc, y figurent
// aussi pour une recherche complète en un seul endroit).
const PAYS_AFRIQUE = PAYS_OPTIONS;

// ─── Logique 4 propositions Axia (detecterCategorie/choisir4Themes : lib/axso-design-manifest.ts) ──
// Explication personnalisée d'Axia pour chaque thème
function rationaleTheme(fichier: string, nomBoutique: string, vente: string): string {
  const e = MANIFESTE_LIBRAIRIE.find(x => x.fichier === fichier);
  if (!e) return "Un design sélectionné pour ton marché.";
  const amb = e.ambiance.slice(0, 2).join(" & ");
  const cat = detecterCategorie(vente);
  const map: Record<string, string> = {
    fashion:     "s'adapte parfaitement à l'univers mode",
    jewelry:     "met en valeur l'aspect précieux de tes produits",
    beauty:      "inspire confiance et soin",
    sport:       "reflète l'énergie et la performance",
    tech:        "projette une image moderne et technologique",
    food:        "stimule l'appétit et l'envie d'achat",
    artisan:     "célèbre l'authenticité artisanale",
    home:        "crée une atmosphère chaleureuse",
    services:    "inspire professionnalisme et expertise",
    agriculture: "valorise le naturel et le terroir",
    general:     "s'adapte à toute activité commerciale",
  };
  return `Style ${amb} — ${map[cat] || "idéal pour ta boutique"} ${nomBoutique}.`;
}

// ─── Schema compte ────────────────────────────────────────────────────────────
const schemaCompte = z.object({
  name:     z.string().min(2, "Minimum 2 caractères"),
  email:    z.string().email("Email invalide"),
  password: z.string().min(6, "Minimum 6 caractères"),
  whatsapp: z.string().min(8, "Numéro requis"),
});
type CompteData = z.infer<typeof schemaCompte>;

type Phase = "welcome"|"q-type"|"q-vente"|"q-nom"|"q-pays"|"analyse"|"plan"|"q-compte"|"creation"|"succes";
// Uniquement deux types possibles — un marchand vend soit du physique, soit
// du digital, jamais "les deux" en tant que catégorie de boutique (un
// marchand avec un catalogue mixte choisit simplement "physique", le champ
// type par produit dans AXIA reste physique/digital/dropshipping au cas par cas).
type TypeBoutique = "physique"|"digital";

// Exemples de "que vends-tu" alignés sur le type choisi à l'étape précédente —
// proposer "Mode & vêtements" à quelqu'un qui vend du digital n'a aucun sens.
const VENTE_EXEMPLES: Record<TypeBoutique, string[]> = {
  physique: ["Mode & vêtements africains","Cosmétiques naturels","Bijoux artisanaux","Électronique & gadgets","Alimentation & épices","Chaussures & maroquinerie"],
  digital:  ["Formations en ligne","Ebooks & guides pratiques","Templates & designs Canva/Notion","Musique & beats","Coaching & consulting","Logiciels & abonnements SaaS"],
};
const VENTE_PLACEHOLDER: Record<TypeBoutique, string> = {
  physique: "Ex: je vends des vêtements mode femme inspirés de la culture africaine, basée à Dakar…",
  digital:  "Ex: je vends des formations en ligne sur le trading et des ebooks business…",
};

const STEPS_CREATION = [
  "Provisionnement de ta boutique…",
  "Application du design sélectionné…",
  "Création de ta gamme de produits…",
  "Configuration des modes de paiement…",
  "Génération des premiers avis clients…",
  "Mise en ligne de ta boutique…",
];

// ─── Toast notifications ──────────────────────────────────────────────────────
type Toast = { id: number; type: "success"|"info"|"error"; msg: string };
let _tid = 0;

function ToastStack({ toasts, onClose }: { toasts: Toast[]; onClose:(id:number)=>void }) {
  return (
    <div style={{ position:"fixed", top:20, right:20, zIndex:9999, display:"flex", flexDirection:"column", gap:9, pointerEvents:"none" }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display:"flex", alignItems:"center", gap:10,
          background: t.type==="success" ? "#F0FDF4" : t.type==="error" ? "#FEF2F2" : "#EFF4FF",
          border:`1.5px solid ${t.type==="success"?"#A7F3D0":t.type==="error"?"#FECACA":BORDER}`,
          borderLeft:`4px solid ${t.type==="success"?SUCCESS:t.type==="error"?ERROR:YELLOW}`,
          borderRadius:12, padding:"11px 14px",
          maxWidth:310, minWidth:200,
          boxShadow:"0 6px 24px rgba(10,22,40,.13)",
          animation:"toastIn .32s cubic-bezier(.34,1.3,.64,1) both",
          pointerEvents:"all",
          fontFamily:"'Inter',sans-serif",
        }}>
          {t.type==="success" && <CheckCircle2 size={15} color={SUCCESS} style={{flexShrink:0}}/>}
          {t.type==="info"    && <Info         size={15} color={YELLOW}    style={{flexShrink:0}}/>}
          {t.type==="error"   && <AlertCircle  size={15} color={ERROR}   style={{flexShrink:0}}/>}
          <span style={{ fontSize:13, color:NAVY, flex:1, lineHeight:1.45 }}>{t.msg}</span>
          <button onClick={()=>onClose(t.id)} style={{ background:"none", border:"none", cursor:"pointer", color:MUTED, padding:2, flexShrink:0, pointerEvents:"all" }}>
            <X size={12}/>
          </button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts,setToasts] = useState<Toast[]>([]);
  const push = useCallback((type:Toast["type"], msg:string, ms=4000)=>{
    const id = ++_tid;
    setToasts(p=>[...p,{id,type,msg}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)), ms);
  },[]);
  const close = useCallback((id:number)=>setToasts(p=>p.filter(t=>t.id!==id)),[]);
  return { toasts, push, close };
}

// ─── Avatar Axia ──────────────────────────────────────────────────────────────
function AxiaAvatar({ size=38 }: { size?:number }) {
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <div style={{
        width:size, height:size, borderRadius:size*.27,
        background:`linear-gradient(135deg,${NAVY} 0%,${YELLOW_D} 100%)`,
        border:`1.5px solid ${YELLOW}50`,
        overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:`0 4px 14px rgba(245,166,35,.28)`,
      }}>
        <img src="/axia-icon.png" alt="Axia"
          style={{ width:"100%", height:"100%", objectFit:"cover" }}
          onError={e=>{ (e.currentTarget as HTMLImageElement).style.display="none"; }}/>
      </div>
      <div style={{
        position:"absolute", bottom:-2, right:-2,
        width:size*.3, height:size*.3, borderRadius:"50%",
        background:SUCCESS, border:`2px solid ${BG}`,
      }}/>
    </div>
  );
}

// ─── Bulles de chat ───────────────────────────────────────────────────────────
function AxiaMsg({ children, delay=0 }: { children:React.ReactNode; delay?:number }) {
  return (
    <div className="msg-in" style={{ display:"flex", alignItems:"flex-start", gap:11, animationDelay:`${delay}ms` }}>
      <AxiaAvatar size={36}/>
      <div style={{
        background:SURFACE, border:`1.5px solid ${BORDER}`,
        borderRadius:"4px 18px 18px 18px",
        padding:"12px 16px", maxWidth:"78%",
        color:NAVY, fontSize:14, lineHeight:1.7,
        boxShadow:"0 2px 12px rgba(10,22,40,.07)",
        fontFamily:"'Inter',sans-serif",
      }}>{children}</div>
    </div>
  );
}

function UserMsg({ children }: { children:React.ReactNode }) {
  return (
    <div className="msg-in" style={{ display:"flex", justifyContent:"flex-end" }}>
      <div style={{
        background:`linear-gradient(135deg,${YELLOW}14,${YELLOW_D}0a)`,
        border:`1.5px solid ${BORDER}`,
        borderRadius:"18px 4px 18px 18px",
        padding:"11px 16px", maxWidth:"72%",
        color:NAVY, fontSize:14, lineHeight:1.65,
        fontFamily:"'Inter',sans-serif",
        boxShadow:"0 1px 6px rgba(10,22,40,.05)",
      }}>{children}</div>
    </div>
  );
}

function AxiaThinking() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:11 }}>
      <AxiaAvatar size={36}/>
      <div style={{
        background:SURFACE, border:`1.5px solid ${BORDER}`,
        borderRadius:"4px 18px 18px 18px",
        padding:"13px 18px", display:"flex", gap:6, alignItems:"center",
        boxShadow:"0 2px 12px rgba(10,22,40,.07)",
      }}>
        {[0,1,2].map(i=>(
          <div key={i} className="dot" style={{
            width:7, height:7, borderRadius:"50%",
            background:YELLOW, animationDelay:`${i*.18}s`,
          }}/>
        ))}
      </div>
    </div>
  );
}

// ─── Sélecteur type de boutique (physique / digital) ──────────────────────────
// Détermine la structure de la boutique générée : "digital" retire la
// section Collections (page de vente centrée sur le produit, sans catalogue
// à parcourir) — voir modeBoutique dans lib/generate-store-config.ts.
const TYPE_BOUTIQUE_OPTIONS: { v:TypeBoutique; Icon:LucideIcon; titre:string; desc:string }[] = [
  { v:"physique", Icon:Package,  titre:"Produits physiques", desc:"Vêtements, bijoux, alimentation… expédiés à tes clients" },
  { v:"digital",  Icon:Download, titre:"Produits digitaux",  desc:"Ebooks, formations, templates… livrés instantanément" },
];

function TypeBoutiqueSelector({ onSelect }: { onSelect:(type:TypeBoutique)=>void }) {
  const [sel,setSel] = useState<TypeBoutique|"">("");
  return (
    <div className="msg-in" style={{ paddingLeft:47, display:"grid", gap:9, maxWidth:420 }}>
      {TYPE_BOUTIQUE_OPTIONS.map(o=>(
        <button key={o.v}
          onClick={()=>{ setSel(o.v); onSelect(o.v); }}
          style={{
            display:"flex", alignItems:"center", gap:12, padding:"13px 15px", borderRadius:14,
            background:sel===o.v?`${YELLOW}12`:SURFACE,
            border:`1.5px solid ${sel===o.v?YELLOW:BORDER}`,
            cursor:"pointer", transition:"all .15s", textAlign:"left",
            boxShadow:sel===o.v?`0 0 0 2px ${YELLOW}22`:"none",
          }}>
          <div style={{
            width:38, height:38, borderRadius:11, flexShrink:0,
            background:`${YELLOW}14`, display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <o.Icon size={17} color={YELLOW_D}/>
          </div>
          <div>
            <div style={{ fontFamily:"'Sora',sans-serif", fontSize:13.5, fontWeight:700, color:NAVY }}>{o.titre}</div>
            <div style={{ fontSize:11.5, color:MUTED, marginTop:1, fontFamily:"'Inter',sans-serif" }}>{o.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Sélecteur de pays ────────────────────────────────────────────────────────
function PaysSelector({ onSelect }: { onSelect:(code:string,nom:string,devise:string)=>void }) {
  const [sel,setSel] = useState("");
  const [afriqueOuvert,setAfriqueOuvert] = useState(false);

  function choisir(code:string, nom:string) {
    if (code === "AUTRE_AFRIQUE") { setAfriqueOuvert(true); return; }
    setSel(code);
    onSelect(code, nom, PAYS_DEVISES[code] || "XOF");
  }

  return (
    <div className="msg-in" style={{ paddingLeft:47, display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, maxWidth:460 }}>
        {PAYS_LIST.map(p=>(
          <button key={p.code}
            onClick={()=>choisir(p.code, p.nom)}
            style={{
              display:"flex", flexDirection:"column", alignItems:"center",
              gap:4, padding:"9px 4px", borderRadius:12,
              background:(sel===p.code||(afriqueOuvert&&p.code==="AUTRE_AFRIQUE"))?`${YELLOW}12`:SURFACE,
              border:`1.5px solid ${(sel===p.code||(afriqueOuvert&&p.code==="AUTRE_AFRIQUE"))?YELLOW:BORDER}`,
              cursor:"pointer", transition:"all .15s",
              boxShadow:sel===p.code?`0 0 0 2px ${YELLOW}22`:"none",
            }}>
            <span style={{ fontSize:19 }}>{p.flag}</span>
            <span style={{ fontSize:10, fontWeight:600, textAlign:"center", lineHeight:1.2, color:sel===p.code?YELLOW_D:MID, fontFamily:"'Inter',sans-serif" }}>
              {p.nom}
            </span>
          </button>
        ))}
      </div>

      {afriqueOuvert && (
        <div className="msg-in" style={{
          display:"flex", flexDirection:"column", gap:6, maxWidth:320,
          background:SURFACE, border:`1.5px solid ${BORDER}`, borderRadius:14, padding:12,
        }}>
          <label style={{ fontSize:11, fontWeight:600, color:MID, fontFamily:"'Inter',sans-serif" }}>
            Choisis ton pays parmi les 54 pays d'Afrique
          </label>
          <select
            defaultValue=""
            onChange={ev=>{
              const p = PAYS_AFRIQUE.find(x=>x.code===ev.target.value);
              if (p) choisir(p.code, p.nom);
            }}
            style={{
              padding:"10px 12px", borderRadius:10, border:`1.5px solid ${BORDER}`,
              fontSize:13, fontFamily:"'Inter',sans-serif", color:NAVY, background:"#fff",
              outline:"none", cursor:"pointer",
            }}>
            <option value="" disabled>Sélectionne un pays…</option>
            {PAYS_AFRIQUE.map(p=>(
              <option key={p.code} value={p.code}>{p.nom}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ─── 4 Propositions de design Axia (iframes live avec données boutique) ───────
function PropositionsDesign({
  themeIds, selectedId, onSelect,
  nomBoutique, produits, devise, vente,
}: {
  themeIds: string[]; selectedId: string; onSelect:(id:string)=>void;
  nomBoutique?:string; produits?:{nom:string;prix:number;description?:string}[];
  devise?:string; vente?:string;
}) {
  const produitsParam = encodeURIComponent(JSON.stringify((produits||[]).slice(0,6)));
  const nomParam      = encodeURIComponent(nomBoutique || "Ma Boutique");
  const devParam      = encodeURIComponent(devise || "XAF");

  return (
    <div className="msg-in" style={{ paddingLeft:47 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, maxWidth:560 }}>
        {themeIds.map((id, idx) => {
          const e = MANIFESTE_LIBRAIRIE.find(x => x.fichier === id);
          if (!e) return null;
          const sel = selectedId === id;
          const url = `/api/preview-theme?fichier=${encodeURIComponent(id)}&nom=${nomParam}&devise=${devParam}&produits=${produitsParam}`;
          const raison = rationaleTheme(id, nomBoutique||"ta boutique", vente||"");
          return (
            <button key={id} onClick={()=>onSelect(id)}
              style={{
                padding:0, borderRadius:18, overflow:"hidden",
                border:`2px solid ${sel?YELLOW:BORDER}`,
                cursor:"pointer", textAlign:"left",
                boxShadow: sel
                  ? `0 0 0 3px ${YELLOW}22, 0 10px 32px rgba(245,166,35,.18)`
                  : "0 2px 12px rgba(10,22,40,.08)",
                background:e.couleurs.fond||SURFACE,
                transition:"all .22s cubic-bezier(.34,1.3,.64,1)",
                position:"relative",
              }}>
              {/* Numéro de proposition */}
              <div style={{
                position:"absolute", top:10, left:10, zIndex:4,
                width:22, height:22, borderRadius:"50%",
                background: sel ? YELLOW : "rgba(10,22,40,.55)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:10, fontWeight:800, color:"#fff",
                fontFamily:"'Sora',sans-serif",
              }}>
                {idx+1}
              </div>
              {/* Badge "Recommandé" si premier */}
              {idx===0 && (
                <div style={{
                  position:"absolute", top:10, right:sel?36:10, zIndex:4,
                  background:`${YELLOW}ee`, borderRadius:999,
                  fontSize:9, fontWeight:700, color:"#fff",
                  padding:"2px 8px", fontFamily:"'Sora',sans-serif",
                  letterSpacing:".05em", display:"flex", alignItems:"center", gap:4,
                }}>
                  <Star size={9} fill="#fff" strokeWidth={0}/> Recommandé
                </div>
              )}
              {/* Badge check si sélectionné */}
              {sel && (
                <div style={{
                  position:"absolute", top:10, right:10, zIndex:4,
                  width:22, height:22, borderRadius:"50%",
                  background:YELLOW, display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow:`0 2px 8px ${YELLOW}55`,
                }}>
                  <Check size={12} color="#fff" strokeWidth={3}/>
                </div>
              )}
              {/* Iframe live avec les infos de la boutique */}
              <div style={{ height:170, overflow:"hidden", position:"relative" }}>
                <iframe
                  src={url} title={e.nom}
                  sandbox="allow-same-origin allow-scripts"
                  scrolling="no"
                  style={{
                    width:960, height:750, border:"none",
                    pointerEvents:"none",
                    transformOrigin:"top left",
                    transform:"scale(0.175)",
                    position:"absolute", top:0, left:0,
                  }}
                />
                <div style={{ position:"absolute", inset:0, zIndex:2 }}/>
                {/* Gradient bas */}
                <div style={{
                  position:"absolute", bottom:0, left:0, right:0, zIndex:3,
                  height:50, background:"linear-gradient(to top,rgba(0,0,0,.5),transparent)",
                  display:"flex", alignItems:"flex-end", padding:"0 10px 7px",
                }}>
                  <span style={{ fontSize:10, fontWeight:800, color:"rgba(255,255,255,.95)", letterSpacing:".09em", textTransform:"uppercase", fontFamily:"'Sora',sans-serif" }}>
                    {e.nom}
                  </span>
                </div>
              </div>
              {/* Footer description */}
              <div style={{
                padding:"10px 12px",
                background: sel ? `${YELLOW}08` : BG,
                borderTop:`1px solid ${sel?YELLOW+"25":BORDER}`,
              }}>
                <div style={{ fontSize:11, fontWeight:700, color:sel?YELLOW_D:NAVY, marginBottom:3, fontFamily:"'Sora',sans-serif" }}>
                  {e.ambiance.slice(0,2).map(a=>a.charAt(0).toUpperCase()+a.slice(1)).join(" · ")}
                </div>
                <div style={{ fontSize:10, color:MUTED, lineHeight:1.4, fontFamily:"'Inter',sans-serif" }}>
                  {raison}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── 4 Propositions de gabarits pour boutique digitale (captures d'écran
// statiques, pas d'iframe live — les gabarits digitaux ne sont pas des
// designs clonés/tokenizés comme la bibliothèque AXSO Design, juste une
// identité de couleurs de départ éditable ensuite dans le Constructeur
// digital, voir lib/digital-templates.ts). ─────────────────────────────────────
function PropositionsTemplatesDigitaux({ selectedId, onSelect }: { selectedId: string; onSelect:(id:string)=>void }) {
  return (
    <div className="msg-in" style={{ paddingLeft:47 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, maxWidth:560 }}>
        {DIGITAL_TEMPLATES.map((t, idx) => {
          const sel = selectedId === t.id;
          return (
            <button key={t.id} onClick={()=>onSelect(t.id)}
              style={{
                padding:0, borderRadius:18, overflow:"hidden",
                border:`2px solid ${sel?YELLOW:BORDER}`,
                cursor:"pointer", textAlign:"left",
                boxShadow: sel
                  ? `0 0 0 3px ${YELLOW}22, 0 10px 32px rgba(245,166,35,.18)`
                  : "0 2px 12px rgba(10,22,40,.08)",
                background:t.colors.fond,
                transition:"all .22s cubic-bezier(.34,1.3,.64,1)",
                position:"relative",
              }}>
              <div style={{
                position:"absolute", top:10, left:10, zIndex:4,
                width:22, height:22, borderRadius:"50%",
                background: sel ? YELLOW : "rgba(10,22,40,.55)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:10, fontWeight:800, color:"#fff",
                fontFamily:"'Sora',sans-serif",
              }}>
                {idx+1}
              </div>
              {idx===0 && (
                <div style={{
                  position:"absolute", top:10, right:sel?36:10, zIndex:4,
                  background:`${YELLOW}ee`, borderRadius:999,
                  fontSize:9, fontWeight:700, color:"#fff",
                  padding:"2px 8px", fontFamily:"'Sora',sans-serif",
                  letterSpacing:".05em", display:"flex", alignItems:"center", gap:4,
                }}>
                  <Star size={9} fill="#fff" strokeWidth={0}/> Recommandé
                </div>
              )}
              {sel && (
                <div style={{
                  position:"absolute", top:10, right:10, zIndex:4,
                  width:22, height:22, borderRadius:"50%",
                  background:YELLOW, display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow:`0 2px 8px ${YELLOW}55`,
                }}>
                  <Check size={12} color="#fff" strokeWidth={3}/>
                </div>
              )}
              <div style={{ height:170, overflow:"hidden", position:"relative" }}>
                <img src={t.previewImage} alt={t.label} style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top" }}/>
                <div style={{
                  position:"absolute", bottom:0, left:0, right:0, zIndex:3,
                  height:50, background:"linear-gradient(to top,rgba(0,0,0,.5),transparent)",
                  display:"flex", alignItems:"flex-end", padding:"0 10px 7px",
                }}>
                  <span style={{ fontSize:10, fontWeight:800, color:"rgba(255,255,255,.95)", letterSpacing:".09em", textTransform:"uppercase", fontFamily:"'Sora',sans-serif" }}>
                    {t.label}
                  </span>
                </div>
              </div>
              <div style={{
                padding:"10px 12px",
                background: sel ? `${YELLOW}08` : BG,
                borderTop:`1px solid ${sel?YELLOW+"25":BORDER}`,
              }}>
                <div style={{ fontSize:11, fontWeight:700, color:sel?YELLOW_D:NAVY, marginBottom:3, fontFamily:"'Sora',sans-serif" }}>
                  {t.label}
                </div>
                <div style={{ fontSize:10, color:MUTED, lineHeight:1.4, fontFamily:"'Inter',sans-serif" }}>
                  {t.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({ plan, vente, themeIds, typeBoutique, digitalTemplateId, onConfirm, onThemeChange, onDigitalTemplateChange, onNomChange }: {
  plan: PlanBoutique & { messageIA?:string };
  vente: string;
  themeIds: string[];
  typeBoutique: TypeBoutique|"";
  digitalTemplateId: string;
  onConfirm: ()=>void;
  onThemeChange: (id:string)=>void;
  onDigitalTemplateChange: (id:string)=>void;
  onNomChange: (nom:string)=>void;
}) {
  const digital = typeBoutique === "digital";
  const digitalTpl = DIGITAL_TEMPLATES.find(t => t.id === digitalTemplateId) || DIGITAL_TEMPLATES[0];
  const e = digital
    ? { nom: digitalTpl.label, ambiance: [digitalTpl.desc] }
    : (MANIFESTE_LIBRAIRIE.find(x => x.fichier === plan.themeId) || MANIFESTE_LIBRAIRIE[0]);
  const nomValide = plan.nomBoutique.trim().length >= 2;
  return (
    <div className="msg-in" style={{ paddingLeft:47, display:"flex", flexDirection:"column", gap:14 }}>
      {/* Récap boutique */}
      <div style={{
        background:SURFACE, border:`1.5px solid ${BORDER}`,
        borderRadius:18, overflow:"hidden",
        boxShadow:"0 4px 20px rgba(10,22,40,.09)",
      }}>
        {/* Header */}
        <div style={{
          padding:"16px 20px",
          background:`linear-gradient(135deg,${BG} 0%,${BORDER_L} 100%)`,
          borderBottom:`1px solid ${BORDER}`,
          display:"flex", alignItems:"center", gap:14,
        }}>
          <div style={{
            width:46, height:46, borderRadius:14,
            background:`${YELLOW}12`, border:`2px solid ${YELLOW}30`,
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
          }}>
            <Store size={20} color={YELLOW}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <input
              value={plan.nomBoutique}
              onChange={ev=>onNomChange(ev.target.value)}
              placeholder="Nom de ta boutique"
              maxLength={60}
              style={{
                fontFamily:"'Sora',sans-serif", fontSize:18, fontWeight:800, color:NAVY, lineHeight:1.1,
                width:"100%", background:"transparent", border:"none", borderBottom:`1.5px dashed ${nomValide?"transparent":YELLOW}`,
                padding:0, outline:"none",
              }}
            />
            <div style={{ fontSize:11, color:MUTED, marginTop:3, fontFamily:"'Inter',sans-serif" }}>
              {plan.categorie} · {plan.pays} · {plan.devise}
            </div>
          </div>
          <div style={{
            fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:999,
            color:YELLOW, background:`${YELLOW}12`, border:`1px solid ${YELLOW}28`,
            letterSpacing:".06em", textTransform:"uppercase",
            fontFamily:"'Sora',sans-serif", flexShrink:0,
          }}>{e.nom}</div>
        </div>

        {/* Produits */}
        <div style={{ padding:"12px 20px" }}>
          <div style={{ fontSize:10, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:".1em", marginBottom:9, fontFamily:"'Sora',sans-serif" }}>
            {plan.produits.length} produits générés par Axia
          </div>
          {plan.produits.map((p,i)=>(
            <div key={i} style={{
              display:"flex", justifyContent:"space-between", alignItems:"center",
              padding:"6px 0", borderBottom:i<plan.produits.length-1?`1px solid ${BORDER_L}`:"none",
            }}>
              <span style={{ fontSize:13, color:NAVY, opacity:.85, fontFamily:"'Inter',sans-serif" }}>{p.nom}</span>
              <span style={{ fontSize:13, fontWeight:700, color:YELLOW_D, fontFamily:"'Sora',sans-serif" }}>
                {p.prix.toLocaleString()} {plan.devise}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Titre section design */}
      <div style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"10px 14px", borderRadius:12,
        background:`${YELLOW}08`, border:`1px solid ${YELLOW}20`,
      }}>
        <Wand2 size={15} color={YELLOW}/>
        <span style={{ fontSize:13, color:YELLOW_D, fontWeight:600, fontFamily:"'Sora',sans-serif" }}>
          Axia a sélectionné 4 {digital ? "gabarits" : "designs"} personnalisés pour <strong>{plan.nomBoutique}</strong> — choisis celui qui te correspond
        </span>
      </div>

      {/* 4 propositions — gabarits digitaux (captures statiques) pour une
          boutique 100% digitale, designs AXSO Design (iframes live) pour une
          boutique physique : deux systèmes de rendu totalement différents
          (voir lib/theme-config.ts::ThemeDigitalConfig vs axso-design-library.ts),
          jamais mélangés. */}
      {digital ? (
        <PropositionsTemplatesDigitaux
          selectedId={digitalTemplateId}
          onSelect={onDigitalTemplateChange}
        />
      ) : (
        <PropositionsDesign
          themeIds={themeIds}
          selectedId={plan.themeId}
          onSelect={onThemeChange}
          nomBoutique={plan.nomBoutique}
          produits={plan.produits}
          devise={plan.devise}
          vente={vente}
        />
      )}

      {!nomValide && (
        <div style={{ fontSize:11.5, color:YELLOW_D, fontFamily:"'Inter',sans-serif", marginTop:-6 }}>
          Donne un nom à ta boutique (2 caractères minimum) pour continuer — modifie-le juste au-dessus si besoin.
        </div>
      )}

      <button onClick={onConfirm} disabled={!nomValide} className="btn-primary"
        style={{ padding:"15px 24px", borderRadius:14, fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", gap:10, opacity:nomValide?1:.5, cursor:nomValide?"pointer":"not-allowed" }}>
        <Sparkles size={16}/> Ce design me convient — Créer ma boutique <ArrowRight size={16}/>
      </button>
    </div>
  );
}

// ─── Formulaire compte ────────────────────────────────────────────────────────
function CompteForm({ onSubmit, loading, erreur }: {
  onSubmit:(d:CompteData)=>void; loading:boolean; erreur?:string;
}) {
  const { register, handleSubmit, formState:{errors} } = useForm<CompteData>({ resolver:zodResolver(schemaCompte) });
  const [voirMdp,setVoirMdp] = useState(false);
  const fields = [
    { key:"name"     as const, Icon:User,  label:"Ton prénom",    type:"text",     ph:"Aminata" },
    { key:"email"    as const, Icon:Mail,  label:"Adresse email", type:"email",    ph:"aminata@example.com" },
    { key:"password" as const, Icon:Lock,  label:"Mot de passe",  type:"password", ph:"Minimum 6 caractères" },
    { key:"whatsapp" as const, Icon:Phone, label:"WhatsApp",      type:"tel",      ph:"+221 77 000 00 00" },
  ];
  return (
    <div className="msg-in" style={{ paddingLeft:47 }}>
      <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth:420, display:"flex", flexDirection:"column", gap:11 }}>
        {fields.map(f=>(
          <div key={f.key}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:MID, textTransform:"uppercase", letterSpacing:".08em", marginBottom:5, fontFamily:"'Sora',sans-serif" }}>
              {f.label}
            </label>
            <div style={{ position:"relative" }}>
              <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}>
                <f.Icon size={14} color={MUTED}/>
              </div>
              <input {...register(f.key)} type={f.key==="password"&&voirMdp?"text":f.type} placeholder={f.ph} className="field"
                style={f.key==="password"?{paddingRight:44}:undefined}/>
              {f.key==="password" && (
                <button type="button" onClick={()=>setVoirMdp(v=>!v)}
                  aria-label={voirMdp?"Masquer le mot de passe":"Afficher le mot de passe"}
                  style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", padding:4, cursor:"pointer", display:"flex" }}>
                  {voirMdp ? <EyeOff size={16} color={MUTED}/> : <Eye size={16} color={MUTED}/>}
                </button>
              )}
            </div>
            {errors[f.key] && (
              <p style={{ color:ERROR, fontSize:11, marginTop:4, fontFamily:"'Inter',sans-serif" }}>
                {errors[f.key]?.message}
              </p>
            )}
          </div>
        ))}
        {erreur && (
          <div style={{ padding:"10px 14px", background:"#FEF2F2", border:`1px solid #FECACA`, borderRadius:10, fontSize:13, color:ERROR, fontFamily:"'Inter',sans-serif" }}>
            {erreur}
          </div>
        )}
        <button type="submit" disabled={loading} className="btn-primary"
          style={{ marginTop:4, padding:"14px 24px", borderRadius:13, fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
          {loading ? <><Loader2 size={16} className="animate-spin"/> Lancement…</>
                   : <><Sparkles size={16}/> Lancer ma boutique <ArrowRight size={16}/></>}
        </button>
      </form>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function InscriptionPage() {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toasts, push: toast, close: closeToast } = useToast();

  const [phase,setPhase]           = useState<Phase>("welcome");
  const [typeBoutique,setTypeBoutique] = useState<TypeBoutique|"">("");
  const [vente,setVente]           = useState("");
  const [venteInput,setVenteInput] = useState("");
  const [nomChoisi,setNomChoisi]   = useState("");
  const [nomInput,setNomInput]     = useState("");
  const [paysCode,setPaysCode]     = useState("");
  const [paysNom,setPaysNom]       = useState("");
  const [devise,setDevise]         = useState("XAF");
  const [plan,setPlan]             = useState<(PlanBoutique&{messageIA?:string})|null>(null);
  const [themeIds,setThemeIds]     = useState<string[]>([]);
  const [digitalTemplateId,setDigitalTemplateId] = useState<string>(DIGITAL_TEMPLATES[0].id);
  const [messageIA,setMessageIA]   = useState("");
  const [erreur,setErreur]         = useState("");
  const [loading,setLoading]       = useState(false);
  const [steps,setSteps]           = useState<string[]>([]);

  useEffect(()=>{
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),100);
  },[phase,steps.length]);

  const submitType = useCallback((type:TypeBoutique)=>{
    setTypeBoutique(type);
    const label = type==="physique" ? "produits physiques" : "produits digitaux";
    toast("info",`C'est noté — ${label}. Parle-moi de ton projet 👇`);
    setPhase("q-vente");
  },[toast]);

  const submitVente = useCallback(()=>{
    if(!venteInput.trim()) return;
    setVente(venteInput.trim());
    toast("info","Bien noté ! Une dernière chose avant l'analyse 👇");
    setPhase("q-nom");
  },[venteInput,toast]);

  const submitNom = useCallback(()=>{
    if(!nomInput.trim()) return;
    setNomChoisi(nomInput.trim());
    toast("info",`"${nomInput.trim()}" — j'adore ! Axia analyse ton projet… ✨`);
    setPhase("q-pays");
  },[nomInput,toast]);

  const submitPays = useCallback((code:string,nom:string,dev:string)=>{
    setPaysCode(code); setPaysNom(nom); setDevise(dev); setErreur("");
    toast("info",`Marché ${nom} détecté — devise ${dev} 🌍`);
    setTimeout(()=>setPhase("analyse"),600);
  },[toast]);

  // Appel API analyse
  useEffect(()=>{
    if(phase!=="analyse") return;
    const typeLabel = typeBoutique==="physique" ? "physiques uniquement" : typeBoutique==="digital" ? "digitaux uniquement (ebooks, formations, templates…)" : "";
    const description = `${vente}. Nom de boutique choisi par le marchand: "${nomChoisi}". Pays: ${paysNom} (${paysCode}).${typeLabel ? ` Type de produits: ${typeLabel}.` : ""}`;
    fetch("/api/ai/onboarding",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({phase:"analyser",description}),
    })
    .then(r=>r.json())
    .then(data=>{
      if(data.plan){
        // Le nom vient du marchand (Q1.5), jamais de l'invention de l'IA —
        // on l'impose ici même si le JSON retourné en propose un autre.
        // Idem pour le pays : celui cliqué par le marchand, et SA devise.
        const p = { ...(data.plan as PlanBoutique & { messageIA?:string }), nomBoutique: nomChoisi, pays: paysCode, devise: PAYS_DEVISES[paysCode] || devise };
        setMessageIA(data.messageIA || p.messageIA || "Voici ce que j'ai préparé pour toi !");
        // Choisir 4 themes adaptés à la catégorie de boutique
        const ids = choisir4Themes(vente, p.themeId);
        setThemeIds(ids);
        // S'assurer que le themeId du plan est dans notre sélection
        setPlan(ids.includes(p.themeId) ? p : { ...p, themeId: ids[0] });
        toast("success","4 designs personnalisés prêts — choisis ton site !");
        setPhase("plan");
      } else {
        // Échec : on reste sur la question pays (re-cliquer relance l'analyse)
        // au lieu de renvoyer le marchand à "Dis-moi ce que tu vends".
        setErreur(data.message||"Erreur d'analyse.");
        toast("error","Erreur lors de l'analyse. Réessaie.");
        setPhase("q-pays");
      }
    })
    .catch(()=>{ setErreur("Erreur réseau."); toast("error","Erreur réseau."); setPhase("q-pays"); });
  },[phase,vente,nomChoisi,paysCode,paysNom,devise,typeBoutique,toast]);

  const confirmPlan = useCallback(()=>{
    toast("info","Design sélectionné ! Crée ton compte pour lancer. 🚀");
    setPhase("q-compte");
  },[toast]);

  const launchCreation = useCallback(async(compteData:CompteData)=>{
    if(!plan) return;
    setLoading(true); setErreur(""); setPhase("creation"); setSteps([]);
    toast("info","Lancement de ta boutique en cours…");
    let i=0;
    const iv=setInterval(()=>{
      if(i<STEPS_CREATION.length){ setSteps(p=>[...p,STEPS_CREATION[i]]); i++; }
    },700);
    try{
      const res = await fetch("/api/ai/onboarding",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({phase:"executer",plan,compte:compteData,typeBoutique:typeBoutique||undefined,digitalTemplateId:typeBoutique==="digital"?digitalTemplateId:undefined,designsProposes:typeBoutique==="digital"?undefined:themeIds}),
      });
      const data = await res.json();
      clearInterval(iv);
      if(!res.ok) throw new Error(data.message);
      setSteps(STEPS_CREATION);
      toast("success","🎉 Ta boutique est prête — personnalise-la avant de la publier !");
      setPhase("succes");
      const lr = await signIn("credentials",{email:compteData.email,password:compteData.password,redirect:false});
      // Rechargement complet (pas router.push) : on quitte de toute façon l'app
      // marketing pour le dashboard authentifié, et un router.push() différé par
      // setTimeout juste après un signIn() est un enchaînement fragile connu pour
      // déclencher "Router action dispatched before initialization" côté client —
      // window.location contourne entièrement le router App Router pour cette transition.
      setTimeout(()=>{ window.location.href = lr?.ok?"/dashboard/builder?bienvenue=1":"/connexion?inscription=success"; },2000);
    }catch(err:any){
      clearInterval(iv);
      setErreur(err.message||"Erreur.");
      toast("error",err.message||"Erreur lors de la création.");
      setPhase("q-compte");
    }finally{ setLoading(false); }
  },[plan,typeBoutique,digitalTemplateId,themeIds,toast]);

  return (
    <div style={{
      minHeight:"100vh",
      background:`radial-gradient(ellipse 160% 70% at 50% -10%,${BORDER_L} 0%,${BG} 50%,#fff 100%)`,
      fontFamily:"'Inter',sans-serif", color:NAVY,
      display:"flex", flexDirection:"column",
    }}>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>

      {/* Pattern géométrique de fond (discret) */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none", zIndex:0,
        backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect x='20' y='20' width='8' height='8' fill='none' stroke='%23F5A623' stroke-width='.5' opacity='.07' transform='rotate(45 24 24)'/%3E%3C/svg%3E")`,
      }}/>

      {/* Bande supérieure aux couleurs du logo */}
      <div style={{
        height:4, position:"relative", zIndex:1,
        background:`linear-gradient(90deg,${NAVY} 0%,${YELLOW_D} 25%,${YELLOW} 50%,${YELLOW_L} 75%,${YELLOW} 100%)`,
      }}/>

      {/* Toasts */}
      <ToastStack toasts={toasts} onClose={closeToast}/>

      {/* ── Header ── */}
      <header style={{
        position:"relative", zIndex:1,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        maxWidth:720, margin:"0 auto", width:"100%",
        padding:"16px 24px",
      }}>
        <Link href="/" style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none" }}>
          <img src="/logo.png" alt="Axso" style={{ height:38, objectFit:"contain" }}/>
        </Link>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          {toasts.length>0 && (
            <div style={{ position:"relative", cursor:"default" }}>
              <Bell size={17} color={YELLOW}/>
              <div style={{
                position:"absolute", top:-5, right:-5,
                width:14, height:14, borderRadius:"50%",
                background:YELLOW, border:`2px solid ${BG}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:8, color:"#fff", fontWeight:800,
              }}>{toasts.length}</div>
            </div>
          )}
          <Link href="/connexion" style={{ fontSize:13, color:MID, textDecoration:"none", fontWeight:500 }}>
            Déjà un compte ?{" "}
            <span style={{ color:YELLOW, fontWeight:700 }}>Connexion</span>
          </Link>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{
        position:"relative", zIndex:1, flex:1,
        maxWidth:720, margin:"0 auto", width:"100%",
        padding:"8px 24px 160px",
        display:"flex", flexDirection:"column", gap:22,
      }}>

        {/* ── PAGE WELCOME ── */}
        {phase==="welcome" && (
          <div className="hero-in" style={{ paddingTop:28 }}>
            <div style={{ textAlign:"center" }}>
              {/* Avatar hero */}
              <div style={{ display:"flex", justifyContent:"center", marginBottom:24 }}>
                <div style={{ position:"relative" }}>
                  {/* Cercle animé */}
                  <div style={{
                    position:"absolute", inset:-16, borderRadius:"50%",
                    border:`1.5px solid ${YELLOW}18`,
                    animation:"glowPulse 3s ease-in-out infinite",
                  }}/>
                  <div style={{
                    position:"absolute", inset:-8, borderRadius:"50%",
                    border:`1px dashed ${YELLOW}25`,
                  }}/>
                  <div style={{
                    width:100, height:100, borderRadius:"28%",
                    background:`linear-gradient(135deg,${NAVY} 0%,${YELLOW_D} 100%)`,
                    border:`2px solid ${YELLOW}40`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    boxShadow:`0 14px 48px rgba(245,166,35,.3)`,
                  }}>
                    <img src="/axia-icon.png" alt="Axia"
                      style={{ width:"80%", height:"80%", objectFit:"cover", borderRadius:"22%" }}
                      onError={e=>{ (e.currentTarget as HTMLImageElement).style.display="none"; }}/>
                  </div>
                  {/* Dots décoratifs */}
                  {[[-8,-8],[106,-10],[106,92],[-10,94]].map(([x,y],i)=>(
                    <div key={i} style={{ position:"absolute", left:x, top:y, width:8, height:8, borderRadius:"50%", background:YELLOW, opacity:.35 }}/>
                  ))}
                </div>
              </div>

              {/* Badge IA */}
              <div style={{
                display:"inline-flex", alignItems:"center", gap:6,
                padding:"5px 14px", borderRadius:999,
                background:`${YELLOW}10`, border:`1px solid ${YELLOW}28`,
                marginBottom:18,
              }}>
                <Sparkles size={12} color={YELLOW}/>
                <span style={{ fontSize:11, fontWeight:700, color:YELLOW_D, letterSpacing:".07em", textTransform:"uppercase", fontFamily:"'Sora',sans-serif" }}>
                  Propulsé par l'IA
                </span>
              </div>

              <h1 style={{
                fontFamily:"'Sora',sans-serif",
                fontSize:40, fontWeight:800, color:NAVY,
                lineHeight:1.1, margin:"0 0 14px",
                letterSpacing:"-.03em",
              }}>
                Crée ton empire<br/>
                <span style={{ color:YELLOW }}>e-commerce africain</span>
              </h1>

              <p style={{ fontSize:15, color:MID, lineHeight:1.8, maxWidth:480, margin:"0 auto 28px", fontFamily:"'Inter',sans-serif" }}>
                En quelques questions, Axia conçoit ton site e-commerce ultra haut de gamme. Design, produits, livraison — tout configuré automatiquement.
              </p>

              {/* 4 features */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, maxWidth:480, margin:"0 auto 28px" }}>
                {[
                  { Icon:Palette,  label:"15 designs premium",  desc:"Afrocentriques & luxe" },
                  { Icon:Store,    label:"Site complet",         desc:"Produits · Livraison · SEO" },
                  { Icon:Globe,    label:"100+ pays",            desc:"Toutes devises africaines" },
                  { Icon:Sparkles, label:"100% IA",              desc:"En ligne en 60 secondes" },
                ].map(({Icon,label,desc})=>(
                  <div key={label} style={{
                    background:SURFACE, border:`1.5px solid ${BORDER}`,
                    borderRadius:16, padding:"14px 16px", textAlign:"left",
                    boxShadow:"0 2px 8px rgba(10,22,40,.06)",
                  }}>
                    <div style={{ width:32, height:32, borderRadius:10, background:`${YELLOW}10`, border:`1px solid ${YELLOW}22`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:10 }}>
                      <Icon size={15} color={YELLOW}/>
                    </div>
                    <div style={{ fontWeight:700, fontSize:12, color:NAVY, marginBottom:2, fontFamily:"'Sora',sans-serif" }}>{label}</div>
                    <div style={{ fontSize:11, color:MUTED }}>{desc}</div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={()=>{ setPhase("q-type"); toast("info","Bienvenue ! Axia est là pour toi. 👋"); }}
                className="btn-primary"
                style={{ padding:"17px 52px", borderRadius:18, fontSize:15, display:"inline-flex", alignItems:"center", gap:12, boxShadow:`0 12px 40px rgba(245,166,35,.32)` }}>
                <Sparkles size={18}/>
                Créer ma boutique gratuitement
                <ChevronRight size={18}/>
              </button>
              <p style={{ marginTop:11, fontSize:12, color:MUTED }}>
                Gratuit · Sans carte bancaire · En ligne en 60 secondes
              </p>

              {/* Drapeaux pays */}
              <div style={{ marginTop:28 }}>
                <div style={{ height:1, background:`linear-gradient(to right,transparent,${BORDER},transparent)`, margin:"0 auto 14px", maxWidth:400 }}/>
                <p style={{ fontSize:11, color:MUTED, margin:"0 0 10px", textTransform:"uppercase", letterSpacing:".1em" }}>
                  Rejoint par 1 000+ boutiques en Afrique
                </p>
                <div style={{ display:"flex", justifyContent:"center", gap:8, flexWrap:"wrap" }}>
                  {["🇸🇳 Sénégal","🇨🇮 Côte d'Ivoire","🇨🇲 Cameroun","🇳🇬 Nigeria","🇬🇭 Ghana"].map(c=>(
                    <span key={c} style={{ fontSize:11, padding:"3px 11px", borderRadius:999, background:SURFACE, border:`1px solid ${BORDER}`, color:MID }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CONVERSATION ── */}
        {phase!=="welcome" && (
          <>
            {/* Q0 — Type de boutique (physique/digital) — détermine la
                structure générée : "digital" seul retire le catalogue au
                profit d'une page de vente centrée sur le produit. */}
            <AxiaMsg delay={0}>
              Bonjour ! 👋{" "}
              <strong style={{color:YELLOW_D}}>Tu vas vendre quel type de produits ?</strong>
            </AxiaMsg>
            {phase==="q-type" && <TypeBoutiqueSelector onSelect={submitType}/>}
            {typeBoutique&&phase!=="q-type" && (
              <UserMsg>{TYPE_BOUTIQUE_OPTIONS.find(o=>o.v===typeBoutique)?.titre}</UserMsg>
            )}

            {/* Q1 — Que vends-tu */}
            {typeBoutique && (
              <AxiaMsg delay={80}>
                <strong style={{color:YELLOW_D}}>Dis-moi ce que tu vends.</strong>{" "}
                Plus tu es précis, plus ton site sera parfait.
              </AxiaMsg>
            )}

            {phase==="q-vente" && (
              <div className="msg-in" style={{ paddingLeft:47, display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                  {VENTE_EXEMPLES[typeBoutique || "physique"].map(ex=>(
                    <button key={ex} onClick={()=>setVenteInput(ex)}
                      style={{
                        padding:"6px 13px", borderRadius:999, fontSize:12, fontWeight:500,
                        background:venteInput===ex?`${YELLOW}12`:SURFACE,
                        border:`1.5px solid ${venteInput===ex?YELLOW:BORDER}`,
                        color:venteInput===ex?YELLOW_D:MID,
                        cursor:"pointer", transition:"all .13s", fontFamily:"'Inter',sans-serif",
                      }}>{ex}</button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <textarea
                    value={venteInput}
                    onChange={e=>setVenteInput(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); submitVente(); } }}
                    placeholder={VENTE_PLACEHOLDER[typeBoutique || "physique"]}
                    rows={3}
                    style={{
                      flex:1, background:SURFACE, border:`1.5px solid ${BORDER}`,
                      borderRadius:14, padding:"12px 16px",
                      color:NAVY, fontSize:13, resize:"none", outline:"none",
                      lineHeight:1.6, fontFamily:"'Inter',sans-serif",
                      transition:"border-color .18s",
                    }}
                    onFocus={e=>e.currentTarget.style.borderColor=YELLOW}
                    onBlur={e=>e.currentTarget.style.borderColor=BORDER}
                  />
                  <button onClick={submitVente} disabled={!venteInput.trim()} className="btn-primary"
                    style={{ width:46, height:46, borderRadius:12, padding:0, display:"flex", alignItems:"center", justifyContent:"center", alignSelf:"flex-end", flexShrink:0, opacity:venteInput.trim()?1:.35 }}>
                    <Send size={16} color="#fff"/>
                  </button>
                </div>
              </div>
            )}

            {vente&&phase!=="q-vente" && <UserMsg>{vente}</UserMsg>}

            {/* Q1.5 — Nom de la boutique */}
            {vente && (
              <AxiaMsg delay={80}>
                <strong style={{color:YELLOW_D}}>Quel nom veux-tu donner à ta boutique ?</strong>
              </AxiaMsg>
            )}
            {phase==="q-nom" && (
              <div className="msg-in" style={{ paddingLeft:47, display:"flex", gap:10 }}>
                <input
                  value={nomInput}
                  onChange={e=>setNomInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); submitNom(); } }}
                  placeholder="Ex: Adama Store, Kente & Co, Axia Formations…"
                  maxLength={60}
                  autoFocus
                  style={{
                    flex:1, background:SURFACE, border:`1.5px solid ${BORDER}`,
                    borderRadius:14, padding:"12px 16px",
                    color:NAVY, fontSize:14, outline:"none",
                    fontFamily:"'Sora',sans-serif", fontWeight:600,
                    transition:"border-color .18s",
                  }}
                  onFocus={e=>e.currentTarget.style.borderColor=YELLOW}
                  onBlur={e=>e.currentTarget.style.borderColor=BORDER}
                />
                <button onClick={submitNom} disabled={!nomInput.trim()} className="btn-primary"
                  style={{ width:46, height:46, borderRadius:12, padding:0, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, opacity:nomInput.trim()?1:.35 }}>
                  <Send size={16} color="#fff"/>
                </button>
              </div>
            )}
            {nomChoisi&&phase!=="q-nom" && <UserMsg>{nomChoisi}</UserMsg>}

            {/* Q2 — Pays */}
            {nomChoisi&&(phase==="q-pays"||paysCode) && (
              <AxiaMsg delay={80}>
                Dans quel pays es-tu basé ? Je vais adapter la devise, la livraison et le design à ton marché. 🌍
              </AxiaMsg>
            )}
            {phase==="q-pays" && erreur && (
              <div className="msg-in" style={{ paddingLeft:47, fontSize:13, color:"#DC2626" }}>
                {erreur} — choisis à nouveau ton pays pour relancer l'analyse.
              </div>
            )}
            {phase==="q-pays" && <PaysSelector onSelect={submitPays}/>}
            {paysNom&&phase!=="q-pays" && <UserMsg>📍 {paysNom}</UserMsg>}

            {/* Analyse */}
            {phase==="analyse" && (
              <>
                <AxiaMsg delay={0}>
                  Parfait ! Je crée ton plan de boutique et je sélectionne les 4 meilleurs designs pour toi… ✨
                </AxiaMsg>
                <AxiaThinking/>
              </>
            )}

            {/* Plan + 4 propositions */}
            {(phase==="plan"||phase==="q-compte"||phase==="creation"||phase==="succes") && plan && themeIds.length>0 && (
              <>
                <AxiaMsg delay={0}>
                  <strong style={{color:YELLOW_D}}>J'ai analysé ton projet.</strong>{" "}{messageIA}
                </AxiaMsg>
                {phase==="plan" && (
                  <PlanCard
                    plan={plan}
                    vente={vente}
                    themeIds={themeIds}
                    typeBoutique={typeBoutique}
                    digitalTemplateId={digitalTemplateId}
                    onConfirm={confirmPlan}
                    onThemeChange={id=>setPlan(p=>p?{...p,themeId:id}:p)}
                    onDigitalTemplateChange={setDigitalTemplateId}
                    onNomChange={nom=>setPlan(p=>p?{...p,nomBoutique:nom}:p)}
                  />
                )}
              </>
            )}

            {/* Q3 — Compte */}
            {(phase==="q-compte"||phase==="creation"||phase==="succes") && (
              <>
                <AxiaMsg delay={100}>
                  <span style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    Excellent choix ! Crée ton compte pour lancer{" "}
                    <strong style={{color:YELLOW_D}}>{plan?.nomBoutique}</strong>. 🚀
                  </span>
                </AxiaMsg>
                {phase==="q-compte" && (
                  <CompteForm onSubmit={launchCreation} loading={loading} erreur={erreur||undefined}/>
                )}
              </>
            )}

            {/* Création en cours */}
            {phase==="creation" && (
              <div className="msg-in scale-up" style={{ paddingLeft:47 }}>
                <div style={{
                  background:SURFACE, border:`1.5px solid ${BORDER}`,
                  borderRadius:18, padding:"18px 22px",
                  boxShadow:"0 4px 20px rgba(10,22,40,.09)", maxWidth:440,
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                    <Loader2 size={18} color={YELLOW} className="animate-spin"/>
                    <span style={{ fontWeight:700, fontSize:14, fontFamily:"'Sora',sans-serif", color:NAVY }}>
                      Axia construit ta boutique…
                    </span>
                  </div>
                  {steps.map((s,i)=>(
                    <div key={i} className="msg-in" style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, marginBottom:8 }}>
                      <CheckCircle2 size={14} color={SUCCESS} style={{flexShrink:0}}/>
                      <span style={{color:MID, fontFamily:"'Inter',sans-serif"}}>{s}</span>
                    </div>
                  ))}
                  {steps.length<STEPS_CREATION.length && (
                    <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:13 }}>
                      <Loader2 size={14} color={YELLOW} className="animate-spin" style={{flexShrink:0}}/>
                      <span style={{color:MUTED}}>En cours…</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Succès */}
            {phase==="succes" && (
              <div className="scale-up" style={{ display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", gap:20, padding:"24px 0" }}>
                <div style={{
                  width:80, height:80, borderRadius:"50%",
                  background:"rgba(22,163,74,.1)", border:"2px solid rgba(22,163,74,.3)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow:"0 10px 36px rgba(22,163,74,.18)",
                }}>
                  <CheckCircle2 size={40} color={SUCCESS}/>
                </div>
                <div>
                  <h2 style={{ fontFamily:"'Sora',sans-serif", fontSize:28, fontWeight:800, color:NAVY, margin:0 }}>
                    Ta boutique est prête ! 🎉
                  </h2>
                  <p style={{ color:MID, fontSize:14, marginTop:8 }}>
                    {plan?.nomBoutique&&<strong style={{color:YELLOW_D}}>{plan.nomBoutique}</strong>} — direction le Constructeur pour la personnaliser et la publier. Redirection…
                  </p>
                </div>
                <Loader2 size={22} color={YELLOW} className="animate-spin"/>
              </div>
            )}
          </>
        )}

        <div ref={bottomRef}/>
      </main>

      {/* Footer */}
      {phase==="welcome" && (
        <footer style={{
          position:"relative", zIndex:1, textAlign:"center",
          padding:"0 24px 28px", color:MUTED, fontSize:12,
        }}>
          <div style={{ height:1, background:`linear-gradient(to right,transparent,${BORDER},transparent)`, margin:"0 auto 14px", maxWidth:400 }}/>
          Tu es livreur ?{" "}
          <Link href="/inscription/livreur" style={{ color:YELLOW, fontWeight:700, textDecoration:"none" }}>
            Rejoindre la plateforme →
          </Link>
        </footer>
      )}
    </div>
  );
}
