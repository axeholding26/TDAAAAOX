"use client";
// Socle des écrans « Finance du magasin » (session de caisse, retours,
// rapprochement, journal d'audit) : appels de lecture avec leurs états,
// caisse de travail du poste, en-tête de page, impression isolée.
import { useCallback, useEffect, useRef, useState } from "react";
import { appelPos, CLE_CAISSE } from "@/components/pos/caisse/api";
import { POLICE } from "@/components/pos/ui";
import { useT } from "@/components/I18nProvider";

export { appelPos };
export type ErreurAppel = { code: string; message: string; details?: Record<string, unknown> };

/** Caisse de travail retenue sur ce poste — la même que l'écran de caisse (localStorage). */
export function useCaisse(): [string | null, (id: string) => void] {
  const [caisseId, setCaisseId] = useState<string | null>(null);
  useEffect(() => { try { setCaisseId(localStorage.getItem(CLE_CAISSE)); } catch { /* stockage indisponible : la caisse par défaut du serveur s'applique */ } }, []);
  const choisir = useCallback((id: string) => { try { localStorage.setItem(CLE_CAISSE, id); } catch { /* idem */ } setCaisseId(id); }, []);
  return [caisseId, choisir];
}

/**
 * Lecture d'une route de la caisse : `donnees` (gardées pendant un rechargement),
 * `erreur` ({ code, message } à passer à <EtatPos>), `charge`, `recharger`.
 * `url` null = ne rien charger.
 */
export function useLecture<T>(url: string | null, caisseId?: string | null) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<ErreurAppel | null>(null);
  const [charge, setCharge] = useState(!!url);
  const tour = useRef(0);
  const recharger = useCallback(async () => {
    if (!url) { setDonnees(null); setErreur(null); setCharge(false); return; }
    const moi = ++tour.current;
    setCharge(true);
    const r = await appelPos<T>(url, { caisseId });
    if (moi !== tour.current) return; // une demande plus récente est partie
    if (r.ok) { setDonnees(r.donnees); setErreur(null); } else setErreur({ code: r.code, message: r.message, details: r.details });
    setCharge(false);
  }, [url, caisseId]);
  useEffect(() => { void recharger(); }, [recharger]);
  return { donnees, erreur, charge, recharger };
}

export function EnTete({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children?: React.ReactNode }) {
  const t = useT();
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-bold leading-tight text-[#111111]">{t(titre)}</h1>
        {sousTitre && <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[#666666]">{t(sousTitre)}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-5" style={POLICE}>{children}</div>;
}

export function Carte({ titre, children, actions, className = "" }: { titre?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  const t = useT();
  return (
    <section className={`rounded-2xl border border-[#E8E8E8] bg-white p-4 sm:p-5 ${className}`}>
      {(titre || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titre && <h2 className="text-[13px] font-bold text-[#111111]">{t(titre)}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Chiffre clé. `fort` : la valeur qui compte sur l'écran (attendu, écart). */
export function Chiffre({ label, valeur, aide, fort, ton }: { label: string; valeur: string; aide?: string; fort?: boolean; ton?: "positif" | "danger" }) {
  const t = useT();
  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${fort ? "border-[#111111] bg-[#111111] text-white" : "border-[#E8E8E8] bg-white text-[#111111]"}`}>
      <p className={`text-[10.5px] font-semibold uppercase tracking-wide ${fort ? "text-white/70" : "text-[#666666]"}`}>{t(label)}</p>
      <p className={`mt-1 text-[17px] font-bold leading-tight tabular-nums [overflow-wrap:anywhere] sm:text-[20px] ${ton === "danger" ? "text-[#B91C1C]" : ton === "positif" ? "text-[#15803D]" : ""}`}>{valeur}</p>
      {aide && <p className={`mt-0.5 text-[11px] ${fort ? "text-white/70" : "text-[#888888]"}`}>{t(aide)}</p>}
    </div>
  );
}

/** Montant saisi au clavier (« 12 500 », « 12500,50 ») → nombre, ou NaN. */
export function lireMontant(saisie: string): number {
  const propre = saisie.replace(/\s/g, "").replace(",", ".");
  return propre === "" ? NaN : Number(propre);
}

/**
 * Imprime le contenu d'un élément dans un cadre isolé : ni le menu ni le reste
 * de l'écran ne partent à l'imprimante. Le contenu doit être fait de titres,
 * paragraphes et tableaux simples (la feuille de style du site n'y est pas).
 */
export function imprimerElement(element: HTMLElement | null, titre: string): boolean {
  if (!element) return false;
  const cadre = document.createElement("iframe");
  cadre.setAttribute("aria-hidden", "true");
  cadre.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(cadre);
  const doc = cadre.contentDocument;
  if (!doc || !cadre.contentWindow) { cadre.remove(); return false; }
  doc.open();
  // Le titre est du texte, pas du balisage.
  const sur = titre.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${sur}</title><style>
    body{font-family:system-ui,sans-serif;font-size:12px;color:#111;margin:16px}
    h2{font-size:16px;margin:0 0 4px} h3{font-size:12px;margin:16px 0 4px;text-transform:uppercase;letter-spacing:.04em}
    p{margin:2px 0} table{width:100%;border-collapse:collapse}
    td,th{padding:5px 0;text-align:left;border-bottom:1px solid #ddd;font-weight:normal} td:last-child,th:last-child{text-align:right}
    tr.total td{font-weight:bold;border-top:2px solid #111} button,svg{display:none}
  </style></head><body>${element.innerHTML}</body></html>`);
  doc.close();
  cadre.contentWindow.focus();
  cadre.contentWindow.print();
  setTimeout(() => cadre.remove(), 1000);
  return true;
}
