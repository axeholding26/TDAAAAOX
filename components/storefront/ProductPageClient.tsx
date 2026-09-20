"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatMontant } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { WishlistHeartButton } from "./WishlistHeartButton";
import {
  Package, AlertTriangle, Lock, RotateCcw, Check,
  Star, Minus, Plus, ShoppingCart, Truck, ZoomIn,
  MessageCircle, Download, ChevronRight, ShoppingBag,
  ChevronDown, Share2, PlayCircle, Headphones, FileText,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Variante = { id: string; nom: string; valeur: string; prix: number | null; stock: number };
type Avis = {
  id: string; note: number; titre: string | null; commentaire: string | null;
  verifie: boolean; client: { nom: string } | null; createdAt: string;
};
type ProdSection = { id: string; type: string; actif: boolean; config: Record<string, any>; style?: { bgColor?: string; textColor?: string; paddingY?: string; maxWidth?: string; align?: string } };

const DEFAULT_SECTIONS: ProdSection[] = [
  { id: "gallery",     type: "gallery",     actif: true, config: { style: "vertical-thumbs", zoom: true, sticky: true } },
  { id: "info",        type: "info",        actif: true, config: { breadcrumbs: true, badges: true, stock: true } },
  { id: "variants",    type: "variants",    actif: true, config: {} },
  { id: "quantity",    type: "quantity",    actif: true, config: {} },
  { id: "trust",       type: "trust",       actif: true, config: {} },
  { id: "description", type: "description", actif: true, config: { ai: true } },
  { id: "reviews",     type: "reviews",     actif: true, config: {} },
  { id: "similar",     type: "similar",     actif: true, config: { count: 4, titre: "Vous aimerez aussi" } },
];

const RIGHT_COL = new Set(["info", "variants", "quantity", "trust"]);
// Types de produits digitaux — pas de stock physique, bouton "télécharger/accéder"
// plutôt que "panier". Garder en phase avec TYPES_PRODUIT_DIGITAL (lib/affiliation.ts).
const TYPES_DIGITAUX = new Set(["digital", "fichier", "formation", "licence"]);
const BELOW_TYPES = new Set(["description","reviews","similar","richtext","features","howto","banner","video","faq","specs","ingredients","testimonials","sizeguide","guarantee","bundle","comparison","countdown","social"]);

export interface ProductPageClientProps {
  produit: {
    id: string; nom: string; description: string | null; descriptionIA: string | null;
    images: string[]; prixAffiche: number; prixCompareAffiche: number | null;
    remise: number; stock: number; type: string; fichierUrl: string | null;
    fichierNom: string | null; categorie: string | null; marque: string | null;
    variantes: Variante[]; avis: Avis[];
    collections: { nom: string; slug: string }[]; noteMoyenne: number;
    masquerVentes?: boolean;
    texteBoutonAchat?: string | null;
    faq?: { question: string; reponse: string }[];
    formationCurriculum?: {
      chapitres: {
        id: string; titre: string;
        lecons: { id: string; titre: string; type: string; duree: number | null; gratuite: boolean; contenu: string | null; videoType: string | null; videoUrl: string | null; audioUrl: string | null }[];
      }[];
    } | null;
  };
  tenant: {
    id: string; slug: string; nomBoutique: string; devise: string; certifie: boolean;
    accent: string; fond: string; texte: string; surface: string; radius: string;
    whatsapp: string | null; whatsappNumero: string | null;
    productPage?: { layout?: string; sections?: ProdSection[] } | null;
    layout?: { largeurContainer?: string } | null;
    boutons?: { style?: string; taille?: string; hover?: string } | null;
    peutDevenirAffilie?: boolean;
  };
  produitsSimilaires: { id: string; nom: string; images: string[]; prixAffiche: number }[];
}

// ─── Stars ────────────────────────────────────────────────────────────────────
function Stars({ note, size = 14, accent }: { note: number; size?: number; accent: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} strokeWidth={1.5} style={{ color: accent }}
          fill={i <= Math.floor(note) ? accent : "none"} opacity={i <= Math.ceil(note) ? 1 : 0.2} />
      ))}
    </div>
  );
}

// ─── AvisForm ─────────────────────────────────────────────────────────────────
function AvisForm({ tenantId, produitId, accent, surface, radius }: {
  tenantId: string; produitId: string; accent: string; surface: string; radius: string;
}) {
  const [note, setNote]         = useState(0);
  const [hover, setHover]       = useState(0);
  const [nom, setNom]           = useState("");
  const [email, setEmail]       = useState("");
  const [titre, setTitre]       = useState("");
  const [commentaire, setComment] = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [err, setErr]           = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note) { setErr("Veuillez sélectionner une note."); return; }
    if (!nom.trim() || !email.trim()) { setErr("Nom et email requis."); return; }
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/avis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, produitId, clientNom: nom, clientEmail: email, note, titre, commentaire }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Erreur lors de l'envoi."); }
      else { setDone(true); }
    } catch { setErr("Erreur réseau. Réessayez."); }
    finally { setLoading(false); }
  }

  const rad = radius === "none" ? "0" : radius === "sm" ? "8px" : radius === "full" ? "20px" : "14px";

  if (done) return (
    <div className="text-center py-8 rounded-2xl" style={{ background: surface, border: `1px solid ${accent}15` }}>
      <div className="text-3xl mb-3">⭐</div>
      <p className="font-semibold text-sm mb-1">Merci pour votre avis !</p>
      <p className="text-xs opacity-40">Il sera visible après modération.</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="rounded-2xl p-6 space-y-4" style={{ background: surface, border: `1px solid ${accent}15` }}>
      <h3 className="font-bold text-sm">Laisser un avis</h3>

      {/* Star picker */}
      <div className="flex items-center gap-1">
        {[1,2,3,4,5].map(i => (
          <button key={i} type="button"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)}
            onClick={() => setNote(i)}
            style={{ background: "none", border: "none", padding: 2, cursor: "pointer" }}>
            <Star size={26} strokeWidth={1.5} style={{ color: accent }}
              fill={(hover || note) >= i ? accent : "none"}
              opacity={(hover || note) >= i ? 1 : 0.2} />
          </button>
        ))}
        {note > 0 && <span className="text-xs ml-2 opacity-40">{["","Décevant","Moyen","Bien","Très bien","Excellent"][note]}</span>}
      </div>

      {/* Fields */}
      <div className="grid sm:grid-cols-2 gap-3">
        <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Votre nom *"
          className="w-full px-3 py-2.5 text-sm outline-none transition-all"
          style={{ borderRadius: rad, border: `1px solid ${accent}20`, background: "transparent" }} />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Votre email *"
          className="w-full px-3 py-2.5 text-sm outline-none transition-all"
          style={{ borderRadius: rad, border: `1px solid ${accent}20`, background: "transparent" }} />
      </div>
      <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Titre (optionnel)"
        className="w-full px-3 py-2.5 text-sm outline-none"
        style={{ borderRadius: rad, border: `1px solid ${accent}20`, background: "transparent" }} />
      <textarea value={commentaire} onChange={e => setComment(e.target.value)} placeholder="Votre commentaire…" rows={3}
        className="w-full px-3 py-2.5 text-sm outline-none resize-none"
        style={{ borderRadius: rad, border: `1px solid ${accent}20`, background: "transparent" }} />

      {err && <p className="text-xs text-red-500">{err}</p>}

      <button type="submit" disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
        style={{ background: accent, color: "white", borderRadius: rad, border: "none", cursor: loading ? "default" : "pointer" }}>
        {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : <Star size={14} fill="white" stroke="none" />}
        {loading ? "Envoi…" : "Soumettre l'avis"}
      </button>
    </form>
  );
}

// ─── Rating Breakdown ─────────────────────────────────────────────────────────
function RatingBreakdown({ avis, accent, moyenne }: { avis: Avis[]; accent: string; moyenne: number }) {
  const total = avis.length;
  const counts = [5, 4, 3, 2, 1].map(n => ({ stars: n, count: avis.filter(a => Math.round(a.note) === n).length }));
  return (
    <div className="flex items-center gap-8 flex-wrap">
      <div className="text-center flex-shrink-0">
        <div className="text-5xl font-black tabular-nums">{moyenne.toFixed(1)}</div>
        <div className="flex justify-center my-1.5"><Stars note={moyenne} size={13} accent={accent} /></div>
        <div className="text-xs opacity-40">{total} avis</div>
      </div>
      <div className="flex-1 min-w-[140px] space-y-1.5">
        {counts.map(({ stars, count }) => (
          <div key={stars} className="flex items-center gap-2">
            <span className="text-xs w-2 opacity-50 tabular-nums">{stars}</span>
            <Star size={9} fill={accent} style={{ color: accent }} />
            <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${total > 0 ? (count / total) * 100 : 0}%`, background: accent }} />
            </div>
            <span className="text-xs opacity-40 w-3 tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Image Gallery ────────────────────────────────────────────────────────────
function ImageGallery({ images, nom, accent, radius, zoomEnabled = true, sticky = true }: {
  images: string[]; nom: string; accent: string; radius: string; zoomEnabled?: boolean; sticky?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [zoomData, setZoomData] = useState<{ x: number; y: number; panelLeft: number; panelTop: number } | null>(null);
  const current = images[selected] ?? null;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!zoomEnabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    const panelLeft = Math.min(rect.right + 12, (typeof window !== "undefined" ? window.innerWidth : 1400) - 420);
    setZoomData({ x, y, panelLeft, panelTop: Math.max(8, rect.top) });
  }

  return (
    <>
      <div className={`flex gap-3 ${sticky ? "lg:sticky lg:top-6" : ""}`}>
        {images.length > 1 && (
          <div className="hidden sm:flex flex-col gap-2 w-[70px] flex-shrink-0">
            {images.slice(0, 8).map((img, i) => (
              <button key={i} onMouseEnter={() => setSelected(i)} onClick={() => setSelected(i)}
                className="w-full overflow-hidden transition-all duration-150"
                style={{ aspectRatio: "1", borderRadius: radius, border: `2px solid ${i === selected ? accent : "rgba(0,0,0,0.1)"}`, opacity: i === selected ? 1 : 0.55, boxShadow: i === selected ? `0 0 0 2px ${accent}30` : "none" }}>
                <img src={img} alt={`${nom} ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 group">
          <div className="relative aspect-square overflow-hidden select-none"
            style={{ borderRadius: radius, background: "#F6F6F6", cursor: zoomData ? "crosshair" : zoomEnabled ? "zoom-in" : "default" }}
            onMouseMove={handleMouseMove} onMouseLeave={() => setZoomData(null)}>
            {current
              ? <img src={current} alt={nom} className="w-full h-full object-cover" draggable={false} />
              : <div className="w-full h-full flex items-center justify-center"><Package size={64} className="opacity-20" /></div>}
            {zoomEnabled && !zoomData && current && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] font-medium px-2.5 py-1.5 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}>
                <ZoomIn size={10} /> Survolez pour zoomer
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="sm:hidden flex gap-2 mt-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button key={i} onClick={() => setSelected(i)} className="flex-shrink-0 w-12 overflow-hidden"
                  style={{ aspectRatio: "1", borderRadius: radius, border: `2px solid ${i === selected ? accent : "transparent"}` }}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {zoomData && current && (
        <div className="fixed z-[200] pointer-events-none hidden lg:block"
          style={{ left: zoomData.panelLeft, top: zoomData.panelTop, width: 400, height: 400, borderRadius: radius,
            backgroundImage: `url(${current})`, backgroundSize: "300%",
            backgroundPosition: `${zoomData.x}% ${zoomData.y}%`,
            boxShadow: "0 25px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)" }} />
      )}
    </>
  );
}

// ─── Variant Selector ─────────────────────────────────────────────────────────
function VariantSelector({ variantes, accent, radius, selected, onSelect }: {
  variantes: Variante[]; accent: string; radius: string;
  selected: Variante | null; onSelect: (v: Variante | null) => void;
}) {
  const grouped = variantes.reduce<Record<string, Variante[]>>((acc, v) => {
    (acc[v.nom] ??= []).push(v);
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([nom, variants]) => {
        const current = variants.find(v => v.id === selected?.id);
        return (
          <div key={nom}>
            <p className="text-sm font-medium mb-2.5">
              <span className="opacity-55">{nom} :</span>{" "}
              {current && <span className="font-bold" style={{ color: accent }}>{current.valeur}</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {variants.map(v => {
                const isSelected = selected?.id === v.id;
                const isOut = v.stock === 0;
                return (
                  <button key={v.id} onClick={() => onSelect(isSelected ? null : v)} disabled={isOut}
                    className="relative px-4 py-2 text-sm font-medium transition-all duration-150"
                    style={{ borderRadius: radius, border: `2px solid ${isSelected ? accent : "rgba(0,0,0,0.12)"}`, background: isSelected ? `${accent}12` : "transparent", color: isSelected ? accent : "inherit", opacity: isOut ? 0.3 : 1 }}>
                    {v.valeur}
                    {isOut && <span className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="w-[130%] h-px bg-current opacity-50 rotate-[-15deg] absolute" /></span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Wrapper de style par section (fond, texte, espacement, largeur, alignement) ─
function StyledSection({ style, children }: { style?: { bgColor?: string; textColor?: string; paddingY?: string; maxWidth?: string; align?: string }; children: React.ReactNode }) {
  if (!style || (!style.bgColor && !style.textColor && (!style.paddingY || style.paddingY === "none") && (!style.maxWidth || style.maxWidth === "full") && !style.align)) {
    return <>{children}</>;
  }
  const paddingMap: Record<string, string> = { none: "0", sm: "24px", md: "48px", lg: "72px", xl: "96px" };
  const maxWidthMap: Record<string, string> = { full: "100%", medium: "896px", narrow: "640px" };
  const py = paddingMap[style.paddingY || "none"];
  return (
    <div style={{
      background: style.bgColor || undefined,
      color: style.textColor || undefined,
      padding: style.bgColor ? `${py} 24px` : (py !== "0" ? `${py} 0` : undefined),
      borderRadius: style.bgColor ? "24px" : undefined,
      marginTop: style.bgColor ? "32px" : undefined,
    }}>
      <div style={{ maxWidth: maxWidthMap[style.maxWidth || "full"], margin: style.align === "center" ? "0 auto" : undefined, textAlign: style.align as any }}>
        {children}
      </div>
    </div>
  );
}

// ─── Countdown Section ────────────────────────────────────────────────────────
function CountdownSection({ config, accent, surface, slug }: { config: Record<string, any>; accent: string; surface: string; slug: string }) {
  const [left, setLeft] = useState({ j: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const end = new Date(config.dateFin || "").getTime();
    const tick = () => {
      const diff = Math.max(0, end - Date.now());
      setLeft({ j: Math.floor(diff / 86400000), h: Math.floor((diff % 86400000) / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [config.dateFin]);

  const Unit = ({ v, l }: { v: number; l: string }) => (
    <div className="text-center">
      <div className="text-3xl font-black tabular-nums w-16 py-3 rounded-2xl" style={{ background: surface, color: accent }}>{String(v).padStart(2, "0")}</div>
      <p className="text-xs opacity-40 mt-1">{l}</p>
    </div>
  );
  return (
    <div className="py-14 px-6 text-center border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-2">{config.titre}</h3>}
      {config.texte && <p className="opacity-60 mb-8 max-w-md mx-auto text-sm">{config.texte}</p>}
      <div className="flex justify-center gap-3 mb-8">
        <Unit v={left.j} l="Jours" /><span className="text-2xl font-black opacity-30 mt-2">:</span>
        <Unit v={left.h} l="Heures" /><span className="text-2xl font-black opacity-30 mt-2">:</span>
        <Unit v={left.m} l="Min" /><span className="text-2xl font-black opacity-30 mt-2">:</span>
        <Unit v={left.s} l="Sec" />
      </div>
      {config.ctaTexte && (
        <Link href={`/${slug}/checkout`} className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-sm"
          style={{ background: accent, color: "#fff" }}>{config.ctaTexte}</Link>
      )}
    </div>
  );
}

// ─── FAQ Section ──────────────────────────────────────────────────────────────
function FaqSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const items: { question: string; reponse: string }[] = config.items || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{config.titre}</h3>}
      <div className="space-y-2 max-w-3xl">
        {items.map((item, i) => (
          <div key={i} className="rounded-2xl overflow-hidden" style={{ background: surface }}>
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left">
              <span className="font-semibold text-sm pr-4">{item.question}</span>
              <ChevronDown size={16} className="flex-shrink-0 transition-transform duration-200" style={{ transform: open === i ? "rotate(180deg)" : "", color: accent }} />
            </button>
            {open === i && <div className="px-5 pb-5 text-sm leading-relaxed opacity-60">{item.reponse}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Specs Section ────────────────────────────────────────────────────────────
function SpecsSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const rows: { cle: string; valeur: string }[] = config.rows || [];
  if (!rows.length) return null;
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{config.titre}</h3>}
      <div className="max-w-3xl overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? surface : "transparent" }}>
                <td className="py-3 px-4 font-semibold" style={{ color: accent, width: "40%" }}>{row.cle}</td>
                <td className="py-3 px-4 opacity-70">{row.valeur}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Video Section ────────────────────────────────────────────────────────────
function VideoSection({ config, accent, radius }: { config: Record<string, any>; accent: string; radius: string }) {
  const url = config.videoUrl || "";
  const getEmbed = (u: string) => {
    const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}${config.autoplay ? "?autoplay=1" : ""}`;
    const vm = u.match(/vimeo\.com\/(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
    return u;
  };
  if (!url) return null;
  const isMp4 = url.endsWith(".mp4") || url.includes(".mp4?");
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{config.titre}</h3>}
      <div className="relative w-full overflow-hidden" style={{ borderRadius: radius, paddingBottom: "56.25%", background: "#000" }}>
        {isMp4
          ? <video src={url} controls autoPlay={config.autoplay} className="absolute inset-0 w-full h-full object-cover" />
          : <iframe src={getEmbed(url)} className="absolute inset-0 w-full h-full border-0" allowFullScreen />}
      </div>
    </div>
  );
}

// ─── Social Section ───────────────────────────────────────────────────────────
function SocialSection({ accent, nom }: { accent: string; nom: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const msg = encodeURIComponent(`Découvrez ${nom} !`);
  const shares = [
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, bg: "#1877F2" },
    { label: "WhatsApp", href: `https://wa.me/?text=${msg}%20${encodeURIComponent(url)}`, bg: "#25D366" },
    { label: "Twitter/X", href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${msg}`, bg: "#000" },
  ];
  const copyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <div className="py-8 border-t flex items-center gap-3 flex-wrap" style={{ borderColor: `${accent}10` }}>
      <span className="text-sm font-semibold flex items-center gap-2"><Share2 size={14} /> Partager</span>
      {shares.map(s => (
        <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
          className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: s.bg }}>{s.label}</a>
      ))}
      <button onClick={copyLink} className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: accent }}>{copied ? "Copié !" : "Copier le lien"}</button>
    </div>
  );
}

// ─── Banner Section ───────────────────────────────────────────────────────────
function BannerSection({ config, accent, radius, slug }: { config: Record<string, any>; accent: string; radius: string; slug: string }) {
  return (
    <div className="py-8 border-t" style={{ borderColor: `${accent}10` }}>
      <div className="relative overflow-hidden" style={{ borderRadius: radius, minHeight: 200, background: config.imageUrl ? `url(${config.imageUrl}) center/cover` : accent }}>
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} />
        <div className="relative z-10 flex flex-col items-center justify-center text-center p-10 min-h-[200px]">
          {config.titre && <h3 className="text-2xl font-black text-white mb-2">{config.titre}</h3>}
          {config.texte && <p className="text-white/70 mb-6 text-sm max-w-lg">{config.texte}</p>}
          {config.ctaTexte && (
            <Link href={`/${slug}/produits`} className="inline-block px-8 py-3 rounded-xl font-bold text-sm"
              style={{ background: accent, color: "#fff" }}>{config.ctaTexte}</Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Richtext Section ─────────────────────────────────────────────────────────
function RichtextSection({ config, accent, radius, slug }: { config: Record<string, any>; accent: string; radius: string; slug: string }) {
  return (
    <div className="py-12 border-t max-w-3xl" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-4">{config.titre}</h3>}
      {config.texte && <p className="text-base leading-relaxed opacity-70 mb-6">{config.texte}</p>}
      {config.ctaTexte && (
        <Link href={`/${slug}/produits`} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm"
          style={{ background: accent, color: "#fff" }}>{config.ctaTexte}</Link>
      )}
    </div>
  );
}

// ─── Features Section ─────────────────────────────────────────────────────────
function FeaturesSection({ config, accent, surface, radius }: { config: Record<string, any>; accent: string; surface: string; radius: string }) {
  const items: { icone: string; titre: string; texte: string }[] = config.items || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{config.titre}</h3>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, i) => (
          <div key={i} className="flex gap-4 p-5 rounded-2xl" style={{ background: surface }}>
            <div className="text-2xl flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: `${accent}15` }}>{item.icone}</div>
            <div>
              <p className="font-bold text-sm mb-1">{item.titre}</p>
              <p className="text-sm opacity-60 leading-relaxed">{item.texte}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Howto Section ────────────────────────────────────────────────────────────
function HowtoSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const steps: { num: string; titre: string; texte: string }[] = config.steps || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{config.titre}</h3>}
      <div className="space-y-4 max-w-2xl">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-5 items-start">
            <div className="w-12 h-12 rounded-2xl font-black text-sm flex items-center justify-center flex-shrink-0" style={{ background: `${accent}15`, color: accent }}>{step.num}</div>
            <div className="pt-1">
              <p className="font-bold mb-1">{step.titre}</p>
              <p className="text-sm opacity-60 leading-relaxed">{step.texte}</p>
            </div>
            {i < steps.length - 1 && <div className="absolute left-[23px] mt-12 w-px h-4 bg-current opacity-10" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Testimonials Section ─────────────────────────────────────────────────────
function TestimonialsSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const items: { nom: string; note: number; texte: string; avatar?: string }[] = config.items || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{config.titre}</h3>}
      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
        {items.map((item, i) => (
          <div key={i} className="p-6 rounded-2xl" style={{ background: surface }}>
            <div className="flex mb-3">
              {[1,2,3,4,5].map(s => (
                <span key={s} style={{ color: s <= item.note ? accent : "currentColor", opacity: s <= item.note ? 1 : 0.15, fontSize: 13 }}>★</span>
              ))}
            </div>
            <p className="text-sm leading-relaxed opacity-70 mb-4 italic">"{item.texte}"</p>
            <div className="flex items-center gap-2">
              {item.avatar ? (
                <img src={item.avatar} alt={item.nom} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${accent}25`, color: accent }}>{item.nom[0]}</div>
              )}
              <p className="text-sm font-semibold">{item.nom}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ingredients Section ──────────────────────────────────────────────────────
function IngredientsSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const items: { nom: string; desc: string }[] = config.items || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-4">{config.titre}</h3>}
      {config.texte && <p className="text-sm opacity-60 mb-8 max-w-2xl leading-relaxed">{config.texte}</p>}
      <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: surface }}>
            <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: accent }} />
            <div>
              <p className="text-sm font-semibold">{item.nom}</p>
              {item.desc && <p className="text-xs opacity-50 mt-0.5 leading-relaxed">{item.desc}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Size Guide Section ───────────────────────────────────────────────────────
function SizeGuideSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const headers: string[] = config.headers || [];
  const rows: { cells: string[] }[] = config.rows || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{config.titre}</h3>}
      <div className="overflow-x-auto max-w-3xl">
        <table className="w-full text-sm min-w-[400px]">
          <thead>
            <tr style={{ background: accent }}>
              {headers.map((h, i) => (
                <th key={i} className="py-3 px-4 text-left font-bold text-white text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? surface : "transparent" }}>
                {row.cells.map((cell, j) => (
                  <td key={j} className="py-3 px-4" style={{ fontWeight: j === 0 ? 700 : 400, color: j === 0 ? accent : "inherit", opacity: j === 0 ? 1 : 0.7 }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Guarantee Section ────────────────────────────────────────────────────────
function GuaranteeSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const items: { icone: string; titre: string; texte: string }[] = config.items || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{config.titre}</h3>}
      <div className="grid sm:grid-cols-3 gap-4 max-w-3xl">
        {items.map((item, i) => (
          <div key={i} className="text-center p-6 rounded-2xl" style={{ background: surface }}>
            <div className="text-3xl mb-3">{item.icone}</div>
            <p className="font-bold text-sm mb-2">{item.titre}</p>
            <p className="text-xs opacity-55 leading-relaxed">{item.texte}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bundle Section ───────────────────────────────────────────────────────────
function BundleSection({ config, accent, surface, radius, slug }: { config: Record<string, any>; accent: string; surface: string; radius: string; slug: string }) {
  const items: { nom: string; imageUrl: string; prix: string }[] = config.items || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-6">{config.titre}</h3>}
      <div className="flex flex-wrap gap-4 items-center mb-6">
        {items.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-2xl opacity-30 font-bold">+</span>}
            <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: surface }}>
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.nom} className="w-12 h-12 rounded-xl object-cover" />
                : <div className="w-12 h-12 rounded-xl" style={{ background: `${accent}15` }} />}
              <div>
                <p className="text-sm font-semibold">{item.nom}</p>
                {item.prix && <p className="text-xs font-bold" style={{ color: accent }}>{item.prix}</p>}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
      {config.ctaTexte && (
        <Link href={`/${slug}/checkout`} className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-sm"
          style={{ background: accent, color: "#fff" }}>{config.ctaTexte}</Link>
      )}
    </div>
  );
}

// ─── Comparison Section ───────────────────────────────────────────────────────
function ComparisonSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const headers: string[] = config.headers || [];
  const rows: { cells: string[] }[] = config.rows || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{config.titre}</h3>}
      <div className="overflow-x-auto max-w-3xl">
        <table className="w-full text-sm min-w-[360px]">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="py-3 px-4 text-left text-xs font-bold"
                  style={{ background: i === 1 ? accent : surface, color: i === 1 ? "#fff" : "inherit", opacity: i === 0 ? 0.5 : 1, borderRadius: i === 0 ? "12px 0 0 0" : i === headers.length - 1 ? "0 12px 0 0" : undefined }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? `${surface}80` : "transparent" }}>
                {row.cells.map((cell, j) => (
                  <td key={j} className="py-3 px-4 text-sm"
                    style={{ fontWeight: j === 1 ? 700 : 400, color: j === 1 ? accent : "inherit", opacity: j === 0 ? 0.6 : 1 }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── FAQ produit (questions spécifiques au produit, définies par le marchand) ──
function ProduitFaqSection({ faq, accent, surface }: { faq: { question: string; reponse: string }[]; accent: string; surface: string }) {
  const [open, setOpen] = React.useState<number | null>(null);
  return (
    <section className="max-w-3xl mx-auto px-4 py-10">
      <h2 className="text-xl font-bold mb-6" style={{ color: accent }}>Questions fréquentes</h2>
      <div className="space-y-3">
        {faq.map((item, idx) => (
          <div key={idx} className="rounded-2xl overflow-hidden border" style={{ borderColor: `${accent}18`, background: surface }}>
            <button
              onClick={() => setOpen(open === idx ? null : idx)}
              className="w-full flex items-center justify-between gap-4 p-5 text-left"
            >
              <span className="font-semibold text-sm leading-snug">{item.question}</span>
              <ChevronDown size={16} style={{ color: accent, flexShrink: 0, transform: open === idx ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>
            {open === idx && (
              <div className="px-5 pb-5 text-sm opacity-80 leading-relaxed border-t" style={{ borderColor: `${accent}10` }}>
                {item.reponse}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Programme de la formation (aperçu avant achat) ──────────────────────────
function embedVideoLecon(l: { videoType: string | null; videoUrl: string | null }): string | null {
  if (!l.videoUrl) return null;
  if (l.videoType === "youtube") {
    const m = l.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : l.videoUrl;
  }
  if (l.videoType === "vimeo") {
    const m = l.videoUrl.match(/vimeo\.com\/(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : l.videoUrl;
  }
  return l.videoUrl;
}

function FormationCurriculumSection({ chapitres, accent, texte, surface }: {
  chapitres: NonNullable<ProductPageClientProps["produit"]["formationCurriculum"]>["chapitres"];
  accent: string; texte: string; surface: string;
}) {
  const toutesLecons = chapitres.flatMap(c => c.lecons);
  const totalDuree = toutesLecons.reduce((s, l) => s + (l.duree ?? 0), 0);
  const [apercuId, setApercuId] = useState<string | null>(null);
  const apercu = toutesLecons.find(l => l.id === apercuId) ?? null;
  const embed = apercu ? embedVideoLecon(apercu) : null;

  return (
    <section className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-xl font-bold" style={{ color: accent }}>Programme de la formation</h2>
        <p className="text-xs opacity-50">
          {chapitres.length} chapitre{chapitres.length > 1 ? "s" : ""} · {toutesLecons.length} leçon{toutesLecons.length > 1 ? "s" : ""}
          {totalDuree > 0 && ` · ${Math.round(totalDuree / 60)} min`}
        </p>
      </div>

      {apercu && (
        <div className="mb-6 rounded-2xl overflow-hidden" style={{ border: `1px solid ${accent}25` }}>
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: `${accent}10` }}>
            <span className="text-xs font-bold" style={{ color: accent }}>Aperçu gratuit — {apercu.titre}</span>
            <button onClick={() => setApercuId(null)} className="text-xs opacity-50 hover:opacity-80">Fermer ✕</button>
          </div>
          {apercu.type === "video" && embed && (
            <div className="relative w-full" style={{ paddingBottom: "56.25%", background: "#000" }}>
              {apercu.videoType === "upload"
                ? <video src={embed} controls className="absolute inset-0 w-full h-full object-cover" />
                : <iframe src={embed} className="absolute inset-0 w-full h-full border-0" allowFullScreen />}
            </div>
          )}
          {apercu.type === "audio" && apercu.audioUrl && <audio src={apercu.audioUrl} controls className="w-full p-4" />}
          {apercu.contenu && <div className="p-4 text-sm leading-relaxed" style={{ opacity: 0.8, whiteSpace: "pre-line" }}>{apercu.contenu}</div>}
        </div>
      )}

      <div className="space-y-4">
        {chapitres.map((ch, ci) => (
          <div key={ch.id} className="rounded-2xl overflow-hidden" style={{ background: surface }}>
            <p className="text-xs font-bold uppercase tracking-widest px-4 pt-4 pb-2 opacity-50">Chapitre {ci + 1} · {ch.titre}</p>
            <div className="pb-2">
              {ch.lecons.map(l => {
                const Icon = l.type === "video" ? PlayCircle : l.type === "audio" ? Headphones : FileText;
                return (
                  <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon size={14} style={{ opacity: 0.35, flexShrink: 0 }} />
                      <span className="text-sm truncate" style={{ opacity: l.gratuite ? 1 : 0.6 }}>{l.titre}</span>
                      {l.duree ? <span className="text-[10px] opacity-35 flex-shrink-0">{Math.round(l.duree / 60)} min</span> : null}
                    </div>
                    {l.gratuite ? (
                      <button onClick={() => setApercuId(l.id)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                        style={{ background: `${accent}15`, color: accent }}>
                        Aperçu gratuit
                      </button>
                    ) : (
                      <Lock size={12} style={{ opacity: 0.25, flexShrink: 0 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Lien d'affiliation B2B (marchand AXSO devenant affilié d'un produit) ────
function AffiliateLinkButton({ tenantId, produitId, accent, surface }: {
  tenantId: string; produitId: string; accent: string; surface: string;
}) {
  const [lien, setLien] = useState<{ code: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copie, setCopie] = useState(false);

  async function generer() {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliation/generer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, produitId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setLien(data.lien);
    } catch (e: any) {
      toast.error(e.message || "Impossible de générer le lien");
    } finally {
      setLoading(false);
    }
  }

  const url = lien && typeof window !== "undefined" ? `${window.location.origin}/api/track/${lien.code}` : "";

  return (
    <div className="rounded-xl p-4" style={{ background: surface }}>
      <p className="text-xs font-bold flex items-center gap-1.5 mb-1" style={{ color: accent }}>
        <Share2 size={12} /> Vous êtes marchand AXSO ?
      </p>
      {!lien ? (
        <>
          <p className="text-xs opacity-55 mb-2.5">Devenez affilié de ce produit et touchez une commission sur chaque vente que vous générez.</p>
          <button onClick={generer} disabled={loading}
            className="text-xs font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-50"
            style={{ background: accent, color: "#fff" }}>
            {loading ? "…" : "Obtenir mon lien d'affiliation"}
          </button>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-mono truncate" style={{ background: "rgba(0,0,0,0.05)" }}>{url}</div>
          <button
            onClick={() => { navigator.clipboard.writeText(url); setCopie(true); toast.success("Copié !"); setTimeout(() => setCopie(false), 2000); }}
            className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: accent, color: "#fff" }}>
            {copie ? "Copié" : "Copier"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ProductPageClient({ produit, tenant, produitsSimilaires }: ProductPageClientProps) {
  const { slug, devise, accent, fond, texte, surface, radius, whatsapp, whatsappNumero, nomBoutique, certifie } = tenant;

  // ─── Layout + Boutons (config globale du builder, comme sur la page d'accueil) ──
  const layoutCfg = tenant.layout ?? {};
  const CONTAINER = layoutCfg.largeurContainer === "100%" ? "max-w-full" : `max-w-[${layoutCfg.largeurContainer || "1280px"}]`;

  const boutonsCfg = tenant.boutons ?? {};
  const btnStyle = boutonsCfg.style || "filled";
  const btnRempli = !["outlined", "ghost"].includes(btnStyle);
  const btnRadiusPx = btnStyle === "pill" ? "999px" : btnStyle === "square" ? "0px" : radius;
  const TAILLE_MAP: Record<string, { padY: string; text: string }> = {
    sm: { padY: "10px", text: "13px" },
    md: { padY: "14px", text: "15px" },
    lg: { padY: "16px", text: "16px" },
    xl: { padY: "20px", text: "18px" },
  };
  const btnTaille = TAILLE_MAP[boutonsCfg.taille || "lg"];
  const HOVER_CLASS: Record<string, string> = {
    lighten: "hover:brightness-110",
    darken: "hover:brightness-90",
    scale: "hover:scale-[1.02] active:scale-[0.98]",
    glow: "axs-btn-glow",
    slide: "hover:translate-x-0.5",
  };
  const btnHoverClass = `transition-all ${HOVER_CLASS[boutonsCfg.hover || "scale"] ?? HOVER_CLASS.scale}`;
  const btnAchatSizing: React.CSSProperties = {
    borderRadius: btnRadiusPx,
    padding: `${btnTaille.padY} 24px`,
    fontSize: btnTaille.text,
  };

  // Sections resolution
  const pp = tenant.productPage;
  const sections: ProdSection[] = pp?.sections?.length ? pp.sections : DEFAULT_SECTIONS;
  const getSec = (type: string) => sections.find(s => s.type === type);
  const isOn   = (type: string) => getSec(type)?.actif !== false;

  // Derived config
  const galCfg     = getSec("gallery")?.config ?? {};
  const infoCfg    = getSec("info")?.config ?? {};
  const descCfg    = getSec("description")?.config ?? {};
  const simCfg     = getSec("similar")?.config ?? {};

  const zoomEnabled    = galCfg.zoom !== false;
  const stickyGallery  = galCfg.sticky !== false;
  const showBreadcrumbs = isOn("info") && infoCfg.breadcrumbs !== false;
  const showBadges      = isOn("info") && infoCfg.badges !== false;
  const showStock       = isOn("info") && infoCfg.stock !== false;
  const showAiDesc      = descCfg.ai !== false;
  const similarTitre    = simCfg.titre || "Vous aimerez aussi";

  const rightSections = sections.filter(s => RIGHT_COL.has(s.type) && s.actif);
  const belowSections = sections.filter(s => BELOW_TYPES.has(s.type) && s.actif);

  // State
  const [selectedVariante, setSelectedVariante] = useState<Variante | null>(null);
  const [quantite, setQuantite] = useState(1);
  const [tab, setTab] = useState<"description" | "livraison" | "avis">("description");
  const [variantePrix, setVariantePrix] = useState<{ id: string; nom: string; prix: number; prixPromo: number | null } | null>(null);

  const { ajouterItem, setTenant } = useCartStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Présélection d'une variante de prix via ?v=
  useEffect(() => {
    const vId = searchParams.get("v");
    if (!vId) return;
    fetch(`/api/v/${vId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.variante) {
          setVariantePrix({
            id:       d.variante.id,
            nom:      d.variante.nom,
            prix:     d.variante.prix,
            prixPromo: d.variante.prixPromo,
          });
        }
      })
      .catch(() => {});
  }, [searchParams]);

  const prixEffectif = variantePrix?.prix ?? selectedVariante?.prix ?? produit.prixAffiche;
  const stockEffectif = selectedVariante !== null ? selectedVariante.stock : produit.stock;
  const enRupture     = stockEffectif === 0;

  function doAddToCart() {
    if (enRupture) return;
    setTenant(slug);
    ajouterItem({
      produitId: produit.id, nom: produit.nom, prix: prixEffectif,
      imageUrl: produit.images[0] ?? undefined,
      stock: produit.type === "digital" ? 9999 : stockEffectif,
      quantite, type: produit.type as any,
      fichierUrl: produit.fichierUrl ?? undefined, fichierNom: produit.fichierNom ?? undefined,
      variante: selectedVariante ? `${selectedVariante.nom}: ${selectedVariante.valeur}` : undefined,
    });
    toast.success(`${produit.nom} ajouté au panier`);
  }

  function buyNow() { doAddToCart(); router.push(`/${slug}/checkout`); }

  const waNum = (whatsappNumero || whatsapp || "").replace(/\D/g, "");
  const waMsg = encodeURIComponent(`Bonjour, je suis intéressé par : ${produit.nom}`);

  return (
    <div style={{ backgroundColor: fond, color: texte, minHeight: "100vh" }}>

      {/* Breadcrumb */}
      {showBreadcrumbs && (
        <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8 py-3`}>
          <div className="flex items-center gap-1 text-xs flex-wrap" style={{ opacity: 0.45 }}>
            <Link href={`/${slug}`} className="hover:opacity-100 transition-opacity">Accueil</Link>
            <ChevronRight size={10} />
            <Link href={`/${slug}/produits`} className="hover:opacity-100 transition-opacity">Produits</Link>
            {produit.categorie && <><ChevronRight size={10} /><span>{produit.categorie}</span></>}
            <ChevronRight size={10} />
            <span className="truncate max-w-[200px]" style={{ color: texte }}>{produit.nom}</span>
          </div>
        </div>
      )}

      <main className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8 pb-20`}>
        <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)] gap-10 lg:gap-16 items-start">

          {/* Gallery */}
          {isOn("gallery") && (
            <ImageGallery images={produit.images} nom={produit.nom} accent={accent}
              radius={radius} zoomEnabled={zoomEnabled} sticky={stickyGallery} />
          )}

          {/* Right column */}
          <div className="space-y-5 py-1">
            {/* Info header */}
            {isOn("info") && (
              <>
                {produit.collections.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {produit.collections.map(col => (
                      <Link key={col.slug} href={`/${slug}/collections/${col.slug}`}>
                        <span className="text-xs px-3 py-1 rounded-full border transition-all hover:opacity-100"
                          style={{ borderColor: `${accent}40`, color: accent, opacity: 0.8 }}>{col.nom}</span>
                      </Link>
                    ))}
                  </div>
                )}
                {produit.marque && (
                  <p className="text-xs font-semibold" style={{ color: accent }}>
                    Marque : <span style={{ opacity: 0.6, fontWeight: 400 }}>{produit.marque}</span>
                  </p>
                )}
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold leading-snug">{produit.nom}</h1>
                  <WishlistHeartButton produitId={produit.id} accent={accent} fond={surface} size={17} className="flex-shrink-0 w-10 h-10 rounded-full mt-0.5" />
                </div>
                {produit.avis.length > 0 && (
                  <button onClick={() => setTab("avis")} className="flex items-center gap-2 group">
                    <Stars note={produit.noteMoyenne} size={15} accent={accent} />
                    <span className="text-sm font-semibold" style={{ color: accent }}>{produit.noteMoyenne.toFixed(1)}</span>
                    <span className="text-sm opacity-50 group-hover:opacity-80 underline transition-opacity">{produit.avis.length} avis</span>
                  </button>
                )}
                <div className="h-px" style={{ background: `${accent}12` }} />
                {showBadges && produit.remise > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black px-2.5 py-1 rounded-lg" style={{ background: "#EF4444", color: "#fff" }}>
                      -{produit.remise}% · Offre limitée
                    </span>
                  </div>
                )}
                {variantePrix && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
                    style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}>
                    <span>✦ Offre sélectionnée :</span>
                    <span className="font-bold">{variantePrix.nom}</span>
                  </div>
                )}
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-4xl font-black" style={{ color: accent }}>{formatMontant(prixEffectif, devise)}</span>
                  {(variantePrix?.prixPromo || (produit.prixCompareAffiche && produit.prixCompareAffiche > produit.prixAffiche)) && (
                    <span className="text-lg opacity-35 line-through">
                      {formatMontant(variantePrix?.prixPromo ?? produit.prixCompareAffiche!, devise)}
                    </span>
                  )}
                </div>
                {showStock && (
                  <div className="flex items-center gap-2 text-sm">
                    {enRupture ? (
                      <><div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" /><span className="text-red-500 font-semibold">Rupture de stock</span></>
                    ) : stockEffectif <= 10 ? (
                      <><div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" /><span className="font-medium flex items-center gap-1"><AlertTriangle size={13} className="text-amber-400" />Plus que <strong>{stockEffectif}</strong> en stock</span></>
                    ) : (
                      <><div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" /><span className="text-emerald-600 font-semibold">En stock · Expédition sous 24-48h</span></>
                    )}
                  </div>
                )}
                {produit.description && (
                  <p className="text-sm leading-relaxed" style={{ opacity: 0.6, paddingLeft: "12px", borderLeft: `3px solid ${accent}30` }}>
                    {produit.description.length > 220 ? produit.description.slice(0, 220) + "…" : produit.description}
                  </p>
                )}
                <div className="h-px" style={{ background: `${accent}12` }} />
              </>
            )}

            {/* Right-column sections in order */}
            {rightSections.map(sec => (
              <React.Fragment key={sec.id}>
                {sec.type === "variants" && produit.variantes.length > 0 && (
                  <VariantSelector variantes={produit.variantes} accent={accent} radius={radius}
                    selected={selectedVariante} onSelect={setSelectedVariante} />
                )}
                {sec.type === "quantity" && (
                  <>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium opacity-55">Quantité</span>
                      <div className="flex items-center border rounded-xl overflow-hidden" style={{ borderColor: `${accent}25` }}>
                        <button onClick={() => setQuantite(q => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center hover:opacity-80" style={{ color: accent }}><Minus size={14} /></button>
                        <span className="w-10 text-center text-sm font-bold tabular-nums">{quantite}</span>
                        <button onClick={() => setQuantite(q => Math.min(enRupture ? 1 : stockEffectif, q + 1))} disabled={enRupture} className="w-10 h-10 flex items-center justify-center hover:opacity-80" style={{ color: accent }}><Plus size={14} /></button>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <button onClick={doAddToCart} disabled={enRupture}
                        className={`w-full font-bold disabled:opacity-35 flex items-center justify-center gap-3 ${btnHoverClass}`}
                        style={{
                          ...btnAchatSizing,
                          background: enRupture ? "#E0E0E0" : (btnRempli ? `linear-gradient(135deg, ${accent} 0%, ${accent}CC 100%)` : "transparent"),
                          color: enRupture ? "#999" : (btnRempli ? "#fff" : accent),
                          border: !btnRempli ? `2px solid ${accent}` : "none",
                          textDecoration: btnStyle === "ghost" ? "underline" : "none",
                          boxShadow: enRupture || !btnRempli ? "none" : `0 6px 24px ${accent}40`,
                          ["--ax-accent-glow" as any]: `${accent}80`,
                        }}>
                        {TYPES_DIGITAUX.has(produit.type) ? <Download size={18} /> : <ShoppingCart size={18} />}
                        {enRupture ? "Indisponible" : (produit.texteBoutonAchat || "Ajouter au panier")}
                      </button>
                      <button onClick={buyNow} disabled={enRupture}
                        className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-35 border-2 flex items-center justify-center gap-2"
                        style={{ borderColor: accent, color: accent, background: `${accent}08`, borderRadius: btnRadiusPx }}>
                        <ShoppingBag size={16} /> Acheter maintenant
                      </button>
                      {waNum && (
                        <a href={`https://wa.me/${waNum}?text=${waMsg}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-sm border-2 transition-all hover:opacity-80"
                          style={{ borderColor: "rgba(37,211,102,0.35)", color: "#25D366", background: "rgba(37,211,102,0.05)" }}>
                          <MessageCircle size={16} /> Contacter via WhatsApp
                        </a>
                      )}
                    </div>
                  </>
                )}
                {sec.type === "trust" && (
                  <>
                    {showBadges && (
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {[
                          { icon: <Lock size={15} style={{ color: accent }} />, label: "Paiement sécurisé" },
                          { icon: <Truck size={15} style={{ color: accent }} />, label: "Livraison rapide" },
                          { icon: <RotateCcw size={15} style={{ color: accent }} />, label: "Retour 14 jours" },
                        ].map(b => (
                          <div key={b.label} className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl text-center" style={{ background: surface }}>
                            {b.icon}
                            <p className="text-[10px] font-semibold leading-tight" style={{ opacity: 0.55 }}>{b.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="rounded-xl p-4" style={{ background: surface }}>
                      <p className="text-xs opacity-50 mb-0.5">Vendu par</p>
                      <p className="text-sm font-semibold">
                        {nomBoutique}
                        {certifie && <span className="ml-1.5 text-[10px] text-emerald-500 font-bold">✓ Certifié Axso</span>}
                      </p>
                    </div>
                    {tenant.peutDevenirAffilie && (
                      <AffiliateLinkButton tenantId={tenant.id} produitId={produit.id} accent={accent} surface={surface} />
                    )}
                  </>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Below sections in order */}
        {belowSections.map(sec => (
          <StyledSection key={sec.id} style={sec.style}>

            {sec.type === "description" && (
              <>
                <div className="mt-16 border-b" style={{ borderColor: `${accent}15` }}>
                  <div className="flex gap-1 overflow-x-auto">
                    {[
                      { key: "description", label: "Description" },
                      { key: "livraison", label: "Livraison & retours" },
                      ...(isOn("reviews") ? [{ key: "avis", label: `Avis (${produit.avis.length})` }] : []),
                    ].map(t => (
                      <button key={t.key} onClick={() => setTab(t.key as any)}
                        className="px-5 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap flex-shrink-0"
                        style={{ borderColor: tab === t.key ? accent : "transparent", color: tab === t.key ? accent : texte, opacity: tab === t.key ? 1 : 0.4 }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="py-10 max-w-3xl">
                  {tab === "description" && (
                    <div className="space-y-5">
                      {produit.description && <p className="text-base leading-relaxed" style={{ opacity: 0.7 }}>{produit.description}</p>}
                      {showAiDesc && produit.descriptionIA && (
                        <div className="p-5 rounded-2xl" style={{ background: surface }}>
                          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: accent }}>Description enrichie par IA</p>
                          <p className="text-sm leading-relaxed" style={{ opacity: 0.7 }}>{produit.descriptionIA}</p>
                        </div>
                      )}
                      {!produit.description && !produit.descriptionIA && <p className="text-sm" style={{ opacity: 0.35 }}>Aucune description disponible.</p>}
                    </div>
                  )}
                  {tab === "livraison" && (
                    <div className="space-y-3">
                      {[
                        { icon: <Truck size={18} style={{ color: accent }} />, titre: "Livraison standard", texte: "Préparée sous 24–48h ouvrées." },
                        { icon: <RotateCcw size={18} style={{ color: accent }} />, titre: "Politique de retour", texte: "Retours sous 14 jours, produit intact." },
                        { icon: <Lock size={18} style={{ color: accent }} />, titre: "Paiement sécurisé", texte: "Transactions SSL. Mobile money, carte ou à la livraison." },
                      ].map(item => (
                        <div key={item.titre} className="flex gap-4 p-5 rounded-2xl" style={{ background: surface }}>
                          <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
                          <div><p className="font-semibold text-sm mb-1">{item.titre}</p><p className="text-sm" style={{ opacity: 0.6 }}>{item.texte}</p></div>
                        </div>
                      ))}
                    </div>
                  )}
                  {tab === "avis" && isOn("reviews") && (
                    <div className="space-y-8">
                      {produit.avis.length > 0 ? (
                        <>
                          <RatingBreakdown avis={produit.avis} accent={accent} moyenne={produit.noteMoyenne} />
                          <div className="h-px" style={{ background: `${accent}12` }} />
                          <div className="grid gap-4 sm:grid-cols-2">
                            {produit.avis.map(avis => (
                              <div key={avis.id} className="p-5 rounded-2xl" style={{ background: surface, border: `1px solid ${accent}10` }}>
                                <div className="flex items-center justify-between mb-2">
                                  <Stars note={avis.note} size={13} accent={accent} />
                                  {avis.verifie && <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-0.5"><Check size={10} /> Achat vérifié</span>}
                                </div>
                                {avis.titre && <p className="font-semibold text-sm mb-1">{avis.titre}</p>}
                                {avis.commentaire && <p className="text-sm leading-relaxed" style={{ opacity: 0.6 }}>{avis.commentaire}</p>}
                                <p className="text-xs mt-3 font-semibold" style={{ opacity: 0.3 }}>— {avis.client?.nom || "Client"}</p>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-10">
                          <Star size={32} className="mx-auto mb-3" style={{ opacity: 0.12, color: accent }} />
                          <p className="font-medium text-sm" style={{ opacity: 0.35 }}>Soyez le premier à laisser un avis.</p>
                        </div>
                      )}
                      <AvisForm
                        tenantId={tenant.id}
                        produitId={produit.id}
                        accent={accent}
                        surface={surface}
                        radius={radius}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {sec.type === "reviews" && !isOn("description") && produit.avis.length > 0 && (
              <div className="mt-12 border-t pt-12" style={{ borderColor: `${accent}10` }}>
                <h2 className="text-xl font-bold mb-8">Avis clients</h2>
                <div className="space-y-8 max-w-3xl">
                  <RatingBreakdown avis={produit.avis} accent={accent} moyenne={produit.noteMoyenne} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {produit.avis.map(avis => (
                      <div key={avis.id} className="p-5 rounded-2xl" style={{ background: surface, border: `1px solid ${accent}10` }}>
                        <div className="flex items-center justify-between mb-2">
                          <Stars note={avis.note} size={13} accent={accent} />
                          {avis.verifie && <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-0.5"><Check size={10} /> Achat vérifié</span>}
                        </div>
                        {avis.commentaire && <p className="text-sm leading-relaxed" style={{ opacity: 0.6 }}>{avis.commentaire}</p>}
                        <p className="text-xs mt-3 font-semibold" style={{ opacity: 0.3 }}>— {avis.client?.nom || "Client"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {sec.type === "similar" && produitsSimilaires.length > 0 && (
              <div className="mt-8 border-t pt-12" style={{ borderColor: `${accent}10` }}>
                <h2 className="text-xl font-bold mb-6">{similarTitre}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {produitsSimilaires.map(p => (
                    <Link key={p.id} href={`/${slug}/produits/${p.id}`} className="group">
                      <div className="rounded-2xl overflow-hidden border transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-0.5" style={{ background: surface, borderColor: `${accent}12` }}>
                        <div className="relative aspect-square overflow-hidden" style={{ background: fond }}>
                          {p.images[0]
                            ? <img src={p.images[0]} alt={p.nom} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            : <div className="w-full h-full flex items-center justify-center"><Package size={28} className="opacity-20" /></div>}
                          <WishlistHeartButton produitId={p.id} accent={accent} fond={fond} size={13} className="absolute top-2 right-2 w-7 h-7 rounded-full" />
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium line-clamp-2 leading-snug mb-1">{p.nom}</p>
                          <p className="text-sm font-bold" style={{ color: accent }}>{formatMontant(p.prixAffiche, devise)}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {sec.type === "richtext"     && <RichtextSection    config={sec.config} accent={accent} radius={radius} slug={slug} />}
            {sec.type === "features"     && <FeaturesSection    config={sec.config} accent={accent} surface={surface} radius={radius} />}
            {sec.type === "howto"        && <HowtoSection       config={sec.config} accent={accent} surface={surface} />}
            {sec.type === "banner"       && <BannerSection      config={sec.config} accent={accent} radius={radius} slug={slug} />}
            {sec.type === "video"        && <VideoSection       config={sec.config} accent={accent} radius={radius} />}
            {sec.type === "faq"          && <FaqSection         config={sec.config} accent={accent} surface={surface} />}
            {sec.type === "specs"        && <SpecsSection       config={sec.config} accent={accent} surface={surface} />}
            {sec.type === "ingredients"  && <IngredientsSection config={sec.config} accent={accent} surface={surface} />}
            {sec.type === "testimonials" && <TestimonialsSection config={sec.config} accent={accent} surface={surface} />}
            {sec.type === "sizeguide"    && <SizeGuideSection   config={sec.config} accent={accent} surface={surface} />}
            {sec.type === "guarantee"    && <GuaranteeSection   config={sec.config} accent={accent} surface={surface} />}
            {sec.type === "bundle"       && <BundleSection      config={sec.config} accent={accent} surface={surface} radius={radius} slug={slug} />}
            {sec.type === "comparison"   && <ComparisonSection  config={sec.config} accent={accent} surface={surface} />}
            {sec.type === "countdown"    && <CountdownSection   config={sec.config} accent={accent} surface={surface} slug={slug} />}
            {sec.type === "social"       && <SocialSection      accent={accent} nom={produit.nom} />}

          </StyledSection>
        ))}

        {/* Programme de la formation (aperçu avant achat) */}
        {produit.formationCurriculum && produit.formationCurriculum.chapitres.length > 0 && (
          <FormationCurriculumSection chapitres={produit.formationCurriculum.chapitres} accent={accent} texte={texte} surface={surface} />
        )}

        {/* FAQ produit spécifique */}
        {(produit.faq ?? []).length > 0 && (
          <ProduitFaqSection faq={produit.faq!} accent={accent} surface={surface} />
        )}
      </main>

      <footer className="border-t py-8 text-center text-xs" style={{ borderColor: `${accent}10`, opacity: 0.35 }}>
        <p>{nomBoutique} · Propulsé par <span style={{ color: accent, opacity: 1 }}>Axso</span></p>
      </footer>
    </div>
  );
}
