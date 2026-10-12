"use client";
// Documents & certifications : ce que la catégorie des produits rend
// potentiellement nécessaire, puis les pièces déposées avec leur statut de
// vérification tel que renvoyé par l'API (jamais modifiable ici).
import { useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Carte, Pastille, Bouton, Champ, CLASSE_CHAMP, Erreur, envoyer } from "@/components/dashboard/sourcing/ui";
import { PastilleCertification, PastilleConfiance } from "@/components/dashboard/sourcing/fournisseurs/affichage";
import { TYPES_DOCUMENT, niveauConfiance } from "@/lib/sourcing/fournisseurs/types";
import { BoutonSupprimer, ChampFichier, LienFichier, dateCourte, joursAvant, useEcriture, type PropsOnglet } from "./commun";

const SAISIE_VIDE = { type: "certificat", certification: "", nom: "", url: "", organismeEmetteur: "", numero: "", dateEmission: "", dateExpiration: "" };

export function OngletDocuments({ fiche, recharger }: PropsOnglet) {
  const t = useT();
  const { erreur, enCours, executer } = useEcriture(recharger);
  const [s, setS] = useState<typeof SAISIE_VIDE | null>(null);
  const maj = (p: Partial<typeof SAISIE_VIDE>) => setS((v) => v && { ...v, ...p });
  const api = `/api/fournisseurs/${fiche.dossier.id}/documents`;
  const { certifications, noteConformitePays } = fiche.analyse;

  return (
    <div className="space-y-4">
      <Carte titre="Certifications potentiellement nécessaires" aide="Déduites de la catégorie des produits et du pays de destination. Ce sont des certifications potentiellement nécessaires, à confirmer avec votre transitaire ou l'autorité compétente : AXSO ne garantit pas la conformité.">
        {certifications.length ? (
          <ul className="space-y-2">
            {certifications.map((c) => (
              <li key={c.code} className="flex items-start gap-2 flex-wrap text-[12px]">
                <PastilleCertification c={c} />
                <span className="text-[#666666] leading-snug flex-1 min-w-[180px]">{t(c.note)} <span className="text-[#AAAAAA]">· {t(c.source)}</span></span>
                {c.alerte && <span className="text-[#B91C1C] font-semibold w-full">{t(c.alerte)}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-[12px] text-[#666666]">{t("Aucune certification identifiée pour les catégories renseignées. Indiquez la catégorie de chaque offre pour obtenir cette liste.")}</p>}
        {noteConformitePays && <p className="text-[12px] text-[#666666] mt-3 pt-3 border-t border-[#F0F0F0] leading-snug">{t(noteConformitePays)}</p>}
      </Carte>

      <Carte titre="Documents déposés" aide="La vérification est faite par l'équipe AXSO, qui indique sa source. Un document déposé est « déclaré par le fournisseur » ; un document modifié repasse en « déclaré »."
        actions={!s && <Bouton petit onClick={() => setS(SAISIE_VIDE)}><Plus size={12} />{t("Ajouter")}</Bouton>}>
        {erreur && <div className="mb-3"><Erreur message={erreur} /></div>}
        {s && (
          <div className="space-y-3 mb-4 pb-4 border-b border-[#F0F0F0]">
            <div className="grid sm:grid-cols-2 gap-3">
              <Champ label="Type">
                <select value={s.type} onChange={(e) => maj({ type: e.target.value })} className={CLASSE_CHAMP}>
                  {Object.entries(TYPES_DOCUMENT).map(([cle, libelle]) => <option key={cle} value={cle}>{t(libelle)}</option>)}
                </select>
              </Champ>
              <Champ label="Certification" aide="Pour un certificat : CE, RoHS, FCC, ISO 9001…"><input value={s.certification} maxLength={60} onChange={(e) => maj({ certification: e.target.value })} className={CLASSE_CHAMP} /></Champ>
              <Champ label="Nom du document"><input value={s.nom} maxLength={200} onChange={(e) => maj({ nom: e.target.value })} className={CLASSE_CHAMP} /></Champ>
              <ChampFichier label="Fichier" url={s.url} onChange={(url) => maj({ url })} />
              <Champ label="Organisme émetteur"><input value={s.organismeEmetteur} onChange={(e) => maj({ organismeEmetteur: e.target.value })} className={CLASSE_CHAMP} /></Champ>
              <Champ label="Numéro"><input value={s.numero} onChange={(e) => maj({ numero: e.target.value })} className={CLASSE_CHAMP} /></Champ>
              <Champ label="Date d'émission"><input type="date" value={s.dateEmission} onChange={(e) => maj({ dateEmission: e.target.value })} className={CLASSE_CHAMP} /></Champ>
              <Champ label="Date d'expiration"><input type="date" value={s.dateExpiration} onChange={(e) => maj({ dateExpiration: e.target.value })} className={CLASSE_CHAMP} /></Champ>
            </div>
            <p className="text-[11px] text-[#AAAAAA] leading-snug">{t("Sans fichier, la certification reste non vérifiable.")}</p>
            <div className="flex gap-2 flex-wrap">
              <Bouton charge={enCours} disabled={s.nom.trim().length < 2} onClick={async () => { if (await executer(() => envoyer(api, "POST", s))) setS(null); }}>{t("Enregistrer le document")}</Bouton>
              <Bouton variante="secondaire" onClick={() => setS(null)}>{t("Annuler")}</Bouton>
            </div>
          </div>
        )}

        {!fiche.dossier.documents.length && !s && <p className="text-[12px] text-[#666666]">{t("Aucun document déposé.")}</p>}
        <ul className="divide-y divide-[#F0F0F0]">
          {fiche.dossier.documents.map((d) => {
            const jours = d.dateExpiration ? joursAvant(d.dateExpiration) : null;
            return (
              <li key={d.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-[#111111]">{d.nom}</span>
                    {d.statutVerification === "rejete"
                      ? <span title={d.sourceVerification ? t(d.sourceVerification) : undefined}><Pastille ton="attention">{t("Rejeté")}</Pastille></span>
                      : <PastilleConfiance niveau={niveauConfiance(d.statutVerification)} source={d.sourceVerification} />}
                  </div>
                  <p className="text-[11px] text-[#666666] leading-snug">
                    {[t(TYPES_DOCUMENT[d.type] ?? d.type), d.certification, d.organismeEmetteur, d.numero && `${t("N°")} ${d.numero}`].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-[11px] text-[#666666]">
                    {t("Émis le {0}", dateCourte(d.dateEmission, t.loc))} · {t("Expire le {0}", dateCourte(d.dateExpiration, t.loc))}
                  </p>
                  {d.sourceVerification && <p className="text-[11px] text-[#AAAAAA]">{t("Source de vérification")} : {t(d.sourceVerification)}</p>}
                  {jours !== null && jours <= 60 && (
                    <p className="text-[11px] font-semibold flex items-center gap-1" style={{ color: jours < 0 ? "#B91C1C" : "#B45309" }}>
                      <AlertTriangle size={11} />
                      {jours < 0 ? t("Certification expirée — ne plus considérer comme vérifiée.") : t("Certification expire dans {0} jours.", jours)}
                    </p>
                  )}
                  {d.url ? <LienFichier url={d.url} /> : <p className="text-[11px] text-[#AAAAAA]">{t("Aucun fichier joint : non vérifiable.")}</p>}
                </div>
                <BoutonSupprimer disabled={enCours} onClick={() => executer(() => envoyer(`${api}?id=${d.id}`, "DELETE"))} />
              </li>
            );
          })}
        </ul>
      </Carte>
    </div>
  );
}
