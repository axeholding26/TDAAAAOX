"use client";

import { useEffect, useMemo, useRef } from "react";
import { Plus } from "lucide-react";
import type { BlockNode, ThemeConfig } from "@/lib/theme-config";
import { BLOCK_REGISTRY } from "@/components/storefront/blocks/registry";
import { blockStyleToCss } from "@/components/storefront/blocks/styleUtils";
import { ResponsiveStyleTag } from "@/components/storefront/blocks/ResponsiveStyleTag";
import { cssSectionsDesign, scoperCss } from "@/lib/scope-css";
import { zoneDe, type Zone } from "@/lib/block-tree";
import { ProductsCanvasPreview } from "../canvas/CanvasNode";
import { nomNoeud } from "./libelles";

type Device = "desktop" | "tablet" | "mobile";
const LARGEUR: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };
const SECTION_PY: Record<string, string> = { sm: "py-8 sm:py-10", md: "py-12 sm:py-16", lg: "py-16 sm:py-20", xl: "py-20 sm:py-28" };
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
}

// Aperçu en direct façon Shopify : la page telle qu'elle s'affichera, avec la
// section survolée/sélectionnée encadrée, son nom en étiquette et des « + »
// sur ses bords pour insérer une section juste avant/après. Pas de
// glisser-déposer ici (comme Shopify) : l'ordre se change dans le panneau de
// gauche, qui reste la seule source de vérité de la structure.
export function Apercu({ config, tree, slug, device, selectedId, onSelect, onChangeConfig, onAjouterSection }: Props) {
  const racine = useRef<HTMLDivElement>(null);
  const layout = config.layout ?? {};
  const ctx = useMemo(() => ({
    slug,
    colors: config.colors,
    container: layout.largeurContainer === "100%" ? "max-w-full" : `max-w-[${layout.largeurContainer || "1280px"}]`,
    sectionPy: SECTION_PY[layout.paddingSection || "lg"],
  }), [slug, config.colors, layout.largeurContainer, layout.paddingSection]);
  const cssDesign = useMemo(() => cssSectionsDesign(config as any), [config.builderCss, config.colors, config.axsoDesignCssVarMapping]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sélection depuis le panneau de gauche : amène l'élément à l'écran.
  useEffect(() => {
    if (!selectedId) return;
    racine.current?.querySelector(`[data-apercu-id="${selectedId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const visibles = tree.filter((n) => n.actif !== false);

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#F1F2F4] p-4 lg:p-5" onClick={() => onSelect(null)}>
      <div
        ref={racine}
        className="mx-auto bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] min-h-full transition-[width] duration-300"
        style={{ width: LARGEUR[device], maxWidth: "100%", backgroundColor: config.colors.fond, color: config.colors.texte }}
        // Liens du design : jamais suivis dans l'éditeur.
        onClickCapture={(e) => { if ((e.target as HTMLElement).closest("a")) e.preventDefault(); }}
      >
        {cssDesign && <style dangerouslySetInnerHTML={{ __html: cssDesign }} />}
        {config.customCss && <style dangerouslySetInnerHTML={{ __html: scoperCss(config.customCss, "[data-apercu-page]") }} />}
        <div data-apercu-page>
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

function SectionApercu({ section, ctx, selectedId, onSelect, onChangeConfig, onAjouterAvant, onAjouterApres }: {
  section: BlockNode; ctx: Ctx; selectedId: string | null;
  onSelect: (id: string) => void; onChangeConfig: (id: string, patch: Record<string, any>) => void;
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
      <Noeud node={section} ctx={ctx} selectedId={selectedId} sectionActive={actif} onSelect={onSelect} onChangeConfig={onChangeConfig} />

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

function Noeud({ node, ctx, selectedId, sectionActive, onSelect, onChangeConfig }: {
  node: BlockNode; ctx: Ctx; selectedId: string | null; sectionActive: boolean;
  onSelect: (id: string) => void; onChangeConfig: (id: string, patch: Record<string, any>) => void;
}) {
  if (node.actif === false) return null;
  const style = blockStyleToCss(node.style);
  const classe = node.style?.customClass || "";

  if (node.type === "section" || node.type === "row" || node.type === "column") {
    const Tag = node.type === "section" ? "section" : "div";
    const flex = node.type === "row" ? "flex flex-col sm:flex-row gap-6" : node.type === "column" ? "flex-1 flex flex-col gap-4 min-w-0" : "";
    return (
      <Tag style={style} className={`${flex} ${classe}`}>
        <ResponsiveStyleTag nodeId={node.id} style={node.style} />
        {(node.children ?? []).map((c) => (
          <Noeud key={c.id} node={c} ctx={ctx} selectedId={selectedId} sectionActive={sectionActive} onSelect={onSelect} onChangeConfig={onChangeConfig} />
        ))}
      </Tag>
    );
  }

  const selectionne = selectedId === node.id;
  const cadreBloc = selectionne ? "outline outline-2 outline-offset-[-2px] outline-[#F5A623]" : sectionActive ? "hover:outline hover:outline-1 hover:outline-dashed hover:outline-offset-[-2px] hover:outline-[#F5A623]" : "";
  const selectionner = (e: React.MouseEvent) => { e.stopPropagation(); onSelect(node.id); };

  if (node.type === "embed-html") {
    return <EmbedEditable node={node} actif={sectionActive} onChangeConfig={onChangeConfig} />;
  }

  if (node.type === "products") {
    return (
      <div data-apercu-id={node.id} onClick={selectionner} style={style} className={`${classe} ${cadreBloc}`}>
        <ProductsCanvasPreview config={node.config ?? {}} />
      </div>
    );
  }

  const Widget = BLOCK_REGISTRY[node.type];
  if (!Widget) return null;
  const inline = EDITABLE_INLINE.has(node.type);
  return (
    <div data-apercu-id={node.id} onClick={selectionner} style={style} className={`${classe} ${cadreBloc}`}>
      <ResponsiveStyleTag nodeId={node.id} style={node.style} />
      <div className={inline ? "" : "pointer-events-none"}>
        <Widget id={node.id} config={node.config ?? {}} colors={ctx.colors} slug={ctx.slug} container={ctx.container} sectionPy={ctx.sectionPy}
          editable={inline} onEditText={inline ? (patch) => onChangeConfig(node.id, patch) : undefined} />
      </div>
    </div>
  );
}

// Section issue d'un design importé : ses textes s'éditent directement dans
// l'aperçu une fois la section sélectionnée (enregistrés à la sortie du champ).
function EmbedEditable({ node, actif, onChangeConfig }: { node: BlockNode; actif: boolean; onChangeConfig: (id: string, patch: Record<string, any>) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = node.config?.html || "";
  return (
    <div data-axs-embed-html="1">
      <div
        ref={ref}
        contentEditable={actif}
        suppressContentEditableWarning
        spellCheck={false}
        className={actif ? "outline-none cursor-text" : ""}
        dangerouslySetInnerHTML={{ __html: html }}
        onBlur={() => { const nouveau = ref.current?.innerHTML; if (nouveau != null && nouveau !== html) onChangeConfig(node.id, { html: nouveau }); }}
      />
    </div>
  );
}
