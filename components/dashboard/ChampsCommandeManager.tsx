"use client";
import { useState } from "react";
import { Plus, Trash2, Save, GripVertical, ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";

export interface ChampCommande {
  label: string;
  type: "texte" | "email" | "telephone" | "choix";
  requis: boolean;
  options?: string[];
}

interface Props {
  produitId: string;
  initial: ChampCommande[];
}

const TYPE_LABELS: Record<string, string> = {
  texte:     "Texte libre",
  email:     "Email",
  telephone: "Téléphone",
  choix:     "Choix unique",
};

export default function ChampsCommandeManager({ produitId, initial }: Props) {
  const [champs, setChamps] = useState<ChampCommande[]>(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [optInput, setOptInput] = useState("");

  const save = async (toSave: ChampCommande[] = champs) => {
    setSaving(true);
    try {
      const r = await fetch(`/api/produits/${produitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ champsCommande: toSave }),
      });
      if (!r.ok) throw new Error("Erreur");
      toast.success("Champs sauvegardés");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const ajouter = () => {
    const next: ChampCommande[] = [...champs, { label: "", type: "texte", requis: true }];
    setChamps(next);
    setOpen(champs.length);
  };

  const update = (idx: number, patch: Partial<ChampCommande>) => {
    setChamps(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  };

  const supprimer = (idx: number) => {
    const next = champs.filter((_, i) => i !== idx);
    setChamps(next);
    if (open === idx) setOpen(null);
    save(next);
  };

  const addOption = (idx: number) => {
    const v = optInput.trim();
    if (!v) return;
    update(idx, { options: [...(champs[idx].options ?? []), v] });
    setOptInput("");
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Champs à la commande</h3>
          <p className="text-xs text-gray-400 mt-0.5">Informations collectées lors du passage de commande</p>
        </div>
        <button
          type="button"
          onClick={ajouter}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <Plus size={12} /> Ajouter
        </button>
      </div>

      {champs.length === 0 ? (
        <div className="text-center py-8 text-gray-300 text-sm border-2 border-dashed border-gray-100 rounded-xl">
          Aucun champ. Ajoutez ce que vous voulez collecter auprès de vos acheteurs.
        </div>
      ) : (
        <div className="space-y-2">
          {champs.map((champ, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen(open === idx ? null : idx)}
                className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-gray-50 transition-colors"
              >
                <GripVertical size={13} className="text-gray-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-800 truncate block">
                    {champ.label || <span className="text-gray-400 italic font-normal">Nouveau champ…</span>}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {TYPE_LABELS[champ.type]} · {champ.requis ? "Obligatoire" : "Optionnel"}
                  </span>
                </div>
                {open === idx
                  ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />
                  : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
              </button>

              {open === idx && (
                <div className="border-t border-gray-100 p-3.5 space-y-3 bg-gray-50/50">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">Libellé *</label>
                      <input
                        value={champ.label}
                        onChange={e => update(idx, { label: e.target.value })}
                        placeholder="Ex: Votre numéro WhatsApp"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#F5A623]/50 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">Type</label>
                      <select
                        value={champ.type}
                        onChange={e => update(idx, { type: e.target.value as ChampCommande["type"] })}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#F5A623]/50 bg-white"
                      >
                        {Object.entries(TYPE_LABELS).map(([id, label]) => (
                          <option key={id} value={id}>{label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {champ.type === "choix" && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">Options disponibles</label>
                      <div className="flex gap-2 mb-2">
                        <input
                          value={optInput}
                          onChange={e => setOptInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOption(idx); }}}
                          placeholder="Ajouter une option…"
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#F5A623]/50 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => addOption(idx)}
                          className="px-3 py-2 bg-gray-100 rounded-lg text-gray-500 hover:bg-gray-200 transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(champ.options ?? []).map((opt, oi) => (
                          <span key={oi} className="flex items-center gap-1 bg-white border border-gray-200 text-gray-700 text-xs px-2 py-1 rounded-lg">
                            {opt}
                            <button
                              type="button"
                              onClick={() => update(idx, { options: champ.options?.filter((_, j) => j !== oi) })}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => update(idx, { requis: !champ.requis })}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          champ.requis
                            ? "border-[#F5A623]/30 bg-[#F5A623]/10 text-[#111111] font-medium"
                            : "border-gray-200 text-gray-400"
                        }`}
                      >
                        {champ.requis ? "✓ Obligatoire" : "Optionnel"}
                      </button>
                      <button
                        type="button"
                        onClick={() => supprimer(idx)}
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => save()}
                      disabled={saving}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#F5A623] text-white hover:bg-[#d4820a] disabled:opacity-50 transition-colors"
                    >
                      <Save size={11} /> {saving ? "…" : "Sauvegarder"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {champs.length > 0 && open === null && (
        <button
          type="button"
          onClick={() => save()}
          disabled={saving}
          className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <Save size={12} /> {saving ? "Sauvegarde…" : "Sauvegarder les champs"}
        </button>
      )}
    </div>
  );
}
