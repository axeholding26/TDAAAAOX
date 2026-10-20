"use client";

// Glisser-déposer des fichiers d'un import IA : envoi direct du navigateur vers le stockage
// (aucune limite de 4,5 Mo), puis un seul appel qui consomme le lien et lance l'import.
import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { UploadCloud, FileText, Image as ImageIcon, X, Loader2, CheckCircle2 } from "lucide-react";
import { useT } from "@/components/I18nProvider";

interface Choisi { file: File; role: "fichier" | "visuel" }

const LIBELLES: Record<string, string> = {
  published: "Produit publié", ready_for_review: "Produit créé, prêt à publier", assets_attached: "Produit créé en brouillon",
  retrying: "Nouvelle tentative prévue", failed: "Échec",
};

export default function DepotClient({ jeton, dossier, expireLe, fichierRequis }: { jeton: string; dossier: string; expireLe: string; fichierRequis: boolean }) {
  const t = useT();
  const [choisis, setChoisis] = useState<Choisi[]>([]);
  const [survol, setSurvol] = useState(false);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ status: string; last_error: string | null } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Refusés aussi à l'import (lib/import-creations/regles.ts) : on le dit avant l'envoi.
  const ajouter = (liste: FileList | null) => {
    if (!liste) return;
    const tous = Array.from(liste);
    const refuses = tous.filter((f) => /\.(x?html?|svg|js|mjs|exe|msi|bat|cmd|sh|ps1|apk|jar|dll|scr|vbs|php)$/i.test(f.name));
    setErreur(refuses.length ? `${refuses.map((f) => f.name).join(", ")} : ${t(/\.x?html?$/i.test(refuses[0].name) ? "les pages web HTML ne sont pas acceptées. Compresse le jeu ou la page (avec ses images) dans une archive .zip, puis dépose le .zip." : "fichier exécutable ou script refusé.")}` : null);
    setChoisis((c) => [...c, ...tous.filter((f) => !refuses.includes(f)).map((file) => ({ file, role: file.type.startsWith("image/") ? "visuel" as const : "fichier" as const }))].slice(0, 13));
  };

  async function envoyer() {
    setErreur(null);
    try {
      const fichiers = [];
      for (const [i, c] of choisis.entries()) {
        setEnvoi(`${t("Envoi")} ${i + 1}/${choisis.length} — ${c.file.name}`);
        const sous = Math.random().toString(36).slice(2, 10);
        const blob = await upload(`${dossier}${sous}/${c.file.name.replace(/[\\/]/g, "-")}`, c.file, {
          access: "public", handleUploadUrl: `/api/depot/${jeton}`, contentType: c.file.type || "application/octet-stream",
        });
        fichiers.push({ url: blob.url, nom: c.file.name, role: c.role });
      }
      setEnvoi(t("Création du produit…"));
      const r = await fetch(`/api/depot/${jeton}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fichiers }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t("Envoi impossible"));
      setResultat(j);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : t("Envoi impossible"));
    } finally {
      setEnvoi(null);
    }
  }

  if (resultat) {
    const ok = resultat.status !== "failed";
    return (
      <div className={`mt-6 rounded-xl p-4 ${ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
        <p className="font-semibold flex items-center gap-2">{ok && <CheckCircle2 size={18} />}{t(LIBELLES[resultat.status] ?? resultat.status)}</p>
        {resultat.last_error && <p className="text-sm mt-1">{resultat.last_error}</p>}
        <p className="text-sm mt-2">{t("Tu peux retourner dans ta conversation : ton assistant voit l'avancement. Le suivi est aussi dans Axso → Produits → Imports IA.")}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <label
        onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => { e.preventDefault(); setSurvol(false); ajouter(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 cursor-pointer text-center transition ${survol ? "border-[#F5A623] bg-[#FFF7ED]" : "border-gray-200 hover:border-gray-300"}`}
      >
        <UploadCloud size={28} className="text-[#F5A623]" />
        <span className="text-sm font-medium text-gray-800">{t("Glisse ici le fichier à vendre et ses visuels")}</span>
        <span className="text-xs text-gray-400">{t("PDF, DOCX, XLSX, PPTX, CSV, ZIP, MP3, MP4 — 50 Mo max ; images PNG, JPEG, WebP — 5 Mo max")}</span>
        <input type="file" multiple className="sr-only" onChange={(e) => ajouter(e.target.files)} />
      </label>

      {choisis.length > 0 && (
        <ul className="space-y-2">
          {choisis.map((c, i) => (
            <li key={i} className="flex items-center gap-3 border border-gray-100 rounded-lg px-3 py-2 text-sm">
              {c.role === "visuel" ? <ImageIcon size={16} className="text-gray-400" /> : <FileText size={16} className="text-gray-400" />}
              <span className="flex-1 truncate">{c.file.name}</span>
              <select
                value={c.role}
                onChange={(e) => setChoisis((l) => l.map((x, j) => (j === i ? { ...x, role: e.target.value as Choisi["role"] } : x)))}
                className="border border-gray-200 rounded-md px-2 py-1 text-xs"
                aria-label={t("Rôle du fichier")}
              >
                <option value="fichier">{t("Fichier vendu")}</option>
                {c.file.type.startsWith("image/") && <option value="visuel">{t("Visuel")}</option>}
              </select>
              <button onClick={() => setChoisis((l) => l.filter((_, j) => j !== i))} aria-label={t("Retirer")} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      <button
        disabled={!choisis.length || (fichierRequis && !choisis.some((c) => c.role === "fichier")) || !!envoi}
        onClick={envoyer}
        className="w-full rounded-xl bg-[#F5A623] text-white font-semibold py-3 disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {envoi ? <><Loader2 size={16} className="animate-spin" />{envoi}</> : t("Envoyer et créer le produit")}
      </button>
      <p className="text-xs text-gray-400 text-center">
        {t("Lien à usage unique, valable jusqu'à")} {new Date(expireLe).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}
