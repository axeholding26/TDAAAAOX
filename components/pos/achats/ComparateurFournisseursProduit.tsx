"use client";
// Comparaison des fournisseurs d'UN produit : principal, alternatifs, prix,
// minimum de commande, délai, fiabilité, qualité, prix réellement payés, et la
// recommandation expliquée d'AXSO (GET /api/pos/achats/fournisseurs).
//
//   <ComparateurFournisseursProduit produitId={id} quantite={120} />
//
// Règle d'affichage : rien n'est inventé. Un critère sans donnée s'affiche
// « Non renseigné » ; le coût rendu est une estimation et le dit ; seuls les
// prix « payés » viennent de réceptions réelles.
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Star } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { appelPos } from "@/components/pos/crm/appel";
import { useLecture } from "@/components/pos/finance/commun";
import { Badge, Bouton, EtatChargement, EtatPos, EtatVide, Saisie, type Ton } from "@/components/pos/ui";
import { formatMontant } from "@/lib/utils";
import type { ComparaisonFournisseurs } from "@/lib/pos/achats/fournisseurs";

type Donnees = ComparaisonFournisseurs & { peutChoisir: boolean };
const RISQUE: Record<string, { label: string; ton: Ton }> = { faible: { label: "Risque faible", ton: "positif" }, moyen: { label: "Risque moyen", ton: "attention" }, eleve: { label: "Risque élevé", ton: "danger" } };

export default function ComparateurFournisseursProduit({ produitId, quantite: quantiteInitiale, onChange }: {
  produitId: string;
  /** Quantité visée (défaut : 1) : elle fixe le prix dégressif retenu et la compatibilité des minimums de commande. */
  quantite?: number;
  /** Appelé après un changement de fournisseur principal. */
  onChange?: () => void;
}) {
  const t = useT();
  const { fmt } = useDevise();
  const [quantite, setQuantite] = useState(Math.max(1, quantiteInitiale ?? 1));
  const [envoi, setEnvoi] = useState<string | null>(null);
  const { donnees: d, erreur, recharger } = useLecture<Donnees>(`/api/pos/achats/fournisseurs?produitId=${encodeURIComponent(produitId)}&quantite=${quantite}`);
  const jour = (iso: string) => new Date(iso).toLocaleDateString(t.loc, { day: "2-digit", month: "short", year: "numeric" });
  const parKilo = d?.produit.uniteVente === "kg" ? "/kg" : "";

  async function definirPrincipal(offreId: string) {
    setEnvoi(offreId);
    const r = await appelPos("/api/pos/achats/fournisseurs", { method: "PATCH", corps: { produitId, offreId } });
    setEnvoi(null);
    if (!r.ok) { toast.error(t(r.message)); return; }
    toast.success(t("Fournisseur principal mis à jour"));
    void recharger(); onChange?.();
  }

  if (erreur && !d) return <EtatPos code={erreur.code} message={erreur.message} onReessayer={() => void recharger()} compact />;
  if (!d) return <EtatChargement texte="Comparaison des fournisseurs…" compact />;
  const reco = d.recommandation;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-[#111111]">{d.produit.nom}</p>
          <p className="text-[12px] text-[#666666]">{t("Coût actuel en stock")} : {d.produit.coutActuel != null ? `${fmt(d.produit.coutActuel)}${parKilo}` : t("Non renseigné")}</p>
        </div>
        <Saisie label="Quantité visée" type="number" inputMode="numeric" min={1} className="w-36" defaultValue={quantite}
          onBlur={(e) => setQuantite(Math.max(1, Math.floor(Number(e.target.value)) || 1))} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
      </div>

      {d.offres.length === 0 ? (
        <EtatVide compact titre="Aucun fournisseur enregistré pour ce produit" texte="Ajoutez les offres de vos fournisseurs (prix, minimum de commande, délai) dans Sourcing : la comparaison apparaîtra ici.">
          <Bouton href="/dashboard/sourcing/fournisseurs" variante="secondaire">{t("Ouvrir les fournisseurs")}</Bouton>
        </EtatVide>
      ) : (
        <>
          {reco && (
            <section className="rounded-2xl border border-[#F5A623] bg-[#FFF7ED] p-4" aria-label={t("Recommandation")}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13px] font-bold text-[#111111]">{t("Recommandation")} : {reco.nom}</p>
                <Badge ton={reco.ferme ? "positif" : "attention"}>{t(reco.ferme ? "Recommandation ferme" : "Meilleur disponible, données insuffisantes")}</Badge>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#444444]">{reco.explication}</p>
              {reco.raisons.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5">{reco.raisons.map((r) => <li key={r}><Badge ton="positif" icone={<CheckCircle2 size={11} aria-hidden />}>{t(r)}</Badge></li>)}</ul>}
              {reco.reserves.length > 0 && <p className="mt-2 text-[12px] leading-relaxed text-[#92400E]">{t("Réserves")} : {reco.reserves.join(" · ")}</p>}
              {d.offres.length === 1 && <p className="mt-2 text-[12px] text-[#666666]">{t("Un seul fournisseur : ajoutez-en un second pour comparer.")}</p>}
            </section>
          )}

          <ul className="space-y-3">
            {d.offres.map((o) => (
              <li key={o.ref} className={`rounded-2xl border bg-white p-4 ${o.ref === reco?.ref ? "border-[#111111]" : "border-[#E8E8E8]"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="truncate text-[14px] font-bold">{o.nom}</p>
                    {o.principal && <Badge ton="accent" icone={<Star size={11} aria-hidden />}>{t("Principal")}</Badge>}
                    {!o.principal && <Badge>{t("Alternatif")}</Badge>}
                    {d.classement?.meilleurPrix?.ref === o.ref && <Badge ton="info">{t("Coût estimé le plus bas")}</Badge>}
                    {!o.disponible && <Badge ton="danger">{t("Offre indisponible")}</Badge>}
                    <Badge ton={RISQUE[o.risque]?.ton ?? "neutre"}>{t(RISQUE[o.risque]?.label ?? o.risque)}</Badge>
                  </div>
                  {!o.principal && d.peutChoisir && <Bouton taille="compact" variante="secondaire" charge={envoi === o.offreId} onClick={() => void definirPrincipal(o.offreId)}>{t("Définir comme principal")}</Bouton>}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px] sm:grid-cols-4">
                  <div><dt className="text-[#888888]">{t("Prix annoncé")}</dt><dd className="font-bold tabular-nums">{o.prixAnnonce ? `${formatMontant(o.prixAnnonce.montant, o.prixAnnonce.devise)}${parKilo}` : t("Non renseigné")}</dd></div>
                  <div><dt className="text-[#888888]">{t("Coût rendu (estimation)")}</dt><dd className="font-bold tabular-nums">{o.coutRendu ? formatMontant(o.coutRendu.montant, o.coutRendu.devise) : t("Non renseigné")}</dd></div>
                  <div><dt className="text-[#888888]">{t("Dernier prix payé")}</dt><dd className="font-bold tabular-nums">{o.dernierPrixPaye != null ? `${fmt(o.dernierPrixPaye)}${parKilo}` : t("Aucune réception")}</dd></div>
                  <div><dt className="text-[#888888]">{t("Minimum de commande")}</dt><dd className="font-bold tabular-nums">{o.moq ?? t("Non renseigné")}</dd></div>
                  <div><dt className="text-[#888888]">{t("Délai")}</dt><dd className="font-bold">{t("{0} j", o.delaiJours)} <span className="font-normal text-[#888888]">({t(o.delaiConstate ? "constaté" : "annoncé")})</span></dd></div>
                  <div><dt className="text-[#888888]">{t("Score AXSO")}</dt><dd className="font-bold">{o.score}/100 <span className="font-normal text-[#888888]">({t("{0} % des critères renseignés", Math.round(o.couverture * 100))})</span></dd></div>
                </dl>

                <ul className="mt-3 space-y-1 border-t border-[#F0F0F0] pt-3 text-[12px]">
                  {o.criteres.map((c) => (
                    <li key={c.cle} className="flex gap-2">
                      <span className="w-20 flex-shrink-0 font-semibold text-[#111111]">{t(c.libelle)}</span>
                      {c.note === null
                        ? <span className="text-[#888888]">{t("Non renseigné")}{c.raison ? ` : ${c.raison}` : ""}</span>
                        : <span className="text-[#444444]"><span className="font-semibold tabular-nums">{Math.round(c.note)}/100</span> · {c.raison}</span>}
                    </li>
                  ))}
                </ul>

                <details className="mt-3 border-t border-[#F0F0F0] pt-2">
                  <summary className="flex min-h-11 cursor-pointer items-center text-[12px] font-semibold text-[#111111]">{t("Prix réellement payés ({0} réception(s))", o.receptions)}</summary>
                  {o.historique.length === 0 ? <p className="pb-1 text-[12px] text-[#888888]">{t("Aucune réception de ce produit chez ce fournisseur : pas encore d'historique de prix.")}</p> : (
                    <ul className="pb-1 text-[12px] tabular-nums text-[#444444]">
                      {o.historique.map((h, i) => <li key={i} className="flex justify-between gap-3 py-0.5"><span>{jour(h.date)}</span><span>{h.quantite} × {fmt(h.cout)}{parKilo}</span></li>)}
                    </ul>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </>
      )}

      {d.autresReceptions.length > 0 && (
        <section className="rounded-2xl border border-[#E8E8E8] bg-white p-4">
          <p className="text-[12px] font-bold text-[#111111]">{t("Autres réceptions de ce produit")}</p>
          <p className="text-[11.5px] text-[#888888]">{t("Reçues sans fournisseur précisé, ou d'un fournisseur sans offre enregistrée.")}</p>
          <ul className="mt-2 text-[12px] tabular-nums text-[#444444]">
            {d.autresReceptions.map((h, i) => <li key={i} className="flex justify-between gap-3 py-0.5"><span>{jour(h.date)}</span><span>{h.quantite} × {fmt(h.cout)}{parKilo}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
