"use client";

import { useEffect, useState } from "react";
import { FileText, Download, Plus, Search } from "lucide-react";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";

const FACTURES_TUTORIAL_STEPS = [
  { Icon: Plus,     titre: "Génère une facture",  description: "Saisis l'ID d'une commande et clique sur Générer pour créer automatiquement la facture HT/TVA/TTC." },
  { Icon: Search,   titre: "Retrouve une facture", description: "Recherche par nom de client ou numéro de facture pour la retrouver en un instant." },
  { Icon: Download, titre: "Télécharge le PDF",    description: "Chaque facture se télécharge en un clic, prête à être envoyée à ton client." },
  { Icon: FileText, titre: "Suis le statut",       description: "Repère en un coup d'œil les factures émises, payées ou annulées grâce aux badges de statut." },
];

interface Facture {
  id: string;
  commandeId: string;
  numero: string;
  clientNom: string;
  clientEmail: string;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  tauxTVA: number;
  devise: string;
  statut: string;
  emiseAt: string;
}

const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  emise: { label: "Émise", color: "#f59e0b" },
  payee: { label: "Payée", color: "#10b981" },
  annulee: { label: "Annulée", color: "#ef4444" },
};

function FacturePDF({ facture }: { facture: Facture }) {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;color:#111;font-size:13px}
  h1{font-size:24px;margin-bottom:4px}
  .header{display:flex;justify-content:space-between;margin-bottom:32px}
  .label{color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
  table{width:100%;border-collapse:collapse;margin:24px 0}
  th{background:#F5F5F5;padding:8px 12px;text-align:left;font-size:11px}
  td{padding:8px 12px;border-bottom:1px solid #F0F0F0}
  .total{text-align:right;margin-top:16px}
  .total p{margin:4px 0}
  .total .ttc{font-size:18px;font-weight:bold}
  .badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;color:white;background:${STATUT_CONFIG[facture.statut]?.color ?? "#888"}}
</style>
</head>
<body>
<div class="header">
  <div><h1>FACTURE</h1><p>${facture.numero}</p><p class="label">${new Date(facture.emiseAt).toLocaleDateString("fr-FR")}</p></div>
  <div class="total"><span class="badge">${STATUT_CONFIG[facture.statut]?.label ?? facture.statut}</span></div>
</div>
<p><strong>Client :</strong> ${facture.clientNom} (${facture.clientEmail})</p>
<div class="total">
  ${facture.tauxTVA > 0 ? `<p>Montant HT : ${facture.montantHT.toLocaleString("fr")} ${facture.devise}</p><p>TVA (${(facture.tauxTVA * 100).toFixed(0)}%) : ${facture.montantTVA.toLocaleString("fr")} ${facture.devise}</p>` : ""}
  <p class="ttc">Total : ${facture.montantTTC.toLocaleString("fr")} ${facture.devise}</p>
</div>
</body>
</html>`;

  function download() {
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${facture.numero}.html`;
    a.click();
  }

  return (
    <button onClick={download} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-[#666] border border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors">
      <Download size={12} /> Télécharger
    </button>
  );
}

export function FacturesPanel() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [genId, setGenId] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch("/api/factures")
      .then((r) => r.json())
      .then((d) => setFactures(d.factures ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function genFacture() {
    if (!genId.trim()) return;
    setGenerating(true);
    const res = await fetch("/api/factures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commandeId: genId.trim() }),
    });
    const data = await res.json();
    if (data.facture) {
      setFactures((prev) => {
        const exists = prev.find((f) => f.id === data.facture.id);
        return exists ? prev.map((f) => f.id === data.facture.id ? data.facture : f) : [data.facture, ...prev];
      });
      setGenId("");
    }
    setGenerating(false);
  }

  const filtered = factures.filter((f) =>
    !q || f.clientNom.toLowerCase().includes(q.toLowerCase()) || f.numero.toLowerCase().includes(q.toLowerCase())
  );

  const totalTTC = factures.filter((f) => f.statut === "payee").reduce((s, f) => s + f.montantTTC, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <ModuleTutorial moduleKey="logistique-factures" titre="Factures" sousTitre="Suivi de facturation" steps={FACTURES_TUTORIAL_STEPS} />
      <div className="flex items-center justify-end gap-2">
        <input
          className="border border-[#E5E5E5] rounded-lg px-3 py-2 text-[12px] w-48"
          placeholder="ID commande..."
          value={genId}
          onChange={(e) => setGenId(e.target.value)}
        />
        <button
          onClick={genFacture}
          disabled={generating || !genId.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[13px] font-semibold disabled:opacity-50"
          style={{ background: "#F5A623" }}
        >
          <Plus size={14} /> {generating ? "Génération..." : "Générer"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-[#F0F0F0] rounded-xl p-4">
          <p className="text-[11px] text-[#888] mb-1">Total factures</p>
          <p className="text-2xl font-bold text-[#111]">{factures.length}</p>
        </div>
        <div className="bg-white border border-[#F0F0F0] rounded-xl p-4">
          <p className="text-[11px] text-[#888] mb-1">Factures payées</p>
          <p className="text-2xl font-bold" style={{ color: "#10b981" }}>{factures.filter((f) => f.statut === "payee").length}</p>
        </div>
        <div className="bg-white border border-[#F0F0F0] rounded-xl p-4">
          <p className="text-[11px] text-[#888] mb-1">Total facturé</p>
          <p className="text-2xl font-bold" style={{ color: "#F5A623" }}>{totalTTC.toLocaleString()}</p>
        </div>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAA]" />
        <input
          className="w-full border border-[#E5E5E5] rounded-xl pl-9 pr-4 py-2.5 text-[13px]"
          placeholder="Rechercher par client ou numéro..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E5E5E5] rounded-xl p-10 text-center">
          <FileText size={32} className="mx-auto mb-3 text-[#DDD]" />
          <p className="text-[13px] text-[#888]">Aucune facture. Génère-en une à partir d'un ID de commande.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#F0F0F0] rounded-xl overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-[#F0F0F0]">
                <th className="text-left px-4 py-3 font-semibold text-[#888]">N° Facture</th>
                <th className="text-left px-4 py-3 font-semibold text-[#888]">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-[#888]">Montant TTC</th>
                <th className="text-left px-4 py-3 font-semibold text-[#888]">Statut</th>
                <th className="text-left px-4 py-3 font-semibold text-[#888]">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-[#888]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => {
                const sc = STATUT_CONFIG[f.statut] ?? { label: f.statut, color: "#888" };
                return (
                  <tr key={f.id} className="border-b border-[#F8F8F8] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3 font-mono text-[#111] font-semibold">{f.numero}</td>
                    <td className="px-4 py-3 text-[#444]">
                      <p>{f.clientNom}</p>
                      <p className="text-[10px] text-[#AAA]">{f.clientEmail}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-[#111]">{f.montantTTC.toLocaleString()} {f.devise}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ background: sc.color }}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-[#888]">{new Date(f.emiseAt).toLocaleDateString("fr")}</td>
                    <td className="px-4 py-3"><FacturePDF facture={f} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
