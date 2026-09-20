"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { BLOCK_LIBRARY_ITEMS, STARTER_TEMPLATES } from "./blockDefaults";
import type { BlockNodeType, BlockNode } from "@/lib/theme-config";

function LibraryItem({ type, label, Icon, desc }: { type: BlockNodeType; label: string; Icon: any; desc: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib:${type}`,
    data: { kind: "library", blockType: type },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-200 hover:border-[#F5A623]/50 hover:bg-[#F5A623]/5 cursor-grab active:cursor-grabbing transition-all ${isDragging ? "opacity-30" : ""}`}
      title={`Glisser pour ajouter : ${label}`}
    >
      <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-800 truncate">{label}</p>
        <p className="text-[10px] text-gray-400 leading-tight">{desc}</p>
      </div>
    </div>
  );
}

type Tab = "blocs" | "modeles";

export function BlockLibraryPanel({ onInsertTemplate }: { onInsertTemplate: (node: BlockNode) => void }) {
  const [tab, setTab] = useState<Tab>("blocs");
  const structure = BLOCK_LIBRARY_ITEMS.filter((i) => i.categorie === "structure");
  const widgets = BLOCK_LIBRARY_ITEMS.filter((i) => i.categorie === "widget");

  return (
    <div className="w-[260px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
      <div className="flex border-b border-gray-200 flex-shrink-0">
        {([["blocs", "Blocs"], ["modeles", "Modèles"]] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-wide transition-colors ${tab === id ? "text-[#F5A623] border-b-2 border-[#F5A623]" : "text-gray-400 hover:text-gray-600"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        {tab === "blocs" && (
          <>
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 px-0.5">Structure</p>
              <div className="space-y-1.5">
                {structure.map((i) => <LibraryItem key={i.type} {...i} />)}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 px-0.5">Blocs de contenu</p>
              <div className="space-y-1.5">
                {widgets.map((i) => <LibraryItem key={i.type} {...i} />)}
              </div>
            </div>
          </>
        )}
        {tab === "modeles" && (
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 px-0.5">Sections toutes prêtes</p>
            <div className="space-y-1.5">
              {STARTER_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onInsertTemplate(t.build())}
                  className="w-full flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-200 hover:border-[#F5A623]/50 hover:bg-[#F5A623]/5 transition-all text-left"
                  title={`Ajouter : ${t.label}`}
                >
                  <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500">
                    <t.Icon size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{t.label}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-3 px-0.5">Clique pour ajouter le modèle en bas de page, puis personnalise-le comme n'importe quel bloc.</p>
          </div>
        )}
      </div>
    </div>
  );
}
