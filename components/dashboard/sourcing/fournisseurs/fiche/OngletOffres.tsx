"use client";
// Offres & prix : grille de prix, coût réel estimé, saisie des offres (paliers
// dégressifs) et copilote de négociation.
import { useEffect, useState } from "react";
import { AlertTriangle, Download, Pencil, Plus, Sparkles, X } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Carte, Bouton, Champ, ChampNombre, CLASSE_CHAMP, EtatVide, Erreur, Chargement, envoyer } from "@/components/dashboard/sourcing/ui";
import { GrillePrix, DetailCout, PastilleConfiance } from "@/components/dashboard/sourcing/fournisseurs/affichage";
import { DEVISES_FOURNISSEUR } from "@/lib/sourcing/pays";
import { niveauConfiance } from "@/lib/sourcing/fournisseurs/types";
import type { Candidat } from "@/lib/sourcing/fournisseurs/classement";
import type { Palier } from "@/lib/sourcing/fournisseurs/cout";
import type { Objectifs } from "@/lib/sourcing/fournisseurs/ia";
import { BoutonSupprimer, MessageAEnvoyer, dateCourte, joursAvant, useEcriture, type Fiche, type PropsOnglet } from "./commun";

interface Saisie {
  id?: string; produitId: string; nomProduit: string; categorie: string; urlOffre: string;
  prixUnitaire?: number; devise: string; moq?: number; delaiProduction?: number; poidsKg?: number;
  paliers: { quantiteMin?: number; prix?: number }[];
}
const SAISIE_VIDE: Saisie = { produitId: "", nomProduit: "", categorie: "", urlOffre: "", devise: "USD", paliers: [] };

function FormulaireOffre({ initial, produits, enCours, onEnvoi, onAnnule }: {
  initial: Saisie; produits: Fiche["produits"]; enCours: boolean; onEnvoi: (corps: Record<string, unknown>) => void; onAnnule: () => void;
}) {
  const t = useT();
  const [s, setS] = useState(initial);
  const maj = (p: Partial<Saisie>) => setS((v) => ({ ...v, ...p }));
  const majPalier = (i: number, p: Partial<Saisie["paliers"][number]>) => maj({ paliers: s.paliers.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const valider = () => onEnvoi({
    ...(s.id ? { id: s.id } : {}),
    produitId: s.produitId, nomProduit: s.nomProduit, categorie: s.categorie, urlOffre: s.urlOffre,
    prixUnitaire: s.prixUnitaire, devise: s.devise,
    // Chaîne vide = champ effacé (l'API l'enregistre comme « non renseigné »).
    moq: s.moq ?? "", delaiProduction: s.delaiProduction ?? "", poidsKg: s.poidsKg ?? "",
    paliers: s.paliers.filter((p) => p.quantiteMin && p.prix),
  });
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <Champ label="Produit du catalogue" aide="Optionnel : rattache l'offre à un produit de la boutique pour comparer les fournisseurs.">
          <select value={s.produitId} className={CLASSE_CHAMP}
            onChange={(e) => maj({ produitId: e.target.value, nomProduit: s.nomProduit || (produits.find((p) => p.id === e.target.value)?.nom ?? "") })}>
            <option value="">{t("Aucun")}</option>
            {produits.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </Champ>
        <Champ label="Désignation"><input value={s.nomProduit} onChange={(e) => maj({ nomProduit: e.target.value })} className={CLASSE_CHAMP} /></Champ>
        <Champ label="Catégorie" aide="Sert à déterminer les certifications potentiellement nécessaires."><input value={s.categorie} onChange={(e) => maj({ categorie: e.target.value })} className={CLASSE_CHAMP} /></Champ>
        <Champ label="URL de l'offre"><input type="url" value={s.urlOffre} placeholder="https://" onChange={(e) => maj({ urlOffre: e.target.value })} className={CLASSE_CHAMP} /></Champ>
        <ChampNombre label="Prix unitaire" valeur={s.prixUnitaire} onChange={(v) => maj({ prixUnitaire: v })} />
        <Champ label="Devise">
          <select value={s.devise} onChange={(e) => maj({ devise: e.target.value })} className={CLASSE_CHAMP}>
            {DEVISES_FOURNISSEUR.map((d) => <option key={d}>{d}</option>)}
          </select>
        </Champ>
        <ChampNombre label="MOQ" aide="Quantité minimale de commande." valeur={s.moq} onChange={(v) => maj({ moq: v })} pas={1} />
        <ChampNombre label="Délai de production" suffixe={t("jours")} valeur={s.delaiProduction} onChange={(v) => maj({ delaiProduction: v })} pas={1} />
        <ChampNombre label="Poids unitaire" suffixe="kg" valeur={s.poidsKg} onChange={(v) => maj({ poidsKg: v })} />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">{t("Prix dégressifs (paliers)")}</p>
        <div className="space-y-2 mt-1">
          {s.paliers.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="number" min={1} step={1} value={p.quantiteMin ?? ""} placeholder={t("Quantité min.")} aria-label={t("Quantité min.")}
                onChange={(e) => majPalier(i, { quantiteMin: e.target.value === "" ? undefined : Number(e.target.value) })} className={CLASSE_CHAMP} />
              <input type="number" min={0} step="any" value={p.prix ?? ""} placeholder={t("Prix")} aria-label={t("Prix")}
                onChange={(e) => majPalier(i, { prix: e.target.value === "" ? undefined : Number(e.target.value) })} className={CLASSE_CHAMP} />
              <span className="text-[12px] text-[#666666]">{s.devise}</span>
              <button type="button" onClick={() => maj({ paliers: s.paliers.filter((_, j) => j !== i) })} aria-label={t("Retirer ce palier")} className="p-1.5 text-[#AAAAAA] hover:text-[#B91C1C]"><X size={14} /></button>
            </div>
          ))}
          {s.paliers.length < 12 && <Bouton petit variante="discret" onClick={() => maj({ paliers: [...s.paliers, {}] })}><Plus size={12} />{t("Ajouter un palier")}</Bouton>}
        </div>
      </div>
      <p className="text-[11px] text-[#AAAAAA] leading-snug">{t("Enregistrer un prix le date comme confirmé aujourd'hui. Il reste « déclaré par le fournisseur ».")}</p>
      <div className="flex gap-2 flex-wrap">
        <Bouton onClick={valider} charge={enCours} disabled={s.nomProduit.trim().length < 2 || !s.prixUnitaire}>{t("Enregistrer l'offre")}</Bouton>
        <Bouton variante="secondaire" onClick={onAnnule}>{t("Annuler")}</Bouton>
      </div>
    </div>
  );
}

const LANGUES = { anglais: "Anglais", "français": "Français", chinois: "Chinois" };

/** Copilote de négociation : objectifs proposés par l'API, ajustés par le marchand, puis message. */
function Negociation({ candidat, quantiteInitiale, fiche, onFermer }: { candidat: Candidat; quantiteInitiale: number; fiche: Fiche; onFermer: () => void }) {
  const t = useT();
  const [quantite, setQuantite] = useState<number | undefined>(quantiteInitiale);
  const [o, setO] = useState<Objectifs | null>(null);
  const [langue, setLangue] = useState("anglais");
  const [message, setMessage] = useState<string | null>(null);
  const [parIa, setParIa] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const maj = (p: Partial<Objectifs>) => setO((v) => v && { ...v, ...p });

  const appeler = async (rediger: boolean) => {
    if (!quantite) return;
    setEnCours(true); setErreur(null);
    try {
      const objectifs = rediger && o ? {
        prixCible: o.prixCible, moqCible: o.moqCible ?? null, conditionsPaiement: o.conditionsPaiement, packaging: o.packaging ?? "",
        personnalisation: o.personnalisation ?? "", delaiJours: o.delaiJours ?? null, inspection: o.inspection,
      } : undefined;
      const r = await envoyer<{ objectifs: Objectifs; message?: string; redigeParIa?: boolean }>("/api/fournisseurs/ia", "POST", { action: "negocier", ref: candidat.ref, quantite, langue, objectifs });
      setO(r.objectifs);
      if (r.message !== undefined) { setMessage(r.message); setParIa(r.redigeParIa !== false); }
    } catch (e) { setErreur((e as Error).message); }
    finally { setEnCours(false); }
  };
  // Objectifs proposés à l'ouverture.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { appeler(false); }, []);

  return (
    <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 sm:p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-bold text-[#111111] flex items-center gap-1.5"><Sparkles size={13} className="text-[#B45309]" />{t("Copilote de négociation")}</p>
          <p className="text-[11px] text-[#666666] mt-0.5 leading-snug">{t("Objectifs calculés sur cette offre et les offres comparables de votre base. Ajustez-les, puis envoyez vous-même le message : AXSO ne contacte pas le fournisseur.")}</p>
        </div>
        <button type="button" onClick={onFermer} aria-label={t("Fermer")} className="p-1 text-[#AAAAAA] hover:text-[#111111]"><X size={15} /></button>
      </div>
      {erreur && <Erreur message={erreur} />}
      {!o ? (enCours ? <Chargement /> : <Bouton petit variante="secondaire" onClick={() => appeler(false)}>{t("Réessayer")}</Bouton>) : (
        <>
          {o.arguments.length > 0 && (
            <ul className="list-disc pl-4 space-y-0.5">
              {o.arguments.map((a) => <li key={a} className="text-[12px] text-[#111111] leading-snug">{t(a)}</li>)}
            </ul>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <ChampNombre label="Quantité" valeur={quantite} onChange={setQuantite} pas={1} />
              {quantite !== o.quantite && <div className="mt-1"><Bouton petit variante="discret" charge={enCours} disabled={!quantite} onClick={() => appeler(false)}>{t("Recalculer les objectifs")}</Bouton></div>}
            </div>
            <ChampNombre label="Prix cible" suffixe={o.devise} aide={t("Prix actuel : {0} {1}", o.prixActuel, o.devise)} valeur={o.prixCible} onChange={(v) => maj({ prixCible: v ?? 0 })} />
            <ChampNombre label="MOQ cible" valeur={o.moqCible ?? undefined} onChange={(v) => maj({ moqCible: v ?? null })} pas={1} />
            <ChampNombre label="Délai" suffixe={t("jours")} valeur={o.delaiJours ?? undefined} onChange={(v) => maj({ delaiJours: v ?? null })} pas={1} />
            <Champ label="Conditions de paiement"><input value={o.conditionsPaiement} maxLength={300} onChange={(e) => maj({ conditionsPaiement: e.target.value })} className={CLASSE_CHAMP} /></Champ>
            <Champ label="Inspection"><input value={o.inspection} maxLength={300} onChange={(e) => maj({ inspection: e.target.value })} className={CLASSE_CHAMP} /></Champ>
            <Champ label="Packaging"><input value={o.packaging ?? ""} maxLength={300} onChange={(e) => maj({ packaging: e.target.value })} className={CLASSE_CHAMP} /></Champ>
            <Champ label="Personnalisation"><input value={o.personnalisation ?? ""} maxLength={300} onChange={(e) => maj({ personnalisation: e.target.value })} className={CLASSE_CHAMP} /></Champ>
            <Champ label="Langue du message">
              <select value={langue} onChange={(e) => setLangue(e.target.value)} className={CLASSE_CHAMP}>
                {Object.entries(LANGUES).map(([cle, libelle]) => <option key={cle} value={cle}>{t(libelle)}</option>)}
              </select>
            </Champ>
          </div>
          <Bouton onClick={() => appeler(true)} charge={enCours} disabled={!quantite || !o.prixCible}>{t("Rédiger le message")}</Bouton>
          {message !== null && (
            <div className="space-y-1.5">
              {!parIa && <p className="text-[11px] font-semibold text-[#B45309] flex items-center gap-1"><AlertTriangle size={11} />{t("Message type (assistant IA indisponible)")}</p>}
              <MessageAEnvoyer message={message} onChange={setMessage} telephone={fiche.dossier.telephone} email={fiche.dossier.email} sujet={candidat.offre?.nomProduit ?? fiche.dossier.nom} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function OngletOffres({ fiche, recharger }: PropsOnglet) {
  const t = useT();
  const { erreur, enCours, executer } = useEcriture(recharger);
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  const [negociation, setNegociation] = useState<string | null>(null);
  const [importees, setImportees] = useState<number | null>(null);
  const api = `/api/fournisseurs/${fiche.dossier.id}/offres`;

  const enregistrer = async (corps: Record<string, unknown>) => {
    if (await executer(() => envoyer(api, corps.id ? "PATCH" : "POST", corps))) setSaisie(null);
  };
  const importer = () => executer(async () => {
    const r = await envoyer<{ importees: number | unknown[] }>(api, "POST", { importerCatalogue: true });
    setImportees(Array.isArray(r.importees) ? r.importees.length : Number(r.importees) || 0);
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Bouton petit onClick={() => setSaisie(SAISIE_VIDE)}><Plus size={12} />{t("Ajouter une offre")}</Bouton>
        <Bouton petit variante="secondaire" onClick={importer} charge={enCours}><Download size={12} />{t("Importer depuis le catalogue sourcing")}</Bouton>
      </div>
      {importees !== null && <p className="text-[12px] text-[#666666]">{importees ? t("{0} offre(s) importée(s) du catalogue sourcing.", importees) : t("Aucune nouvelle offre à importer : aucun produit du catalogue sourcing n'est rattaché à ce fournisseur.")}</p>}
      {erreur && <Erreur message={erreur} />}
      {saisie && !saisie.id && <Carte titre="Nouvelle offre"><FormulaireOffre initial={saisie} produits={fiche.produits} enCours={enCours} onEnvoi={enregistrer} onAnnule={() => setSaisie(null)} /></Carte>}

      {!fiche.dossier.offres.length && !saisie && <EtatVide titre="Aucune offre enregistrée" texte="Ajoutez le prix, le MOQ et les paliers annoncés par ce fournisseur : sans offre, ni le coût réel ni la comparaison ne peuvent être calculés." />}

      {fiche.dossier.offres.map((brute) => {
        const candidat = fiche.offres.find((c) => c.offre?.id === brute.id);
        const offre = candidat?.offre;
        const confirme = brute.derniereVerificationAt;
        const aReconfirmer = !confirme || joursAvant(confirme) < -30;
        if (saisie?.id === brute.id) return (
          <Carte key={brute.id} titre="Modifier l'offre"><FormulaireOffre initial={saisie} produits={fiche.produits} enCours={enCours} onEnvoi={enregistrer} onAnnule={() => setSaisie(null)} /></Carte>
        );
        return (
          <Carte key={brute.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[#111111]">{brute.nomProduit}</p>
                <p className="text-[11px] text-[#666666] mt-0.5">
                  {[brute.categorie, brute.produitId && fiche.produits.find((p) => p.id === brute.produitId)?.nom].filter(Boolean).join(" · ")}
                  {brute.urlOffre && <> <a href={brute.urlOffre} target="_blank" rel="noopener noreferrer" className="text-[#B45309] font-semibold hover:underline">{t("Voir l'offre")}</a></>}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <PastilleConfiance niveau={niveauConfiance(brute.confiance)} />
                <button type="button" title={t("Modifier")} aria-label={t("Modifier")} className="p-1.5 rounded-lg text-[#AAAAAA] hover:text-[#111111] hover:bg-[#F5F5F5]"
                  onClick={() => setSaisie({
                    id: brute.id, produitId: brute.produitId ?? "", nomProduit: brute.nomProduit, categorie: brute.categorie ?? "", urlOffre: brute.urlOffre ?? "",
                    prixUnitaire: brute.prixUnitaire, devise: brute.devise, moq: brute.moq ?? undefined, delaiProduction: brute.delaiProduction ?? undefined, poidsKg: brute.poidsKg ?? undefined,
                    paliers: Array.isArray(brute.paliers) ? (brute.paliers as unknown as Palier[]) : [],
                  })}><Pencil size={14} /></button>
                <BoutonSupprimer disabled={enCours} onClick={() => executer(() => envoyer(`${api}?id=${brute.id}`, "DELETE"))} />
              </div>
            </div>

            <div className="mt-3">
              {offre ? <GrillePrix offre={offre} /> : <p className="text-[13px] font-bold text-[#111111] tabular-nums">{brute.prixUnitaire.toLocaleString(t.loc, { maximumFractionDigits: 2 })} {brute.devise} / {t("unité")}</p>}
            </div>
            <div className="flex gap-x-4 gap-y-1 flex-wrap mt-3 text-[12px] text-[#666666]">
              <span>MOQ : <b className="text-[#111111]">{brute.moq ?? t("Non communiqué")}</b></span>
              {brute.delaiProduction != null && <span>{t("Production")} : <b className="text-[#111111]">{t("{0} jours", brute.delaiProduction)}</b></span>}
              {candidat && <span>{t("Délai total")} : <b className="text-[#111111]">{candidat.delaiJours === null ? t("Non communiqué") : t("{0} jours", candidat.delaiJours)}</b></span>}
              {brute.poidsKg != null && <span>{t("Poids")} : <b className="text-[#111111]">{brute.poidsKg} kg</b></span>}
            </div>
            <p className="text-[11px] mt-2 flex items-center gap-1.5 flex-wrap" style={{ color: aReconfirmer ? "#B45309" : "#666666" }}>
              {aReconfirmer && <AlertTriangle size={11} />}
              {confirme ? t("Prix confirmé le {0}", dateCourte(confirme, t.loc)) : t("Prix jamais confirmé")}
              {aReconfirmer && <b>— {t("Prix à reconfirmer")}</b>}
            </p>

            {candidat?.cout && (
              <details className="mt-3 border-t border-[#F0F0F0] pt-3">
                <summary className="text-[12px] font-semibold text-[#111111] cursor-pointer">
                  {t("Coût réel estimé par unité")} : {candidat.cout.total.toLocaleString(t.loc, { maximumFractionDigits: 2 })} {candidat.cout.devise}
                </summary>
                <div className="mt-2"><DetailCout cout={candidat.cout} /></div>
              </details>
            )}

            {candidat?.cout && (
              <div className="mt-3">
                {negociation === brute.id
                  ? <Negociation candidat={candidat} quantiteInitiale={fiche.contexte.quantite} fiche={fiche} onFermer={() => setNegociation(null)} />
                  : <Bouton petit variante="discret" onClick={() => setNegociation(brute.id)}><Sparkles size={12} />{t("Préparer une négociation")}</Bouton>}
              </div>
            )}
          </Carte>
        );
      })}
    </div>
  );
}
