"use client";

// Constructeur digital — interface entièrement séparée du Constructeur libre
// par blocs (canvas/BuilderCanvas.tsx) utilisé par les boutiques physiques.
// Reproduit la structure du constructeur d'apparence Chariow (voir d1.png,
// d2.png, d3.png fournis en référence) : un panneau de réglages à gauche
// (cartes avec icône + titre + description, choix par cartes/interrupteurs)
// et un aperçu live à droite. L'aperçu n'est PAS une iframe : c'est le MÊME
// composant React que la vraie vitrine (DigitalStoreShell), monté ici avec
// les valeurs de `config` en direct — un changement de réglage re-rend
// l'aperçu dans la même passe React, sans sérialisation ni rechargement.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PCOnlyGate } from "@/components/dashboard/PCOnlyGate";
import { ArrowLeft, Monitor, Tablet, Smartphone, ExternalLink, Save, RefreshCw, Check, Rocket, EyeOff, LayoutTemplate, Palette, Type, Square, LayoutGrid, ArrowUpDown, ToggleLeft, ToggleRight, Rows, Columns } from "lucide-react";
import type { ThemeConfig, ThemeDigitalConfig } from "@/lib/theme-config";
import { DEFAULT_DIGITAL_CONFIG } from "@/lib/theme-config";
import { FONTS } from "@/lib/theme-fonts";
import { DIGITAL_TEMPLATES, getDigitalTemplate } from "@/lib/digital-templates";
import { prixClient } from "@/lib/pricing";
import { DigitalStoreShell, ELEMENTS_DIGITAUX, type DigitalProductVM } from "@/components/storefront/digital/DigitalStoreShell";
import { ApercuFiche } from "../boutique/ApercuFiche";
import { ApercuPage } from "../pages/ApercuPage";
import { PanneauPage } from "../pages/PanneauPage";
import { SelecteurPage } from "../pages/SelecteurPage";
import { PAGES, type PageEditee } from "../pages/pages";
import { majStyleElement } from "@/lib/element-styles";
import { PanneauElement } from "../PanneauElement";
import { useSurvol, cssSelection } from "../SurvolApercu";
import { StyleCss } from "@/components/storefront/StyleCss";
import { StorefrontTypography } from "@/components/storefront/StorefrontTypography";
import { CSS_MENUS_DEROULANTS } from "../menusDeroulants";

type Device = "desktop" | "tablet" | "mobile";
// Largeur de l'aperçu ; la boutique s'y adapte réellement (container queries,
// voir DigitalStoreShell) — pas une simple vue rétrécie de la version ordinateur.
const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };
const DEVICES: [Device, typeof Monitor, string][] = [["desktop", Monitor, "Ordinateur"], ["tablet", Tablet, "Tablette"], ["mobile", Smartphone, "Mobile"]];

const ACCENT_PRESETS = ["#F5A623", "#111111", "#0d9488", "#3b82f6", "#e91e8c", "#c2622d"];

interface Props {
  tenant: any;
  config: ThemeConfig;
  originalConfig: ThemeConfig | null;
  set: (updater: (p: ThemeConfig) => ThemeConfig) => void;
  setColors: (patch: Record<string, string>) => void;
  setFonts: (patch: Record<string, string>) => void;
  handleSave: () => Promise<void>;
  saving: boolean;
  saved: boolean;
  hasChanges: boolean | null;
  publier: () => void;
  depublier: () => void; // boutique en ligne → en pause (invisible au public)
  publishing: boolean;
  criteresManquants: { label: string }[];
  bandeaux: React.ReactNode; // infos manquantes pour publier (partagé avec le constructeur boutique)
  // Panneaux des pages à sections (fiche produit, À propos, Contact) — les mêmes que le Constructeur physique.
  panneauxPages: Partial<Record<PageEditee, React.ReactNode>>;
}

export function DigitalBuilder({ tenant, config, originalConfig, set, setColors, setFonts, handleSave, saving, saved, hasChanges, publier, depublier, publishing, criteresManquants, bandeaux, panneauxPages }: Props) {
  const [device, setDevice] = useState<Device>("desktop");
  // Page de la boutique en cours d'édition — même sélecteur que le Constructeur physique.
  const [page, setPage] = useState<PageEditee>("accueil");
  const [versionApercu, setVersionApercu] = useState(0);
  useEffect(() => { if (saved) setVersionApercu((v) => v + 1); }, [saved]);
  const pageEnCadre = !["accueil", "produit"].includes(page);
  useEffect(() => {
    if (!pageEnCadre || !hasChanges || saving) return;
    const t = setTimeout(handleSave, 800);
    return () => clearTimeout(t);
  }, [pageEnCadre, hasChanges, saving, config, handleSave]);
  const [produits, setProduits] = useState<DigitalProductVM[] | null>(null);
  // Élément de la vitrine sélectionné dans l'aperçu (data-axs-el) → panneau de droite.
  const [selectedEl, setSelectedEl] = useState<string | null>(null);
  const apercu = useRef<HTMLDivElement>(null);
  const elementSous = (t: EventTarget | null): HTMLElement | null => {
    const el = t instanceof Element ? (t.closest("[data-axs-el]") as HTMLElement | null) : null;
    return el && apercu.current?.contains(el) ? el : null;
  };
  const { survol, onMouseMove, onMouseLeave } = useSurvol(apercu, (t) => {
    const el = elementSous(t);
    return el ? { el, label: ELEMENTS_DIGITAUX[el.dataset.axsEl!]?.label ?? "Élément" } : null;
  });

  useEffect(() => {
    fetch("/api/produits?limit=24&actif=true")
      .then((r) => r.json())
      .then((data) => {
        const liste = (data.produits || []).map((p: any): DigitalProductVM => ({
          id: p.id, nom: p.nom, images: p.images || [],
          prixAffiche: prixClient(p.prix, tenant.commissionRate ?? 0.06),
          categorie: p.categorie, tags: p.tags || [], featured: p.featured, ventes: p.ventes,
        }));
        setProduits(liste);
      })
      .catch(() => setProduits([]));
  }, [tenant.commissionRate]);

  const dc: ThemeDigitalConfig = { ...DEFAULT_DIGITAL_CONFIG, ...(config.digitalConfig || {}) };
  const setDc = (patch: Partial<ThemeDigitalConfig>) => set((p) => ({ ...p, digitalConfig: { ...DEFAULT_DIGITAL_CONFIG, ...p.digitalConfig, ...patch } }));

  const choisirTemplate = (id: ThemeDigitalConfig["templateId"]) => {
    const skin = getDigitalTemplate(id);
    set((p) => ({ ...p, colors: { ...p.colors, ...skin.colors }, radius: skin.radius, digitalConfig: { ...DEFAULT_DIGITAL_CONFIG, ...p.digitalConfig, templateId: id } }));
  };

  // Annule les modifications non sauvegardées — revient à la dernière
  // config réellement enregistrée en base (pas aux réglages d'usine du
  // gabarit, qui effaceraient aussi tout ce qui avait déjà été sauvegardé
  // avant cette session d'édition).
  // Logo : image de la boutique (tenant.logoUrl, commune à tout le site),
  // enregistrée directement ; taille et coins passent par les réglages d'élément.
  const [logoUrl, setLogoUrl] = useState<string>(tenant.logoUrl ?? "");
  const logoEnregistre = useRef(logoUrl);
  useEffect(() => {
    if (logoUrl === logoEnregistre.current) return;
    const t = setTimeout(() => {
      fetch("/api/tenants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ logoUrl }) })
        .then((r) => { if (r.ok) logoEnregistre.current = logoUrl; else toast.error("Logo non enregistré"); })
        .catch(() => toast.error("Logo non enregistré"));
    }, 600);
    return () => clearTimeout(t);
  }, [logoUrl]);
  const estLogo = selectedEl === "logo" || selectedEl === "pied-logo";

  const infoEl = selectedEl ? ELEMENTS_DIGITAUX[selectedEl] : null;
  const texteEditable = selectedEl === "titre" || !!infoEl?.texte;
  const texteActuel = selectedEl ? dc.textes?.[selectedEl] ?? (selectedEl === "titre" ? tenant.description || "" : infoEl?.texte ?? "") : "";

  const reinitialiser = () => {
    if (!originalConfig) return;
    set(() => originalConfig);
  };

  return (
    // fixed inset-0 (comme le Constructeur physique) — sans ça, la Sidebar
    // du dashboard (montée en permanence par DashboardShell, seulement
    // masquée par CSS sur mobile) restait visible à côté de l'aperçu sur
    // desktop : rien ne la recouvrait.
    <div className="ax-constructeur fixed inset-0 z-[9999] flex flex-col bg-[#F5F7FA] text-gray-800 overflow-hidden" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <StyleCss css={CSS_MENUS_DEROULANTS} />
      <PCOnlyGate label="Le Constructeur de boutique digitale" />
      {/* HEADER */}
      <header className="h-14 flex items-center justify-between px-4 bg-white border-b border-gray-200 flex-shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-gray-400 hover:text-gray-800 transition-colors text-sm">
            <ArrowLeft size={13} /> Dashboard
          </Link>
          <div className="h-4 w-px bg-gray-100" />
          <span className="text-sm text-gray-800 font-medium truncate max-w-32">{tenant.nomBoutique}</span>
          {tenant.statut === "brouillon" && <span className="text-[13px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-500 font-semibold">Brouillon</span>}
          {tenant.statut === "pause" && <span className="text-[13px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">Hors ligne</span>}
          {tenant.statut === "active" && <span className="text-[13px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">En ligne</span>}
          {hasChanges && <span className="text-[13px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600">Modifié</span>}
        </div>
        <SelecteurPage page={page} onChange={(pg) => { setPage(pg); setSelectedEl(null); }} labelAccueil="Accueil de la boutique" />
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-gray-100 p-0.5">
            {DEVICES.map(([d, Icon, label]) => (
              <button key={d} onClick={() => setDevice(d)} title={label} aria-label={label} aria-pressed={device === d}
                className={`w-9 h-9 rounded-md flex items-center justify-center transition-all ${device === d ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
                <Icon size={16} />
              </button>
            ))}
          </div>
          {tenant.statut !== "active" ? (
            <button onClick={publier} disabled={publishing || criteresManquants.length > 0}
              title={criteresManquants.length ? `Complète d'abord : ${criteresManquants.map((c) => c.label).join(", ")}` : "Rendre ma boutique visible en ligne"}
              className="h-9 flex items-center gap-1.5 px-4 rounded-lg text-sm font-semibold bg-[#111111] text-white hover:bg-[#333333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {publishing ? <RefreshCw size={14} className="animate-spin" /> : <Rocket size={14} />}
              {publishing ? "Publication…" : "Publier"}
            </button>
          ) : (
            // « Voir la boutique » est dans la barre en dessous (Prévisualisation) — ici, la retirer de la vente.
            <button onClick={depublier} disabled={publishing} title="Retirer la boutique de la vente en ligne"
              className="h-9 flex items-center gap-1.5 px-4 rounded-lg text-sm font-semibold border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors">
              {publishing ? <RefreshCw size={14} className="animate-spin" /> : <EyeOff size={14} />}
              {publishing ? "…" : "Dépublier"}
            </button>
          )}
        </div>
      </header>

      {bandeaux}

      {/* Barre secondaire — Prévisualisation / Réinitialiser / Enregistrer,
          au-dessus de l'aperçu, comme la référence Chariow. */}
      <div className="h-14 flex items-center justify-end gap-2 px-4 bg-white border-b border-gray-200 flex-shrink-0">
        {tenant.statut === "active" && (
          <a href={`/${tenant.slug}`} target="_blank" rel="noopener noreferrer" className="h-9 flex items-center gap-1.5 px-3.5 rounded-full text-sm font-medium text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all">
            <ExternalLink size={13} /> Prévisualisation
          </a>
        )}
        <button onClick={reinitialiser} disabled={!hasChanges} title="Annule les modifications non sauvegardées"
          className="h-9 flex items-center gap-1.5 px-3.5 rounded-full text-sm font-medium text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-transparent">
          <RefreshCw size={13} /> Réinitialiser
        </button>
        {/* Inactif tant qu'aucun réglage n'a changé depuis le dernier
            enregistrement — hasChanges vient de page.tsx (comparaison
            JSON config/originalConfig), pas d'état local dupliqué ici. */}
        <button onClick={handleSave} disabled={saving || !hasChanges}
          className={`h-9 flex items-center gap-1.5 px-5 rounded-full text-sm font-bold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${
            saved ? "bg-emerald-100 text-emerald-700" : "bg-[#F5A623] text-[#050508] hover:bg-[#e8990f] hover:shadow-md"
          }`}>
          {saving ? <RefreshCw size={14} className="animate-spin flex-shrink-0" /> : saved ? <Check size={14} className="flex-shrink-0" /> : <Save size={14} className="flex-shrink-0" />}
          <span>{saving ? "Sauvegarde…" : saved ? "Sauvegardé" : "Enregistrer"}</span>
        </button>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {page !== "accueil" && (
          <div className="w-[420px] flex-shrink-0 min-h-0 bg-white border-r border-gray-200 flex flex-col">
            {panneauxPages[page]
              ? <><div className="px-5 h-12 flex items-center border-b border-gray-100 flex-shrink-0"><p className="text-[15px] font-semibold">{PAGES.find((pg) => pg.id === page)?.label}</p></div>
                  <div className="flex-1 overflow-y-auto scrollbar-thin text-[14px]">{panneauxPages[page]}</div></>
              : <PanneauPage page={page} onPage={setPage} />}
          </div>
        )}
        {page === "produit" && <ApercuFiche config={config} tenant={tenant} device={device} />}
        {pageEnCadre && <ApercuPage slug={tenant.slug} chemin={PAGES.find((pg) => pg.id === page)!.chemin} device={device} version={versionApercu} onNaviguer={setPage} />}

        {page === "accueil" && <>
        {/* Panneau de réglages */}
        <div className="w-[420px] flex-shrink-0 min-h-0 bg-[#FAFAFB] border-r border-gray-200 overflow-y-auto scrollbar-thin p-4 space-y-4">
          <Carte icon={<LayoutTemplate size={16} />} titre="Modèle de boutique" desc="Choisis la mise en page de ta boutique digitale.">
            <div className="grid grid-cols-2 gap-2.5">
              {DIGITAL_TEMPLATES.map((t) => (
                <button key={t.id} onClick={() => choisirTemplate(t.id)}
                  className={`rounded-xl overflow-hidden text-left transition-all border-2 ${dc.templateId === t.id ? "border-[#111111]" : "border-transparent hover:border-gray-200"}`}>
                  <div className="relative h-24 overflow-hidden" style={{ backgroundColor: t.colors.fond }}>
                    <img src={t.previewImage} alt={t.label} className="w-full h-full object-cover object-top" />
                    {dc.templateId === t.id && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 shadow" style={{ backgroundColor: "#F5A623" }}>
                        <Check size={12} className="text-[#050508]" />
                      </span>
                    )}
                  </div>
                  <div className="px-2.5 py-2 bg-white">
                    <p className="text-[13px] font-semibold text-gray-800">{t.label}</p>
                    <p className="text-[11px] text-gray-400">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </Carte>

          <Carte icon={<Palette size={16} />} titre="Couleur de votre marque" desc="La couleur principale de votre boutique.">
            <div className="flex items-center gap-2 flex-wrap">
              {ACCENT_PRESETS.map((c) => (
                <button key={c} onClick={() => setColors({ accent: c })} className="w-8 h-8 rounded-full flex-shrink-0 border-2 transition-all" style={{ backgroundColor: c, borderColor: config.colors.accent === c ? "#111111" : "transparent" }} />
              ))}
              <label className="w-8 h-8 rounded-full flex-shrink-0 border border-dashed border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden relative">
                <input type="color" value={config.colors.accent} onChange={(e) => setColors({ accent: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Palette size={13} className="text-gray-400" />
              </label>
            </div>
          </Carte>

          <Carte icon={<Type size={16} />} titre="Police d'écriture" desc="Titres et contenu de votre boutique.">
            <div className="space-y-3">
              <FSel label="Police des titres" value={config.fonts.titre} onChange={(v) => setFonts({ titre: v })} />
              <FSel label="Police du contenu" value={config.fonts.corps} onChange={(v) => setFonts({ corps: v })} />
            </div>
          </Carte>

          <Carte icon={<Square size={16} />} titre="Style des coins" desc="Arrondis ou nets — cartes produits et boutons.">
            <div className="grid grid-cols-2 gap-2.5">
              {[{ v: "16px", l: "Arrondi" }, { v: "0px", l: "Carré" }].map((r) => (
                <button key={r.v} onClick={() => set((p) => ({ ...p, radius: r.v }))}
                  className={`flex flex-col items-center gap-2 py-4 border-2 transition-all rounded-xl ${config.radius === r.v ? "border-[#111111] bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <div className="w-8 h-8 border-2 border-gray-700" style={{ borderRadius: r.v }} />
                  <span className="text-[12px] text-gray-600 font-medium">{r.l}</span>
                </button>
              ))}
            </div>
          </Carte>

          <Carte icon={<LayoutGrid size={16} />} titre="Organisation de la page" desc="Ce qui s'affiche sur votre boutique.">
            <div className="space-y-1">
              <FCheck label="Afficher les produits en vedette" desc="Met en avant vos produits phares" checked={dc.afficherVedettes} onChange={(v) => setDc({ afficherVedettes: v })} />
              <FCheck label="Bouton d'achat sur la carte produit" desc="Achat immédiat depuis la liste" checked={dc.afficherBoutonAchatCarte} onChange={(v) => setDc({ afficherBoutonAchatCarte: v })} />
              <FCheck label="Afficher les produits recommandés" desc="Suggestions en bas de page" checked={dc.afficherRecommandes} onChange={(v) => setDc({ afficherRecommandes: v })} />
              <FCheck label="Afficher l'affiliation" desc="Lien Affiliation dans le menu" checked={dc.afficherAffiliation} onChange={(v) => setDc({ afficherAffiliation: v })} />
            </div>
          </Carte>

          <Carte icon={<Columns size={16} />} titre="Disposition des produits" desc="Nombre de produits par ligne sur mobile.">
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => setDc({ disposition: "un" })} className={`flex flex-col items-center gap-2 py-4 border-2 rounded-xl transition-all ${dc.disposition === "un" ? "border-[#111111] bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
                <Rows size={20} className="text-gray-600" />
                <span className="text-[12px] text-gray-600 font-medium">Un par ligne</span>
              </button>
              <button onClick={() => setDc({ disposition: "deux" })} className={`flex flex-col items-center gap-2 py-4 border-2 rounded-xl transition-all ${dc.disposition === "deux" ? "border-[#111111] bg-gray-50" : "border-gray-200 hover:border-gray-300"}`}>
                <Columns size={20} className="text-gray-600" />
                <span className="text-[12px] text-gray-600 font-medium">Deux par ligne</span>
              </button>
            </div>
          </Carte>

          <Carte icon={<ArrowUpDown size={16} />} titre="Ordre d'affichage" desc="Comment vos clients voient vos produits.">
            <div className="space-y-1.5">
              {([
                ["alphabetique", "Ordre alphabétique", "Ordre A → Z"],
                ["populaires", "Les plus vendus en premier", "Rassure les acheteurs"],
                ["recents", "Les plus récents en premier", "Stimule l'intérêt"],
                ["prix-desc", "Les plus chers en premier", "Valorise le haut de gamme"],
                ["prix-asc", "Moins cher en premier", "Priorise l'accessible"],
              ] as [ThemeDigitalConfig["tri"], string, string][]).map(([v, l, d]) => (
                <button key={v} onClick={() => setDc({ tri: v })} className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${dc.tri === v ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                  <span>
                    <span className="block text-[13px] font-medium text-gray-800">{l}</span>
                    <span className="block text-[11px] text-gray-400">{d}</span>
                  </span>
                  <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${dc.tri === v ? "border-[#F5A623]" : "border-gray-300"}`}>
                    {dc.tri === v && <span className="w-2 h-2 rounded-full bg-[#F5A623]" />}
                  </span>
                </button>
              ))}
            </div>
          </Carte>
        </div>

        {/* Aperçu live — min-h-0 est ce qui permet à CE conteneur (flex-1
            dans la rangée MAIN) de scroller son propre contenu au lieu de
            grandir jusqu'à repousser toute la mise en page hors de l'écran
            fixe (un flex-item a min-height:auto par défaut, donc ne se
            contracte jamais en dessous de la hauteur de son contenu tant
            qu'on ne force pas min-height:0 — sans ça, une boutique avec
            beaucoup de produits "déformait" tout le Constructeur au lieu de
            simplement défiler dans sa zone). */}
        <div className="isolate flex-1 min-h-0 relative bg-[#EEF0F3]">
          <div className="h-full overflow-y-auto scrollbar-thin flex flex-col items-center p-6 gap-4">
            <div className="w-full flex-shrink-0 flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-3 py-2" style={{ maxWidth: DEVICE_WIDTH[device] }}>
              <span className="w-2 h-2 rounded-full bg-red-300" /><span className="w-2 h-2 rounded-full bg-yellow-300" /><span className="w-2 h-2 rounded-full bg-green-300" />
              <span className="text-[12px] text-gray-400 truncate ml-2">axso.shop/{tenant.slug}</span>
            </div>
            {/* h-full sur l'aperçu (pas de hauteur figée type 70vh) : la
                boutique va du header au footer, plus ou moins haute selon le
                nombre de produits — c'est ce conteneur qui défile, jamais le
                contenu qui se fait comprimer/couper. */}
            <div
              ref={apercu}
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
              // Capture : un clic choisit l'élément au lieu de suivre un lien / ouvrir un menu.
              onClickCapture={(e) => {
                const el = elementSous(e.target);
                if (!el) return;
                e.preventDefault();
                e.stopPropagation();
                setSelectedEl(el.dataset.axsEl!);
              }}
              className="relative w-full flex-shrink-0 bg-white rounded-xl shadow-sm transition-all"
              style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}
            >
              {selectedEl && <StyleCss css={cssSelection(selectedEl)} />}
              {survol}
              {produits === null ? (
                <div className="h-[70vh] flex items-center justify-center text-gray-400 text-sm gap-2">
                  <RefreshCw size={14} className="animate-spin" /> Chargement de l'aperçu…
                </div>
              ) : (
                // Même habillage que la boutique en ligne (layout de la vitrine) :
                // sans lui, les polices choisies ne s'affichaient pas dans l'aperçu.
                <div className="axs-store">
                <StorefrontTypography fonts={config.fonts} />
                <DigitalStoreShell
                  slug={tenant.slug}
                  nomBoutique={tenant.nomBoutique}
                  logoUrl={logoUrl || null}
                  description={tenant.description}
                  pays={tenant.pays}
                  devise={tenant.devise}
                  colors={config.colors}
                  radius={config.radius}
                  templateId={dc.templateId}
                  digitalConfig={dc}
                  products={produits}
                  preview
                />
                </div>
              )}
            </div>
          </div>
        </div>

        </>}

        {page === "accueil" && selectedEl && infoEl && (
          <PanneauElement
            key={selectedEl}
            titre={infoEl.label}
            sousTitre="Vitrine digitale"
            contenu={estLogo ? { image: logoUrl } : texteEditable ? { texte: texteActuel } : undefined}
            onContenu={(patch) => {
              if (patch.image != null) setLogoUrl(patch.image);
              if (patch.texte != null) setDc({ textes: { ...dc.textes, [selectedEl]: patch.texte } });
            }}
            masquable={selectedEl !== "pied"}
            styles={dc.elementStyles?.[selectedEl] ?? {}}
            device={device}
            onStyle={(etat, patch) => setDc({ elementStyles: majStyleElement(dc.elementStyles, selectedEl, etat, patch) })}
            onReinitialiser={() => { const { [selectedEl]: _retire, ...reste } = dc.elementStyles ?? {}; setDc({ elementStyles: reste }); }}
            onClose={() => setSelectedEl(null)}
          />
        )}
      </div>
    </div>
  );
}

function Carte({ icon, titre, desc, children }: { icon: React.ReactNode; titre: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-start gap-2.5 mb-3.5">
        <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-600">{icon}</span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-gray-800">{titre}</p>
          <p className="text-[12px] text-gray-400 leading-snug">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function FSel({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const cats = [...new Set(FONTS.map((f) => f.cat))];
  return (
    <div>
      <label className="block text-[12px] text-gray-500 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#F5A623]/50">
        {cats.map((cat) => (
          <optgroup key={cat} label={cat}>
            {FONTS.filter((f) => f.cat === cat).map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

function FCheck({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full flex items-center justify-between gap-3 py-2 text-left">
      <span>
        <span className="block text-[13px] font-medium text-gray-800">{label}</span>
        <span className="block text-[11px] text-gray-400">{desc}</span>
      </span>
      {checked ? <ToggleRight size={22} className="flex-shrink-0" style={{ color: "#F5A623" }} /> : <ToggleLeft size={22} className="text-gray-300 flex-shrink-0" />}
    </button>
  );
}
