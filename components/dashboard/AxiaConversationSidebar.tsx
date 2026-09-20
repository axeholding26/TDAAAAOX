"use client";
import { useState } from "react";
import { Plus, MessageSquare, Trash2, Pencil, X } from "lucide-react";
import type { ConversationSummary } from "@/hooks/useAxiaConversations";

function grouperParPeriode(list: ConversationSummary[]) {
  const now = Date.now();
  const groups: Record<string, ConversationSummary[]> = {
    "Aujourd'hui": [], "Hier": [], "7 derniers jours": [], "Plus ancien": [],
  };
  for (const c of list) {
    const diffJours = (now - new Date(c.updatedAt).getTime()) / 86400000;
    if (diffJours < 1) groups["Aujourd'hui"].push(c);
    else if (diffJours < 2) groups["Hier"].push(c);
    else if (diffJours < 7) groups["7 derniers jours"].push(c);
    else groups["Plus ancien"].push(c);
  }
  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

export function AxiaConversationSidebar({
  conversations, activeId, loading, onSelect, onNew, onDelete, onRename, onClose,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  loading?: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, titre: string) => void;
  onClose?: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function confirmerRenommage(id: string) {
    const val = editValue.trim();
    if (val) onRename(id, val);
    setEditingId(null);
  }

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "rgba(10,16,30,0.98)" }}>
      <div className="flex-shrink-0 p-3 flex items-center gap-2">
        <button onClick={onNew}
          className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:bg-white/10"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <Plus size={15} /> Nouvelle conversation
        </button>
        {onClose && (
          <button onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 hover:bg-white/10 transition-colors lg:hidden">
            <X size={15} className="text-white/60" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-4 min-h-0">
        {loading ? (
          <p className="text-white/25 text-xs text-center px-4 py-6">Chargement…</p>
        ) : conversations.length === 0 ? (
          <p className="text-white/25 text-xs text-center px-4 py-6 leading-relaxed">
            Aucune conversation pour le moment — écris à AXIA pour en démarrer une.
          </p>
        ) : (
          grouperParPeriode(conversations).map(([label, items]) => (
            <div key={label}>
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-wider px-2.5 mb-1.5">{label}</p>
              <div className="space-y-0.5">
                {items.map(c => {
                  const active = activeId === c.id;
                  return (
                    <div key={c.id}
                      onClick={() => editingId !== c.id && onSelect(c.id)}
                      className="group flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-colors"
                      style={{ background: active ? "rgba(245,166,35,0.16)" : "transparent" }}>
                      <MessageSquare size={13} className="flex-shrink-0" style={{ color: active ? "#F5A623" : "rgba(255,255,255,0.3)" }} />
                      {editingId === c.id ? (
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          onBlur={() => confirmerRenommage(c.id)}
                          onKeyDown={e => {
                            if (e.key === "Enter") confirmerRenommage(c.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="flex-1 min-w-0 bg-transparent text-[13px] text-white outline-none border-b border-white/25"
                        />
                      ) : (
                        <span className="flex-1 min-w-0 truncate text-[13px]" style={{ color: active ? "white" : "rgba(255,255,255,0.6)" }}>
                          {c.titre}
                        </span>
                      )}
                      {editingId !== c.id && (
                        <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); setEditingId(c.id); setEditValue(c.titre); }}
                            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10" title="Renommer">
                            <Pencil size={11} className="text-white/45" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); onDelete(c.id); }}
                            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10" title="Supprimer">
                            <Trash2 size={11} className="text-red-400/70" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
