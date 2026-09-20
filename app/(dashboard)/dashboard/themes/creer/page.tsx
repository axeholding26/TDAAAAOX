"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileCode, Loader2, Wand2 } from "lucide-react";

type Mode = "librairie" | "import";

export default function CreerThemePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("librairie");

  // ─── Bibliothèque AXSO Design (Templates/*.html) ───────────────────────────
  const [librairie, setLibrairie] = useState<any[]>([]);
  const [provisionnant, setProvisionnant] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/themes").then((r) => r.json()).then((d) => {
      setLibrairie((d.themes || []).filter((t: any) => t.axsoDesign));
    });
  }, []);

  async function utiliserDesignLibrairie(fichier: string, nom: string) {
    setProvisionnant(fichier);
    try {
      const res = await fetch("/api/themes/provisionner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fichier }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Design "${nom}" activé !`);
      router.push("/dashboard/themes");
    } catch {
      toast.error("Erreur lors de l'activation");
    } finally {
      setProvisionnant(null);
    }
  }

  // ─── Import de template — extraction de style par l'IA ────────────────────
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  async function importerDepuisFichier() {
    if (!importFile) { toast.error("Choisissez un fichier .html à analyser"); return; }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error || "Échec de l'envoi du fichier");

      const res = await fetch("/api/themes/importer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: upData.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'analyse du fichier");

      await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId: data.theme.id }),
      });
      toast.success("Thème créé à partir de votre design !");
      router.push("/dashboard/themes");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col bg-gray-50 overflow-hidden h-screen -m-6">
      {/* Header */}
      <header className="h-14 flex items-center gap-3 px-4 bg-white border-b border-gray-200 flex-shrink-0 z-10">
        <button onClick={() => router.push("/dashboard/themes")}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors text-sm">
          <ArrowLeft size={15} /> Retour
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <p className="text-sm font-semibold text-gray-900">Nouveau design</p>
      </header>

      {/* Mode : bibliothèque AXSO Design, ou import de design perso */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0">
        {([["librairie", "Bibliothèque AXSO Design"], ["import", "Importer mon design"]] as [Mode, string][]).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === m ? "bg-[#F5A623]/15 text-[#F5A623]" : "text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {mode === "librairie" ? (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <p className="text-xs text-gray-500 mb-4 max-w-2xl">
            15 designs prêts à l'emploi, pensés pour différents univers. En choisir un crée
            immédiatement une boutique avec vos vrais produits déjà branchés dans la grille.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-6xl">
            {librairie.map((t) => (
              <div key={t.id} className="rounded-2xl border-2 border-gray-200 bg-white overflow-hidden hover:border-gray-300 transition-all">
                <div className="h-24 flex items-center justify-center gap-1.5 p-4" style={{ backgroundColor: t.config?.colors?.fond }}>
                  {[t.config?.colors?.accent, t.config?.colors?.texte, t.config?.colors?.surface].map((c, i) => (
                    <div key={i} className="w-6 h-6 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div className="p-3.5">
                  <p className="text-sm font-bold text-gray-800">{t.nom}</p>
                  <p className="text-[11px] text-gray-400 mb-3 leading-snug">{t.description}</p>
                  <button onClick={() => utiliserDesignLibrairie(t.fichier, t.nom)} disabled={!!provisionnant}
                    className="w-full py-2 rounded-xl text-[11px] font-bold text-white disabled:opacity-50 hover:opacity-90 transition-all bg-[#F5A623]">
                    {provisionnant === t.fichier ? "..." : "Utiliser ce design"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50 p-6">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <Wand2 size={16} className="text-[#F5A623]" />
              <p className="text-sm font-semibold text-gray-900">Importer votre propre design</p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-5">
              Envoyez un fichier HTML de référence (une maquette, un site qui vous plaît).
              Notre IA analyse uniquement son style — couleurs, polices, ambiance — pour créer
              un thème AXSO personnalisé. Le fichier n'est jamais exécuté ni publié tel quel.
            </p>

            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-8 cursor-pointer hover:border-[#F5A623]/50 transition-all">
              <input type="file" accept=".html,text/html" className="hidden"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
              {importFile ? (
                <>
                  <FileCode size={22} className="text-[#F5A623]" />
                  <span className="text-xs font-medium text-gray-700">{importFile.name}</span>
                </>
              ) : (
                <>
                  <Upload size={22} className="text-gray-400" />
                  <span className="text-xs text-gray-500">Cliquez pour choisir un fichier .html</span>
                </>
              )}
            </label>

            <button onClick={importerDepuisFichier} disabled={importing || !importFile}
              className="w-full mt-5 flex items-center justify-center gap-2 bg-[#F5A623] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#d4820a] disabled:opacity-50 transition-all">
              {importing ? <><Loader2 size={14} className="animate-spin" /> Analyse en cours…</> : "Analyser & créer mon thème"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
