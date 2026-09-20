"use client";
import { useState, useEffect, useCallback } from "react";
import { Key, Plus, Upload, Trash2, RefreshCw, Copy, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";

interface CleLicence {
  id: string;
  cle: string;
  statut: "disponible" | "vendue" | "expiree" | "revoquee";
  expireAt: string | null;
  createdAt: string;
  commandeId: string | null;
  _count: { activations: number };
}

interface Stats {
  total: number;
  disponible: number;
  vendue: number;
  expiree: number;
  revoquee: number;
}

interface Config {
  formatAuto: string;
  longueur: number;
  prefixe: string | null;
  maxActivations: number | null;
  dureeJours: number | null;
}

const STATUT_COLORS: Record<string, string> = {
  disponible: "#16a34a",
  vendue: "#2563eb",
  expiree: "#d97706",
  revoquee: "#dc2626",
};

const STATUT_LABELS: Record<string, string> = {
  disponible: "Disponible",
  vendue: "Vendue",
  expiree: "Expirée",
  revoquee: "Révoquée",
};

export default function ClesLicenceManager({ produitId }: { produitId: string }) {
  const [cles, setCles] = useState<CleLicence[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [genQuantite, setGenQuantite] = useState(10);
  const [importTexte, setImportTexte] = useState("");
  const [mode, setMode] = useState<"list" | "generer" | "importer">("list");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [filterStatut, setFilterStatut] = useState<string>("tous");

  const charger = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/licences/${produitId}/cles`);
    if (r.ok) {
      const d = await r.json();
      setCles(d.cles);
      setStats(d.stats);
      setConfig(d.config);
    }
    setLoading(false);
  }, [produitId]);

  useEffect(() => { charger(); }, [charger]);

  const generer = async () => {
    setSaving(true);
    const r = await fetch(`/api/licences/${produitId}/cles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "generer", quantite: genQuantite }),
    });
    const d = await r.json();
    setSaving(false);
    if (r.ok) { setMode("list"); charger(); }
    else alert(d.error ?? "Erreur lors de la génération");
  };

  const importer = async () => {
    const lignes = importTexte.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean);
    if (!lignes.length) return;
    setSaving(true);
    const r = await fetch(`/api/licences/${produitId}/cles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "importer", clesImportees: lignes }),
    });
    const d = await r.json();
    setSaving(false);
    if (r.ok) { setImportTexte(""); setMode("list"); charger(); }
    else alert(d.error ?? "Erreur lors de l'import");
  };

  const revoquer = async (cleId: string) => {
    if (!confirm("Révoquer cette clé ? Elle ne pourra plus être utilisée.")) return;
    await fetch(`/api/licences/${produitId}/cles/${cleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "revoquee" }),
    });
    charger();
  };

  const supprimer = async (cleId: string) => {
    if (!confirm("Supprimer définitivement cette clé disponible ?")) return;
    await fetch(`/api/licences/${produitId}/cles/${cleId}`, { method: "DELETE" });
    charger();
  };

  const copier = (texte: string, id: string) => {
    navigator.clipboard.writeText(texte);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const clesFiltered = filterStatut === "tous" ? cles : cles.filter((c) => c.statut === filterStatut);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <Key size={16} className="text-[#16a34a]" />
          <span className="font-semibold text-sm text-gray-900 dark:text-white">Clés de licence</span>
          {stats && (
            <span className="text-xs text-gray-400 ml-1">
              {stats.disponible}/{stats.total} disponibles
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode(mode === "generer" ? "list" : "generer")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#16a34a] text-white hover:bg-[#15803d] transition-colors"
          >
            <RefreshCw size={12} /> Générer
          </button>
          <button
            onClick={() => setMode(mode === "importer" ? "list" : "importer")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Upload size={12} /> Importer
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="flex gap-4 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 text-xs border-b border-gray-100 dark:border-gray-700">
          {Object.entries(stats).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setFilterStatut(filterStatut === k ? "tous" : k)}
              className={`flex items-center gap-1 transition-opacity ${filterStatut !== "tous" && filterStatut !== k ? "opacity-40" : ""}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: STATUT_COLORS[k] ?? "#6b7280" }} />
              <span className="font-semibold" style={{ color: STATUT_COLORS[k] ?? "#6b7280" }}>{v}</span>
              <span className="text-gray-500">{STATUT_LABELS[k] ?? k}</span>
            </button>
          ))}
        </div>
      )}

      {/* Génération panel */}
      {mode === "generer" && (
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-green-50 dark:bg-green-900/10">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Format : <strong>{config?.formatAuto === "uuid" ? "UUID" : `Alphanumérique ${config?.longueur ?? 16} chars`}</strong>
            {config?.prefixe && <> — Préfixe : <strong>{config.prefixe}</strong></>}
          </p>
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">Quantité :</label>
            <input
              type="number" min={1} max={500} value={genQuantite}
              onChange={(e) => setGenQuantite(parseInt(e.target.value) || 1)}
              className="w-24 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
            <button
              onClick={generer} disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-[#16a34a] text-white text-xs font-medium hover:bg-[#15803d] disabled:opacity-50 transition-colors"
            >
              {saving ? "Génération…" : `Générer ${genQuantite} clé${genQuantite > 1 ? "s" : ""}`}
            </button>
            <button onClick={() => setMode("list")} className="text-xs text-gray-400 hover:text-gray-600">Annuler</button>
          </div>
        </div>
      )}

      {/* Import panel */}
      {mode === "importer" && (
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-[#F5A623]/8">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Collez vos clés ci-dessous — une par ligne, ou séparées par virgule/point-virgule.
          </p>
          <textarea
            value={importTexte}
            onChange={(e) => setImportTexte(e.target.value)}
            rows={4}
            placeholder={"XXXX-XXXX-XXXX\nYYYY-YYYY-YYYY\n…"}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-[#F5A623]"
          />
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-400">
              {importTexte.split(/[\n,;]+/).filter((l) => l.trim()).length} clés détectées
            </span>
            <button
              onClick={importer} disabled={saving || !importTexte.trim()}
              className="px-4 py-1.5 rounded-lg bg-[#F5A623] text-[#111111] text-xs font-medium hover:bg-[#D4911A] disabled:opacity-50 transition-colors ml-auto"
            >
              {saving ? "Import…" : "Importer"}
            </button>
            <button onClick={() => setMode("list")} className="text-xs text-gray-400 hover:text-gray-600">Annuler</button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">Chargement…</div>
      ) : clesFiltered.length === 0 ? (
        <div className="py-10 text-center">
          <Key size={28} className="mx-auto text-gray-200 dark:text-gray-700 mb-2" />
          <p className="text-sm text-gray-400">Aucune clé{filterStatut !== "tous" ? ` ${STATUT_LABELS[filterStatut]?.toLowerCase()}` : ""}. Générez ou importez des clés.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {clesFiltered.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUT_COLORS[c.statut] }} />
              <code className="flex-1 text-xs font-mono text-gray-800 dark:text-gray-200 truncate">{c.cle}</code>
              {c._count.activations > 0 && (
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <CheckCircle size={10} className="text-[#F5A623]" /> {c._count.activations}
                </span>
              )}
              {c.expireAt && (
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5 whitespace-nowrap">
                  <Clock size={10} /> {new Date(c.expireAt).toLocaleDateString("fr")}
                </span>
              )}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => copier(c.cle, c.id)}
                  title="Copier"
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  {copied === c.id ? <CheckCircle size={13} className="text-green-500" /> : <Copy size={13} />}
                </button>
                {c.statut === "disponible" && (
                  <button
                    onClick={() => supprimer(c.id)}
                    title="Supprimer"
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                {(c.statut === "disponible" || c.statut === "vendue") && (
                  <button
                    onClick={() => revoquer(c.id)}
                    title="Révoquer"
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <XCircle size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {cles.length > 0 && clesFiltered.length < cles.length && (
        <div className="px-4 py-2 text-center border-t border-gray-100 dark:border-gray-700">
          <button onClick={() => setFilterStatut("tous")} className="text-xs text-[#D4911A] hover:underline">
            Afficher toutes les clés ({cles.length})
          </button>
        </div>
      )}
    </div>
  );
}
