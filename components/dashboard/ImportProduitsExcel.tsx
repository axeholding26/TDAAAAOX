"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { useT } from "@/components/I18nProvider";

type Resultat = { importes: number; erreurs: { ligne: number; message: string }[] };

/** Bouton « Importer (Excel) » de la page Produits — appelle /api/produits/importer. */
export function ImportProduitsExcel() {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [resultat, setResultat] = useState<Resultat | null>(null);

  async function importer(fichier: File) {
    setEnvoi(true); setErreur(""); setResultat(null);
    const form = new FormData();
    form.append("fichier", fichier);
    try {
      const res = await fetch("/api/produits/importer", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) setErreur(data.message ?? t("Import impossible"));
      else { setResultat(data); if (data.importes) router.refresh(); }
    } catch {
      setErreur(t("Connexion perdue, réessaie."));
    } finally {
      setEnvoi(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function fermer() { setOuvert(false); setErreur(""); setResultat(null); }

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)}
        className="flex items-center justify-center gap-1.5 text-[12.5px] sm:text-[12px] font-semibold bg-white text-[#111111] border border-[#E8E8E8] rounded-2xl px-4 py-3 sm:py-2 hover:bg-[#F5F5F7] transition-all whitespace-nowrap w-full sm:w-auto flex-shrink-0">
        <FileSpreadsheet size={14} />{" "}{t("Importer (Excel)")}
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={fermer}>
          <div role="dialog" aria-modal="true" aria-labelledby="titre-import" onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 id="titre-import" className="text-[16px] font-bold text-[#111111]">{t("Importer des produits")}</h2>
                <p className="text-[12.5px] text-[#888888] mt-1">{t("Remplis le modèle Excel (une ligne par produit), puis envoie-le. Fichiers .xlsx, .xls ou .csv acceptés.")}</p>
              </div>
              <button type="button" onClick={fermer} aria-label={t("Fermer")} className="p-1.5 rounded-xl hover:bg-[#F5F5F7]"><X size={16} /></button>
            </div>

            <a href="/api/produits/importer" download
              className="flex items-center gap-2 text-[13px] font-semibold text-[#111111] bg-[#F5F5F7] rounded-2xl px-4 py-3 hover:bg-[#EDEDF0] transition-colors">
              <Download size={15} style={{ color: "#F5A623" }} />{" "}{t("Télécharger le modèle Excel")}
            </a>

            <label className={`mt-3 flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl px-4 py-8 text-center cursor-pointer transition-colors ${envoi ? "border-[#F5A623] bg-[#FFFBEB]" : "border-[#E8E8E8] hover:border-[#F5A623]"}`}>
              {envoi ? <Loader2 size={22} className="animate-spin" style={{ color: "#F5A623" }} /> : <Upload size={22} style={{ color: "#F5A623" }} />}
              <span className="text-[13px] font-semibold text-[#111111]">{envoi ? t("Import en cours…") : t("Choisir mon fichier")}</span>
              <span className="text-[11.5px] text-[#AAAAAA]">{t("Colonnes obligatoires : Nom et Prix")}</span>
              <input ref={inputRef} type="file" className="sr-only" disabled={envoi}
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importer(f); }} />
            </label>

            {erreur && <p role="alert" className="mt-3 text-[12.5px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{erreur}</p>}

            {resultat && (
              <div className="mt-3 space-y-2" role="status">
                <p className="text-[13px] font-semibold text-green-700 bg-green-50 rounded-xl px-3 py-2">
                  {resultat.importes}{" "}{t(resultat.importes > 1 ? "produits importés" : "produit importé")}
                </p>
                {resultat.erreurs.length > 0 && (
                  <div className="text-[12px] text-[#D97706] bg-[#FFFBEB] rounded-xl px-3 py-2">
                    <p className="font-semibold mb-1">{resultat.erreurs.length}{" "}{t("ligne(s) ignorée(s) :")}</p>
                    <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                      {resultat.erreurs.map((e) => <li key={e.ligne}>{t("Ligne")}{" "}{e.ligne} — {t(e.message)}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
