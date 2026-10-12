"use client";
// Section « À commander » : pour chaque produit, la quantité recommandée et
// le détail du calcul (vitesse de vente, saisonnalité estimée, délai du
// fournisseur, stock de sécurité, stock actuel, déjà en commande, minimum de
// commande), puis [Créer commande fournisseur] qui prépare un bon de commande
// en brouillon par fournisseur. Données : GET /api/pos/reappro.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Scale } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { appelPos, nouvelleCle } from "@/components/pos/crm/appel";
import { Carte, useLecture } from "@/components/pos/finance/commun";
import { Badge, Bouton, CLASSE_SAISIE, EtatChargement, EtatPos, EtatVide, FOCUS, Tiroir, type Ton } from "@/components/pos/ui";
import { libelleQuantite } from "@/lib/pos/tarification";
import type { UniteVente } from "@/lib/pos/types";
import type { LigneReappro } from "@/lib/pos/achats/reappro";
import { SECURITE_JOURS } from "@/lib/pos/achats/regles";
import ComparateurFournisseursProduit from "./ComparateurFournisseursProduit";

type Donnees = { aCommander: LigneReappro[]; sansRecommandation: LigneReappro[]; analyses: number; fournisseurs: { id: string; nom: string }[]; peutCreer: boolean };
type Choix = { coche: boolean; quantite: string; fournisseurId: string };
const NIVEAUX: Record<LigneReappro["niveau"], { label: string; ton: Ton }> = {
  rupture: { label: "En rupture", ton: "danger" }, urgent: { label: "Urgent", ton: "danger" },
  a_surveiller: { label: "À surveiller", ton: "attention" }, ok: { label: "Stock suffisant", ton: "neutre" },
};
const qte = (n: number, unite: string) => libelleQuantite(n, unite as UniteVente);

/** Historique des 8 dernières semaines, en barres ; la liste chiffrée est lue par les lecteurs d'écran. */
function Semaines({ valeurs, unite }: { valeurs: number[]; unite: string }) {
  const t = useT();
  const max = Math.max(1, ...valeurs);
  return (
    <div>
      <div className="flex h-10 items-end gap-1" aria-hidden>
        {valeurs.map((v, i) => <span key={i} className="flex-1 rounded-sm bg-[#F5A623]" style={{ height: `${Math.max(4, (v / max) * 100)}%`, opacity: v ? 1 : 0.25 }} />)}
      </div>
      <p className="mt-1 text-[11px] text-[#888888]">{t("Ventes par semaine, de la plus ancienne à la dernière")} : {valeurs.map((v) => qte(v, unite)).join(" · ")}</p>
    </div>
  );
}

export function Reappro({ onBonsCrees }: { onBonsCrees: () => void }) {
  const t = useT();
  const { fmt } = useDevise();
  const { donnees: d, erreur, recharger } = useLecture<Donnees>("/api/pos/reappro");
  const [choix, setChoix] = useState<Record<string, Choix>>({});
  const [comparer, setComparer] = useState<LigneReappro | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const cle = useRef(nouvelleCle());

  // Sélection de départ : tout ce qui a un fournisseur, à la quantité recommandée.
  useEffect(() => {
    if (!d) return;
    setChoix(Object.fromEntries(d.aCommander.map((l) => [l.produitId, { coche: !!l.fournisseur, quantite: String(l.calcul.quantite), fournisseurId: l.fournisseur?.id ?? "" }])));
  }, [d]);
  const modifier = (id: string, c: Partial<Choix>) => setChoix((x) => ({ ...x, [id]: { ...x[id], ...c } }));

  if (erreur && !d) return <EtatPos code={erreur.code} message={erreur.message} onReessayer={() => void recharger()} />;
  if (!d) return <EtatChargement texte="Analyse des ventes et du stock…" />;

  const retenues = d.aCommander.filter((l) => choix[l.produitId]?.coche);
  const invalides = retenues.filter((l) => !choix[l.produitId].fournisseurId || !(Number.isInteger(Number(choix[l.produitId].quantite)) && Number(choix[l.produitId].quantite) > 0));

  async function creer() {
    setEnvoi(true);
    const r = await appelPos<{ bons: { numero: string }[] }>("/api/pos/reappro", {
      cle: cle.current,
      corps: { lignes: retenues.map((l) => ({ produitId: l.produitId, fournisseurId: choix[l.produitId].fournisseurId, quantite: Number(choix[l.produitId].quantite) })) },
    });
    setEnvoi(false);
    if (!r.ok) { toast.error(t(r.message)); return; }
    cle.current = nouvelleCle();
    toast.success(r.rejoue ? t("Ces bons de commande ont déjà été préparés. Aucun doublon n'a été créé.") : t("{0} bon(s) de commande préparé(s) en brouillon : {1}", r.donnees.bons.length, r.donnees.bons.map((b) => b.numero).join(", ")));
    onBonsCrees();
  }

  return (
    <>
      <Carte titre="À commander" actions={d.peutCreer && d.aCommander.length > 0 ? (
        <Bouton charge={envoi} disabled={!retenues.length || invalides.length > 0} onClick={() => void creer()}>{t("Créer commande fournisseur ({0})", retenues.length)}</Bouton>
      ) : undefined}>
        <p className="mb-3 text-[12px] leading-relaxed text-[#666666]">
          {t("{0} produit(s) analysé(s) sur les ventes réelles des 30 derniers jours. Les quantités sont des recommandations : vous pouvez les modifier. La commande est préparée en brouillon, un bon par fournisseur, rien n'est envoyé.", d.analyses)}
        </p>
        {invalides.length > 0 && <p role="alert" className="mb-3 text-[12px] font-semibold text-[#B91C1C]">{t("Choisissez un fournisseur et une quantité entière pour chaque produit coché.")}</p>}
        {d.aCommander.length === 0 ? (
          <EtatVide compact titre="Rien à commander pour l'instant" texte="Au rythme actuel des ventes, le stock et les commandes en cours couvrent le délai de vos fournisseurs et le stock de sécurité." />
        ) : (
          <ul className="divide-y divide-[#F0F0F0]">
            {d.aCommander.map((l) => {
              const c = choix[l.produitId] ?? { coche: false, quantite: "", fournisseurId: "" };
              const k = l.calcul;
              return (
                <li key={l.produitId} className="py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input type="checkbox" className={`mt-1 h-5 w-5 flex-shrink-0 accent-[#F5A623] ${FOCUS}`} checked={c.coche} disabled={!d.peutCreer} onChange={(e) => modifier(l.produitId, { coche: e.target.checked })} />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2"><span className="text-[14px] font-bold text-[#111111]">{l.nom}</span><Badge ton={NIVEAUX[l.niveau].ton}>{t(NIVEAUX[l.niveau].label)}</Badge></span>
                        <span className="mt-0.5 block text-[13px] text-[#111111]">{t("Recommandation : commander {0}", qte(k.quantite, l.uniteVente))}{l.uniteVente === "kg" ? "" : ` ${t(k.quantite > 1 ? "unités" : "unité")}`}</span>
                        <span className="block text-[12px] text-[#666666]">
                          {t("Stock")} {qte(l.stock, l.uniteVente)}{l.joursRestants !== null ? ` · ${t("rupture estimée dans {0} j", l.joursRestants)}` : ""}
                          {l.prixEstime != null ? ` · ${t("environ")} ${fmt(l.uniteVente === "kg" ? (l.prixEstime * k.quantite) / 1000 : l.prixEstime * k.quantite)}` : ""}
                        </span>
                      </span>
                    </label>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="block w-28 text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{t(l.uniteVente === "kg" ? "Grammes" : "Quantité")}
                        <input type="number" inputMode="numeric" min={1} step={1} className={`${CLASSE_SAISIE} mt-1`} value={c.quantite} disabled={!d.peutCreer} onChange={(e) => modifier(l.produitId, { quantite: e.target.value })} />
                      </label>
                      <label className="block w-44 text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{t("Fournisseur")}
                        <select className={`${CLASSE_SAISIE} mt-1`} value={c.fournisseurId} disabled={!d.peutCreer} onChange={(e) => modifier(l.produitId, { fournisseurId: e.target.value })}>
                          <option value="">{t("À choisir")}</option>
                          {d.fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}{f.id === l.fournisseur?.id && l.fournisseur.principal ? ` (${t("principal")})` : ""}</option>)}
                        </select>
                      </label>
                      <Bouton variante="secondaire" taille="compact" icone={<Scale size={14} aria-hidden />} onClick={() => setComparer(l)}>{t("Comparer")}</Bouton>
                    </div>
                  </div>

                  <details className="mt-1 sm:ml-8">
                    <summary className="flex min-h-11 cursor-pointer items-center text-[12px] font-semibold text-[#B45309]">{t("Détail du calcul")}</summary>
                    <div className="space-y-2 rounded-xl bg-[#FAFAFA] p-3 text-[12px] leading-relaxed text-[#444444]">
                      <ol className="list-decimal space-y-1 pl-4">
                        <li>{t("Vitesse de vente : {0} vendus en 30 jours, soit {1} par jour.", qte(l.ventes30j, l.uniteVente), (l.ventes30j / 30).toLocaleString(t.loc, { maximumFractionDigits: 1 }))}</li>
                        <li>{t(l.saison.explication)}{l.saison.estimee && l.saison.coefficient !== 1 ? ` ${t("Vitesse retenue : {0} par jour.", k.ventesParJour.toLocaleString(t.loc, { maximumFractionDigits: 1 }))}` : ""}</li>
                        <li>{t("Délai du fournisseur : {0} jours", l.delaiJours)}{l.delaiConnu ? "" : ` (${t("non renseigné : valeur par défaut")})`}. {t("Ventes attendues pendant ce délai : {0}.", qte(k.besoinDelai, l.uniteVente))}</li>
                        <li>{t("Stock de sécurité : {0}", qte(k.securite, l.uniteVente))} ({l.stockMin != null && l.stockMin >= k.securite && l.stockMin > 0 ? t("seuil d'alerte du produit") : t("{0} jours de vente", SECURITE_JOURS)}).</li>
                        <li>{t("Stock actuel : {0}. Déjà en commande : {1}.", qte(l.stock, l.uniteVente), qte(l.enCommande, l.uniteVente))}</li>
                        <li>{t("Besoin : {0} + {1} − {2} − {3} = {4}.", qte(k.besoinDelai, l.uniteVente), qte(k.securite, l.uniteVente), qte(Math.max(0, l.stock), l.uniteVente), qte(l.enCommande, l.uniteVente), qte(k.net, l.uniteVente))}</li>
                        <li>{l.moq && l.moq > 1 ? t("Minimum de commande du fournisseur : {0}. Quantité arrondie à {1}.", l.moq, qte(k.quantite, l.uniteVente)) : t("Minimum de commande : non renseigné, aucune quantité arrondie.")}</li>
                      </ol>
                      {l.aVariantes && <p>{t("Ce produit a des variantes : la quantité porte sur le produit entier, la répartition se fait à la réception.")}</p>}
                      <Semaines valeurs={l.semaines} unite={l.uniteVente} />
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Carte>

      {d.sansRecommandation.length > 0 && (
        <Carte titre="En rupture, sans recommandation chiffrée">
          <p className="text-[12px] leading-relaxed text-[#666666]">{t("Ces produits sont à zéro, sans vente sur 30 jours ni seuil d'alerte : AXSO n'a aucune donnée pour proposer une quantité. Renseignez un seuil d'alerte sur la fiche produit, ou commandez-les depuis un bon manuel.")}</p>
          <p className="mt-2 text-[12.5px] text-[#111111]">{d.sansRecommandation.map((l) => l.nom).join(" · ")}</p>
        </Carte>
      )}

      <Tiroir ouverte={!!comparer} onFermer={() => setComparer(null)} titre="Fournisseurs du produit" largeur="lg">
        {comparer && <ComparateurFournisseursProduit produitId={comparer.produitId} quantite={Number(choix[comparer.produitId]?.quantite) || comparer.calcul.quantite} onChange={() => void recharger()} />}
      </Tiroir>
    </>
  );
}
