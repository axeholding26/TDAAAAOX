"use client";
// Réception de marchandise, avec ou sans bon de commande.
//
// Le scan alimente la réception : caméra du poste, douchette, téléphone
// appairé — tous passent par le bus de scans, filtré sur le contexte
// « reception ». Un code de produit ajoute une unité à sa ligne ; pour un
// produit suivi par numéro de série, chaque code scanné ensuite est un numéro
// de série (une unité par numéro).
// La validation est un seul envoi idempotent (POST /api/pos/receptions) : lots,
// numéros de série, entrée en stock, coût moyen pondéré, avancement du bon.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ScanLine, Trash2, X } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { appelPos, nouvelleCle } from "@/components/pos/crm/appel";
import { Carte, EnTete, Page, lireMontant, useCaisse, useLecture } from "@/components/pos/finance/commun";
import BoutonScanner from "@/components/pos/scanner/BoutonScanner";
import CapteurClavier from "@/components/pos/scanner/CapteurClavier";
import { useFluxPos } from "@/components/pos/scanner/useFluxPos";
import { Badge, BadgeConnexion, Bouton, BoutonIcone, CLASSE_SAISIE, Champ, EtatChargement, EtatNonAutorise, EtatPos, EtatVide, FOCUS, Saisie } from "@/components/pos/ui";
import { surScan } from "@/lib/pos/client/bus";
import { libelleQuantite } from "@/lib/pos/tarification";
import type { ArticleResolu, UniteVente } from "@/lib/pos/types";
import type { BonVue } from "@/lib/pos/achats/bons";
import type { ResultatReception, listerReceptions } from "@/lib/pos/achats/receptions";
import { STATUTS_RECEVABLES } from "@/lib/pos/achats/regles";
import { RechercheArticle, versArticleAchat, type ArticleAchat } from "./RechercheArticle";

type Donnees = {
  receptions: Awaited<ReturnType<typeof listerReceptions>>; bon: BonVue | null; entrepotId: string; peutRecevoir: boolean;
  fournisseurs: { id: string; nom: string }[]; entrepots: { id: string; nom: string }[];
};
type Ligne = {
  cle: string; produitId: string; varianteId: string | null; nom: string; variante: string | null; uniteVente: string; suiviSerie: boolean;
  variantes: { id: string; libelle: string }[];
  /** Quantité commandée et déjà reçue (ligne d'un bon) ; null = hors bon. */
  commande: number | null; dejaRecu: number;
  quantite: string; cout: string; lotCode: string; expiration: string; series: string[];
};
const REGLES_COUT: Record<string, string> = { moyen_pondere: "coût moyen pondéré", dernier_cout: "coût de cette réception (rien à pondérer)", inchange: "inchangé, coût non renseigné" };
const qte = (n: number, unite: string) => libelleQuantite(n, unite as UniteVente);
let compteur = 0;
const nouvelleLigne = (a: ArticleAchat, plus: Partial<Ligne> = {}): Ligne => ({
  cle: `l${++compteur}`, produitId: a.produitId, varianteId: a.varianteId, nom: a.nom, variante: a.variante, uniteVente: a.uniteVente, suiviSerie: a.suiviSerie,
  variantes: a.variantes, commande: null, dejaRecu: 0, quantite: "", cout: a.cout != null ? String(a.cout) : "", lotCode: "", expiration: "", series: [], ...plus,
});
const quantiteDe = (l: Ligne) => (l.suiviSerie ? l.series.length : Number(l.quantite) || 0);

export function Receptions() {
  const t = useT();
  const { fmt } = useDevise();
  const [caisseId] = useCaisse();
  const [bonId, setBonId] = useState<string | null>(null);
  const [pret, setPret] = useState(false);
  // « ?bon=… » : lien « Réceptionner » d'un bon de commande.
  useEffect(() => { setBonId(new URLSearchParams(window.location.search).get("bon")); setPret(true); }, []);
  const { donnees: d, erreur, recharger } = useLecture<Donnees>(pret ? `/api/pos/receptions${bonId ? `?bonCommandeId=${bonId}` : ""}` : null);
  const bons = useLecture<{ bons: BonVue[] }>(pret ? "/api/pos/achats" : null);
  const flux = useFluxPos({ caisseId, actif: !!d?.peutRecevoir });

  // Les lignes vivent aussi dans une référence : deux scans arrivés coup sur coup s'appliquent l'un après l'autre, sans attendre le rendu.
  const [lignes, poserLignes] = useState<Ligne[]>([]);
  const lignesRef = useRef<Ligne[]>([]);
  const setLignes = (f: Ligne[] | ((ls: Ligne[]) => Ligne[])) => { lignesRef.current = typeof f === "function" ? f(lignesRef.current) : f; poserLignes(lignesRef.current); };
  const [fournisseurId, setFournisseurId] = useState("");
  const [entrepotId, setEntrepotId] = useState("");
  const [reference, setReference] = useState("");
  /** Ligne qui attend des numéros de série : les scans suivants lui sont destinés. */
  const [serie, setSerie] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<{ code: string; message: string } | null>(null);
  const [resultat, setResultat] = useState<(ResultatReception & { rejoue: boolean }) | null>(null);
  const cle = useRef(nouvelleCle());

  // Lignes de départ : ce qu'il reste à recevoir sur le bon choisi.
  const bon = d?.bon ?? null;
  useEffect(() => {
    setSerie(null); setRefus(null);
    setLignes(bon ? bon.lignes.filter((l) => l.quantiteRecue < l.quantite).map((l) => nouvelleLigne(
      { produitId: l.produitId, varianteId: l.varianteId, nom: l.nom, variante: l.variante, uniteVente: l.uniteVente === "kg" ? "kg" : "piece", suiviSerie: l.suiviSerie, cout: l.prixUnitaire || null, variantes: l.variantes },
      { commande: l.quantite, dejaRecu: l.quantiteRecue },
    )) : []);
  }, [bon?.id, bon?.statut, bon?.lignes.map((l) => l.quantiteRecue).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (d && !entrepotId) setEntrepotId(d.entrepotId); }, [d, entrepotId]);

  const modifier = (cleLigne: string, c: Partial<Ligne>) => setLignes((ls) => ls.map((l) => (l.cle === cleLigne ? { ...l, ...c } : l)));

  /** Ajoute un article reçu : complète sa ligne si elle existe, sinon en crée une. `plus` = quantité à ajouter (0 = aucune). */
  function ajouter(a: ArticleAchat, plus: number) {
    const ls = lignesRef.current;
    // Ligne exacte, sinon la ligne « toutes variantes » du produit encore vide, sinon une nouvelle ligne.
    const exacte = ls.find((l) => l.produitId === a.produitId && l.varianteId === a.varianteId)
      ?? (a.varianteId ? ls.find((l) => l.produitId === a.produitId && !l.varianteId && l.variantes.length > 0 && quantiteDe(l) === 0) : undefined);
    const base = exacte ?? nouvelleLigne(a);
    const maj: Ligne = { ...base, varianteId: a.varianteId ?? base.varianteId, variante: a.variante ?? base.variante, quantite: base.suiviSerie || !plus ? base.quantite : String((Number(base.quantite) || 0) + plus) };
    setLignes(exacte ? ls.map((l) => (l.cle === exacte.cle ? maj : l)) : [...ls, maj]);
    if (a.suiviSerie) setSerie(base.cle);
  }

  // Le gestionnaire de scan lit l'état courant par une référence : l'abonnement au bus ne se refait pas à chaque frappe.
  const surCode = useRef<(code: string) => void>(() => {});
  surCode.current = async (code: string) => {
    if (!d?.peutRecevoir || envoi) return;
    if (serie) {
      if (lignesRef.current.some((l) => l.series.includes(code))) { toast.error(t("Le numéro de série {0} est déjà saisi.", code)); return; }
      setLignes((ls) => ls.map((l) => (l.cle === serie ? { ...l, series: [...l.series, code] } : l)));
      return;
    }
    const r = await appelPos<{ article: ArticleResolu }>(`/api/pos/scan?code=${encodeURIComponent(code)}`, { caisseId });
    if (!r.ok) { toast.error(r.code === "inconnu" ? t("Code inconnu : {0}. Ajoutez le produit par son nom, ou créez-le d'abord.", code) : t(r.message)); return; }
    const a = r.donnees.article;
    if (a.numeroSerie) { toast.error(t("Le numéro de série {0} est déjà enregistré dans la boutique.", a.numeroSerie)); return; }
    ajouter(versArticleAchat(a), a.suiviSerie ? 0 : a.poidsGrammes ?? (a.uniteVente === "kg" ? 0 : 1));
    toast.success(a.nom, { duration: 1200 });
  };
  useEffect(() => surScan((s) => { if (s.contexte === "reception") surCode.current(s.code); }), []);

  if (!pret || (!d && !erreur)) return <Page><EtatChargement texte="Chargement des réceptions…" /></Page>;
  if (erreur && !d) return <Page><EtatPos code={erreur.code} message={erreur.message} onReessayer={() => void recharger()} /></Page>;
  if (!d) return null;

  const aRecevoir = lignes.filter((l) => quantiteDe(l) > 0);
  const probleme = aRecevoir.find((l) => l.variantes.length > 0 && !l.varianteId) ? "Précisez la variante reçue sur chaque ligne."
    : aRecevoir.find((l) => !l.suiviSerie && !Number.isInteger(Number(l.quantite))) ? "Les quantités reçues sont des nombres entiers (en grammes pour un produit au poids)."
    : aRecevoir.find((l) => l.cout.trim() !== "" && !(lireMontant(l.cout) >= 0)) ? "Vérifiez les coûts saisis."
    : null;
  const total = aRecevoir.reduce((s, l) => s + ((lireMontant(l.cout) || 0) * quantiteDe(l)) / (l.uniteVente === "kg" ? 1000 : 1), 0);
  const recevables = bons.donnees?.bons.filter((b) => STATUTS_RECEVABLES.includes(b.statut)) ?? [];

  async function valider() {
    setEnvoi(true); setRefus(null);
    const r = await appelPos<ResultatReception>("/api/pos/receptions", {
      cle: cle.current, caisseId,
      corps: {
        bonCommandeId: bon?.id ?? null, fournisseurId: bon ? null : fournisseurId || null, entrepotId: bon ? null : entrepotId || null, reference: reference.trim() || null,
        lignes: aRecevoir.map((l) => ({
          produitId: l.produitId, varianteId: l.varianteId, quantite: quantiteDe(l), coutUnitaire: l.cout.trim() === "" ? 0 : lireMontant(l.cout),
          lot: l.lotCode.trim() || l.expiration ? { code: l.lotCode.trim() || null, expiration: l.expiration ? new Date(`${l.expiration}T12:00:00`).toISOString() : null } : null,
          numerosSerie: l.series,
        })),
      },
    });
    setEnvoi(false);
    // Refus ou coupure : la clé est gardée, un nouvel essai ne créera pas de doublon.
    if (!r.ok) { setRefus({ code: r.code, message: r.message }); return; }
    cle.current = nouvelleCle();
    setResultat({ ...r.donnees, rejoue: r.rejoue });
    setReference(""); setSerie(null);
    if (!bon) setLignes([]);
    void recharger(); void bons.recharger();
  }

  return (
    <Page>
      <EnTete titre="Réceptions" sousTitre="Enregistrez la marchandise reçue : quantités, coût réel, lots et numéros de série. Le stock et le coût des produits sont mis à jour à la validation.">
        <BadgeConnexion etat={flux.etat === "hors_ligne" ? "hors_ligne" : "en_ligne"} />
        <Bouton href="/dashboard/pos/achats" variante="secondaire">{t("Bons de commande")}</Bouton>
      </EnTete>

      {!d.peutRecevoir ? <EtatNonAutorise texte="Votre compte peut consulter les réceptions, mais pas en enregistrer. Demandez le droit « réception » à un responsable." compact /> : (
        <>
          {resultat && (
            <section role="status" className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-4 text-[12.5px] text-[#14532D]">
              <p className="flex items-center gap-2 text-[13.5px] font-bold"><CheckCircle2 size={16} aria-hidden />
                {resultat.rejoue ? t("Cette réception a déjà été enregistrée. Aucun doublon n'a été créé.") : t("Réception enregistrée : {0} ligne(s), le stock est à jour.", resultat.lignes)}
              </p>
              {resultat.bon && <p className="mt-1">{t("Bon {0} : {1}.", resultat.bon.numero, t(resultat.bon.statut === "recu" ? "entièrement reçu" : "partiellement reçu"))}</p>}
              <ul className="mt-2 space-y-0.5">
                {resultat.couts.map((c, i) => (
                  <li key={i}>{c.nom} : {t("coût")} {c.avant != null ? fmt(c.avant) : t("non renseigné")} → {c.apres != null ? fmt(c.apres) : t("non renseigné")} ({t(REGLES_COUT[c.regle])})</li>
                ))}
              </ul>
              <div className="mt-3"><Bouton variante="secondaire" taille="compact" onClick={() => setResultat(null)}>{t("Fermer")}</Bouton></div>
            </section>
          )}

          <Carte titre="Nouvelle réception">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Champ label="Bon de commande" aide={bons.erreur ? bons.erreur.message : undefined} className="sm:col-span-2">
                {(a) => (
                  <select {...a} className={CLASSE_SAISIE} value={bonId ?? ""} onChange={(e) => { setBonId(e.target.value || null); setResultat(null); }}>
                    <option value="">{t("Sans bon de commande")}</option>
                    {bon && !recevables.some((b) => b.id === bon.id) && <option value={bon.id}>{bon.numero} · {bon.fournisseur.nom}</option>}
                    {recevables.map((b) => <option key={b.id} value={b.id}>{b.numero} · {b.fournisseur.nom}</option>)}
                  </select>
                )}
              </Champ>
              {!bon && (
                <>
                  <Champ label="Fournisseur">
                    {(a) => <select {...a} className={CLASSE_SAISIE} value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)}><option value="">{t("Non précisé")}</option>{d.fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}</select>}
                  </Champ>
                  <Champ label="Reçu dans">
                    {(a) => <select {...a} className={CLASSE_SAISIE} value={entrepotId} onChange={(e) => setEntrepotId(e.target.value)}>{d.entrepots.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}</select>}
                  </Champ>
                </>
              )}
              <Saisie label="N° du bon de livraison" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} className={bon ? "sm:col-span-2" : "sm:col-span-2 lg:col-span-4"} />
            </div>
            {bon && !STATUTS_RECEVABLES.includes(bon.statut) && (
              <p role="alert" className="mt-3 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-3 text-[12.5px] text-[#92400E]">
                {t(bon.statut === "brouillon" ? "Ce bon est encore un brouillon : marquez-le comme envoyé avant de réceptionner." : "Ce bon est clos : il ne peut plus recevoir de marchandise.")}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-end gap-2">
              <BoutonScanner contexte="reception" caisseId={caisseId} libelle="Scanner à la caméra" />
              <div className="min-w-0 flex-1 basis-64"><RechercheArticle label="Ajouter un produit reçu" varianteObligatoire onChoisir={(a) => ajouter(a, 0)} /></div>
            </div>
            <CapteurClavier contexte="reception" caisseId={caisseId} actif={!envoi} />
            <p className="mt-1 text-[11.5px] text-[#888888]">{t("Douchette, caméra ou téléphone appairé (contexte « Réception ») : chaque scan ajoute une unité à la ligne du produit.")}</p>

            {serie && (
              <p role="status" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F5A623] bg-[#FFF7ED] p-3 text-[12.5px] text-[#92400E]">
                <span className="flex items-center gap-2"><ScanLine size={15} aria-hidden />{t("Scannez les numéros de série de « {0} » : chaque code lu est un numéro.", lignes.find((l) => l.cle === serie)?.nom ?? "")}</span>
                <Bouton taille="compact" variante="secondaire" onClick={() => setSerie(null)}>{t("Terminer la saisie des numéros")}</Bouton>
              </p>
            )}

            {lignes.length === 0 ? (
              <EtatVide compact className="mt-4" titre="Aucun produit sur cette réception" texte="Scannez un produit, cherchez-le par son nom, ou choisissez un bon de commande pour partir de ses lignes." />
            ) : (
              <ul className="mt-4 divide-y divide-[#F0F0F0] rounded-xl border border-[#E8E8E8]">
                {lignes.map((l) => {
                  const reste = l.commande != null ? Math.max(0, l.commande - l.dejaRecu) : null;
                  const recu = quantiteDe(l);
                  return (
                    <li key={l.cle} className="space-y-2 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-bold">{l.nom}{l.variante ? <span className="font-normal text-[#666666]"> · {l.variante}</span> : null}</p>
                          <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#666666]">
                            {l.commande != null ? t("Commandé {0}, déjà reçu {1}, reste {2}", qte(l.commande, l.uniteVente), qte(l.dejaRecu, l.uniteVente), qte(reste!, l.uniteVente)) : bon ? <Badge ton="attention">{t("Absent du bon de commande")}</Badge> : null}
                            {reste != null && recu > reste && <Badge ton="attention">{t("Plus que commandé")}</Badge>}
                            {l.suiviSerie && <Badge ton="info">{t("Numéro de série obligatoire")}</Badge>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {reste != null && reste > 0 && !l.suiviSerie && <Bouton taille="compact" variante="secondaire" onClick={() => modifier(l.cle, { quantite: String(reste) })}>{t("Tout reçu")}</Bouton>}
                          <BoutonIcone label={t("Retirer {0}", l.nom)} variante="danger" onClick={() => { setLignes((ls) => ls.filter((x) => x.cle !== l.cle)); if (serie === l.cle) setSerie(null); }}><Trash2 size={16} aria-hidden /></BoutonIcone>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {l.variantes.length > 0 && (
                          <Champ label="Variante reçue" erreur={recu > 0 && !l.varianteId ? "À préciser" : null}>
                            {(a) => (
                              <select {...a} className={CLASSE_SAISIE} value={l.varianteId ?? ""} onChange={(e) => modifier(l.cle, { varianteId: e.target.value || null, variante: l.variantes.find((v) => v.id === e.target.value)?.libelle ?? null })}>
                                <option value="">{t("Choisir…")}</option>
                                {l.variantes.map((v) => <option key={v.id} value={v.id}>{v.libelle}</option>)}
                              </select>
                            )}
                          </Champ>
                        )}
                        {l.suiviSerie
                          ? <Saisie label="Quantité reçue" value={String(l.series.length)} readOnly aide="Un numéro de série par unité." />
                          : <Saisie label={l.uniteVente === "kg" ? "Grammes reçus" : "Quantité reçue"} type="number" inputMode="numeric" min={0} step={1} value={l.quantite} onChange={(e) => modifier(l.cle, { quantite: e.target.value })} />}
                        <Saisie label={l.uniteVente === "kg" ? "Coût réel au kilo" : "Coût réel unitaire"} inputMode="decimal" value={l.cout} placeholder={t("Non renseigné")} onChange={(e) => modifier(l.cle, { cout: e.target.value })} />
                        <Saisie label="Code du lot" value={l.lotCode} maxLength={80} placeholder={t("Facultatif")} onChange={(e) => modifier(l.cle, { lotCode: e.target.value })} />
                        <Saisie label="Expire le" type="date" value={l.expiration} onChange={(e) => modifier(l.cle, { expiration: e.target.value })} />
                      </div>
                      {(l.lotCode.trim() || l.expiration) && <p className="text-[11.5px] text-[#888888]">{t("Un lot sera créé pour cette ligne (code généré s'il est laissé vide), avec son coût, son fournisseur et son entrepôt.")}</p>}
                      {l.suiviSerie && (
                        <div className="rounded-xl bg-[#FAFAFA] p-2">
                          <div className="flex flex-wrap items-end gap-2">
                            <form className="flex min-w-0 flex-1 items-end gap-2" onSubmit={(e) => {
                              e.preventDefault();
                              const champ = e.currentTarget.elements.namedItem("serie") as HTMLInputElement;
                              const numero = champ.value.trim();
                              if (!numero) return;
                              if (lignes.some((x) => x.series.includes(numero))) { toast.error(t("Le numéro de série {0} est déjà saisi.", numero)); return; }
                              modifier(l.cle, { series: [...l.series, numero] }); champ.value = "";
                            }}>
                              <Saisie label="Numéro de série" name="serie" maxLength={120} autoComplete="off" className="min-w-0 flex-1" />
                              <Bouton type="submit" variante="secondaire">{t("Ajouter")}</Bouton>
                            </form>
                            {serie !== l.cle && <Bouton variante="discret" icone={<ScanLine size={14} aria-hidden />} onClick={() => setSerie(l.cle)}>{t("Scanner les numéros")}</Bouton>}
                          </div>
                          {l.series.length > 0 && (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {l.series.map((n) => (
                                <li key={n} className="inline-flex items-center gap-1 rounded-lg border border-[#E8E8E8] bg-white pl-2 text-[12px]">
                                  <span className="font-mono">{n}</span>
                                  <button type="button" aria-label={t("Retirer le numéro {0}", n)} className={`flex h-11 w-9 items-center justify-center text-[#B91C1C] ${FOCUS}`} onClick={() => modifier(l.cle, { series: l.series.filter((x) => x !== n) })}><X size={14} aria-hidden /></button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {refus && (refus.code === "hors_ligne"
              ? <p role="alert" className="mt-3 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-3 text-[12.5px] text-[#92400E]">{t("Connexion interrompue : la réception n'est pas partie. Votre saisie est conservée sur cet écran ; validez de nouveau dès que le réseau revient, aucun doublon ne sera créé.")}</p>
              : <p role="alert" className="mt-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-[12.5px] text-[#B91C1C]">{t(refus.message)}{refus.code === "bon_non_recevable" || refus.code === "conflit" ? <> <button type="button" className={`font-bold underline ${FOCUS}`} onClick={() => { setRefus(null); void recharger(); }}>{t("Recharger")}</button></> : null}</p>)}
            {probleme && aRecevoir.length > 0 && <p role="alert" className="mt-3 text-[12.5px] font-semibold text-[#B91C1C]">{t(probleme)}</p>}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0F0F0] pt-4">
              <div className="text-[12px] leading-relaxed text-[#666666]">
                <p className="text-[14px] font-bold text-[#111111]">{t("{0} ligne(s) à recevoir", aRecevoir.length)} · {fmt(total)}</p>
                <p>{t("Coût des produits : coût moyen pondéré entre le stock présent et cette réception. Un coût laissé vide ne modifie pas le coût du produit.")}</p>
              </div>
              <Bouton taille="grand" charge={envoi} disabled={!aRecevoir.length || !!probleme || (!!bon && !STATUTS_RECEVABLES.includes(bon.statut))} onClick={() => void valider()}>{t("Valider la réception")}</Bouton>
            </div>
          </Carte>
        </>
      )}

      <Carte titre={bon ? `Réceptions du bon ${bon.numero}` : "Dernières réceptions"}>
        {d.receptions.length === 0 ? <EtatVide compact titre="Aucune réception enregistrée" /> : (
          <ul className="divide-y divide-[#F0F0F0]">
            {d.receptions.map((r) => (
              <li key={r.id} className="py-2.5">
                <details>
                  <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-2 text-[13px]">
                    <span className="font-semibold">{new Date(r.recuAt).toLocaleString(t.loc, { dateStyle: "medium", timeStyle: "short" })} · {r.fournisseur ?? t("Fournisseur non précisé")}</span>
                    <span className="text-[12px] text-[#666666]">{[r.bon, r.reference && `BL ${r.reference}`, r.entrepot, t("{0} ligne(s)", r.lignes.length)].filter(Boolean).join(" · ")}</span>
                  </summary>
                  <ul className="pb-1 text-[12px] tabular-nums text-[#444444]">
                    {r.lignes.map((l) => (
                      <li key={l.id} className="flex flex-wrap justify-between gap-3 py-0.5">
                        <span>{l.nom}{l.lot ? ` · ${t("lot")}` : ""}{l.series ? ` · ${t("{0} n° de série", l.series)}` : ""}</span>
                        <span>{qte(l.quantite, l.uniteVente)}{l.coutUnitaire > 0 ? ` × ${fmt(l.coutUnitaire)}` : ` · ${t("coût non renseigné")}`}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </Page>
  );
}
