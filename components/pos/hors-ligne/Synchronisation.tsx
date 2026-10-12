"use client";
// Mode hors ligne de la caisse, côté écran :
//   - BandeauHorsLigne : 🟠 MODE HORS LIGNE, ce qui reste disponible et ce qui
//     ne l'est pas, ventes en attente, session expirée ;
//   - EcranSynchronisation (tiroir, ouvert depuis le badge de connexion) : file
//     en attente, dernière synchronisation, conflits et refus à traiter avec
//     leur explication, export de secours de la file en JSON, limites du mode.
// Un tiroir plutôt qu'une page : sans réseau, on ne peut pas changer de page.
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Download, RefreshCw, WifiOff } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, Bouton, EtatChargement, EtatVide, Tiroir } from "@/components/pos/ui";
import type { Mutation } from "@/lib/pos/hors-ligne/file";
import { exporter, lireFileLocale, marquerTraitee, marquerVue, rafraichirCatalogue, relancer } from "@/lib/pos/hors-ligne/moteur";
import { useHorsLigne } from "./useHorsLigne";

/** « il y a 12 min », « il y a 3 h », « il y a 2 j ». */
function age(t: ReturnType<typeof useT>, iso: string | null): string {
  if (!iso) return t("jamais");
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return t("à l'instant");
  if (min < 60) return t("il y a {0} min", min);
  if (min < 1440) return t("il y a {0} h", Math.round(min / 60));
  return t("il y a {0} j", Math.round(min / 1440));
}

const DISPONIBLE = ["Vente en espèces", "Recherche dans le catalogue enregistré sur cet appareil", "Scan par la caméra ou la douchette de ce poste", "Panier mis en attente sur cet appareil"];
const INDISPONIBLE = ["Vente à crédit", "Paiement par avoir", "Code promo", "Création de produit", "Scans du téléphone", "Retours et annulations", "Clients jamais affichés sur ce poste", "Ouverture et fermeture de caisse"];

export function BandeauHorsLigne({ onOuvrir }: { onOuvrir: () => void }) {
  const t = useT();
  const hl = useHorsLigne();
  // L'âge affiché avance même si rien d'autre ne change à l'écran.
  const [, tic] = useState(0);
  useEffect(() => { const i = setInterval(() => tic((n) => n + 1), 60_000); return () => clearInterval(i); }, []);

  if (hl.reconnexion) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3 text-[12.5px] leading-relaxed text-[#92400E]">
        <AlertTriangle size={16} aria-hidden className="flex-shrink-0" />
        <p className="min-w-0 flex-1">
          <strong>{t("Reconnexion nécessaire.")}</strong> {t(hl.blocage ?? "Votre session a expiré.")} {hl.enAttente > 0 ? t("{0} vente(s) restent enregistrées sur cet appareil et partiront dès votre reconnexion.", hl.enAttente) : null}
        </p>
        <Bouton variante="sombre" taille="compact" href="/connexion?callbackUrl=%2Fdashboard%2Fpos%2Fcaisse">{t("Se reconnecter")}</Bouton>
      </div>
    );
  }
  if (!hl.enLigne) {
    return (
      <section role="status" aria-label={t("Mode hors ligne")} className="rounded-2xl border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3 text-[12.5px] leading-relaxed text-[#92400E]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-bold tracking-wide"><span aria-hidden>🟠</span><WifiOff size={15} aria-hidden />{t("MODE HORS LIGNE")}</p>
          <Bouton variante="secondaire" taille="compact" onClick={onOuvrir}>{hl.enAttente > 0 ? t("{0} vente(s) en attente", hl.enAttente) : t("Synchronisation")}</Bouton>
        </div>
        {hl.catalogueAt ? (
          <>
            <p className="mt-1">{t("Les ventes sont enregistrées sur cet appareil et seront envoyées au retour du réseau. Prix et stock : catalogue enregistré {0}.", age(t, hl.catalogueAt))}</p>
            <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <p><span className="font-bold text-[#15803D]">{t("Disponible")} : </span>{DISPONIBLE.map((x) => t(x)).join(" · ")}. {t("Mobile Money et carte : acceptés, marqués « à confirmer ».")}</p>
              <p><span className="font-bold text-[#B91C1C]">{t("Indisponible")} : </span>{INDISPONIBLE.map((x) => t(x)).join(" · ")}.</p>
            </div>
          </>
        ) : (
          <p className="mt-1">{t("Le catalogue n'a pas encore été enregistré sur cet appareil : la caisse doit être ouverte une première fois avec le réseau. Aucune vente ne peut être prise pour l'instant.")}</p>
        )}
      </section>
    );
  }
  if (hl.enAttente > 0 || hl.aTraiter > 0 || hl.conflits > 0) {
    const ton = hl.aTraiter > 0 || hl.conflits > 0;
    return (
      <div role="status" className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-2.5 text-[12.5px] leading-relaxed ${ton ? "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]" : "border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF]"}`}>
        {ton ? <AlertTriangle size={16} aria-hidden className="flex-shrink-0" /> : <Clock size={16} aria-hidden className="flex-shrink-0" />}
        <p className="min-w-0 flex-1">
          {hl.enAttente > 0 && <>{hl.blocage ? t(hl.blocage) : t("{0} vente(s) hors ligne en cours d'envoi au serveur.", hl.enAttente)} </>}
          {hl.aTraiter > 0 && <>{t("{0} vente(s) hors ligne refusée(s) par le serveur : à traiter.", hl.aTraiter)} </>}
          {hl.conflits > 0 && <>{t("{0} vente(s) synchronisée(s) avec un écart à vérifier.", hl.conflits)}</>}
        </p>
        <Bouton variante="secondaire" taille="compact" onClick={onOuvrir}>{t("Voir")}</Bouton>
      </div>
    );
  }
  return null;
}

const LIMITES = [
  "La caisse doit avoir été ouverte au moins une fois avec le réseau sur cet appareil : le catalogue et les réglages y sont alors enregistrés.",
  "Le navigateur peut effacer les données d'un site peu utilisé (sur iPhone et iPad : après environ 7 jours sans visite). Synchronisez avant de laisser un appareil de côté, et exportez la file en cas de doute.",
  "Les données gardées sur l'appareil ne sont pas chiffrées : seuls le catalogue, les ventes en attente et le nom et le téléphone des clients récents y sont conservés.",
  "Deux caisses hors ligne peuvent vendre le même dernier article : la survente est détectée et signalée à la synchronisation, pas empêchée.",
  "Hors ligne, aucun paiement à distance n'est vérifié : un paiement Mobile Money ou carte reste « à confirmer » tant qu'il n'a pas été rapproché.",
];

export function EcranSynchronisation({ ouverte, onFermer }: { ouverte: boolean; onFermer: () => void }) {
  const t = useT();
  const { fmt } = useDevise();
  const hl = useHorsLigne();
  const [file, setFile] = useState<Mutation[] | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [aClore, setAClore] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(() => { lireFileLocale().then(setFile).catch(() => setErreur("La file enregistrée sur cet appareil est illisible.")); }, []);
  // Rechargée à chaque changement d'état du moteur (vente ajoutée, synchronisation terminée).
  useEffect(() => { if (ouverte) charger(); }, [ouverte, charger, hl.enAttente, hl.aTraiter, hl.conflits, hl.synchronisation]);

  const agir = async (nom: string, f: () => Promise<unknown>) => {
    setAction(nom); setErreur(null);
    try { await f(); } catch { setErreur("L'opération n'a pas abouti. Réessayez."); }
    setAction(null); setAClore(null);
    charger();
  };
  const telecharger = () => agir("export", async () => {
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(new Blob([JSON.stringify(await exporter(), null, 2)], { type: "application/json" }));
    lien.download = `axso-caisse-file-hors-ligne-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 10_000);
  });

  const enAttente = file?.filter((m) => m.statut === "en_attente") ?? [];
  const aTraiter = file?.filter((m) => m.statut === "a_traiter") ?? [];
  const conflits = file?.filter((m) => m.statut === "synchronisee" && !m.vu && (m.resultat?.conflits?.length ?? 0) > 0) ?? [];
  const faites = file?.filter((m) => m.statut === "synchronisee" && (m.vu || !m.resultat?.conflits?.length)) ?? [];
  const heure = (iso: string) => new Date(iso).toLocaleString(t.loc, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const titre = (m: Mutation) => (
    <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] font-semibold text-[#111111]">
      <span>{m.resultat?.numero ?? m.local?.numero ?? m.type}{m.resultat?.numero && m.local ? <span className="font-normal text-[#666666]"> ({m.local.numero})</span> : null}</span>
      <span className="tabular-nums">{m.local ? fmt(m.local.total) : ""}</span>
    </p>
  );

  return (
    <Tiroir ouverte={ouverte} onFermer={onFermer} titre="Synchronisation" description="Ventes saisies hors ligne sur cet appareil et leur envoi au serveur."
      actions={<>
        <Bouton variante="secondaire" onClick={telecharger} charge={action === "export"} disabled={!file?.length} icone={<Download size={15} aria-hidden />}>{t("Exporter la file (JSON)")}</Bouton>
        <Bouton onClick={() => agir("sync", () => relancer())} charge={action === "sync" || hl.synchronisation} disabled={!hl.enLigne || !enAttente.length} icone={<RefreshCw size={15} aria-hidden />}>{t("Synchroniser maintenant")}</Bouton>
      </>}>
      <div className="space-y-5 text-[12.5px] leading-relaxed text-[#555555]">
        <dl className="grid grid-cols-2 gap-2">
          {[
            [t("Connexion"), hl.reconnexion ? t("Reconnexion nécessaire") : hl.enLigne ? t("En ligne") : t("Hors ligne")],
            [t("Dernière synchronisation"), age(t, hl.derniereSynchroAt)],
            [t("En attente d'envoi"), String(hl.enAttente)],
            [t("Catalogue enregistré"), hl.catalogueAt ? `${age(t, hl.catalogueAt)} · ${t("{0} article(s)", hl.articles)}` : t("jamais")],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-[#FAFAFA] px-3 py-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{k}</dt><dd className="text-[13px] font-bold text-[#111111]">{v}</dd></div>
          ))}
        </dl>
        {hl.actif && hl.enLigne && (
          <Bouton variante="discret" taille="compact" onClick={() => agir("catalogue", rafraichirCatalogue)} charge={action === "catalogue"}>{t("Mettre à jour le catalogue enregistré")}</Bouton>
        )}
        {erreur && <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[#B91C1C]">{t(erreur)}</p>}
        {hl.blocage && enAttente.length > 0 && <p role="status" className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2 text-[#92400E]">{t(hl.blocage)}</p>}

        {file === null ? <EtatChargement compact texte="Lecture de la file enregistrée sur cet appareil…" /> : (
          <>
            {aTraiter.length > 0 && (
              <section aria-label={t("À traiter")} className="space-y-2">
                <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#B91C1C]">{t("À traiter")} ({aTraiter.length})</h3>
                <p>{t("Le serveur a refusé ces ventes pour une raison qui ne se réglera pas seule. Elles restent sur cet appareil : corrigez la cause puis relancez, ou réglez le cas à la main et classez-le.")}</p>
                <ul className="space-y-2">
                  {aTraiter.map((m) => (
                    <li key={m.cle} className="rounded-2xl border border-[#FECACA] p-3">
                      {titre(m)}
                      <p className="text-[11.5px] text-[#666666]">{heure(m.creeLocalAt)} · {t("{0} essai(s)", m.tentatives)}</p>
                      <p className="mt-1 text-[#B91C1C]">{t(m.erreur?.message ?? "Refusée par le serveur.")}</p>
                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        {aClore === m.cle ? (
                          <>
                            <p className="w-full text-[11.5px]">{t("Classer cette vente ne l'enregistre PAS sur le serveur. Ne le faites qu'après l'avoir ressaisie ou réglée à la main ; elle reste dans l'export.")}</p>
                            <Bouton variante="secondaire" taille="compact" onClick={() => setAClore(null)}>{t("Retour")}</Bouton>
                            <Bouton variante="danger" taille="compact" onClick={() => agir(m.cle, () => marquerTraitee(m.cle))} charge={action === m.cle}>{t("Confirmer : réglée à la main")}</Bouton>
                          </>
                        ) : (
                          <>
                            <Bouton variante="secondaire" taille="compact" onClick={() => setAClore(m.cle)} disabled={!!action}>{t("Classer")}</Bouton>
                            {m.erreur?.code === "ecart_a_valider" ? (
                              // Écart de prix au-delà du seuil : le serveur n'enregistre que sur validation d'un responsable (il vérifie ses droits).
                              <Bouton taille="compact" onClick={() => agir(m.cle, () => relancer(m.cle, true))} disabled={!hl.enLigne || !!action} charge={action === m.cle}>{t("Valider et enregistrer (responsable)")}</Bouton>
                            ) : (
                              <Bouton taille="compact" onClick={() => agir(m.cle, () => relancer(m.cle))} disabled={!hl.enLigne || !!action} charge={action === m.cle}>{t("Relancer")}</Bouton>
                            )}
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {conflits.length > 0 && (
              <section aria-label={t("Écarts à vérifier")} className="space-y-2">
                <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#B45309]">{t("Écarts à vérifier")} ({conflits.length})</h3>
                <p>{t("Ces ventes sont enregistrées sur le serveur. Il a constaté un écart avec son état, signalé aussi au responsable (alerte et journal d'audit).")}</p>
                <ul className="space-y-2">
                  {conflits.map((m) => (
                    <li key={m.cle} className="rounded-2xl border border-[#FCD34D] p-3">
                      {titre(m)}
                      <ul className="mt-1 list-disc space-y-1 pl-4">{m.resultat?.conflits?.map((c, i) => <li key={i}>{t(c.message)}</li>)}</ul>
                      <div className="mt-2 flex justify-end"><Bouton variante="secondaire" taille="compact" onClick={() => agir(m.cle, () => marquerVue(m.cle))} charge={action === m.cle}>{t("J'ai vérifié")}</Bouton></div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-label={t("En attente d'envoi")} className="space-y-2">
              <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#111111]">{t("En attente d'envoi")} ({enAttente.length})</h3>
              {enAttente.length === 0 ? <EtatVide compact titre="Aucune vente en attente" texte="Tout ce qui a été saisi sur cet appareil est enregistré sur le serveur." /> : (
                <ul className="space-y-2">
                  {enAttente.map((m, i) => (
                    <li key={m.cle} className="rounded-2xl border border-[#E8E8E8] p-3">
                      {titre(m)}
                      <p className="flex flex-wrap items-center gap-2 text-[11.5px] text-[#666666]">
                        {heure(m.creeLocalAt)}
                        <Badge ton="attention" icone={<Clock size={11} aria-hidden />}>{t("En attente de synchronisation")}</Badge>
                        {m.erreur?.code === "autre_utilisateur" ? <span>{t(m.erreur.message)}</span>
                          : i === 0 && m.tentatives > 0 && <span>{t("{0} essai(s)", m.tentatives)}{m.erreur?.message ? ` — ${t(m.erreur.message)}` : ""}</span>}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {faites.length > 0 && (
              <p className="flex items-center gap-2 text-[#15803D]"><CheckCircle2 size={14} aria-hidden />{t("{0} vente(s) hors ligne déjà synchronisée(s) ces 7 derniers jours.", faites.length)}</p>
            )}
          </>
        )}

        <section aria-label={t("Limites du mode hors ligne")} className="rounded-2xl bg-[#FAFAFA] p-3">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#111111]">{t("Limites du mode hors ligne")}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-4">{LIMITES.map((l) => <li key={l}>{t(l)}</li>)}</ul>
          {hl.persistant === false && <p className="mt-2 text-[#B45309]">{t("Ce navigateur n'a pas garanti la conservation des données de la caisse : il peut les effacer s'il manque de place.")}</p>}
        </section>
      </div>
    </Tiroir>
  );
}
