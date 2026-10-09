"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { urlVideoIntegree } from "@/lib/utils";
import { usePrix } from "@/components/storefront/DeviseVitrine";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { WishlistHeartButton } from "./WishlistHeartButton";
import { SECTIONS_FICHE } from "@/lib/fiche-produit";
import {
  Package, AlertTriangle, Lock, RotateCcw, Check, Loader2, ChevronLeft,
  Star, Minus, Plus, Truck, ZoomIn,
  MessageCircle, Download, ChevronRight, ShoppingBag,
  ChevronDown, Share2, PlayCircle, Headphones, FileText,
} from "lucide-react";
import { useT } from "@/components/I18nProvider";

// ─── Types ────────────────────────────────────────────────────────────────────
type Variante = { id: string; nom: string; valeur: string; prix: number | null; stock: number };
type Avis = {
  id: string; note: number; titre: string | null; commentaire: string | null;
  verifie: boolean; client: { nom: string } | null; createdAt: string;
};
type SectionStyle = { bgColor?: string; textColor?: string; paddingY?: string; marginY?: string; maxWidth?: string; align?: string; fontScale?: string };
type ProdSection = { id: string; type: string; actif: boolean; config: Record<string, any>; style?: SectionStyle };

/** Config d'une section complétée par ses valeurs par défaut (sections enregistrées avant l'ajout d'une option). */
const cfgDe = (sec?: ProdSection): Record<string, any> => ({ ...(sec ? SECTIONS_FICHE[sec.type]?.defaut() : {}), ...(sec?.config ?? {}) });
const estImage = (v: string) => /^(https?:|\/|data:image)/.test(v);

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

// "addToCart" (ancien bloc « Ajouter au panier ») n'est plus rendu : il n'y a pas de panier.
const RIGHT_COL = new Set(["info", "variants", "quantity", "trust"]);
// Types de produits digitaux — pas de stock physique, bouton "télécharger/accéder"
// plutôt que "panier". Garder en phase avec TYPES_PRODUIT_DIGITAL (lib/affiliation.ts).
const TYPES_DIGITAUX = new Set(["digital", "fichier", "formation", "licence"]);
const BELOW_TYPES = new Set(["description","reviews","similar","richtext","features","howto","banner","video","faq","specs","ingredients","testimonials","sizeguide","guarantee","bundle","comparison","social"]);

export interface ProductPageClientProps {
  produit: {
    id: string; nom: string; description: string | null; descriptionIA: string | null;
    images: string[]; videos?: string[]; prixAffiche: number; prixCompareAffiche: number | null;
    remise: number; stock: number; type: string; fichierUrl: string | null;
    fichierNom: string | null; categorie: string | null; marque: string | null;
    variantes: Variante[]; avis: Avis[];
    collections: { nom: string; slug: string }[]; noteMoyenne: number;
    masquerVentes?: boolean;
    texteBoutonAchat?: string | null;
    faq?: { question: string; reponse: string; image?: string }[];
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
    boutiqueDigitale?: boolean; // pas de panier : achat direct
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
  const tx = useT();
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
      <p className="font-semibold text-sm mb-1">{tx("Merci pour votre avis !")}</p>
      <p className="text-xs opacity-40">{tx("Il sera visible après modération.")}</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="rounded-2xl p-6 space-y-4" style={{ background: surface, border: `1px solid ${accent}15` }}>
      <h3 className="font-bold text-sm">{tx("Laisser un avis")}</h3>

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
        {note > 0 && <span className="text-xs ml-2 opacity-40">{tx(["","Décevant","Moyen","Bien","Très bien","Excellent"][note])}</span>}
      </div>

      {/* Fields */}
      <div className="grid sm:grid-cols-2 gap-3">
        <input value={nom} onChange={e => setNom(e.target.value)} placeholder={tx("Votre nom *")}
          className="w-full px-3 py-2.5 text-sm outline-none transition-all"
          style={{ borderRadius: rad, border: `1px solid ${accent}20`, background: "transparent" }} />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={tx("Votre email *")}
          className="w-full px-3 py-2.5 text-sm outline-none transition-all"
          style={{ borderRadius: rad, border: `1px solid ${accent}20`, background: "transparent" }} />
      </div>
      <input value={titre} onChange={e => setTitre(e.target.value)} placeholder={tx("Titre (optionnel)")}
        className="w-full px-3 py-2.5 text-sm outline-none"
        style={{ borderRadius: rad, border: `1px solid ${accent}20`, background: "transparent" }} />
      <textarea value={commentaire} onChange={e => setComment(e.target.value)} placeholder={tx("Votre commentaire…")} rows={3}
        className="w-full px-3 py-2.5 text-sm outline-none resize-none"
        style={{ borderRadius: rad, border: `1px solid ${accent}20`, background: "transparent" }} />

      {err && <p className="text-xs text-red-500">{tx(err)}</p>}

      <button type="submit" disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
        style={{ background: accent, color: "white", borderRadius: rad, border: "none", cursor: loading ? "default" : "pointer" }}>
        {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : <Star size={14} fill="white" stroke="none" />}
        {loading ? tx("Envoi…") : tx("Soumettre l'avis")}
      </button>
    </form>
  );
}

// ─── Rating Breakdown ─────────────────────────────────────────────────────────
function RatingBreakdown({ avis, accent, moyenne }: { avis: Avis[]; accent: string; moyenne: number }) {
  const tx = useT();
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
            <span className="text-xs w-2 opacity-50 tabular-nums">{tx(stars)}</span>
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

// ─── Diaporama (galerie + bannière pleine largeur) ───────────────────────────
// Flèches, clavier, glissement du doigt, défilement automatique (4 s, en pause
// au survol / au toucher, coupé si l'utilisateur réduit les animations).
function useDiaporama(n: number, autoplay: boolean) {
  const [selected, setSelected] = useState(0);
  const [pause, setPause] = useState(false);
  const toucheX = React.useRef<number | null>(null);
  const aller = (i: number) => setSelected(((i % n) + n) % n);
  useEffect(() => {
    if (!autoplay || pause || n < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setSelected((s) => (s + 1) % n), 4000);
    return () => clearInterval(id);
  }, [autoplay, pause, n]);
  const props = n > 1 ? {
    role: "region", "aria-roledescription": "diaporama", tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "ArrowRight") aller(selected + 1); if (e.key === "ArrowLeft") aller(selected - 1); },
    onTouchStart: (e: React.TouchEvent) => { toucheX.current = e.touches[0].clientX; setPause(true); },
    onTouchEnd: (e: React.TouchEvent) => { const d = toucheX.current == null ? 0 : e.changedTouches[0].clientX - toucheX.current; if (Math.abs(d) > 40) aller(selected + (d < 0 ? 1 : -1)); toucheX.current = null; },
  } : {};
  return { selected, setSelected, aller, setPause, props };
}

function FlechesDiaporama({ n, selected, aller, toujoursVisibles = false }: { n: number; selected: number; aller: (i: number) => void; toujoursVisibles?: boolean }) {
  const tx = useT();
  if (n < 2) return null;
  return (
    <>
      {[-1, 1].map((sens) => (
        <button key={sens} type="button" onClick={(e) => { e.stopPropagation(); aller(selected + sens); }} aria-label={sens < 0 ? tx("Image précédente") : tx("Image suivante")}
          className={`absolute top-1/2 -translate-y-1/2 ${sens < 0 ? "left-2" : "right-2"} z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-white/90 text-[#111111] shadow-md transition-opacity ${toujoursVisibles ? "" : "sm:opacity-0 sm:group-hover:opacity-100"} focus-visible:opacity-100`}>
          {sens < 0 ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      ))}
      <span className="absolute top-3 left-3 z-10 text-[11px] font-semibold px-2 py-1 rounded-full bg-black/55 text-white pointer-events-none tabular-nums">{tx(selected) + 1} / {n}</span>
    </>
  );
}

function PisteImages({ images, nom, selected }: { images: string[]; nom: string; selected: number }) {
  const tx = useT();
  const n = images.length;
  return (
    <div className="flex h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${selected * 100}%)` }}>
      {images.map((img, i) => (
        <img key={i} src={img} alt={n > 1 ? tx("{0} — image {1} sur {2}", nom, i + 1, n) : nom} loading={i === 0 ? "eager" : "lazy"}
          className="w-full h-full object-cover flex-shrink-0" draggable={false} aria-hidden={i !== selected} />
      ))}
    </div>
  );
}

// Mise en page « Pleine largeur » : bannière plein écran, elle aussi en diaporama.
function BanniereDiaporama({ images, nom, autoplay }: { images: string[]; nom: string; autoplay: boolean }) {
  const tx = useT();
  const { selected, aller, setPause, props } = useDiaporama(images.length, autoplay);
  return (
    <div className="relative w-full overflow-hidden group outline-none" style={{ height: "60vh", minHeight: 380 }}
      {...props} aria-label={images.length > 1 ? tx("Images de {0}", nom) : undefined}
      onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)}>
      <PisteImages images={images} nom={nom} selected={selected} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.6) 100%)" }} />
      <FlechesDiaporama n={images.length} selected={selected} aller={aller} />
    </div>
  );
}

// ─── Image Gallery ────────────────────────────────────────────────────────────
function ImageGallery({ images, nom, accent, radius, zoomEnabled = true, sticky = true, style = "vertical-thumbs", autoplay = false }: {
  images: string[]; nom: string; accent: string; radius: string; zoomEnabled?: boolean; sticky?: boolean;
  style?: "vertical-thumbs" | "horizontal-thumbs" | "dots"; // miniatures retirées : seul « dots » ajoute des points sous la photo
  autoplay?: boolean; // diaporama automatique (toutes les 4 s, en pause au survol / au toucher)
}) {
  const tx = useT();
  const n = images.length;
  const { selected, setSelected, aller, setPause, props: diaporama } = useDiaporama(n, autoplay);
  const [zoomData, setZoomData] = useState<{ x: number; y: number; panelLeft: number; panelTop: number } | null>(null);
  const current = images[selected] ?? null;
  const showDots = style === "dots" && images.length > 1;

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
        <div className="flex-1 group">
          <div className="relative aspect-square overflow-hidden select-none outline-none focus-visible:ring-2"
            {...diaporama} aria-label={n > 1 ? tx("Images de {0}", nom) : undefined}
            onMouseEnter={() => setPause(true)}
            style={{ borderRadius: radius, background: "#F6F6F6", cursor: zoomData ? "crosshair" : zoomEnabled ? "zoom-in" : "default" }}
            onMouseMove={handleMouseMove} onMouseLeave={() => { setZoomData(null); setPause(false); }}>
            {n > 0
              ? <PisteImages images={images} nom={nom} selected={selected} />
              : <div className="w-full h-full flex items-center justify-center"><Package size={64} className="opacity-20" /></div>}
            <FlechesDiaporama n={n} selected={selected} aller={aller} />
            {zoomEnabled && !zoomData && current && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] font-medium px-2.5 py-1.5 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}>
                <ZoomIn size={10} />{" "}{tx("Survolez pour zoomer")}
              </div>
            )}
          </div>
          {/* Points de pagination : présentation épurée, sans miniatures */}
          {showDots && (
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {images.map((_, i) => (
                <button key={i} onClick={() => setSelected(i)} aria-label={tx("Image {0}", i + 1)}
                  className="rounded-full transition-all duration-200"
                  style={{ width: i === selected ? 18 : 6, height: 6, background: i === selected ? accent : `${accent}30` }} />
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
function VariantSelector({ variantes, accent, radius, selected, onSelect, cfg }: {
  variantes: Variante[]; accent: string; radius: string;
  selected: Variante | null; onSelect: (v: Variante | null) => void; cfg: Record<string, any>;
}) {
  const tx = useT();
  const TAILLE: Record<string, string> = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2.5 text-[15px]", lg: "px-5 py-3 text-base" };
  const GAP: Record<string, string> = { serre: "gap-1.5", normal: "gap-2.5", large: "gap-4" };
  const rayon = cfg.style === "pastilles" ? "999px" : radius;
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
            {cfg.afficherLibelle !== false && (
              <p className="text-[15px] font-medium mb-2.5">
                <span className="opacity-60">{tx(nom)} :</span>{" "}
                {current && <span className="font-bold" style={{ color: accent }}>{tx(current.valeur)}</span>}
              </p>
            )}
            {cfg.style === "liste" ? (
              <select value={current?.id ?? ""} onChange={e => onSelect(variants.find(v => v.id === e.target.value) ?? null)}
                className={`w-full ${TAILLE[cfg.taille] ?? TAILLE.md} bg-transparent outline-none`}
                style={{ borderRadius: radius, border: `2px solid ${current ? accent : "rgba(0,0,0,0.12)"}` }}>
                <option value="">{tx("Choisir")}{" "}{nom.toLowerCase()}…</option>
                {variants.map(v => <option key={v.id} value={v.id} disabled={v.stock === 0}>{tx(v.valeur)}{v.stock === 0 ? tx(" (épuisé)") : ""}</option>)}
              </select>
            ) : (
            <div className={`flex flex-wrap ${GAP[cfg.espacement] ?? GAP.normal}`}>
              {variants.map(v => {
                const isSelected = selected?.id === v.id;
                const isOut = v.stock === 0;
                return (
                  <button key={v.id} onClick={() => onSelect(isSelected ? null : v)} disabled={isOut}
                    className={`relative ${TAILLE[cfg.taille] ?? TAILLE.md} font-medium transition-all duration-150`}
                    style={{ borderRadius: rayon, border: `2px solid ${isSelected ? accent : "rgba(0,0,0,0.12)"}`, background: isSelected ? `${accent}12` : "transparent", color: isSelected ? accent : "inherit", opacity: isOut ? 0.3 : 1 }}>
                    {tx(v.valeur)}
                    {isOut && <span className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="w-[130%] h-px bg-current opacity-50 rotate-[-15deg] absolute" /></span>}
                  </button>
                );
              })}
            </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Wrapper de style par section (fond, texte, espacement, largeur, alignement) ─
function StyledSection({ style, children }: { style?: SectionStyle; children: React.ReactNode }) {
  if (!style) return <>{children}</>;
  const paddingMap: Record<string, string> = { none: "0", sm: "24px", md: "48px", lg: "72px", xl: "96px" };
  const margeMap: Record<string, string> = { none: "0", sm: "16px", md: "32px", lg: "56px" };
  const maxWidthMap: Record<string, string> = { full: "100%", medium: "896px", narrow: "640px" };
  // zoom : agrandit tout le contenu (textes Tailwind en rem compris) sans toucher au reste de la page.
  const zoomMap: Record<string, number> = { sm: 0.92, md: 1, lg: 1.1, xl: 1.2 };
  const py = paddingMap[style.paddingY || "none"];
  const my = style.marginY ? margeMap[style.marginY] : style.bgColor ? "32px" : undefined;
  return (
    <div style={{
      background: style.bgColor || undefined,
      color: style.textColor || undefined,
      padding: style.bgColor ? `${py} 24px` : (py !== "0" ? `${py} 0` : undefined),
      borderRadius: style.bgColor ? "24px" : undefined,
      marginTop: my, marginBottom: style.marginY ? my : undefined,
      zoom: style.fontScale && style.fontScale !== "md" ? zoomMap[style.fontScale] : undefined,
    }}>
      <div style={{ maxWidth: maxWidthMap[style.maxWidth || "full"], margin: style.align === "center" ? "0 auto" : undefined, textAlign: style.align as any }}>
        {children}
      </div>
    </div>
  );
}

// ─── Countdown (affiché juste sous le prix) ───────────────────────────────────
function CountdownSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const tx = useT();
  // null avant le montage : pas d'écart de rendu serveur/client sur l'heure.
  const [reste, setReste] = useState<number | null>(null);
  useEffect(() => {
    const end = new Date(config.dateFin || "").getTime();
    const tick = () => setReste(Math.max(0, (end || 0) - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [config.dateFin]);
  if (!reste) return null; // pas monté, date invalide ou offre terminée

  const unites = [
    { v: Math.floor(reste / 86400000), l: "Jours" }, { v: Math.floor((reste % 86400000) / 3600000), l: "Heures" },
    { v: Math.floor((reste % 3600000) / 60000), l: "Min" }, { v: Math.floor((reste % 60000) / 1000), l: "Sec" },
  ];
  return (
    <div className="rounded-2xl px-4 py-3.5" style={{ background: `${accent}0D`, border: `1px solid ${accent}30` }}>
      {config.titre && <p className="text-sm font-bold leading-snug" style={{ color: accent }}>{tx(config.titre)}</p>}
      {config.texte && <p className="text-[13px] leading-snug opacity-60 mt-0.5">{tx(config.texte)}</p>}
      <div className={`flex items-start gap-1.5 ${config.titre || config.texte ? "mt-2.5" : ""}`}>
        {unites.map((u, i) => (
          <div key={u.l} className="flex items-start gap-1.5">
            {i > 0 && <span className="text-lg font-black opacity-30 leading-[2.5rem]">:</span>}
            <div className="text-center">
              <div className="text-xl font-black tabular-nums w-12 h-10 flex items-center justify-center rounded-xl" style={{ background: surface, color: accent }}>{String(u.v).padStart(2, "0")}</div>
              <p className="text-[10px] uppercase tracking-wide opacity-45 mt-1">{tx(u.l)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FAQ Section ──────────────────────────────────────────────────────────────
function FaqSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const tx = useT();
  const [open, setOpen] = useState<number | null>(null);
  const items: { question: string; reponse: string; image?: string }[] = config.items || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{tx(config.titre)}</h3>}
      <div className="space-y-2 max-w-3xl">
        {items.map((item, i) => (
          <div key={i} className="rounded-2xl overflow-hidden" style={{ background: surface }}>
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left">
              <span className="font-semibold text-[15px] pr-4">{tx(item.question)}</span>
              <ChevronDown size={16} className="flex-shrink-0 transition-transform duration-200" style={{ transform: open === i ? "rotate(180deg)" : "", color: accent }} />
            </button>
            {open === i && (
              <div className="px-5 pb-5 text-[15px] leading-relaxed">
                <p className="opacity-70">{tx(item.reponse)}</p>
                {item.image && <img src={item.image} alt="" loading="lazy" className="mt-4 w-full max-h-96 object-cover rounded-xl" />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Specs Section ────────────────────────────────────────────────────────────
function SpecsSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const tx = useT();
  const rows: { cle: string; valeur: string }[] = config.rows || [];
  if (!rows.length) return null;
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{tx(config.titre)}</h3>}
      <div className="max-w-3xl overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? surface : "transparent" }}>
                <td className="py-3 px-4 font-semibold" style={{ color: accent, width: "40%" }}>{tx(row.cle)}</td>
                <td className="py-3 px-4 opacity-70">{tx(row.valeur)}</td>
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
  const tx = useT();
  const url = config.videoUrl || "";
  if (!url) return null;
  const integree = urlVideoIntegree(url, !!config.autoplay);
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{tx(config.titre)}</h3>}
      <div className="relative w-full overflow-hidden" style={{ borderRadius: radius, paddingBottom: "56.25%", background: "#000" }}>
        {integree
          ? <iframe src={integree} title={config.titre || tx("Vidéo")} className="absolute inset-0 w-full h-full border-0" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
          : <video src={url} controls autoPlay={config.autoplay} muted={!!config.autoplay} playsInline className="absolute inset-0 w-full h-full object-cover" />}
      </div>
    </div>
  );
}

// ─── Social Section ───────────────────────────────────────────────────────────
function SocialSection({ accent, nom }: { accent: string; nom: string }) {
  const tx = useT();
  const [copied, setCopied] = useState(false);
  // Lue après le montage : le serveur ne connaît pas l'URL → même HTML des deux côtés (pas d'erreur d'hydratation).
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href), []);
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
      <span className="text-sm font-semibold flex items-center gap-2"><Share2 size={14} />{" "}{tx("Partager")}</span>
      {shares.map(s => (
        <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
          className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
          style={{ background: s.bg }}>{tx(s.label)}</a>
      ))}
      <button onClick={copyLink} className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: accent }}>{copied ? tx("Copié !") : tx("Copier le lien")}</button>
    </div>
  );
}

// ─── Banner Section ───────────────────────────────────────────────────────────
function BannerSection({ config, accent, radius, slug }: { config: Record<string, any>; accent: string; radius: string; slug: string }) {
  const tx = useT();
  return (
    <div className="py-8 border-t" style={{ borderColor: `${accent}10` }}>
      <div className="relative overflow-hidden" style={{ borderRadius: radius, minHeight: 200, background: config.imageUrl ? `url(${config.imageUrl}) center/cover` : accent }}>
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} />
        <div className="relative z-10 flex flex-col items-center justify-center text-center p-10 min-h-[200px]">
          {config.titre && <h3 className="text-2xl font-black text-white mb-2">{tx(config.titre)}</h3>}
          {config.texte && <p className="text-white/70 mb-6 text-sm max-w-lg">{tx(config.texte)}</p>}
          {config.ctaTexte && (
            <Link href={`/${slug}/produits`} className="inline-block px-8 py-3 rounded-xl font-bold text-sm"
              style={{ background: accent, color: "#fff" }}>{tx(config.ctaTexte)}</Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Richtext Section ─────────────────────────────────────────────────────────
function RichtextSection({ config, accent, slug }: { config: Record<string, any>; accent: string; radius: string; slug: string }) {
  const tx = useT();
  return (
    <div className="py-12 border-t max-w-3xl" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-4">{tx(config.titre)}</h3>}
      {config.texte && <p className="text-[17px] leading-relaxed opacity-75 mb-6">{tx(config.texte)}</p>}
      {config.ctaTexte && (
        <Link href={`/${slug}/produits`} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm"
          style={{ background: accent, color: "#fff" }}>{tx(config.ctaTexte)}</Link>
      )}
    </div>
  );
}

// ─── Features Section ─────────────────────────────────────────────────────────
function FeaturesSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string; radius: string }) {
  const tx = useT();
  const items: { icone: string; titre: string; texte: string }[] = config.items || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{tx(config.titre)}</h3>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, i) => (
          <div key={i} className="flex gap-4 p-5 rounded-2xl" style={{ background: surface }}>
            <div className="text-2xl flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: `${accent}15` }}>{tx(item.icone)}</div>
            <div>
              <p className="font-bold text-sm mb-1">{tx(item.titre)}</p>
              <p className="text-[15px] opacity-70 leading-relaxed">{tx(item.texte)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Howto Section ────────────────────────────────────────────────────────────
function HowtoSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const tx = useT();
  const steps: { num: string; titre: string; texte: string; image?: string }[] = config.steps || [];
  const [open, setOpen] = useState<number | null>(0);
  // Carte d'une étape (carrousel / colonnes) : image en tête, puis numéro, titre, texte.
  const carte = (step: (typeof steps)[number], i: number, classe = "") => (
    <div key={i} className={`rounded-2xl overflow-hidden flex flex-col ${classe}`} style={{ background: surface }}>
      {step.image && <img src={step.image} alt={step.titre} loading="lazy" className="w-full aspect-[4/3] object-cover" />}
      <div className="p-5">
        <span className="font-black text-sm" style={{ color: accent }}>{tx(step.num)}</span>
        <p className="font-bold text-base mt-1 mb-1">{tx(step.titre)}</p>
        {step.texte && <p className="text-[15px] opacity-70 leading-relaxed">{tx(step.texte)}</p>}
      </div>
    </div>
  );
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{tx(config.titre)}</h3>}
      {config.style === "carrousel" ? (
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 -mx-1 px-1">
          {steps.map((step, i) => carte(step, i, "snap-start flex-shrink-0 w-[78%] sm:w-72"))}
        </div>
      ) : config.style === "colonnes" ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, i) => carte(step, i))}
        </div>
      ) : config.style === "accordeon" ? (
        <div className="space-y-2 max-w-3xl">
          {steps.map((step, i) => (
            <div key={i} className="rounded-2xl overflow-hidden" style={{ background: surface }}>
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center gap-4 p-5 text-left">
                <span className="font-black text-sm" style={{ color: accent }}>{tx(step.num)}</span>
                <span className="flex-1 font-semibold text-[15px]">{tx(step.titre)}</span>
                <ChevronDown size={16} className="flex-shrink-0 transition-transform duration-200" style={{ transform: open === i ? "rotate(180deg)" : "", color: accent }} />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-[15px] leading-relaxed">
                  <p className="opacity-70">{tx(step.texte)}</p>
                  {step.image && <img src={step.image} alt={step.titre} loading="lazy" className="mt-4 w-full max-h-80 object-cover rounded-xl" />}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-5 items-start">
              <div className="w-12 h-12 rounded-2xl font-black text-sm flex items-center justify-center flex-shrink-0" style={{ background: `${accent}15`, color: accent }}>{tx(step.num)}</div>
              <div className="pt-1 flex-1 min-w-0">
                <p className="font-bold text-base mb-1">{tx(step.titre)}</p>
                <p className="text-[15px] opacity-70 leading-relaxed">{tx(step.texte)}</p>
                {step.image && <img src={step.image} alt={step.titre} loading="lazy" className="mt-3 w-full max-h-72 object-cover rounded-xl" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Avis clients (même rendu dans l'onglet Description et en section seule) ─
function ReviewsBlock({ cfg, avis, moyenne, accent, surface, radius, tenantId, produitId }: {
  cfg: Record<string, any>; avis: Avis[]; moyenne: number; accent: string; surface: string; radius: string; tenantId: string; produitId: string;
}) {
  const tx = useT();
  const etoiles = cfg.couleurEtoiles || accent;
  const liste = avis.slice(0, Number(cfg.max) || 20);
  return (
    <div className="space-y-8">
      {liste.length > 0 ? (
        <>
          {cfg.afficherResume !== false && <RatingBreakdown avis={avis} accent={etoiles} moyenne={moyenne} />}
          {cfg.afficherResume !== false && <div className="h-px" style={{ background: `${accent}12` }} />}
          <div className={cfg.disposition === "liste" ? "space-y-3" : "grid gap-4 sm:grid-cols-2"}>
            {liste.map(a => (
              <div key={a.id} className="p-5 rounded-2xl" style={{ background: surface, border: `1px solid ${accent}10` }}>
                <div className="flex items-center justify-between mb-2">
                  <Stars note={a.note} size={14} accent={etoiles} />
                  {cfg.afficherVerifie !== false && a.verifie && <span className="text-[11px] text-emerald-500 font-bold flex items-center gap-0.5"><Check size={10} />{" "}{tx("Achat vérifié")}</span>}
                </div>
                {a.titre && <p className="font-semibold text-[15px] mb-1">{tx(a.titre)}</p>}
                {a.commentaire && <p className="text-[15px] leading-relaxed" style={{ opacity: 0.7 }}>{tx(a.commentaire)}</p>}
                <p className="text-xs mt-3 font-semibold" style={{ opacity: 0.4 }}>— {tx(a.client?.nom) || tx("Client")}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-10">
          <Star size={32} className="mx-auto mb-3" style={{ opacity: 0.12, color: etoiles }} />
          <p className="font-medium text-[15px]" style={{ opacity: 0.4 }}>{tx("Soyez le premier à laisser un avis.")}</p>
        </div>
      )}
      {cfg.afficherFormulaire !== false && <AvisForm tenantId={tenantId} produitId={produitId} accent={accent} surface={surface} radius={radius} />}
    </div>
  );
}

// ─── Testimonials Section ─────────────────────────────────────────────────────
function TestimonialsSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const tx = useT();
  const items: { nom: string; note: number; texte: string; avatar?: string }[] = config.items || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{tx(config.titre)}</h3>}
      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
        {items.map((item, i) => (
          <div key={i} className="p-6 rounded-2xl" style={{ background: surface }}>
            <div className="flex mb-3">
              {[1,2,3,4,5].map(s => (
                <span key={s} style={{ color: s <= item.note ? accent : "currentColor", opacity: s <= item.note ? 1 : 0.15, fontSize: 13 }}>★</span>
              ))}
            </div>
            <p className="text-[15px] leading-relaxed opacity-75 mb-4 italic">"{tx(item.texte)}"</p>
            <div className="flex items-center gap-2">
              {item.avatar ? (
                <img src={item.avatar} alt={item.nom} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${accent}25`, color: accent }}>{tx(item.nom[0])}</div>
              )}
              <p className="text-sm font-semibold">{tx(item.nom)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ingredients Section ──────────────────────────────────────────────────────
function IngredientsSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const tx = useT();
  // Chaque élément : image et/ou texte (titre, détail) — l'un ou l'autre suffit.
  const items: { nom?: string; desc?: string; image?: string }[] = (config.items || []).filter((it: any) => it?.image || it?.nom || it?.desc);
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-4">{tx(config.titre)}</h3>}
      {config.texte && <p className="text-sm opacity-60 mb-8 max-w-2xl leading-relaxed">{tx(config.texte)}</p>}
      <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl overflow-hidden" style={{ background: surface }}>
            {item.image && <img src={item.image} alt={item.nom || ""} loading="lazy" className="w-full aspect-[4/3] object-cover" />}
            {(item.nom || item.desc) && (
              <div className="flex items-start gap-3 p-4">
                {!item.image && <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: accent }} />}
                <div>
                  {item.nom && <p className="text-sm font-semibold">{tx(item.nom)}</p>}
                  {item.desc && <p className="text-xs opacity-50 mt-0.5 leading-relaxed whitespace-pre-line">{tx(item.desc)}</p>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Size Guide Section ───────────────────────────────────────────────────────
function SizeGuideSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const tx = useT();
  const headers: string[] = config.headers || [];
  const rows: { cells: string[] }[] = config.rows || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{tx(config.titre)}</h3>}
      <div className="overflow-x-auto max-w-3xl">
        <table className="w-full text-sm min-w-[400px]">
          <thead>
            <tr style={{ background: accent }}>
              {headers.map((h, i) => (
                <th key={i} className="py-3 px-4 text-left font-bold text-white text-xs">{tx(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? surface : "transparent" }}>
                {row.cells.map((cell, j) => (
                  <td key={j} className="py-3 px-4" style={{ fontWeight: j === 0 ? 700 : 400, color: j === 0 ? accent : "inherit", opacity: j === 0 ? 1 : 0.7 }}>{tx(cell)}</td>
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
  const tx = useT();
  const items: { icone: string; titre: string; texte: string }[] = config.items || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{tx(config.titre)}</h3>}
      <div className="grid sm:grid-cols-3 gap-4 max-w-3xl">
        {items.map((item, i) => (
          <div key={i} className="text-center p-6 rounded-2xl" style={{ background: surface }}>
            <div className="text-3xl mb-3">{tx(item.icone)}</div>
            <p className="font-bold text-sm mb-2">{tx(item.titre)}</p>
            <p className="text-xs opacity-55 leading-relaxed">{tx(item.texte)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bundle Section ───────────────────────────────────────────────────────────
function BundleSection({ config, accent, surface, slug }: { config: Record<string, any>; accent: string; surface: string; radius: string; slug: string }) {
  const tx = useT();
  const items: { nom: string; imageUrl: string; prix: string }[] = config.items || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-6">{tx(config.titre)}</h3>}
      <div className="flex flex-wrap gap-4 items-center mb-6">
        {items.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-2xl opacity-30 font-bold">+</span>}
            <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: surface }}>
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.nom} className="w-12 h-12 rounded-xl object-cover" />
                : <div className="w-12 h-12 rounded-xl" style={{ background: `${accent}15` }} />}
              <div>
                <p className="text-sm font-semibold">{tx(item.nom)}</p>
                {item.prix && <p className="text-xs font-bold" style={{ color: accent }}>{item.prix}</p>}
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
      {config.ctaTexte && (
        <Link href={`/${slug}/produits`} className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-sm"
          style={{ background: accent, color: "#fff" }}>{tx(config.ctaTexte)}</Link>
      )}
    </div>
  );
}

// ─── Comparison Section ───────────────────────────────────────────────────────
function ComparisonSection({ config, accent, surface }: { config: Record<string, any>; accent: string; surface: string }) {
  const tx = useT();
  const headers: string[] = config.headers || [];
  const rows: { cells: string[] }[] = config.rows || [];
  const images: string[] = config.images || [];
  return (
    <div className="py-12 border-t" style={{ borderColor: `${accent}10` }}>
      {config.titre && <h3 className="text-2xl font-bold mb-8">{tx(config.titre)}</h3>}
      <div className="overflow-x-auto max-w-3xl">
        {images.some(Boolean) && (
          <div className="grid gap-2 mb-2 min-w-[360px]" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0,1fr))` }}>
            {headers.map((_, k) => images[k]
              ? <img key={k} src={images[k]} alt={headers[k]} loading="lazy" className="w-full aspect-square object-cover rounded-xl" />
              : <div key={k} />)}
          </div>
        )}
        <table className="w-full text-sm min-w-[360px]">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="py-3 px-4 text-left text-xs font-bold"
                  style={{ background: i === 1 ? accent : surface, color: i === 1 ? "#fff" : "inherit", opacity: i === 0 ? 0.5 : 1, borderRadius: i === 0 ? "12px 0 0 0" : i === headers.length - 1 ? "0 12px 0 0" : undefined }}>
                  {tx(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? `${surface}80` : "transparent" }}>
                {row.cells.map((cell, j) => (
                  <td key={j} className="py-3 px-4 text-sm"
                    style={{ fontWeight: j === 1 ? 700 : 400, color: j === 1 ? accent : "inherit", opacity: j === 0 ? 0.6 : 1 }}>{tx(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Achat direct d'un produit digital ───────────────────────────────────────
// Un clic → nom, téléphone et email du client (l'email sert à envoyer le lien
// de téléchargement) → page de paiement NotchPay
// (MTN MoMo, Orange Money, carte bancaire). Aucun montant n'est envoyé : le
// serveur le recalcule depuis la base (commande puis paiement).
function AchatDirectDigital({ produitId, tenantId, prix, devise, texte, fond, couleurTexte, radius, desactive }: {
  produitId: string; tenantId: string; prix: number; devise: string; texte: string; fond: string; couleurTexte: string; radius: string; desactive: boolean;
}) {
  const tx = useT();
  const { fmt, aPayer } = usePrix();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const valide = nom.trim().length > 1 && telephone.replace(/\D/g, "").length >= 8 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const payer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valide || envoi) return;
    setEnvoi(true);
    try {
      const cmd = await fetch("/api/commandes/digital-creer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, client: { nom: nom.trim(), telephone: telephone.trim(), email: email.trim().toLowerCase() }, items: [{ produitId, quantite: 1 }], codeAffiliation: (() => { try { return localStorage.getItem("axso_ref") || undefined; } catch { return undefined; } })() }),
      });
      const c = await cmd.json();
      if (!cmd.ok) throw new Error(c.error || "Commande impossible");
      const pay = await fetch("/api/paiements/notchpay/initier", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandeId: c.commandeId }),
      });
      const p = await pay.json();
      if (!pay.ok || !p.authorizationUrl) throw new Error(pay.status === 503 ? "Le paiement en ligne n'est pas encore activé sur cette boutique." : p.error || "Paiement indisponible");
      window.location.assign(p.authorizationUrl);
    } catch (err) {
      toast.error(err instanceof Error ? tx(err.message) : tx("Paiement indisponible"));
      setEnvoi(false);
    }
  };

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} disabled={desactive}
        className="w-full py-4 font-bold text-[15px] flex items-center justify-center gap-2.5 transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-35"
        style={{ background: fond, color: couleurTexte, borderRadius: radius }}>
        <Download size={18} /> {desactive ? tx("Indisponible") : `${texte} — ${fmt(prix, devise)}`}
      </button>
    );
  }
  return (
    <form onSubmit={payer} className="space-y-2.5 p-4 rounded-2xl border" style={{ borderColor: `${fond}40`, background: `${fond}08` }}>
      {([
        { label: "Nom complet", type: "text", valeur: nom, maj: setNom, ph: "Ex : Aminata Diallo", auto: "name" },
        { label: "Téléphone", type: "tel", valeur: telephone, maj: setTelephone, ph: "+237 6 00 00 00 00", auto: "tel" },
        { label: "Email — le lien de téléchargement y sera envoyé", type: "email", valeur: email, maj: setEmail, ph: "email@exemple.com", auto: "email" },
      ] as const).map((c, i) => (
        <label key={c.type} className="block">
          <span className="block text-[13px] font-semibold mb-1.5">{tx(c.label)}</span>
          <input type={c.type} required autoFocus={i === 0} value={c.valeur} onChange={(e) => c.maj(e.target.value)} placeholder={c.ph} autoComplete={c.auto}
            className="w-full h-12 px-4 rounded-xl border bg-white text-[15px] text-[#111111] outline-none focus:ring-2" style={{ borderColor: `${fond}50` }} />
        </label>
      ))}
      <button type="submit" disabled={!valide || envoi}
        className="w-full py-3.5 font-bold text-[15px] flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-40"
        style={{ background: fond, color: couleurTexte, borderRadius: radius }}>
        {envoi ? <><Loader2 size={17} className="animate-spin" />{" "}{tx("Redirection vers le paiement…")}</> : <><Lock size={16} />{" "}{tx("Payer")}{" "}{aPayer(prix, devise)}</>}
      </button>
      <p className="text-[12px] text-center opacity-60">{tx("Paiement sécurisé NotchPay · MTN MoMo, Orange Money, carte bancaire")}</p>
    </form>
  );
}

// ─── FAQ produit (questions spécifiques au produit, définies par le marchand) ──
function ProduitFaqSection({ faq, accent, surface }: { faq: { question: string; reponse: string; image?: string }[]; accent: string; surface: string }) {
  const tx = useT();
  const [open, setOpen] = React.useState<number | null>(null);
  return (
    <section className="max-w-3xl mx-auto px-4 py-10">
      <h2 className="text-xl font-bold mb-6" style={{ color: accent }}>{tx("Questions fréquentes")}</h2>
      <div className="space-y-3">
        {faq.map((item, idx) => (
          <div key={idx} className="rounded-2xl overflow-hidden border" style={{ borderColor: `${accent}18`, background: surface }}>
            <button
              onClick={() => setOpen(open === idx ? null : idx)}
              className="w-full flex items-center justify-between gap-4 p-5 text-left"
            >
              <span className="font-semibold text-sm leading-snug">{tx(item.question)}</span>
              <ChevronDown size={16} style={{ color: accent, flexShrink: 0, transform: open === idx ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>
            {open === idx && (
              <div className="px-5 pb-5 text-sm leading-relaxed border-t" style={{ borderColor: `${accent}10` }}>
                <p className="opacity-80 pt-4">{tx(item.reponse)}</p>
                {item.image && <img src={item.image} alt="" loading="lazy" className="mt-4 w-full max-h-96 object-cover rounded-xl" />}
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

function FormationCurriculumSection({ chapitres, accent, surface }: {
  chapitres: NonNullable<ProductPageClientProps["produit"]["formationCurriculum"]>["chapitres"];
  accent: string; texte: string; surface: string;
}) {
  const tx = useT();
  const toutesLecons = chapitres.flatMap(c => c.lecons);
  const totalDuree = toutesLecons.reduce((s, l) => s + (l.duree ?? 0), 0);
  const [apercuId, setApercuId] = useState<string | null>(null);
  const apercu = toutesLecons.find(l => l.id === apercuId) ?? null;
  const embed = apercu ? embedVideoLecon(apercu) : null;

  return (
    <section className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-xl font-bold" style={{ color: accent }}>{tx("Programme de la formation")}</h2>
        <p className="text-xs opacity-50">
          {chapitres.length} chapitre{chapitres.length > 1 ? "s" : ""} · {toutesLecons.length}{" "}{tx("leçon")}{toutesLecons.length > 1 ? "s" : ""}
          {totalDuree > 0 && tx(" · {0} min", Math.round(totalDuree / 60))}
        </p>
      </div>

      {apercu && (
        <div className="mb-6 rounded-2xl overflow-hidden" style={{ border: `1px solid ${accent}25` }}>
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: `${accent}10` }}>
            <span className="text-xs font-bold" style={{ color: accent }}>{tx("Aperçu gratuit —")}{" "}{tx(apercu.titre)}</span>
            <button onClick={() => setApercuId(null)} className="text-xs opacity-50 hover:opacity-80">{tx("Fermer ✕")}</button>
          </div>
          {apercu.type === "video" && embed && (
            <div className="relative w-full" style={{ paddingBottom: "56.25%", background: "#000" }}>
              {apercu.videoType === "upload"
                ? <video src={embed} controls className="absolute inset-0 w-full h-full object-cover" />
                : <iframe src={embed} className="absolute inset-0 w-full h-full border-0" allowFullScreen />}
            </div>
          )}
          {apercu.type === "audio" && apercu.audioUrl && <audio src={apercu.audioUrl} controls className="w-full p-4" />}
          {apercu.contenu && <div className="p-4 text-sm leading-relaxed" style={{ opacity: 0.8, whiteSpace: "pre-line" }}>{tx(apercu.contenu)}</div>}
        </div>
      )}

      <div className="space-y-4">
        {chapitres.map((ch, ci) => (
          <div key={ch.id} className="rounded-2xl overflow-hidden" style={{ background: surface }}>
            <p className="text-xs font-bold uppercase tracking-widest px-4 pt-4 pb-2 opacity-50">{tx("Chapitre")}{" "}{tx(ci) + 1} · {tx(ch.titre)}</p>
            <div className="pb-2">
              {ch.lecons.map(l => {
                const Icon = l.type === "video" ? PlayCircle : l.type === "audio" ? Headphones : FileText;
                return (
                  <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon size={14} style={{ opacity: 0.35, flexShrink: 0 }} />
                      <span className="text-sm truncate" style={{ opacity: l.gratuite ? 1 : 0.6 }}>{tx(l.titre)}</span>
                      {l.duree ? <span className="text-[10px] opacity-35 flex-shrink-0">{Math.round(l.duree / 60)} min</span> : null}
                    </div>
                    {l.gratuite ? (
                      <button onClick={() => setApercuId(l.id)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                        style={{ background: `${accent}15`, color: accent }}>
                        {tx("Aperçu gratuit")}
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
  const tx = useT();
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
      toast.error(tx(e.message) || tx("Impossible de générer le lien"));
    } finally {
      setLoading(false);
    }
  }

  const url = lien && typeof window !== "undefined" ? `${window.location.origin}/api/track/${lien.code}` : "";

  return (
    <div className="rounded-xl p-4" style={{ background: surface }}>
      <p className="text-xs font-bold flex items-center gap-1.5 mb-1" style={{ color: accent }}>
        <Share2 size={12} />{" "}{tx("Vous êtes marchand AXSO ?")}
      </p>
      {!lien ? (
        <>
          <p className="text-xs opacity-55 mb-2.5">{tx("Devenez affilié de ce produit et touchez une commission sur chaque vente que vous générez.")}</p>
          <button onClick={generer} disabled={loading}
            className="text-xs font-bold px-4 py-2 rounded-xl transition-all disabled:opacity-50"
            style={{ background: accent, color: "#fff" }}>
            {loading ? "…" : tx("Obtenir mon lien d'affiliation")}
          </button>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] font-mono truncate" style={{ background: "rgba(0,0,0,0.05)" }}>{url}</div>
          <button
            onClick={() => { navigator.clipboard.writeText(url); setCopie(true); toast.success(tx("Copié !")); setTimeout(() => setCopie(false), 2000); }}
            className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: accent, color: "#fff" }}>
            {copie ? tx("Copié") : tx("Copier")}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ProductPageClient({ produit, tenant, produitsSimilaires, sansPied }: ProductPageClientProps & { sansPied?: boolean }) {
  const tx = useT();
  const { fmt } = usePrix();
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

  // Mise en page globale de la fiche produit — 4 arrangements possibles
  const layoutMode: "amazon" | "classic" | "minimal" | "fullwidth" = (pp?.layout as any) || "amazon";

  // Derived config
  const galCfg     = cfgDe(getSec("gallery"));
  const infoCfg    = cfgDe(getSec("info"));
  const descCfg    = cfgDe(getSec("description"));
  const simCfg     = cfgDe(getSec("similar"));
  const avisCfg    = cfgDe(getSec("reviews"));

  const zoomEnabled    = galCfg.zoom !== false;
  const stickyGallery  = galCfg.sticky !== false;
  const galleryStyle: "vertical-thumbs" | "horizontal-thumbs" | "dots" = galCfg.style || "vertical-thumbs";
  const showBreadcrumbs = isOn("info") && infoCfg.breadcrumbs !== false;
  const showBadges      = isOn("info") && infoCfg.badges !== false;
  // Produits digitaux : pas de stock, de quantité ni de livraison physique.
  const estDigital      = TYPES_DIGITAUX.has(produit.type);
  // Stock suivi seulement pour le physique (dropshipping : stock chez le fournisseur ; packs : pas de stock).
  const stockSuivi      = produit.type === "physique";
  const showStock       = isOn("info") && infoCfg.stock !== false && stockSuivi;
  const showAiDesc      = descCfg.ai !== false;
  const similarTitre    = simCfg.titre || "Vous aimerez aussi";

  const rightSections = sections.filter(s => RIGHT_COL.has(s.type) && s.actif);
  const countdownSec  = sections.find(s => s.type === "countdown" && s.actif);
  const belowSections = sections.filter(s => BELOW_TYPES.has(s.type) && s.actif);

  // State
  const [selectedVariante, setSelectedVariante] = useState<Variante | null>(null);
  const [quantite, setQuantite] = useState(1);
  const [tab, setTab] = useState<"description" | "livraison" | "avis">("description");
  const [variantePrix, setVariantePrix] = useState<{ id: string; nom: string; prix: number; prixPromo: number | null } | null>(null);

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
  const enRupture     = stockSuivi && stockEffectif <= 0;

  // Pas de panier : on commande ce produit directement — formulaire de commande
  // puis WhatsApp du marchand (physique) ou paiement en ligne (dropshipping).
  function commander() {
    if (enRupture) return;
    const q = new URLSearchParams({ produit: produit.id, quantite: String(quantite) });
    if (selectedVariante) q.set("variante", `${selectedVariante.nom}: ${selectedVariante.valeur}`);
    router.push(`/${slug}/checkout?${q}`);
  }

  const waNum = (whatsappNumero || whatsapp || "").replace(/\D/g, "");
  const waMsg = encodeURIComponent(`Bonjour, je suis intéressé par : ${produit.nom}`);

  // ─── Rendus réutilisés entre les 4 mises en page ("amazon" / "classic" /
  // "minimal" / "fullwidth") — évite de dupliquer la galerie, l'en-tête produit
  // et les sections de la colonne droite dans chaque branche de layout.
  const renderGallery = (opts?: { forceStyle?: "vertical-thumbs" | "horizontal-thumbs" | "dots"; forceZoom?: boolean; forceSticky?: boolean }) => (
    isOn("gallery") && (
      <ImageGallery images={produit.images} nom={produit.nom} accent={accent} radius={radius}
        zoomEnabled={opts?.forceZoom ?? zoomEnabled} sticky={opts?.forceSticky ?? stickyGallery}
        style={opts?.forceStyle ?? galleryStyle} autoplay={galCfg.diaporamaAuto === true} />
    )
  );

  const renderCountdown = () => countdownSec && (
    <StyledSection style={countdownSec.style}>
      <CountdownSection config={cfgDe(countdownSec)} accent={accent} surface={surface} />
    </StyledSection>
  );

  const renderInfoHeader = () => (
    <>
      {isOn("info") && (
        <>
          {produit.collections.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {produit.collections.map(col => (
                <Link key={col.slug} href={`/${slug}/collections/${col.slug}`}>
                  <span className="text-xs px-3 py-1 rounded-full border transition-all hover:opacity-100"
                    style={{ borderColor: `${accent}40`, color: accent, opacity: 0.8 }}>{tx(col.nom)}</span>
                </Link>
              ))}
            </div>
          )}
          {produit.marque && (
            <p className="text-xs font-semibold" style={{ color: accent }}>
              {tx("Marque :")}{" "}<span style={{ opacity: 0.6, fontWeight: 400 }}>{tx(produit.marque)}</span>
            </p>
          )}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{tx(produit.nom)}</h1>
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
                -{tx(produit.remise)}{tx("% · Offre limitée")}
              </span>
            </div>
          )}
          {variantePrix && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}>
              <span>{tx("✦ Offre sélectionnée :")}</span>
              <span className="font-bold">{tx(variantePrix.nom)}</span>
            </div>
          )}
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-4xl font-black" style={{ color: accent }}>{fmt(prixEffectif, devise)}</span>
            {(variantePrix?.prixPromo || (produit.prixCompareAffiche && produit.prixCompareAffiche > produit.prixAffiche)) && (
              <span className="text-lg opacity-35 line-through">
                {fmt(variantePrix?.prixPromo ?? produit.prixCompareAffiche!, devise)}
              </span>
            )}
          </div>
          {renderCountdown()}
          {showStock && (
            <div className="flex items-center gap-2 text-sm">
              {enRupture ? (
                <><div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" /><span className="text-red-500 font-semibold">{tx("Rupture de stock")}</span></>
              ) : stockEffectif <= 10 ? (
                <><div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" /><span className="font-medium flex items-center gap-1"><AlertTriangle size={13} className="text-amber-400" />{tx("Plus que")}{" "}<strong>{tx(stockEffectif)}</strong>{" "}{tx("en stock")}</span></>
              ) : (
                <><div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" /><span className="text-emerald-600 font-semibold">{tx("En stock · Expédition sous 24-48h")}</span></>
              )}
            </div>
          )}
          {produit.description && (
            <p className="text-[15px] leading-relaxed" style={{ opacity: 0.7, paddingLeft: "12px", borderLeft: `3px solid ${accent}30` }}>
              {produit.description.length > 220 ? produit.description.slice(0, 220) + "…" : tx(produit.description)}
            </p>
          )}
          <div className="h-px" style={{ background: `${accent}12` }} />
        </>
      )}
    </>
  );

  const renderRightSections = () => (
    <>
      {!isOn("info") && renderCountdown()}
      {rightSections.map(sec => {
        const cfg = cfgDe(sec);
        const btnFond = cfg.couleurBouton || accent;
        const btnTexte = cfg.couleurTexteBouton || "#fff";
        return (
        <StyledSection key={sec.id} style={sec.style}>
          {sec.type === "variants" && produit.variantes.length > 0 && (
            <VariantSelector variantes={produit.variantes} accent={accent} radius={radius} cfg={cfg}
              selected={selectedVariante} onSelect={setSelectedVariante} />
          )}
          {sec.type === "quantity" && (
            <div className="space-y-4">
              {cfg.afficherQuantite !== false && !estDigital && (
                <div className="flex items-center gap-4">
                  <span className="text-[15px] font-medium opacity-60">{tx("Quantité")}</span>
                  <div className="flex items-center border rounded-xl overflow-hidden" style={{ borderColor: `${accent}25` }}>
                    <button onClick={() => setQuantite(q => Math.max(1, q - 1))} className="w-11 h-11 flex items-center justify-center hover:opacity-80" style={{ color: accent }}><Minus size={15} /></button>
                    <span className="w-10 text-center text-base font-bold tabular-nums">{quantite}</span>
                    <button onClick={() => setQuantite(q => Math.min(stockSuivi ? Math.max(1, stockEffectif) : 99, q + 1))} disabled={enRupture} className="w-11 h-11 flex items-center justify-center hover:opacity-80" style={{ color: accent }}><Plus size={15} /></button>
                  </div>
                </div>
              )}
              {/* Produit digital : achat direct — l'email du client puis la page de paiement NotchPay. */}
              {estDigital ? (
                <AchatDirectDigital produitId={produit.id} tenantId={tenant.id} prix={produit.prixAffiche} devise={tenant.devise}
                  texte={cfg.texteBouton || produit.texteBoutonAchat || tx("Acheter")} fond={btnFond} couleurTexte={btnTexte} radius={btnRadiusPx} desactive={enRupture} />
              ) : (
              <div className="space-y-2.5">
                <button onClick={commander} disabled={enRupture}
                  className={`w-full font-bold disabled:opacity-35 flex items-center justify-center gap-3 ${btnHoverClass}`}
                  style={{
                    ...btnAchatSizing,
                    background: enRupture ? "#E0E0E0" : (btnRempli ? btnFond : "transparent"),
                    color: enRupture ? "#999" : (btnRempli ? btnTexte : btnFond),
                    border: !btnRempli ? `2px solid ${btnFond}` : "none",
                    textDecoration: btnStyle === "ghost" ? "underline" : "none",
                    boxShadow: enRupture || !btnRempli ? "none" : `0 6px 24px ${btnFond}40`,
                    ["--ax-accent-glow" as any]: `${btnFond}80`,
                  }}>
                  <ShoppingBag size={18} />
                  {enRupture ? tx("Indisponible") : (tx(cfg.texteBouton) || tx(produit.texteBoutonAchat) || tx("Commander"))}
                </button>
                {cfg.afficherWhatsApp !== false && waNum && (
                  <a href={`https://wa.me/${waNum}?text=${waMsg}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-[15px] border-2 transition-all hover:opacity-80"
                    style={{ borderColor: "rgba(37,211,102,0.35)", color: "#25D366", background: "rgba(37,211,102,0.05)" }}>
                    <MessageCircle size={16} />{" "}{tx("Contacter via WhatsApp")}
                  </a>
                )}
              </div>
              )}
            </div>
          )}
          {sec.type === "trust" && (
            <div className="space-y-3">
              {showBadges && (cfg.items ?? []).length > 0 && (
                <div className={cfg.disposition === "liste" ? "space-y-2" : "grid gap-2 grid-cols-[repeat(var(--cols-m),minmax(0,1fr))] sm:grid-cols-[repeat(var(--cols),minmax(0,1fr))]"}
                  style={cfg.disposition === "liste" ? undefined : { "--cols": Number(cfg.colonnes) || 3, "--cols-m": Math.min(Number(cfg.colonnes) || 3, 2) } as React.CSSProperties}>
                  {(cfg.items as { icone: string; texte: string }[]).map((b, i) => (
                    <div key={i} className={cfg.disposition === "liste" ? "flex items-center gap-3 px-4 py-3 rounded-xl" : "flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-xl text-center"} style={{ background: surface }}>
                      {b.icone && (estImage(b.icone)
                        ? <img src={b.icone} alt="" className="w-6 h-6 object-contain" />
                        : <span className="text-lg leading-none" style={{ color: accent }}>{tx(b.icone)}</span>)}
                      <p className="text-xs font-semibold leading-tight" style={{ opacity: 0.7 }}>{tx(b.texte)}</p>
                    </div>
                  ))}
                </div>
              )}
              {cfg.afficherVendeur !== false && (
                <div className="rounded-xl p-4" style={{ background: surface }}>
                  <p className="text-xs opacity-50 mb-0.5">{tx("Vendu par")}</p>
                  <p className="text-[15px] font-semibold">
                    {tx(nomBoutique)}
                    {certifie && <span className="ml-1.5 text-[10px] text-emerald-500 font-bold">{tx("✓ Certifié Axso")}</span>}
                  </p>
                </div>
              )}
              {tenant.peutDevenirAffilie && (
                <AffiliateLinkButton tenantId={tenant.id} produitId={produit.id} accent={accent} surface={surface} />
              )}
            </div>
          )}
        </StyledSection>
        );
      })}
    </>
  );

  return (
    <div style={{ backgroundColor: fond, color: texte, minHeight: "100vh" }}>

      {/* Pleine largeur : image en fond plein écran, infos en overlay */}
      {layoutMode === "fullwidth" && isOn("gallery") && produit.images[0] && (
        <BanniereDiaporama images={produit.images} nom={produit.nom} autoplay={galCfg.diaporamaAuto === true} />
      )}

      {/* Breadcrumb */}
      {showBreadcrumbs && layoutMode !== "fullwidth" && (
        <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8 py-3`}>
          <div className="flex items-center gap-1 text-xs flex-wrap" style={{ opacity: 0.45 }}>
            <Link href={`/${slug}`} className="hover:opacity-100 transition-opacity">{tx("Accueil")}</Link>
            <ChevronRight size={10} />
            <Link href={`/${slug}/produits`} className="hover:opacity-100 transition-opacity">{tx("Produits")}</Link>
            {produit.categorie && <><ChevronRight size={10} /><span>{tx(produit.categorie)}</span></>}
            <ChevronRight size={10} />
            <span className="truncate max-w-[200px]" style={{ color: texte }}>{tx(produit.nom)}</span>
          </div>
        </div>
      )}

      <main className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8 pb-20`}>

        {/* Amazon : galerie gauche + colonne infos droite, sticky */}
        {layoutMode === "amazon" && (
          <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)] gap-10 lg:gap-16 items-start">
            {renderGallery()}
            <div className="space-y-5 py-1">
              {renderInfoHeader()}
              {renderRightSections()}
            </div>
          </div>
        )}

        {/* Classique : image pleine largeur en haut, infos empilées en dessous */}
        {layoutMode === "classic" && (
          <div className="space-y-8">
            <div className="max-w-2xl mx-auto">{renderGallery({ forceSticky: false })}</div>
            <div className="max-w-2xl mx-auto space-y-5">
              {renderInfoHeader()}
              {renderRightSections()}
            </div>
          </div>
        )}

        {/* Minimal : pas de sidebar galerie, présentation épurée et centrée */}
        {layoutMode === "minimal" && (
          <div className="max-w-xl mx-auto space-y-6">
            {isOn("gallery") && (
              <div className="max-w-sm mx-auto">{renderGallery({ forceStyle: "dots", forceZoom: false, forceSticky: false })}</div>
            )}
            <div className="space-y-5">
              {renderInfoHeader()}
              {renderRightSections()}
            </div>
          </div>
        )}

        {/* Pleine largeur : carte d'infos qui chevauche le bas de l'image en overlay */}
        {layoutMode === "fullwidth" && (
          <div className={`max-w-2xl mx-auto space-y-5 rounded-3xl p-6 sm:p-8 ${isOn("gallery") && produit.images[0] ? "-mt-24 relative z-10 shadow-xl" : "mt-8"}`} style={{ background: surface }}>
            {renderInfoHeader()}
            {renderRightSections()}
          </div>
        )}

        {/* Vidéos produit (ajoutées dans Dashboard → Produit → Images & Vidéos) */}
        {(produit.videos ?? []).length > 0 && (
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {produit.videos!.map(v => (
              <video key={v} src={v} controls playsInline preload="metadata" className="w-full aspect-video bg-black" style={{ borderRadius: radius }} />
            ))}
          </div>
        )}

        {/* Below sections in order */}
        {belowSections.map(sec => (
          <StyledSection key={sec.id} style={sec.style}>

            {sec.type === "description" && (
              <>
                <div className="mt-16 border-b" style={{ borderColor: `${accent}15` }}>
                  <div className="flex gap-1 overflow-x-auto">
                    {[
                      { key: "description", label: "Description" },
                      ...(descCfg.afficherLivraison !== false && !estDigital ? [{ key: "livraison", label: "Livraison & retours" }] : []),
                      ...(isOn("reviews") ? [{ key: "avis", label: `Avis (${produit.avis.length})` }] : []),
                    ].map(t => (
                      <button key={t.key} onClick={() => setTab(t.key as any)}
                        className="px-5 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap flex-shrink-0"
                        style={{ borderColor: tab === t.key ? accent : "transparent", color: tab === t.key ? accent : texte, opacity: tab === t.key ? 1 : 0.4 }}>
                        {tx(t.label)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="py-10 max-w-3xl">
                  {tab === "description" && (
                    <div className="space-y-5">
                      {produit.description && <p className="text-[17px] leading-relaxed" style={{ opacity: 0.8 }}>{tx(produit.description)}</p>}
                      {showAiDesc && produit.descriptionIA && (
                        <div className="p-5 rounded-2xl" style={{ background: surface }}>
                          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: accent }}>{tx("Description enrichie par IA")}</p>
                          <p className="text-sm leading-relaxed" style={{ opacity: 0.7 }}>{tx(produit.descriptionIA)}</p>
                        </div>
                      )}
                      {!produit.description && !produit.descriptionIA && <p className="text-sm" style={{ opacity: 0.35 }}>{tx("Aucune description disponible.")}</p>}
                    </div>
                  )}
                  {tab === "livraison" && (
                    <div className="space-y-3">
                      {(descCfg.livraison as { titre: string; texte: string }[] ?? []).map((item, i) => (
                        <div key={i} className="flex gap-4 p-5 rounded-2xl" style={{ background: surface }}>
                          <div className="flex-shrink-0 mt-0.5">{tx([<Truck key="t" size={18} style={{ color: accent }} />, <RotateCcw key="r" size={18} style={{ color: accent }} />, <Lock key="l" size={18} style={{ color: accent }} />][i % 3])}</div>
                          <div><p className="font-semibold text-[15px] mb-1">{tx(item.titre)}</p><p className="text-[15px]" style={{ opacity: 0.7 }}>{tx(item.texte)}</p></div>
                        </div>
                      ))}
                    </div>
                  )}
                  {tab === "avis" && isOn("reviews") && (
                    <ReviewsBlock cfg={avisCfg} avis={produit.avis} moyenne={produit.noteMoyenne} accent={accent} surface={surface} radius={radius} tenantId={tenant.id} produitId={produit.id} />
                  )}
                </div>
              </>
            )}

            {sec.type === "reviews" && !isOn("description") && (
              <div className="mt-12 border-t pt-12" style={{ borderColor: `${accent}10` }}>
                {avisCfg.titre && <h2 className="text-2xl font-bold mb-8">{tx(avisCfg.titre)}</h2>}
                <div className="max-w-3xl">
                  <ReviewsBlock cfg={avisCfg} avis={produit.avis} moyenne={produit.noteMoyenne} accent={accent} surface={surface} radius={radius} tenantId={tenant.id} produitId={produit.id} />
                </div>
              </div>
            )}

            {sec.type === "similar" && produitsSimilaires.length > 0 && (
              <div className="mt-8 border-t pt-12" style={{ borderColor: `${accent}10` }}>
                <h2 className="text-2xl font-bold mb-6">{tx(similarTitre)}</h2>
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
                          <p className="text-sm font-medium line-clamp-2 leading-snug mb-1">{tx(p.nom)}</p>
                          <p className="text-sm font-bold" style={{ color: accent }}>{fmt(p.prixAffiche, devise)}</p>
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

      {!sansPied && (
        <footer className="border-t py-8 text-center text-xs" style={{ borderColor: `${accent}10`, opacity: 0.35 }}>
          <p>{tx(nomBoutique)}{" "}{tx("· Propulsé par")}{" "}<span style={{ color: accent, opacity: 1 }}>{tx("Axso")}</span></p>
        </footer>
      )}
    </div>
  );
}
