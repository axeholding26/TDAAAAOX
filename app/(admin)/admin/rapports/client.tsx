"use client";
// Rapports : export complet (CSV / Excel multi-feuilles), impression ou export
// automatiques (?imprimer=1, ?export=csv|xlsx), programmation des envois.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Download, FileSpreadsheet, Loader2, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ColonneRapport, LigneRapport } from "@/lib/command-center/rapports";
import type { RapportPlanifie } from "@/lib/command-center/reglages";

export interface BlocExport { titre: string; colonnes: ColonneRapport[]; lignes: LigneRapport[] }

// Valeurs brutes (nombres non formatés) : le tableur garde des chiffres calculables.
const brut = (v: unknown) => (v == null ? "" : String(v));

function telecharger(b: Blob, nom: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function exporterCSV(nom: string, blocs: BlocExport[]) {
  const esc = (s: string) => (/[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lignes = blocs.flatMap((b) => [esc(b.titre), b.colonnes.map((c) => esc(c.nom)).join(";"), ...b.lignes.map((l) => b.colonnes.map((c) => esc(brut(l[c.cle]))).join(";")), ""]);
  telecharger(new Blob(["﻿" + lignes.join("\n")], { type: "text/csv;charset=utf-8" }), `${nom}.csv`);
}

async function exporterExcel(nom: string, blocs: BlocExport[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const pris = new Set<string>();
  for (const b of blocs) {
    let n = b.titre.replace(/[\\/?*[\]:]/g, " ").slice(0, 28) || "Feuille";
    for (let i = 2; pris.has(n); i++) n = `${n.slice(0, 26)} ${i}`;
    pris.add(n);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([b.colonnes.map((c) => c.nom), ...b.lignes.map((l) => b.colonnes.map((c) => l[c.cle] ?? ""))]), n);
  }
  XLSX.writeFile(wb, `${nom}.xlsx`);
}

/** Boutons d'export du rapport complet ; déclenche aussi l'export / l'impression demandés dans l'URL. */
export function ExportRapport({ nom, blocs }: { nom: string; blocs: BlocExport[] }) {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const action = p.get("imprimer") ? "pdf" : p.get("export");
    if (!action) return;
    p.delete("imprimer"); p.delete("export");
    window.history.replaceState(null, "", `${window.location.pathname}${p.size ? `?${p}` : ""}`);
    if (action === "pdf") setTimeout(() => window.print(), 400);
    else if (action === "csv") exporterCSV(nom, blocs);
    else if (action === "xlsx") void exporterExcel(nom, blocs);
  }, [nom, blocs]);
  return (
    <>
      <button className="cc-btn cc-btn-sm" onClick={() => exporterCSV(nom, blocs)} title="Tout le rapport en CSV"><Download size={13} />CSV</button>
      <button className="cc-btn cc-btn-sm" onClick={() => exporterExcel(nom, blocs)} title="Tout le rapport en Excel (une feuille par tableau)"><FileSpreadsheet size={13} />Excel</button>
    </>
  );
}

const FREQ: { id: RapportPlanifie["frequence"]; nom: string }[] = [{ id: "quotidien", nom: "Chaque jour" }, { id: "hebdomadaire", nom: "Chaque lundi" }, { id: "mensuel", nom: "Le 1er du mois" }];

/** Programmation d'un rapport (Super admin et CEO) : enregistrée dans les réglages « rapports », journalisée. */
export function Programmer({ type, planifies, frequenceParDefaut }: { type: RapportPlanifie["type"]; planifies: RapportPlanifie[]; frequenceParDefaut: RapportPlanifie["frequence"] }) {
  const router = useRouter();
  const actuel = planifies.find((p) => p.type === type);
  const [ouvert, setOuvert] = useState(false);
  const [frequence, setFrequence] = useState(actuel?.frequence ?? frequenceParDefaut);
  const [emails, setEmails] = useState(actuel?.destinataires.join(", ") ?? "");
  const [actif, setActif] = useState(actuel?.actif ?? true);
  const [charge, setCharge] = useState(false);

  async function enregistrer(supprimer = false) {
    const destinataires = [...new Set(emails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (!supprimer && !destinataires.length) { toast.error("Ajoutez au moins un destinataire"); return; }
    const invalides = destinataires.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (!supprimer && invalides.length) { toast.error(`Adresse invalide : ${invalides[0]}`); return; }
    const valeur = [...planifies.filter((p) => p.type !== type), ...(supprimer ? [] : [{ type, frequence, destinataires, actif }])];
    setCharge(true);
    const r = await fetch("/api/admin/command-center/reglages", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cle: "rapports", valeur }) }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    setCharge(false);
    if (!r?.ok) { toast.error(d?.erreur ?? "Enregistrement impossible"); return; }
    toast.success(supprimer ? "Programmation supprimée" : "Programmation enregistrée");
    setOuvert(false);
    router.refresh();
  }

  return (
    <>
      <button className="cc-btn cc-btn-ghost cc-btn-sm" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}><CalendarClock size={13} />Programmer</button>
      {ouvert && (
        <div className="basis-full mt-2 p-3 rounded-lg border cc-sep grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-end" style={{ background: "var(--cc-surface-2)" }}>
          <label className="text-[12px] cc-muted grid gap-1">Fréquence
            <select className="cc-select" value={frequence} onChange={(e) => setFrequence(e.target.value as typeof frequence)}>{FREQ.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}</select>
          </label>
          <label className="text-[12px] cc-muted grid gap-1">Destinataires (e-mails séparés par des virgules, 20 max.)
            <input className="cc-input w-full" type="text" inputMode="email" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="ceo@axso.africa, finance@axso.africa" />
          </label>
          <div className="flex items-center gap-2">
            <label className="text-[12px] flex items-center gap-1.5"><input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />Actif</label>
            <button className="cc-btn cc-btn-primary cc-btn-sm" disabled={charge} onClick={() => enregistrer()}>{charge ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Enregistrer</button>
            {actuel && <button className="cc-btn cc-btn-ghost cc-btn-sm" disabled={charge} onClick={() => enregistrer(true)} aria-label="Supprimer la programmation"><Trash2 size={13} /></button>}
          </div>
          <p className="cc-faint text-[11.5px] sm:col-span-3">Envoi vers 7 h (heure de Douala), données réelles uniquement. Hebdomadaire : le lundi ; mensuel : le 1er.</p>
        </div>
      )}
    </>
  );
}
