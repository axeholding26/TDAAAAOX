"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { PCOnlyGate } from "@/components/dashboard/PCOnlyGate";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import {
  Save, Monitor, Tablet, Smartphone, ExternalLink, ArrowLeft,
  LayoutGrid, Palette, Type, LayoutTemplate, MousePointer2, Code2,
  ChevronDown, ChevronRight, ToggleLeft, ToggleRight, RefreshCw,
  Plus, Trash2, Check, Layers, Sparkles, Film, ChevronUp,
  Image as ImageIcon, X, GripVertical, Zap, Copy,
  BarChart3, Timer, Building2, Video, Star, Target, FileText,
  ArrowUpDown, Megaphone, Shield, FolderOpen, BookOpen, HelpCircle,
  MessageCircle, Mail, Wrench, Award, LucideIcon,
  ShoppingBag, Maximize2, Minimize2, ZoomIn, Package,
  ShoppingCart, Share2, Info, Phone, Undo2, Redo2,
} from "lucide-react";
import { resolveThemeConfig, mergeThemeConfig, type ThemeConfig, type CustomSection, DEFAULT_PRODUCT_SECTIONS, type ProductPageSection, THEMES_LIBRE_ELIGIBLES } from "@/lib/theme-config";
import { FONTS, googleFontsHref, typographyCss } from "@/lib/theme-fonts";
import { BuilderCanvas } from "./canvas/BuilderCanvas";
import { Wand2 } from "lucide-react";

type Device = "desktop" | "tablet" | "mobile";
type Panel = "sections" | "couleurs" | "typo" | "layout" | "medias" | "animations" | "boutons" | "avance" | "produit" | "apropos" | "contact";
type SectionId = "annonce" | "hero" | "confiance" | "vedettes" | "collections" | "about" | "promo" | "faq" | "avis" | "newsletter";

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

const DEFAULT_SECTION_ORDER: SectionId[] = ["annonce","hero","confiance","vedettes","collections","about","promo","faq","avis","newsletter"];

const SECTION_META: Record<SectionId, { label: string; Icon: any; desc: string }> = {
  annonce:     { label: "Barre d'annonce",   Icon: Megaphone,    desc: "Message promotionnel en haut" },
  hero:        { label: "Hero / Bannière",   Icon: ImageIcon,    desc: "Section principale" },
  confiance:   { label: "Badges confiance",  Icon: Shield,       desc: "Garanties & avantages" },
  vedettes:    { label: "Produits vedettes", Icon: Star,         desc: "Best-sellers" },
  collections: { label: "Collections",       Icon: FolderOpen,   desc: "Vos collections" },
  about:       { label: "Notre histoire",    Icon: BookOpen,     desc: "À propos de vous" },
  promo:       { label: "Bannière promo",    Icon: Target,       desc: "Offre promotionnelle" },
  faq:         { label: "FAQ",               Icon: HelpCircle,   desc: "Questions fréquentes" },
  avis:        { label: "Avis clients",      Icon: MessageCircle,desc: "Témoignages" },
  newsletter:  { label: "Newsletter",        Icon: Mail,         desc: "Inscription email" },
};

const BUILDER_TUTORIAL_STEPS = [
  { Icon: MousePointer2, titre: "Clique directement sur l'aperçu", description: "Survole ou clique une section dans l'aperçu à droite : elle s'ouvre automatiquement dans le panneau pour être modifiée — plus besoin de la chercher dans une liste." },
  { Icon: LayoutGrid, titre: "Personnalise tes sections",       description: "Réordonne par glisser-déposer, active/désactive ou duplique tes sections (héro, produits vedettes, avis, FAQ...) et ajoute des blocs personnalisés — vidéo, compte à rebours, galerie..." },
  { Icon: Palette,    titre: "Couleurs, typo et mise en page",  description: "Ajuste ta palette, tes polices Google Fonts et ta mise en page en un clic — l'aperçu se met à jour en direct." },
  { Icon: Undo2,      titre: "Annule sans crainte",              description: "Ctrl+Z pour annuler, Ctrl+Y pour rétablir — expérimente librement, chaque changement peut être défait à tout moment." },
  { Icon: Monitor,    titre: "Prévisualise sur tous les écrans", description: "Bascule entre les vues Desktop, Tablette et Mobile pour vérifier le rendu avant de publier." },
  { Icon: Save,       titre: "Sauvegarde tes changements",      description: "Rien n'est publié tant que tu n'as pas cliqué \"Sauvegarder\" — teste librement, tes visiteurs ne voient que la version en ligne." },
];

const NAV_TABS: Array<{ id: Panel; icon: React.ReactNode; tooltip: string }> = [
  { id: "sections",   icon: <LayoutGrid size={17} />,    tooltip: "Sections" },
  { id: "couleurs",   icon: <Palette size={17} />,       tooltip: "Couleurs" },
  { id: "typo",       icon: <Type size={17} />,          tooltip: "Typographie" },
  { id: "layout",     icon: <LayoutTemplate size={17} />,tooltip: "Mise en page" },
  { id: "medias",     icon: <ImageIcon size={17} />,     tooltip: "Médias" },
  { id: "animations", icon: <Sparkles size={17} />,      tooltip: "Animations" },
  { id: "boutons",    icon: <MousePointer2 size={17} />, tooltip: "Boutons & Nav" },
  { id: "produit",    icon: <ShoppingBag size={17} />,   tooltip: "Fiche produit" },
  { id: "apropos",    icon: <Info size={17} />,          tooltip: "À propos" },
  { id: "contact",    icon: <Phone size={17} />,         tooltip: "Contact" },
  { id: "avance",     icon: <Code2 size={17} />,         tooltip: "Avancé" },
];

// ─── Génération CSS animations ────────────────────────────────────────────────
function generateAnimationCss(anim: ThemeConfig["animations"]): string {
  if (!anim || anim.global === "none") return "";
  const dur = anim.vitesse === "fast" ? "0.4s" : anim.vitesse === "slow" ? "0.9s" : "0.6s";
  const easing = "cubic-bezier(0.16, 1, 0.3, 1)";

  const keyframes: Record<string, string> = {
    "fade-in":    `@keyframes bp-fade{from{opacity:0}to{opacity:1}}`,
    "slide-up":   `@keyframes bp-slide-up{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}`,
    "slide-left": `@keyframes bp-slide-left{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:translateX(0)}}`,
    "zoom-in":    `@keyframes bp-zoom{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}`,
    "flip":       `@keyframes bp-flip{from{opacity:0;transform:perspective(600px) rotateX(20deg)}to{opacity:1;transform:perspective(600px) rotateX(0)}}`,
    "blur-in":    `@keyframes bp-blur{from{opacity:0;filter:blur(12px)}to{opacity:1;filter:blur(0)}}`,
  };
  const animName: Record<string, string> = {
    "fade-in": "bp-fade", "slide-up": "bp-slide-up", "slide-left": "bp-slide-left",
    "zoom-in": "bp-zoom", "flip": "bp-flip", "blur-in": "bp-blur",
  };

  const kf = keyframes[anim.global] || "";
  const name = animName[anim.global] || "bp-fade";
  const staggerCss = anim.stagger ? `section:nth-child(1){animation-delay:0s}section:nth-child(2){animation-delay:.1s}section:nth-child(3){animation-delay:.15s}section:nth-child(4){animation-delay:.2s}` : "";
  const paralaxCss = anim.parallax ? `.hero-bg{transform:translateZ(0);will-change:transform;}` : "";
  const scrollCss = anim.smoothScroll ? `html{scroll-behavior:smooth;}` : "";

  return `${kf}${staggerCss}section{animation:${name} ${dur} ${easing} both;}${paralaxCss}${scrollCss}`;
}

// ─── Product page defaults ────────────────────────────────────────────────────
const DEFAULT_PRODUCT_PAGE = {
  layout: "amazon",
  sections: DEFAULT_PRODUCT_SECTIONS,
  galleryStyle: "vertical-thumbs",
  zoomOnHover: true,
  stickyPanel: true,
  showBreadcrumbs: true,
  showBadges: true,
  showStockIndicator: true,
  showQuantitySelector: true,
  showReviews: true,
  showSimilarProducts: true,
  showDescriptionTabs: true,
  showAiDescription: true,
  imageRatio: "auto",
} as const;

// ─── Main component ───────────────────────────────────────────────────────────
export default function BuilderPage() {
  const [device, setDevice]           = useState<Device>("desktop");
  const [panel, setPanel]             = useState<Panel>("sections");
  const [tenant, setTenant]           = useState<any>(null);
  const [config, setConfig]           = useState<ThemeConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<ThemeConfig | null>(null);
  const [activeSection, setActiveSection]   = useState<string | null>("hero");
  const [showLibrary, setShowLibrary] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [iframeKey, setIframeKey]     = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [builderMode, setBuilderMode] = useState<"classique" | "libre">("classique");
  const iframeRef   = useRef<HTMLIFrameElement>(null);

  const debounce    = useRef<NodeJS.Timeout | null>(null);

  const refetchTenant = useCallback(async () => {
    const data = await fetch("/api/tenants/moi-complet").then((r) => r.json());
    if (data.error) return;
    setTenant(data);

    // Réplique resolveThemeConfigAsync (server) côté client en utilisant la
    // config du Theme actif retournée par moi-complet (activeThemeConfig).
    // Sans ça, les thèmes AXSO Design tombaient sur les défauts "terre-et-or"
    // (leurs IDs ne sont pas dans THEME_DEFAULTS), ce qui affichait de fausses
    // couleurs/polices dans les panneaux du builder.
    const activeThemeConfig = (data.activeThemeConfig as Record<string, any>) || {};
    const tenantConfig = (data.themeConfig as Record<string, any>) || {};
    let resolved: ThemeConfig;
    if (Object.keys(activeThemeConfig).length > 0) {
      const baseThemeId = (activeThemeConfig.baseThemeId as string) || "terre-et-or";
      const builtinBase = resolveThemeConfig(baseThemeId);
      const themeBase = mergeThemeConfig(builtinBase, activeThemeConfig);
      resolved = Object.keys(tenantConfig).length > 0
        ? mergeThemeConfig(themeBase, tenantConfig)
        : themeBase;
    } else {
      resolved = resolveThemeConfig(data.themeId, tenantConfig);
    }
    setConfig(resolved);
    setOriginalConfig(resolved);
  }, []);

  useEffect(() => { refetchTenant(); }, [refetchTenant]);

  // ─── Sélection visuelle dans l'aperçu (clic direct sur une section) ─────────
  const bindSelection = useCallback((doc: Document) => {
    try {
      const w = doc.defaultView as any;
      if (!w || w.__axsBound) return;
      w.__axsBound = true;
      let hoverEl: HTMLElement | null = null;
      const clearHover = () => {
        if (hoverEl && !hoverEl.hasAttribute("data-axs-selected")) { hoverEl.style.outline = ""; hoverEl.style.outlineOffset = ""; hoverEl.style.cursor = ""; }
        hoverEl = null;
      };
      doc.addEventListener("mouseover", (e: any) => {
        const target = (e.target as HTMLElement)?.closest?.("[data-axs-id]") as HTMLElement | null;
        if (target === hoverEl) return;
        clearHover();
        if (target && !target.hasAttribute("data-axs-selected")) {
          target.style.outline = "2px dashed #F5A623";
          target.style.outlineOffset = "-2px";
          target.style.cursor = "pointer";
        }
        hoverEl = target;
      }, true);
      doc.addEventListener("mouseout", (e: any) => {
        const related = e.relatedTarget as HTMLElement | null;
        if (hoverEl && (!related || !hoverEl.contains(related))) clearHover();
      }, true);
      doc.addEventListener("click", (e: any) => {
        const target = (e.target as HTMLElement)?.closest?.("[data-axs-id]") as HTMLElement | null;
        if (!target) return;
        e.preventDefault();
        e.stopPropagation();
        const id = target.getAttribute("data-axs-id");
        if (id) { setPanel("sections"); setActiveSection(id); }
      }, true);
    } catch { /* cross-origin guard */ }
  }, []);

  const injectLive = useCallback(() => {
    if (!iframeRef.current || !config) return;
    try {
      const doc = iframeRef.current.contentDocument;
      if (!doc) return;
      let st = doc.getElementById("bp") as HTMLStyleElement | null;
      if (!st) { st = doc.createElement("style"); st.id = "bp"; doc.head.appendChild(st); }
      const href = googleFontsHref(config.fonts);
      const fontImport = href ? `@import url('${href}');` : "";
      const fontCss = typographyCss(config.fonts);
      const animCss = generateAnimationCss(config.animations);
      st.textContent = `${fontImport}${fontCss}${animCss}${config.customCss || ""}`;
      bindSelection(doc);
    } catch { /* cross-origin guard */ }
  }, [config, bindSelection]);

  useEffect(() => { injectLive(); }, [injectLive]);

  // Sélection faite dans la sidebar → surlignage + scroll direct dans l'aperçu
  useEffect(() => {
    if (!iframeRef.current) return;
    try {
      const doc = iframeRef.current.contentDocument;
      if (!doc) return;
      doc.querySelectorAll("[data-axs-selected]").forEach((el: any) => {
        el.removeAttribute("data-axs-selected");
        el.style.outline = "";
        el.style.outlineOffset = "";
      });
      if (activeSection) {
        const target = doc.querySelector(`[data-axs-id="${CSS.escape(activeSection)}"]`) as HTMLElement | null;
        if (target) {
          target.setAttribute("data-axs-selected", "1");
          target.style.outline = `2px solid #F5A623`;
          target.style.outlineOffset = "-2px";
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    } catch { /* cross-origin guard */ }
  }, [activeSection]);

  // ─── Historique annuler / rétablir ──────────────────────────────────────────
  const undoStack   = useRef<ThemeConfig[]>([]);
  const redoStack   = useRef<ThemeConfig[]>([]);
  const skipHistory = useRef(false);
  const lastSnapshot = useRef<ThemeConfig | null>(null);
  const historyTimer = useRef<NodeJS.Timeout | null>(null);
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    if (!config) return;
    if (lastSnapshot.current === null) { lastSnapshot.current = config; return; }
    if (skipHistory.current) { skipHistory.current = false; lastSnapshot.current = config; return; }
    if (historyTimer.current) clearTimeout(historyTimer.current);
    const prev = lastSnapshot.current;
    historyTimer.current = setTimeout(() => {
      if (prev && JSON.stringify(prev) !== JSON.stringify(config)) {
        undoStack.current.push(prev);
        if (undoStack.current.length > 60) undoStack.current.shift();
        redoStack.current = [];
        setHistoryTick(t => t + 1);
      }
      lastSnapshot.current = config;
    }, 500);
    return () => { if (historyTimer.current) clearTimeout(historyTimer.current); };
  }, [config]);

  const undo = useCallback(() => {
    setConfig(current => {
      if (!undoStack.current.length || !current) return current;
      const prev = undoStack.current.pop()!;
      redoStack.current.push(current);
      skipHistory.current = true;
      lastSnapshot.current = prev;
      setHistoryTick(t => t + 1);
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setConfig(current => {
      if (!redoStack.current.length || !current) return current;
      const next = redoStack.current.pop()!;
      undoStack.current.push(current);
      skipHistory.current = true;
      lastSnapshot.current = next;
      setHistoryTick(t => t + 1);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const set = useCallback((u: (p: ThemeConfig) => ThemeConfig) => setConfig(p => p ? u(p) : p), []);
  const setSection  = useCallback((id: string, patch: any) => set(p => ({ ...p, sections: { ...p.sections, [id]: { ...(p.sections as any)[id], ...patch } } })), [set]);
  const setColors   = useCallback((patch: any) => set(p => ({ ...p, colors: { ...p.colors, ...patch } })), [set]);
  const setFonts    = useCallback((patch: any) => set(p => ({ ...p, fonts: { ...p.fonts, ...patch } })), [set]);
  const setLayout   = useCallback((patch: any) => set(p => ({ ...p, layout: { ...p.layout, ...patch } })), [set]);
  const setBoutons  = useCallback((patch: any) => set(p => ({ ...p, boutons: { ...p.boutons, ...patch } })), [set]);
  const setNavStyle = useCallback((patch: any) => set(p => ({ ...p, navigationStyle: { ...p.navigationStyle, ...patch } })), [set]);
  const setAnim     = useCallback((patch: any) => set(p => ({ ...p, animations: { ...p.animations, ...patch } as any })), [set]);
  const setProductPage = useCallback((patch: any) => set(p => ({ ...p, productPage: { ...(p.productPage || DEFAULT_PRODUCT_PAGE), ...patch } })), [set]);

  const addCustomSection = useCallback((type: CustomSection["type"]) => {
    const id = `custom_${Date.now()}`;
    const defaults: Record<string, any> = {
      features:     { titre: "Nos avantages", items: [{ icone: "★", titre: "Avantage 1", texte: "Description" }, { icone: "→", titre: "Avantage 2", texte: "Description" }, { icone: "✓", titre: "Avantage 3", texte: "Description" }], colonnes: 3 },
      stats:        { titre: "En chiffres", items: [{ valeur: "10K+", label: "Clients" }, { valeur: "500+", label: "Produits" }, { valeur: "4.9★", label: "Note" }, { valeur: "48h", label: "Livraison" }] },
      countdown:    { titre: "Offre limitée", texte: "Ne manquez pas cette opportunité unique !", dateFin: new Date(Date.now() + 7*24*3600*1000).toISOString().slice(0,16), ctaTexte: "Profiter maintenant" },
      brands:       { titre: "Ils nous font confiance", logos: ["", "", "", ""], style: "carousel" },
      video:        { titre: "Découvrez notre monde", videoUrl: "", style: "centered", autoplay: false },
      gallery:      { titre: "Notre lookbook", images: ["", "", "", "", "", ""], layout: "masonry" },
      "social-proof": { note: "4.9/5", nbClients: "12 000+", nbCommandes: "30 000+", certifications: ["✓ Paiement sécurisé", "✓ Livraison garantie"] },
      "cta-band":   { titre: "Prêt à découvrir ?", texte: "Rejoignez des milliers de clients satisfaits", ctaTexte: "Commencer maintenant", ctaLien: "produits", style: "gradient" },
      richtext:     { titre: "Notre engagement", texte: "Nous sommes passionnés par la qualité et l'authenticité. Chaque produit que vous trouvez ici a été sélectionné avec le plus grand soin.", ctaTexte: "", ctaLien: "" },
      spacer:       { hauteur: "80px" },
      tabs:         { titre: "Découvrez-en plus", onglets: [
        { id: `tab_${Date.now()}_1`, label: "Photos", blocs: [] },
        { id: `tab_${Date.now()}_2`, label: "Témoignages", blocs: [] },
      ] },
      columns:      { titre: "", nombreColonnes: 3, colonnes: [
        { id: `col_${Date.now()}_1`, blocs: [] },
        { id: `col_${Date.now()}_2`, blocs: [] },
        { id: `col_${Date.now()}_3`, blocs: [] },
      ] },
    };
    set(p => ({
      ...p,
      customSections: [...(p.customSections || []), { id, type, actif: true, label: CUSTOM_SECTION_TYPES.find(t => t.type === type)?.label || type, ordre: (p.customSections || []).length, config: defaults[type] || {} }],
    }));
    setShowLibrary(false);
    setActiveSection(id);
  }, [set]);

  const removeCustomSection = useCallback((id: string) => {
    set(p => ({ ...p, customSections: (p.customSections || []).filter(s => s.id !== id) }));
    setActiveSection(null);
  }, [set]);

  const duplicateCustomSection = useCallback((id: string) => {
    const newId = `custom_${Date.now()}`;
    set(p => {
      const list = p.customSections || [];
      const src = list.find(s => s.id === id);
      if (!src) return p;
      const idx = list.findIndex(s => s.id === id);
      const copy: CustomSection = { ...src, id: newId, label: `${src.label} (copie)`, config: JSON.parse(JSON.stringify(src.config)) };
      const next = [...list];
      next.splice(idx + 1, 0, copy);
      return { ...p, customSections: next.map((s, i) => ({ ...s, ordre: i })) };
    });
    setActiveSection(newId);
  }, [set]);

  const updateCustomSection = useCallback((id: string, patch: any) => {
    set(p => ({ ...p, customSections: (p.customSections || []).map(s => s.id === id ? { ...s, config: { ...s.config, ...patch } } : s) }));
  }, [set]);

  const handleSave = useCallback(async () => {
    if (!config || !tenant) return;
    setSaving(true);
    try {
      // Merge animation CSS into customCss
      const animCss = generateAnimationCss(config.animations);
      const finalCss = (config.customCss || "").replace(/\/\* __anim__ \*\/[\s\S]*?\/\* __endanim__ \*\//g, "").trim();
      const mergedCss = animCss ? `/* __anim__ */\n${animCss}\n/* __endanim__ */\n${finalCss}` : finalCss;
      await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeConfig: { ...config, customCss: mergedCss } }),
      });
      setOriginalConfig(config);
      setSaved(true);
      setIframeKey(k => k + 1);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }, [config, tenant]);

  useEffect(() => {
    if (!config || !originalConfig || JSON.stringify(config) === JSON.stringify(originalConfig)) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => handleSave(), 3500);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [config, originalConfig, handleSave]);

  const hasChanges = config && originalConfig && JSON.stringify(config) !== JSON.stringify(originalConfig);

  // Passé à AXIA (constructeur libre) : sauvegarde d'abord tout changement
  // local en cours (AXIA écrit directement en base, un changement non
  // sauvegardé serait sinon écrasé au rechargement), puis recharge après sa
  // réponse pour que ses changements apparaissent immédiatement.
  const syncWithServer = async () => {
    if (hasChanges) await handleSave();
    await refetchTenant();
  };

  if (!config || !tenant) return (
    <div className="h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Chargement du constructeur</p>
      </div>
    </div>
  );

  const sectionOrder = config.sectionOrder || DEFAULT_SECTION_ORDER;

  return (
    <div className={`flex flex-col bg-[#F5F7FA] text-gray-800 overflow-hidden ${isFullscreen ? "fixed inset-0 z-[9999]" : "h-screen"}`} style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <PCOnlyGate label="Le Constructeur de boutique" />
      <ModuleTutorial moduleKey="builder" titre="Constructeur de boutique" sousTitre="Personnalise ta boutique en direct" steps={BUILDER_TUTORIAL_STEPS} />

      {/* HEADER */}
      <header className="h-11 flex items-center justify-between px-4 bg-white border-b border-gray-200 flex-shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-gray-400 hover:text-gray-800 transition-colors text-xs">
            <ArrowLeft size={13} /> Dashboard
          </Link>
          <div className="h-4 w-px bg-gray-100" />
          <span className="text-xs text-gray-800 font-medium truncate max-w-32">{tenant.nomBoutique}</span>
          {hasChanges && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 animate-pulse">Modifié</span>}
          {saved && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">✓ Sauvegardé</span>}
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-gray-100 text-white">
          <Layers size={10} /> Constructeur
          <BoutonRevoirTutoriel moduleKey="builder" dark />
        </div>

        {(THEMES_LIBRE_ELIGIBLES as readonly string[]).includes(tenant.themeId) && (
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setBuilderMode("classique")} className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${builderMode === "classique" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              Constructeur classique
            </button>
            <button onClick={() => setBuilderMode("libre")} className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${builderMode === "libre" ? "bg-[#F5A623] text-black shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              <Wand2 size={10} /> Constructeur libre (bêta)
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            <button onClick={undo} disabled={!undoStack.current.length} title="Annuler (Ctrl+Z)"
              className="w-7 h-7 rounded flex items-center justify-center transition-all text-gray-600 hover:text-gray-400 disabled:opacity-30 disabled:hover:text-gray-600">
              <Undo2 size={13} />
            </button>
            <button onClick={redo} disabled={!redoStack.current.length} title="Rétablir (Ctrl+Y)"
              className="w-7 h-7 rounded flex items-center justify-center transition-all text-gray-600 hover:text-gray-400 disabled:opacity-30 disabled:hover:text-gray-600">
              <Redo2 size={13} />
            </button>
          </div>
          <div className="h-4 w-px bg-gray-100" />
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {([["desktop",Monitor],["tablet",Tablet],["mobile",Smartphone]] as [Device, any][]).map(([d,Icon]) => (
              <button key={d} onClick={() => setDevice(d)} className={`w-7 h-7 rounded flex items-center justify-center transition-all ${device===d?"bg-[#F5A623]/20 text-[#F5A623]":"text-gray-600 hover:text-gray-400"}`}>
                <Icon size={13} />
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsFullscreen(v => !v)}
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${isFullscreen ? "border-[#F5A623]/50 bg-[#F5A623]/15 text-[#F5A623]" : "border-gray-200 text-gray-500 hover:text-white hover:border-gray-300"}`}>
            {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
          <a href={`/${tenant.slug}`} target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-gray-500 hover:text-white border border-gray-200 hover:border-gray-300 transition-all">
            <ExternalLink size={10} /> Voir
          </a>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: saved?"#34d399":"#F5A623", color:"#050508" }}>
            {saving ? <RefreshCw size={10} className="animate-spin" /> : <Save size={10} />}
            {saving ? "..." : saved ? "✓" : "Sauvegarder"}
          </button>
        </div>
      </header>

      {/* MAIN */}
      <div className="flex-1 flex overflow-hidden">
        {builderMode === "libre" ? (
          <BuilderCanvas config={config} set={set} slug={tenant.slug} device={device} onSyncWithServer={syncWithServer} />
        ) : (
        <>
        {/* Icon sidebar */}
        <div className="w-11 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1">
            {NAV_TABS.map(t => (
              <button key={t.id} onClick={() => setPanel(t.id)} title={t.tooltip}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${panel===t.id?"bg-[#F5A623]/20 text-[#F5A623]":"text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}>
                {t.icon}
              </button>
            ))}
          </div>

        {/* Panel */}
          <div className="w-[300px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.18em]">{NAV_TABS.find(t=>t.id===panel)?.tooltip}</p>
              {panel === "sections" && (
                <button onClick={() => setShowLibrary(v => !v)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all" style={{ backgroundColor: "#F5A623", color: "#050508" }}>
                  <Plus size={10} /> Ajouter
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {showLibrary && panel === "sections" && (
                <SectionLibrary onAdd={addCustomSection} onClose={() => setShowLibrary(false)} />
              )}
              {!showLibrary && panel === "sections"   && <PanelSections config={config} set={set} activeSection={activeSection} setActiveSection={setActiveSection} setSection={setSection} sectionOrder={sectionOrder as SectionId[]} updateCustomSection={updateCustomSection} removeCustomSection={removeCustomSection} duplicateCustomSection={duplicateCustomSection} />}
              {panel === "couleurs"   && <PanelCouleurs  config={config} setColors={setColors} />}
              {panel === "typo"       && <PanelTypo      config={config} setFonts={setFonts} />}
              {panel === "layout"     && <PanelLayout    config={config} setLayout={setLayout} set={set} />}
              {panel === "medias"     && <PanelMedias    config={config} setSection={setSection} updateCustomSection={updateCustomSection} />}
              {panel === "animations" && <PanelAnimations config={config} setAnim={setAnim} />}
              {panel === "boutons"    && <PanelBoutons   config={config} setBoutons={setBoutons} setNavStyle={setNavStyle} />}
              {panel === "produit"    && <PanelProduit   config={config} setProductPage={setProductPage} />}
              {panel === "apropos"    && <PanelPageSections config={config} set={set} pageKey="aboutPage" titre="À propos" />}
              {panel === "contact"    && <PanelPageSections config={config} set={set} pageKey="contactPage" titre="Contact" />}
              {panel === "avance"     && <PanelAvance    config={config} set={set} tenant={tenant} onReset={() => { setConfig({ ...resolveThemeConfig(tenant.themeId) }); }} />}
            </div>
          </div>

            {/* Preview */}
            <div className="flex-1 bg-[#EEF0F6] flex flex-col overflow-hidden">
              <div className="h-8 flex items-center gap-2 px-3 bg-white border-b border-gray-200 flex-shrink-0">
                <div className="flex gap-1">
                  {["#ef444480","#eab30880","#22c55e80"].map(c=><div key={c} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />)}
                </div>
                <div className="flex-1 bg-gray-100 rounded px-3 py-0.5 text-[9px] text-gray-600 text-center truncate">
                  {typeof window!=="undefined" ? window.location.origin : "http://localhost:3000"}/{tenant.slug}
                </div>
                <span className="hidden md:flex items-center gap-1 text-[9px] text-gray-500 flex-shrink-0" title="Clique une section de l'aperçu pour la modifier directement">
                  <MousePointer2 size={9} style={{ color: "#F5A623" }} /> Clic direct sur l'aperçu
                </span>
                <button onClick={() => setIframeKey(k=>k+1)} className="text-gray-600 hover:text-gray-400" title="Rafraîchir">
                  <RefreshCw size={10} />
                </button>
              </div>
              <div className="flex-1 flex items-stretch justify-center bg-[#E8EBF3] overflow-hidden p-1.5">
                <div className="transition-all duration-500 bg-white overflow-hidden"
                  style={{ width: device==="desktop"?"100%":device==="tablet"?"768px":"390px", maxWidth:"100%", borderRadius: device!=="desktop"?"20px":"0", boxShadow: device!=="desktop"?"0 24px 80px rgba(0,0,0,0.7)":"none" }}>
                  <iframe ref={iframeRef} key={iframeKey} src={`/${tenant.slug}`} onLoad={injectLive}
                    allow="geolocation; camera; microphone"
                    className="w-full border-0 block"
                    style={{ height: device!=="desktop"?"calc(100vh - 128px)":"calc(100vh - 78px)" }}
                    title="Prévisualisation" />
                </div>
              </div>
            </div>
        </>
        )}
      </div>
    </div>
  );
}

// ─── Section Library ──────────────────────────────────────────────────────────
function SectionLibrary({ onAdd, onClose }: { onAdd: (t: CustomSection["type"]) => void; onClose: () => void }) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-gray-700">Bibliothèque de sections</p>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={13} /></button>
      </div>
      <div className="space-y-1.5">
        {CUSTOM_SECTION_TYPES.map(t => (
          <button key={t.type} onClick={() => onAdd(t.type as CustomSection["type"])}
            className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-[#F5A623]/30 hover:bg-[#F5A623]/5 transition-all group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,166,35,0.08)" }}><t.Icon size={15} style={{ color: "#F5A623" }} /></div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white group-hover:text-[#F5A623] transition-colors">{t.label}</p>
              <p className="text-[10px] text-gray-600 mt-0.5 leading-relaxed">{t.desc}</p>
            </div>
            <Plus size={12} className="flex-shrink-0 text-gray-700 group-hover:text-[#F5A623] mt-0.5 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Panel Sections ───────────────────────────────────────────────────────────
// Réordonnancement 100% glisser-déposer (plus de flèches) — même mécanique
// que PanelProduit (dragIdx/overIdx + reorder), appliquée à deux groupes
// indépendants : sections intégrées (sectionOrder) et sections personnalisées
// (customSections, ordre). Elles restent deux groupes séparés — sur la
// boutique publiée, les sections custom s'affichent toujours après toutes
// les sections intégrées (voir CustomSectionsRenderer) : les mélanger dans
// une seule liste glissable donnerait une réorganisation trompeuse.
function PanelSections({ config, set, activeSection, setActiveSection, setSection, sectionOrder, updateCustomSection, removeCustomSection, duplicateCustomSection }: any) {
  const sec = config.sections as any;
  const custom: CustomSection[] = [...(config.customSections || [])].sort((a, b) => a.ordre - b.ordre);
  const sousBlocsMap: Record<string, any[]> = config.sectionSousBlocs || {};
  const setSousBlocs = (sectionId: string, blocs: any[]) => set((p: any) => ({ ...p, sectionSousBlocs: { ...(p.sectionSousBlocs || {}), [sectionId]: blocs } }));

  const [dragBuiltin, setDragBuiltin] = useState<number | null>(null);
  const [overBuiltin, setOverBuiltin] = useState<number | null>(null);
  const [dragCustom, setDragCustom] = useState<number | null>(null);
  const [overCustom, setOverCustom] = useState<number | null>(null);

  function reorderBuiltin(from: number, to: number) {
    if (from === to) return;
    const arr = [...sectionOrder];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    set((p: ThemeConfig) => ({ ...p, sectionOrder: arr }));
  }
  function reorderCustom(from: number, to: number) {
    if (from === to) return;
    const arr = [...custom];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    set((p: ThemeConfig) => ({ ...p, customSections: arr.map((s, i) => ({ ...s, ordre: i })) }));
  }
  function toggleCustom(id: string, actif: boolean) {
    set((p: ThemeConfig) => ({ ...p, customSections: (p.customSections || []).map(s => s.id === id ? { ...s, actif } : s) }));
  }

  function renderItem(item: { id: string; label: string; Icon: any; isCustom: boolean; actif: boolean }, idx: number, group: "builtin" | "custom") {
    const isOpen = activeSection === item.id;
    const builtinSec = !item.isCustom ? sec[item.id] : null;
    const customSec  = item.isCustom ? custom.find(c => c.id === item.id) : null;
    const dragIdx = group === "builtin" ? dragBuiltin : dragCustom;
    const overIdx = group === "builtin" ? overBuiltin : overCustom;
    const setDrag = group === "builtin" ? setDragBuiltin : setDragCustom;
    const setOver = group === "builtin" ? setOverBuiltin : setOverCustom;
    const reorder = group === "builtin" ? reorderBuiltin : reorderCustom;

    return (
      <div key={item.id}
        draggable
        onDragStart={() => setDrag(idx)}
        onDragOver={e => { e.preventDefault(); if (overIdx !== idx) setOver(idx); }}
        onDragLeave={() => setOver((o: number | null) => o === idx ? null : o)}
        onDrop={e => { e.preventDefault(); if (dragIdx !== null) reorder(dragIdx, idx); setDrag(null); setOver(null); }}
        onDragEnd={() => { setDrag(null); setOver(null); }}
        className={`${isOpen ? "bg-gray-50/80" : ""} transition-all ${dragIdx === idx ? "opacity-40" : ""} ${overIdx === idx && dragIdx !== null && dragIdx !== idx ? "ring-2 ring-inset ring-[#F5A623]/50" : ""}`}>
        <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 select-none"
          onClick={() => setActiveSection(isOpen ? null : item.id)}>
          <div className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 flex-shrink-0" title="Glisser pour réordonner" onClick={e => e.stopPropagation()}>
            <GripVertical size={12} />
          </div>
          <item.Icon size={13} className="flex-shrink-0 text-gray-400" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-gray-700 truncate">{item.label}</p>
            {item.isCustom && <span className="text-[8px] text-[#F5A623]/70 uppercase tracking-wider">Section custom</span>}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e=>e.stopPropagation()}>
            <button onClick={() => item.isCustom ? toggleCustom(item.id, !item.actif) : setSection(item.id, { actif: !item.actif })}>
              {item.actif ? <ToggleRight size={16} style={{ color:"#F5A623" }} /> : <ToggleLeft size={16} className="text-gray-700" />}
            </button>
            {item.isCustom && (
              <button onClick={() => duplicateCustomSection(item.id)} title="Dupliquer" className="text-gray-600 hover:text-gray-400 transition-colors"><Copy size={12} /></button>
            )}
            {item.isCustom && (
              <button onClick={() => removeCustomSection(item.id)} title="Supprimer" className="text-red-500/40 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
            )}
            {isOpen ? <ChevronDown size={10} className="text-gray-500" /> : <ChevronRight size={10} className="text-gray-700" />}
          </div>
        </div>

        {isOpen && (
          <div className="px-3 pb-4 space-y-2.5">
            {!item.isCustom && <BuiltinSectionControls id={item.id as SectionId} sec={builtinSec} setSection={setSection} />}
            {item.isCustom && customSec && <CustomSectionControls section={customSec} update={updateCustomSection} />}

            {/* Sous-sections personnalisées — disponibles dans TOUTE section, built-in ou custom */}
            <div className="pt-3 mt-1 border-t border-gray-200">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.15em] mb-2">Sous-sections</p>
              <SousBlocsEditor blocs={sousBlocsMap[item.id] || []} onChange={(blocs: any[]) => setSousBlocs(item.id, blocs)} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const builtinItems = sectionOrder.map((id: SectionId) => ({ id, label: SECTION_META[id].label, Icon: SECTION_META[id].Icon, isCustom: false, actif: sec[id]?.actif ?? true }));
  const customItems = custom.map(s => ({ id: s.id, label: s.label, Icon: CUSTOM_SECTION_TYPES.find(t=>t.type===s.type)?.Icon || Wrench, isCustom: true, actif: s.actif }));

  return (
    <div className="divide-y divide-white/5">
      {builtinItems.map((item: any, idx: number) => renderItem(item, idx, "builtin"))}
      {customItems.length > 0 && (
        <div className="px-3 py-1.5 bg-gray-50/60">
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.15em]">Sections personnalisées</p>
        </div>
      )}
      {customItems.map((item, idx) => renderItem(item, idx, "custom"))}
    </div>
  );
}

// ─── Built-in section controls ────────────────────────────────────────────────
function BuiltinSectionControls({ id, sec, setSection }: { id: SectionId; sec: any; setSection: any }) {
  if (!sec) return null;
  const s = setSection.bind(null, id);

  if (id === "annonce") return (
    <>
      <FInp label="Texte" value={sec.texte} onChange={v=>s({texte:v})} multiline />
      <div className="grid grid-cols-2 gap-2">
        <FCol label="Fond" value={sec.couleurFond} onChange={v=>s({couleurFond:v})} />
        <FCol label="Texte" value={sec.couleurTexte} onChange={v=>s({couleurTexte:v})} />
      </div>
      <FCheck label="Texte défilant (marquee)" checked={sec.defilant||false} onChange={v=>s({defilant:v})} />
    </>
  );

  if (id === "hero") return (
    <>
      <FSel label="Style de mise en page" value={sec.style} onChange={v=>s({style:v})} opts={[
        {v:"centered",l:"Centré (texte + fond)"},{v:"split",l:"Divisé (image + texte)"},
        {v:"fullscreen",l:"Plein écran (immersif)"},{v:"minimal",l:"Minimal (texte seul)"},
        {v:"slideshow",l:"Diaporama (multi-images)"},{v:"magazine",l:"Magazine (2 colonnes)"},
        {v:"video",l:"Vidéo en fond"},
      ]} />
      <FSel label="Hauteur" value={sec.hauteur||"80vh"} onChange={v=>s({hauteur:v})} opts={[
        {v:"50vh",l:"Compact (50vh)"},{v:"60vh",l:"Intermédiaire (60vh)"},
        {v:"80vh",l:"Standard (80vh)"},{v:"100vh",l:"Plein écran (100vh)"},
      ]} />
      <FSel label="Position du texte" value={sec.textPosition||"center"} onChange={v=>s({textPosition:v})} opts={[
        {v:"left",l:"Gauche"},{v:"center",l:"Centré"},{v:"right",l:"Droite"},
      ]} />
      <FInp label="Titre principal" value={sec.titre} onChange={v=>s({titre:v})} />
      <FInp label="Sous-titre" value={sec.sousTitre} onChange={v=>s({sousTitre:v})} multiline />
      <FInp label="Badge / étiquette (optionnel)" value={sec.badgeTexte||""} onChange={v=>s({badgeTexte:v})} />
      <FInp label="Texte du bouton principal" value={sec.ctaTexte} onChange={v=>s({ctaTexte:v})} />
      <FSel label="Lien du bouton" value={sec.ctaLien||"produits"} onChange={v=>s({ctaLien:v})} opts={[
        {v:"produits",l:"Tous les produits"},{v:"panier",l:"Panier"},{v:"",l:"Accueil"},
      ]} />
      <FCheck label="Afficher un 2e bouton" checked={sec.showSecondCta||false} onChange={v=>s({showSecondCta:v})} />
      {sec.showSecondCta && <>
        <FInp label="Texte du 2e bouton" value={sec.secondCtaTexte||""} onChange={v=>s({secondCtaTexte:v})} />
        <FInp label="Lien du 2e bouton" value={sec.secondCtaLien||"produits"} onChange={v=>s({secondCtaLien:v})} />
      </>}
      {sec.style === "video" && <FInp label="URL vidéo (mp4 ou YouTube embed)" value={sec.videoUrl||""} onChange={v=>s({videoUrl:v})} />}
      {sec.style === "slideshow" && (
        <div>
          <p className="text-[10px] text-gray-500 mb-2">URLs des images du diaporama</p>
          {(sec.slideshowImages||[""]).map((url: string, i: number) => (
            <div key={i} className="flex gap-1 mb-1.5">
              <FInp label="" value={url} onChange={v=>{ const imgs=[...(sec.slideshowImages||[""])]; imgs[i]=v; s({slideshowImages:imgs}); }} />
              <button onClick={()=>{ const imgs=(sec.slideshowImages||[""]).filter((_:any,j:number)=>j!==i); s({slideshowImages:imgs}); }} className="text-red-500/40 hover:text-red-400 flex-shrink-0 mt-3.5"><Trash2 size={11}/></button>
            </div>
          ))}
          <button onClick={()=>s({slideshowImages:[...(sec.slideshowImages||[""]),""]})} className="w-full text-[10px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1.5 hover:border-gray-300 hover:text-gray-400">
            + Ajouter une image
          </button>
          <FSel label="Intervalle (secondes)" value={String(sec.slideshowInterval||5)} onChange={v=>s({slideshowInterval:Number(v)})} opts={[{v:"3",l:"3s"},{v:"4",l:"4s"},{v:"5",l:"5s"},{v:"7",l:"7s"},{v:"10",l:"10s"}]} />
        </div>
      )}
      <FSli label={`Obscurcissement de l'image : ${sec.overlay}%`} value={sec.overlay} min={0} max={90} onChange={v=>s({overlay:v})} />
      <FCheck label="Effet particules" checked={sec.particles||false} onChange={v=>s({particles:v})} />
    </>
  );

  if (id === "confiance") return (
    <>
      <FSel label="Style d'affichage" value={sec.layout||"icons"} onChange={v=>s({layout:v})} opts={[{v:"icons",l:"Icônes (minimal)"},{v:"cards",l:"Cartes avec fond"},{v:"bar",l:"Barre horizontale"}]} />
      {(sec.items||[]).map((item: any, i: number) => (
        <div key={i} className="bg-gray-50 rounded-xl p-2.5 space-y-2">
          <div className="flex gap-2">
            <FInp label="Emoji" value={item.icone} onChange={v=>{ const it=[...sec.items]; it[i]={...it[i],icone:v}; s({items:it}); }} />
            <FInp label="Titre" value={item.titre} onChange={v=>{ const it=[...sec.items]; it[i]={...it[i],titre:v}; s({items:it}); }} />
          </div>
          <FInp label="Texte" value={item.texte} onChange={v=>{ const it=[...sec.items]; it[i]={...it[i],texte:v}; s({items:it}); }} />
        </div>
      ))}
    </>
  );

  if (id === "vedettes") return (
    <>
      <FInp label="Titre" value={sec.titre} onChange={v=>s({titre:v})} />
      <FSel label="Nombre" value={String(sec.nombre)} onChange={v=>s({nombre:Number(v)})} opts={[{v:"4",l:"4"},{v:"8",l:"8"},{v:"12",l:"12"},{v:"16",l:"16"},{v:"20",l:"20 produits"}]} />
      <FSel label="Trier par" value={sec.triPar} onChange={v=>s({triPar:v})} opts={[{v:"ventes",l:"Best-sellers"},{v:"featured",l:"Mis en avant"},{v:"recent",l:"Plus récents"}]} />
      <FSel label="Disposition" value={sec.layout||"grid"} onChange={v=>s({layout:v})} opts={[{v:"grid",l:"Grille classique"},{v:"carousel",l:"Carrousel"},{v:"masonry",l:"Mosaïque"}]} />
      <FSel label="Colonnes (desktop)" value={String(sec.colonnes||4)} onChange={v=>s({colonnes:Number(v)})} opts={[{v:"2",l:"2"},{v:"3",l:"3"},{v:"4",l:"4"},{v:"5",l:"5 colonnes"}]} />
      <FCheck label="Afficher les notes" checked={sec.showRatings||false} onChange={v=>s({showRatings:v})} />
      <FCheck label="Afficher le nombre de ventes" checked={sec.showSoldCount||false} onChange={v=>s({showSoldCount:v})} />
    </>
  );

  if (id === "collections") return (
    <>
      <FInp label="Titre" value={sec.titre} onChange={v=>s({titre:v})} />
      <FSel label="Disposition" value={sec.layout||"grid"} onChange={v=>s({layout:v})} opts={[{v:"grid",l:"Grille"},{v:"masonry",l:"Mosaïque"},{v:"carousel",l:"Carrousel"},{v:"cards",l:"Cartes"}]} />
    </>
  );

  if (id === "about") return (
    <>
      <FInp label="Titre" value={sec.titre||""} onChange={v=>s({titre:v})} />
      <FInp label="Texte" value={sec.texte||""} onChange={v=>s({texte:v})} multiline />
      <FInp label="Badge (ex: « Fondée en 2020 »)" value={sec.badgeTexte||""} onChange={v=>s({badgeTexte:v})} />
      <FSel label="Disposition" value={sec.layout||"image-right"} onChange={v=>s({layout:v})} opts={[
        {v:"image-left",l:"Image à gauche"},{v:"image-right",l:"Image à droite"},
        {v:"centered",l:"Centré"},{v:"fullwidth",l:"Pleine largeur"},
      ]} />
      <FInp label="URL de l'image" value={sec.imageUrl||""} onChange={v=>s({imageUrl:v})} />
      <div>
        <p className="text-[10px] text-gray-500 mb-2">Statistiques (optionnel)</p>
        {(sec.stats||[]).map((st: any, i: number) => (
          <div key={i} className="flex gap-2 mb-1.5">
            <FInp label="" value={st.valeur} onChange={v=>{ const stats=[...(sec.stats||[])]; stats[i]={...stats[i],valeur:v}; s({stats}); }} />
            <FInp label="" value={st.label} onChange={v=>{ const stats=[...(sec.stats||[])]; stats[i]={...stats[i],label:v}; s({stats}); }} />
          </div>
        ))}
      </div>
    </>
  );

  if (id === "promo") return (
    <>
      <FInp label="Titre" value={sec.titre} onChange={v=>s({titre:v})} />
      <FInp label="Description" value={sec.texte} onChange={v=>s({texte:v})} multiline />
      <FInp label="Texte du bouton" value={sec.ctaTexte} onChange={v=>s({ctaTexte:v})} />
      <FSel label="Style" value={sec.style||"gradient"} onChange={v=>s({style:v})} opts={[
        {v:"gradient",l:"Dégradé accent"},{v:"solid",l:"Couleur pleine"},
        {v:"image",l:"Image de fond"},{v:"split",l:"Divisé (texte + visuel)"},
      ]} />
      {sec.style === "image" && <FInp label="URL de l'image de fond" value={sec.imageUrl||""} onChange={v=>s({imageUrl:v})} />}
    </>
  );

  if (id === "faq") return (
    <>
      <FInp label="Titre" value={sec.titre||""} onChange={v=>s({titre:v})} />
      <FSel label="Style" value={sec.layout||"accordion"} onChange={v=>s({layout:v})} opts={[{v:"accordion",l:"Accordéon"},{v:"grid",l:"Grille"},{v:"columns",l:"2 colonnes"}]} />
      <div className="space-y-2">
        {(sec.items||[]).map((item: any, i: number) => (
          <div key={i} className="bg-gray-50 rounded-xl p-2.5 space-y-2">
            <div className="flex items-start gap-1.5">
              <div className="flex-1 space-y-1.5">
                <FInp label="Question" value={item.question} onChange={v=>{ const it=[...sec.items]; it[i]={...it[i],question:v}; s({items:it}); }} />
                <FInp label="Réponse" value={item.reponse} onChange={v=>{ const it=[...sec.items]; it[i]={...it[i],reponse:v}; s({items:it}); }} multiline />
              </div>
              <button onClick={()=>s({items:sec.items.filter((_:any,j:number)=>j!==i)})} className="text-red-500/40 hover:text-red-400 mt-5"><Trash2 size={11}/></button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={()=>s({items:[...(sec.items||[]),{question:"Nouvelle question ?",reponse:"Votre réponse ici."}]})} className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-gray-200 rounded-xl text-[10px] text-gray-500 hover:border-gray-300 hover:text-gray-400">
        <Plus size={11} /> Ajouter une question
      </button>
    </>
  );

  if (id === "avis") return (
    <>
      <FInp label="Titre" value={sec.titre} onChange={v=>s({titre:v})} />
      <FSel label="Disposition" value={sec.layout||"cards"} onChange={v=>s({layout:v})} opts={[{v:"cards",l:"Cartes"},{v:"carousel",l:"Carrousel"},{v:"list",l:"Liste"},{v:"masonry",l:"Mosaïque"}]} />
      <FCheck label="Afficher les photos clients" checked={sec.showPhotos||false} onChange={v=>s({showPhotos:v})} />
    </>
  );

  if (id === "newsletter") return (
    <>
      <FInp label="Titre" value={sec.titre} onChange={v=>s({titre:v})} />
      <FInp label="Description" value={sec.texte} onChange={v=>s({texte:v})} multiline />
      <FInp label="Placeholder email" value={sec.placeholder} onChange={v=>s({placeholder:v})} />
      <FInp label="Texte du bouton" value={sec.ctaTexte} onChange={v=>s({ctaTexte:v})} />
      <FSel label="Style" value={sec.style||"centered"} onChange={v=>s({style:v})} opts={[{v:"centered",l:"Centré"},{v:"split",l:"Divisé"},{v:"banner",l:"Bandeau plein"}]} />
    </>
  );

  return null;
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
      <button onClick={()=>up({items:[...(c.items||[]),{icone:"★",titre:"Avantage",texte:"Description"}]})} className="w-full text-[10px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1.5 hover:border-gray-300">+ Ajouter</button>
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
        <label className="text-[10px] text-gray-500 block mb-1.5">Date de fin</label>
        <input type="datetime-local" value={c.dateFin||""} onChange={e=>up({dateFin:e.target.value})} className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#F5A623]/50" />
      </div>
      <FInp label="Texte du bouton CTA" value={c.ctaTexte||""} onChange={v=>up({ctaTexte:v})} />
    </>
  );

  if (section.type === "brands") return (
    <>
      <FInp label="Titre (optionnel)" value={c.titre||""} onChange={v=>up({titre:v})} />
      <FSel label="Style" value={c.style||"carousel"} onChange={v=>up({style:v})} opts={[{v:"carousel",l:"Carrousel défilant"},{v:"grid",l:"Grille fixe"}]} />
      <div>
        <p className="text-[10px] text-gray-500 mb-2">URLs des logos</p>
        {(c.logos||[]).map((url: string, i: number) => (
          <div key={i} className="flex gap-1 mb-1.5">
            <FInp label="" value={url} onChange={v=>{ const l=[...c.logos]; l[i]=v; up({logos:l}); }} />
            <button onClick={()=>up({logos:c.logos.filter((_:any,j:number)=>j!==i)})} className="text-red-500/40 hover:text-red-400 flex-shrink-0 mt-3.5"><Trash2 size={11}/></button>
          </div>
        ))}
        <button onClick={()=>up({logos:[...(c.logos||[]),""]})} className="w-full text-[10px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1.5 hover:border-gray-300">+ Ajouter un logo</button>
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
        <p className="text-[10px] text-gray-500 mb-2">URLs des photos</p>
        {(c.images||[]).map((url: string, i: number) => (
          <div key={i} className="flex gap-1 mb-1.5">
            <FInp label="" value={url} onChange={v=>{ const imgs=[...c.images]; imgs[i]=v; up({images:imgs}); }} />
            <button onClick={()=>up({images:c.images.filter((_:any,j:number)=>j!==i)})} className="text-red-500/40 hover:text-red-400 flex-shrink-0 mt-3.5"><Trash2 size={11}/></button>
          </div>
        ))}
        <button onClick={()=>up({images:[...(c.images||[]),""]})} className="w-full text-[10px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1.5 hover:border-gray-300">+ Ajouter une photo</button>
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
      <button onClick={()=>up({onglets:[...(c.onglets||[]),{id:`tab_${Date.now()}`,label:"Nouvel onglet",blocs:[]}]})} className="w-full text-[10px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1.5 hover:border-gray-300">+ Ajouter un onglet</button>
    </>
  );

  if (section.type === "columns") return (
    <>
      <FInp label="Titre (optionnel)" value={c.titre||""} onChange={v=>up({titre:v})} />
      <FSel label="Nombre de colonnes" value={String(c.nombreColonnes||3)} onChange={v=>up({nombreColonnes:Number(v)})} opts={[{v:"2",l:"2"},{v:"3",l:"3"},{v:"4",l:"4 colonnes"}]} />
      {(c.colonnes||[]).map((col: any, i: number) => (
        <div key={col.id} className="bg-gray-50 rounded-xl p-3 space-y-2.5 border border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-500 font-semibold">Colonne {i+1}</p>
            <button onClick={()=>up({colonnes:c.colonnes.filter((_:any,j:number)=>j!==i)})} className="text-red-500/40 hover:text-red-400"><Trash2 size={13}/></button>
          </div>
          <SousBlocsEditor blocs={col.blocs||[]} onChange={(blocs: any[])=>{ const cols=[...c.colonnes]; cols[i]={...cols[i],blocs}; up({colonnes:cols}); }} />
        </div>
      ))}
      <button onClick={()=>up({colonnes:[...(c.colonnes||[]),{id:`col_${Date.now()}`,blocs:[]}]})} className="w-full text-[10px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1.5 hover:border-gray-300">+ Ajouter une colonne</button>
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
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                {meta && <meta.Icon size={10} />} {meta?.label}
              </span>
              <button onClick={() => removeBloc(i)} className="text-red-500/40 hover:text-red-400"><Trash2 size={10} /></button>
            </div>
            {b.type === "photos" && (
              <div>
                {(b.config.images || [""]).map((url: string, j: number) => (
                  <div key={j} className="mb-1"><FInp label="" value={url} onChange={v => { const imgs = [...(b.config.images || [""])]; imgs[j] = v; updateBloc(i, { images: imgs }); }} /></div>
                ))}
                <button onClick={() => updateBloc(i, { images: [...(b.config.images || []), ""] })} className="text-[9px] text-gray-500 hover:text-gray-300">+ photo</button>
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
                <button onClick={() => updateBloc(i, { items: [...(b.config.items || []), { valeur: "", label: "" }] })} className="text-[9px] text-gray-500 hover:text-gray-300">+ statistique</button>
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
                <button onClick={() => updateBloc(i, { items: [...(b.config.items || []), { icone: "★", titre: "", texte: "" }] })} className="text-[9px] text-gray-500 hover:text-gray-300">+ avantage</button>
              </div>
            )}
            {b.type === "countdown" && (<>
              <FInp label="Texte" value={b.config.texte || ""} onChange={v => updateBloc(i, { texte: v })} />
              <label className="block text-[9px] text-gray-500 mb-0.5 mt-1">Date de fin</label>
              <input type="datetime-local" value={b.config.dateFin || ""} onChange={e => updateBloc(i, { dateFin: e.target.value })} className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] text-white mb-1.5" />
              <FInp label="Bouton" value={b.config.ctaTexte || ""} onChange={v => updateBloc(i, { ctaTexte: v })} />
            </>)}
            {b.type === "logos" && (
              <div>
                {(b.config.logos || [""]).map((url: string, j: number) => (
                  <div key={j} className="mb-1"><FInp label="" value={url} onChange={v => { const logos = [...(b.config.logos || [""])]; logos[j] = v; updateBloc(i, { logos }); }} /></div>
                ))}
                <button onClick={() => updateBloc(i, { logos: [...(b.config.logos || []), ""] })} className="text-[9px] text-gray-500 hover:text-gray-300">+ logo</button>
              </div>
            )}
            {b.type === "confiance" && (<>
              <FInp label="Note" value={b.config.note || ""} onChange={v => updateBloc(i, { note: v })} />
              <FInp label="Nb clients" value={b.config.nbClients || ""} onChange={v => updateBloc(i, { nbClients: v })} />
              {(b.config.certifications || []).map((cert: string, j: number) => (
                <div key={j} className="mb-1"><FInp label="" value={cert} onChange={v => { const certs = [...(b.config.certifications || [])]; certs[j] = v; updateBloc(i, { certifications: certs }); }} /></div>
              ))}
              <button onClick={() => updateBloc(i, { certifications: [...(b.config.certifications || []), ""] })} className="text-[9px] text-gray-500 hover:text-gray-300">+ certification</button>
            </>)}
            {b.type === "liste" && (
              <div>
                {(b.config.items || [""]).map((it: string, j: number) => (
                  <div key={j} className="mb-1"><FInp label="" value={it} onChange={v => { const items = [...(b.config.items || [""])]; items[j] = v; updateBloc(i, { items }); }} /></div>
                ))}
                <button onClick={() => updateBloc(i, { items: [...(b.config.items || []), ""] })} className="text-[9px] text-gray-500 hover:text-gray-300">+ élément</button>
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
            className="text-[9px] px-2 py-1 rounded-lg border border-dashed border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-300 flex items-center gap-1">
            <Plus size={9} /> {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Panel Couleurs ───────────────────────────────────────────────────────────
function PanelCouleurs({ config, setColors }: any) {
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
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Palettes prêtes à l'emploi</p>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map(p=>(
            <button key={p.l} onClick={()=>setColors(p.c)} className="group flex flex-col items-center gap-1.5">
              <div className="w-full h-8 rounded-lg overflow-hidden flex border border-gray-200 group-hover:border-[#F5A623]/50 transition-all">
                <div className="flex-1" style={{backgroundColor:p.c.fond}} />
                <div className="flex-1" style={{backgroundColor:p.c.accent}} />
                <div className="flex-1" style={{backgroundColor:p.c.surface}} />
              </div>
              <span className="text-[9px] text-gray-500 group-hover:text-[#F5A623] transition-colors">{p.l}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Panel Typographie ────────────────────────────────────────────────────────
function PanelTypo({ config, setFonts }: any) {
  const cats = [...new Set(FONTS.map(f=>f.cat))];
  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Police des titres</p>
        {cats.map(cat=>(
          <div key={cat}>
            <p className="text-[9px] text-gray-600 uppercase tracking-wider px-1 py-1">{cat}</p>
            {FONTS.filter(f=>f.cat===cat).map(f=>(
              <button key={f.v} onClick={()=>setFonts({titre:f.v})} className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between ${config.fonts.titre===f.v?"bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/30":"text-gray-400 hover:bg-gray-100 hover:text-gray-300"}`}>
                <span>{f.label}</span>
                {config.fonts.titre===f.v && <Check size={10}/>}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 pt-4">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Police du corps</p>
        {FONTS.filter(f=>f.cat==="Sans-serif").map(f=>(
          <button key={f.v} onClick={()=>setFonts({corps:f.v})} className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between ${config.fonts.corps===f.v?"bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/30":"text-gray-400 hover:bg-gray-100"}`}>
            <span>{f.label}</span>{config.fonts.corps===f.v && <Check size={10}/>}
          </button>
        ))}
      </div>
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Paramètres</p>
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
function PanelLayout({ config, setLayout, set }: any) {
  const lay = config.layout || {};
  const RADII = [{v:"0px",l:"Aucun"},{v:"4px",l:"Légèrement"},{v:"8px",l:"Doux"},{v:"12px",l:"Standard"},{v:"16px",l:"Arrondi"},{v:"24px",l:"Pilule"},{v:"9999px",l:"Cercle"}];
  return (
    <div className="p-4 space-y-5">
      <div className="space-y-3">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Conteneur</p>
        <FSel label="Largeur max" value={lay.largeurContainer||"1280px"} onChange={v=>setLayout({largeurContainer:v})} opts={[{v:"1024px",l:"1024px"},{v:"1280px",l:"1280px"},{v:"1440px",l:"1440px"},{v:"1600px",l:"1600px"},{v:"100%",l:"Pleine largeur"}]} />
        <FSel label="Padding sections" value={lay.paddingSection||"lg"} onChange={v=>setLayout({paddingSection:v})} opts={[{v:"sm",l:"Compact (2rem)"},{v:"md",l:"Normal (4rem)"},{v:"lg",l:"Large (6rem)"},{v:"xl",l:"XL (8rem)"}]} />
      </div>
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Produits</p>
        <FSel label="Colonnes desktop" value={String(lay.colonnesProduits||4)} onChange={v=>setLayout({colonnesProduits:Number(v)})} opts={[{v:"2",l:"2"},{v:"3",l:"3"},{v:"4",l:"4"},{v:"5",l:"5"}]} />
        <FSel label="Colonnes mobile" value={String(lay.colonnesMobile||2)} onChange={v=>setLayout({colonnesMobile:Number(v)})} opts={[{v:"1",l:"1"},{v:"2",l:"2"}]} />
        <FSel label="Style des cartes" value={lay.styleCarte||"shadow"} onChange={v=>setLayout({styleCarte:v})} opts={[{v:"shadow",l:"Ombre portée"},{v:"bordered",l:"Bordure"},{v:"flat",l:"Flat (sans relief)"},{v:"lifted",l:"Surélevé au survol"}]} />
      </div>
      <div className="border-t border-gray-200 pt-4">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Coins arrondis</p>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {RADII.map(r=>(
            <button key={r.v} onClick={()=>set((p: ThemeConfig)=>({...p,radius:r.v}))} className={`flex flex-col items-center gap-1 p-2 border transition-all ${config.radius===r.v?"border-[#F5A623] bg-[#F5A623]/10":"border-gray-200 hover:border-gray-300"}`} style={{borderRadius:r.v==="0px"?"4px":r.v==="9999px"?"50%":r.v}}>
              <div className="w-4 h-4 border-2 border-current opacity-60" style={{borderRadius:r.v==="9999px"?"50%":r.v}} />
              <span className="text-[8px] text-gray-500">{r.l}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="number" min={0} max={999} value={parseInt(config.radius)||0} onChange={e=>set((p: ThemeConfig)=>({...p,radius:`${e.target.value}px`}))} className="w-16 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-[#F5A623]/50" />
          <span className="text-xs text-gray-600">px (custom)</span>
        </div>
      </div>
      <div className="border-t border-gray-200 pt-4 space-y-1.5">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-2">Ombres</p>
        {[{v:"none",l:"Aucune"},{v:"sm",l:"Légère"},{v:"md",l:"Moyenne"},{v:"lg",l:"Forte"},{v:"xl",l:"Très forte"}].map(o=>(
          <button key={o.v} onClick={()=>setLayout({ombre:o.v})} className={`w-full text-left px-3 py-2 rounded-lg text-xs flex justify-between ${(lay.ombre||"md")===o.v?"bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/30":"text-gray-400 hover:bg-gray-100"}`}>
            <span>{o.l}</span>{(lay.ombre||"md")===o.v&&<Check size={10}/>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Panel Médias ─────────────────────────────────────────────────────────────
function PanelMedias({ config, setSection, updateCustomSection }: any) {
  const sec = config.sections as any;
  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-[10px] text-gray-600 mb-4 leading-relaxed">Gérez les images et vidéos de chaque section. Utilisez des URLs directes (CDN, Cloudinary, Unsplash, etc.).</p>

        <div className="space-y-4">
          {/* Hero */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><ImageIcon size={12} /> Hero — Image de fond</p>
            <p className="text-[9px] text-gray-600">L'image de fond principale (bannière boutique) se configure dans <Link href="/dashboard/boutique" className="text-[#F5A623] underline">Ma boutique → Médias</Link></p>
            {sec.hero?.style === "slideshow" && (
              <div>
                <p className="text-[10px] text-gray-500 mb-2">Images du diaporama</p>
                {(sec.hero.slideshowImages||[""]).map((url: string, i: number) => (
                  <div key={i} className="flex gap-1 mb-1.5 items-center">
                    <FInp label="" value={url} onChange={v=>{ const imgs=[...(sec.hero.slideshowImages||[""])]; imgs[i]=v; setSection("hero",{slideshowImages:imgs}); }} />
                    {url && <img src={url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 border border-gray-200" onError={e=>(e.currentTarget.style.display="none")} />}
                  </div>
                ))}
                <button onClick={()=>setSection("hero",{slideshowImages:[...(sec.hero.slideshowImages||[""]),""]})} className="w-full text-[10px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1 hover:border-gray-300">+ Ajouter</button>
              </div>
            )}
          </div>

          {/* À propos */}
          {sec.about?.actif && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><BookOpen size={12} /> Notre histoire — Image</p>
              <FInp label="URL" value={sec.about?.imageUrl||""} onChange={v=>setSection("about",{imageUrl:v})} />
              {sec.about?.imageUrl && <img src={sec.about.imageUrl} alt="" className="w-full h-20 rounded-lg object-cover border border-gray-200" onError={e=>(e.currentTarget.style.display="none")} />}
            </div>
          )}

          {/* Bannière promo */}
          {sec.promo?.actif && sec.promo?.style === "image" && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><Target size={12} /> Bannière promo — Image</p>
              <FInp label="URL" value={sec.promo?.imageUrl||""} onChange={v=>setSection("promo",{imageUrl:v})} />
            </div>
          )}

          {/* Custom sections with images/video */}
          {(config.customSections||[]).filter((s: any) => ["gallery","video","brands"].includes(s.type)).map((s: any) => (
            <div key={s.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700">{s.label}</p>
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
                  <button onClick={()=>updateCustomSection(s.id,{images:[...(s.config.images||[]),""]})} className="w-full text-[10px] text-gray-500 border border-dashed border-gray-200 rounded-lg py-1 hover:border-gray-300">+ Ajouter</button>
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
function PanelAnimations({ config, setAnim }: any) {
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
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Présets d'animation</p>
        <div className="space-y-1.5">
          {PRESETS.map(p => (
            <button key={p.v} onClick={() => { setAnim({ preset: p.v, ...PRESETS_SETTINGS[p.v] }); }}
              className={`w-full text-left p-3 rounded-xl border transition-all ${(anim.preset||"elegant")===p.v?"border-[#F5A623]/50 bg-[#F5A623]/10":"border-gray-200 hover:border-gray-300"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">{p.l}</span>
                {(anim.preset||"elegant")===p.v && <Check size={11} className="text-[#F5A623]" />}
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Personnalisation</p>
        <FSel label="Animation globale" value={anim.global||"slide-up"} onChange={v=>setAnim({global:v})} opts={[
          {v:"none",l:"Aucune"},{v:"fade-in",l:"Fondu"},{v:"slide-up",l:"Glissement vers le haut"},
          {v:"slide-left",l:"Glissement depuis la gauche"},{v:"zoom-in",l:"Zoom entrant"},
          {v:"flip",l:"Retournement 3D"},{v:"blur-in",l:"Apparition floue"},
        ]} />
        <FSel label="Vitesse" value={anim.vitesse||"normal"} onChange={v=>setAnim({vitesse:v})} opts={[{v:"fast",l:"Rapide (0.4s)"},{v:"normal",l:"Normal (0.6s)"},{v:"slow",l:"Lent (0.9s)"}]} />
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Effets avancés</p>
        <FCheck label="Décalage entre sections (stagger)" checked={anim.stagger!==false} onChange={v=>setAnim({stagger:v})} />
        <FCheck label="Effet parallaxe sur le hero" checked={anim.parallax||false} onChange={v=>setAnim({parallax:v})} />
        <FCheck label="Défilement fluide (smooth scroll)" checked={anim.smoothScroll!==false} onChange={v=>setAnim({smoothScroll:v})} />
      </div>

      <div className="border-t border-gray-200 pt-4">
        <p className="text-[9px] text-gray-600 leading-relaxed">Les animations sont appliquées via CSS injecté dans votre boutique. Sauvegardez pour voir le résultat en prévisualisation.</p>
      </div>
    </div>
  );
}

// ─── Panel Boutons & Nav ──────────────────────────────────────────────────────
function PanelBoutons({ config, setBoutons, setNavStyle }: any) {
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
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Style des boutons</p>
        <div className="space-y-1.5">
          {[{v:"filled",l:"Plein"},{v:"outlined",l:"Contour"},{v:"ghost",l:"Fantôme"},{v:"pill",l:"Pilule (arrondi total)"},{v:"square",l:"Carré (sans arrondi)"}].map(s=>(
            <button key={s.v} onClick={()=>setBoutons({style:s.v})} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${(b.style||"filled")===s.v?"border-[#F5A623]/50 bg-[#F5A623]/10":"border-gray-200 hover:border-gray-300"}`}>
              <span className="text-xs text-gray-300">{s.l}</span>
              <div className="w-16 h-6 flex items-center justify-center text-[9px] font-semibold border"
                style={{ backgroundColor: ["outlined","ghost"].includes(s.v)?"transparent":config.colors.accent, color: ["outlined","ghost"].includes(s.v)?config.colors.accent:config.colors.fond, borderColor: s.v!=="ghost"?config.colors.accent:"transparent", borderRadius: s.v==="pill"?"999px":s.v==="square"?"0":"8px", textDecoration: s.v==="ghost"?"underline":"none" }}>
                Acheter
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Taille & effet</p>
        <div className="grid grid-cols-4 gap-1.5">
          {[{v:"sm",l:"XS"},{v:"md",l:"M"},{v:"lg",l:"L"},{v:"xl",l:"XL"}].map(s=>(
            <button key={s.v} onClick={()=>setBoutons({taille:s.v})} className={`py-2 rounded-xl text-xs font-semibold border transition-all ${(b.taille||"md")===s.v?"border-[#F5A623]/50 bg-[#F5A623]/10 text-[#F5A623]":"border-gray-200 text-gray-500 hover:border-gray-300"}`}>{s.l}</button>
          ))}
        </div>
        <FSel label="Effet au survol" value={b.hover||"scale"} onChange={v=>setBoutons({hover:v})} opts={[{v:"lighten",l:"Éclaircir"},{v:"darken",l:"Assombrir"},{v:"scale",l:"Agrandir"},{v:"glow",l:"Lueur (glow)"},{v:"slide",l:"Glissement"}]} />
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Type de navigation</p>
        <div className="space-y-1.5">
          {NAV_TYPES.map(t=>(
            <button key={t.v} onClick={()=>setNavStyle({type:t.v})} className={`w-full text-left p-3 rounded-xl border transition-all ${(nav.type||"classic")===t.v?"border-[#F5A623]/50 bg-[#F5A623]/10":"border-gray-200 hover:border-gray-300"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">{t.l}</span>
                {(nav.type||"classic")===t.v && <Check size={10} className="text-[#F5A623]"/>}
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Style navbar</p>
        <FSel label="Apparence" value={nav.style||"light"} onChange={v=>setNavStyle({style:v})} opts={[{v:"light",l:"Claire (fond blanc)"},{v:"dark",l:"Sombre (fond noir)"},{v:"glass",l:"Verre (glassmorphism)"},{v:"transparent",l:"Transparente"}]} />
        <FSel label="Hauteur" value={nav.hauteur||"64px"} onChange={v=>setNavStyle({hauteur:v})} opts={[{v:"48px",l:"Compact (48px)"},{v:"64px",l:"Standard (64px)"},{v:"80px",l:"Large (80px)"}]} />
        <FCheck label="Navigation fixe (sticky)" checked={nav.sticky!==false} onChange={v=>setNavStyle({sticky:v})} />
        <FCheck label="Barre de recherche" checked={nav.showSearch!==false} onChange={v=>setNavStyle({showSearch:v})} />
        <FCheck label="Wishlist / favoris" checked={nav.showWishlist||false} onChange={v=>setNavStyle({showWishlist:v})} />
      </div>
    </div>
  );
}

// ─── Panel Avancé ─────────────────────────────────────────────────────────────
function PanelAvance({ config, set, tenant, onReset }: any) {
  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-2">CSS personnalisé</p>
        <p className="text-[9px] text-gray-600 mb-3 leading-relaxed">Injecté dans toutes les pages de votre boutique. Utilisez les classes Tailwind ou du CSS natif.</p>
        <textarea value={config.customCss||""} onChange={e=>set((p: ThemeConfig)=>({...p,customCss:e.target.value}))} rows={14}
          placeholder={`/* Exemples */\n.hero h1 { letter-spacing: 0.05em; }\n.product-card { transition: all 0.4s; }\n\n/* Variables CSS */\n:root {\n  --radius-custom: 20px;\n}`}
          className="w-full bg-[#080810] border border-gray-200 rounded-xl px-3 py-3 text-xs text-green-400 font-mono focus:outline-none focus:border-[#F5A623]/50 resize-none leading-relaxed" />
      </div>
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-3">Actions</p>
        <Link href="/dashboard/themes" className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 text-xs text-gray-400 hover:text-gray-300 transition-all">
          <span>Changer de thème de base</span><ChevronRight size={12}/>
        </Link>
        <Link href="/dashboard/boutique" className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 text-xs text-gray-400 hover:text-gray-300 transition-all">
          <span>Logo, bannière & SEO</span><ChevronRight size={12}/>
        </Link>
        <button onClick={() => { if (typeof navigator !== "undefined") navigator.clipboard.writeText(JSON.stringify(config, null, 2)); }} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 text-xs text-gray-400 hover:text-gray-300 transition-all">
          <span>Exporter la config JSON</span><Copy size={11}/>
        </button>
        <button onClick={onReset} className="w-full px-3 py-2.5 rounded-xl border border-red-500/20 hover:border-red-400/40 text-xs text-red-500/60 hover:text-red-400 transition-all">
          Réinitialiser toutes les personnalisations
        </button>
      </div>
    </div>
  );
}

// ─── Panel Fiche Produit — Shopify-style section editor ──────────────────────
const BUILTIN_TYPES = new Set(["gallery","info","variants","quantity","trust","description","reviews","similar"]);

const PRODUIT_SECTION_META: Record<string, { label: string; Icon: any }> = {
  gallery:      { label: "Galerie photos",           Icon: ImageIcon },
  info:         { label: "Infos produit",            Icon: FileText },
  variants:     { label: "Variantes",                Icon: Layers },
  quantity:     { label: "Quantité & panier",        Icon: ShoppingCart },
  trust:        { label: "Badges confiance",         Icon: Shield },
  description:  { label: "Description",              Icon: BookOpen },
  reviews:      { label: "Avis clients",             Icon: Star },
  similar:      { label: "Produits similaires",      Icon: LayoutGrid },
  richtext:     { label: "Texte libre",              Icon: FileText },
  features:     { label: "Points forts",             Icon: Zap },
  howto:        { label: "Mode d'emploi",            Icon: BookOpen },
  banner:       { label: "Bannière image",           Icon: ImageIcon },
  video:        { label: "Vidéo",                    Icon: Video },
  faq:          { label: "FAQ produit",              Icon: HelpCircle },
  specs:        { label: "Caractéristiques",         Icon: BarChart3 },
  ingredients:  { label: "Ingrédients / Matières",  Icon: FileText },
  testimonials: { label: "Témoignages",              Icon: MessageCircle },
  sizeguide:    { label: "Guide des tailles",        Icon: ArrowUpDown },
  guarantee:    { label: "Garantie & SAV",           Icon: Shield },
  bundle:       { label: "Pack / Bundle",            Icon: Layers },
  comparison:   { label: "Tableau comparatif",       Icon: LayoutGrid },
  countdown:    { label: "Compte à rebours",         Icon: Timer },
  social:       { label: "Partage social",           Icon: Share2 },
};

const PRODUIT_LIBRARY = [
  { type: "richtext",      label: "Texte libre",           Icon: FileText,      desc: "Bloc de texte avec titre et bouton CTA" },
  { type: "features",      label: "Points forts",          Icon: Zap,           desc: "Grille d'avantages avec icône et description" },
  { type: "howto",         label: "Mode d'emploi",         Icon: BookOpen,      desc: "Étapes numérotées pour utiliser le produit" },
  { type: "banner",        label: "Bannière image",        Icon: ImageIcon,     desc: "Image pleine largeur avec texte overlay" },
  { type: "video",         label: "Vidéo",                 Icon: Video,         desc: "YouTube, Vimeo ou fichier mp4" },
  { type: "faq",           label: "FAQ produit",           Icon: HelpCircle,    desc: "Questions fréquentes sur le produit" },
  { type: "specs",         label: "Caractéristiques",      Icon: BarChart3,     desc: "Tableau des spécifications techniques" },
  { type: "ingredients",   label: "Ingrédients / Matières",Icon: FileText,      desc: "Liste détaillée de composition" },
  { type: "testimonials",  label: "Témoignages",           Icon: MessageCircle, desc: "Citations et avis clients mis en avant" },
  { type: "sizeguide",     label: "Guide des tailles",     Icon: ArrowUpDown,   desc: "Tableau de correspondance des tailles" },
  { type: "guarantee",     label: "Garantie & SAV",        Icon: Shield,        desc: "Informations garantie et service client" },
  { type: "bundle",        label: "Pack / Bundle",         Icon: Layers,        desc: "Produits fréquemment achetés ensemble" },
  { type: "comparison",    label: "Tableau comparatif",    Icon: LayoutGrid,    desc: "Comparez avec d'autres versions ou concurrents" },
  { type: "countdown",     label: "Compte à rebours",      Icon: Timer,         desc: "Urgence pour une offre limitée" },
  { type: "social",        label: "Partage social",        Icon: Share2,        desc: "Boutons Facebook, WhatsApp, lien copie" },
];

const LAYOUT_OPTIONS = [
  { v: "amazon",    l: "Amazon",         desc: "Galerie gauche · infos droite · sticky · zoom hover" },
  { v: "classic",   l: "Classique",      desc: "Image en haut · infos en dessous" },
  { v: "minimal",   l: "Minimal",        desc: "Épuré, sans sidebar — idéal pour les services" },
  { v: "fullwidth", l: "Pleine largeur", desc: "Image en plein écran avec overlay d'infos" },
];

const STYLE_DISABLED_TYPES = new Set(["gallery", "info", "variants", "quantity", "trust"]);

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
      <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.16em]">Style de la section</p>
      <div className="flex items-center justify-between py-1">
        <span className="text-[11px] text-gray-400">Fond coloré</span>
        <button onClick={() => up({ bgColor: bgActive ? undefined : "#F8F8F6" })} className="flex-shrink-0">
          {bgActive ? <ToggleRight size={17} style={{ color: "#F5A623" }} /> : <ToggleLeft size={17} className="text-gray-700" />}
        </button>
      </div>
      {bgActive && <FCol label="Couleur de fond" value={st.bgColor || "#F8F8F6"} onChange={v => up({ bgColor: v })} />}
      <FCol label="Couleur du texte" value={st.textColor || "#111111"} onChange={v => up({ textColor: v })} />
      <FSel label="Espacement vertical" value={st.paddingY || "none"} onChange={v => up({ paddingY: v as any })} opts={[
        { v: "none", l: "Aucun" }, { v: "sm", l: "Petit" }, { v: "md", l: "Moyen" }, { v: "lg", l: "Grand" }, { v: "xl", l: "Très grand" },
      ]} />
      <FSel label="Largeur du contenu" value={st.maxWidth || "full"} onChange={v => up({ maxWidth: v as any })} opts={[
        { v: "full", l: "Pleine largeur" }, { v: "medium", l: "Moyenne" }, { v: "narrow", l: "Étroite" },
      ]} />
      <FSel label="Alignement" value={st.align || "left"} onChange={v => up({ align: v as any })} opts={[
        { v: "left", l: "Gauche" }, { v: "center", l: "Centré" },
      ]} />
    </div>
  );
}

function SectionTypeSettings({ section, update }: { section: ProductPageSection; update: (id: string, patch: Record<string, any>) => void }) {
  const c = section.config;
  const up = (patch: Record<string, any>) => update(section.id, patch);

  if (section.type === "gallery") return (
    <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2.5">
      <FSel label="Style de galerie" value={c.style || "vertical-thumbs"} onChange={v => up({ style: v })} opts={[
        { v: "vertical-thumbs", l: "Miniatures verticales (Amazon)" },
        { v: "horizontal-thumbs", l: "Miniatures horizontales" },
        { v: "dots", l: "Points" },
      ]} />
      <div className="flex items-center justify-between py-1">
        <span className="text-[11px] text-gray-400">Zoom au survol</span>
        <button onClick={() => up({ zoom: c.zoom === false ? true : false })} className="flex-shrink-0">
          {c.zoom !== false ? <ToggleRight size={17} style={{ color: "#F5A623" }} /> : <ToggleLeft size={17} className="text-gray-700" />}
        </button>
      </div>
      <div className="flex items-center justify-between py-1">
        <span className="text-[11px] text-gray-400">Panneau fixe au scroll</span>
        <button onClick={() => up({ sticky: c.sticky === false ? true : false })} className="flex-shrink-0">
          {c.sticky !== false ? <ToggleRight size={17} style={{ color: "#F5A623" }} /> : <ToggleLeft size={17} className="text-gray-700" />}
        </button>
      </div>
    </div>
  );

  if (section.type === "info") return (
    <div className="px-3 pb-3 space-y-0 border-t border-gray-200 pt-2.5">
      {[
        { key: "breadcrumbs", label: "Fil d'Ariane" },
        { key: "badges",      label: "Badges promo" },
        { key: "stock",       label: "Indicateur de stock" },
      ].map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between py-1.5">
          <span className="text-[11px] text-gray-400">{label}</span>
          <button onClick={() => up({ [key]: c[key] === false ? true : false })} className="flex-shrink-0">
            {c[key] !== false ? <ToggleRight size={17} style={{ color: "#F5A623" }} /> : <ToggleLeft size={17} className="text-gray-700" />}
          </button>
        </div>
      ))}
    </div>
  );

  if (section.type === "description") return (
    <div className="px-3 pb-3 border-t border-gray-200 pt-2.5">
      <div className="flex items-center justify-between py-1.5">
        <span className="text-[11px] text-gray-400">Description IA</span>
        <button onClick={() => up({ ai: c.ai === false ? true : false })} className="flex-shrink-0">
          {c.ai !== false ? <ToggleRight size={17} style={{ color: "#F5A623" }} /> : <ToggleLeft size={17} className="text-gray-700" />}
        </button>
      </div>
    </div>
  );

  if (section.type === "similar") return (
    <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2.5">
      <FInp label="Titre de section" value={c.titre || "Vous aimerez aussi"} onChange={v => up({ titre: v })} />
      <FSel label="Nombre de produits" value={String(c.count || 4)} onChange={v => up({ count: Number(v) })} opts={[
        { v: "4", l: "4 produits" }, { v: "6", l: "6 produits" }, { v: "8", l: "8 produits" },
      ]} />
    </div>
  );

  if (section.type === "richtext") return (
    <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2.5">
      <FInp label="Titre" value={c.titre || ""} onChange={v => up({ titre: v })} />
      <FInp label="Texte" value={c.texte || ""} onChange={v => up({ texte: v })} multiline />
      <FInp label="Bouton CTA (vide = masqué)" value={c.ctaTexte || ""} onChange={v => up({ ctaTexte: v })} />
    </div>
  );

  if (section.type === "banner") return (
    <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2.5">
      <FInp label="Titre" value={c.titre || ""} onChange={v => up({ titre: v })} />
      <FInp label="Texte" value={c.texte || ""} onChange={v => up({ texte: v })} multiline />
      <FInp label="URL de l'image" value={c.imageUrl || ""} onChange={v => up({ imageUrl: v })} />
      <FInp label="Texte du bouton" value={c.ctaTexte || ""} onChange={v => up({ ctaTexte: v })} />
    </div>
  );

  if (section.type === "video") return (
    <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2.5">
      <FInp label="Titre (optionnel)" value={c.titre || ""} onChange={v => up({ titre: v })} />
      <FInp label="URL (YouTube, Vimeo, .mp4)" value={c.videoUrl || ""} onChange={v => up({ videoUrl: v })} />
      <div className="flex items-center justify-between py-1">
        <span className="text-[11px] text-gray-400">Lecture automatique</span>
        <button onClick={() => up({ autoplay: !c.autoplay })} className="flex-shrink-0">
          {c.autoplay ? <ToggleRight size={17} style={{ color: "#F5A623" }} /> : <ToggleLeft size={17} className="text-gray-700" />}
        </button>
      </div>
    </div>
  );

  if (section.type === "faq") return (
    <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2.5">
      <FInp label="Titre" value={c.titre || ""} onChange={v => up({ titre: v })} />
      {(c.items || []).map((item: any, i: number) => (
        <div key={i} className="bg-gray-50 rounded-xl p-2 space-y-1.5">
          <div className="flex gap-1.5">
            <div className="flex-1 space-y-1.5 min-w-0">
              <FInp label="Question" value={item.question} onChange={v => { const it=[...c.items]; it[i]={...it[i],question:v}; up({ items: it }); }} />
              <FInp label="Réponse" value={item.reponse} onChange={v => { const it=[...c.items]; it[i]={...it[i],reponse:v}; up({ items: it }); }} multiline />
            </div>
            <button onClick={() => up({ items: c.items.filter((_: any, j: number) => j !== i) })} className="text-red-500/40 hover:text-red-400 flex-shrink-0 mt-5"><Trash2 size={11} /></button>
          </div>
        </div>
      ))}
      <button onClick={() => up({ items: [...(c.items || []), { question: "Question ?", reponse: "Réponse ici." }] })}
        className="w-full text-[10px] text-gray-600 border border-dashed border-gray-200 rounded-lg py-1.5 hover:border-gray-300 transition-colors">
        + Ajouter une question
      </button>
    </div>
  );

  if (section.type === "specs") return (
    <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2.5">
      <FInp label="Titre" value={c.titre || ""} onChange={v => up({ titre: v })} />
      {(c.rows || []).map((row: any, i: number) => (
        <div key={i} className="flex gap-1.5 items-end">
          <div className="flex-1 min-w-0">
            <FInp label={i === 0 ? "Clé" : ""} value={row.cle} onChange={v => { const r=[...c.rows]; r[i]={...r[i],cle:v}; up({ rows: r }); }} />
          </div>
          <div className="flex-1 min-w-0">
            <FInp label={i === 0 ? "Valeur" : ""} value={row.valeur} onChange={v => { const r=[...c.rows]; r[i]={...r[i],valeur:v}; up({ rows: r }); }} />
          </div>
          <button onClick={() => up({ rows: c.rows.filter((_: any, j: number) => j !== i) })} className="text-red-500/40 hover:text-red-400 flex-shrink-0 mb-1.5"><Trash2 size={11} /></button>
        </div>
      ))}
      <button onClick={() => up({ rows: [...(c.rows || []), { cle: "", valeur: "" }] })}
        className="w-full text-[10px] text-gray-600 border border-dashed border-gray-200 rounded-lg py-1.5 hover:border-gray-300 transition-colors">
        + Ajouter une ligne
      </button>
    </div>
  );

  if (section.type === "countdown") return (
    <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-2.5">
      <FInp label="Titre" value={c.titre || ""} onChange={v => up({ titre: v })} />
      <FInp label="Sous-texte" value={c.texte || ""} onChange={v => up({ texte: v })} multiline />
      <div>
        <label className="block text-[10px] text-gray-500 mb-1">Date de fin</label>
        <input type="datetime-local" value={c.dateFin || ""} onChange={e => up({ dateFin: e.target.value })}
          className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-[11px] text-white focus:outline-none focus:border-[#F5A623]/50 transition-colors" />
      </div>
      <FInp label="Texte du bouton" value={c.ctaTexte || ""} onChange={v => up({ ctaTexte: v })} />
    </div>
  );

  return null;
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

function PanelPageSections({ config, set, pageKey, titre }: { config: ThemeConfig; set: any; pageKey: "aboutPage" | "contactPage"; titre: string }) {
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
          <p className="text-[11px] font-semibold text-gray-700">Afficher la page {titre}</p>
          <button onClick={() => setPage({ actif: !page.actif })}>
            {page.actif ?? true ? <ToggleRight size={18} style={{ color: "#F5A623" }} /> : <ToggleLeft size={18} className="text-gray-400" />}
          </button>
        </div>
        {pageKey === "contactPage" && (
          <>
            <FInp label="Texte d'introduction" value={page.intro || ""} onChange={v => setPage({ intro: v })} multiline />
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-gray-700">Formulaire de contact</p>
              <button onClick={() => setPage({ afficherFormulaire: !(page.afficherFormulaire ?? true) })}>
                {(page.afficherFormulaire ?? true) ? <ToggleRight size={18} style={{ color: "#F5A623" }} /> : <ToggleLeft size={18} className="text-gray-400" />}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200">
        <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.18em]">Blocs de contenu</p>
        <button onClick={() => setShowLibrary(true)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all" style={{ backgroundColor: "#F5A623", color: "#050508" }}>
          <Plus size={9} /> Ajouter
        </button>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {sections.length === 0 && (
          <p className="p-4 text-[11px] text-gray-500 leading-relaxed">Aucun bloc pour l'instant — clique sur "Ajouter" pour composer cette page (texte, chiffres clés, galerie...).</p>
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
                  <p className="text-[11px] font-semibold text-gray-700 truncate">{sec.label}</p>
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

function PanelProduit({ config, setProductPage }: any) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const pp = config.productPage || {};
  const layout: string = pp.layout || "amazon";
  const sections: ProductPageSection[] = pp.sections?.length ? pp.sections : DEFAULT_PRODUCT_SECTIONS;

  const setSections = (newSections: ProductPageSection[]) => setProductPage({ sections: newSections });

  const reorderSection = (from: number, to: number) => {
    if (from === to) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSections(next);
  };

  const toggleSection = (id: string) => setSections(sections.map(s => s.id === id ? { ...s, actif: !s.actif } : s));

  const updateSection = (id: string, patch: Record<string, any>) =>
    setSections(sections.map(s => s.id === id ? { ...s, config: { ...s.config, ...patch } } : s));

  const updateSectionStyle = (id: string, patch: Record<string, any>) =>
    setSections(sections.map(s => s.id === id ? { ...s, style: { ...s.style, ...patch } } : s));

  const addSection = (type: string) => {
    const defaults: Record<string, any> = {
      richtext:     { titre: "Notre engagement", texte: "Votre texte ici.", ctaTexte: "" },
      features:     { titre: "Pourquoi choisir ce produit ?", items: [{ icone: "✓", titre: "Qualité premium", texte: "Matériaux soigneusement sélectionnés." }, { icone: "⚡", titre: "Livraison rapide", texte: "Expédié en 24-48h." }, { icone: "♻️", titre: "Éco-responsable", texte: "Fabriqué de façon durable." }] },
      howto:        { titre: "Comment l'utiliser ?", steps: [{ num: "01", titre: "Étape 1", texte: "Description de l'étape ici." }, { num: "02", titre: "Étape 2", texte: "Description de l'étape ici." }, { num: "03", titre: "Étape 3", texte: "Description de l'étape ici." }] },
      banner:       { titre: "Offre spéciale", texte: "", imageUrl: "", ctaTexte: "Profiter maintenant" },
      video:        { titre: "", videoUrl: "", autoplay: false },
      faq:          { titre: "Questions fréquentes", items: [{ question: "Comment utiliser ce produit ?", reponse: "Répondez ici." }] },
      specs:        { titre: "Caractéristiques techniques", rows: [{ cle: "Matière", valeur: "" }, { cle: "Dimensions", valeur: "" }, { cle: "Poids", valeur: "" }] },
      ingredients:  { titre: "Composition", texte: "", items: [{ nom: "Ingrédient 1", desc: "" }, { nom: "Ingrédient 2", desc: "" }] },
      testimonials: { titre: "Ils en parlent", items: [{ nom: "Marie D.", note: 5, texte: "Excellent produit, je recommande !", avatar: "" }, { nom: "Jean K.", note: 5, texte: "Très satisfait de mon achat.", avatar: "" }] },
      sizeguide:    { titre: "Guide des tailles", headers: ["Taille", "Tour de poitrine", "Tour de taille", "Tour de hanches"], rows: [{ cells: ["XS", "80-84 cm", "60-64 cm", "86-90 cm"] }, { cells: ["S", "84-88 cm", "64-68 cm", "90-94 cm"] }, { cells: ["M", "88-92 cm", "68-72 cm", "94-98 cm"] }] },
      guarantee:    { titre: "Notre garantie", items: [{ icone: "🛡️", titre: "Garantie 2 ans", texte: "Pièces et main-d'œuvre couvertes." }, { icone: "🔄", titre: "Retour 30 jours", texte: "Remboursement intégral si insatisfait." }, { icone: "📞", titre: "Support 7j/7", texte: "Notre équipe est là pour vous." }] },
      bundle:       { titre: "Souvent achetés ensemble", items: [{ nom: "Produit complémentaire 1", imageUrl: "", prix: "" }, { nom: "Produit complémentaire 2", imageUrl: "", prix: "" }], ctaTexte: "Tout ajouter au panier" },
      comparison:   { titre: "Comparaison", headers: ["Caractéristique", "Ce produit", "Standard"], rows: [{ cells: ["Qualité", "✓ Premium", "Basique"] }, { cells: ["Garantie", "✓ 2 ans", "6 mois"] }, { cells: ["Support", "✓ Prioritaire", "Email"] }] },
      countdown:    { titre: "Offre limitée", texte: "Ne manquez pas cette opportunité !", dateFin: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16), ctaTexte: "Profiter maintenant" },
      social:       {},
    };
    const id = `custom_${Date.now()}`;
    const newSec: ProductPageSection = { id, type: type as any, actif: true, config: defaults[type] || {} };
    setSections([...sections, newSec]);
    setShowLibrary(false);
    setActiveSection(id);
  };

  const removeSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
    if (activeSection === id) setActiveSection(null);
  };

  // Library view
  if (showLibrary) return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.18em]">Bibliothèque de sections</p>
        <button onClick={() => setShowLibrary(false)} className="text-gray-600 hover:text-gray-400"><X size={13} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {PRODUIT_LIBRARY.map(lib => {
          const Li = lib.Icon;
          return (
            <button key={lib.type} onClick={() => addSection(lib.type)}
              className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-[#F5A623]/40 hover:bg-[#F5A623]/5 transition-all group">
              <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-[#F5A623]/10">
                <Li size={14} className="text-gray-500 group-hover:text-[#F5A623]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-700">{lib.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{lib.desc}</p>
              </div>
              <Plus size={12} className="flex-shrink-0 mt-0.5 text-gray-600 group-hover:text-[#F5A623]" />
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {/* Layout picker */}
        <div className="p-4 border-b border-gray-200">
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.18em] mb-2.5">Mise en page</p>
          <div className="grid grid-cols-2 gap-1.5">
            {LAYOUT_OPTIONS.map(lay => (
              <button key={lay.v} onClick={() => setProductPage({ layout: lay.v })}
                className={`text-left p-2.5 rounded-xl border transition-all ${layout === lay.v ? "border-[#F5A623]/50 bg-[#F5A623]/10" : "border-gray-200 hover:border-gray-300"}`}>
                <p className="text-[11px] font-semibold text-white flex items-center gap-1">
                  {layout === lay.v && <Check size={9} style={{ color: "#F5A623" }} />} {lay.l}
                </p>
                <p className="text-[9px] text-gray-600 mt-0.5 leading-relaxed">{lay.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Section list */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.18em]">Sections de la fiche</p>
            <button onClick={() => setShowLibrary(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all"
              style={{ backgroundColor: "#F5A623", color: "#050508" }}>
              <Plus size={9} /> Ajouter
            </button>
          </div>
          <div className="space-y-1">
            {sections.map((sec, idx) => {
              const meta = PRODUIT_SECTION_META[sec.type];
              const SIcon = meta?.Icon ?? FileText;
              const isActive = activeSection === sec.id;
              const isBuiltIn = BUILTIN_TYPES.has(sec.type);
              return (
                <div key={sec.id}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={e => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx); }}
                  onDragLeave={() => setOverIdx(o => o === idx ? null : o)}
                  onDrop={e => { e.preventDefault(); if (dragIdx !== null) reorderSection(dragIdx, idx); setDragIdx(null); setOverIdx(null); }}
                  onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                  className={`rounded-xl border transition-all ${isActive ? "border-[#F5A623]/30 bg-[#F5A623]/5" : "border-gray-100 bg-gray-50"} ${dragIdx === idx ? "opacity-40" : ""} ${overIdx === idx && dragIdx !== null && dragIdx !== idx ? "ring-2 ring-[#F5A623]/50" : ""}`}>
                  <div className="flex items-center gap-1.5 px-2 py-2">
                    {/* Drag handle */}
                    <div className="cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 flex-shrink-0" title="Glisser pour réordonner">
                      <GripVertical size={13} />
                    </div>
                    {/* Icon */}
                    <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <SIcon size={11} className="text-gray-500" />
                    </div>
                    {/* Label */}
                    <span className={`flex-1 text-[11px] font-medium truncate ${sec.actif ? "text-gray-800" : "text-gray-400"}`}>{meta?.label ?? sec.type}</span>
                    {/* Toggle */}
                    <button onClick={() => toggleSection(sec.id)} className="flex-shrink-0">
                      {sec.actif ? <ToggleRight size={16} style={{ color: "#F5A623" }} /> : <ToggleLeft size={16} className="text-gray-700" />}
                    </button>
                    {/* Delete (custom only) */}
                    {!isBuiltIn && (
                      <button onClick={() => removeSection(sec.id)} className="text-red-500/40 hover:text-red-400 flex-shrink-0 transition-colors"><Trash2 size={11} /></button>
                    )}
                    {/* Expand */}
                    <button onClick={() => setActiveSection(isActive ? null : sec.id)} className="flex-shrink-0 text-gray-600 hover:text-gray-400 transition-colors">
                      <ChevronDown size={12} className="transition-transform" style={{ transform: isActive ? "rotate(180deg)" : "" }} />
                    </button>
                  </div>
                  {isActive && <ProduitSectionSettings section={sec} update={updateSection} updateStyle={updateSectionStyle} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 pb-4">
          <p className="text-[9px] text-gray-600 leading-relaxed">Ces réglages s'appliquent à toutes les fiches produits. Sauvegardez pour voir les changements.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Champs helper ────────────────────────────────────────────────────────────
function FInp({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div>
      {label && <label className="block text-[10px] text-gray-500 mb-1">{label}</label>}
      {multiline
        ? <textarea value={value} onChange={e=>onChange(e.target.value)} rows={2} className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#F5A623]/50 resize-none" />
        : <input value={value} onChange={e=>onChange(e.target.value)} className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#F5A623]/50" />
      }
    </div>
  );
}

function FCol({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[10px] text-gray-400 flex-1 min-w-0 truncate">{label}</label>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <input type="color" value={value} onChange={e=>onChange(e.target.value)} className="w-7 h-7 rounded-lg cursor-pointer border border-gray-300" style={{padding:"1px"}} />
        <input type="text" value={value.toUpperCase()} onChange={e=>{ if(/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value); }} className="w-16 bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-mono text-gray-700 focus:outline-none focus:border-[#F5A623]/50" />
      </div>
    </div>
  );
}

function FSel({ label, value, opts, onChange }: { label: string; value: string; opts: Array<{v:string;l:string}>; onChange: (v: string) => void }) {
  return (
    <div>
      {label && <label className="block text-[10px] text-gray-500 mb-1">{label}</label>}
      <select value={value} onChange={e=>onChange(e.target.value)} className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#F5A623]/50">
        {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function FSli({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-500 mb-1.5">{label}</label>
      <input type="range" min={min} max={max} value={value} onChange={e=>onChange(Number(e.target.value))} className="w-full h-1.5 rounded-full appearance-none bg-gray-100 accent-[#F5A623] cursor-pointer" />
    </div>
  );
}

function FCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-600">{label}</span>
      <button onClick={()=>onChange(!checked)}>
        {checked ? <ToggleRight size={18} style={{color:"#F5A623"}} /> : <ToggleLeft size={18} className="text-gray-600" />}
      </button>
    </div>
  );
}
