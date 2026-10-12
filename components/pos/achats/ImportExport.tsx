"use client";
// Import / export CSV et XLSX : produits, prix, stock, clients, fournisseurs.
//
// L'import se fait en deux temps, toujours :
// 1. « Vérifier le fichier » : rien n'est écrit. L'écran affiche « N lignes,
//    V valides, E erreurs », le détail par ligne, et un rapport téléchargeable.
// 2. « Importer les lignes valides » : seules elles sont importées, par
//    paquets. Si le serveur rend la main avant la fin (60 s par appel), l'écran
//    renvoie la même demande avec la même clé : l'import reprend où il s'était
//    arrêté, sans doublon.
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { nouvelleCle } from "@/components/pos/crm/appel";
import { Carte, EnTete, Page, useLecture } from "@/components/pos/finance/commun";
import { Bouton, EtatChargement, EtatPos, FOCUS } from "@/components/pos/ui";

type Entite = { id: string; libelle: string; description: string; colonnes: { titre: string; requis: boolean; aide: string | null }[] };
type Definitions = { entites: Entite[]; limites: { octets: number; lignes: number; export: number } };
type ErreurLigne = { ligne: number; colonne: string; message: string };
type Verification = { total: number; valides: number; erreurs: ErreurLigne[]; aCreer: number; aModifier: number };
type Bilan = { termine: boolean; paquets: number; paquetsFaits: number; dejaAppliques: number; total: number; valides: number; erreurs: ErreurLigne[]; crees: number; modifies: number; inchanges: number };
type Refus = { code: string; message: string };

const LIEN = `inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E8E8E8] bg-white px-3 text-[12px] font-bold text-[#111111] hover:border-[#F5A623] ${FOCUS}`;
/** Appels de reprise au plus : 5 000 lignes tiennent largement dedans, et l'écran ne boucle jamais sans fin. */
const REPRISES_MAX = 30;

function telecharger(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: nom });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Envoi du fichier (FormData). Ne lève jamais : rend les données ou un refus en phrase humaine. */
async function envoyer<T>(fichier: File, entite: string, mode: "valider" | "importer", cle?: string): Promise<{ ok: true; donnees: T } | ({ ok: false } & Refus)> {
  const corps = new FormData();
  corps.set("fichier", fichier); corps.set("entite", entite); corps.set("mode", mode);
  if (cle) corps.set("cle", cle);
  let r: Response;
  try { r = await fetch("/api/pos/import", { method: "POST", body: corps, cache: "no-store" }); }
  catch { return { ok: false, code: "hors_ligne", message: "Connexion interrompue. Vérifiez le réseau puis réessayez." }; }
  const json = await r.json().catch(() => null);
  if (r.ok && json) return { ok: true, donnees: json as T };
  return {
    ok: false, code: json?.code ?? (r.status === 403 ? "non_autorise" : r.status === 401 ? "non_connecte" : "erreur_serveur"),
    // 413 sans corps JSON : refus de l'hébergeur avant même la route (fichier trop lourd).
    message: json?.error ?? (r.status === 413 ? "Ce fichier est trop lourd pour être envoyé (4 Mo au plus). Découpez-le en plusieurs fichiers." : "Un problème est survenu. Réessayez dans un instant."),
  };
}

export function ImportExport() {
  const t = useT();
  const { donnees: d, erreur, recharger } = useLecture<Definitions>("/api/pos/import");
  const [entiteId, setEntiteId] = useState("produits");
  const [fichier, setFichier] = useState<File | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [refus, setRefus] = useState<Refus | null>(null);
  const [etape, setEtape] = useState<"repos" | "verification" | "import">("repos");
  const [avancement, setAvancement] = useState<{ faits: number; paquets: number } | null>(null);
  const [exportEnCours, setExportEnCours] = useState<string | null>(null);
  const [noteExport, setNoteExport] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  /** Clé d'import : une par fichier vérifié, gardée pour toutes les reprises et tous les nouveaux essais. */
  const cle = useRef("");

  if (erreur && !d) return <Page><EtatPos code={erreur.code} message={erreur.message} onReessayer={() => void recharger()} /></Page>;
  if (!d) return <Page><EtatChargement texte="Chargement…" /></Page>;
  const entite = d.entites.find((e) => e.id === entiteId) ?? d.entites[0];
  const nombre = (n: number) => n.toLocaleString(t.loc);

  function reinitialiser(f: File | null = null) {
    setFichier(f); setVerification(null); setBilan(null); setRefus(null); setAvancement(null);
    if (!f && champ.current) champ.current.value = "";
  }

  async function verifier() {
    if (!fichier) return;
    if (fichier.size > d!.limites.octets) { setRefus({ code: "invalide", message: "Ce fichier dépasse 4 Mo. Découpez-le en plusieurs fichiers puis importez-les l'un après l'autre." }); return; }
    setEtape("verification"); setRefus(null); setBilan(null);
    const r = await envoyer<Verification>(fichier, entite.id, "valider");
    setEtape("repos");
    if (!r.ok) { setVerification(null); setRefus(r); return; }
    cle.current = nouvelleCle();
    setVerification(r.donnees);
  }

  async function importer() {
    if (!fichier || !verification) return;
    setEtape("import"); setRefus(null); setAvancement({ faits: 0, paquets: 0 });
    for (let tour = 0; tour < REPRISES_MAX; tour++) {
      const r = await envoyer<Bilan>(fichier, entite.id, "importer", cle.current);
      if (!r.ok) { setRefus(r); setEtape("repos"); return; }
      setAvancement({ faits: r.donnees.paquetsFaits, paquets: r.donnees.paquets });
      if (r.donnees.termine) { setBilan(r.donnees); setVerification(null); setEtape("repos"); toast.success(t("Import terminé")); return; }
    }
    setEtape("repos");
    setRefus({ code: "erreur_serveur", message: "L'import avance trop lentement pour se terminer d'une traite. Ce qui est fait est enregistré : relancez « Importer » pour continuer, sans risque de doublon." });
  }

  function rapportErreurs(erreurs: ErreurLigne[]) {
    const cellule = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lignes = [["Ligne", "Colonne", "Erreur"], ...erreurs.map((e) => [e.ligne, e.colonne, e.message])];
    telecharger(new Blob([`﻿${lignes.map((l) => l.map(cellule).join(";")).join("\r\n")}`], { type: "text/csv;charset=utf-8" }), `erreurs-import-${entite.id}.csv`);
  }

  async function exporter(format: "xlsx" | "csv") {
    setExportEnCours(format); setNoteExport(null);
    try {
      const r = await fetch(`/api/pos/export?entite=${entite.id}&format=${format}`, { cache: "no-store" });
      if (!r.ok) { const json = await r.json().catch(() => null); toast.error(t(json?.error ?? "L'export a échoué. Réessayez dans un instant.")); return; }
      telecharger(await r.blob(), `${entite.id}-axso.${format}`);
      const lignes = Number(r.headers.get("x-axso-lignes")) || 0;
      setNoteExport(r.headers.get("x-axso-tronque")
        ? t("Export limité aux {0} premières lignes : le fichier est incomplet.", nombre(d!.limites.export))
        : t("{0} ligne(s) exportée(s).", nombre(lignes)));
    } catch { toast.error(t("Connexion interrompue. Vérifiez le réseau puis réessayez.")); }
    finally { setExportEnCours(null); }
  }

  const erreurs = verification?.erreurs ?? bilan?.erreurs ?? [];
  const occupe = etape !== "repos";

  return (
    <Page>
      <EnTete titre="Import / export" sousTitre="Chargez ou récupérez vos produits, prix, stocks, clients et fournisseurs en Excel ou en CSV. Un fichier est toujours vérifié avant d'être importé." />

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("Type de données")}>
        {d.entites.map((e) => (
          <button key={e.id} type="button" role="tab" aria-selected={entite.id === e.id} disabled={occupe} onClick={() => { setEntiteId(e.id); reinitialiser(); setNoteExport(null); }}
            className={`min-h-11 rounded-xl border px-4 text-[13px] font-bold disabled:opacity-50 ${FOCUS} ${entite.id === e.id ? "border-[#111111] bg-[#111111] text-white" : "border-[#E8E8E8] bg-white text-[#111111]"}`}>
            {t(e.libelle)}
          </button>
        ))}
      </div>

      <Carte titre={`Importer : ${entite.libelle}`}>
        <p className="text-[12.5px] leading-relaxed text-[#444444]">{t(entite.description)}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-[#666666]">
          {t("Limites : {0} lignes et 4 Mo par fichier (au-delà, découpez le fichier). L'import travaille par paquets ; s'il est long, il reprend tout seul jusqu'au bout.", nombre(d.limites.lignes))}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-[#111111]">{t("1. Modèle à remplir")}</span>
          <a className={LIEN} href={`/api/pos/import?modele=${entite.id}&format=xlsx`} download><FileSpreadsheet size={14} aria-hidden />{t("Modèle Excel")}</a>
          <a className={LIEN} href={`/api/pos/import?modele=${entite.id}&format=csv`} download><FileSpreadsheet size={14} aria-hidden />{t("Modèle CSV")}</a>
        </div>
        <details className="mt-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-[12px] font-semibold text-[#B45309]">{t("Colonnes attendues")}</summary>
          <ul className="space-y-1 pb-2 text-[12px] text-[#444444]">
            {entite.colonnes.map((c) => <li key={c.titre}><span className="font-semibold text-[#111111]">{c.titre}</span>{c.requis ? ` (${t("obligatoire")})` : ""}{c.aide ? ` : ${t(c.aide)}` : ""}</li>)}
          </ul>
        </details>

        <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-[#F0F0F0] pt-3">
          <label className="block min-w-0 flex-1 basis-64 text-[12px] font-semibold text-[#111111]">{t("2. Votre fichier (.xlsx ou .csv)")}
            <input ref={champ} type="file" accept=".xlsx,.xls,.csv" disabled={occupe} onChange={(e) => reinitialiser(e.target.files?.[0] ?? null)}
              className={`mt-1 block w-full min-h-11 rounded-xl border border-[#E8E8E8] bg-white p-2 text-[13px] font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-[#111111] file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-white ${FOCUS}`} />
          </label>
          <Bouton variante="sombre" icone={<Upload size={15} aria-hidden />} disabled={!fichier || etape === "import"} charge={etape === "verification"} onClick={() => void verifier()}>{t("Vérifier le fichier")}</Bouton>
        </div>

        <div aria-live="polite" className="mt-3 space-y-3">
          {refus && (refus.code === "non_autorise" || refus.code === "hors_ligne"
            ? <EtatPos code={refus.code} message={refus.message} compact />
            : <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-[12.5px] text-[#B91C1C]">{t(refus.message)}</p>)}

          {verification && (
            <section className="rounded-2xl border border-[#E8E8E8] bg-[#FAFAFA] p-4">
              <p className="text-[15px] font-bold text-[#111111]">
                {t("{0} lignes, {1} valides, {2} erreurs", nombre(verification.total), nombre(verification.valides), nombre(verification.erreurs.length))}
              </p>
              <p className="mt-1 text-[12.5px] text-[#444444]">
                {t("Rien n'a encore été écrit.")} {verification.valides > 0 ? t("L'import créera {0} fiche(s) et en mettra à jour {1}.", nombre(verification.aCreer), nombre(verification.aModifier)) : t("Aucune ligne ne peut être importée : corrigez le fichier puis vérifiez-le de nouveau.")}
                {verification.erreurs.length > 0 && verification.valides > 0 ? ` ${t("Les lignes en erreur seront laissées de côté.")}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Bouton charge={etape === "import"} disabled={!verification.valides} onClick={() => void importer()}>{t("Importer les {0} lignes valides", nombre(verification.valides))}</Bouton>
                {verification.erreurs.length > 0 && <Bouton variante="secondaire" icone={<Download size={15} aria-hidden />} disabled={occupe} onClick={() => rapportErreurs(verification.erreurs)}>{t("Télécharger le rapport d'erreurs")}</Bouton>}
              </div>
              {etape === "import" && avancement && (
                <p role="status" className="mt-2 text-[12.5px] text-[#92400E]">
                  {avancement.paquets ? t("Import en cours : paquet {0} sur {1}. Gardez cette page ouverte.", avancement.faits, avancement.paquets) : t("Import en cours… Gardez cette page ouverte.")}
                </p>
              )}
            </section>
          )}

          {bilan && (
            <section role="status" className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-4 text-[12.5px] text-[#14532D]">
              <p className="flex items-center gap-2 text-[14px] font-bold"><CheckCircle2 size={16} aria-hidden />{t("Import terminé : {0} créée(s), {1} mise(s) à jour.", nombre(bilan.crees), nombre(bilan.modifies))}</p>
              {bilan.inchanges > 0 && <p className="mt-1">{t("{0} ligne(s) déjà à jour : aucun mouvement de stock écrit pour elles.", nombre(bilan.inchanges))}</p>}
              {bilan.dejaAppliques > 0 && <p className="mt-1">{t("{0} paquet(s) avaient déjà été importés : ils n'ont pas été rejoués, aucun doublon n'a été créé.", bilan.dejaAppliques)}</p>}
              {bilan.erreurs.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[#92400E]">
                  <span>{t("{0} ligne(s) en erreur n'ont pas été importées.", nombre(bilan.erreurs.length))}</span>
                  <Bouton variante="secondaire" taille="compact" icone={<Download size={14} aria-hidden />} onClick={() => rapportErreurs(bilan.erreurs)}>{t("Télécharger le rapport d'erreurs")}</Bouton>
                </div>
              )}
              <div className="mt-3"><Bouton variante="secondaire" taille="compact" onClick={() => reinitialiser()}>{t("Importer un autre fichier")}</Bouton></div>
            </section>
          )}

          {erreurs.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-[#E8E8E8]">
              <table className="w-full min-w-[420px] border-collapse text-left text-[12px]">
                <caption className="sr-only">{t("Erreurs du fichier, ligne par ligne")}</caption>
                <thead><tr className="border-b border-[#E8E8E8] bg-[#FAFAFA] text-[11px] uppercase text-[#666666]"><th scope="col" className="px-3 py-2 font-semibold">{t("Ligne")}</th><th scope="col" className="px-3 py-2 font-semibold">{t("Colonne")}</th><th scope="col" className="px-3 py-2 font-semibold">{t("Erreur")}</th></tr></thead>
                <tbody>
                  {erreurs.slice(0, 100).map((e) => <tr key={e.ligne} className="border-b border-[#F0F0F0] last:border-0"><td className="px-3 py-2 tabular-nums">{e.ligne}</td><td className="px-3 py-2">{e.colonne}</td><td className="px-3 py-2 text-[#B91C1C]">{t(e.message)}</td></tr>)}
                </tbody>
              </table>
              {erreurs.length > 100 && <p className="border-t border-[#F0F0F0] px-3 py-2 text-[12px] text-[#666666]">{t("Les 100 premières erreurs sont affichées. Le rapport téléchargeable les contient toutes ({0}).", nombre(erreurs.length))}</p>}
            </div>
          )}
        </div>
      </Carte>

      <Carte titre={`Exporter : ${entite.libelle}`}>
        <p className="text-[12.5px] leading-relaxed text-[#444444]">
          {t("Le fichier reprend les colonnes du modèle : vous pouvez le corriger dans Excel puis le réimporter. {0} lignes au plus par export. Chaque export est inscrit au journal d'audit.", nombre(d.limites.export))}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Bouton variante="secondaire" icone={<Download size={15} aria-hidden />} charge={exportEnCours === "xlsx"} disabled={!!exportEnCours} onClick={() => void exporter("xlsx")}>{t("Exporter en Excel")}</Bouton>
          <Bouton variante="secondaire" icone={<Download size={15} aria-hidden />} charge={exportEnCours === "csv"} disabled={!!exportEnCours} onClick={() => void exporter("csv")}>{t("Exporter en CSV")}</Bouton>
        </div>
        {noteExport && <p role="status" className="mt-2 text-[12.5px] text-[#444444]">{noteExport}</p>}
      </Carte>
    </Page>
  );
}
