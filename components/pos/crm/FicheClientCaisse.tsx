"use client";
// Fiche d'un client à la caisse : coordonnées, segment, fidélité (points,
// niveau, utilisation des points), crédit (autorisé / utilisé / disponible,
// retards), avoirs utilisables, derniers achats. Contenu seul : l'écran qui
// l'affiche choisit son habillage (<Tiroir>, <Modale> ou colonne).
//
// PROPS
//   clientId       Client à afficher.
//   caisseId       Caisse de travail (en-tête x-pos-caisse). Facultatif.
//   onAvoirCree    Appelé quand des points viennent d'être changés en avoir :
//                  { code, montant }. L'écran de caisse peut alors proposer le
//                  paiement « avoir » avec ce code en référence.
//   onUtiliserAvoir  Si fourni, chaque avoir du client porte un bouton « Utiliser ».
//   onCharge       Appelé avec la fiche à chaque (re)chargement (points et crédit à jour).
//   compact        Masque les derniers achats.
//
// UTILISER SES POINTS : les points deviennent un avoir (points × valeur du
// point), qui se dépense par le moyen de paiement « avoir ». Proposé seulement
// si la fidélité est active et que le point a une valeur.
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Gift } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, Bouton, EtatChargement, EtatPos, Saisie } from "@/components/pos/ui";
import type { ClientCaisse } from "./SelecteurClient";
import { appelPos, nouvelleCle } from "./appel";
import { LIBELLES_NIVEAU, LIBELLES_SEGMENT, TON_NIVEAU, TON_SEGMENT, dateCourte } from "./libelles";

export type FicheClient = {
  client: ClientCaisse & { pointsAcquis: number; valeurPoints: number };
  achats: { id: string; numero: string; date: string; total: number; paye: number; statut: string; canal: string; lignes: number }[];
  echeances: { commandeId: string; numero: string | null; reste: number; echeance: string | null; enRetard: boolean; joursRetard: number }[];
  enRetard: number;
  avoirs: { id: string; code: string; solde: number; expire: string | null }[];
  fidelite: { active: boolean; valeurPoint: number; seuils: { silver: number; gold: number; vip: number } };
  creditActif: boolean;
};

export type FicheClientCaisseProps = {
  clientId: string;
  caisseId?: string | null;
  onAvoirCree?: (avoir: { code: string; montant: number }) => void;
  onUtiliserAvoir?: (avoir: { code: string; solde: number }) => void;
  onCharge?: (fiche: FicheClient) => void;
  compact?: boolean;
};

function Chiffre({ libelle, valeur, alerte }: { libelle: string; valeur: string; alerte?: boolean }) {
  return (
    <div className="rounded-xl bg-[#FAFAFA] px-3 py-2">
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-[#888888]">{libelle}</dt>
      <dd className={`mt-0.5 text-[15px] font-bold tabular-nums ${alerte ? "text-[#B91C1C]" : "text-[#111111]"}`}>{valeur}</dd>
    </div>
  );
}

export function FicheClientCaisse({ clientId, caisseId, onAvoirCree, onUtiliserAvoir, onCharge, compact }: FicheClientCaisseProps) {
  const t = useT();
  const { fmt } = useDevise();
  const [fiche, setFiche] = useState<FicheClient | null>(null);
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null);
  const [points, setPoints] = useState("");
  // `fait` / `avertissement` s'affichent dans la fiche : elle vit souvent dans un tiroir, qui masquerait une notification flottante.
  const [conversion, setConversion] = useState<{ enCours: boolean; erreur?: string; fait?: string; avertissement?: string }>({ enCours: false });
  const cle = useRef(nouvelleCle());
  const surCharge = useRef(onCharge);
  surCharge.current = onCharge;

  const charger = useCallback(async () => {
    setErreur(null);
    const r = await appelPos<FicheClient>(`/api/pos/clients/${encodeURIComponent(clientId)}`, { caisseId });
    if (!r.ok) return setErreur(r);
    setFiche(r.donnees);
    surCharge.current?.(r.donnees);
  }, [clientId, caisseId]);
  useEffect(() => { setFiche(null); charger(); }, [charger]);

  async function convertir() {
    const n = Math.floor(Number(points));
    if (!(n > 0)) return setConversion({ enCours: false, erreur: "Indiquez le nombre de points à utiliser." });
    setConversion({ enCours: true });
    const r = await appelPos<{ code: string; montant: number; modeAvoirActif: boolean }>("/api/pos/fidelite/convertir", { corps: { clientId, points: n }, cle: cle.current, caisseId });
    if (!r.ok) return setConversion({ enCours: false, erreur: r.message });
    cle.current = nouvelleCle();
    setPoints("");
    setConversion({
      enCours: false, fait: `${t("Avoir créé")} : ${r.donnees.code} · ${fmt(r.donnees.montant)}`,
      avertissement: r.donnees.modeAvoirActif ? undefined : t("Le moyen de paiement « Avoir » n'est pas activé dans les réglages de la caisse : activez-le pour dépenser cet avoir."),
    });
    onAvoirCree?.({ code: r.donnees.code, montant: r.donnees.montant });
    charger();
  }

  if (erreur) return <EtatPos code={erreur.code} message={erreur.message} onReessayer={charger} compact />;
  if (!fiche) return <EtatChargement texte="Chargement de la fiche client…" compact />;

  const { client: c, fidelite: f } = fiche;
  const pointsUtilisables = f.active && f.valeurPoint > 0 && c.points > 0;
  return (
    <div className="space-y-5 text-[13px] text-[#111111]">
      <section aria-label={t("Coordonnées")}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[16px] font-bold">{c.nom}</h3>
          <Badge ton={TON_SEGMENT[c.segment]}>{t(LIBELLES_SEGMENT[c.segment])}</Badge>
          <Badge ton={TON_NIVEAU[c.niveau] ?? "neutre"}>{t(LIBELLES_NIVEAU[c.niveau] ?? c.niveau)}</Badge>
        </div>
        <p className="mt-1 text-[12.5px] text-[#666666]">
          {[c.telephone, c.email, c.codeClient && `${t("Code client")} ${c.codeClient}`].filter(Boolean).join(" · ") || t("Aucune coordonnée")}
        </p>
        <p className="mt-1 text-[11.5px] text-[#888888]">{t("Segment")} : {t(c.segmentRaison)}</p>
      </section>

      <section aria-label={t("Achats")}>
        <dl className="grid grid-cols-3 gap-2">
          <Chiffre libelle={t("Achats")} valeur={String(c.totalCommandes)} />
          <Chiffre libelle={t("Total dépensé")} valeur={fmt(c.totalDepense)} />
          <Chiffre libelle={t("Dernier achat")} valeur={dateCourte(c.dernierAchat)} />
        </dl>
      </section>

      <section aria-label={t("Fidélité")}>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{t("Fidélité")}</h4>
        {!f.active ? <p className="mt-1 text-[12.5px] text-[#666666]">{t("Le programme de fidélité n'est pas activé dans cette boutique.")}</p> : (
          <>
            <dl className="mt-1.5 grid grid-cols-3 gap-2">
              <Chiffre libelle={t("Points")} valeur={String(c.points)} />
              <Chiffre libelle={t("Niveau")} valeur={t(LIBELLES_NIVEAU[c.niveau] ?? c.niveau)} />
              <Chiffre libelle={t("Valeur des points")} valeur={f.valeurPoint > 0 ? fmt(c.valeurPoints) : "—"} />
            </dl>
            {conversion.fait && <p role="status" className="mt-2 rounded-xl border border-[#BBF7D0] bg-[#ECFDF5] px-3 py-2 text-[12.5px] font-semibold text-[#15803D]">{conversion.fait}</p>}
            {conversion.avertissement && <p role="alert" className="mt-2 text-[12.5px] font-semibold text-[#B45309]">{conversion.avertissement}</p>}
            {pointsUtilisables && (
              <form className="mt-2 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); convertir(); }}>
                <Saisie className="flex-1" label="Points à utiliser" type="number" inputMode="numeric" min={1} max={c.points} step={1} value={points}
                  onChange={(e) => setPoints(e.target.value)} erreur={conversion.erreur}
                  aide={Number(points) > 0 ? `= ${fmt(Math.floor(Number(points)) * f.valeurPoint)} ${t("d'avoir, à dépenser par le moyen de paiement « Avoir »")}` : undefined} />
                <Bouton type="submit" variante="sombre" charge={conversion.enCours} icone={<Gift size={15} aria-hidden />}>{t("Changer en avoir")}</Bouton>
              </form>
            )}
          </>
        )}
      </section>

      {fiche.avoirs.length > 0 && (
        <section aria-label={t("Avoirs")}>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{t("Avoirs disponibles")}</h4>
          <ul className="mt-1.5 space-y-1">
            {fiche.avoirs.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-xl border border-[#F0F0F0] px-3 py-2">
                <span className="min-w-0 flex-1"><span className="font-mono text-[12.5px] font-semibold">{a.code}</span>{a.expire && <span className="ml-2 text-[11.5px] text-[#888888]">{t("jusqu'au")} {dateCourte(a.expire)}</span>}</span>
                <span className="font-bold tabular-nums">{fmt(a.solde)}</span>
                {onUtiliserAvoir && <Bouton variante="secondaire" taille="compact" onClick={() => onUtiliserAvoir({ code: a.code, solde: a.solde })}>{t("Utiliser")}</Bouton>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(fiche.creditActif || c.credit.utilise > 0) && (
        <section aria-label={t("Crédit")}>
          <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#666666]">
            {t("Crédit")}
            {c.credit.bloque && <Badge ton="danger">{t("Bloqué")}</Badge>}
            {fiche.enRetard > 0 && <Badge ton="danger" icone={<AlertTriangle size={11} aria-hidden />}>{t("En retard")}</Badge>}
          </h4>
          <dl className="mt-1.5 grid grid-cols-3 gap-2">
            <Chiffre libelle={t("Autorisé")} valeur={fmt(c.credit.plafond)} />
            <Chiffre libelle={t("Utilisé")} valeur={fmt(c.credit.utilise)} alerte={fiche.enRetard > 0} />
            <Chiffre libelle={t("Disponible")} valeur={fmt(c.credit.bloque || fiche.enRetard > 0 ? 0 : c.credit.disponible)} />
          </dl>
          {fiche.enRetard > 0 && <p role="alert" className="mt-2 text-[12.5px] text-[#B91C1C]">{t("Paiement en retard")} : {fmt(fiche.enRetard)}. {t("La vente à crédit est refusée tant que ce retard n'est pas réglé.")}</p>}
          {fiche.echeances.length > 0 && (
            <ul className="mt-2 space-y-1">
              {fiche.echeances.map((e) => (
                <li key={e.commandeId} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="text-[#666666]">{e.numero ?? t("Vente")} · {t("échéance")} {dateCourte(e.echeance)}{e.enRetard ? ` · ${e.joursRetard} ${t("j de retard")}` : ""}</span>
                  <span className={`font-semibold tabular-nums ${e.enRetard ? "text-[#B91C1C]" : ""}`}>{fmt(e.reste)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!compact && (
        <section aria-label={t("Derniers achats")}>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{t("Derniers achats")}</h4>
          {!fiche.achats.length ? <p className="mt-1 text-[12.5px] text-[#666666]">{t("Aucun achat enregistré.")}</p> : (
            <ul className="mt-1.5 divide-y divide-[#F0F0F0]">
              {fiche.achats.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-[12.5px]">
                  <span className="min-w-0">
                    <span className="font-semibold">{a.numero}</span>
                    <span className="ml-2 text-[#666666]">{dateCourte(a.date)} · {a.lignes} {t("article(s)")} · {a.canal === "pos" ? t("magasin") : t("en ligne")}</span>
                    {a.statut === "annulee" && <Badge ton="neutre" className="ml-2">{t("Annulée")}</Badge>}
                  </span>
                  <span className="font-semibold tabular-nums">{fmt(a.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
