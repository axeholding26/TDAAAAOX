"use client";
// Tableau de bord profit : du chiffre d'affaires au bénéfice net ESTIMÉ, sur les
// vraies commandes de la boutique (lib/sourcing/profit.ts). Un chiffre non
// calculable s'affiche « — », jamais un exemple.
import { useState } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ChevronRight, Flame } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import type { TableauDeBord } from "@/lib/sourcing/profit";
import type { Alerte } from "@/lib/sourcing/alertes";
import { Bouton, Carte, Chargement, Erreur, Estimation, EtatVide, Kpi, Onglets, POLICE, pourcent, useApi } from "./ui";

type Donnees = TableauDeBord & { alertes: Alerte[] };
type Periode = "7" | "30" | "90";

// Deux séries seulement, teintes vérifiées lisibles pour les daltoniens (ambre de la marque assombri + bleu).
const COULEUR_CA = "#C2820F";
const COULEUR_MARGE = "#2563EB";

const POSTES: { cle: keyof TableauDeBord["postes"]; libelle: string }[] = [
  { cle: "produit", libelle: "Coût des produits" },
  { cle: "transport", libelle: "Transport international" },
  { cle: "taxes", libelle: "Douane et taxes" },
  { cle: "livraison", libelle: "Livraison au client" },
  { cle: "publicite", libelle: "Publicité" },
  { cle: "paiements", libelle: "Commissions et frais de paiement" },
  { cle: "retours", libelle: "Retours (avoirs, retours partiels)" },
];

const jourCourt = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const abrege = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v));
const AXE = { fill: "#AAAAAA", fontSize: 10.5 } as const;

function Bulle({ active, payload, label, series }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl px-3 py-2 shadow-lg text-[12px]" style={POLICE}>
      <p className="text-[10px] font-semibold text-[#AAAAAA] uppercase mb-1">{jourCourt(String(label))}</p>
      {(series as { cle: string; libelle: string; couleur: string; format: (n: number) => string }[]).map((s) => {
        const p = payload.find((x: any) => x.dataKey === s.cle);
        return p ? (
          <p key={s.cle} className="flex items-center gap-1.5 text-[#111111] tabular-nums">
            <span className="w-2 h-2 rounded-full" style={{ background: s.couleur }} />
            <span className="text-[#666666]">{s.libelle}</span>
            <span className="font-bold ml-auto pl-3">{s.format(p.value)}</span>
          </p>
        ) : null;
      })}
    </div>
  );
}

export function TableauDeBordProfit() {
  const t = useT();
  const { fmt } = useDevise();
  const [periode, setPeriode] = useState<Periode>("30");
  const { data, erreur, chargement } = useApi<Donnees>(`/api/sourcing/tableau-de-bord?jours=${periode}`);

  const argent = (n: number | null) => (n === null ? "—" : fmt(n));
  const jours = (n: number | null) => (n === null ? "—" : t("{0} jours", n));

  return (
    <div className="space-y-5" style={POLICE}>
      <Onglets<Periode> actif={periode} onChange={setPeriode}
        onglets={[{ cle: "7", libelle: "7 jours" }, { cle: "30", libelle: "30 jours" }, { cle: "90", libelle: "90 jours" }]} />

      {erreur && <Erreur message={erreur} />}
      {chargement && !data && <Chargement />}

      {data && (() => {
        const { kpi, postes, refus, serie, topProduits, alertes } = data;
        const vide = kpi.commandes === 0 && kpi.ca === 0;
        const totalCouts = POSTES.reduce((s, p) => s + postes[p.cle], 0);
        const finalisees = refus.livrees + refus.refusees;
        const intervalle = Math.max(0, Math.ceil(serie.length / 7) - 1);

        return (
          <>
            {alertes.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {alertes.map((a, i) => {
                  const positif = a.ton === "positif";
                  const Icone = positif ? Flame : AlertTriangle;
                  const contenu = (
                    <div className="flex items-start gap-3 rounded-2xl border p-3.5 h-full bg-white"
                      style={{ borderColor: positif ? "#BBF7D0" : "#FECACA" }}>
                      <Icone size={16} className="mt-0.5 flex-shrink-0" style={{ color: positif ? "#15803D" : "#B91C1C" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-[#111111]">{a.titre}</p>
                        <p className="text-[12px] text-[#666666] mt-0.5 leading-relaxed">{a.message}</p>
                      </div>
                      {a.lien && <ChevronRight size={14} className="text-[#AAAAAA] mt-0.5 flex-shrink-0" />}
                    </div>
                  );
                  return a.lien ? <Link key={i} href={a.lien}>{contenu}</Link> : <div key={i}>{contenu}</div>;
                })}
              </div>
            )}

            {vide ? (
              <EtatVide titre="Aucune commande sur cette période"
                texte="Le tableau de bord se remplit avec vos vraies commandes : chiffre d'affaires, coûts et bénéfice net estimé apparaîtront ici dès la première vente." />
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Kpi libelle="Chiffre d'affaires" valeur={fmt(kpi.ca)} detail="Commandes payées" />
                  <div className="relative">
                    <Kpi libelle="Bénéfice net estimé" valeur={fmt(kpi.benefice)} ton={kpi.benefice >= 0 ? "positif" : "attention"} detail="Après tous les coûts" />
                    <span className="absolute bottom-3 right-3"><Estimation /></span>
                  </div>
                  <Kpi libelle="Commandes" valeur={String(kpi.commandes)} detail="Hors annulées" />
                  <Kpi libelle="Volume de commandes (GMV)" valeur={fmt(kpi.gmv)} detail="Payées ou non" />
                  <Kpi libelle="Panier moyen" valeur={argent(kpi.panierMoyen)} />
                  <Kpi libelle="Coût publicitaire" valeur={fmt(kpi.coutPublicitaire)} detail="Dépense des campagnes, au prorata de la période" />
                  <Kpi libelle="ROAS" valeur={kpi.roas === null ? "—" : kpi.roas.toFixed(2)} detail="Chiffre d'affaires ÷ publicité" />
                  <Kpi libelle="Coût d'acquisition (CAC)" valeur={argent(kpi.cac)} detail="Publicité ÷ commandes payées" />
                  <Kpi libelle="Marge brute" valeur={pourcent(kpi.margeBrute)} />
                  <Kpi libelle="Marge nette" valeur={pourcent(kpi.margeNette)} ton={kpi.margeNette === null ? undefined : kpi.margeNette >= 0 ? "positif" : "attention"} />
                  <Kpi libelle="Taux de livraison" valeur={pourcent(kpi.tauxLivraison)} />
                  <Kpi libelle="Taux de refus" valeur={pourcent(kpi.tauxRefus)} />
                  <Kpi libelle="Taux de retour" valeur={pourcent(kpi.tauxRetour)} />
                  <Kpi libelle="Taux de conversion" valeur={pourcent(kpi.tauxConversion, 1)} detail="Commandes ÷ visites" />
                  <Kpi libelle="Délai fournisseur moyen" valeur={jours(kpi.delaiFournisseurJours)} />
                  <Kpi libelle="Délai de livraison moyen" valeur={jours(kpi.delaiLivraisonJours)} />
                  <Kpi libelle="Taux de succès des produits" valeur={pourcent(kpi.tauxSuccesProduits)} detail="Produits testés devenus gagnants" />
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Carte titre="Du chiffre d'affaires au bénéfice" aide="Ne confondez jamais chiffre d'affaires et bénéfice.">
                    <dl className="text-[13px] tabular-nums">
                      <div className="flex justify-between py-1.5 font-bold text-[#111111]">
                        <dt>{t("Chiffre d'affaires")}</dt><dd>{fmt(kpi.ca)}</dd>
                      </div>
                      {POSTES.map((p) => (
                        <div key={p.cle} className="flex justify-between gap-3 py-1.5 border-t border-[#F5F5F5] text-[#666666]">
                          <dt>− {t(p.libelle)}</dt><dd className="whitespace-nowrap">{fmt(postes[p.cle])}</dd>
                        </div>
                      ))}
                      <div className="flex justify-between items-center gap-3 pt-3 mt-1.5 border-t-2 border-[#111111] font-bold">
                        <dt className="flex items-center gap-2 flex-wrap text-[#111111]">= {t("Bénéfice net estimé")} <Estimation /></dt>
                        <dd className="text-[16px] whitespace-nowrap" style={{ color: kpi.benefice >= 0 ? "#15803D" : "#B91C1C" }}>{fmt(kpi.benefice)}</dd>
                      </div>
                    </dl>
                    <p className="text-[11px] text-[#AAAAAA] mt-3 leading-relaxed">
                      {t("Estimé : le coût des produits vient de vos fiches sourcing, et le coût de livraison est supposé égal aux frais facturés au client.")}
                    </p>
                    {data.lignesSansCout > 0 && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl p-3 bg-[#FEF2F2] border border-[#FECACA] text-[12px] text-[#B91C1C]">
                        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                        <div>
                          <p>{t("{0} ligne(s) de commande sans coût produit renseigné : le bénéfice est surestimé.", data.lignesSansCout)}</p>
                          <Link href="/dashboard/sourcing/catalogue" className="font-bold underline">{t("Renseigner les coûts dans le catalogue")}</Link>
                        </div>
                      </div>
                    )}
                  </Carte>

                  <Carte titre="Répartition des coûts" aide="Où part votre argent sur la période.">
                    {totalCouts > 0 ? (
                      <div className="space-y-2.5">
                        {POSTES.map((p) => (
                          <div key={p.cle}>
                            <div className="flex justify-between gap-3 text-[12px]">
                              <span className="text-[#666666]">{t(p.libelle)}</span>
                              <span className="text-[#111111] font-semibold tabular-nums whitespace-nowrap">{fmt(postes[p.cle])} · {pourcent(postes[p.cle] / totalCouts)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-[#F5F5F5] mt-1 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${(postes[p.cle] / totalCouts) * 100}%`, background: COULEUR_CA }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-[12px] text-[#AAAAAA]">{t("Aucun coût enregistré sur la période.")}</p>}
                  </Carte>
                </div>

                <Carte titre="Chiffre d'affaires et marge par jour" aide="Marge avant publicité : chiffre d'affaires du jour moins le coût des produits, du transport, des taxes et de la livraison."
                  actions={<Estimation />}>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={serie} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#F0F0F0" vertical={false} />
                      <XAxis dataKey="date" tick={AXE} tickLine={false} axisLine={false} tickFormatter={jourCourt} interval={intervalle} />
                      <YAxis tick={AXE} tickLine={false} axisLine={false} tickFormatter={abrege} />
                      <Tooltip cursor={{ stroke: "#AAAAAA", strokeDasharray: "4 3" }}
                        content={<Bulle series={[
                          { cle: "ca", libelle: t("Chiffre d'affaires"), couleur: COULEUR_CA, format: fmt },
                          { cle: "marge", libelle: t("Marge avant publicité"), couleur: COULEUR_MARGE, format: fmt },
                        ]} />} />
                      <Area type="monotone" dataKey="ca" stroke={COULEUR_CA} strokeWidth={2} fill={COULEUR_CA} fillOpacity={0.08} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
                      <Area type="monotone" dataKey="marge" stroke={COULEUR_MARGE} strokeWidth={2} fill="none" dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-[#666666]">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full" style={{ background: COULEUR_CA }} />{t("Chiffre d'affaires")}</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full" style={{ background: COULEUR_MARGE }} />{t("Marge avant publicité")}</span>
                  </div>
                </Carte>

                <Carte titre="Commandes par jour" aide="Commandes reçues, hors annulées.">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={serie} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#F0F0F0" vertical={false} />
                      <XAxis dataKey="date" tick={AXE} tickLine={false} axisLine={false} tickFormatter={jourCourt} interval={intervalle} />
                      <YAxis tick={AXE} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: "#F5F5F5" }}
                        content={<Bulle series={[{ cle: "commandes", libelle: t("Commandes"), couleur: COULEUR_CA, format: String }]} />} />
                      <Bar dataKey="commandes" fill={COULEUR_CA} radius={[4, 4, 0, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </Carte>

                <Carte titre="Coût du risque de refus" aide="Une commande refusée à la livraison vous coûte le transport aller, sans vente.">
                  {finalisees > 0 ? (
                    <p className="text-[13px] text-[#111111]">
                      {t("{0} refusées sur {1} commandes arrivées au bout", refus.refusees, finalisees)}
                      {" → "}<span className="font-bold tabular-nums">{pourcent(kpi.tauxRefus)}</span>
                    </p>
                  ) : <p className="text-[13px] text-[#666666]">{t("Aucune commande n'est encore arrivée au bout (livrée ou refusée) sur la période.")}</p>}
                  <p className="text-[12px] text-[#666666] mt-1.5 leading-relaxed">
                    {t("Dès 10 commandes arrivées au bout, ce taux est intégré automatiquement au coût réel de vos produits dans le calculateur.")}
                  </p>
                </Carte>

                <Carte titre="Produits les plus rentables" aide="Ventes réelles de la période, bénéfice avant publicité.">
                  {topProduits.length === 0 ? <p className="text-[12px] text-[#AAAAAA]">{t("Aucune vente payée sur la période.")}</p> : (
                    <ul className="divide-y divide-[#F5F5F5]">
                      {topProduits.map((p) => (
                        <li key={p.produitId} className="py-2.5 sm:flex sm:items-center sm:gap-4">
                          <Link href={`/dashboard/produits/${p.produitId}`} className="text-[13px] font-semibold text-[#111111] hover:text-[#B45309] sm:flex-1 min-w-0 block truncate">{p.nom}</Link>
                          <dl className="grid grid-cols-4 gap-2 mt-1.5 sm:mt-0 sm:w-[420px] text-right tabular-nums">
                            {[
                              { l: "Quantité", v: String(p.quantite) },
                              { l: "CA", v: fmt(p.ca) },
                              { l: "Coût", v: p.cout > 0 ? fmt(p.cout) : "—" },
                              { l: "Bénéfice", v: fmt(p.benefice), c: p.benefice >= 0 ? "#15803D" : "#B91C1C" },
                            ].map((x) => (
                              <div key={x.l}>
                                <dt className="text-[10px] text-[#AAAAAA] uppercase">{t(x.l)}</dt>
                                <dd className="text-[12px] font-semibold" style={{ color: x.c ?? "#111111" }}>{x.v}</dd>
                              </div>
                            ))}
                          </dl>
                        </li>
                      ))}
                    </ul>
                  )}
                </Carte>
              </>
            )}

            <div className="flex justify-end">
              <Bouton href="/dashboard/sourcing" variante="secondaire" petit>{t("Ouvrir AXSO Sourcing")}<ChevronRight size={12} /></Bouton>
            </div>
          </>
        );
      })()}
    </div>
  );
}
