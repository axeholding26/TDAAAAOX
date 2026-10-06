"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, Upload, Loader2, Copy, Check, Trash2, Search, Film, FileText } from "lucide-react";
import { toast } from "sonner";
import { televerser } from "@/lib/televerser";
import { TYPES_FICHIERS } from "@/lib/types-fichiers";
import { useT } from "@/components/I18nProvider";

interface Fichier { url: string; nom: string; type: "image" | "video" | "document"; taille: number; date: string }
type Filtre = "tous" | "image" | "video" | "document";
const ACCEPTES = [...TYPES_FICHIERS.image, ...TYPES_FICHIERS.video, ...TYPES_FICHIERS.document];
const categorieDe = (type: string) => (TYPES_FICHIERS.image.includes(type) ? "image" : TYPES_FICHIERS.video.includes(type) ? "video" : "document");

const taille = (o: number) => (o < 1024 * 1024 ? `${Math.max(1, Math.round(o / 1024))} Ko` : `${(o / 1024 / 1024).toFixed(1)} Mo`);
// Nom affiché sans le suffixe aléatoire ajouté par le stockage (photo-AbC123xyz.jpg → photo.jpg).
const nomLisible = (nom: string) => nom.replace(/-[A-Za-z0-9]{20,}(\.[^.]+)$/, "$1");

// Contenu → Fichiers, comme Shopify : images, vidéos et documents de la boutique, à
// importer, retrouver, copier (lien) ou supprimer. Les mêmes fichiers sont
// proposés par « Choisir dans la bibliothèque » du Constructeur.
export default function FichiersPage() {
  const t = useT();
  const [fichiers, setFichiers] = useState<Fichier[]>([]);
  const [suite, setSuite] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [indisponible, setIndisponible] = useState(false);
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [recherche, setRecherche] = useState("");
  const [envoi, setEnvoi] = useState<{ fait: number; total: number } | null>(null);
  const [survolDepot, setSurvolDepot] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  const charger = useCallback(async (curseur?: string) => {
    setChargement(true);
    const params = new URLSearchParams();
    if (filtre !== "tous") params.set("type", filtre);
    if (curseur) params.set("cursor", curseur);
    const r = await fetch(`/api/fichiers?${params}`).catch(() => null);
    const d = r ? await r.json().catch(() => null) : null;
    setIndisponible(r?.status === 503);
    if (r?.ok && d) {
      setFichiers((f) => (curseur ? [...f, ...d.fichiers] : d.fichiers));
      setSuite(d.cursor);
    }
    setChargement(false);
  }, [filtre]);
  useEffect(() => { charger(); }, [charger]);

  const importer = async (liste: FileList | File[]) => {
    const choisis = [...liste].filter((f) => ACCEPTES.includes(f.type));
    if (choisis.length < [...liste].length) toast.error(t("Certains fichiers ont un format non accepté (images, vidéos, PDF, tableurs, textes, audio, ZIP)."));
    if (!choisis.length) return;
    setEnvoi({ fait: 0, total: choisis.length });
    let erreurs = 0;
    for (const [i, f] of choisis.entries()) {
      const fd = new FormData();
      fd.append("file", f);
      const r = await televerser(fd, categorieDe(f.type));
      if (!r.ok) { erreurs++; toast.error(`${f.name} : ${(await r.json().catch(() => ({}))).error ?? t("envoi impossible")}`); }
      setEnvoi({ fait: i + 1, total: choisis.length });
    }
    setEnvoi(null);
    if (erreurs < choisis.length) toast.success(t("Fichiers importés"));
    if (champ.current) champ.current.value = "";
    charger();
  };

  const visibles = fichiers.filter((f) => !recherche.trim() || nomLisible(f.nom).toLowerCase().includes(recherche.trim().toLowerCase()));

  return (
    <div
      className="space-y-6 max-w-6xl"
      onDragOver={(e) => { e.preventDefault(); setSurvolDepot(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSurvolDepot(false); }}
      onDrop={(e) => { e.preventDefault(); setSurvolDepot(false); importer(e.dataTransfer.files); }}
    >
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-12 h-12 rounded-2xl bg-[#F5A623] flex items-center justify-center">
          <FolderOpen size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 font-poppins">{t("Fichiers")}</h1>
          <p className="text-gray-400 text-sm">{t("Les images, vidéos et documents de votre boutique, réutilisables partout (constructeur, pages, liens…).")}</p>
        </div>
        <input ref={champ} type="file" multiple accept={ACCEPTES.join(",")} className="hidden" onChange={(e) => e.target.files && importer(e.target.files)} />
        <button onClick={() => champ.current?.click()} disabled={!!envoi || indisponible}
          className="h-10 flex items-center gap-2 px-4 rounded-lg text-[14px] font-semibold bg-[#F5A623] text-[#111111] hover:bg-[#E8990F] disabled:opacity-50 transition-colors">
          {envoi ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {envoi ? `${t("Import…")} ${envoi.fait}/${envoi.total}` : t("Importer des fichiers")}
        </button>
      </div>

      {indisponible ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4">
          {t("Le stockage des fichiers n'est pas configuré sur ce serveur : la bibliothèque est indisponible.")}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
              {([["tous", "Tous"], ["image", "Images"], ["video", "Vidéos"], ["document", "Documents"]] as [Filtre, string][]).map(([v, l]) => (
                <button key={v} onClick={() => setFiltre(v)} aria-pressed={filtre === v}
                  className={`px-3.5 py-1.5 rounded-md text-[13.5px] font-medium transition-colors ${filtre === v ? "bg-[#FFF1D6] text-[#C77C0A]" : "text-gray-500 hover:text-gray-800"}`}>
                  {t(l)}
                </button>
              ))}
            </div>
            <label className="flex-1 min-w-[200px] flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-200 bg-white focus-within:border-[#F5A623]">
              <Search size={15} className="text-gray-400" />
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t("Rechercher un fichier")} className="flex-1 text-[14px] outline-none bg-transparent" />
            </label>
          </div>

          <div className={`rounded-2xl border-2 border-dashed p-4 transition-colors ${survolDepot ? "border-[#F5A623] bg-[#FFF7EA]" : "border-transparent"}`}>
            {chargement && !fichiers.length ? (
              <div className="py-16 flex justify-center"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
            ) : !visibles.length ? (
              <button onClick={() => champ.current?.click()} className="w-full py-16 rounded-xl border border-dashed border-gray-300 text-gray-400 hover:border-[#F5A623] hover:text-[#C77C0A] transition-colors">
                <Upload size={22} className="mx-auto mb-2" />
                <span className="text-sm">{recherche ? t("Aucun fichier ne correspond.") : t("Aucun fichier pour l'instant — importez-en ou glissez-les ici.")}</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {visibles.map((f) => <Carte key={f.url} fichier={f} onSupprime={() => setFichiers((l) => l.filter((x) => x.url !== f.url))} />)}
              </div>
            )}
          </div>
          {suite && (
            <button onClick={() => charger(suite)} disabled={chargement} className="mx-auto block h-10 px-5 rounded-lg border border-gray-200 bg-white text-[14px] font-medium text-gray-600 hover:border-gray-300 disabled:opacity-50">
              {chargement ? t("Chargement…") : t("Afficher plus")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Carte({ fichier: f, onSupprime }: { fichier: Fichier; onSupprime: () => void }) {
  const t = useT();
  const [copie, setCopie] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [suppression, setSuppression] = useState(false);

  const copier = () => { navigator.clipboard.writeText(f.url); setCopie(true); setTimeout(() => setCopie(false), 1500); };
  const supprimer = async () => {
    setSuppression(true);
    const r = await fetch("/api/fichiers", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: f.url }) }).catch(() => null);
    setSuppression(false);
    if (r?.ok) { onSupprime(); toast.success(t("Fichier supprimé")); } else toast.error(t("Suppression impossible"));
  };

  return (
    <div className="group rounded-xl border border-gray-200 bg-white overflow-hidden">
      <a href={f.url} target="_blank" rel="noopener noreferrer" className="block aspect-square bg-gray-50 relative">
        {f.type === "document"
          ? <span className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-gray-400"><FileText size={30} /><span className="text-[12px] font-semibold uppercase">{f.nom.split(".").pop()}</span></span>
          : f.type === "video"
          ? <><video src={f.url} muted preload="metadata" className="w-full h-full object-cover" /><Film size={16} className="absolute top-2 left-2 text-white drop-shadow" /></>
          : <img src={f.url} alt={nomLisible(f.nom)} loading="lazy" className="w-full h-full object-cover" />}
      </a>
      <div className="p-2.5">
        <p className="text-[13px] font-medium text-gray-800 truncate" title={nomLisible(f.nom)}>{nomLisible(f.nom)}</p>
        <p className="text-[12px] text-gray-400">{taille(f.taille)} · {new Date(f.date).toLocaleDateString()}</p>
        {confirmer ? (
          <div className="mt-2 space-y-1.5">
            <p className="text-[12px] text-red-600 leading-snug">{t("Supprimer ? Il disparaîtra aussi des pages qui l'utilisent.")}</p>
            <div className="flex gap-1.5">
              <button onClick={supprimer} disabled={suppression} className="flex-1 h-8 rounded-md bg-red-500 text-white text-[12.5px] font-semibold hover:bg-red-600 disabled:opacity-50">
                {suppression ? <Loader2 size={13} className="animate-spin mx-auto" /> : t("Supprimer")}
              </button>
              <button onClick={() => setConfirmer(false)} className="flex-1 h-8 rounded-md border border-gray-200 text-[12.5px] text-gray-600">{t("Annuler")}</button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex gap-1.5">
            <button onClick={copier} className="flex-1 h-8 flex items-center justify-center gap-1 rounded-md border border-gray-200 text-[12.5px] text-gray-600 hover:border-gray-300">
              {copie ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}{" "}{copie ? t("Copié") : t("Copier le lien")}
            </button>
            <button onClick={() => setConfirmer(true)} title={t("Supprimer")} aria-label={t("Supprimer")} className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
