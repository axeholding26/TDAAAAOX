"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";
import { Image as ImageIcon, Save, Monitor, LayoutGrid, Palette, Type, LayoutTemplate, MousePointer2, Code2, Sparkles, X, Undo2, AlertCircle } from "lucide-react";
import { resolveThemeConfig, mergeThemeConfig, type ThemeConfig, DEFAULT_PRODUCT_SECTIONS } from "@/lib/theme-config";
import { DigitalBuilder } from "./digital/DigitalBuilder";
import { BoutiqueBuilder } from "./boutique/BoutiqueBuilder";
import { PanelCouleurs, PanelTypo, PanelLayout, PanelMedias, PanelAnimations, PanelBoutons, PanelModeles, PanelAvance, PanelPageSections, PanelProduit } from "./panels";

type Device = "desktop" | "tablet" | "mobile";

const BUILDER_TUTORIAL_STEPS = [
  { Icon: LayoutGrid, titre: "Tes sections, à gauche",          description: "En-tête, Modèle et Pied de page : clique une section pour la modifier, glisse-la pour changer l'ordre, masque-la avec l'œil ou ajoute-en une nouvelle." },
  { Icon: MousePointer2, titre: "Clique directement sur l'aperçu", description: "Une section cliquée dans l'aperçu s'ouvre à droite. Les « + » sur ses bords ajoutent une section juste avant ou après. Les textes de ton design se modifient en cliquant dessus." },
  { Icon: Palette,    titre: "Paramètres du thème",             description: "Couleurs, polices, mise en page, boutons, fiche produit… l'aperçu se met à jour en direct." },
  { Icon: Undo2,      titre: "Annule sans crainte",              description: "Ctrl+Z pour annuler, Ctrl+Y pour rétablir — expérimente librement." },
  { Icon: Monitor,    titre: "Prévisualise sur tous les écrans", description: "Bascule entre ordinateur, tablette et mobile en haut à droite." },
  { Icon: Save,       titre: "Enregistre",                       description: "Tes changements s'enregistrent automatiquement après quelques secondes, ou tout de suite avec « Enregistrer »." },
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
  const [tenant, setTenant]           = useState<any>(null);
  const [config, setConfig]           = useState<ThemeConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<ThemeConfig | null>(null);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
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

  // Cookie d'aperçu (voir proxy.ts et le layout de la vitrine) : les pages de
  // la boutique s'affichent dans le cadre d'aperçu, même en brouillon.
  useEffect(() => {
    document.cookie = "axso_apercu=1; path=/; SameSite=Strict";
    return () => { document.cookie = "axso_apercu=; path=/; max-age=0"; };
  }, []);

  // ─── Historique annuler / rétablir ──────────────────────────────────────────
  const undoStack   = useRef<ThemeConfig[]>([]);
  const redoStack   = useRef<ThemeConfig[]>([]);
  const skipHistory = useRef(false);
  const lastSnapshot = useRef<ThemeConfig | null>(null);
  const historyTimer = useRef<NodeJS.Timeout | null>(null);
  const [, setHistoryTick] = useState(0);

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
  // reglagesDesign : panneau modifié par le marchand → appliqué aussi au design importé (lib/reglages-design.ts).
  const setBoutons  = useCallback((patch: any) => set(p => ({ ...p, boutons: { ...p.boutons, ...patch }, reglagesDesign: { ...p.reglagesDesign, boutons: true } })), [set]);
  const setNavStyle = useCallback((patch: any) => set(p => ({ ...p, navigationStyle: { ...p.navigationStyle, ...patch }, reglagesDesign: { ...p.reglagesDesign, navigation: true } })), [set]);
  const setAnim     = useCallback((patch: any) => set(p => ({ ...p, animations: { ...p.animations, ...patch } as any, reglagesDesign: { ...p.reglagesDesign, animations: true } })), [set]);
  const setProductPage = useCallback((patch: any) => set(p => ({ ...p, productPage: { ...(p.productPage || DEFAULT_PRODUCT_PAGE), ...patch } })), [set]);

  const updateCustomSection = useCallback((id: string, patch: any) => {
    set(p => ({ ...p, customSections: (p.customSections || []).map(s => s.id === id ? { ...s, config: { ...s.config, ...patch } } : s) }));
  }, [set]);

  const handleSave = useCallback(async () => {
    if (!config || !tenant) return;
    setSaving(true);
    try {
      // Merge animation CSS into customCss
      // Design importé : ses animations viennent de lib/reglages-design.ts (sinon doublées).
      const animCss = config.builderCss ? "" : generateAnimationCss(config.animations);
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

  // Dépublier : la boutique passe « en pause » (même statut que l'interrupteur
  // de Ma boutique) — invisible pour le public, republiable d'un clic.
  const depublierBoutique = useCallback(async () => {
    if (!confirm("Dépublier ta boutique ?\n\nElle ne sera plus visible en ligne tant que tu ne la republies pas. Tes produits, commandes et réglages sont conservés.")) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/tenants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut: "pause" }) });
      if (res.ok) await refetchTenant();
    } finally { setPublishing(false); }
  }, [refetchTenant]);

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

  // Boutique 100% digitale — Constructeur entièrement séparé (façon
  // Chariow), plus le Constructeur libre par blocs. Toute la plomberie de
  // chargement/sauvegarde/undo ci-dessus reste partagée (même API, même
  // debounce d'auto-save) ; seule l'interface change.
  if (config.modeBoutique === "digital") {
    return (
      <DigitalBuilder
        tenant={tenant} config={config} originalConfig={originalConfig} set={set} setColors={setColors} setFonts={setFonts}
        handleSave={handleSave} saving={saving} saved={saved} hasChanges={!!hasChanges}
        publier={publierBoutique} depublier={depublierBoutique} publishing={publishing} criteresManquants={criteresManquants} bandeaux={bandeaux}
        panneauxPages={{
          produit: <PanelProduit config={config} setProductPage={setProductPage} />,
          apropos: <PanelPageSections config={config} set={set} pageKey="aboutPage" titre="À propos" />,
          contact: <PanelPageSections config={config} set={set} pageKey="contactPage" titre="Contact" />,
        }}
      />
    );
  }

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
          depublier={depublierBoutique}
          publishing={publishing}
          criteresManquants={criteresManquants}
          bandeaux={bandeaux}
          onSyncWithServer={syncWithServer}
          modeles={<PanelModeles tenant={tenant} onApplied={refetchTenant} />}
          panneauxPages={{
            produit: <PanelProduit config={config} setProductPage={setProductPage} />,
            apropos: <PanelPageSections config={config} set={set} pageKey="aboutPage" titre="À propos" />,
            contact: <PanelPageSections config={config} set={set} pageKey="contactPage" titre="Contact" />,
          }}
          reglages={[
            { id: "couleurs", label: "Couleurs", desc: "Palette de la boutique", Icon: Palette, contenu: <PanelCouleurs config={config} setColors={setColors} /> },
            { id: "typo", label: "Typographie", desc: "Polices des titres et du texte", Icon: Type, contenu: <PanelTypo config={config} setFonts={setFonts} /> },
            { id: "layout", label: "Mise en page", desc: "Largeur, espacements, cartes produits", Icon: LayoutTemplate, contenu: <PanelLayout config={config} setLayout={setLayout} set={set} /> },
            { id: "boutons", label: "Boutons et navigation", desc: "Style des boutons et du menu", Icon: MousePointer2, contenu: <PanelBoutons config={config} setBoutons={setBoutons} setNavStyle={setNavStyle} /> },
            { id: "animations", label: "Animations", desc: "Apparition des sections", Icon: Sparkles, contenu: <PanelAnimations config={config} setAnim={setAnim} /> },
            { id: "medias", label: "Médias", desc: "Images et vidéos", Icon: ImageIcon, contenu: <PanelMedias config={config} set={set} setSection={setSection} updateCustomSection={updateCustomSection} /> },
            { id: "avance", label: "CSS avancé", desc: "Code CSS personnalisé", Icon: Code2, contenu: <PanelAvance config={config} set={set} tenant={tenant} onReset={() => { setConfig({ ...resolveThemeConfig(tenant.themeId) }); }} /> },
          ]}
        />
        <ModuleTutorial moduleKey="builder" titre="Constructeur de boutique" sousTitre="Personnalise ta boutique en direct" steps={BUILDER_TUTORIAL_STEPS} />
      </>
    );
}
