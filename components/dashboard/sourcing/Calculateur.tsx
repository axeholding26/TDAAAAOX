"use client";
// Calculateur de coût réel et de prix — utilisé par la fiche produit et par le
// calculateur libre. Tout est recalculé dans le navigateur à chaque frappe avec
// le même module pur que le serveur (evaluerProduit) : aucun appel réseau ici.
import { useMemo } from "react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { evaluerProduit, type ContexteCalcul, type ParametresCout } from "@/lib/sourcing/produit-source";
import { MARGE_AUTO, type ModePrix, type Tarification } from "@/lib/sourcing/rentabilite";
import { DEVISES_FOURNISSEUR, ETIQUETTE_ESTIMATION } from "@/lib/sourcing/pays";
import { Carte, Pastille, Estimation, Bouton, Champ, ChampNombre, ChampPourcent, CLASSE_CHAMP, Kpi, pourcent } from "./ui";

export interface FicheCalcul {
  prixFournisseur: number;
  deviseFournisseur: string;
  moq?: number;
  poidsKg?: number | null;
  disponibilite?: number | null;
  modeAppro: string;
  parametresCout: ParametresCout;
  tarification: Tarification;
  criteresScore?: unknown;
}

const MODES_PRIX: { cle: ModePrix; libelle: string; aide: string }[] = [
  { cle: "auto", libelle: "Prix automatique", aide: "Axso choisit la marge et arrondit au bon palier. Le plus simple pour commencer." },
  { cle: "psychologique", libelle: "Prix psychologique", aide: "Votre marge en %, arrondie à un prix qui se lit bien (14 900 plutôt que 14 167)." },
  { cle: "marge_pct", libelle: "Marge en %", aide: "Vous gardez un pourcentage précis du prix de vente." },
  { cle: "marge_fixe", libelle: "Marge fixe", aide: "Vous choisissez combien gagner par commande." },
];

type CleTaux = "tauxDroits" | "tauxRefus" | "tauxRetour" | "tauxFraisPaiement";
type CleMontant = "tarifTransportKg" | "fraisTransitaire" | "fraisDedouanement" | "livraisonLocale";

export function Calculateur({ fiche, contexte, onChange, editionFiche }: {
  fiche: FicheCalcul; contexte: ContexteCalcul; onChange: (partiel: Partial<FicheCalcul>) => void; editionFiche?: boolean;
}) {
  const t = useT();
  const { fmt } = useDevise();
  const ev = useMemo(() => evaluerProduit(fiche, contexte), [fiche, contexte]);
  const p = fiche.parametresCout, tarif = fiche.tarification, r = contexte.reglages, c = ev.cout;
  const devise = contexte.devise;
  const dropshipping = fiche.modeAppro === "dropshipping";
  const mode = tarif.mode ?? "auto";
  const cout = (partiel: Partial<ParametresCout>) => onChange({ parametresCout: { ...p, ...partiel } });
  const prix = (partiel: Partial<Tarification>) => onChange({ tarification: { ...tarif, ...partiel } });
  const m = (n: number | null) => (n === null ? "—" : fmt(n));

  // Les frais d'envoi (transport, assurance, transitaire, dédouanement) sont ceux du lot entier : le calcul les répartit par unité.
  const aideEnvoi = dropshipping ? "Pour une commande." : "Pour tout le lot : Axso le répartit par unité.";
  const transportAuKilo = (fiche.poidsKg ?? 0) * (p.tarifTransportKg ?? r.tarifTransportKg ?? 0);

  // D'où vient la valeur utilisée quand le champ est vide : jamais de chiffre par défaut sans le dire.
  const origine = (cle: CleTaux | CleMontant, estimee: boolean) =>
    p[cle] !== undefined ? null
    : r[cle] !== undefined ? <Pastille>{t("Valeur de vos réglages")}</Pastille>
    : cle === "tauxRefus" && ev.hypotheses.refusMesure ? <Pastille ton="positif">{t("Mesuré sur vos commandes")}</Pastille>
    : estimee ? <Estimation>{t("Valeur par défaut — estimation")}</Estimation> : null;

  const champTaux = (cle: CleTaux, label: string, aide: string) => (
    <div className="space-y-1">
      <ChampPourcent label={label} aide={aide} valeur={p[cle]} onChange={(v) => cout({ [cle]: v })}
        placeholder={String(Math.round(ev.hypotheses[cle] * 1000) / 10)} />
      {origine(cle, true)}
    </div>
  );
  const champMontant = (cle: CleMontant, label: string, aide: string) => (
    <div className="space-y-1">
      <ChampNombre label={label} aide={aide} suffixe={devise} valeur={p[cle]} onChange={(v) => cout({ [cle]: v })} placeholder={String(r[cle] ?? 0)} />
      {origine(cle, false)}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <Carte titre="Vos coûts" aide="Remplissez ce que vous connaissez. Un champ vide utilise la valeur par défaut affichée en gris.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {editionFiche ? (
              <>
                <ChampNombre label="Prix du fournisseur" aide="Pour une unité." valeur={fiche.prixFournisseur || undefined} onChange={(v) => onChange({ prixFournisseur: v ?? 0 })} />
                <Champ label="Devise du fournisseur">
                  <select value={fiche.deviseFournisseur} onChange={(e) => onChange({ deviseFournisseur: e.target.value })} className={CLASSE_CHAMP}>
                    {DEVISES_FOURNISSEUR.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Champ>
                <ChampNombre label="Poids d'une unité" suffixe="kg" aide="Sert à estimer le transport au kilo." valeur={fiche.poidsKg ?? undefined} onChange={(v) => onChange({ poidsKg: v ?? null })} />
              </>
            ) : (
              <p className="sm:col-span-2 text-[12px] text-[#666666] bg-[#F5F5F5] rounded-xl px-3 py-2">
                {t("Prix du fournisseur : {0} {1}", fiche.prixFournisseur, fiche.deviseFournisseur)}
                {fiche.poidsKg ? ` · ${t("Poids : {0} kg", fiche.poidsKg)}` : ""}
                {" — "}{t("modifiable dans l'onglet Analyser.")}
              </p>
            )}
            {!dropshipping && (
              <ChampNombre label="Quantité du lot" aide="Nombre d'unités importées en une fois." pas={1} placeholder={String(fiche.moq ?? 1)}
                valeur={p.quantite} onChange={(v) => cout({ quantite: v ? Math.round(v) : undefined })} />
            )}
            <ChampNombre label="Transport international" suffixe={devise} placeholder={String(Math.round(transportAuKilo))}
              aide={`${t(aideEnvoi)} ${t("Vide = tarif au kilo × poids.")}`} valeur={p.transportInternational} onChange={(v) => cout({ transportInternational: v })} />
            {champMontant("tarifTransportKg", "Tarif du transitaire au kilo", "Utilisé seulement si le transport ci-dessus est vide.")}
            <ChampNombre label="Assurance" suffixe={devise} placeholder="0" aide={aideEnvoi} valeur={p.assurance} onChange={(v) => cout({ assurance: v })} />
            <div className="space-y-1">
              <ChampPourcent label="Droits et taxes" aide="Part de la valeur du produit, transport et assurance compris." valeur={p.tauxDroits}
                onChange={(v) => cout({ tauxDroits: v })} placeholder={String(Math.round(ev.hypotheses.tauxDroits * 1000) / 10)} />
              <Estimation>{t(ETIQUETTE_ESTIMATION)}</Estimation>
            </div>
            {champMontant("fraisTransitaire", "Frais de transitaire", aideEnvoi)}
            {champMontant("fraisDedouanement", "Dédouanement", aideEnvoi)}
            {champMontant("livraisonLocale", "Livraison locale", "Livraison jusqu'à votre client, par commande.")}
            {champTaux("tauxFraisPaiement", "Frais de paiement", "Part du prix prise par le paiement en ligne. 0 si tout est payé à la livraison.")}
            <ChampNombre label="Publicité par commande" suffixe={devise} placeholder="0" aide="Ce que vous dépensez en publicité pour obtenir une commande."
              valeur={p.coutPubParCommande} onChange={(v) => cout({ coutPubParCommande: v })} />
            {champTaux("tauxRefus", "Taux de refus", "Part des colis refusés à la livraison.")}
            {champTaux("tauxRetour", "Taux de retour", "Part des commandes livrées puis retournées.")}
            <ChampNombre label="Autres frais" suffixe={devise} placeholder="0" aide="Emballage, commission, etc. Par commande." valeur={p.autresFrais} onChange={(v) => cout({ autresFrais: v })} />
          </div>
        </Carte>

        <div className="space-y-5">
          <Carte titre="Détail du coût" aide="Pour une commande livrée.">
            <ul className="divide-y divide-[#F0F0F0]">
              {c.lignes.map((l) => (
                <li key={l.cle} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                  <span className="text-[#666666]">{t(l.libelle)}</span>
                  <span className="font-semibold text-[#111111] tabular-nums">{fmt(l.montant)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-xl bg-[#FFF7ED] border border-[#FDE68A] px-4 py-3">
              <p className="text-[11px] font-bold text-[#B45309] uppercase tracking-wide">{t("Coût réel par commande")}</p>
              <p className="text-[26px] font-bold text-[#111111] leading-tight tabular-nums">{fmt(c.coutTotal)}</p>
            </div>
          </Carte>

          <Carte titre="Prix de vente" aide="Choisissez comment Axso calcule votre prix.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MODES_PRIX.map((o) => (
                // Le prix automatique fixe lui-même la marge : on retire celle saisie pour un autre mode.
                <button key={o.cle} type="button" onClick={() => prix({ mode: o.cle, ...(o.cle === "auto" && { margePct: undefined }) })}
                  className="text-left rounded-xl border px-3 py-2 transition-all"
                  style={mode === o.cle ? { borderColor: "#F5A623", background: "#FFF7ED" } : { borderColor: "#E8E8E8", background: "#FFFFFF" }}>
                  <span className="block text-[12px] font-bold text-[#111111]">{t(o.libelle)}</span>
                  <span className="block text-[11px] text-[#666666] leading-snug mt-0.5">{t(o.aide)}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {mode === "marge_fixe" && <ChampNombre label="Bénéfice voulu par commande" suffixe={devise} placeholder="0" valeur={tarif.margeFixe} onChange={(v) => prix({ margeFixe: v })} />}
              {(mode === "marge_pct" || mode === "psychologique") && (
                <ChampPourcent label="Marge voulue" aide="Part du prix de vente gardée en bénéfice." placeholder={String(MARGE_AUTO * 100)} valeur={tarif.margePct} onChange={(v) => prix({ margePct: v })} />
              )}
            </div>

            <div className="mt-3 rounded-xl border border-[#E8E8E8] px-4 py-3">
              <p className="text-[11px] font-bold text-[#666666] uppercase tracking-wide">{t("Prix conseillé")}</p>
              <p className="text-[22px] font-bold text-[#111111] leading-tight tabular-nums">{fmt(ev.conseil.prix)}</p>
              <ul className="mt-2 space-y-1 list-disc pl-4 text-[12px] text-[#666666] leading-relaxed">
                {ev.conseil.explication.map((ligne, i) => <li key={i}>{ligne}</li>)}
              </ul>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <ChampNombre label="Mon prix de vente" suffixe={devise} placeholder={String(ev.conseil.prix)} aide="Vide = prix conseillé."
                valeur={tarif.prixVente} onChange={(v) => prix({ prixVente: v || undefined })} />
              <div className="sm:pb-5">
                <Bouton variante="secondaire" disabled={tarif.prixVente === undefined} onClick={() => prix({ prixVente: undefined })}>{t("Utiliser le prix conseillé")}</Bouton>
              </div>
            </div>
          </Carte>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h2 className="text-[14px] font-bold text-[#111111]">{t("Résultats par commande")}</h2>
          <Estimation>{t("Calculé à partir de vos hypothèses")}</Estimation>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi libelle="Coût total" valeur={fmt(c.coutTotal)} detail="Tout ce qu'une commande livrée vous coûte." />
          <Kpi libelle="Prix de vente" valeur={m(c.prixVente)} detail="Ce que paie votre client." />
          <Kpi libelle="Marge brute" valeur={m(c.margeBrute)} detail="Prix de vente moins le produit arrivé chez vous, avant livraison et publicité." />
          <Kpi libelle="Marge nette estimée" valeur={m(c.margeNette)} ton={c.margeNette === null ? undefined : c.margeNette > 0 ? "positif" : "attention"}
            detail="Votre bénéfice par commande livrée, tous frais payés." />
          <Kpi libelle="Taux de marge" valeur={pourcent(c.tauxMargeNette)} detail="Part du prix de vente que vous gardez." />
          <Kpi libelle="Budget pub maximum" valeur={m(c.budgetPubMax)} detail="Par commande. Au-delà, vous vendez à perte." />
          <Kpi libelle="ROAS minimum" valeur={c.roasMinimum === null ? "—" : String(c.roasMinimum)} detail="En dessous, chaque vente vous fait perdre de l'argent." />
          <Kpi libelle="ROI publicitaire" valeur={c.roiPublicitaire === null ? "—" : String(c.roiPublicitaire)}
            detail={c.roiPublicitaire === null ? "Indiquez votre publicité par commande pour le calculer." : "Bénéfice gagné pour 1 dépensé en publicité."} />
        </div>
      </div>
    </div>
  );
}
