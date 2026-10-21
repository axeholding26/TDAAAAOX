"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileCode, Loader2, Wand2, Copy, Sparkles } from "lucide-react";
import { ApercuDesign, parametresApercu, CONFIRMER_CHANGEMENT } from "@/components/dashboard/ApercuDesign";
import { useT } from "@/components/I18nProvider";
import { PROMPTS_IMPORT, validerThemeImporte, type RapportTheme, type TypeImport } from "@/lib/prompt-import-theme";

type Mode = "librairie" | "import";

// Ce que le fichier importé remplace (standard de chacun : lib/prompt-import-theme.ts).
const TYPES_IMPORT: { id: TypeImport; label: string; desc: string }[] = [
  { id: "accueil", label: "Page d'accueil", desc: "Remplace votre accueil ; catalogue, fiche produit et commande restent ceux d'Axso, à vos couleurs." },
  { id: "boutique", label: "Boutique complète", desc: "Accueil et catalogue de votre fichier ; fiche produit, panier, commande, À propos et Contact d'Axso dans son en-tête et son pied de page." },
  { id: "page", label: "Une page en plus", desc: "Ajoute une page (campagne, présentation…) entre votre en-tête et votre pied de page. Votre thème ne change pas." },
];

export default function CreerThemePage() {
  const tr = useT();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("librairie");

  // ─── Bibliothèque AXSO Design (Templates/*.html) ───────────────────────────
  const [librairie, setLibrairie] = useState<any[]>([]);
  const [provisionnant, setProvisionnant] = useState<string | null>(null);

  const [params, setParams] = useState("");
  useEffect(() => {
    fetch("/api/themes").then((r) => r.json()).then((d) => {
      setLibrairie((d.themes || []).filter((t: any) => t.axsoDesign));
    });
    // Aperçus avec les vrais nom, devise et produits de la boutique.
    Promise.all([fetch("/api/tenants/moi").then((r) => r.json()), fetch("/api/produits?limit=24&actif=true").then((r) => r.json())])
      .then(([t, p]) => setParams(parametresApercu(t.tenant, p.produits ?? [])))
      .catch(() => {});
  }, []);

  async function utiliserDesignLibrairie(fichier: string, nom: string) {
    if (!confirm(CONFIRMER_CHANGEMENT(nom))) return;
    setProvisionnant(fichier);
    try {
      const res = await fetch("/api/themes/provisionner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fichier }),
      });
      if (!res.ok) throw new Error();
      toast.success(tr("Design \"{0}\" activé !", nom));
      router.push("/dashboard/themes");
    } catch {
      toast.error(tr("Erreur lors de l'activation"));
    } finally {
      setProvisionnant(null);
    }
  }

  // ─── Import de template — extraction de style par l'IA ────────────────────
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [rapport, setRapport] = useState<RapportTheme | null>(null);
  const [typeImport, setTypeImport] = useState<TypeImport>("accueil");
  const [nomPage, setNomPage] = useState("");
  const prompt = PROMPTS_IMPORT[typeImport];

  async function verifier(f: File | null, type: TypeImport) {
    setRapport(f ? validerThemeImporte(await f.text(), type) : null);
  }
  async function choisirFichier(f: File | null) {
    setImportFile(f);
    await verifier(f, typeImport);
  }
  function choisirType(type: TypeImport) {
    setTypeImport(type);
    verifier(importFile, type);
  }

  async function copierPrompt() {
    try { await navigator.clipboard.writeText(prompt); toast.success(tr("Prompt copié !")); }
    catch { toast.error(tr("Copie impossible : sélectionnez le texte à la main.")); }
  }

  async function importerDepuisFichier() {
    if (!importFile) { toast.error(tr("Choisissez un fichier .html à analyser")); return; }
    if (importFile.size > 300_000) { toast.error(tr("Fichier trop volumineux (300 Ko maximum).")); return; }
    if (rapport?.erreurs.length && !confirm(tr("Ce fichier ne respecte pas le standard (voir la liste). L'importer quand même ?"))) return;
    if (typeImport !== "page" && !confirm(CONFIRMER_CHANGEMENT(importFile.name))) return;
    setImporting(true);
    try {
      // Le HTML est lu ici et envoyé tel quel : pas de passage par le stockage de fichiers.
      const res = await fetch("/api/themes/importer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: await importFile.text(), type: typeImport, ...(nomPage.trim() ? { nomPage: nomPage.trim() } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'analyse du fichier");
      if (typeImport === "page") {
        toast.success(tr("Page « {0} » ajoutée à votre boutique : {1}", data.page.nom, data.page.url));
        router.push(`/dashboard/builder?page=p:${encodeURIComponent(data.page.slug)}`);
        return;
      }

      const activation = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId: data.theme.id }),
      });
      if (!activation.ok) throw new Error("Thème créé, mais son activation a échoué — active-le depuis « Mes thèmes ».");
      toast.success(tr("Thème créé à partir de votre design !"));
      router.push("/dashboard/themes");
    } catch (e: any) {
      toast.error(tr(e?.message) || tr("Erreur lors de l'import"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center gap-3 px-4 bg-white border-b border-gray-200 flex-shrink-0 z-10">
        <button onClick={() => router.push("/dashboard/themes")}
          className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 transition-colors text-sm">
          <ArrowLeft size={15} />{" "}{tr("Retour")}
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <p className="text-sm font-semibold text-gray-900">{tr("Nouveau design")}</p>
      </header>

      {/* Mode : bibliothèque AXSO Design, ou import de design perso */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-gray-100 flex-shrink-0">
        {([["librairie", "Bibliothèque AXSO Design"], ["import", "Importer mon design"]] as [Mode, string][]).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === m ? "bg-[#F5A623]/15 text-[#F5A623]" : "text-gray-500 hover:text-gray-700"}`}>
            {tr(label)}
          </button>
        ))}
      </div>

      {mode === "librairie" ? (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <p className="text-xs text-gray-500 mb-4 max-w-2xl">
            {librairie.length}{" "}{tr("designs choisis pour votre boutique. En choisir un remplace votre design actuel, avec vos vrais produits déjà branchés dans la grille.")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-6xl">
            {librairie.map((t) => (
              <div key={t.id} className="rounded-2xl border-2 border-gray-200 bg-white overflow-hidden hover:border-gray-300 transition-all">
                <ApercuDesign fichier={t.fichier} fond={t.config?.colors?.fond} params={params} className="h-44" />
                <div className="p-3.5">
                  <p className="text-sm font-bold text-gray-800">{tr(t.nom)}</p>
                  <p className="text-[11px] text-gray-400 mb-3 leading-snug">{tr(t.description)}</p>
                  <button onClick={() => utiliserDesignLibrairie(t.fichier, t.nom)} disabled={!!provisionnant}
                    className="w-full py-2 rounded-xl text-[11px] font-bold text-white disabled:opacity-50 hover:opacity-90 transition-all bg-[#F5A623]">
                    {provisionnant === t.fichier ? "..." : tr("Utiliser ce design")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6 flex flex-col items-center gap-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <Wand2 size={16} className="text-[#F5A623]" />
              <p className="text-sm font-semibold text-gray-900">{tr("Importer votre propre design")}</p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-5">
              {tr("Envoyez un fichier HTML : son design et ses textes sont repris tels quels, vos vrais produits branchés dans sa grille, puis vous le modifiez dans le Constructeur. Les scripts sont retirés, jamais exécutés.")}
            </p>

            <p className="text-xs font-semibold text-gray-700 mb-2">{tr("Que contient votre fichier ?")}</p>
            <div role="radiogroup" className="space-y-2 mb-4">
              {TYPES_IMPORT.map((ti) => (
                <button key={ti.id} type="button" role="radio" aria-checked={typeImport === ti.id} onClick={() => choisirType(ti.id)}
                  className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-all ${typeImport === ti.id ? "border-[#F5A623] bg-[#F5A623]/5" : "border-gray-200 hover:border-gray-300"}`}>
                  <span className="block text-xs font-semibold text-gray-900">{tr(ti.label)}</span>
                  <span className="block text-[11px] text-gray-500 leading-snug mt-0.5">{tr(ti.desc)}</span>
                </button>
              ))}
            </div>
            {typeImport === "page" && (
              <input value={nomPage} onChange={(e) => setNomPage(e.target.value)} maxLength={80} placeholder={tr("Nom de la page (sinon le titre du fichier)")}
                className="w-full mb-4 rounded-lg border border-gray-200 px-3 py-2 text-base sm:text-sm outline-none focus:border-[#F5A623]" />
            )}

            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-8 cursor-pointer hover:border-[#F5A623]/50 transition-all">
              <input type="file" accept=".html,text/html" className="hidden"
                onChange={(e) => choisirFichier(e.target.files?.[0] || null)} />
              {importFile ? (
                <>
                  <FileCode size={22} className="text-[#F5A623]" />
                  <span className="text-xs font-medium text-gray-700">{tr(importFile.name)}</span>
                </>
              ) : (
                <>
                  <Upload size={22} className="text-gray-400" />
                  <span className="text-xs text-gray-500">{tr("Cliquez pour choisir un fichier .html")}</span>
                </>
              )}
            </label>

            <button onClick={importerDepuisFichier} disabled={importing || !importFile}
              className="w-full mt-5 flex items-center justify-center gap-2 bg-[#F5A623] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#d4820a] disabled:opacity-50 transition-all">
              {importing ? <><Loader2 size={14} className="animate-spin" />{" "}{tr("Analyse en cours…")}</> : tr(typeImport === "page" ? "Ajouter la page" : "Analyser & créer mon thème")}
            </button>
          </div>

          {/* Fichier choisi : ce qui ne sera pas modifiable dans le Constructeur (lib/prompt-import-theme.ts). */}
          {rapport && (rapport.erreurs.length > 0 || rapport.avertissements.length > 0) && (
            <div className="w-full max-w-md bg-white rounded-2xl border border-amber-200 p-4 text-xs leading-relaxed">
              <p className="font-semibold text-gray-900 mb-2">{tr("Ce fichier ne respecte pas tout le standard Axso")}</p>
              <ul className="list-disc pl-4 space-y-1">
                {rapport.erreurs.map((m) => <li key={m} className="text-red-600">{m}</li>)}
                {rapport.avertissements.map((m) => <li key={m} className="text-gray-600">{m}</li>)}
              </ul>
            </div>
          )}

          {/* Prompt standard à donner à une IA externe pour obtenir un fichier 100 % modifiable. */}
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={16} className="text-[#F5A623]" />
              <p className="text-sm font-semibold text-gray-900">{tr("Faire créer ton thème par une IA")}</p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-3">
              {tr("Copie ce prompt dans ChatGPT, Claude ou une autre IA, décris ta boutique à la fin, puis importe ici le fichier .html obtenu. Il fixe seulement la structure technique : style, couleurs et textes restent libres.")}{" "}
              <strong className="text-gray-700">{tr("Prompt pour : {0}", tr(TYPES_IMPORT.find((ti) => ti.id === typeImport)!.label))}</strong>
            </p>
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 border border-gray-100 p-3 text-[11px] text-gray-700 font-mono select-all">{prompt}</pre>
            <button onClick={copierPrompt}
              className="w-full mt-3 flex items-center justify-center gap-2 border border-[#F5A623] text-[#F5A623] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#F5A623]/10 transition-all">
              <Copy size={14} />{" "}{tr("Copier le prompt")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
