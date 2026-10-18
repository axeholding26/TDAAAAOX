"use client";
// Composants interactifs du Command Center : tableau (tri, recherche, filtres,
// pagination, sélection, export), exports, moteur d'actions sur les insights.
import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Download, FileSpreadsheet, Printer, Search, UserPlus, BellRing, EyeOff, Users, Check, X, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { formatValeur } from "@/lib/command-center/format";
import type { Format } from "@/lib/command-center/moteur";

type Cellule = string | number | null | undefined;
export type Ligne = Record<string, Cellule> & { _id: string; _href?: string };
export interface Colonne { cle: string; nom: string; format?: Format | "texte" | "date" | "badge"; droite?: boolean; filtrable?: boolean; tons?: Record<string, string>; masquable?: boolean }

// ─── Export ─────────────────────────────────────────────────────────────────

const enTexte = (v: Cellule, f?: Colonne["format"]) => (v == null ? "" : f === "date" && typeof v === "number" ? new Date(v).toISOString().slice(0, 10) : String(v));

export function exporterCSV(nom: string, colonnes: Colonne[], lignes: Ligne[]) {
  const esc = (s: string) => (/[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const csv = [colonnes.map((c) => esc(c.nom)).join(";"), ...lignes.map((l) => colonnes.map((c) => esc(enTexte(l[c.cle], c.format))).join(";"))].join("\n");
  telecharger(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${nom}.csv`);
}

export async function exporterExcel(nom: string, colonnes: Colonne[], lignes: Ligne[]) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([colonnes.map((c) => c.nom), ...lignes.map((l) => colonnes.map((c) => (c.format === "date" && typeof l[c.cle] === "number" ? new Date(l[c.cle] as number) : l[c.cle] ?? "")))]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nom.slice(0, 31));
  XLSX.writeFile(wb, `${nom}.xlsx`);
}

function telecharger(b: Blob, nom: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function BoutonsExport({ nom, colonnes, lignes, pdf = true }: { nom: string; colonnes: Colonne[]; lignes: Ligne[]; pdf?: boolean }) {
  return (
    <div className="flex items-center gap-1 cc-no-print">
      <button className="cc-btn cc-btn-ghost cc-btn-sm" onClick={() => exporterCSV(nom, colonnes, lignes)} title="Exporter en CSV"><Download size={13} />CSV</button>
      <button className="cc-btn cc-btn-ghost cc-btn-sm" onClick={() => exporterExcel(nom, colonnes, lignes)} title="Exporter en Excel"><FileSpreadsheet size={13} />Excel</button>
      {pdf && <BoutonPDF />}
    </div>
  );
}

export function BoutonPDF({ libelle = "PDF" }: { libelle?: string }) {
  return <button className="cc-btn cc-btn-ghost cc-btn-sm cc-no-print" onClick={() => window.print()} title="Imprimer ou enregistrer en PDF"><Printer size={13} />{libelle}</button>;
}

// ─── Tableau interactif ─────────────────────────────────────────────────────

const PAGE = 50;

export function TableauInteractif({ colonnes, lignes, nomExport, recherche = true, selection = false, actionsGroupees, vide = "Aucune donnée", parPage = PAGE }: {
  colonnes: Colonne[]; lignes: Ligne[]; nomExport?: string; recherche?: boolean; selection?: boolean;
  actionsGroupees?: (ids: string[], vider: () => void) => ReactNode; vide?: string; parPage?: number;
}) {
  const [q, setQ] = useState("");
  const [tri, setTri] = useState<{ cle: string; asc: boolean } | null>(null);
  const [filtres, setFiltres] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());

  const filtrables = colonnes.filter((c) => c.filtrable);
  const options = useMemo(() => Object.fromEntries(filtrables.map((c) => [c.cle, [...new Set(lignes.map((l) => String(l[c.cle] ?? "")).filter(Boolean))].sort()])), [lignes, filtrables]);

  const visibles = useMemo(() => {
    const n = q.trim().toLowerCase();
    let r = lignes.filter((l) => (!n || colonnes.some((c) => String(l[c.cle] ?? "").toLowerCase().includes(n))) && Object.entries(filtres).every(([k, v]) => !v || String(l[k] ?? "") === v));
    if (tri) r = [...r].sort((a, b) => { const x = a[tri.cle], y = b[tri.cle]; const c = x == null ? 1 : y == null ? -1 : typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fr"); return tri.asc ? c : -c; });
    return r;
  }, [lignes, q, tri, filtres, colonnes]);

  const pages = Math.max(1, Math.ceil(visibles.length / parPage));
  const p = Math.min(page, pages - 1);
  const tranche = visibles.slice(p * parPage, (p + 1) * parPage);
  const tous = tranche.length > 0 && tranche.every((l) => choisis.has(l._id));

  const cellule = (c: Colonne, v: Cellule) => {
    if (v == null || v === "") return <span className="cc-faint">—</span>;
    if (c.format === "badge") return <span className={`cc-badge ${c.tons?.[String(v)] ? `cc-badge-${c.tons[String(v)]}` : ""}`}>{v}</span>;
    if (c.format === "date" && typeof v === "number") return new Date(v).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" });
    if (c.format && c.format !== "texte" && c.format !== "date" && typeof v === "number") return formatValeur(v, c.format);
    return v;
  };

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 mb-3 cc-no-print">
        {recherche && (
          <label className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 cc-faint" aria-hidden />
            <input className="cc-input w-full pl-8" placeholder="Rechercher…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Rechercher dans le tableau" />
          </label>
        )}
        {filtrables.map((c) => (
          <select key={c.cle} className="cc-select" value={filtres[c.cle] ?? ""} onChange={(e) => { setFiltres({ ...filtres, [c.cle]: e.target.value }); setPage(0); }} aria-label={`Filtrer par ${c.nom}`}>
            <option value="">{c.nom} : tous</option>
            {options[c.cle].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <span className="cc-faint text-[12px] ml-auto">{visibles.length.toLocaleString("fr-FR")} ligne{visibles.length > 1 ? "s" : ""}</span>
        {nomExport && <BoutonsExport nom={nomExport} colonnes={colonnes} lignes={visibles} pdf={false} />}
      </div>
      {selection && choisis.size > 0 && actionsGroupees && (
        <div className="flex flex-wrap items-center gap-2 mb-2 px-3 py-2 rounded-lg cc-no-print" style={{ background: "var(--cc-accent-bg)" }}>
          <span className="text-[12.5px] font-medium">{choisis.size} sélectionné{choisis.size > 1 ? "s" : ""}</span>
          {actionsGroupees([...choisis], () => setChoisis(new Set()))}
          <button className="cc-btn cc-btn-ghost cc-btn-sm ml-auto" onClick={() => setChoisis(new Set())}>Désélectionner</button>
        </div>
      )}
      {!visibles.length ? <p className="cc-faint text-[13px] text-center py-8">{vide}</p> : (
        <div className="overflow-auto max-h-[70vh] -mx-4 border-t cc-sep">
          <table className="cc-table">
            <thead>
              <tr>
                {selection && <th className="w-8"><input type="checkbox" checked={tous} aria-label="Tout sélectionner" onChange={() => { const s = new Set(choisis); tranche.forEach((l) => (tous ? s.delete(l._id) : s.add(l._id))); setChoisis(s); }} /></th>}
                {colonnes.map((c) => (
                  <th key={c.cle} className={c.droite ? "r" : ""} aria-sort={tri?.cle === c.cle ? (tri.asc ? "ascending" : "descending") : undefined}>
                    <button className="inline-flex items-center gap-1 hover:text-[var(--cc-text)]" onClick={() => setTri(tri?.cle === c.cle ? { cle: c.cle, asc: !tri.asc } : { cle: c.cle, asc: false })}>
                      {c.nom}{tri?.cle === c.cle && (tri.asc ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tranche.map((l) => (
                <tr key={l._id}>
                  {selection && <td><input type="checkbox" checked={choisis.has(l._id)} aria-label="Sélectionner" onChange={() => { const s = new Set(choisis); if (s.has(l._id)) s.delete(l._id); else s.add(l._id); setChoisis(s); }} /></td>}
                  {colonnes.map((c, i) => (
                    <td key={c.cle} className={c.droite ? "r cc-num" : ""}>
                      {i === 0 && l._href ? <Link href={l._href} className="font-medium hover:underline" style={{ color: "var(--cc-text)" }}>{cellule(c, l[c.cle])}</Link> : cellule(c, l[c.cle])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-3 text-[12px] cc-no-print">
          <button className="cc-btn cc-btn-sm" disabled={p === 0} onClick={() => setPage(p - 1)}>Précédent</button>
          <span className="cc-faint">Page {p + 1} / {pages}</span>
          <button className="cc-btn cc-btn-sm" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>Suivant</button>
        </div>
      )}
    </div>
  );
}

// ─── Moteur d'actions ───────────────────────────────────────────────────────

export async function envoyerAction(corps: Record<string, unknown>): Promise<boolean> {
  const r = await fetch("/api/admin/command-center/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }).catch(() => null);
  const d = await r?.json().catch(() => ({}));
  if (!r?.ok) { toast.error(d?.erreur ?? "Action impossible"); return false; }
  toast.success(d?.message ?? "Action enregistrée");
  return true;
}

const EQUIPES = ["Sales", "Growth", "Support", "Produit", "Finance", "Opérations", "CEO"];

/**
 * Actions d'un insight : voir les marchands, assigner, notifier les marchands, ignorer.
 * `source` : la notification n'est possible que sur des données réelles (pas de messages vers des marchands fictifs).
 */
export function ActionsInsight({ insightId, titre, lienMarchands, ids, source, peutAgir, compact }: { insightId: string; titre: string; lienMarchands?: string; ids?: string[]; source: "reel" | "demo"; peutAgir: boolean; compact?: boolean }) {
  const router = useRouter();
  const [assigner, setAssigner] = useState(false);
  const [charge, setCharge] = useState<string | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");

  const go = async (cle: string, corps: Record<string, unknown>) => { setCharge(cle); const ok = await envoyerAction(corps); setCharge(null); if (ok) router.refresh(); return ok; };
  const sm = compact ? "cc-btn-sm" : "cc-btn-sm";
  return (
    <div className="flex flex-wrap items-center gap-1.5 cc-no-print">
      {lienMarchands && <Link href={lienMarchands} className={`cc-btn ${sm}`}><Users size={12} />Voir {ids?.length ? `les ${ids.length}` : "le détail"}</Link>}
      {peutAgir && (
        <>
          <div className="relative">
            <button className={`cc-btn cc-btn-ghost ${sm}`} onClick={() => setAssigner(!assigner)} aria-expanded={assigner}><UserPlus size={12} />Assigner</button>
            {assigner && (
              <div className="absolute z-30 mt-1 left-0 cc-card p-1 min-w-[150px]" style={{ boxShadow: "var(--cc-shadow)" }}>
                {EQUIPES.map((e) => (
                  <button key={e} className="block w-full text-left px-2.5 py-1.5 text-[12.5px] rounded cc-hover" onClick={async () => { setAssigner(false); await go("assigner", { type: "assigner", titre, assigneA: e, lien: lienMarchands ?? null, insightId }); }}>{e}</button>
                ))}
              </div>
            )}
          </div>
          {ids?.length ? (
            <button className={`cc-btn cc-btn-ghost ${sm}`} disabled={source !== "reel"} title={source !== "reel" ? "Indisponible sur les données de démonstration" : "Envoyer une notification dans le tableau de bord de ces marchands"} onClick={() => { setMessage(""); dlg.current?.showModal(); }}><BellRing size={12} />Notifier</button>
          ) : null}
          <button className={`cc-btn cc-btn-ghost ${sm}`} onClick={() => go("ignorer", { type: "ignorer", insightId })} disabled={charge === "ignorer"}>{charge === "ignorer" ? <Loader2 size={12} className="animate-spin" /> : <EyeOff size={12} />}Ignorer</button>
        </>
      )}
      <dialog ref={dlg} className="cc-card p-0 backdrop:bg-black/60 w-[min(480px,92vw)]" style={{ color: "var(--cc-text)" }}>
        <form method="dialog" className="p-4 space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await go("notifier", { type: "notifier", ids, titre, message, insightId })) dlg.current?.close(); }}>
          <div className="flex items-center justify-between"><h3 className="cc-h2">Notifier {ids?.length} marchand{(ids?.length ?? 0) > 1 ? "s" : ""}</h3><button type="button" onClick={() => dlg.current?.close()} className="cc-btn cc-btn-ghost cc-btn-sm" aria-label="Fermer"><X size={14} /></button></div>
          <p className="cc-faint text-[12px]">Le message apparaîtra dans les notifications de leur tableau de bord Axso. L'envoi est journalisé.</p>
          <textarea className="cc-input w-full h-28 py-2" required minLength={10} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex. : Votre boutique dépasse la limite du plan Essentiel. Passez au Pro pour des commandes illimitées." />
          <div className="flex justify-end gap-2"><button type="button" className="cc-btn" onClick={() => dlg.current?.close()}>Annuler</button><button className="cc-btn cc-btn-primary" disabled={charge === "notifier"}>{charge === "notifier" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Envoyer</button></div>
        </form>
      </dialog>
    </div>
  );
}

export function BoutonReessayer() {
  const router = useRouter();
  return <button className="cc-btn cc-btn-sm" onClick={() => router.refresh()}><RotateCw size={12} />Réessayer</button>;
}
