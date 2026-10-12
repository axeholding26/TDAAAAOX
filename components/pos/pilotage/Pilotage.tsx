"use client";
// Pilotage en direct du magasin (§36, §37) : chiffres de la période, encaissé
// et à crédit, tableau par magasin, activité en direct, alertes.
// Les chiffres viennent de GET /api/pos/tableau-de-bord (ventes de caisse
// réelles, retours déduits). L'activité arrive par le flux temps réel en portée
// boutique ; chaque vente, annulation ou retour fait relire les chiffres.
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, BadgeConnexion, EtatChargement, EtatPos, EtatVide } from "@/components/pos/ui";
import { Carte, Chiffre, EnTete, Page, useLecture } from "@/components/pos/finance/commun";
import { useFluxPos } from "@/components/pos/scanner/useFluxPos";
import { MODES_PAIEMENT } from "@/lib/pos/paiements";
import type { Indicateurs } from "@/lib/pos/analytics/ventes";
import type { ModePaiement } from "@/lib/pos/types";
import { Actualiser, BarreFiltres, PanneauAlertes, detailFait, heure, montantFait, titreFait, tonFait, useFiltres, type Fait, type ListesFiltres } from "./commun";

type Reponse = {
  devise: string; voirCouts: boolean; resume: Indicateurs; precedent: { ca: number; transactions: number };
  aCredit: number; encaisse: number; encaissements: { mode: string; montant: number; nombre: number }[];
  magasins: { id: string; nom: string; actif: boolean; ca: number; transactions: number; marge: number | null; caisses: number; caissesOuvertes: number }[];
  sansMagasin: { ca: number; transactions: number } | null;
  activite: Fait[]; filtres: ListesFiltres;
};

/** Faits qui changent les chiffres : ils déclenchent une relecture. */
const FAITS_CHIFFRES = ["sale.created", "sale.cancelled", "return.created"];
const FAITS_AFFICHES = [...FAITS_CHIFFRES, "scan.created", "cash.opened", "cash.closed", "cash.movement", "device.connected", "device.disconnected", "alert.created"];

export function Pilotage() {
  const t = useT();
  const { fmt } = useDevise();
  const { filtres, setFiltres, url } = useFiltres("/api/pos/tableau-de-bord");
  const { donnees, erreur, charge, recharger } = useLecture<Reponse>(url);
  const [direct, setDirect] = useState<Fait[]>([]);
  const [versionAlertes, setVersionAlertes] = useState(0);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Le serveur rend les 30 derniers faits ; le flux ajoute les suivants en tête.
  useEffect(() => { if (donnees) setDirect(donnees.activite); }, [donnees]);
  useEffect(() => () => { if (minuterie.current) clearTimeout(minuterie.current); }, []);

  const surEvenement = useCallback((e: Fait) => {
    if (!FAITS_AFFICHES.includes(e.type)) return;
    if (filtres.magasinId && e.magasinId && e.magasinId !== filtres.magasinId) return;
    if (filtres.caisseId && e.caisseId !== filtres.caisseId) return;
    setDirect((liste) => (e.seq && liste.some((x) => x.seq === e.seq) ? liste : [e, ...liste].slice(0, 40)));
    if (e.type === "alert.created") setVersionAlertes((v) => v + 1);
    if (FAITS_CHIFFRES.includes(e.type)) {
      // Plusieurs ventes à la suite : une seule relecture.
      if (minuterie.current) clearTimeout(minuterie.current);
      minuterie.current = setTimeout(() => void recharger(), 1500);
    }
  }, [filtres.magasinId, filtres.caisseId, recharger]);
  const flux = useFluxPos({ portee: "boutique", surEvenement });

  const nomCaisse = (id: string | null) => donnees?.filtres.magasins.flatMap((m) => m.caisses).find((c) => c.id === id)?.nom ?? null;
  const r = donnees?.resume;
  const variation = donnees && donnees.precedent.ca > 0 && r ? Math.round(((r.ca - donnees.precedent.ca) / donnees.precedent.ca) * 100) : null;

  return (
    <Page>
      <EnTete titre="Pilotage en direct" sousTitre="Les ventes de vos caisses, au moment où elles se font. Chiffres nets des remises et des retours ; une vente à crédit compte dès la vente.">
        <BadgeConnexion etat={flux.enLigne ? "en_ligne" : flux.etat === "connexion" ? "synchronisation" : "hors_ligne"} />
        <Actualiser onClick={() => void recharger()} charge={charge} />
      </EnTete>

      <BarreFiltres filtres={filtres} onChange={setFiltres} listes={donnees?.filtres ?? null} />

      {flux.etat === "refuse" && <p role="status" className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#B45309]">{t("L'activité en direct n'est pas disponible pour votre compte : les chiffres se mettent à jour avec « Actualiser ».")}</p>}

      {erreur && !donnees ? <EtatPos code={erreur.code} message={erreur.message} onReessayer={recharger} />
        : !donnees || !r ? <EtatChargement texte="Chargement des chiffres…" />
        : (
          <>
            {erreur && <EtatPos compact code={erreur.code} message={erreur.message} onReessayer={recharger} />}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Chiffre fort label="Chiffre d'affaires" valeur={fmt(r.ca)} aide={variation === null ? undefined : t("{0} % par rapport à la période précédente", `${variation >= 0 ? "+" : ""}${variation}`)} />
              <Chiffre label="Transactions" valeur={String(r.transactions)} />
              <Chiffre label="Panier moyen" valeur={fmt(r.panierMoyen)} />
              {r.marge !== null
                ? <Chiffre label="Marge" valeur={fmt(r.marge)} aide={t(r.lignesCoutApproche ? "{0} % du hors taxes — approchée" : "{0} % du hors taxes", r.margePct ?? 0)} ton={r.marge < 0 ? "danger" : undefined} />
                : <Chiffre label="Marge" valeur="—" aide="Réservée aux comptes qui voient les prix d'achat" />}
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Chiffre label="Encaissé" valeur={fmt(donnees.encaisse)} />
              <Chiffre label="Vendu à crédit" valeur={fmt(donnees.aCredit)} />
              <Chiffre label="Remises accordées" valeur={fmt(r.remises)} />
              <Chiffre label="Retours" valeur={fmt(r.retours)} aide={t("{0} % des ventes", r.tauxRetour)} />
            </div>

            {r.transactions === 0 && <EtatVide compact titre="Aucune vente en caisse sur cette période" texte="Les chiffres apparaîtront ici dès la première vente enregistrée à la caisse." />}

            <div className="grid gap-5 lg:grid-cols-2">
              <Carte titre="Activité en direct">
                {direct.length === 0 ? <EtatVide compact titre="Aucune activité récente" texte="Ventes, retours, scans et ouvertures de caisse des dernières 24 heures s'affichent ici." /> : (
                  <ul aria-live="polite" className="max-h-[420px] divide-y divide-[#F0F0F0] overflow-y-auto">
                    {direct.map((f, i) => {
                      const montant = montantFait(f);
                      return (
                        <li key={f.seq ?? `x${i}`} className="flex items-center gap-3 py-2.5">
                          <span className="w-11 flex-shrink-0 text-[11.5px] tabular-nums text-[#888888]">{heure(f.createdAt, t.loc)}</span>
                          <div className="min-w-0 flex-1">
                            <Badge ton={tonFait(f.type)}>{t(titreFait(f.type))}</Badge>
                            <p className="mt-0.5 truncate text-[12px] text-[#666666]">{[nomCaisse(f.caisseId), detailFait(f)].filter(Boolean).join(" · ")}</p>
                          </div>
                          {montant !== null && <span className="flex-shrink-0 text-[13px] font-bold tabular-nums text-[#111111]">{fmt(montant)}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Carte>

              <Carte titre="Alertes"><PanneauAlertes version={versionAlertes} /></Carte>
            </div>

            <Carte titre="Par magasin">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[13px]">
                  <thead className="text-[11px] uppercase tracking-wide text-[#666666]">
                    <tr><th className="py-2 font-semibold">{t("Magasin")}</th><th className="py-2 text-right font-semibold">{t("Chiffre d'affaires")}</th><th className="py-2 text-right font-semibold">{t("Ventes")}</th><th className="py-2 text-right font-semibold">{t("Marge")}</th><th className="py-2 text-right font-semibold">{t("Caisses ouvertes")}</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0F0]">
                    {donnees.magasins.map((m) => (
                      <tr key={m.id}>
                        <td className="py-2.5 font-semibold text-[#111111]">{m.nom}{!m.actif && <span className="ml-2 text-[11px] font-normal text-[#888888]">{t("désactivé")}</span>}</td>
                        <td className="py-2.5 text-right tabular-nums">{fmt(m.ca)}</td>
                        <td className="py-2.5 text-right tabular-nums">{m.transactions}</td>
                        <td className="py-2.5 text-right tabular-nums">{m.marge === null ? "—" : fmt(m.marge)}</td>
                        <td className="py-2.5 text-right tabular-nums">{m.caissesOuvertes} / {m.caisses}</td>
                      </tr>
                    ))}
                    {donnees.sansMagasin && (
                      <tr><td className="py-2.5 text-[#666666]">{t("Ancienne caisse (sans magasin)")}</td><td className="py-2.5 text-right tabular-nums">{fmt(donnees.sansMagasin.ca)}</td><td className="py-2.5 text-right tabular-nums">{donnees.sansMagasin.transactions}</td><td className="py-2.5 text-right">—</td><td className="py-2.5 text-right">—</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Carte>

            {donnees.encaissements.length > 0 && (
              <Carte titre="Encaissements par moyen de paiement">
                <ul className="divide-y divide-[#F0F0F0]">
                  {donnees.encaissements.map((e) => {
                    const def = MODES_PAIEMENT[e.mode as ModePaiement];
                    return (
                      <li key={e.mode} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13px]">
                        <span className="font-semibold text-[#111111]">{t(def?.libelle ?? e.mode)}{def?.statut === "declaratif" && <span className="ml-2"><Badge ton="attention">{t("Non vérifié")}</Badge></span>}</span>
                        <span className="tabular-nums">{fmt(e.montant)} <span className="text-[#888888]">· {e.nombre}</span></span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[11.5px] text-[#888888]">{t("Remboursements déduits. « Non vérifié » : déclaré par le caissier, sans confirmation d'un prestataire.")}</p>
              </Carte>
            )}
          </>
        )}
    </Page>
  );
}
