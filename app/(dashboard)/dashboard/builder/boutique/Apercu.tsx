"use client";

import { useEffect, useMemo, useRef } from "react";
import { Plus } from "lucide-react";
import type { BlockNode, ThemeConfig } from "@/lib/theme-config";
import { BLOCK_REGISTRY } from "@/components/storefront/blocks/registry";
import { blockStyleToCss, TYPES_A_CIBLE } from "@/components/storefront/blocks/styleUtils";
import { ResponsiveStyleTag } from "@/components/storefront/blocks/ResponsiveStyleTag";
import { cssSectionsDesign, scoperCss } from "@/lib/scope-css";
import { zoneDe, type Zone } from "@/lib/block-tree";
import { ProductsCanvasPreview } from "../canvas/CanvasNode";
import { StorefrontTypography } from "@/components/storefront/StorefrontTypography";
import { StyleCss } from "@/components/storefront/StyleCss";
import { nomNoeud } from "./libelles";
import { ATTR_EL, cibleSelectionnable, genElId, nomElement } from "./elements-dom";
import { useSurvol, cssSelection } from "../SurvolApercu";
import { pageDepuisChemin, type PageEditee } from "../pages/pages";

type Device = "desktop" | "tablet" | "mobile";
const LARGEUR: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };
const SECTION_PY: Record<string, string> = { sm: "py-8 @min-[640px]:py-10", md: "py-12 @min-[640px]:py-16", lg: "py-16 @min-[640px]:py-20", xl: "py-20 @min-[640px]:py-28" };
const EDITABLE_INLINE = new Set(["heading", "text", "button"]);

interface Props {
  config: ThemeConfig;
  tree: BlockNode[]; // déjà ordonné par zone
  slug: string;
  device: Device;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChangeConfig: (id: string, patch: Record<string, any>) => void;
  onAjouterSection: (zone: Zone, index: number) => void;
  selectedEl: string | null; // élément d'une section de design (data-axs-el)
  onSelectElement: (noeudId: string, elId: string) => void;
  onNaviguer?: (page: PageEditee) => void; // lien cliqué → page correspondante dans l'éditeur
}

// Aperçu en direct façon Shopify : la page telle qu'elle s'affichera, avec la
// section survolée/sélectionnée encadrée, son nom en étiquette et des « + »
// sur ses bords pour insérer une section juste avant/après. Pas de
// glisser-déposer ici (comme Shopify) : l'ordre se change dans le panneau de
// gauche, qui reste la seule source de vérité de la structure.
export function Apercu({ config, tree, slug, device, selectedId, onSelect, onChangeConfig, onAjouterSection, selectedEl, onSelectElement, onNaviguer }: Props) {
  const racine = useRef<HTMLDivElement>(null);
  const layout = config.layout ?? {};
  const ctx = useMemo(() => ({
    slug,
    colors: config.colors,
    container: layout.largeurContainer === "100%" ? "max-w-full" : `max-w-[${layout.largeurContainer || "1280px"}]`,
    sectionPy: SECTION_PY[layout.paddingSection || "lg"],
  }), [slug, config.colors, layout.largeurContainer, layout.paddingSection]);
  // builderTree (réglages par élément du panneau de droite) et fonts en dépendances :
  // sans eux l'aperçu gardait l'ancien CSS et aucun réglage ne s'y voyait.
  const cssPerso = useMemo(() => (config.customCss ? scoperCss(config.customCss, "[data-apercu-page]") : ""), [config.customCss]);
  const cssDesign = useMemo(() => cssSectionsDesign(config as any), [config.builderCss, config.colors, config.axsoDesignCssVarMapping, config.builderTree, config.fonts, config.axsoDesignPolices]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sélection depuis le panneau de gauche : amène l'élément à l'écran.
  useEffect(() => {
    if (!selectedId) return;
    racine.current?.querySelector(`[data-apercu-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const visibles = tree.filter((n) => n.actif !== false);

  // Survol : cadre pointillé sur l'élément du design sous la souris.
  const { survol, onMouseMove, onMouseLeave } = useSurvol(racine, (t) => {
    const embed = t instanceof Element ? (t.closest("[data-embed-noeud]") as HTMLElement | null) : null;
    const el = embed && cibleSelectionnable(t, embed);
    return el ? { el, label: nomElement(el.tagName, String(el.getAttribute("class") || "")) } : null;
  });

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#F1F2F4] p-4 lg:p-5" onClick={() => onSelect(null)}>
      <div
        ref={racine}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        className="relative mx-auto bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] min-h-full transition-[width] duration-300"
        style={{ width: LARGEUR[device], maxWidth: "100%", backgroundColor: config.colors.fond, color: config.colors.texte }}
        // Liens du design : jamais suivis tels quels dans l'éditeur — un lien vers
        // une autre page de la boutique (produit, panier…) ouvre cette page ici.
        onClickCapture={(e) => {
          const lien = (e.target as HTMLElement).closest("a");
          if (!lien) return;
          e.preventDefault();
          const href = lien.getAttribute("href");
          if (!href || !onNaviguer) return;
          const page = pageDepuisChemin(slug, new URL(href, window.location.origin).pathname);
          // Seulement produit / panier / commande : les autres liens sont des boutons
          // du design, dont le texte se modifie au clic.
          if (page === "produit" || page === "panier" || page === "commande") { e.stopPropagation(); onNaviguer(page); }
        }}
      >
        {cssDesign && <StyleCss css={cssDesign} />}
        {selectedEl && <StyleCss css={cssSelection(selectedEl)} />}
        {survol}
        {/* Mêmes polices que la vitrine (StorefrontTypography, portée .axs-store). */}
        <StorefrontTypography fonts={config.fonts} />
        {cssPerso && <StyleCss css={cssPerso} />}
        <div data-apercu-page className="axs-store" style={{ containerType: "inline-size" }}>
          {visibles.length === 0 && (
            <div className="py-24 flex flex-col items-center gap-3 text-center px-6">
              <p className="text-[15px] font-semibold text-[#111111]">Ta page d'accueil est vide</p>
              <p className="text-[14px] text-[#777777]">Ajoute ta première section pour commencer.</p>
              <button onClick={(e) => { e.stopPropagation(); onAjouterSection("template", 0); }}
                className="mt-1 h-10 px-4 rounded-lg text-[14px] font-semibold bg-[#F5A623] text-[#111111] hover:bg-[#E8990F] transition-colors">
                Ajouter une section
              </button>
            </div>
          )}
          {visibles.map((section) => {
            const zone = zoneDe(section);
            const indexDansZone = tree.filter((n) => zoneDe(n) === zone).indexOf(section);
            return (
              <SectionApercu
                key={section.id}
                section={section}
                ctx={ctx}
                selectedId={selectedId}
                onSelect={onSelect}
                onChangeConfig={onChangeConfig}
                onSelectElement={onSelectElement}
                onAjouterAvant={() => onAjouterSection(zone, indexDansZone)}
                onAjouterApres={() => onAjouterSection(zone, indexDansZone + 1)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

type Ctx = { slug: string; colors: ThemeConfig["colors"]; container: string; sectionPy: string };

function SectionApercu({ section, ctx, selectedId, onSelect, onChangeConfig, onSelectElement, onAjouterAvant, onAjouterApres }: {
  section: BlockNode; ctx: Ctx; selectedId: string | null;
  onSelect: (id: string) => void; onChangeConfig: (id: string, patch: Record<string, any>) => void;
  onSelectElement: (noeudId: string, elId: string) => void;
  onAjouterAvant: () => void; onAjouterApres: () => void;
}) {
  const selectionnee = selectedId === section.id;
  const blocSelectionne = !selectionnee && !!selectedId && contient(section, selectedId);
  const actif = selectionnee || blocSelectionne;

  return (
    <div
      data-apercu-id={section.id}
      onClick={(e) => { e.stopPropagation(); onSelect(section.id); }}
      className={`group/section relative cursor-pointer ${actif ? "z-10" : "hover:z-10"}`}
    >
      <Noeud node={section} ctx={ctx} selectedId={selectedId} sectionActive={actif} onSelect={onSelect} onChangeConfig={onChangeConfig} onSelectElement={onSelectElement} />

      {/* Cadre + étiquette + insertion : au-dessus du contenu, sans le décaler. */}
      <div className={`pointer-events-none absolute inset-0 transition-opacity ${actif ? "opacity-100" : "opacity-0 group-hover/section:opacity-100"}`}
        style={{ boxShadow: `inset 0 0 0 2px ${actif ? "#F5A623" : "rgba(245,166,35,0.55)"}` }}>
        <span className="absolute left-0 top-0 flex items-center gap-1.5 h-7 px-2.5 rounded-br-md text-[13px] font-semibold bg-[#F5A623] text-[#111111]">
          {nomNoeud(section)}
        </span>
      </div>
      <BoutonInsertion position="top" visible={actif} onClick={onAjouterAvant} />
      <BoutonInsertion position="bottom" visible={actif} onClick={onAjouterApres} />
    </div>
  );
}

function BoutonInsertion({ position, visible, onClick }: { position: "top" | "bottom"; visible: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title="Ajouter une section ici"
      aria-label="Ajouter une section ici"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`absolute left-1/2 -translate-x-1/2 z-20 w-7 h-7 rounded-full flex items-center justify-center bg-[#F5A623] text-[#111111] shadow-md ring-2 ring-white transition-all hover:scale-110 ${
        position === "top" ? "-top-3.5" : "-bottom-3.5"
      } ${visible ? "opacity-100" : "opacity-0 group-hover/section:opacity-100"}`}
    >
      <Plus size={15} strokeWidth={2.5} />
    </button>
  );
}

function contient(node: BlockNode, id: string): boolean {
  return (node.children ?? []).some((c) => c.id === id || contient(c, id));
}

function Noeud({ node, ctx, selectedId, sectionActive, onSelect, onChangeConfig, onSelectElement }: {
  node: BlockNode; ctx: Ctx; selectedId: string | null; sectionActive: boolean;
  onSelect: (id: string) => void; onChangeConfig: (id: string, patch: Record<string, any>) => void;
  onSelectElement: (noeudId: string, elId: string) => void;
}) {
  if (node.actif === false) return null;
  const style = blockStyleToCss(node.style);
  const classe = node.style?.customClass || "";

  if (node.type === "section" || node.type === "row" || node.type === "column") {
    const Tag = node.type === "section" ? "section" : "div";
    const flex = node.type === "row" ? "flex flex-col @min-[640px]:flex-row gap-6" : node.type === "column" ? "flex-1 flex flex-col gap-4 min-w-0" : "";
    return (
      <Tag data-axs-id={node.id} style={style} className={`${flex} ${classe}`}>
        <ResponsiveStyleTag nodeId={node.id} style={node.style} />
        {(node.children ?? []).map((c) => (
          <Noeud key={c.id} node={c} ctx={ctx} selectedId={selectedId} sectionActive={sectionActive} onSelect={onSelect} onChangeConfig={onChangeConfig} onSelectElement={onSelectElement} />
        ))}
      </Tag>
    );
  }

  const selectionne = selectedId === node.id;
  const cadreBloc = selectionne ? "outline outline-2 outline-offset-[-2px] outline-[#F5A623]" : sectionActive ? "hover:outline hover:outline-1 hover:outline-dashed hover:outline-offset-[-2px] hover:outline-[#F5A623]" : "";
  const selectionner = (e: React.MouseEvent) => { e.stopPropagation(); onSelect(node.id); };

  if (node.type === "embed-html") {
    return <EmbedEditable node={node} actif={sectionActive} onChangeConfig={onChangeConfig} onSelectElement={onSelectElement} />;
  }

  if (node.type === "products") {
    return (
      <div data-apercu-id={node.id} data-axs-id={node.id} onClick={selectionner} style={style} className={`${classe} ${cadreBloc}`}>
        <ResponsiveStyleTag nodeId={node.id} style={node.style} />
        <ProductsCanvasPreview config={node.config ?? {}} />
      </div>
    );
  }

  const Widget = BLOCK_REGISTRY[node.type];
  if (!Widget) return null;
  const inline = EDITABLE_INLINE.has(node.type);
  const cible = TYPES_A_CIBLE.has(node.type);
  return (
    <div data-apercu-id={node.id} data-axs-id={node.id} onClick={selectionner} style={cible ? blockStyleToCss(node.style, true) : style} className={`${classe} ${cadreBloc}`}>
      <ResponsiveStyleTag nodeId={node.id} style={node.style} cible={cible} />
      <div className={inline ? "" : "pointer-events-none"}>
        <Widget id={node.id} config={node.config ?? {}} colors={ctx.colors} slug={ctx.slug} container={ctx.container} sectionPy={ctx.sectionPy}
          editable={inline} onEditText={inline ? (patch) => onChangeConfig(node.id, patch) : undefined} />
      </div>
    </div>
  );
}

// Section issue d'un design importé. Clic sur un élément (titre, bouton,
// image…) → il est sélectionné et s'édite dans le panneau de droite ; il reçoit
// au premier clic un identifiant data-axs-el enregistré dans le HTML. Section
// active → ses textes s'éditent aussi directement (enregistrés à la sortie).
function EmbedEditable({ node, actif, onChangeConfig, onSelectElement }: {
  node: BlockNode; actif: boolean;
  onChangeConfig: (id: string, patch: Record<string, any>) => void;
  onSelectElement: (noeudId: string, elId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const html = node.config?.html || "";
  // Même objet tant que le HTML ne change pas : sinon React 19 réécrit tout le
  // contenu à chaque rendu (clics perdus entre mousedown et mouseup, survol qui clignote).
  const contenu = useMemo(() => ({ __html: html }), [html]);
  const selectionner = (e: React.MouseEvent) => {
    const racine = ref.current;
    const el = racine && cibleSelectionnable(e.target, racine);
    if (!racine || !el) return; // fond de la section : c'est la section qui est sélectionnée
    e.stopPropagation();
    let id = el.getAttribute(ATTR_EL);
    if (!id) {
      id = genElId();
      el.setAttribute(ATTR_EL, id);
      onChangeConfig(node.id, { html: racine.innerHTML });
    }
    onSelectElement(node.id, id);
  };
  return (
    <div data-axs-embed-html="1">
      <div
        ref={ref}
        data-embed-noeud={node.id}
        contentEditable={actif}
        suppressContentEditableWarning
        spellCheck={false}
        className={actif ? "outline-none cursor-text" : ""}
        dangerouslySetInnerHTML={contenu}
        onClick={selectionner}
        onBlur={() => { const nouveau = ref.current?.innerHTML; if (nouveau != null && nouveau !== html) onChangeConfig(node.id, { html: nouveau }); }}
      />
    </div>
  );
}
