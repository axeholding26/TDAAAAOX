"use client";
// Fichiers livrés d'un produit « fichier » : remplacer (nouvelle version), supprimer, ajouter —
// chaque action est enregistrée tout de suite. Et, pour tout produit à télécharger, l'annonce
// « nouvelle version » envoyée par e-mail aux acheteurs (leur lien d'accès reste le même).
// Nouvelle version PAYANTE : produit séparé, et offre (code promo réservé) aux anciens acheteurs.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus, FileText, Loader2, Mail, Plus, RefreshCw, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { televerser } from "@/lib/televerser";
import { useT } from "@/components/I18nProvider";

interface Fichier { id: string; nom: string; taille: number | null; mimeType: string | null }

const taille = (o: number | null) => (!o ? "" : o < 1024 ** 2 ? `${Math.round(o / 1024)} Ko` : `${(o / 1024 ** 2).toFixed(1)} Mo`);

async function envoyer(file: File) {
  const fd = new FormData(); fd.append("file", file);
  const res = await televerser(fd);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur upload");
  return { nom: file.name, url: data.url as string, taille: file.size, mimeType: file.type };
}

export function FichiersLivres({ produitId }: { produitId: string }) {
  const tr = useT();
  const [fichiers, setFichiers] = useState<Fichier[] | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null); // id du fichier en cours, ou "ajout"
  const ajoutRef = useRef<HTMLInputElement>(null);
  const remplaceRef = useRef<HTMLInputElement>(null);
  const cible = useRef<string | null>(null);

  const charger = useCallback(async () => {
    const r = await fetch(`/api/produits/digitaux/${produitId}`).catch(() => null);
    const d = r?.ok ? await r.json() : null;
    setFichiers(d?.produit?.produitFichier?.fichiers ?? []);
  }, [produitId]);
  useEffect(() => { charger(); }, [charger]);

  async function action(cle: string, travail: () => Promise<Response>, succes: string) {
    setOccupe(cle);
    try {
      const r = await travail();
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Erreur");
      toast.success(tr(succes));
      await charger();
    } catch (e: any) { toast.error(tr(e.message)); }
    finally { setOccupe(null); }
  }

  const ajouter = (files: File[]) => action("ajout", async () => {
    const nouveaux = await Promise.all(files.map(envoyer));
    return fetch(`/api/produits/digitaux/${produitId}/fichiers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fichiers: nouveaux }) });
  }, "Fichier ajouté");

  const remplacer = (id: string, file: File) => action(id, async () => {
    const nouveau = await envoyer(file);
    return fetch(`/api/produits/digitaux/${produitId}/fichiers/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nouveau) });
  }, "Fichier remplacé");

  const supprimer = (id: string) => action(id, () => fetch(`/api/produits/digitaux/${produitId}/fichiers/${id}`, { method: "DELETE" }), "Fichier supprimé");

  if (!fichiers) return <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-purple-400" /></div>;

  return (
    <div className="space-y-2">
      {fichiers.length === 0 && <p className="text-sm text-red-500">{tr("Aucun fichier : les acheteurs ne reçoivent rien. Ajoute au moins un fichier.")}</p>}
      {fichiers.map((f) => (
        <div key={f.id} className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl p-3">
          <FileText size={18} className="text-purple-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{f.nom}</p>
            <p className="text-xs text-gray-400">{taille(f.taille)}</p>
          </div>
          {occupe === f.id ? <Loader2 size={16} className="animate-spin text-purple-400" /> : (
            <>
              <button onClick={() => { cible.current = f.id; remplaceRef.current?.click(); }} disabled={!!occupe}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 disabled:opacity-50"><RefreshCw size={13} />{tr("Remplacer")}</button>
              {/* Le dernier fichier ne se supprime pas : on le remplace, sinon les acheteurs n'auraient plus rien. */}
              {fichiers.length > 1 && (
                <button onClick={() => supprimer(f.id)} disabled={!!occupe} aria-label={tr("Supprimer")}
                  className="text-red-400 hover:text-red-600 disabled:opacity-50"><Trash2 size={15} /></button>
              )}
            </>
          )}
        </div>
      ))}
      <button onClick={() => ajoutRef.current?.click()} disabled={!!occupe}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-purple-200 rounded-xl p-3 text-sm text-purple-600 hover:border-purple-400 disabled:opacity-50">
        {occupe === "ajout" ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}{tr("Ajouter un fichier")}
      </button>
      <input ref={ajoutRef} type="file" multiple className="hidden"
        onChange={(e) => { const l = [...(e.target.files ?? [])]; e.target.value = ""; if (l.length) ajouter(l); }} />
      <input ref={remplaceRef} type="file" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && cible.current) remplacer(cible.current, f); }} />
    </div>
  );
}

/** Annonce par e-mail d'une nouvelle version aux acheteurs du produit. */
export function PrevenirAcheteurs({ produitId, aEnregistrer }: { produitId: string; aEnregistrer?: boolean }) {
  const tr = useT();
  const [acheteurs, setAcheteurs] = useState<number | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    fetch(`/api/produits/digitaux/${produitId}/mise-a-jour`).then((r) => (r.ok ? r.json() : null)).then((d) => setAcheteurs(d?.acheteurs ?? 0)).catch(() => setAcheteurs(0));
  }, [produitId]);

  async function prevenir() {
    setEnvoi(true);
    try {
      const r = await fetch(`/api/produits/digitaux/${produitId}/mise-a-jour`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Erreur");
      toast.success(tr("E-mail en cours d'envoi à {0} acheteur(s)", d.acheteurs));
      setConfirmer(false);
    } catch (e: any) { toast.error(tr(e.message)); }
    finally { setEnvoi(false); }
  }

  if (!acheteurs) return null;
  return (
    <div className="border-t border-purple-100 pt-4 space-y-2">
      <p className="text-xs text-gray-500">
        {tr("Les {0} acheteur(s) reçoivent déjà la nouvelle version avec leur lien habituel. Tu peux les prévenir par e-mail.", acheteurs)}
        {aEnregistrer && ` ${tr("Enregistre d'abord le produit.")}`}
      </p>
      {!confirmer ? (
        <button onClick={() => setConfirmer(true)} className="flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-900">
          <Mail size={15} />{tr("Prévenir les acheteurs de la mise à jour")}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-700">{tr("Envoyer un e-mail à {0} acheteur(s) ?", acheteurs)}</span>
          <button onClick={prevenir} disabled={envoi} className="flex items-center gap-1.5 text-sm bg-purple-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
            {envoi && <Loader2 size={13} className="animate-spin" />}{tr("Envoyer")}
          </button>
          <button onClick={() => setConfirmer(false)} disabled={envoi} className="text-sm text-gray-500">{tr("Annuler")}</button>
        </div>
      )}
    </div>
  );
}

interface Offre { code: string; valeur: number; utilisations: number; maxUtilisations: number | null; dateExpiration: string | null }

/** Créer une nouvelle version payante ; sur cette nouvelle version, l'offre aux acheteurs de la précédente. */
export function NouvelleVersion({ produitId, actif }: { produitId: string; actif: boolean }) {
  const tr = useT();
  const router = useRouter();
  const [infos, setInfos] = useState<{ precedente: { id: string; nom: string } | null; acheteurs?: number; offres?: Offre[] } | null>(null);
  const [creation, setCreation] = useState(false);
  const [pourcentage, setPourcentage] = useState("30");
  const [jours, setJours] = useState("30");
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(() => {
    fetch(`/api/produits/digitaux/${produitId}/nouvelle-version`).then((r) => (r.ok ? r.json() : null)).then(setInfos).catch(() => setInfos({ precedente: null }));
  }, [produitId]);
  useEffect(() => { charger(); }, [charger]);

  async function creer() {
    setCreation(true);
    try {
      const r = await fetch(`/api/produits/digitaux/${produitId}/nouvelle-version`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Erreur");
      toast.success(tr("Nouvelle version créée en brouillon : ajoute ses fichiers puis publie-la"));
      router.push(`/dashboard/produits/${d.id}`);
    } catch (e: any) { toast.error(tr(e.message)); setCreation(false); }
  }

  async function envoyerOffre() {
    setEnvoi(true);
    try {
      const r = await fetch(`/api/produits/digitaux/${produitId}/nouvelle-version`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offre: { pourcentage: Number(pourcentage), jours: Number(jours) } }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Erreur");
      toast.success(tr("Offre {0} envoyée à {1} acheteur(s)", d.code, d.acheteurs));
      setConfirmer(false);
      charger();
    } catch (e: any) { toast.error(tr(e.message)); }
    finally { setEnvoi(false); }
  }

  if (!infos) return null;
  const champ = "w-20 h-9 px-2 rounded-lg border border-gray-200 text-sm";

  if (!infos.precedente) return (
    <div className="border-t border-purple-100 pt-4 space-y-2">
      <p className="text-xs text-gray-500">{tr("Grosse refonte à vendre à part ? Crée une nouvelle version payante : un produit séparé, en brouillon, sans fichiers. Les acheteurs actuels gardent leur accès à cette version-ci.")}</p>
      <button onClick={creer} disabled={creation} className="flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-900 disabled:opacity-50">
        {creation ? <Loader2 size={15} className="animate-spin" /> : <CopyPlus size={15} />}{tr("Créer une nouvelle version payante")}
      </button>
    </div>
  );

  return (
    <div className="border-t border-purple-100 pt-4 space-y-3">
      <p className="text-sm text-gray-700"><Tag size={14} className="inline mr-1 text-purple-500" />{tr("Nouvelle version de « {0} »", infos.precedente.nom)}</p>
      {!actif ? (
        <p className="text-xs text-gray-500">{tr("Publie cette version pour pouvoir envoyer une offre à ses {0} acheteur(s).", infos.acheteurs ?? 0)}</p>
      ) : !infos.acheteurs ? (
        <p className="text-xs text-gray-500">{tr("La version précédente n'a aucun acheteur joignable par e-mail.")}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">{tr("Envoie aux {0} acheteur(s) de la version précédente un code de réduction valable uniquement sur cette version.", infos.acheteurs)}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span>{tr("Réduction")}</span><input type="number" min={1} max={100} value={pourcentage} onChange={(e) => setPourcentage(e.target.value)} className={champ} /><span>%</span>
            <span className="ml-2">{tr("pendant")}</span><input type="number" min={1} max={365} value={jours} onChange={(e) => setJours(e.target.value)} className={champ} /><span>{tr("jours")}</span>
          </div>
          {!confirmer ? (
            <button onClick={() => setConfirmer(true)} className="flex items-center gap-2 text-sm font-medium text-purple-700 hover:text-purple-900">
              <Mail size={15} />{tr("Envoyer l'offre aux anciens acheteurs")}
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-700">{tr("-{0} % pendant {1} jours, e-mail à {2} acheteur(s) ?", pourcentage, jours, infos.acheteurs)}</span>
              <button onClick={envoyerOffre} disabled={envoi} className="flex items-center gap-1.5 text-sm bg-purple-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                {envoi && <Loader2 size={13} className="animate-spin" />}{tr("Envoyer")}
              </button>
              <button onClick={() => setConfirmer(false)} disabled={envoi} className="text-sm text-gray-500">{tr("Annuler")}</button>
            </div>
          )}
        </div>
      )}
      {!!infos.offres?.length && (
        <ul className="text-xs text-gray-500 space-y-1">
          {infos.offres.map((o) => (
            <li key={o.code}>
              <strong className="text-gray-700">{o.code}</strong>{` · -${o.valeur} % · ${o.utilisations}/${o.maxUtilisations ?? "∞"} ${tr("utilisé(s)")}`}
              {o.dateExpiration && ` · ${tr("jusqu'au {0}", new Date(o.dateExpiration).toLocaleDateString())}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
