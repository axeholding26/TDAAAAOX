"use client";
// Supervision des caisses — LIVE OPERATIONS (§61) : état de chaque caisse,
// scanners, transactions du jour, alertes. Un clic sur une caisse ouvre son
// détail (session, caissier, ventes, appareils, dernier signal).
// Source : GET /api/pos/supervision, relue toutes les 30 s et à chaque fait
// du flux temps réel qui change l'état d'une caisse.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, BadgeConnexion, EtatChargement, EtatPos, EtatVide, FOCUS, Tiroir } from "@/components/pos/ui";
import { Carte, Chiffre, EnTete, Page, useLecture } from "@/components/pos/finance/commun";
import { useFluxPos } from "@/components/pos/scanner/useFluxPos";
import ListeAppareils from "@/components/pos/scanner/ListeAppareils";
import type { Alerte } from "@/lib/pos/alertes";
import { Actualiser, ListeAlertes, bornes, dateHeure, heure, type Fait } from "./commun";

type Etat = "active" | "muette" | "fermee";
type Caisse = {
  id: string; nom: string; actif: boolean; magasinId: string; magasinNom: string; demo: boolean; etat: Etat; dernierSignalAt: string | null;
  session: { id: string; ouverteAt: string; caissier: string; fondsInitial: number; nbVentes: number } | null;
  ventes: { transactions: number; ca: number }; scanners: number; scannersEnLigne: number;
};
type Reponse = {
  caisses: Caisse[]; alertes: Alerte[];
  resume: { actives: number; muettes: number; fermees: number; scanners: number; scannersEnLigne: number; transactions: number; ca: number };
  detail: null | {
    caisse: Caisse;
    ventes: { id: string; numero: string; total: number; annulee: boolean; createdAt: string; vendeur: string | null; client: string }[];
    appareils: { id: string; nom: string; type: string; dernierSignalAt: string | null; enLigne: boolean }[];
  };
};

/** L'état est dit par un point de couleur ET par un texte : la couleur seule ne suffit pas. */
const ETATS: Record<Etat, { point: string; libelle: string; ton: "positif" | "attention" | "danger" }> = {
  active: { point: "#16A34A", libelle: "Ouverte et active", ton: "positif" },
  muette: { point: "#F59E0B", libelle: "Ouverte, sans signal récent", ton: "attention" },
  fermee: { point: "#DC2626", libelle: "Fermée", ton: "danger" },
};
const FAITS_UTILES = ["sale.created", "sale.cancelled", "return.created", "cash.opened", "cash.closed", "device.connected", "device.disconnected"];

export function Supervision() {
  const t = useT();
  const { fmt } = useDevise();
  const [ouverte, setOuverte] = useState<string | null>(null);
  // « Aujourd'hui » à l'heure du poste ; recalculé à chaque rendu de la page seulement si le jour change.
  const jour = new Date().toDateString();
  const requete = useMemo(() => {
    const b = bornes({ preset: "aujourdhui", du: "", au: "" })!;
    const p = new URLSearchParams({ debut: b.debut.toISOString(), fin: b.fin.toISOString() });
    return p.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jour]);
  const { donnees, erreur, charge, recharger } = useLecture<Reponse>(`/api/pos/supervision?${requete}`);
  const detail = useLecture<Reponse>(ouverte ? `/api/pos/supervision?${requete}&caisseId=${encodeURIComponent(ouverte)}` : null);

  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relire = useCallback(() => { void recharger(); if (ouverte) void detail.recharger(); }, [recharger, ouverte, detail.recharger]); // eslint-disable-line react-hooks/exhaustive-deps
  const flux = useFluxPos({ portee: "boutique", surEvenement: (e: Fait) => {
    if (!FAITS_UTILES.includes(e.type)) return;
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(relire, 1200);
  } });
  // Un poste qui se tait ne produit aucun événement : la relecture périodique fait passer sa caisse à l'orange.
  useEffect(() => { const i = setInterval(relire, 30_000); return () => { clearInterval(i); if (minuterie.current) clearTimeout(minuterie.current); }; }, [relire]);

  const magasins = useMemo(() => {
    const groupes = new Map<string, { nom: string; demo: boolean; caisses: Caisse[] }>();
    for (const c of donnees?.caisses ?? []) groupes.set(c.magasinId, { nom: c.magasinNom, demo: c.demo, caisses: [...(groupes.get(c.magasinId)?.caisses ?? []), c] });
    return [...groupes.entries()];
  }, [donnees]);
  const d = detail.donnees?.detail ?? null;
  const r = donnees?.resume;

  return (
    <Page>
      <EnTete titre="Supervision des caisses" sousTitre="L'état de chaque caisse et de ses scanners, en direct. Touchez une caisse pour voir sa session, ses ventes et ses appareils.">
        <BadgeConnexion etat={flux.enLigne ? "en_ligne" : flux.etat === "connexion" ? "synchronisation" : "hors_ligne"} />
        <Actualiser onClick={relire} charge={charge} />
      </EnTete>

      {erreur && !donnees ? <EtatPos code={erreur.code} message={erreur.message} onReessayer={recharger} />
        : !donnees || !r ? <EtatChargement texte="Lecture de l'état des caisses…" />
        : (
          <>
            {erreur && <EtatPos compact code={erreur.code} message={erreur.message} onReessayer={recharger} />}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Chiffre fort label="Caisses actives" valeur={`${r.actives} / ${r.actives + r.muettes + r.fermees}`} aide={r.muettes ? t("{0} ouverte(s) sans signal récent", r.muettes) : undefined} />
              <Chiffre label="Scanners en ligne" valeur={`${r.scannersEnLigne} / ${r.scanners}`} />
              <Chiffre label="Transactions du jour" valeur={String(r.transactions)} />
              <Chiffre label="Chiffre d'affaires du jour" valeur={fmt(r.ca)} />
            </div>

            {magasins.length === 0 ? <EtatVide titre="Aucune caisse" texte="Créez un magasin et une caisse dans les réglages de la caisse." /> : magasins.map(([id, m]) => (
              <Carte key={id} titre={m.nom} actions={m.demo ? <Badge ton="info">{t("DÉMO")}</Badge> : undefined}>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {m.caisses.map((c) => {
                    const e = ETATS[c.etat];
                    return (
                      <li key={c.id}>
                        <button type="button" onClick={() => setOuverte(c.id)} aria-haspopup="dialog"
                          className={`w-full rounded-2xl border border-[#E8E8E8] bg-white p-4 text-left transition-colors hover:border-[#111111] ${FOCUS}`}>
                          <span className="flex items-center gap-2">
                            <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: e.point }} aria-hidden />
                            <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-[#111111]">{c.nom}</span>
                          </span>
                          <span className="mt-1 block text-[12px] font-semibold" style={{ color: e.point === "#F59E0B" ? "#B45309" : e.point === "#16A34A" ? "#15803D" : "#B91C1C" }}>{t(!c.actif ? "Désactivée" : e.libelle)}</span>
                          <span className="mt-2 block text-[12px] text-[#666666]">{c.session ? t("{0} · depuis {1}", c.session.caissier, heure(c.session.ouverteAt, t.loc)) : t("Aucune session ouverte")}</span>
                          <span className="mt-1 block text-[12px] tabular-nums text-[#666666]">{t("{0} vente(s) · {1}", c.ventes.transactions, fmt(c.ventes.ca))}</span>
                          <span className="mt-1 block text-[12px] text-[#666666]">{c.scanners ? t("Scanners : {0} en ligne sur {1}", c.scannersEnLigne, c.scanners) : t("Aucun téléphone-scanner")}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Carte>
            ))}
            <p className="text-[11.5px] leading-relaxed text-[#888888]">{t("Une caisse « ouverte, sans signal récent » a une session ouverte mais son écran n'a pas été vu depuis 2 minutes : écran fermé, poste éteint ou hors ligne. Les ventes déjà enregistrées ne sont pas concernées.")}</p>

            <Carte titre="Alertes"><ListeAlertes alertes={donnees.alertes} /></Carte>
            <Carte titre="Appareils connectés"><ListeAppareils portee="boutique" sansMateriel /></Carte>
          </>
        )}

      <Tiroir ouverte={!!ouverte} onFermer={() => setOuverte(null)} titre={d ? `${d.caisse.nom} — ${d.caisse.magasinNom}` : "Caisse"} largeur="lg">
        {detail.erreur && !d ? <EtatPos compact code={detail.erreur.code} message={detail.erreur.message} onReessayer={detail.recharger} />
          : !d ? <EtatChargement compact />
          : (
            <div className="space-y-5 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge ton={ETATS[d.caisse.etat].ton}>{t(!d.caisse.actif ? "Désactivée" : ETATS[d.caisse.etat].libelle)}</Badge>
                <span className="text-[12px] text-[#666666]">{d.caisse.dernierSignalAt ? t("Dernier signal : {0}", dateHeure(d.caisse.dernierSignalAt, t.loc)) : t("Ce poste n'a jamais donné signe de vie.")}</span>
              </div>
              <section>
                <h3 className="mb-1 text-[12px] font-bold uppercase tracking-wide text-[#666666]">{t("Session")}</h3>
                {d.caisse.session ? (
                  <dl className="divide-y divide-[#F0F0F0]">
                    <div className="flex justify-between py-2"><dt className="text-[#666666]">{t("Caissier")}</dt><dd className="font-semibold">{d.caisse.session.caissier}</dd></div>
                    <div className="flex justify-between py-2"><dt className="text-[#666666]">{t("Ouverte le")}</dt><dd className="font-semibold">{dateHeure(d.caisse.session.ouverteAt, t.loc)}</dd></div>
                    <div className="flex justify-between py-2"><dt className="text-[#666666]">{t("Fonds initial")}</dt><dd className="font-semibold tabular-nums">{fmt(d.caisse.session.fondsInitial)}</dd></div>
                    <div className="flex justify-between py-2"><dt className="text-[#666666]">{t("Ventes de la session")}</dt><dd className="font-semibold tabular-nums">{d.caisse.session.nbVentes}</dd></div>
                  </dl>
                ) : <p className="text-[#666666]">{t("Aucune session ouverte sur cette caisse.")}</p>}
              </section>
              <section>
                <h3 className="mb-1 text-[12px] font-bold uppercase tracking-wide text-[#666666]">{t("Ventes du jour")}</h3>
                {d.ventes.length === 0 ? <p className="text-[#666666]">{t("Aucune vente aujourd'hui sur cette caisse.")}</p> : (
                  <ul className="divide-y divide-[#F0F0F0]">
                    {d.ventes.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0"><span className="font-semibold text-[#111111]">{v.numero}</span><span className="block truncate text-[12px] text-[#666666]">{[heure(v.createdAt, t.loc), v.vendeur, v.client].filter(Boolean).join(" · ")}</span></span>
                        <span className="flex-shrink-0 text-right tabular-nums"><span className={v.annulee ? "text-[#888888] line-through" : "font-bold"}>{fmt(v.total)}</span>{v.annulee && <span className="block text-[11px] text-[#B91C1C]">{t("Annulée")}</span>}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="mb-1 text-[12px] font-bold uppercase tracking-wide text-[#666666]">{t("Appareils")}</h3>
                {d.appareils.length === 0 ? <p className="text-[#666666]">{t("Aucun téléphone-scanner appairé à cette caisse.")}</p> : (
                  <ul className="divide-y divide-[#F0F0F0]">
                    {d.appareils.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0"><span className="font-semibold text-[#111111]">{a.nom}</span><span className="block text-[12px] text-[#666666]">{a.dernierSignalAt ? t("Dernier signal : {0}", dateHeure(a.dernierSignalAt, t.loc)) : t("Jamais vu")}</span></span>
                        <Badge ton={a.enLigne ? "positif" : "neutre"}>{t(a.enLigne ? "En ligne" : "Hors ligne")}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
      </Tiroir>
    </Page>
  );
}
