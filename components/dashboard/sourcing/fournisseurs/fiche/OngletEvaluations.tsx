"use client";
// Boucle qualité : évaluation de chaque commande reçue. Ces évaluations sont
// les seules mesures réelles de qualité du fournisseur ; elles alimentent le score.
import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Carte, Bouton, Champ, ChampNombre, CLASSE_CHAMP, Erreur, Kpi, pourcent, envoyer } from "@/components/dashboard/sourcing/ui";
import { BoutonSupprimer, Note, dateCourte, useEcriture, type PropsOnglet } from "./commun";

const NOTES = { qualite: "Qualité", conformite: "Conformité", emballage: "Emballage", delai: "Délai", communication: "Communication" } as const;
type CleNote = keyof typeof NOTES;

interface Saisie { offreId: string; notes: Partial<Record<CleNote, number>>; unitesRecues?: number; unitesDefectueuses?: number; delaiReelJours?: number; commentaire: string }
const SAISIE_VIDE: Saisie = { offreId: "", notes: {}, commentaire: "" };

export function OngletEvaluations({ fiche, recharger }: PropsOnglet) {
  const t = useT();
  const { erreur, enCours, executer } = useEcriture(recharger);
  const [s, setS] = useState(SAISIE_VIDE);
  const maj = (p: Partial<Saisie>) => setS((v) => ({ ...v, ...p }));
  const api = `/api/fournisseurs/${fiche.dossier.id}/evaluations`;
  const { qualite } = fiche.analyse;
  const complet = (Object.keys(NOTES) as CleNote[]).every((c) => s.notes[c]);
  const nomOffre = (id: string | null) => fiche.dossier.offres.find((o) => o.id === id)?.nomProduit;

  const enregistrer = async () => {
    const ok = await executer(() => envoyer(api, "POST", {
      offreId: s.offreId, ...s.notes, unitesRecues: s.unitesRecues ?? 0, unitesDefectueuses: s.unitesDefectueuses ?? 0,
      delaiReelJours: s.delaiReelJours ?? "", commentaire: s.commentaire,
    }));
    if (ok) setS(SAISIE_VIDE);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi libelle="Évaluations" valeur={String(qualite.nbEvaluations)} />
        <Kpi libelle="Note moyenne" valeur={qualite.moyenne === null ? "—" : `${qualite.moyenne.toLocaleString(t.loc, { maximumFractionDigits: 1 })}/5`} />
        <Kpi libelle="Taux de défaut" valeur={pourcent(qualite.tauxDefaut, 1)} />
        <Kpi libelle="Délai réel moyen" valeur={qualite.delaiReelMoyen === null ? "—" : t("{0} jours", Math.round(qualite.delaiReelMoyen))} />
      </div>

      <Carte titre="Évaluer une commande reçue" aide="Ces évaluations alimentent le score du fournisseur : ce sont vos mesures réelles (qualité, taux de défaut, délai constaté), elles remplacent les valeurs déclarées.">
        <div className="space-y-3">
          <Champ label="Offre concernée">
            <select value={s.offreId} onChange={(e) => maj({ offreId: e.target.value })} className={CLASSE_CHAMP}>
              <option value="">{t("Non précisée")}</option>
              {fiche.dossier.offres.map((o) => <option key={o.id} value={o.id}>{o.nomProduit}</option>)}
            </select>
          </Champ>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {(Object.entries(NOTES) as [CleNote, string][]).map(([cle, libelle]) => (
              <div key={cle} className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-[#111111]">{t(libelle)}</span>
                <Note valeur={s.notes[cle]} onChange={(n) => maj({ notes: { ...s.notes, [cle]: n } })} />
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <ChampNombre label="Unités reçues" valeur={s.unitesRecues} onChange={(v) => maj({ unitesRecues: v })} pas={1} />
            <ChampNombre label="Unités défectueuses" valeur={s.unitesDefectueuses} onChange={(v) => maj({ unitesDefectueuses: v })} pas={1} />
            <ChampNombre label="Délai réel" suffixe={t("jours")} valeur={s.delaiReelJours} onChange={(v) => maj({ delaiReelJours: v })} pas={1} />
          </div>
          <Champ label="Commentaire"><textarea value={s.commentaire} rows={3} maxLength={2000} onChange={(e) => maj({ commentaire: e.target.value })} className={CLASSE_CHAMP} /></Champ>
          {erreur && <Erreur message={erreur} />}
          <Bouton onClick={enregistrer} charge={enCours} disabled={!complet}>{t("Enregistrer l'évaluation")}</Bouton>
        </div>
      </Carte>

      <Carte titre="Évaluations enregistrées" aide="Une évaluation ne se modifie pas : supprimez-la et saisissez-la de nouveau.">
        {!fiche.dossier.evaluations.length && <p className="text-[12px] text-[#666666]">{t("Aucune évaluation pour l'instant.")}</p>}
        <ul className="divide-y divide-[#F0F0F0]">
          {fiche.dossier.evaluations.map((e) => (
            <li key={e.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-[12px] font-bold text-[#111111]">{dateCourte(e.createdAt, t.loc)}{nomOffre(e.offreId) && <span className="font-normal text-[#666666]"> · {nomOffre(e.offreId)}</span>}</p>
                <p className="text-[11px] text-[#666666] leading-snug">
                  {(Object.entries(NOTES) as [CleNote, string][]).map(([cle, libelle]) => `${t(libelle)} ${e[cle]}/5`).join(" · ")}
                </p>
                <p className="text-[11px] text-[#666666]">
                  {t("{0} unités reçues, {1} défectueuses", e.unitesRecues, e.unitesDefectueuses)}
                  {e.delaiReelJours != null && <> · {t("Délai réel")} : {t("{0} jours", e.delaiReelJours)}</>}
                </p>
                {e.commentaire && <p className="text-[11px] text-[#666666] leading-snug whitespace-pre-line">{e.commentaire}</p>}
              </div>
              <BoutonSupprimer disabled={enCours} onClick={() => executer(() => envoyer(`${api}?id=${e.id}`, "DELETE"))} />
            </li>
          ))}
        </ul>
      </Carte>
    </div>
  );
}
