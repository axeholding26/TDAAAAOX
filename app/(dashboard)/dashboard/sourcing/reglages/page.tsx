"use client";
// Pays & intégrations : pays de vente, hypothèses de coût par défaut, état RÉEL
// de chaque intégration et journal d'activité. Les hypothèses sont des valeurs
// de départ génériques, jamais des barèmes officiels : toujours étiquetées.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { CODES_PAYS, CONFIG_PAYS, configPays, LIBELLES_PAIEMENT, ETIQUETTE_ESTIMATION, type CodePays } from "@/lib/sourcing/pays";
import type { Reglages } from "@/lib/sourcing/produit-source";
import { Page, Entete, Carte, PastilleIntegration, Estimation, Bouton, Champ, ChampNombre, ChampPourcent, CLASSE_CHAMP, Chargement, Erreur, pourcent, useApi, envoyer } from "@/components/dashboard/sourcing/ui";

type Statut = "actif" | "sandbox" | "a_connecter";
interface Integration { id: string; nom: string; statut: Statut; description?: string }
interface DonneesReglages {
  pays: CodePays; devise: string; reglages: Reglages;
  refus: { taux: number | null; livrees: number; refusees: number };
  integrations: {
    connecteurs: Integration[]; paiements: Integration[]; livraison: Integration[];
    moyensPaiement: { moyen: string; libelle: string; via: string | null; statut: Statut }[];
  };
  transporteurs: { nom: string; transporteur: string | null; pays: string | null; zone: string | null; frais: number | null; delai: string | number | null }[];
  journal: { id: string; action: string; cible: string | null; details: { nom?: string } | null; createdAt: string }[];
}

const ACTIONS: Record<string, string> = {
  produit_importe: "Produit ajouté au catalogue",
  produit_analyse: "Produit de la boutique analysé",
  produit_modifie: "Fiche produit modifiée",
  produit_publie: "Produit importé dans la boutique",
  produit_supprime: "Produit supprimé du catalogue",
  prix_synchronise: "Prix mis à jour dans la boutique",
  reglages_modifies: "Réglages modifiés",
  expedition_creee: "Expédition créée",
  expedition_statut: "Statut d'expédition mis à jour",
};

function ListeIntegrations({ titre, elements }: { titre: string; elements: Integration[] }) {
  const t = useT();
  return (
    <div>
      <p className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide mb-1">{t(titre)}</p>
      <ul className="divide-y divide-[#F0F0F0]">
        {elements.map((e) => (
          <li key={e.id} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#111111]">{t(e.nom)}</p>
              {e.description && <p className="text-[11px] text-[#666666] leading-snug">{t(e.description)}</p>}
            </div>
            <PastilleIntegration statut={e.statut} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ReglagesSourcingPage() {
  const t = useT();
  const { fmt, devise } = useDevise();
  const { data, erreur, chargement, recharger } = useApi<DonneesReglages>("/api/sourcing/reglages");
  const [r, setR] = useState<Reglages>({});
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  // Le formulaire repart des réglages enregistrés à chaque (re)chargement.
  useEffect(() => { if (data) setR(data.reglages ?? {}); }, [data]);

  if (chargement && !data) return <Page etroite><Chargement /></Page>;
  if (erreur || !data) return <Page etroite><Erreur message={erreur ?? "Erreur"} /></Page>;

  const pays = r.pays ?? data.pays;
  const config = configPays(pays);
  const est = config.estimations;
  const paysEnregistre = pays === data.pays;
  const modifier = (champs: Partial<Reglages>) => { setR((v) => ({ ...v, ...champs })); setEnregistre(false); };
  const { refus } = data;
  const finalisees = refus.livrees + refus.refusees;

  async function enregistrer() {
    setEnvoi(true); setErreurEnvoi(null);
    try {
      // JSON.stringify retire les clés undefined ; un point d'entrée vide n'est pas envoyé.
      await envoyer("/api/sourcing/reglages", "PUT", { ...r, pays, pointEntree: r.pointEntree?.trim() || undefined });
      setEnregistre(true);
      await recharger();
    } catch (e) {
      setErreurEnvoi((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  }

  const boutonEnregistrer = (
    <div className="flex items-center gap-3 flex-wrap mt-4">
      <Bouton onClick={enregistrer} charge={envoi}>{t("Enregistrer")}</Bouton>
      {enregistre && <span className="text-[12px] font-semibold text-[#15803D] flex items-center gap-1"><Check size={14} />{t("Réglages enregistrés")}</span>}
    </div>
  );

  return (
    <Page etroite>
      <Entete titre="Pays & intégrations" sousTitre="Choisissez votre pays de vente, vos coûts habituels, et voyez ce qui est réellement branché."
        actions={<Bouton variante="secondaire" href="/dashboard/sourcing">{t("Retour à l'assistant")}</Bouton>} />
      {erreurEnvoi && <Erreur message={erreurEnvoi} />}

      <Carte titre="Pays de vente" aide="Le pays où vos clients sont livrés. Il fixe les valeurs de départ des calculs.">
        <Champ label="Pays">
          <select value={pays} onChange={(e) => modifier({ pays: e.target.value as CodePays })} className={CLASSE_CHAMP}>
            {CODES_PAYS.map((c) => <option key={c} value={c}>{t(CONFIG_PAYS[c].nom)}</option>)}
          </select>
        </Champ>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 text-[13px]">
          {[
            ["Devise", config.devise],
            ["Langue", config.langue === "fr" ? t("Français") : t("Anglais")],
            ["Point d'entrée", r.pointEntree?.trim() || config.pointEntree],
            ["Zones de livraison", config.zones.map((z) => t(z)).join(", ")],
          ].map(([libelle, valeur]) => (
            <div key={libelle}>
              <dt className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">{t(libelle)}</dt>
              <dd className="text-[#111111] font-semibold mt-0.5">{valeur}</dd>
            </div>
          ))}
        </dl>
        {config.devise !== data.devise && (
          <p className="text-[12px] text-[#666666] mt-3">{t("Votre boutique vend en {0} : les montants restent affichés dans cette devise.", data.devise)}</p>
        )}

        <p className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide mt-4 mb-1">{t("Moyens de paiement du pays")}</p>
        <ul className="divide-y divide-[#F0F0F0]">
          {paysEnregistre
            ? data.integrations.moyensPaiement.map((m) => (
              <li key={m.moyen} className="flex items-center justify-between gap-3 py-2">
                <span className="text-[13px] text-[#111111]">{t(m.libelle)}</span>
                <span className="flex items-center gap-2">
                  {m.via && m.via !== m.libelle && <span className="text-[11px] text-[#666666]">{t("via {0}", m.via)}</span>}
                  <PastilleIntegration statut={m.statut} />
                </span>
              </li>
            ))
            : config.moyensPaiement.map((m) => (
              <li key={m} className="py-2 text-[13px] text-[#111111]">{t(LIBELLES_PAIEMENT[m])}</li>
            ))}
        </ul>
        <p className="text-[11px] text-[#AAAAAA] mt-2 leading-snug">
          {paysEnregistre
            ? t("Liste indicative. Les opérateurs réellement proposés à vos clients dépendent de votre compte NotchPay.")
            : t("Enregistrez pour voir ce qui est réellement encaissable dans ce pays.")}
        </p>
        {boutonEnregistrer}
      </Carte>

      <Carte titre="Hypothèses de coût par défaut" aide="Utilisées pour tous vos produits, sauf si vous les changez sur une fiche. Un champ vide garde la valeur de départ.">
        <div className="rounded-xl p-3 mb-4 bg-[#FFF7ED] border border-[#FDE68A]">
          <Estimation>{t(ETIQUETTE_ESTIMATION)}</Estimation>
          <p className="text-[12px] text-[#666666] mt-1.5 leading-relaxed">{t("Les valeurs de départ ne sont pas des barèmes officiels. Remplacez-les par les chiffres de votre transitaire.")}</p>
        </div>

        <div className="rounded-xl p-3 mb-4 bg-[#F5F5F5] text-[12px] text-[#666666] leading-relaxed">
          <span className="font-semibold text-[#111111]">{t("Taux de refus réel de votre boutique :")}</span>{" "}
          {refus.taux !== null
            ? t("{0} — {1} commandes refusées sur {2} (livrées + refusées, 90 derniers jours). Il est utilisé tant que vous ne saisissez pas de taux.", pourcent(refus.taux), refus.refusees, finalisees)
            : t("pas encore assez de commandes (10 minimum) — {0} pour l'instant.", finalisees)}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ChampPourcent label="Droits et taxes" aide="Part de la valeur de la marchandise à l'arrivée." placeholder={String(est.tauxDroits * 100)} valeur={r.tauxDroits} onChange={(v) => modifier({ tauxDroits: v })} />
          <ChampPourcent label="Taux de refus" aide="Commandes refusées à la livraison." placeholder={String(est.tauxRefus * 100)} valeur={r.tauxRefus} onChange={(v) => modifier({ tauxRefus: v })} />
          <ChampPourcent label="Taux de retour" aide="Commandes livrées puis retournées." placeholder={String(est.tauxRetour * 100)} valeur={r.tauxRetour} onChange={(v) => modifier({ tauxRetour: v })} />
          <ChampPourcent label="Frais de paiement" aide="Part du prix prise par le paiement en ligne." placeholder={String(est.tauxFraisPaiement * 100)} valeur={r.tauxFraisPaiement} onChange={(v) => modifier({ tauxFraisPaiement: v })} />
          <ChampNombre label="Tarif transport au kilo" suffixe={devise} valeur={r.tarifTransportKg} onChange={(v) => modifier({ tarifTransportKg: v })} />
          <ChampNombre label="Frais de transitaire par envoi" suffixe={devise} valeur={r.fraisTransitaire} onChange={(v) => modifier({ fraisTransitaire: v })} />
          <ChampNombre label="Dédouanement par envoi" suffixe={devise} valeur={r.fraisDedouanement} onChange={(v) => modifier({ fraisDedouanement: v })} />
          <ChampNombre label="Livraison locale par commande" suffixe={devise} valeur={r.livraisonLocale} onChange={(v) => modifier({ livraisonLocale: v })} />
          <Champ label="Point d'entrée" aide="La ville où arrivent vos marchandises.">
            <input value={r.pointEntree ?? ""} placeholder={config.pointEntree} maxLength={80} onChange={(e) => modifier({ pointEntree: e.target.value })} className={CLASSE_CHAMP} />
          </Champ>
        </div>
        <p className="text-[11px] text-[#AAAAAA] mt-3">{t("Un montant laissé vide n'est pas compté dans le coût.")}</p>
        {boutonEnregistrer}
      </Carte>

      <Carte titre="Intégrations" aide="Actif = réellement branché. À connecter = prévu, pas encore disponible. Sandbox = données fictives pour essayer.">
        <div className="space-y-5">
          <ListeIntegrations titre="Connecteurs fournisseurs" elements={data.integrations.connecteurs} />
          <ListeIntegrations titre="Paiements" elements={data.integrations.paiements} />
          <ListeIntegrations titre="Livraison" elements={data.integrations.livraison} />
          <div>
            <p className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide mb-1">{t("Vos transporteurs")}</p>
            {data.transporteurs.length === 0 ? (
              <p className="text-[12px] text-[#666666]">{t("Aucun transporteur configuré.")}</p>
            ) : (
              <ul className="divide-y divide-[#F0F0F0]">
                {data.transporteurs.map((tr, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#111111] truncate">{tr.nom}{tr.transporteur && tr.transporteur !== tr.nom ? ` · ${tr.transporteur}` : ""}</p>
                      <p className="text-[11px] text-[#666666]">{[tr.zone, tr.pays, tr.delai].filter(Boolean).join(" · ")}</p>
                    </div>
                    {tr.frais !== null && <span className="text-[12px] font-semibold text-[#111111] whitespace-nowrap">{fmt(tr.frais)}</span>}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/dashboard/transporteurs" className="inline-block text-[12px] font-semibold text-[#B45309] mt-2 hover:underline">{t("Gérer mes transporteurs")}</Link>
          </div>
        </div>
      </Carte>

      <Carte titre="Journal d'activité" aide="Les dernières actions faites dans AXSO Sourcing.">
        {data.journal.length === 0 ? (
          <p className="text-[12px] text-[#666666]">{t("Aucune activité pour l'instant.")}</p>
        ) : (
          <ul className="divide-y divide-[#F0F0F0]">
            {data.journal.map((j) => (
              <li key={j.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-[13px] text-[#111111] min-w-0">{t(ACTIONS[j.action] ?? j.action)}{j.details?.nom ? ` — ${j.details.nom}` : ""}</span>
                <span className="text-[11px] text-[#AAAAAA] whitespace-nowrap">{new Date(j.createdAt).toLocaleString(t.langue === "en" ? "en-GB" : "fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </Page>
  );
}
