"use client";
// Réglages de la caisse : type de commerce (§72), mode simple / pro (§73-74),
// fonctions (drapeaux), taxes, remises, session, moyens de paiement, reçu,
// retours, magasins et caisses, appareils, droits de l'équipe, état technique.
// Lecture : GET /api/pos/reglages. Écriture : PATCH /api/pos/reglages (droit
// gerer_reglages, audité par la route). Sans ce droit, l'écran est en lecture seule.
import { useEffect, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Badge, BadgePaiement, Bouton, CLASSE_SAISIE, Champ, EtatChargement, EtatPos, FOCUS, Saisie } from "@/components/pos/ui";
import { Carte, EnTete, Page, appelPos, lireMontant, useLecture } from "@/components/pos/finance/commun";
import type { Demarrage } from "@/components/pos/caisse/api";
import ListeAppareils from "@/components/pos/scanner/ListeAppareils";
import { MODES_PAIEMENT } from "@/lib/pos/paiements";
import { FLAGS_POS, MODES_PAIEMENT_IDS, TYPES_COMMERCE, type FlagPos, type ModePaiement, type ReglagesPosValeurs, type TypeCommerce } from "@/lib/pos/types";
import { EXPLICATION_FLAGS, MODELES_COMMERCE } from "@/lib/pos/types-commerce";
import type { Metrique } from "@/lib/pos/metriques";
import { ReglagesMagasins } from "./ReglagesMagasins";
import { ReglagesEquipe } from "./ReglagesEquipe";

/** Sections modifiées par le formulaire (fidélité et crédit se règlent dans leurs propres écrans, sauf le délai de grâce du crédit). */
type Brouillon = Pick<ReglagesPosValeurs, "taxes" | "remises" | "caisse" | "paiements" | "recu" | "retours" | "stock" | "series" | "alertes"> & { credit: Pick<ReglagesPosValeurs["credit"], "graceJours"> };
const extraire = (r: ReglagesPosValeurs): Brouillon => ({ taxes: r.taxes, remises: r.remises, caisse: r.caisse, paiements: r.paiements, recu: r.recu, retours: r.retours, stock: r.stock, series: r.series, alertes: r.alertes, credit: { graceJours: r.credit.graceJours } });
/** Entier borné lu dans un champ numérique. */
const entier = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(Number(v)) || min));

/** Interrupteur accessible (case à cocher native habillée). */
function Interrupteur({ label, aide, valeur, onChange, disabled }: { label: string; aide?: string; valeur: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const t = useT();
  return (
    <label className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-[#FAFAFA] ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
      <input type="checkbox" role="switch" checked={valeur} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className={`mt-0.5 h-5 w-5 flex-shrink-0 accent-[#111111] ${FOCUS}`} />
      <span className="min-w-0"><span className="block text-[13px] font-semibold text-[#111111]">{t(label)}</span>{aide && <span className="block text-[12px] leading-relaxed text-[#666666]">{t(aide)}</span>}</span>
    </label>
  );
}

function EtatTechnique() {
  const t = useT();
  const { donnees, erreur, recharger } = useLecture<{ periodeHeures: number; metriques: Metrique[] }>("/api/pos/metriques");
  if (erreur && !donnees) return <EtatPos compact code={erreur.code} message={erreur.message} onReessayer={recharger} />;
  if (!donnees) return <EtatChargement compact />;
  return (
    <>
      <p className="mb-2 text-[12.5px] text-[#666666]">{t("Sur les {0} dernières heures. Une mesure sans source fiable est affichée « non mesuré », jamais estimée.", donnees.periodeHeures)}</p>
      <ul className="divide-y divide-[#F0F0F0]">
        {donnees.metriques.map((m) => (
          <li key={m.nom} className="py-2.5">
            <p className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
              <span className="font-semibold text-[#111111]">{t(m.libelle)} <code className="ml-1 text-[11px] font-normal text-[#888888]">{m.nom}</code></span>
              <span className="font-bold tabular-nums">{m.valeur === null ? <span className="font-semibold text-[#888888]">{t("Non mesuré")}</span> : `${m.valeur} ${m.unite}`}</span>
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[#666666]">{t(m.note)}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Reglages() {
  const t = useT();
  const { donnees, erreur, recharger } = useLecture<Demarrage>("/api/pos/reglages");
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [retour, setRetour] = useState<{ ok: boolean; message: string; code?: string } | null>(null);
  useEffect(() => { if (donnees) setBrouillon(extraire(donnees.reglages)); }, [donnees]);

  if (erreur && !donnees) return <Page><EnTete titre="Réglages de la caisse" /><EtatPos code={erreur.code} message={erreur.message} onReessayer={recharger} /></Page>;
  if (!donnees || !brouillon) return <Page><EnTete titre="Réglages de la caisse" /><EtatChargement /></Page>;

  const peut = donnees.droits.gerer_reglages;
  const modele = MODELES_COMMERCE[donnees.typeCommerce];
  const modifie = JSON.stringify(brouillon) !== JSON.stringify(extraire(donnees.reglages));

  const patch = async (cle: string, corps: Record<string, unknown>, message: string) => {
    setEnvoi(cle);
    const r = await appelPos("/api/pos/reglages", { method: "PATCH", corps });
    setEnvoi(null);
    setRetour(r.ok ? { ok: true, message } : { ok: false, message: r.message, code: r.code });
    if (r.ok) await recharger();
  };
  const regler = <S extends keyof Brouillon>(section: S, valeurs: Partial<Brouillon[S]>) => setBrouillon((b) => (b ? { ...b, [section]: { ...b[section], ...valeurs } } : b));
  const basculerMode = (m: ModePaiement, actif: boolean) => regler("paiements", { modes: MODES_PAIEMENT_IDS.filter((x) => (x === m ? actif : brouillon.paiements.modes.includes(x))) });
  const session = brouillon.caisse.sessionObligatoire;

  return (
    <Page>
      <EnTete titre="Réglages de la caisse" sousTitre="Ce que la caisse propose, à qui, et comment. Chaque changement est inscrit au journal d'audit." />
      {!peut && <p role="note" className="rounded-xl border border-[#E8E8E8] bg-[#F5F5F5] px-3 py-2 text-[12.5px] text-[#555555]">{t("Lecture seule : seul un compte autorisé à modifier les réglages de la caisse peut changer ces valeurs.")}</p>}
      {retour && (retour.ok
        ? <p role="status" className="rounded-xl border border-[#BBF7D0] bg-[#ECFDF5] px-3 py-2 text-[12.5px] font-semibold text-[#15803D]">{t(retour.message)}</p>
        : <EtatPos compact code={retour.code ?? "erreur_serveur"} message={retour.message} />)}

      <Carte titre="Type de commerce">
        <Champ label="Votre activité">{(a) => (
          <select {...a} className={CLASSE_SAISIE} value={donnees.typeCommerce} disabled={!peut || envoi === "type"} onChange={(e) => void patch("type", { typeCommerce: e.target.value as TypeCommerce }, "Type de commerce enregistré.")}>
            {TYPES_COMMERCE.map((c) => <option key={c} value={c}>{t(MODELES_COMMERCE[c].libelle)}</option>)}
          </select>
        )}</Champ>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#666666]">{t(modele.description)}</p>
        <p className="mt-1 text-[12.5px] text-[#666666]">{t("Préréglage conseillé : mode {0} ; fonctions : {1}.", t(modele.mode === "pro" ? "pro" : "simple"), modele.flags.map((f) => t(EXPLICATION_FLAGS[f].libelle)).join(", "))}</p>
        {modele.limites && <p role="note" className="mt-2 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#B45309]">{t(modele.limites)}</p>}
        {peut && (
          <div className="mt-3">
            <Bouton variante="secondaire" charge={envoi === "modele"} onClick={() => void patch("modele", { mode: modele.mode, flags: Object.fromEntries(modele.flags.map((f) => [f, true])), reglages: modele.reglages }, "Préréglage appliqué.")}>{t("Appliquer ce préréglage")}</Bouton>
            <p className="mt-1 text-[11.5px] text-[#888888]">{t("Allume les fonctions conseillées et ajuste quelques réglages. Rien n'est éteint ni effacé.")}</p>
          </div>
        )}
      </Carte>

      <Carte titre="Mode d'utilisation">
        <div role="radiogroup" aria-label={t("Mode d'utilisation")} className="grid gap-3 sm:grid-cols-2">
          {([["simple", "Simple", "Scan, panier, paiement. Le menu ne montre que l'essentiel ; ouvrir une session de caisse n'est pas exigé."], ["pro", "Pro", "Tous les écrans : inventaires, achats, finance, clients, analytics, équipe, magasins. La session de caisse est exigée pour vendre."]] as const).map(([id, nom, texte]) => (
            <button key={id} type="button" role="radio" aria-checked={donnees.mode === id} disabled={!peut || envoi === "mode"} onClick={() => donnees.mode !== id && void patch("mode", { mode: id }, "Mode enregistré. Le menu se met à jour au prochain chargement de page.")}
              className={`min-h-11 rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed ${FOCUS} ${donnees.mode === id ? "border-[#111111] bg-[#111111] text-white" : "border-[#E8E8E8] bg-white text-[#111111] hover:border-[#111111]"}`}>
              <span className="block text-[14px] font-bold">{t(nom)}</span>
              <span className={`mt-1 block text-[12.5px] leading-relaxed ${donnees.mode === id ? "text-white/80" : "text-[#666666]"}`}>{t(texte)}</span>
            </button>
          ))}
        </div>
      </Carte>

      <Carte titre="Fonctions">
        <div className="grid gap-1 sm:grid-cols-2">
          {FLAGS_POS.map((f: FlagPos) => (
            <Interrupteur key={f} label={EXPLICATION_FLAGS[f].libelle} aide={EXPLICATION_FLAGS[f].explication} valeur={donnees.flags[f]} disabled={!peut || envoi === f}
              onChange={(v) => void patch(f, { flags: { [f]: v } }, v ? "Fonction activée." : "Fonction désactivée.")} />
          ))}
        </div>
      </Carte>

      <form onSubmit={(e) => { e.preventDefault(); void patch("reglages", { reglages: brouillon, onboarding: { paiements: true } }, "Réglages enregistrés."); }} className="space-y-5">
        <fieldset disabled={!peut} className="space-y-5">
          <Carte titre="Taxes, remises et session">
            <div className="grid gap-3 sm:grid-cols-2">
              <Interrupteur label="Les prix du catalogue contiennent déjà la TVA" aide="Désactivé : la TVA s'ajoute au total du panier." valeur={brouillon.taxes.prixTTC} onChange={(v) => regler("taxes", { prixTTC: v })} />
              <Interrupteur label="Vendre même si le stock saisi est insuffisant" aide="Le stock passe en négatif et la vente est signalée." valeur={brouillon.stock.venteSansStock} onChange={(v) => regler("stock", { venteSansStock: v })} />
              <Saisie label="Plafond de remise" type="number" inputMode="decimal" min={0} max={100} suffixe="%" aide={t("Au-delà, il faut le droit « remise au-delà du plafond ».")} value={String(brouillon.remises.plafondPct)} onChange={(e) => regler("remises", { plafondPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
              <Saisie label="Fonds de caisse proposé à l'ouverture" inputMode="decimal" value={String(brouillon.caisse.fondsInitialDefaut)} onChange={(e) => { const n = lireMontant(e.target.value); regler("caisse", { fondsInitialDefaut: Number.isFinite(n) && n >= 0 ? n : 0 }); }} />
              <Champ label="Session de caisse pour vendre" aide={t("« Selon le mode » : exigée en mode pro, pas en mode simple.")}>{(a) => (
                <select {...a} className={CLASSE_SAISIE} value={session === null ? "auto" : session ? "oui" : "non"} onChange={(e) => regler("caisse", { sessionObligatoire: e.target.value === "auto" ? null : e.target.value === "oui" })}>
                  <option value="auto">{t("Selon le mode")}</option><option value="oui">{t("Toujours exigée")}</option><option value="non">{t("Jamais exigée")}</option>
                </select>
              )}</Champ>
            </div>
          </Carte>

          <div id="paiements" className="scroll-mt-24">
            <Carte titre="Moyens de paiement proposés à la caisse">
              <ul className="divide-y divide-[#F0F0F0]">
                {MODES_PAIEMENT_IDS.map((m) => {
                  const def = MODES_PAIEMENT[m];
                  const attente = def.statut === "a_connecter";
                  // Un avoir émis (retour, points de fidélité) doit pouvoir être dépensé : ce moyen reste toujours proposé.
                  const fixe = m === "avoir";
                  return (
                    <li key={m} className="flex flex-wrap items-center gap-3 py-2">
                      <div className="min-w-0 flex-1 basis-56"><Interrupteur label={def.libelle} aide={fixe ? "Toujours proposé : un avoir émis par un retour ou par des points de fidélité doit pouvoir être dépensé." : def.mention} valeur={!attente && brouillon.paiements.modes.includes(m)} disabled={attente || fixe} onChange={(v) => basculerMode(m, v)} /></div>
                      <BadgePaiement statut={def.statut} />
                    </li>
                  );
                })}
              </ul>
              {brouillon.paiements.modes.length === 0 && <p role="alert" className="mt-2 text-[12.5px] font-semibold text-[#B91C1C]">{t("Gardez au moins un moyen de paiement.")}</p>}
              <p className="mt-2 text-[11.5px] leading-relaxed text-[#888888]">{t("« Non vérifié » : le caissier confirme lui-même le paiement (SMS Mobile Money, ticket du terminal de carte) ; AXSO ne le contrôle pas, il se pointe ensuite dans le rapprochement. « Intégration en attente » : ce moyen n'est pas encore branché et ne peut pas être proposé.")}</p>
            </Carte>
          </div>

          <Carte titre="Stock, numéros de série, crédit et alertes">
            <div className="grid gap-3 sm:grid-cols-2">
              <Saisie label="Signaler un lot avant son expiration" type="number" inputMode="numeric" min={1} max={365} suffixe={t("jours")} aide={t("Un lot est marqué « expire bientôt » à ce nombre de jours de sa date d'expiration.")} value={String(brouillon.stock.seuilExpirationJours)} onChange={(e) => regler("stock", { seuilExpirationJours: entier(e.target.value, 1, 365) })} />
              <Interrupteur label="Numéros de série enregistrés uniquement" aide="La caisse refuse un numéro de série ou IMEI qui n'a pas été enregistré à la réception ou dans le stock. Désactivé : un numéro inconnu est créé à la vente." valeur={brouillon.series.enregistresUniquement} onChange={(v) => regler("series", { enregistresUniquement: v })} />
              <Saisie label="Délai de grâce du crédit" type="number" inputMode="numeric" min={0} max={90} suffixe={t("jours")} aide={t("Jours de retard tolérés avant qu'un client ne puisse plus acheter à crédit. 0 = dès le premier jour de retard.")} value={String(brouillon.credit.graceJours)} onChange={(e) => regler("credit", { graceJours: entier(e.target.value, 0, 90) })} />
              <Saisie label="Alerte produit dormant" type="number" inputMode="numeric" min={7} max={365} suffixe={t("jours")} aide={t("Un produit en stock sans aucune vente depuis ce nombre de jours est signalé.")} value={String(brouillon.alertes.dormantJours)} onChange={(e) => regler("alertes", { dormantJours: entier(e.target.value, 7, 365) })} />
              <Saisie label="Alerte marge faible" type="number" inputMode="decimal" min={0} max={100} suffixe="%" aide={t("Alerte quand la marge des 7 derniers jours passe sous ce seuil.")} value={String(brouillon.alertes.margeFaiblePct)} onChange={(e) => regler("alertes", { margeFaiblePct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
              <Saisie label="Alerte remboursements inhabituels" type="number" inputMode="decimal" min={0} max={100} suffixe="%" aide={t("Alerte quand les remboursements des 7 derniers jours dépassent cette part des ventes.")} value={String(brouillon.alertes.remboursementsPct)} onChange={(e) => regler("alertes", { remboursementsPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
            </div>
          </Carte>

          <Carte titre="Reçu et retours">
            <div className="grid gap-3 sm:grid-cols-2">
              <Saisie label="En-tête du reçu" maxLength={300} value={brouillon.recu.entete} onChange={(e) => regler("recu", { entete: e.target.value })} />
              <Saisie label="Pied de page du reçu" maxLength={300} value={brouillon.recu.piedDePage} onChange={(e) => regler("recu", { piedDePage: e.target.value })} />
              <Champ label="Format du reçu">{(a) => (
                <select {...a} className={CLASSE_SAISIE} value={brouillon.recu.format} onChange={(e) => regler("recu", { format: e.target.value as Brouillon["recu"]["format"] })}>
                  <option value="80mm">{t("Ticket 80 mm")}</option><option value="58mm">{t("Ticket 58 mm")}</option><option value="A4">A4</option>
                </select>
              )}</Champ>
              <Interrupteur label="Afficher la TVA sur le reçu" valeur={brouillon.recu.afficherTVA} onChange={(v) => regler("recu", { afficherTVA: v })} />
              <Saisie label="Délai de retour" type="number" inputMode="numeric" min={0} max={365} suffixe={t("jours")} aide={t("0 = sans limite.")} value={String(brouillon.retours.delaiJours)} onChange={(e) => regler("retours", { delaiJours: Math.min(365, Math.max(0, Math.floor(Number(e.target.value)) || 0)) })} />
              <Interrupteur label="Accepter un retour sans reçu" aide="La vente est alors retrouvée par le client, l'article ou le numéro de série." valeur={brouillon.retours.sansRecu} onChange={(v) => regler("retours", { sansRecu: v })} />
            </div>
          </Carte>
        </fieldset>
        {peut && (
          <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-[#E8E8E8] bg-white/95 p-3 shadow-lg backdrop-blur">
            {modifie && <span className="text-[12.5px] font-semibold text-[#B45309]">{t("Modifications non enregistrées")}</span>}
            <Bouton variante="secondaire" disabled={!modifie} onClick={() => setBrouillon(extraire(donnees.reglages))}>{t("Annuler")}</Bouton>
            <Bouton type="submit" charge={envoi === "reglages"} disabled={!modifie || brouillon.paiements.modes.length === 0}>{t("Enregistrer les réglages")}</Bouton>
          </div>
        )}
      </form>

      <div id="magasins" className="scroll-mt-24"><ReglagesMagasins peutGerer={donnees.droits.gerer_magasins} /></div>
      <div id="appareils" className="scroll-mt-24"><Carte titre="Appareils connectés"><ListeAppareils portee="boutique" /></Carte></div>
      {peut && <div id="equipe" className="scroll-mt-24"><ReglagesEquipe /></div>}
      {donnees.droits.voir_analytics && <Carte titre="État technique de la caisse"><EtatTechnique /></Carte>}
      <p className="text-[11.5px] text-[#888888]">{t("Fidélité, crédit client et promotions se règlent dans leurs écrans, menu « Clients en magasin ».")} <Badge ton="neutre">{t("Caisse & magasin")}</Badge></p>
    </Page>
  );
}
