"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRight, GripVertical, Eye, EyeOff, Copy, Trash2, PlusCircle,
  PanelTop, PanelBottom, LayoutPanelTop, Code2, Square, Heading, Type, MousePointerClick, Image as ImageIcon, TextCursorInput,
} from "lucide-react";
import type { BlockNode } from "@/lib/theme-config";
import { ZONES, zoneDe, type Zone } from "@/lib/block-tree";
import { BLOCK_LIBRARY_ITEMS } from "../canvas/blockDefaults";
import { nomNoeud } from "./libelles";
import { elementsPrincipaux } from "../elements-arbre";
import { useT } from "@/components/I18nProvider";

const TITRE_ZONE: Record<Zone, string> = { header: "En-tête", template: "Modèle", footer: "Pied de page" };
const ICONE_ZONE: Record<Zone, any> = { header: PanelTop, template: LayoutPanelTop, footer: PanelBottom };

function iconeBloc(type: string) {
  if (type === "embed-html") return Code2;
  return BLOCK_LIBRARY_ITEMS.find((i) => i.type === type)?.Icon ?? Square;
}

function iconeElement(tag: string) {
  if (/^h[1-6]$/.test(tag)) return Heading;
  if (tag === "img") return ImageIcon;
  if (tag === "a" || tag === "button") return MousePointerClick;
  if (tag === "input" || tag === "textarea") return TextCursorInput;
  return Type;
}

/** Colonnes d'une section avec leurs blocs (widgets), dans l'ordre. */
function colonnesDe(node: BlockNode): BlockNode[] {
  return (node.children ?? []).flatMap((c) => (c.type === "column" ? [c] : c.type === "row" ? colonnesDe(c) : []));
}

interface Props {
  tree: BlockNode[]; // ordonné par zone
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectedEl: string | null; // élément d'une section de design sélectionné
  onSelectElement: (embedId: string, index: number) => void; // rang de l'élément dans le HTML (voir elements-arbre.ts)
  survolId?: string | null; // section/bloc survolé (ici ou dans l'aperçu)
  onSurvol?: (id: string | null) => void;
  onDeplacer: (id: string, conteneur: string, versIndex: number) => void; // conteneur = zone ou id de colonne
  onToggleActif: (id: string) => void;
  onDupliquer: (id: string) => void;
  onSupprimer: (id: string) => void;
  onAjouterSection: (zone: Zone, index: number) => void;
  onAjouterBloc: (sectionId: string) => void;
}

// Panneau « Sections » façon Shopify : En-tête / Modèle / Pied de page, chaque
// section dépliable sur ses blocs (ou, pour une section de design, sur ses
// éléments principaux). Survol synchronisé avec l'aperçu. Glisser-déposer (dnd-kit sortable) pour
// réordonner les sections dans leur zone et les blocs dans leur colonne ;
// clavier supporté (Espace pour saisir, flèches, Espace pour poser).
export function PanneauSections({ tree, selectedId, onSelect, selectedEl, onSelectElement, survolId, onSurvol, onDeplacer, onToggleActif, onDupliquer, onSupprimer, onAjouterSection, onAjouterBloc }: Props) {
  const tr = useT();
  const [ouvertes, setOuvertes] = useState<Record<string, boolean>>({});
  const [enCours, setEnCours] = useState<BlockNode | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const trouver = (id: string): BlockNode | null => {
    const chercher = (liste: BlockNode[]): BlockNode | null => {
      for (const n of liste) { if (n.id === id) return n; const t = chercher(n.children ?? []); if (t) return t; }
      return null;
    };
    return chercher(tree);
  };

  // Sélection venue d'ailleurs (aperçu, recherche) : on déplie sa section.
  useEffect(() => {
    const sec = selectedId && tree.find((n) => n.id !== selectedId && !!trouverDans(n, selectedId));
    if (sec) setOuvertes((o) => (o[sec.id] ? o : { ...o, [sec.id]: true }));
  }, [selectedId, selectedEl]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDragStart = (e: DragStartEvent) => setEnCours(trouver(String(e.active.id)));
  const onDragEnd = (e: DragEndEvent) => {
    setEnCours(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const de = active.data.current, vers = over.data.current;
    // Une section reste dans sa zone (l'en-tête reste l'en-tête) ; un bloc
    // peut passer d'une colonne à l'autre, mais pas changer de section.
    const memeSection = !!de?.section && de.section === vers?.section;
    if (!de?.conteneur || (de.conteneur !== vers?.conteneur && !memeSection)) return;
    onDeplacer(String(active.id), vers!.conteneur, vers!.sortable?.index ?? 0);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setEnCours(null)}>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-5 py-4 border-b border-[#EEEEEE]">
          <p className="text-[16px] font-semibold text-[#111111]">{tr("Page d'accueil")}</p>
        </div>

        <div onMouseLeave={() => onSurvol?.(null)}>
        {ZONES.map((zone) => {
          const sections = tree.filter((n) => zoneDe(n) === zone);
          return (
            <div key={zone} className="px-3 py-3 border-b border-[#EEEEEE] last:border-b-0">
              <p className="px-2 pb-1.5 text-[14px] font-semibold text-[#111111]">{tr(TITRE_ZONE[zone])}</p>
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-0.5">
                  {sections.map((section) => (
                    <LigneSection
                      key={section.id}
                      section={section}
                      zone={zone}
                      ouverte={!!ouvertes[section.id]}
                      onBasculer={() => setOuvertes((o) => ({ ...o, [section.id]: !o[section.id] }))}
                      selectedId={selectedId}
                      onSelect={onSelect}
                      selectedEl={selectedEl}
                      onSelectElement={onSelectElement}
                      survolId={survolId ?? null}
                      onSurvol={onSurvol}
                      onToggleActif={onToggleActif}
                      onDupliquer={onDupliquer}
                      onSupprimer={onSupprimer}
                      onAjouterBloc={() => { setOuvertes((o) => ({ ...o, [section.id]: true })); onAjouterBloc(section.id); }}
                    />
                  ))}
                </ul>
              </SortableContext>
              <button onClick={() => onAjouterSection(zone, sections.length)}
                className="mt-0.5 w-full flex items-center gap-2 h-10 px-2 rounded-lg text-[14px] font-medium text-[#C77C0A] hover:bg-[#FFF7EA] transition-colors">
                <PlusCircle size={18} />{" "}{tr("Ajouter une section")}
              </button>
            </div>
          );
        })}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {enCours && (
          <div className="flex items-center gap-2 h-10 px-3 rounded-lg bg-white text-[14px] font-medium text-[#111111] shadow-[0_8px_24px_rgba(0,0,0,0.14)] ring-1 ring-[#F5A623]/40 cursor-grabbing">
            <GripVertical size={18} className="text-[#999999]" /> {nomNoeud(enCours)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function trouverDans(n: BlockNode, id: string): BlockNode | null {
  if (n.id === id) return n;
  for (const c of n.children ?? []) { const t = trouverDans(c, id); if (t) return t; }
  return null;
}

function useLigneTriable(id: string, conteneur: string, section?: string) {
  const s = useSortable({ id, data: { conteneur, section } });
  return {
    ...s,
    styleTri: { transform: CSS.Translate.toString(s.transform), transition: s.transition } as React.CSSProperties,
  };
}

function LigneSection({ section, zone, ouverte, onBasculer, selectedId, onSelect, selectedEl, onSelectElement, survolId, onSurvol, onToggleActif, onDupliquer, onSupprimer, onAjouterBloc }: {
  section: BlockNode; zone: Zone; ouverte: boolean; onBasculer: () => void; selectedId: string | null;
  onSelect: (id: string) => void; selectedEl: string | null; onSelectElement: (embedId: string, index: number) => void;
  survolId: string | null; onSurvol?: (id: string | null) => void; onToggleActif: (id: string) => void; onDupliquer: (id: string) => void;
  onSupprimer: (id: string) => void; onAjouterBloc: () => void;
}) {
  const tr = useT();
  const { attributes, listeners, setNodeRef, styleTri, isDragging } = useLigneTriable(section.id, zone);
  const colonnes = colonnesDe(section);
  const embeds = colonnes.flatMap((c) => (c.children ?? []).filter((b) => b.type === "embed-html"));
  const design = embeds.length > 0;
  // Éléments du design, lus seulement une fois la section dépliée.
  const elements = useMemo(
    () => (design && ouverte ? embeds.flatMap((b) => elementsPrincipaux(b.config?.html || "").map((el) => ({ ...el, embedId: b.id }))) : []),
    [design, ouverte, section], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const elSelectionne = elements.some((el) => el.id && el.id === selectedEl);
  // Section de design : sélectionnée aussi quand c'est sa racine (pas listée) qui l'est.
  const selectionnee = selectedId === section.id || (design && !!selectedId && embeds.some((b) => b.id === selectedId) && !elSelectionne);
  const Icone = ICONE_ZONE[zone];

  return (
    <li ref={setNodeRef} style={styleTri} className={isDragging ? "opacity-40" : ""}>
      <Ligne
        niveau={0}
        nom={nomNoeud(section)}
        Icone={Icone}
        selectionne={selectionnee}
        survole={survolId === section.id}
        onSurvol={() => onSurvol?.(section.id)}
        masque={section.actif === false}
        depliable
        ouverte={ouverte}
        onBasculer={onBasculer}
        onSelect={() => onSelect(section.id)}
        onToggleActif={() => onToggleActif(section.id)}
        onDupliquer={() => onDupliquer(section.id)}
        onSupprimer={() => onSupprimer(section.id)}
        poignee={{ ...attributes, ...listeners }}
      />
      {/* Enfants indentés sous un trait vertical (arborescence). */}
      {ouverte && design && (
        <ul className="ml-[15px] pl-2 pb-1 border-l border-[#E8E8E8] space-y-0.5">
          {elements.map((el) => (
            <li key={`${el.embedId}-${el.index}`}>
              <Ligne niveau={1} nom={el.texte ? `${el.nom} · ${el.texte.slice(0, 40)}` : el.nom} Icone={iconeElement(el.tag)}
                selectionne={!!el.id && el.id === selectedEl} survole={false} onSurvol={() => onSurvol?.(section.id)}
                masque={false} onSelect={() => onSelectElement(el.embedId, el.index)} />
            </li>
          ))}
          {!elements.length && <li className="px-2 py-2 text-[12.5px] text-[#AAAAAA]">{tr("Aucun élément")}</li>}
        </ul>
      )}
      {ouverte && !design && (
        <div className="ml-[15px] pl-2 pb-1 border-l border-[#E8E8E8]">
          {colonnes.map((col, i) => (
            <div key={col.id}>
              {colonnes.length > 1 && <p className="pl-2 pt-1.5 pb-0.5 text-[12px] font-medium text-[#999999]">{tr("Colonne")}{" "}{i + 1}</p>}
              <SortableContext items={(col.children ?? []).map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-0.5">
                  {(col.children ?? []).map((bloc) => (
                    <LigneBloc key={bloc.id} bloc={bloc} colonneId={col.id} sectionId={section.id} selectedId={selectedId} onSelect={onSelect}
                      survolId={survolId} onSurvol={onSurvol} onToggleActif={onToggleActif} onDupliquer={onDupliquer} onSupprimer={onSupprimer} />
                  ))}
                </ul>
              </SortableContext>
              {!col.children?.length && <ColonneVide colonneId={col.id} sectionId={section.id} />}
            </div>
          ))}
          <button onClick={onAjouterBloc}
            className="w-full flex items-center gap-2 h-10 pl-2 pr-2 rounded-lg text-[13.5px] font-medium text-[#C77C0A] hover:bg-[#FFF7EA] transition-colors">
            <PlusCircle size={18} />{" "}{tr("Ajouter un bloc")}
          </button>
        </div>
      )}
    </li>
  );
}

// Cible de dépôt d'une colonne sans bloc (sinon aucune ligne où lâcher).
function ColonneVide({ colonneId, sectionId }: { colonneId: string; sectionId: string }) {
  const tr = useT();
  const { setNodeRef, isOver } = useDroppable({ id: `vide-${colonneId}`, data: { conteneur: colonneId, section: sectionId } });
  return (
    <div ref={setNodeRef} className={`ml-2 mr-2 my-0.5 h-9 flex items-center justify-center rounded-lg border border-dashed text-[12.5px] transition-colors ${
      isOver ? "border-[#F5A623] bg-[#FFF7EA] text-[#C77C0A]" : "border-[#DDDDDD] text-[#AAAAAA]"}`}>
      {tr("Glisser un bloc ici")}
    </div>
  );
}

function LigneBloc({ bloc, colonneId, sectionId, selectedId, onSelect, survolId, onSurvol, onToggleActif, onDupliquer, onSupprimer }: {
  bloc: BlockNode; colonneId: string; sectionId: string; selectedId: string | null; onSelect: (id: string) => void;
  survolId: string | null; onSurvol?: (id: string | null) => void;
  onToggleActif: (id: string) => void; onDupliquer: (id: string) => void; onSupprimer: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, styleTri, isDragging } = useLigneTriable(bloc.id, colonneId, sectionId);
  return (
    <li ref={setNodeRef} style={styleTri} className={isDragging ? "opacity-40" : ""}>
      <Ligne
        niveau={1}
        nom={nomNoeud(bloc)}
        Icone={iconeBloc(bloc.type)}
        selectionne={selectedId === bloc.id}
        survole={survolId === bloc.id}
        onSurvol={() => onSurvol?.(bloc.id)}
        masque={bloc.actif === false}
        onSelect={() => onSelect(bloc.id)}
        onToggleActif={() => onToggleActif(bloc.id)}
        onDupliquer={() => onDupliquer(bloc.id)}
        onSupprimer={() => onSupprimer(bloc.id)}
        poignee={{ ...attributes, ...listeners }}
      />
    </li>
  );
}

// Ligne de l'arborescence. Sans poignée ni actions : élément d'un design (ni déplaçable ni masquable ici).
function Ligne({ niveau, nom, Icone, selectionne, survole, onSurvol, masque, depliable, ouverte, onBasculer, onSelect, onToggleActif, onDupliquer, onSupprimer, poignee }: {
  niveau: 0 | 1; nom: string; Icone: any; selectionne: boolean; survole: boolean; onSurvol: () => void; masque: boolean;
  depliable?: boolean; ouverte?: boolean; onBasculer?: () => void;
  onSelect: () => void; onToggleActif?: () => void; onDupliquer?: () => void; onSupprimer?: () => void;
  poignee?: Record<string, any>;
}) {
  const tr = useT();
  return (
    <div onMouseEnter={onSurvol} aria-current={selectionne || undefined}
      className={`group/ligne flex items-center h-10 rounded-lg pr-1 transition-colors ${niveau === 1 ? "pl-0.5" : "pl-0"} ${
        selectionne ? "bg-[#FFF1D6] shadow-[inset_3px_0_0_#F5A623]" : survole ? "bg-[#F3F3F3]" : "hover:bg-[#F5F5F5]"
      }`}
    >
      {niveau === 0 && (
        <span className="w-8 flex-shrink-0 flex items-center justify-center">
          {depliable && (
            <button onClick={onBasculer} aria-label={ouverte ? tr("Replier") : tr("Déplier")} aria-expanded={!!ouverte} className="w-8 h-10 flex items-center justify-center rounded text-[#888888] hover:text-[#111111]">
              <ChevronRight size={18} className={`transition-transform duration-200 ${ouverte ? "rotate-90" : ""}`} />
            </button>
          )}
        </span>
      )}

      {/* Icône du type, remplacée par la poignée au survol (comme Shopify). */}
      {poignee ? (
        <span {...poignee} title={tr("Glisser pour déplacer")} style={{ touchAction: "none" }}
          className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center rounded cursor-grab active:cursor-grabbing text-[#777777] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5A623]">
          <Icone size={18} className="group-hover/ligne:opacity-0 transition-opacity" />
          <GripVertical size={18} className="absolute opacity-0 group-hover/ligne:opacity-100 transition-opacity" />
        </span>
      ) : (
        <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center text-[#777777]"><Icone size={18} /></span>
      )}

      <button onClick={onSelect} className={`flex-1 min-w-0 text-left pl-1.5 text-[14px] truncate h-full ${
        masque ? "text-[#AAAAAA]" : "text-[#111111]"} ${selectionne ? "font-semibold" : ""}`}>
        {tr(nom)}
      </button>

      {onToggleActif && onDupliquer && onSupprimer && (
        <span className={`flex items-center flex-shrink-0 ${masque ? "" : "opacity-0 group-hover/ligne:opacity-100 focus-within:opacity-100"} ${selectionne ? "opacity-100" : ""}`}>
          <BoutonIcone titre={masque ? tr("Afficher") : tr("Masquer")} onClick={onToggleActif}>{masque ? <EyeOff size={17} /> : <Eye size={17} />}</BoutonIcone>
          {!masque && <BoutonIcone titre={tr("Dupliquer")} onClick={onDupliquer}><Copy size={17} /></BoutonIcone>}
          {!masque && <BoutonIcone titre={tr("Supprimer")} onClick={onSupprimer} danger><Trash2 size={17} /></BoutonIcone>}
        </span>
      )}
    </div>
  );
}

function BoutonIcone({ titre, onClick, danger, children }: { titre: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={titre} aria-label={titre} onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`w-8 h-10 flex items-center justify-center rounded-md text-[#888888] transition-colors ${danger ? "hover:text-[#DC2626] hover:bg-[#FEF2F2]" : "hover:text-[#111111] hover:bg-[#EBEBEB]"}`}>
      {children}
    </button>
  );
}
