"use client";
// Audits & inspections : rapports saisis par le marchand (déclarés tant qu'un
// admin AXSO ne les a pas vérifiés) et prestataires tiers avec leur statut réel.
import { useState } from "react";
import { BadgeCheck, ExternalLink, Plus } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Carte, Pastille, PastilleIntegration, Bouton, Champ, CLASSE_CHAMP, Erreur, envoyer } from "@/components/dashboard/sourcing/ui";
import { PastilleConfiance } from "@/components/dashboard/sourcing/fournisseurs/affichage";
import { TYPES_AUDIT, STATUTS_AUDIT, niveauConfiance } from "@/lib/sourcing/fournisseurs/types";
import { BoutonSupprimer, ChampFichier, LienFichier, dateCourte, useEcriture, type PropsOnglet } from "./commun";

const SAISIE_VIDE = { type: "audit_usine", prestataire: "", statut: "demande", dateAudit: "", reference: "", rapportUrl: "", notes: "" };

export function OngletAudits({ fiche, recharger }: PropsOnglet) {
  const t = useT();
  const { erreur, enCours, executer } = useEcriture(recharger);
  const [s, setS] = useState<typeof SAISIE_VIDE | null>(null);
  const maj = (p: Partial<typeof SAISIE_VIDE>) => setS((v) => v && { ...v, ...p });
  const api = `/api/fournisseurs/${fiche.dossier.id}/audits`;

  return (
    <div className="space-y-4">
      <Carte titre="Audits et inspections" aide="Un audit que vous saisissez est « déclaré » : seule l'équipe AXSO peut le vérifier, en indiquant sa source. Le modifier le fait repasser en « déclaré »."
        actions={!s && <Bouton petit onClick={() => setS(SAISIE_VIDE)}><Plus size={12} />{t("Ajouter")}</Bouton>}>
        {erreur && <div className="mb-3"><Erreur message={erreur} /></div>}
        {s && (
          <div className="space-y-3 mb-4 pb-4 border-b border-[#F0F0F0]">
            <div className="grid sm:grid-cols-2 gap-3">
              <Champ label="Type">
                <select value={s.type} onChange={(e) => maj({ type: e.target.value })} className={CLASSE_CHAMP}>
                  {Object.entries(TYPES_AUDIT).map(([cle, libelle]) => <option key={cle} value={cle}>{t(libelle)}</option>)}
                </select>
              </Champ>
              <Champ label="Prestataire" aide="Ex. SGS, Bureau Veritas, Intertek, QIMA."><input value={s.prestataire} maxLength={200} onChange={(e) => maj({ prestataire: e.target.value })} className={CLASSE_CHAMP} /></Champ>
              <Champ label="Statut">
                <select value={s.statut} onChange={(e) => maj({ statut: e.target.value })} className={CLASSE_CHAMP}>
                  {Object.entries(STATUTS_AUDIT).map(([cle, libelle]) => <option key={cle} value={cle}>{t(libelle)}</option>)}
                </select>
              </Champ>
              <Champ label="Date"><input type="date" value={s.dateAudit} onChange={(e) => maj({ dateAudit: e.target.value })} className={CLASSE_CHAMP} /></Champ>
              <Champ label="Référence" aide="Référence du dossier chez le prestataire."><input value={s.reference} maxLength={120} onChange={(e) => maj({ reference: e.target.value })} className={CLASSE_CHAMP} /></Champ>
              <ChampFichier label="Rapport" url={s.rapportUrl} onChange={(rapportUrl) => maj({ rapportUrl })} />
            </div>
            <Champ label="Notes"><textarea value={s.notes} rows={3} maxLength={2000} onChange={(e) => maj({ notes: e.target.value })} className={CLASSE_CHAMP} /></Champ>
            <div className="flex gap-2 flex-wrap">
              <Bouton charge={enCours} disabled={s.prestataire.trim().length < 2} onClick={async () => { if (await executer(() => envoyer(api, "POST", s))) setS(null); }}>{t("Enregistrer l'audit")}</Bouton>
              <Bouton variante="secondaire" onClick={() => setS(null)}>{t("Annuler")}</Bouton>
            </div>
          </div>
        )}

        {!fiche.dossier.audits.length && !s && <p className="text-[12px] text-[#666666]">{t("Aucun audit enregistré.")}</p>}
        <ul className="divide-y divide-[#F0F0F0]">
          {fiche.dossier.audits.map((a) => {
            // Seul un audit usine réussi ET vérifié par AXSO s'affiche comme tel.
            const reussiVerifie = a.type === "audit_usine" && a.statut === "reussi" && a.confiance === "verifie";
            return (
              <li key={a.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-[#111111]">{t(TYPES_AUDIT[a.type] ?? a.type)}</span>
                    <Pastille ton={a.statut === "reussi" ? "positif" : a.statut === "echoue" ? "attention" : "neutre"}>{t(STATUTS_AUDIT[a.statut] ?? a.statut)}</Pastille>
                    <PastilleConfiance niveau={niveauConfiance(a.confiance)} source={a.sourceVerification} />
                  </div>
                  <p className="text-[11px] text-[#666666]">
                    {[a.prestataire, dateCourte(a.dateAudit, t.loc), a.reference && `${t("Réf.")} ${a.reference}`].filter(Boolean).join(" · ")}
                  </p>
                  {reussiVerifie ? (
                    <p className="text-[12px] font-bold text-[#15803D] flex items-center gap-1.5">
                      <BadgeCheck size={13} />Factory Audit — Passed · {dateCourte(a.dateAudit, t.loc)} · {a.prestataire}
                    </p>
                  ) : a.confiance !== "verifie" && <p className="text-[11px] font-semibold text-[#B45309]">{t("Audit déclaré, non vérifié")}</p>}
                  {a.sourceVerification && <p className="text-[11px] text-[#AAAAAA]">{t("Source de vérification")} : {t(a.sourceVerification)}</p>}
                  {a.notes && <p className="text-[11px] text-[#666666] leading-snug whitespace-pre-line">{a.notes}</p>}
                  {a.rapportUrl && <LienFichier url={a.rapportUrl} libelle="Voir le rapport" />}
                </div>
                <select value={a.statut} disabled={enCours} aria-label={t("Statut")} className={`${CLASSE_CHAMP} !w-auto !py-1 !text-[11px]`}
                  onChange={(e) => executer(() => envoyer(api, "PATCH", { id: a.id, statut: e.target.value }))}>
                  {Object.entries(STATUTS_AUDIT).map(([cle, libelle]) => <option key={cle} value={cle}>{t(libelle)}</option>)}
                </select>
                <BoutonSupprimer disabled={enCours} onClick={() => executer(() => envoyer(`${api}?id=${a.id}`, "DELETE"))} />
              </li>
            );
          })}
        </ul>
      </Carte>

      <Carte titre="Prestataires d'inspection" aide="Aucun de ces services n'est connecté à AXSO aujourd'hui. AXSO ne crée jamais d'audit lui-même : commandez l'inspection sur le site du prestataire, puis enregistrez le rapport ici.">
        <ul className="divide-y divide-[#F0F0F0]">
          {fiche.servicesTiers.map((sv) => (
            <li key={sv.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-bold text-[#111111]">{sv.nom}</span>
                <PastilleIntegration statut={sv.statut} />
                {sv.urlSite && <a href={sv.urlSite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B45309] hover:underline"><ExternalLink size={11} />{t("Site du prestataire")}</a>}
              </div>
              <p className="text-[11px] text-[#666666] mt-0.5 leading-snug">{t(sv.description)}</p>
            </li>
          ))}
        </ul>
      </Carte>
    </div>
  );
}
