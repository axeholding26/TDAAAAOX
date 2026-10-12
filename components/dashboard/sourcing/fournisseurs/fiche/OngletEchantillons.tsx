"use client";
// Échantillons : demande avant un gros achat (message à envoyer soi-même),
// suivi du statut, puis checklist de contrôle à réception et verdict.
import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Carte, Pastille, Bouton, Champ, CLASSE_CHAMP, Erreur, envoyer } from "@/components/dashboard/sourcing/ui";
import { CHECKLIST_ECHANTILLON, QUANTITES_ECHANTILLON, STATUTS_ECHANTILLON, VERDICTS_ECHANTILLON, type Dossier } from "@/lib/sourcing/fournisseurs/types";
import { BoutonSupprimer, MessageAEnvoyer, Note, dateChamp, useEcriture, type PropsOnglet } from "./commun";

type Echantillon = Dossier["echantillons"][number];
type Checklist = Record<string, { note?: number; commentaire?: string }>;

const messageType = (fournisseur: string, produit: string, quantite: number, pays: string) => [
  `Hello ${fournisseur},`,
  "",
  `Before placing a bulk order, we would like to order ${quantite} sample${quantite > 1 ? "s" : ""} of "${produit}".`,
  "Could you please confirm:",
  `- the sample price and the shipping cost to ${pays},`,
  "- the delivery time,",
  "- that the sample is identical to mass production (materials, finish, packaging),",
  "- the accepted payment methods.",
  "",
  "Thank you.",
].join("\n");

/** Checklist de contrôle d'un échantillon reçu, puis verdict. */
function Controle({ echantillon, enCours, onEnvoi }: { echantillon: Echantillon; enCours: boolean; onEnvoi: (checklist: Checklist, verdict: string) => void }) {
  const t = useT();
  const [checklist, setChecklist] = useState<Checklist>((echantillon.checklist ?? {}) as Checklist);
  const [verdict, setVerdict] = useState(echantillon.verdict ?? "");
  const maj = (cle: string, p: Checklist[string]) => setChecklist((c) => ({ ...c, [cle]: { ...c[cle], ...p } }));
  // Seuls les points notés sont envoyés (la note est obligatoire pour chaque point transmis).
  const notes = Object.fromEntries(Object.entries(checklist).filter(([cle, v]) => cle in CHECKLIST_ECHANTILLON && v.note));
  return (
    <div className="space-y-2.5 mt-2">
      {Object.entries(CHECKLIST_ECHANTILLON).map(([cle, libelle]) => (
        <div key={cle} className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-semibold text-[#111111] w-36 shrink-0">{t(libelle)}</span>
          <Note valeur={checklist[cle]?.note} onChange={(note) => maj(cle, { note })} />
          <input value={checklist[cle]?.commentaire ?? ""} maxLength={500} placeholder={t("Commentaire (optionnel)")} aria-label={t("Commentaire (optionnel)")}
            onChange={(e) => maj(cle, { commentaire: e.target.value })} className={`${CLASSE_CHAMP} flex-1 min-w-[160px]`} />
        </div>
      ))}
      <div className="flex items-end gap-2 flex-wrap pt-1">
        <div className="w-full sm:w-64">
          <Champ label="Verdict">
            <select value={verdict} onChange={(e) => setVerdict(e.target.value)} className={CLASSE_CHAMP}>
              <option value="">{t("Choisir…")}</option>
              {Object.entries(VERDICTS_ECHANTILLON).map(([cle, libelle]) => <option key={cle} value={cle}>{t(libelle)}</option>)}
            </select>
          </Champ>
        </div>
        <Bouton charge={enCours} disabled={!verdict || !Object.keys(notes).length} onClick={() => onEnvoi(notes, verdict)}>{t("Enregistrer le contrôle")}</Bouton>
      </div>
    </div>
  );
}

export function OngletEchantillons({ fiche, recharger }: PropsOnglet) {
  const t = useT();
  const { erreur, enCours, executer } = useEcriture(recharger);
  const { dossier } = fiche;
  const [offreId, setOffreId] = useState(dossier.offres[0]?.id ?? "");
  const [nomLibre, setNomLibre] = useState("");
  const [quantite, setQuantite] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const api = `/api/fournisseurs/${dossier.id}/echantillons`;
  const offre = dossier.offres.find((o) => o.id === offreId);
  const nomProduit = (offre?.nomProduit ?? nomLibre).trim();
  const modifier = (id: string, champs: Record<string, unknown>) => executer(() => envoyer(api, "PATCH", { id, ...champs }));

  const commander = async () => {
    const ok = await executer(() => envoyer(api, "POST", { offreId, nomProduit, quantite, devise: offre?.devise ?? "USD", statut: "a_commander" }));
    if (ok) setMessage(messageType(dossier.nom, nomProduit, quantite, fiche.contexte.paysNom));
  };

  return (
    <div className="space-y-4">
      <Carte titre="Commander un échantillon avant un gros achat" aide="AXSO ne passe pas la commande à votre place : l'échantillon est ajouté à votre suivi, et vous envoyez vous-même le message au fournisseur.">
        <div className="grid sm:grid-cols-2 gap-3">
          <Champ label="Offre">
            <select value={offreId} onChange={(e) => setOffreId(e.target.value)} className={CLASSE_CHAMP}>
              {dossier.offres.map((o) => <option key={o.id} value={o.id}>{o.nomProduit}</option>)}
              <option value="">{t("Autre produit")}</option>
            </select>
          </Champ>
          {!offre && <Champ label="Nom du produit"><input value={nomLibre} maxLength={200} onChange={(e) => setNomLibre(e.target.value)} className={CLASSE_CHAMP} /></Champ>}
          <Champ label="Quantité">
            <div className="flex gap-1.5">
              {QUANTITES_ECHANTILLON.map((q) => (
                <button key={q} type="button" onClick={() => setQuantite(q)} aria-pressed={quantite === q}
                  className="w-11 h-9 rounded-xl text-[13px] font-bold border transition-all"
                  style={quantite === q ? { background: "#F5A623", borderColor: "#F5A623", color: "#111111" } : { background: "#FFFFFF", borderColor: "#E8E8E8", color: "#666666" }}>{q}</button>
              ))}
            </div>
          </Champ>
        </div>
        <div className="mt-3"><Bouton onClick={commander} charge={enCours} disabled={nomProduit.length < 2}>{t("Ajouter au suivi et préparer le message")}</Bouton></div>
        {message !== null && (
          <div className="mt-4 pt-4 border-t border-[#F0F0F0]">
            <p className="text-[12px] font-semibold text-[#111111] mb-1.5">{t("Message type à envoyer au fournisseur (en anglais)")}</p>
            <MessageAEnvoyer message={message} onChange={setMessage} telephone={dossier.telephone} email={dossier.email} sujet={`Sample request — ${nomProduit}`} />
          </div>
        )}
      </Carte>

      {erreur && <Erreur message={erreur} />}

      <Carte titre="Échantillons suivis">
        {!dossier.echantillons.length && <p className="text-[12px] text-[#666666]">{t("Aucun échantillon suivi.")}</p>}
        <ul className="divide-y divide-[#F0F0F0]">
          {dossier.echantillons.map((e) => (
            <li key={e.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-[#111111]">{e.nomProduit}</span>
                    <span className="text-[11px] text-[#666666]">× {e.quantite}</span>
                    {e.verdict && <Pastille ton={e.verdict === "conforme" ? "positif" : e.verdict === "non_conforme" ? "attention" : "accent"}>{t(VERDICTS_ECHANTILLON[e.verdict] ?? e.verdict)}</Pastille>}
                  </div>
                  <div className="grid sm:grid-cols-3 gap-2 mt-2">
                    <Champ label="Statut">
                      <select value={e.statut} disabled={enCours} onChange={(ev) => modifier(e.id, { statut: ev.target.value })} className={CLASSE_CHAMP}>
                        {Object.entries(STATUTS_ECHANTILLON).map(([cle, libelle]) => <option key={cle} value={cle}>{t(libelle)}</option>)}
                      </select>
                    </Champ>
                    <Champ label="Commandé le"><input type="date" value={dateChamp(e.commandeLe)} disabled={enCours} onChange={(ev) => modifier(e.id, { commandeLe: ev.target.value })} className={CLASSE_CHAMP} /></Champ>
                    <Champ label="Reçu le"><input type="date" value={dateChamp(e.recuLe)} disabled={enCours} onChange={(ev) => modifier(e.id, { recuLe: ev.target.value })} className={CLASSE_CHAMP} /></Champ>
                  </div>
                </div>
                <BoutonSupprimer disabled={enCours} onClick={() => executer(() => envoyer(`${api}?id=${e.id}`, "DELETE"))} />
              </div>
              {(e.statut === "recu" || e.statut === "controle") && (
                <details className="mt-3" open={e.statut === "recu"}>
                  <summary className="text-[12px] font-semibold text-[#111111] cursor-pointer">{t("Checklist de contrôle")}</summary>
                  <Controle echantillon={e} enCours={enCours} onEnvoi={(checklist, verdict) => modifier(e.id, { statut: "controle", checklist, verdict })} />
                </details>
              )}
            </li>
          ))}
        </ul>
      </Carte>
    </div>
  );
}
