"use client";
// Écran de paiement : une ou plusieurs lignes de paiement (mixte), monnaie à
// rendre, reste dû, part à crédit avec le plafond du client.
// Chaque moyen affiche son ÉTAT RÉEL (BadgePaiement) : un Mobile Money ou une
// carte sont « Non vérifié » — AXSO n'interroge aucun prestataire, c'est le
// caissier qui confirme avoir vu le paiement. Un moyen sans intégration est
// affiché « Intégration en attente » et ne peut pas être choisi.
// La répartition affichée (repartirPaiements) est celle que le serveur refera.
import { useState } from "react";
import { Plus, Trash2, User } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, BadgePaiement, Bouton, BoutonIcone, EtatPos, Modale, Saisie } from "@/components/pos/ui";
import type { Reponse } from "@/lib/pos/client/transport";
import { repartirPaiements, type DefinitionModePaiement, type Repartition } from "@/lib/pos/paiements";
import { decimalesDevise } from "@/lib/pos/tarification";
import type { DemandePaiementPos, ModePaiement, ResultatVente } from "@/lib/pos/types";
import { appelPos } from "./api";
import { idLocal, lireNombre, type ClientCaisse } from "./logique";

type LignePaiement = { id: string; mode: ModePaiement; montant: string; reference: string; prestataire: string };

export function Paiement({ total, modes, creditActif, droitCredit, client, caisseId, avoir, horsLigne = false, onChoisirClient, onEncaisser, onFermer }: {
  /** Total vérifié par le serveur. */
  total: number;
  modes: DefinitionModePaiement[];
  creditActif: boolean;
  droitCredit: boolean;
  client: ClientCaisse | null;
  caisseId: string | null;
  /** Avoir choisi sur la fiche du client : proposé d'emblée comme premier paiement. */
  avoir?: { code: string; solde: number } | null;
  /** Sans réseau : crédit et avoir indisponibles (le serveur seul peut les vérifier), paiements déclarés « à confirmer ». */
  horsLigne?: boolean;
  onChoisirClient: () => void;
  /** Enregistre la vente. La clé d'idempotence est tenue par l'appelant : un nouvel essai ne crée jamais de doublon. */
  onEncaisser: (paiements: DemandePaiementPos[]) => Promise<Reponse<ResultatVente>>;
  onFermer: () => void;
}) {
  const t = useT();
  const { fmt, devise } = useDevise();
  const dec = decimalesDevise(devise);
  const exigeServeur = (id: ModePaiement) => horsLigne && (id === "credit" || id === "avoir");
  const utilisables = modes.filter((m) => m.statut !== "a_connecter" && !exigeServeur(m.id));
  const parDefaut = utilisables.find((m) => m.id === "especes") ?? utilisables.find((m) => m.id !== "credit");
  const [lignes, setLignes] = useState<LignePaiement[]>(() => {
    if (!(total > 0)) return [];
    const parAvoir = avoir && utilisables.some((m) => m.id === "avoir") ? Math.min(avoir.solde, total) : 0;
    const reste = Math.round((total - parAvoir) * 100) / 100;
    return [
      ...(parAvoir > 0 ? [{ id: idLocal(), mode: "avoir" as const, montant: String(parAvoir), reference: avoir!.code, prestataire: "" }] : []),
      ...(parDefaut && reste > 0 ? [{ id: idLocal(), mode: parDefaut.id, montant: String(reste), reference: "", prestataire: "" }] : []),
    ];
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null);
  const definition = (mode: ModePaiement) => modes.find((m) => m.id === mode);

  const demandes: DemandePaiementPos[] = lignes
    .map((l) => ({ mode: l.mode, montant: lireNombre(l.montant) ?? 0, reference: l.reference.trim() || null, prestataire: l.prestataire.trim() || null }))
    .filter((p) => p.montant > 0);
  let repartition: Repartition | null = null;
  let refus: string | null = null;
  try { repartition = repartirPaiements(total, demandes, dec); } catch (e) { refus = (e as Error).message; }
  const reste = repartition?.reste ?? total;
  const referenceManquante = lignes.some((l) => definition(l.mode)?.reference === "obligatoire" && !l.reference.trim() && (lireNombre(l.montant) ?? 0) > 0);
  const creditSansClient = demandes.some((p) => p.mode === "credit") && !client;
  const pret = !!repartition && reste <= 0 && !referenceManquante && !creditSansClient && !demandes.some((p) => exigeServeur(p.mode));

  // Pourquoi le crédit n'est pas proposable, en clair.
  const blocageCredit = !creditActif ? "La vente à crédit n'est pas activée dans les réglages de la caisse."
    : !droitCredit ? "Vous n'avez pas le droit de vendre à crédit. Demandez à un responsable."
    : !client ? "Associez un client à la vente pour vendre à crédit."
    : client.creditBloque ? "Le crédit de ce client est bloqué." : null;
  const partCredit = repartition?.credit ?? 0;
  const plafondConnu = client?.creditPlafond != null && client?.creditUtilise != null;
  const disponible = plafondConnu ? Math.max(0, (client!.creditPlafond as number) - (client!.creditUtilise as number)) : null;

  const changer = (id: string, modif: Partial<LignePaiement>) => { setErreur(null); setLignes((ls) => ls.map((l) => (l.id === id ? { ...l, ...modif } : l))); };
  const ajouter = (mode: ModePaiement) => { setErreur(null); setLignes((ls) => [...ls, { id: idLocal(), mode, montant: reste > 0 ? String(reste) : "", reference: "", prestataire: "" }]); };

  const encaisser = async () => {
    if (!pret || envoi) return;
    setEnvoi(true); setErreur(null);
    // Avoir : vérifié auprès du serveur AVANT d'envoyer la vente (code exact, encore utilisable, solde suffisant).
    for (const p of demandes.filter((x) => x.mode === "avoir")) {
      const v = await appelPos<{ avoirs: { code: string; solde: number; utilisable: boolean }[] }>(`/api/pos/avoirs?code=${encodeURIComponent(p.reference ?? "")}`, { caisseId });
      const trouve = v.ok ? v.donnees.avoirs[0] : null;
      const refusAvoir = !v.ok ? { code: v.code, message: v.message }
        : !trouve ? { code: "avoir_refuse", message: "Aucun avoir ne porte ce code. Vérifiez la saisie." }
        : !trouve.utilisable ? { code: "avoir_refuse", message: "Cet avoir est épuisé ou expiré : il ne peut plus servir." }
        : trouve.solde < p.montant ? { code: "avoir_refuse", message: `Le solde de cet avoir est de ${fmt(trouve.solde)} : réduisez le montant réglé par avoir.` }
        : null;
      if (refusAvoir) { setEnvoi(false); return setErreur(refusAvoir); }
    }
    const r = await onEncaisser(demandes);
    setEnvoi(false);
    if (!r.ok) setErreur({ code: r.code, message: r.message });
  };

  return (
    <Modale ouverte onFermer={onFermer} verrouillee={envoi} taille="lg" titre="Paiement"
      actions={<>
        <Bouton variante="secondaire" onClick={onFermer} disabled={envoi}>{t("Retour au panier")}</Bouton>
        <Bouton taille="grand" onClick={encaisser} disabled={!pret} charge={envoi}>{t("Encaisser")} {fmt(total)}</Bouton>
      </>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); encaisser(); }}>
        <div className="flex items-end justify-between gap-3 rounded-2xl bg-[#111111] px-4 py-3 text-white">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-white/70">{t("Total à payer")}</span>
          <span className="text-[28px] font-bold leading-none tabular-nums">{fmt(total)}</span>
        </div>

        {lignes.length === 0 && total > 0 && <p className="text-[12.5px] text-[#666666]">{t("Choisissez un moyen de paiement ci-dessous.")}</p>}
        <ul className="space-y-3">
          {lignes.map((l, i) => {
            const d = definition(l.mode);
            if (!d) return null;
            return (
              <li key={l.id} className="rounded-2xl border border-[#E8E8E8] p-3">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-[#111111]">{t(d.libelle)}</span>
                  <BadgePaiement statut={d.statut} />
                  {horsLigne && d.statut === "declaratif" && <Badge ton="attention">{t("À confirmer")}</Badge>}
                  <BoutonIcone label={t("Retirer ce paiement")} onClick={() => { setErreur(null); setLignes((ls) => ls.filter((x) => x.id !== l.id)); }} disabled={envoi} className="border-transparent bg-transparent"><Trash2 size={15} aria-hidden /></BoutonIcone>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <Saisie label={d.rendMonnaie ? "Montant remis par le client" : "Montant"} inputMode="decimal" autoFocus={i === 0} value={l.montant} disabled={envoi}
                    onChange={(e) => changer(l.id, { montant: e.target.value })} onFocus={(e) => e.target.select()} suffixe={devise} />
                  {d.reference !== "aucune" && (
                    <Saisie label={l.mode === "avoir" ? "Code de l'avoir" : "Référence de la transaction"} value={l.reference} disabled={envoi} maxLength={120}
                      onChange={(e) => changer(l.id, { reference: e.target.value })}
                      erreur={d.reference === "obligatoire" && !l.reference.trim() ? "Référence obligatoire pour ce moyen de paiement." : null}
                      aide={d.reference === "conseillee" ? "Conseillée : elle sert au rapprochement." : undefined} />
                  )}
                  {l.mode === "mobile_money" && (
                    <Saisie label="Opérateur" value={l.prestataire} disabled={envoi} maxLength={60} onChange={(e) => changer(l.id, { prestataire: e.target.value })} placeholder="MTN, Orange, Wave…" />
                  )}
                </div>
                <p className="mt-2 text-[11.5px] leading-snug text-[#666666]">{t(d.mention)}</p>
              </li>
            );
          })}
        </ul>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{lignes.length ? t("Ajouter un autre moyen de paiement") : t("Moyen de paiement")}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {modes.map((m) => {
              const bloque = m.statut === "a_connecter" || exigeServeur(m.id) || (m.id === "credit" && !!blocageCredit);
              return (
                <span key={m.id} className="inline-flex items-center gap-1.5">
                  <Bouton variante="secondaire" taille="compact" onClick={() => ajouter(m.id)} disabled={bloque || envoi} icone={<Plus size={14} aria-hidden />}>
                    {m.id === "credit" && reste > 0 && !bloque ? t("Mettre le reste à crédit") : t(m.libelle)}
                  </Bouton>
                  {m.statut === "a_connecter" && <BadgePaiement statut="a_connecter" />}
                </span>
              );
            })}
          </div>
          {horsLigne && (
            <p role="status" className="mt-2 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2 text-[12px] leading-snug text-[#92400E]">
              {t("Mode hors ligne : la vente sera enregistrée sur cet appareil et envoyée au retour du réseau.")}
              {modes.some((m) => exigeServeur(m.id)) ? ` ${t("Crédit et avoir sont indisponibles : le serveur seul peut vérifier le plafond d'un client ou le solde d'un avoir.")}` : ""}
              {modes.some((m) => m.statut === "declaratif") ? ` ${t("Un paiement Mobile Money ou par carte n'est vérifié par personne : il reste « à confirmer » — assurez-vous de l'avoir bien reçu.")}` : ""}
            </p>
          )}
          {!horsLigne && modes.some((m) => m.id === "credit") && blocageCredit && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[#666666]">
              {t(blocageCredit)}
              {creditActif && droitCredit && !client && <Bouton variante="discret" taille="compact" onClick={onChoisirClient} icone={<User size={14} aria-hidden />}>{t("Associer un client")}</Bouton>}
            </p>
          )}
        </div>

        {partCredit > 0 && client && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-[12.5px] text-[#555555]">
            <dt className="col-span-2 text-[11px] font-semibold uppercase tracking-wide text-[#B45309]">{t("Crédit de {0}", client.nom)}</dt>
            {plafondConnu ? (
              <>
                <dt>{t("Plafond autorisé")}</dt><dd className="text-right font-semibold tabular-nums text-[#111111]">{fmt(client.creditPlafond as number)}</dd>
                <dt>{t("Déjà utilisé")}</dt><dd className="text-right font-semibold tabular-nums text-[#111111]">{fmt(client.creditUtilise as number)}</dd>
                <dt>{t("Cette vente")}</dt><dd className="text-right font-semibold tabular-nums text-[#111111]">{fmt(partCredit)}</dd>
                <dt>{t("Nouveau solde dû")}</dt><dd className="text-right font-bold tabular-nums text-[#111111]">{fmt((client.creditUtilise as number) + partCredit)}</dd>
                {disponible !== null && partCredit > disponible && (
                  <dd role="alert" className="col-span-2 mt-1 text-[#B91C1C]">{t("Ce montant dépasse le crédit disponible ({0}). La vente sera refusée : réduisez la part à crédit.", fmt(disponible))}</dd>
                )}
              </>
            ) : (
              <dd className="col-span-2">{t("Part à crédit : {0}. Le plafond de ce client sera vérifié par le serveur à l'enregistrement.", fmt(partCredit))}</dd>
            )}
          </dl>
        )}

        <dl className="space-y-1 rounded-2xl bg-[#FAFAFA] p-3 text-[13px] text-[#555555]" aria-live="polite">
          <div className="flex justify-between"><dt>{t("Encaissé")}</dt><dd className="font-semibold tabular-nums text-[#111111]">{fmt(repartition?.paye ?? 0)}</dd></div>
          {partCredit > 0 && <div className="flex justify-between"><dt>{t("Porté à crédit")}</dt><dd className="font-semibold tabular-nums text-[#111111]">{fmt(partCredit)}</dd></div>}
          {reste > 0
            ? <div className="flex justify-between text-[#B91C1C]"><dt className="font-bold">{t("Reste à payer")}</dt><dd className="text-[17px] font-bold tabular-nums">{fmt(reste)}</dd></div>
            : <div className="flex justify-between text-[#15803D]"><dt className="font-bold">{t("Monnaie à rendre")}</dt><dd className="text-[20px] font-bold tabular-nums">{fmt(repartition?.monnaie ?? 0)}</dd></div>}
        </dl>

        {refus && <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12.5px] leading-snug text-[#B91C1C]">{t(refus)}</p>}
        {!refus && reste > 0 && lignes.length > 0 && (
          <p className="text-[12px] text-[#666666]">{t("Le paiement ne couvre pas encore le total : ajoutez un moyen de paiement, ou portez le reste au crédit du client.")}</p>
        )}
        {erreur && <EtatPos compact code={erreur.code} message={erreur.message} onReessayer={pret ? encaisser : undefined} />}
        <button type="submit" hidden />
      </form>
    </Modale>
  );
}
