"use client";

import { useState } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRight, GripVertical, Eye, EyeOff, Copy, Trash2, PlusCircle,
  PanelTop, PanelBottom, LayoutPanelTop, Code2, Square,
} from "lucide-react";
import type { BlockNode } from "@/lib/theme-config";
import { ZONES, zoneDe, type Zone } from "@/lib/block-tree";
import { BLOCK_LIBRARY_ITEMS } from "../canvas/blockDefaults";
import { nomNoeud } from "./libelles";

const TITRE_ZONE: Record<Zone, string> = { header: "En-tête", template: "Modèle", footer: "Pied de page" };
const ICONE_ZONE: Record<Zone, any> = { header: PanelTop, template: LayoutPanelTop, footer: PanelBottom };

function iconeBloc(type: string) {
  if (type === "embed-html") return Code2;
  return BLOCK_LIBRARY_ITEMS.find((i) => i.type === type)?.Icon ?? Square;
}

/** Colonnes d'une section avec leurs blocs (widgets), dans l'ordre. */
function colonnesDe(node: BlockNode): BlockNode[] {
  return (node.children ?? []).flatMap((c) => (c.type === "column" ? [c] : c.type === "row" ? colonnesDe(c) : []));
}

interface Props {
  tree: BlockNode[]; // ordonné par zone
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeplacer: (id: string, conteneur: string, versIndex: number) => void; // conteneur = zone ou id de colonne
  onToggleActif: (id: string) => void;
  onDupliquer: (id: string) => void;
  onSupprimer: (id: string) => void;
  onAjouterSection: (zone: Zone, index: number) => void;
  onAjouterBloc: (sectionId: string) => void;
}

// Panneau « Sections » façon Shopify : En-tête / Modèle / Pied de page, chaque
// section dépliable sur ses blocs. Glisser-déposer (dnd-kit sortable) pour
// réordonner les sections dans leur zone et les blocs dans leur colonne ;
// clavier supporté (Espace pour saisir, flèches, Espace pour poser).
export function PanneauSections({ tree, selectedId, onSelect, onDeplacer, onToggleActif, onDupliquer, onSupprimer, onAjouterSection, onAjouterBloc }: Props) {
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

  const onDragStart = (e: DragStartEvent) => setEnCours(trouver(String(e.active.id)));
  const onDragEnd = (e: DragEndEvent) => {
    setEnCours(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const conteneur = active.data.current?.conteneur as string | undefined;
    // Jamais d'une zone/colonne à une autre : l'en-tête reste l'en-tête.
    if (!conteneur || conteneur !== over.data.current?.conteneur) return;
    onDeplacer(String(active.id), conteneur, over.data.current?.sortable?.index ?? 0);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setEnCours(null)}>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="px-5 py-4 border-b border-[#EEEEEE]">
          <p className="text-[16px] font-semibold text-[#111111]">Page d'accueil</p>
        </div>

        {ZONES.map((zone) => {
          const sections = tree.filter((n) => zoneDe(n) === zone);
          return (
            <div key={zone} className="px-3 py-3 border-b border-[#EEEEEE] last:border-b-0">
              <p className="px-2 pb-1.5 text-[14px] font-semibold text-[#111111]">{TITRE_ZONE[zone]}</p>
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
                <PlusCircle size={17} /> Ajouter une section
              </button>
            </div>
          );
        })}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {enCours && (
          <div className="flex items-center gap-2 h-10 px-3 rounded-lg bg-white text-[14px] font-medium text-[#111111] shadow-[0_8px_24px_rgba(0,0,0,0.14)] ring-1 ring-[#F5A623]/40 cursor-grabbing">
            <GripVertical size={16} className="text-[#999999]" /> {nomNoeud(enCours)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function useLigneTriable(id: string, conteneur: string) {
  const s = useSortable({ id, data: { conteneur } });
  return {
    ...s,
    styleTri: { transform: CSS.Translate.toString(s.transform), transition: s.transition } as React.CSSProperties,
  };
}

function LigneSection({ section, zone, ouverte, onBasculer, selectedId, onSelect, onToggleActif, onDupliquer, onSupprimer, onAjouterBloc }: {
  section: BlockNode; zone: Zone; ouverte: boolean; onBasculer: () => void; selectedId: string | null;
  onSelect: (id: string) => void; onToggleActif: (id: string) => void; onDupliquer: (id: string) => void;
  onSupprimer: (id: string) => void; onAjouterBloc: () => void;
}) {
  const { attributes, listeners, setNodeRef, styleTri, isDragging } = useLigneTriable(section.id, zone);
  const colonnes = colonnesDe(section);
  const design = colonnes.some((c) => (c.children ?? []).some((b) => b.type === "embed-html"));
  const depliable = !design;
  const Icone = ICONE_ZONE[zone];

  return (
    <li ref={setNodeRef} style={styleTri} className={isDragging ? "opacity-40" : ""}>
      <Ligne
        niveau={0}
        nom={nomNoeud(section)}
        Icone={Icone}
        selectionne={selectedId === section.id}
        masque={section.actif === false}
        depliable={depliable}
        ouverte={ouverte}
        onBasculer={onBasculer}
        onSelect={() => onSelect(section.id)}
        onToggleActif={() => onToggleActif(section.id)}
        onDupliquer={() => onDupliquer(section.id)}
        onSupprimer={() => onSupprimer(section.id)}
        poignee={{ ...attributes, ...listeners }}
      />
      {depliable && ouverte && (
        <div className="pb-1">
          {colonnes.map((col, i) => (
            <div key={col.id}>
              {colonnes.length > 1 && <p className="pl-11 pt-1.5 pb-0.5 text-[12px] font-medium text-[#999999]">Colonne {i + 1}</p>}
              <SortableContext items={(col.children ?? []).map((b) => b.id)} strategy={verticalListSortingStrategy}>
                <ul className="space-y-0.5">
                  {(col.children ?? []).map((bloc) => (
                    <LigneBloc key={bloc.id} bloc={bloc} colonneId={col.id} selectedId={selectedId} onSelect={onSelect}
                      onToggleActif={onToggleActif} onDupliquer={onDupliquer} onSupprimer={onSupprimer} />
                  ))}
                </ul>
              </SortableContext>
            </div>
          ))}
          <button onClick={onAjouterBloc}
            className="w-full flex items-center gap-2 h-9 pl-11 pr-2 rounded-lg text-[13.5px] font-medium text-[#C77C0A] hover:bg-[#FFF7EA] transition-colors">
            <PlusCircle size={15} /> Ajouter un bloc
          </button>
        </div>
      )}
    </li>
  );
}

function LigneBloc({ bloc, colonneId, selectedId, onSelect, onToggleActif, onDupliquer, onSupprimer }: {
  bloc: BlockNode; colonneId: string; selectedId: string | null; onSelect: (id: string) => void;
  onToggleActif: (id: string) => void; onDupliquer: (id: string) => void; onSupprimer: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, styleTri, isDragging } = useLigneTriable(bloc.id, colonneId);
  return (
    <li ref={setNodeRef} style={styleTri} className={isDragging ? "opacity-40" : ""}>
      <Ligne
        niveau={1}
        nom={nomNoeud(bloc)}
        Icone={iconeBloc(bloc.type)}
        selectionne={selectedId === bloc.id}
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

function Ligne({ niveau, nom, Icone, selectionne, masque, depliable, ouverte, onBasculer, onSelect, onToggleActif, onDupliquer, onSupprimer, poignee }: {
  niveau: 0 | 1; nom: string; Icone: any; selectionne: boolean; masque: boolean;
  depliable?: boolean; ouverte?: boolean; onBasculer?: () => void;
  onSelect: () => void; onToggleActif: () => void; onDupliquer: () => void; onSupprimer: () => void;
  poignee: Record<string, any>;
}) {
  return (
    <div
      className={`group/ligne flex items-center h-10 rounded-lg pr-1.5 transition-colors ${niveau === 1 ? "pl-6" : "pl-0.5"} ${
        selectionne ? "bg-[#FFF1D6]" : "hover:bg-[#F5F5F5]"
      }`}
    >
      <span className="w-6 flex-shrink-0 flex items-center justify-center">
        {depliable && (
          <button onClick={onBasculer} aria-label={ouverte ? "Replier" : "Déplier"} className="w-6 h-6 flex items-center justify-center rounded text-[#888888] hover:text-[#111111]">
            <ChevronRight size={15} className={`transition-transform duration-200 ${ouverte ? "rotate-90" : ""}`} />
          </button>
        )}
      </span>

      {/* Icône du type, remplacée par la poignée au survol (comme Shopify). */}
      <span {...poignee} title="Glisser pour déplacer" style={{ touchAction: "none" }}
        className="relative w-7 h-7 flex-shrink-0 flex items-center justify-center rounded cursor-grab active:cursor-grabbing text-[#777777] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5A623]">
        <Icone size={16} className="group-hover/ligne:opacity-0 transition-opacity" />
        <GripVertical size={16} className="absolute opacity-0 group-hover/ligne:opacity-100 transition-opacity" />
      </span>

      <button onClick={onSelect} className={`flex-1 min-w-0 text-left pl-1.5 text-[14px] truncate h-full ${
        masque ? "text-[#AAAAAA]" : "text-[#111111]"} ${selectionne ? "font-semibold" : ""}`}>
        {nom}
      </button>

      <span className={`flex items-center gap-0.5 flex-shrink-0 ${masque ? "" : "opacity-0 group-hover/ligne:opacity-100 focus-within:opacity-100"} ${selectionne ? "opacity-100" : ""}`}>
        <BoutonIcone titre={masque ? "Afficher" : "Masquer"} onClick={onToggleActif}>{masque ? <EyeOff size={15} /> : <Eye size={15} />}</BoutonIcone>
        {!masque && <BoutonIcone titre="Dupliquer" onClick={onDupliquer}><Copy size={15} /></BoutonIcone>}
        {!masque && <BoutonIcone titre="Supprimer" onClick={onSupprimer} danger><Trash2 size={15} /></BoutonIcone>}
      </span>
    </div>
  );
}

function BoutonIcone({ titre, onClick, danger, children }: { titre: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={titre} aria-label={titre} onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`w-7 h-7 flex items-center justify-center rounded-md text-[#888888] transition-colors ${danger ? "hover:text-[#DC2626] hover:bg-[#FEF2F2]" : "hover:text-[#111111] hover:bg-[#EBEBEB]"}`}>
      {children}
    </button>
  );
}
