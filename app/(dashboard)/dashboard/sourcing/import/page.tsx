"use client";
import { useEffect, useState } from "react";

export default function ImportFournisseurPage() {
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [fournisseurId, setFournisseurId] = useState("");
  const [csv, setCsv] = useState("");
  const [marge, setMarge] = useState("30");
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState<any>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    fetch("/api/fournisseurs").then(r => r.json()).then(d => setFournisseurs(d.fournisseurs ?? []));
  }, []);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => setCsv(e.target?.result as string ?? "");
    reader.readAsText(file);
  }

  async function importer() {
    if (!csv) return;
    setLoading(true); setResultat(null);
    const res = await fetch("/api/fournisseurs/import-csv", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fournisseurId: fournisseurId || null, csv, marge: parseFloat(marge) }),
    });
    const d = await res.json();
    setResultat(d); setLoading(false);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <div>
        <h1 className="text-[18px] font-bold text-[#111111]">Import produits fournisseur</h1>
        <p className="text-[12px] text-[#666666]">Importez un CSV fournisseur pour créer vos produits dropshipping en masse</p>
      </div>

      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-4 shadow-sm">
        <div>
          <label className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">Fournisseur (optionnel)</label>
          <select value={fournisseurId} onChange={e => setFournisseurId(e.target.value)}
            className="mt-1 w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#F5A623]/50">
            <option value="">Aucun fournisseur lié</option>
            {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">Marge appliquée</label>
          <div className="flex items-center gap-2 mt-1">
            <input type="number" min="0" max="500" value={marge} onChange={e => setMarge(e.target.value)}
              className="w-24 border border-[#E8E8E8] rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#F5A623]/50" />
            <span className="text-[12px] text-[#666666]">% au-dessus du prix fournisseur</span>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">Fichier CSV</label>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className={`mt-1 border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${dragging ? "border-[#F5A623] bg-[#FFF8EC]" : "border-[#E8E8E8] hover:border-[#F5A623]/40"}`}
            onClick={() => document.getElementById("csvInput")?.click()}>
            <input id="csvInput" type="file" accept=".csv,.txt" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {csv ? (
              <div>
                <p className="text-[13px] font-semibold text-[#16A34A]">✓ Fichier chargé</p>
                <p className="text-[11px] text-[#AAAAAA]">{csv.split("\n").length - 1} lignes détectées</p>
              </div>
            ) : (
              <div>
                <p className="text-[13px] text-[#AAAAAA]">Glissez votre CSV ici ou cliquez</p>
                <p className="text-[10px] text-[#CCCCCC] mt-1">Format: nom, description, prix, stock, sku, categorie, image</p>
              </div>
            )}
          </div>
        </div>

        {csv && (
          <div className="bg-[#F5F5F5] rounded-xl p-3">
            <p className="text-[10px] font-semibold text-[#AAAAAA] mb-1">Aperçu (5 premières lignes)</p>
            <pre className="text-[10px] text-[#666666] whitespace-pre-wrap overflow-x-auto">
              {csv.split("\n").slice(0, 5).join("\n")}
            </pre>
          </div>
        )}

        <button onClick={importer} disabled={!csv || loading}
          className="w-full py-3 bg-[#F5A623] text-[#111111] rounded-xl text-[13px] font-bold hover:bg-[#D4911A] transition-all disabled:opacity-50 shadow-sm">
          {loading ? "Import en cours…" : "Importer les produits"}
        </button>
      </div>

      {resultat && (
        <div className={`rounded-2xl p-5 border ${resultat.ok ? "bg-[#ECFDF5] border-[#BBF7D0]" : "bg-[#FEF2F2] border-[#FECACA]"}`}>
          {resultat.ok ? (
            <div>
              <p className="text-[14px] font-bold text-[#16A34A]">{resultat.importes} produit(s) importé(s)</p>
              {resultat.erreurs > 0 && <p className="text-[12px] text-[#D97706] mt-1">{resultat.erreurs} erreur(s) ignorée(s)</p>}
            </div>
          ) : (
            <p className="text-[13px] text-[#DC2626]">{resultat.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
