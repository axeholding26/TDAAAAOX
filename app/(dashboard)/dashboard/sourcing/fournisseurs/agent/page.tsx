"use client";
// AXSO Sourcing Agent : le marchand décrit son besoin en texte libre ; l'agent
// compare les fournisseurs enregistrés dans la boutique. Il n'en invente aucun :
// moins de 5 résultats (ou aucun) est affiché tel quel, jamais complété.
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Search } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Bouton, Carte, CLASSE_CHAMP, Entete, Erreur, Estimation, EtatVide, Page, envoyer, pourcent } from "@/components/dashboard/sourcing/ui";
import { CarteRecommandation, PastilleCertification, PastilleFabricant, PastilleRisque, Score, montant } from "@/components/dashboard/sourcing/fournisseurs/affichage";
import type { Candidat, Recommandation } from "@/lib/sourcing/fournisseurs/classement";

const RACINE = "/dashboard/sourcing/fournisseurs";
const EXEMPLE = "Je cherche une mini caméra de surveillance que je peux vendre entre 25 000 et 35 000 FCFA au Cameroun. Je veux un fabricant fiable, MOQ inférieur à 100 unités, bonne qualité et possibilité de mettre mon logo.";

interface Ligne { candidat: Candidat; ecarts: string[]; margeUnitaire: number | null; tauxMarge: number | null; conseil: string }
interface Resultat {
  besoin: { produit?: string | null; prixVenteMin?: number | null; prixVenteMax?: number | null; moqMax?: number | null; quantite?: number | null; fabricant?: boolean | null; personnalisation?: boolean | null };
  lignes: Ligne[];
  recommandation: Recommandation | null;
  contexte: { pays: string; paysNom: string; devise: string; quantite: number } | null;
  message: string;
}

export default function PageAgent() {
  const t = useT();
  const [demande, setDemande] = useState("");
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [res, setRes] = useState<Resultat | null>(null);

  const chercher = async (e: React.FormEvent) => {
    e.preventDefault();
    setCharge(true); setErreur(null);
    try { setRes(await envoyer<Resultat>("/api/fournisseurs/ia", "POST", { action: "agent", demande })); }
    catch (err) { setRes(null); setErreur((err as Error).message); }
    finally { setCharge(false); }
  };

  const nombre = (n: number | null | undefined) => (n == null ? null : n.toLocaleString(t.loc));
  const b = res?.besoin;
  const compris: [string, string | null][] = b ? [
    ["Produit", b.produit ?? null],
    ["Prix de vente visé", b.prixVenteMin != null && b.prixVenteMax != null ? `${nombre(b.prixVenteMin)} – ${nombre(b.prixVenteMax)}` : nombre(b.prixVenteMax ?? b.prixVenteMin)],
    ["MOQ maximum", nombre(b.moqMax)],
    ["Quantité", nombre(b.quantite)],
    ["Fabricant exigé", b.fabricant == null ? null : t(b.fabricant ? "Oui" : "Non")],
    ["Personnalisation", b.personnalisation == null ? null : t(b.personnalisation ? "Oui" : "Non")],
  ] : [];
  const ids = res ? [...new Set(res.lignes.map((l) => l.candidat.fournisseur.id))] : [];

  return (
    <Page>
      <Entete titre="AXSO Sourcing Agent"
        sousTitre="Décrivez ce que vous cherchez. L'agent compare les fournisseurs enregistrés dans votre boutique — il n'en invente aucun."
        actions={<Bouton href={RACINE} variante="secondaire"><ArrowLeft size={14} />{t("Fournisseurs")}</Bouton>} />

      <Carte>
        <form onSubmit={chercher} className="space-y-3">
          <textarea rows={5} required minLength={10} maxLength={2000} value={demande} onChange={(e) => setDemande(e.target.value)}
            placeholder={t(EXEMPLE)} aria-label={t("Votre besoin")} className={CLASSE_CHAMP} />
          <Bouton type="submit" charge={charge}><Search size={14} />{t("Chercher")}</Bouton>
        </form>
      </Carte>

      {erreur && <Erreur message={erreur} />}

      {res && (
        <>
          {res.lignes.length > 0 && (
            <div className="rounded-2xl border p-4 text-[13px] font-semibold text-[#111111] leading-relaxed" style={{ background: "#FFF7ED", borderColor: "#FDE68A" }}>{t(res.message)}</div>
          )}

          <Carte titre="Ce que j'ai compris">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {compris.map(([libelle, valeur]) => (
                <div key={libelle}>
                  <dt className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">{t(libelle)}</dt>
                  <dd className="text-[13px] text-[#111111] mt-0.5">{valeur ?? t("Non précisé")}</dd>
                </div>
              ))}
            </dl>
            {res.contexte && <p className="text-[11px] text-[#AAAAAA] mt-3 leading-snug">{t("Coûts calculés pour {0} unités livrées en {1}.", res.contexte.quantite, res.contexte.paysNom)}</p>}
          </Carte>

          {!res.lignes.length ? (
            <EtatVide titre="Aucun fournisseur correspondant" texte={res.message}>
              <Bouton href={RACINE}>{t("Ajouter un fournisseur")}</Bouton>
              <Bouton href={`${RACINE}/devis`} variante="secondaire">{t("Demander un devis")}</Bouton>
            </EtatVide>
          ) : (
            <>
              {res.recommandation && <CarteRecommandation reco={res.recommandation} />}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-[14px] font-bold text-[#111111]">{res.lignes.length === 5 ? "Top 5" : t("{0} fournisseur(s) correspondant(s)", res.lignes.length)}</h2>
                <Bouton petit href={`${RACINE}/devis?fournisseurs=${ids.join(",")}`}>{t("Demander un devis à ces fournisseurs")}</Bouton>
              </div>

              <ol className="space-y-3">
                {res.lignes.map((l, i) => {
                  const c = l.candidat;
                  return (
                    <li key={c.ref}>
                      <Carte>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[14px] font-bold text-[#111111]">
                              <span className="text-[#B45309] tabular-nums">{i + 1}.</span>{" "}
                              <Link href={`${RACINE}/${c.fournisseur.id}`} className="hover:underline">{c.fournisseur.nom}</Link>
                            </p>
                            <p className="text-[12px] text-[#666666] mt-0.5">{c.offre?.nomProduit ?? t("Aucune offre chiffrée")}</p>
                            <div className="flex gap-1.5 flex-wrap mt-2">
                              <PastilleFabricant fabricant={c.analyse.fabricant} />
                              <PastilleRisque niveau={c.analyse.risque.niveau} />
                              {c.analyse.certifications.map((x) => <PastilleCertification key={x.code} c={x} />)}
                            </div>
                          </div>
                          <Score analyse={c.analyse} />
                        </div>

                        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[#F0F0F0] text-[13px] text-[#111111]">
                          <div>
                            <dt className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">{t("Prix unitaire")}</dt>
                            <dd className="font-bold tabular-nums mt-0.5">{c.cout ? montant(c.cout.prix, c.cout.devisePrix, t.loc) : "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">MOQ</dt>
                            <dd className="font-bold tabular-nums mt-0.5">{c.offre?.moq ?? t("Non communiqué")}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">{t("Coût réel estimé")}</dt>
                            <dd className="font-bold tabular-nums mt-0.5 flex items-center gap-1.5 flex-wrap">{c.cout ? <>{montant(c.cout.total, c.cout.devise, t.loc)}<Estimation /></> : "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">{t("Marge potentielle")}</dt>
                            <dd className="font-bold tabular-nums mt-0.5" style={l.margeUnitaire !== null && l.margeUnitaire <= 0 ? { color: "#B91C1C" } : undefined}>
                              {l.margeUnitaire === null ? "—" : `${montant(l.margeUnitaire, c.cout?.devise ?? "", t.loc)} · ${pourcent(l.tauxMarge)}`}
                            </dd>
                            <dd className="text-[10px] text-[#AAAAAA] leading-snug">{t("marge brute estimée avant publicité")}</dd>
                          </div>
                        </dl>

                        {l.ecarts.length > 0 && (
                          <ul className="mt-3 rounded-xl border p-3 space-y-1" style={{ background: "#FFF7ED", borderColor: "#FDE68A" }}>
                            {l.ecarts.map((e) => <li key={e} className="text-[12px] text-[#111111] flex items-start gap-1.5"><AlertTriangle size={12} className="text-[#B45309] shrink-0 mt-0.5" />{t(e)}</li>)}
                          </ul>
                        )}
                        <p className="text-[12px] text-[#666666] mt-3 leading-snug">{t(l.conseil)}</p>
                      </Carte>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </>
      )}
    </Page>
  );
}
