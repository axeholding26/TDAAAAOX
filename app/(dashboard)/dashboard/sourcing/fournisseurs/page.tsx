"use client";
// AXSO Sourcing — Fournisseurs : découverte, filtres, comparaison (5 au plus),
// meilleur fournisseur d'un produit et recommandation finale.
// La liste ne contient QUE les fournisseurs enregistrés par la boutique : aucun
// fournisseur de démonstration, et une recherche vide le dit.
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, FileText, Plus, Search } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Bouton, Carte, Champ, Chargement, CLASSE_CHAMP, Entete, Erreur, Estimation, EtatVide, Page, useApi } from "@/components/dashboard/sourcing/ui";
import {
  CarteRecommandation, GrillePrix, LabelVerified, montant, PastilleCertification, PastilleConfiance, PastilleFabricant, PastilleRisque, Podiums, Score, TableauComparaison,
} from "@/components/dashboard/sourcing/fournisseurs/affichage";
import { FormulaireFournisseur } from "@/components/dashboard/sourcing/fournisseurs/FormulaireFournisseur";
import type { Candidat, Classement, Recommandation } from "@/lib/sourcing/fournisseurs/classement";

interface Resultat {
  candidats: Candidat[];
  classement: Classement | null;
  recommandation: Recommandation | null;
  contexte: { pays: string; paysNom: string; devise: string; quantite: number };
  totalFournisseurs: number;
}

const TYPES: [string, string][] = [
  ["", "Tous les types"], ["fabricant", "Fabricant"], ["fabricant_verifie", "Fabricant vérifié"],
  ["trading", "Société de trading"], ["grossiste", "Grossiste"], ["distributeur", "Distributeur"],
];
const PARCOURS = ["Découvrir", "Trouver", "Vérifier", "Comparer", "Coût rendu", "Négocier", "Échantillon", "Contrôle qualité", "Tester", "Passer à l'échelle", "Private label", "Marque"];

function Fournisseurs() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [filtres, setFiltres] = useState({ q: "", produitId: params.get("produitId") ?? "", type: "", certification: "", moqMax: "", prixMax: "", quantite: "100" });
  // La recherche part à la validation du formulaire, pas à chaque frappe.
  const [appliques, setAppliques] = useState(filtres);
  const [selection, setSelection] = useState<string[]>([]);
  const [comparer, setComparer] = useState(false);
  const [ajout, setAjout] = useState(false);
  const [produits, setProduits] = useState<{ id: string; nom: string }[]>([]);

  const requete = (extra: Record<string, string> = {}) => new URLSearchParams(Object.entries({ ...appliques, ...extra }).filter(([, v]) => v)).toString();
  const { data, erreur, chargement } = useApi<Resultat>(`/api/fournisseurs/intelligence?${requete()}`);
  const comparaison = useApi<Resultat>(comparer && selection.length >= 2 ? `/api/fournisseurs/intelligence?${new URLSearchParams({ refs: selection.join(","), quantite: appliques.quantite })}` : null);

  useEffect(() => { fetch("/api/produits?limit=200").then((r) => r.json()).then((d) => setProduits(d.produits ?? [])).catch(() => {}); }, []);

  const champ = (cle: keyof typeof filtres) => ({ value: filtres[cle], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFiltres({ ...filtres, [cle]: e.target.value }), className: CLASSE_CHAMP });
  const basculer = (ref: string) => { setComparer(false); setSelection((s) => (s.includes(ref) ? s.filter((x) => x !== ref) : s.length < 5 ? [...s, ref] : s)); };
  const cible = !!(appliques.q || appliques.produitId);
  const devise = data?.contexte.devise ?? "";
  const idsSelection = useMemo(() => [...new Set(selection.map((r) => r.split(":")[0]))].join(","), [selection]);

  return (
    <Page>
      <Entete badge="AXSO SOURCING" titre="Le bon fournisseur. Au bon prix. Avec le bon niveau de confiance."
        sousTitre="Vos fournisseurs vérifiés, notés et comparés sur le coût réel rendu dans votre pays — pas sur le prix catalogue."
        actions={<>
          <Bouton variante="secondaire" href="/dashboard/sourcing"><Bot size={14} />{t("Retour à l'assistant")}</Bouton>
          <Bouton variante="secondaire" href="/dashboard/sourcing/fournisseurs/devis"><FileText size={14} />{t("Demandes de devis")}</Bouton>
          <Bouton onClick={() => setAjout(!ajout)}><Plus size={14} />{t("Ajouter un fournisseur")}</Bouton>
        </>} />

      <div className="flex gap-1.5 overflow-x-auto pb-1 text-[10px] font-semibold text-[#666666]">
        {PARCOURS.map((e, i) => <span key={e} className="whitespace-nowrap rounded-full bg-[#F5F5F5] px-2.5 py-1">{i + 1}. {t(e)}</span>)}
      </div>

      {ajout && (
        <Carte titre="Nouveau fournisseur" aide="AXSO n'a pas d'annuaire de fournisseurs : vous enregistrez ceux que vous avez repérés (Alibaba, 1688, salon, recommandation…) et le moteur les vérifie, les note et les compare.">
          <FormulaireFournisseur onAnnule={() => setAjout(false)} onEnregistre={(id) => router.push(`/dashboard/sourcing/fournisseurs/${id}`)} />
        </Carte>
      )}

      <Carte>
        <form onSubmit={(e) => { e.preventDefault(); setSelection([]); setComparer(false); setAppliques(filtres); }} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA]" />
              <input {...champ("q")} className={`${CLASSE_CHAMP} pl-9`} placeholder={t("Produit recherché, ex. écouteurs Bluetooth")} />
            </div>
            <Bouton type="submit">{t("Chercher")}</Bouton>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <Champ label="Produit du catalogue"><select {...champ("produitId")}><option value="">{t("Tous")}</option>{produits.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}</select></Champ>
            <Champ label="Type"><select {...champ("type")}>{TYPES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select></Champ>
            <Champ label="Quantité visée"><input type="number" min={1} {...champ("quantite")} /></Champ>
            <Champ label="MOQ maximum"><input type="number" min={1} {...champ("moqMax")} placeholder="10, 50, 500…" /></Champ>
            <Champ label={`${t("Prix unitaire max")}${devise ? ` (${devise})` : ""}`}><input type="number" min={0} step="any" {...champ("prixMax")} /></Champ>
            <Champ label="Certification"><input {...champ("certification")} placeholder="CE, RoHS, FCC…" /></Champ>
          </div>
        </form>
      </Carte>

      {chargement && !data ? <Chargement /> : erreur ? <Erreur message={erreur} /> : data && (
        <>
          <p className="text-[11px] text-[#666666]">
            {t("Destination : {0}. Coûts en {1} pour {2} unités.", data.contexte.paysNom, data.contexte.devise, data.contexte.quantite)}{" "}
            <Link href="/dashboard/sourcing/reglages" className="underline">{t("Modifier le pays et les frais d'envoi")}</Link>
          </p>

          {data.totalFournisseurs === 0 ? (
            <EtatVide titre="Aucun fournisseur enregistré"
              texte="AXSO n'invente pas de fournisseurs et n'affiche aucun fournisseur de démonstration. Ajoutez ceux que vous avez repérés : chacun sera analysé (fabricant ou revendeur, certifications, risque) et comparé sur son coût réel rendu.">
              <Bouton onClick={() => setAjout(true)}><Plus size={14} />{t("Ajouter un fournisseur")}</Bouton>
            </EtatVide>
          ) : data.candidats.length === 0 ? (
            <EtatVide titre="Aucun fournisseur ne correspond"
              texte={t("Aucun des {0} fournisseur(s) de votre base ne correspond à cette recherche. Élargissez les filtres, ajoutez un fournisseur ou envoyez une demande de devis.", data.totalFournisseurs)}>
              <Bouton variante="secondaire" href="/dashboard/sourcing/fournisseurs/devis">{t("Demander un devis")}</Bouton>
            </EtatVide>
          ) : (
            <>
              {cible && data.recommandation && <CarteRecommandation reco={data.recommandation} />}
              {cible && (data.classement ? <Podiums classement={data.classement} />
                : <p className="text-[12px] text-[#666666]">{t("Un seul fournisseur pour cette recherche : il en faut au moins deux pour désigner un meilleur fournisseur.")}</p>)}

              <div className="space-y-3">
                {data.candidats.map((c) => {
                  const a = c.analyse;
                  return (
                    <section key={c.ref} className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-4">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" className="mt-1 accent-[#F5A623]" checked={selection.includes(c.ref)} onChange={() => basculer(c.ref)}
                          disabled={!selection.includes(c.ref) && selection.length >= 5} aria-label={t("Comparer {0}", c.fournisseur.nom)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/dashboard/sourcing/fournisseurs/${c.fournisseur.id}`} className="text-[15px] font-bold text-[#111111] hover:underline">{c.fournisseur.nom}</Link>
                            <span className="text-[11px] text-[#AAAAAA]">{c.fournisseur.pays}</span>
                            {a.label.attribue && <LabelVerified />}
                            <PastilleFabricant fabricant={a.fabricant} />
                            <PastilleRisque niveau={a.risque.niveau} />
                            <PastilleConfiance niveau={a.confiance} />
                          </div>
                          {c.offre ? (
                            <>
                              <p className="text-[12px] text-[#666666] mt-1">{c.offre.nomProduit} · MOQ <b className="text-[#111111]">{c.offre.moq ?? t("non communiqué")}</b> · {t("{0} jours", c.delaiJours)}</p>
                              <div className="mt-2"><GrillePrix offre={c.offre} /></div>
                              {c.cout && (
                                <p className="text-[12px] text-[#111111] mt-2 flex items-center gap-1.5 flex-wrap">
                                  {t("Coût rendu")} <b>{montant(c.cout.rendu, c.cout.devise, t.loc)}</b> · {t("coût réel estimé")} <b>{montant(c.cout.total, c.cout.devise, t.loc)}</b> / {t("unité")} <Estimation />
                                </p>
                              )}
                            </>
                          ) : <p className="text-[12px] text-[#AAAAAA] mt-1">{t("Aucune offre enregistrée : ni prix, ni MOQ, ni coût rendu.")}</p>}
                          {a.certifications.length > 0 && <div className="flex gap-1 flex-wrap mt-2">{a.certifications.map((x) => <PastilleCertification key={x.code} c={x} />)}</div>}
                          {a.risque.signaux.length > 0 && <p className="text-[11px] text-[#B45309] mt-2">{a.risque.signaux.map((s) => t(s.libelle)).join(" · ")}</p>}
                        </div>
                        <Score analyse={a} />
                      </div>
                    </section>
                  );
                })}
              </div>

              {selection.length > 0 && (
                <div className="sticky bottom-3 z-10 bg-[#111111] text-white rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap shadow-lg">
                  <span className="text-[12px]">{t("{0} fournisseur(s) sélectionné(s) sur 5", selection.length)}</span>
                  <div className="flex gap-2">
                    <Bouton petit variante="secondaire" href={`/dashboard/sourcing/fournisseurs/devis?fournisseurs=${idsSelection}`}>{t("Demander un devis")}</Bouton>
                    <Bouton petit onClick={() => setComparer(true)} disabled={selection.length < 2}>{t("Comparer")}</Bouton>
                  </div>
                </div>
              )}

              {comparer && (comparaison.chargement && !comparaison.data ? <Chargement /> : comparaison.erreur ? <Erreur message={comparaison.erreur} /> : comparaison.data && (
                <>
                  <TableauComparaison candidats={comparaison.data.candidats} />
                  {comparaison.data.recommandation && <CarteRecommandation reco={comparaison.data.recommandation} />}
                </>
              ))}
            </>
          )}
        </>
      )}
    </Page>
  );
}

export default function PageFournisseurs() {
  return <Suspense fallback={<Chargement />}><Fournisseurs /></Suspense>;
}
