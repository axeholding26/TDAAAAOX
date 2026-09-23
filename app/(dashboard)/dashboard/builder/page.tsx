"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { PCOnlyGate } from "@/components/dashboard/PCOnlyGate";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
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
import { resolveThemeConfig, mergeThemeConfig, type ThemeConfig, type CustomSection, DEFAULT_PRODUCT_SECTIONS, type ProductPageSection } from "@/lib/theme-config";
import { FONTS } from "@/lib/theme-fonts";
import { MANIFESTE_LIBRAIRIE } from "@/lib/axso-design-manifest";
import { BuilderCanvas } from "./canvas/BuilderCanvas";
import { DigitalBuilder } from "./digital/DigitalBuilder";
import { BoutiqueBuilder } from "./boutique/BoutiqueBuilder";
import { PanelCouleurs, PanelTypo, PanelLayout, PanelMedias, PanelAnimations, PanelBoutons, PanelModeles, PanelAvance, PanelPageSections, PanelProduit } from "./panels";

type Device = "desktop" | "tablet" | "mobile";
type Panel = "sections" | "couleurs" | "typo" | "layout" | "medias" | "animations" | "boutons" | "avance" | "produit" | "apropos" | "contact" | "themes";

const BUILDER_TUTORIAL_STEPS = [
  { Icon: LayoutGrid, titre: "Tes sections, à gauche",          description: "En-tête, Modèle et Pied de page : clique une section pour la modifier, glisse-la pour changer l'ordre, masque-la avec l'œil ou ajoute-en une nouvelle." },
  { Icon: MousePointer2, titre: "Clique directement sur l'aperçu", description: "Une section cliquée dans l'aperçu s'ouvre à droite. Les « + » sur ses bords ajoutent une section juste avant ou après. Les textes de ton design se modifient en cliquant dessus." },
  { Icon: Palette,    titre: "Paramètres du thème",             description: "Couleurs, polices, mise en page, boutons, fiche produit… l'aperçu se met à jour en direct." },
  { Icon: Undo2,      titre: "Annule sans crainte",              description: "Ctrl+Z pour annuler, Ctrl+Y pour rétablir — expérimente librement." },
  { Icon: Monitor,    titre: "Prévisualise sur tous les écrans", description: "Bascule entre ordinateur, tablette et mobile en haut à droite." },
  { Icon: Save,       titre: "Enregistre",                       description: "Tes changements s'enregistrent automatiquement après quelques secondes, ou tout de suite avec « Enregistrer »." },
];

// catalogueOnly : réglages qui ne font sens que pour une boutique catalogue
// (physique) — "Fiche produit" pilote la page produit d'un catalogue
// (miniatures, fil d'Ariane, produits similaires...), des notions qui
// n'existent pas sur une page de vente à un seul produit (landing/digital,
// où le produit EST la page). Masqué en mode landing, pas supprimé : les
// réglages restent en base si le marchand repasse un jour en catalogue.
const NAV_TABS: Array<{ id: Panel; icon: React.ReactNode; tooltip: string; catalogueOnly?: boolean }> = [
  { id: "sections",   icon: <LayoutGrid size={17} />,    tooltip: "Sections" },
  { id: "themes",     icon: <Images size={17} />,        tooltip: "Thèmes", catalogueOnly: true }, // designs AXSO = physique uniquement
  { id: "couleurs",   icon: <Palette size={17} />,       tooltip: "Couleurs" },
  { id: "typo",       icon: <Type size={17} />,          tooltip: "Typographie" },
  { id: "layout",     icon: <LayoutTemplate size={17} />,tooltip: "Mise en page" },
  { id: "medias",     icon: <ImageIcon size={17} />,     tooltip: "Médias" },
  { id: "animations", icon: <Sparkles size={17} />,      tooltip: "Animations" },
  { id: "boutons",    icon: <MousePointer2 size={17} />, tooltip: "Boutons & Nav" },
  { id: "produit",    icon: <ShoppingBag size={17} />,   tooltip: "Fiche produit", catalogueOnly: true },
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
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [publishing, setPublishing]   = useState(false);
  const [manquants, setManquants]     = useState<string[] | null>(null);
  const [infosForm, setInfosForm]     = useState({ nomBoutique: "", whatsapp: "", pays: "", description: "" });
  const [savingInfos, setSavingInfos] = useState(false);

  const debounce    = useRef<NodeJS.Timeout | null>(null);

  const refetchTenant = useCallback(async () => {
    const data = await fetch("/api/tenants/moi-complet").then((r) => r.json());
    if (data.error) return;
    setTenant(data);
    setInfosForm({
      nomBoutique: data.nomBoutique || "", whatsapp: data.whatsapp || "",
      pays: data.pays || "", description: data.description || "",
    });

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

  // ─── Historique annuler / rétablir ──────────────────────────────────────────
  const undoStack   = useRef<ThemeConfig[]>([]);
  const redoStack   = useRef<ThemeConfig[]>([]);
  const skipHistory = useRef(false);
  const lastSnapshot = useRef<ThemeConfig | null>(null);
  const historyTimer = useRef<NodeJS.Timeout | null>(null);
  const [historyTick, setHistoryTick] = useState(0);

  // Miroir de `config` en ref, tenu à jour à chaque rendu — permet à undo/redo
  // de lire la valeur courante sans passer par la forme fonctionnelle de
  // setConfig(current => ...). React (Strict Mode, dev) invoque deux fois les
  // fonctions passées à un setState pour détecter les impuretés ; comme
  // undo/redo mutaient des refs (pop/push sur les piles) DANS cette fonction,
  // chaque clic dépilait deux entrées au lieu d'une, sautant un état d'historique.
  // En lisant/mutant tout AVANT setConfig et en lui passant une valeur brute
  // (jamais une fonction), les mutations de refs ne s'exécutent plus qu'une fois.
  const configRef = useRef<ThemeConfig | null>(config);
  useEffect(() => { configRef.current = config; }, [config]);

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
    const current = configRef.current;
    if (!undoStack.current.length || !current) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(current);
    skipHistory.current = true;
    lastSnapshot.current = prev;
    setHistoryTick(t => t + 1);
    setConfig(prev);
  }, []);

  const redo = useCallback(() => {
    const current = configRef.current;
    if (!redoStack.current.length || !current) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(current);
    skipHistory.current = true;
    lastSnapshot.current = next;
    setHistoryTick(t => t + 1);
    setConfig(next);
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
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeConfig: { ...config, customCss: mergedCss } }),
      });
      // Sans ce garde-fou, une erreur serveur (401, 500, validation) laissait
      // quand même s'afficher "Sauvegardé" et l'aperçu se rechargeait : le
      // marchand croyait avoir publié ses réglages alors que rien n'était
      // enregistré. On ne marque sauvegardé que si l'API a réellement accepté.
      if (!res.ok) return;
      setOriginalConfig(config);
      setSaved(true);
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

  // Calculé côté serveur (lib/boutique-completion.ts, via /api/tenants/moi-complet)
  // à chaque refetchTenant — le bouton "Publier" reste désactivé tant que
  // cette liste n'est pas vide, pas seulement après une tentative ratée.
  const criteresManquants: { cle: string; label: string }[] =
    tenant?.completion && !tenant.completion.prete
      ? tenant.completion.criteres.filter((c: any) => !c.ok)
      : [];

  const publierBoutique = useCallback(async () => {
    setPublishing(true);
    setManquants(null);
    try {
      if (hasChanges) await handleSave();
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "active" }),
      });
      const data = await res.json();
      if (!res.ok) { setManquants(data.manquants || [data.error || "Erreur inconnue"]); return; }
      await refetchTenant();
    } finally { setPublishing(false); }
  }, [handleSave, hasChanges, refetchTenant]);

  const sauvegarderInfos = useCallback(async () => {
    setSavingInfos(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(infosForm),
      });
      if (res.ok) await refetchTenant();
    } finally { setSavingInfos(false); }
  }, [infosForm, refetchTenant]);

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

  // Boutique 100% digitale — Constructeur entièrement séparé (façon
  // Chariow), plus le Constructeur libre par blocs. Toute la plomberie de
  // chargement/sauvegarde/undo ci-dessus reste partagée (même API, même
  // debounce d'auto-save) ; seule l'interface change.
  if (config.modeBoutique === "digital") {
    return (
      <DigitalBuilder
        tenant={tenant} config={config} originalConfig={originalConfig} set={set} setColors={setColors} setFonts={setFonts}
        handleSave={handleSave} saving={saving} saved={saved} hasChanges={!!hasChanges}
      />
    );
  }

  // Un seul constructeur (arbre de blocs, dnd-kit) — plus de bascule
  // classique/libre : les deux anciens modes étaient deux systèmes
  // d'édition non composables (passer en "libre" faisait disparaître
  // l'accès à Couleurs/Typo/Mise en page/etc). L'habillage varie selon le
  // type de boutique (voir BuilderCanvas::variante) : Shopify-like pour le
  // catalogue physique, Chariow/Lovable-like pour la page de vente digitale.
  const varianteConstructeur: "boutique" | "landing" = config.modeBoutique === "vente_unique" ? "landing" : "boutique";

  const bandeaux = (
    <>
      {/* Bandeau "à compléter" — proactif (calculé au chargement), pas seulement
          après une tentative de publication ratée. Permet de tout corriger
          sans quitter le Constructeur. */}
      {tenant.statut === "brouillon" && criteresManquants.length > 0 && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 text-red-700 text-[13px] flex-shrink-0">
          <div className="flex items-start gap-2">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span className="flex-1"><span className="font-semibold">Il manque pour publier :</span> {criteresManquants.map(c => c.label).join(", ")}.</span>
          </div>
          <div className="mt-2 grid sm:grid-cols-2 gap-2 max-w-3xl">
            {criteresManquants.some(c => c.cle === "nomBoutique") && (
              <input value={infosForm.nomBoutique} onChange={e => setInfosForm(f => ({ ...f, nomBoutique: e.target.value }))}
                placeholder="Nom de la boutique" className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-[13px] text-gray-800 outline-none focus:border-red-400" />
            )}
            {criteresManquants.some(c => c.cle === "whatsapp") && (
              <input value={infosForm.whatsapp} onChange={e => setInfosForm(f => ({ ...f, whatsapp: e.target.value }))}
                placeholder="Numéro WhatsApp (+225…)" className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-[13px] text-gray-800 outline-none focus:border-red-400" />
            )}
            {criteresManquants.some(c => c.cle === "pays") && (
              <input value={infosForm.pays} onChange={e => setInfosForm(f => ({ ...f, pays: e.target.value }))}
                placeholder="Pays" className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-[13px] text-gray-800 outline-none focus:border-red-400" />
            )}
            {criteresManquants.some(c => c.cle === "description") && (
              <input value={infosForm.description} onChange={e => setInfosForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description de la boutique" className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-[13px] text-gray-800 outline-none focus:border-red-400 sm:col-span-2" />
            )}
          </div>
          <div className="mt-2 flex items-center gap-3">
            {criteresManquants.some(c => ["nomBoutique","whatsapp","pays","description"].includes(c.cle)) && (
              <button onClick={sauvegarderInfos} disabled={savingInfos}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-all">
                {savingInfos ? "Enregistrement…" : "Enregistrer ces infos"}
              </button>
            )}
            {criteresManquants.some(c => c.cle === "produits") && (
              <Link href="/dashboard/produits" className="text-[12px] font-semibold text-red-700 underline underline-offset-2">
                Ajouter un produit →
              </Link>
            )}
          </div>
        </div>
      )}

      {manquants && (
        <div className="flex items-start gap-2 px-4 py-2 bg-red-50 border-b border-red-100 text-red-700 text-[13px] flex-shrink-0">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Impossible de publier — il manque :</span> {manquants.join(", ")}.
          </div>
          <button onClick={() => setManquants(null)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X size={13} /></button>
        </div>
      )}
    </>
  );

  if (varianteConstructeur === "boutique") {
    return (
      <>
        <BoutiqueBuilder
          tenant={tenant}
          config={config}
          set={set}
          device={device}
          setDevice={setDevice}
          undo={undo}
          redo={redo}
          peutAnnuler={undoStack.current.length > 0}
          peutRetablir={redoStack.current.length > 0}
          handleSave={handleSave}
          saving={saving}
          saved={saved}
          hasChanges={!!hasChanges}
          publier={publierBoutique}
          publishing={publishing}
          criteresManquants={criteresManquants}
          bandeaux={bandeaux}
          onSyncWithServer={syncWithServer}
          modeles={<PanelModeles tenant={tenant} onApplied={refetchTenant} />}
          reglages={[
            { id: "couleurs", label: "Couleurs", desc: "Palette de la boutique", Icon: Palette, contenu: <PanelCouleurs config={config} setColors={setColors} /> },
            { id: "typo", label: "Typographie", desc: "Polices des titres et du texte", Icon: Type, contenu: <PanelTypo config={config} setFonts={setFonts} /> },
            { id: "layout", label: "Mise en page", desc: "Largeur, espacements, cartes produits", Icon: LayoutTemplate, contenu: <PanelLayout config={config} setLayout={setLayout} set={set} /> },
            { id: "boutons", label: "Boutons et navigation", desc: "Style des boutons et du menu", Icon: MousePointer2, contenu: <PanelBoutons config={config} setBoutons={setBoutons} setNavStyle={setNavStyle} /> },
            { id: "animations", label: "Animations", desc: "Apparition des sections", Icon: Sparkles, contenu: <PanelAnimations config={config} setAnim={setAnim} /> },
            { id: "medias", label: "Médias", desc: "Images et vidéos", Icon: ImageIcon, contenu: <PanelMedias config={config} setSection={setSection} updateCustomSection={updateCustomSection} /> },
            { id: "produit", label: "Fiche produit", desc: "Mise en page des pages produits", Icon: ShoppingBag, contenu: <PanelProduit config={config} setProductPage={setProductPage} /> },
            { id: "apropos", label: "Page À propos", desc: "Sections de la page À propos", Icon: Info, contenu: <PanelPageSections config={config} set={set} pageKey="aboutPage" titre="À propos" /> },
            { id: "contact", label: "Page Contact", desc: "Sections de la page Contact", Icon: Phone, contenu: <PanelPageSections config={config} set={set} pageKey="contactPage" titre="Contact" /> },
            { id: "avance", label: "CSS avancé", desc: "Code CSS personnalisé", Icon: Code2, contenu: <PanelAvance config={config} set={set} tenant={tenant} onReset={() => { setConfig({ ...resolveThemeConfig(tenant.themeId) }); }} /> },
          ]}
        />
        <ModuleTutorial moduleKey="builder" titre="Constructeur de boutique" sousTitre="Personnalise ta boutique en direct" steps={BUILDER_TUTORIAL_STEPS} />
      </>
    );
  }

  return (
    <div className={`flex flex-col bg-[#F5F7FA] text-gray-800 overflow-hidden ${isFullscreen ? "fixed inset-0 z-[9999]" : "h-screen"}`} style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <PCOnlyGate label="Le Constructeur de boutique" />
      <ModuleTutorial moduleKey="builder" titre="Constructeur de boutique" sousTitre="Personnalise ta boutique en direct" steps={BUILDER_TUTORIAL_STEPS} />

      {/* HEADER */}
      <header className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-200 flex-shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-gray-400 hover:text-gray-800 transition-colors text-sm">
            <ArrowLeft size={13} /> Dashboard
          </Link>
          <div className="h-4 w-px bg-gray-100" />
          <span className="text-sm text-gray-800 font-medium truncate max-w-32">{tenant.nomBoutique}</span>
          {tenant.statut === "brouillon" && <span className="text-[13px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-500 font-semibold">Brouillon — pas encore publiée</span>}
          {hasChanges && <span className="text-[13px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 animate-pulse">Modifié</span>}
          {saved && <span className="text-[13px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">✓ Sauvegardé</span>}
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700">
          {varianteConstructeur === "landing" ? <Wand2 size={13} /> : <Layers size={13} />}
          {varianteConstructeur === "landing" ? "Constructeur Landing" : "Constructeur Boutique"}
          <BoutonRevoirTutoriel moduleKey="builder" dark />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            <button onClick={undo} disabled={!undoStack.current.length} title="Annuler (Ctrl+Z)"
              className="w-9 h-9 rounded-md flex items-center justify-center transition-all text-gray-600 hover:text-gray-400 disabled:opacity-30 disabled:hover:text-gray-600">
              <Undo2 size={15} />
            </button>
            <button onClick={redo} disabled={!redoStack.current.length} title="Rétablir (Ctrl+Y)"
              className="w-9 h-9 rounded-md flex items-center justify-center transition-all text-gray-600 hover:text-gray-400 disabled:opacity-30 disabled:hover:text-gray-600">
              <Redo2 size={15} />
            </button>
          </div>
          <div className="h-5 w-px bg-gray-100" />
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
            {([["desktop",Monitor],["tablet",Tablet],["mobile",Smartphone]] as [Device, any][]).map(([d,Icon]) => (
              <button key={d} onClick={() => setDevice(d)} className={`w-9 h-9 rounded-md flex items-center justify-center transition-all ${device===d?"bg-[#F5A623]/20 text-[#F5A623]":"text-gray-600 hover:text-gray-400"}`}>
                <Icon size={15} />
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsFullscreen(v => !v)}
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${isFullscreen ? "border-[#F5A623]/50 bg-[#F5A623]/15 text-[#F5A623]" : "border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300"}`}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {tenant.statut !== "brouillon" && (
            <a href={`/${tenant.slug}`} target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 transition-all">
              <ExternalLink size={13} /> Voir
            </a>
          )}
          <button onClick={handleSave} disabled={saving}
            className={`h-9 flex items-center gap-1.5 px-3.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              saved ? "bg-emerald-100 text-emerald-700" : "bg-[#F5A623] text-[#050508] hover:bg-[#e8990f]"
            }`}>
            {saving ? <RefreshCw size={14} className="animate-spin flex-shrink-0" /> : saved ? <Check size={14} className="flex-shrink-0" /> : <Save size={14} className="flex-shrink-0" />}
            <span>{saving ? "Sauvegarde…" : saved ? "Sauvegardé" : "Sauvegarder"}</span>
          </button>
          {tenant.statut === "brouillon" && (
            <button onClick={publierBoutique} disabled={publishing || criteresManquants.length > 0}
              title={criteresManquants.length > 0 ? `Complète d'abord : ${criteresManquants.map(c => c.label).join(", ")}` : undefined}
              className="h-9 flex items-center gap-1.5 px-3.5 rounded-lg text-sm font-semibold transition-colors hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-500 text-white">
              {publishing ? <RefreshCw size={14} className="animate-spin flex-shrink-0" /> : <Rocket size={14} className="flex-shrink-0" />}
              <span>{publishing ? "Publication…" : "Publier ma boutique"}</span>
            </button>
          )}
        </div>
      </header>

      {bandeaux}

      {/* MAIN */}
      <div className="flex-1 flex overflow-hidden">
        {/* Icon sidebar — toujours visible, quel que soit l'onglet actif.
            overflow-y-auto : 12 onglets ne tiennent pas toujours sur un
            écran bas sans défilement (Thèmes/Avancé pouvaient déborder). */}
        <div className="w-12 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1 overflow-y-auto scrollbar-thin">
          {NAV_TABS.filter(t => !(t.catalogueOnly && varianteConstructeur === "landing")).map(t => (
            <button key={t.id} onClick={() => setPanel(t.id)} title={t.tooltip}
              className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center transition-all ${panel===t.id?"bg-[#F5A623]/20 text-[#F5A623]":"text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}>
              {t.icon}
            </button>
          ))}
        </div>

        {/* Le canevas reste TOUJOURS monté — un seul rendu live, jamais de
            deuxième aperçu (iframe) à synchroniser en parallèle. Réglages
            globaux (couleurs, typo...) : remplacent juste la bibliothèque de
            blocs à gauche via leftPanelOverride, l'aperçu au centre reste
            visible et réagit en direct, comme les réglages de thème Shopify.
            N'est jamais atteint pour une boutique digitale (retour anticipé
            vers <DigitalBuilder> plus haut). */}
        <BuilderCanvas
          config={config} set={set} slug={tenant.slug} device={device} onSyncWithServer={syncWithServer} variante={varianteConstructeur}
          leftPanelOverride={panel === "sections" ? undefined : (
            <div className="w-[340px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-200 flex-shrink-0 flex items-center gap-2">
                <button onClick={() => setPanel("sections")} title="Retour au plan de la page" className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
                  <ArrowLeft size={14} />
                </button>
                <p className="text-[12px] font-black text-gray-400 uppercase tracking-[0.18em]">{NAV_TABS.find(t=>t.id===panel)?.tooltip}</p>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin">
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
                {panel === "themes"     && <PanelModeles   tenant={tenant} onApplied={refetchTenant} />}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
