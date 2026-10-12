"use client";
// Retours et avoirs : retrouver la vente d'origine (numéro du reçu scanné ou
// saisi, client, numéro de série, article), choisir les lignes et quantités,
// puis rembourser, émettre un avoir ou échanger.
//
// Le montant affiché avant validation est calculé ici avec les mêmes fonctions
// que le serveur (lib/pos/caisse/calculs.ts) ; c'est le serveur qui fait foi.
// Un remboursement Mobile Money ou carte reste DÉCLARATIF : AXSO n'envoie pas
// l'argent, le caissier le rend lui-même — l'écran le dit (« Non vérifié »).
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, Printer, RotateCcw, Search, Trash2 } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, BadgePaiement, Bouton, BoutonIcone, CLASSE_SAISIE, Champ, EtatChargement, EtatNonAutorise, EtatPos, EtatVide, Saisie } from "@/components/pos/ui";
import type { Demarrage } from "@/components/pos/caisse/api";
import BoutonScanner from "@/components/pos/scanner/BoutonScanner";
import { useFluxPos } from "@/components/pos/scanner/useFluxPos";
import { surScan } from "@/lib/pos/client/bus";
import { nouvelleCle } from "@/lib/pos/client/transport";
import { calculerRetour } from "@/lib/pos/caisse/calculs";
import type { ResultatEchange } from "@/lib/pos/retours";
import type { ArticleResolu, PanierCalcule } from "@/lib/pos/types";
import { Carte, EnTete, Page, appelPos, imprimerElement, lireMontant, useCaisse, useLecture, type ErreurAppel } from "./commun";

type LigneVente = {
  id: string; produitId: string; nom: string; variante: string | null; prix: number; quantite: number; quantiteRetournee: number;
  restant: number; total: number; taxe: number; auPoids: boolean; offert: boolean; numeroSerie: string | null;
};
type Vente = {
  id: string; numero: string; facture: string | null; createdAt: string; clientId: string | null; clientNom: string;
  montantTotal: number; montantPaye: number; horsDelai: boolean; creditDu: number; lignes: LigneVente[];
  paiements: { mode: string; libelle: string; montant: number; nonVerifie: boolean; reference: string | null }[];
};
type Recherche = { devise: string; politique: { delaiJours: number; sansRecu: boolean }; ventes: Vente[] };
type Historique = { retours: { id: string; createdAt: string; numero: string; clientNom: string; type: string; raison: string; montant: number; sansRecu: boolean; avoir: { code: string; solde: number; statut: string } | null }[] };
type Choix = Record<string, { quantite: number; etat: "stock" | "endommage" }>;
type LigneEchange = { cle: string; article: ArticleResolu; varianteId: string | null; quantite: number; numeroSerie: string };

const RAISONS = [["change_avis", "Le client a changé d'avis"], ["defaut", "Article défectueux"], ["erreur_commande", "Erreur à la vente"], ["endommage", "Article abîmé"], ["autre", "Autre raison"]] as const;
const TYPES = [["remboursement", "Rembourser"], ["avoir", "Émettre un avoir"], ["echange", "Échanger"]] as const;
const LIBELLES_TYPE: Record<string, string> = { remboursement: "Remboursement", avoir: "Avoir", echange: "Échange" };
const BOUTON_CHOIX = "min-h-11 rounded-xl border px-3 text-[12.5px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] disabled:opacity-50 disabled:cursor-not-allowed";

export function Retours() {
  const t = useT();
  const { fmt } = useDevise();
  const [caisseId] = useCaisse();
  const demarrage = useLecture<Demarrage>("/api/pos/reglages", caisseId);
  const [onglet, setOnglet] = useState<"nouveau" | "historique">("nouveau");
  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  const recherche = useLecture<Recherche>(demarrage.donnees?.droits.retour ? `/api/pos/retours/ventes?q=${encodeURIComponent(q)}` : null, caisseId);
  const [venteId, setVenteId] = useState<string | null>(null);
  const [fait, setFait] = useState<{ retour: ResultatEchange; message: string } | null>(null);

  // Scan du reçu : téléphone appairé (flux), caméra ou scanner USB — tous arrivent par le bus.
  useFluxPos({ caisseId });
  useEffect(() => surScan((scan) => { setSaisie(scan.code); setQ(scan.code); setVenteId(null); setFait(null); setOnglet("nouveau"); }), []);

  if (demarrage.erreur && !demarrage.donnees) return <Page><EnTete titre="Retours & avoirs" /><EtatPos code={demarrage.erreur.code} message={demarrage.erreur.message} onReessayer={() => void demarrage.recharger()} /></Page>;
  if (!demarrage.donnees) return <Page><EnTete titre="Retours & avoirs" /><EtatChargement /></Page>;
  const d = demarrage.donnees;
  if (!d.droits.retour && !d.droits.voir_caisse) return <Page><EnTete titre="Retours & avoirs" /><EtatNonAutorise texte="Votre compte n'a pas le droit d'enregistrer un retour. Demandez à un responsable." /></Page>;

  const vente = recherche.donnees?.ventes.find((v) => v.id === venteId) ?? null;
  const politique = recherche.donnees?.politique;

  return (
    <Page>
      <EnTete titre="Retours & avoirs" sousTitre={politique ? t(politique.delaiJours > 0 ? "Retours acceptés pendant {0} jours après la vente." : "Retours acceptés sans limite de délai.", politique.delaiJours) : undefined}>
        <div role="tablist" className="flex rounded-xl bg-[#F5F5F5] p-1">
          {([["nouveau", "Nouveau retour"], ["historique", "Historique"]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={onglet === id} onClick={() => setOnglet(id)}
              className={`min-h-9 rounded-lg px-3 text-[12px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#111111] ${onglet === id ? "bg-white shadow-sm" : "text-[#666666]"}`}>{t(label)}</button>
          ))}
        </div>
      </EnTete>

      {onglet === "historique" && <HistoriqueRetours caisseId={caisseId} />}

      {onglet === "nouveau" && !d.droits.retour && <EtatNonAutorise texte="Votre compte peut consulter l'historique des retours, pas en enregistrer." />}

      {onglet === "nouveau" && d.droits.retour && fait && (
        <Resultat fait={fait} onNouveau={() => { setFait(null); setVenteId(null); setSaisie(""); setQ(""); void recherche.recharger(); }} />
      )}

      {onglet === "nouveau" && d.droits.retour && !fait && (
        <>
          <Carte titre="Vente d'origine">
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setQ(saisie.trim()); setVenteId(null); }}>
              <Saisie label="Numéro du reçu, client, téléphone, numéro de série ou article" aide="Scannez le reçu ou saisissez puis validez par Entrée." value={saisie} onChange={(e) => setSaisie(e.target.value)} className="min-w-0 flex-1" autoFocus />
              <Bouton type="submit" variante="sombre" icone={<Search size={15} aria-hidden />} charge={recherche.charge}>{t("Rechercher")}</Bouton>
              <BoutonScanner contexte="recherche" libelle="Scanner le reçu" variante="secondaire" fermerApresScan caisseId={d.caisse?.id ?? caisseId} />
            </form>
            <div className="mt-3">
              {recherche.erreur ? <EtatPos code={recherche.erreur.code} message={recherche.erreur.message} onReessayer={() => void recherche.recharger()} compact />
                : !recherche.donnees ? <EtatChargement compact />
                : recherche.donnees.ventes.length === 0 ? <EtatVide compact titre="Aucune vente trouvée" texte="Vérifiez le numéro du reçu, ou cherchez par le nom ou le téléphone du client, le numéro de série ou l'article." />
                : (
                  <ul className="divide-y divide-[#F0F0F0]" aria-label={t(q ? "Ventes trouvées" : "Dernières ventes de la caisse")}>
                    {recherche.donnees.ventes.map((v) => {
                      const retournable = v.lignes.some((l) => l.restant > 0);
                      return (
                        <li key={v.id}>
                          <button type="button" onClick={() => setVenteId(v.id)} aria-pressed={venteId === v.id}
                            className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#111111] ${venteId === v.id ? "bg-[#FFF7ED]" : ""}`}>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-semibold">#{v.numero} · {v.clientNom}</span>
                              <span className="block truncate text-[11px] text-[#888888]">{new Date(v.createdAt).toLocaleString(t.loc, { dateStyle: "medium", timeStyle: "short" })} · {v.lignes.length} {t(v.lignes.length > 1 ? "articles" : "article")}</span>
                            </span>
                            {v.horsDelai ? <Badge ton="danger">{t("Délai dépassé")}</Badge> : !retournable ? <Badge ton="neutre">{t("Déjà retournée")}</Badge> : null}
                            <span className="w-24 text-right text-[13px] font-bold tabular-nums">{fmt(v.montantTotal)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
            </div>
          </Carte>

          {vente && politique && (
            <FormulaireRetour key={vente.id} vente={vente} politique={politique} demarrage={d} caisseId={d.caisse?.id ?? caisseId}
              onFait={(retour, message) => setFait({ retour, message })} />
          )}
        </>
      )}
    </Page>
  );
}

function FormulaireRetour({ vente, politique, demarrage, caisseId, onFait }: {
  vente: Vente; politique: Recherche["politique"]; demarrage: Demarrage; caisseId: string | null; onFait: (r: ResultatEchange, message: string) => void;
}) {
  const t = useT();
  const { fmt } = useDevise();
  const droits = demarrage.droits;
  const [choix, setChoix] = useState<Choix>({});
  const [type, setType] = useState<"remboursement" | "avoir" | "echange">(droits.rembourser ? "remboursement" : "avoir");
  const [mode, setMode] = useState<"origine" | "especes">("origine");
  const [raison, setRaison] = useState<string>("change_avis");
  const [description, setDescription] = useState("");
  const [sansRecu, setSansRecu] = useState(false);
  const [echange, setEchange] = useState<LigneEchange[]>([]);
  const [panier, setPanier] = useState<{ total: number } | null>(null);
  const [complement, setComplement] = useState<{ mode: string; montant: string; reference: string }>({ mode: "especes", montant: "", reference: "" });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<ErreurAppel | null>(null);
  const cle = useRef(nouvelleCle());

  const demandes = Object.entries(choix).filter(([, c]) => c.quantite > 0).map(([ligneCommandeId, c]) => ({ ligneCommandeId, quantite: c.quantite, etat: c.etat }));
  const calcul = useMemo(() => {
    if (!demandes.length) return null;
    try { return calculerRetour(vente.lignes.map((l) => ({ ...l, remise: 0, cout: null })), demandes); } catch { return null; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(demandes), vente]);
  const montant = calcul?.montant ?? 0;
  const credit = Math.min(montant, vente.creditDu);
  const aRendre = montant - credit;
  const resteAPayer = type === "echange" && panier ? Math.max(0, panier.total - aRendre) : 0;
  const avoirRestant = type === "echange" && panier ? Math.max(0, aRendre - panier.total) : 0;
  const modesComplement = demarrage.modesPaiement.filter((m) => m.statut !== "a_connecter" && m.id !== "credit" && m.id !== "avoir");

  const regler = (l: LigneVente, quantite: number) => setChoix((c) => ({ ...c, [l.id]: { etat: c[l.id]?.etat ?? "stock", quantite: Math.max(0, Math.min(l.restant, Math.floor(quantite) || 0)) } }));

  if (vente.horsDelai) return <EtatVide titre="Le délai de retour est dépassé" texte={t("Cette vente date de plus de {0} jours. Le délai se règle dans les réglages de la caisse.", politique.delaiJours)} />;
  if (!vente.lignes.some((l) => l.restant > 0)) return <EtatVide titre="Cette vente a déjà été entièrement retournée" />;

  async function valider() {
    if (!demandes.length) { setErreur({ code: "invalide", message: "Choisissez au moins un article à retourner." }); return; }
    if (type === "echange" && !echange.length) { setErreur({ code: "invalide", message: "Choisissez les articles que le client emporte en échange." }); return; }
    const paye = lireMontant(complement.montant);
    setEnvoi(true); setErreur(null);
    const r = await appelPos<{ retour: ResultatEchange; message: string }>("/api/pos/retours", {
      method: "POST", caisseId,
      corps: {
        cle: cle.current, commandeId: vente.id, lignes: demandes, type, raison, description: description.trim() || null, sansRecu,
        ...(type === "remboursement" ? { modeRemboursement: mode } : {}),
        ...(type === "echange" ? {
          echange: {
            lignes: echange.map((l) => ({ produitId: l.article.produitId, varianteId: l.varianteId, quantite: l.quantite, ...(l.numeroSerie.trim() ? { numeroSerie: l.numeroSerie.trim() } : {}) })),
            paiements: resteAPayer > 0 ? [{ mode: complement.mode, montant: complement.mode === "especes" && paye > resteAPayer ? paye : resteAPayer, ...(complement.reference.trim() ? { reference: complement.reference.trim() } : {}) }] : [],
          },
        } : {}),
      },
    });
    setEnvoi(false);
    if (!r.ok) { setErreur({ code: r.code, message: r.message }); return; }
    onFait(r.donnees.retour, r.donnees.message);
  }

  return (
    <>
      <Carte titre={t("Articles de la vente #{0}", vente.numero)} actions={<Bouton variante="secondaire" taille="compact" onClick={() => setChoix(Object.fromEntries(vente.lignes.filter((l) => l.restant > 0).map((l) => [l.id, { quantite: l.restant, etat: choix[l.id]?.etat ?? "stock" }])))}>{t("Tout retourner")}</Bouton>}>
        <ul className="divide-y divide-[#F0F0F0]">
          {vente.lignes.map((l) => {
            const c = choix[l.id];
            return (
              <li key={l.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-[13px] font-semibold">{l.nom}</p>
                  <p className="text-[11px] text-[#888888]">
                    {l.auPoids ? `${l.quantite} g` : `${l.quantite} × ${fmt(l.prix)}`} · {t("payé")} {fmt(l.total)}
                    {l.numeroSerie ? ` · ${t("N° de série")} ${l.numeroSerie}` : ""}{l.offert ? ` · ${t("offert")}` : ""}
                    {l.quantiteRetournee > 0 ? ` · ${t("déjà retourné")} : ${l.quantiteRetournee}${l.auPoids ? " g" : ""}` : ""}
                  </p>
                </div>
                {l.restant <= 0 ? <Badge ton="neutre">{t("Déjà retourné")}</Badge> : l.auPoids ? (
                  <Saisie label="Poids retourné (g)" labelMasque inputMode="numeric" suffixe="g" placeholder="0" value={c?.quantite ? String(c.quantite) : ""} onChange={(e) => regler(l, Number(e.target.value.replace(/\D/g, "")))} className="w-32" />
                ) : (
                  <div className="flex items-center gap-1.5" role="group" aria-label={t("Quantité retournée de {0}", l.nom)}>
                    <BoutonIcone label={t("Retirer une unité")} onClick={() => regler(l, (c?.quantite ?? 0) - 1)} disabled={!c?.quantite}><Minus size={16} aria-hidden /></BoutonIcone>
                    <span className="w-14 text-center text-[14px] font-bold tabular-nums" aria-live="polite">{c?.quantite ?? 0} / {l.restant}</span>
                    <BoutonIcone label={t("Ajouter une unité")} onClick={() => regler(l, (c?.quantite ?? 0) + 1)} disabled={(c?.quantite ?? 0) >= l.restant}><Plus size={16} aria-hidden /></BoutonIcone>
                  </div>
                )}
                {!!c?.quantite && (
                  <Champ label="État de l'article" labelMasque className="w-full sm:w-44">
                    {(a) => (
                      <select {...a} className={CLASSE_SAISIE} value={c.etat} onChange={(e) => setChoix((x) => ({ ...x, [l.id]: { ...c, etat: e.target.value as "stock" | "endommage" } }))}>
                        <option value="stock">{t("Remis en stock")}</option>
                        <option value="endommage">{t(l.numeroSerie ? "Défectueux, non revendable" : "Endommagé, non revendable")}</option>
                      </select>
                    )}
                  </Champ>
                )}
              </li>
            );
          })}
        </ul>
      </Carte>

      <Carte titre="Que fait-on pour le client ?">
        <div className="space-y-4">
          <div role="group" aria-label={t("Type de retour")} className="grid gap-2 sm:grid-cols-3">
            {TYPES.map(([id, label]) => {
              const interdit = (id === "remboursement" && !droits.rembourser) || (id === "echange" && !droits.vendre);
              return <button key={id} type="button" disabled={interdit} aria-pressed={type === id} onClick={() => setType(id)} className={`${BOUTON_CHOIX} ${type === id ? "border-[#111111] bg-[#111111] text-white" : "border-[#E8E8E8] bg-white"}`}>{t(label)}</button>;
            })}
          </div>
          {!droits.rembourser && <p className="text-[11.5px] text-[#888888]">{t("Rendre de l'argent est réservé aux personnes qui en ont le droit. Vous pouvez émettre un avoir ou faire un échange.")}</p>}

          {type === "remboursement" && (
            <>
              <div role="group" aria-label={t("Moyen de remboursement")} className="grid gap-2 sm:grid-cols-2">
                {([["origine", "Moyen de paiement d'origine"], ["especes", "En espèces"]] as const).map(([id, label]) => (
                  <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} className={`${BOUTON_CHOIX} ${mode === id ? "border-[#F5A623] bg-[#FFF7ED]" : "border-[#E8E8E8] bg-white"}`}>{t(label)}</button>
                ))}
              </div>
              {mode === "origine" && vente.paiements.some((p) => p.nonVerifie && p.montant > 0) && (
                <p className="flex flex-wrap items-center gap-2 text-[11.5px] leading-relaxed text-[#666666]"><BadgePaiement statut="declaratif" />{t("AXSO n'envoie pas l'argent sur Mobile Money ou sur la carte : faites le remboursement vous-même, il sera enregistré comme déclaré.")}</p>
              )}
            </>
          )}
          {type === "avoir" && <p className="text-[12px] leading-relaxed text-[#666666]">{t("Le client reçoit un avoir avec un code unique, utilisable comme moyen de paiement « Avoir » lors d'une prochaine vente.")}</p>}
          {type === "echange" && (
            <Echange caisseId={caisseId} clientId={vente.clientId} lignes={echange} setLignes={setEchange} onPanier={setPanier} />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Champ label="Raison du retour">
              {(a) => <select {...a} className={CLASSE_SAISIE} value={raison} onChange={(e) => setRaison(e.target.value)}>{RAISONS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select>}
            </Champ>
            <Saisie label="Précision (facultatif)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
          </div>
          {politique.sansRecu ? (
            <label className="flex min-h-11 items-center gap-2 text-[13px]">
              <input type="checkbox" className="h-5 w-5 accent-[#F5A623]" checked={sansRecu} onChange={(e) => setSansRecu(e.target.checked)} />
              {t("Le client n'a pas son reçu (noté dans le journal d'audit)")}
            </label>
          ) : <p className="text-[11.5px] text-[#888888]">{t("Retour sans reçu : non accepté par les réglages de la caisse. Le reçu ou la vente retrouvée ici en tient lieu.")}</p>}

          <table className="w-full text-[13px]" aria-live="polite">
            <tbody>
              <tr className="border-b border-[#F0F0F0]"><td className="py-2 text-[#666666]">{t("Valeur des articles repris")}</td><td className="py-2 text-right font-bold tabular-nums">{fmt(montant)}</td></tr>
              {credit > 0 && <tr className="border-b border-[#F0F0F0]"><td className="py-2 text-[#666666]">{t("Déduit de ce que le client doit encore (vente à crédit)")}</td><td className="py-2 text-right tabular-nums">− {fmt(credit)}</td></tr>}
              {type === "echange" && panier && <tr className="border-b border-[#F0F0F0]"><td className="py-2 text-[#666666]">{t("Nouveaux articles")}</td><td className="py-2 text-right tabular-nums">{fmt(panier.total)}</td></tr>}
              <tr>
                <td className="py-2 font-bold">{t(type === "remboursement" ? "À rendre au client" : type === "avoir" ? "Montant de l'avoir" : resteAPayer > 0 ? "Complément à payer par le client" : "Avoir restant pour le client")}</td>
                <td className="py-2 text-right text-[16px] font-bold tabular-nums">{fmt(type === "echange" ? (resteAPayer > 0 ? resteAPayer : avoirRestant) : aRendre)}</td>
              </tr>
            </tbody>
          </table>

          {type === "echange" && resteAPayer > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Champ label="Complément payé en">
                {(a) => <select {...a} className={CLASSE_SAISIE} value={complement.mode} onChange={(e) => setComplement((c) => ({ ...c, mode: e.target.value }))}>{modesComplement.map((m) => <option key={m.id} value={m.id}>{t(m.libelle)}{m.statut === "declaratif" ? ` — ${t("Non vérifié")}` : ""}</option>)}</select>}
              </Champ>
              {complement.mode === "especes"
                ? <Saisie label="Espèces remises" inputMode="decimal" placeholder={String(resteAPayer)} value={complement.montant} onChange={(e) => setComplement((c) => ({ ...c, montant: e.target.value }))} aide={lireMontant(complement.montant) > resteAPayer ? t("Monnaie à rendre : {0}", fmt(lireMontant(complement.montant) - resteAPayer)) : undefined} />
                : <Saisie label="Référence de la transaction" value={complement.reference} onChange={(e) => setComplement((c) => ({ ...c, reference: e.target.value }))} />}
            </div>
          )}

          {erreur && <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12.5px] leading-relaxed text-[#B91C1C]">{t(erreur.message)}</p>}
          <div className="flex justify-end">
            <Bouton taille="grand" onClick={() => void valider()} charge={envoi} disabled={!demandes.length} icone={<RotateCcw size={18} aria-hidden />}>{t("Valider le retour")}</Bouton>
          </div>
        </div>
      </Carte>
    </>
  );
}

/** Articles que le client emporte en échange : recherche au catalogue, quantité, total recalculé par le serveur. */
function Echange({ caisseId, clientId, lignes, setLignes, onPanier }: {
  caisseId: string | null; clientId: string | null; lignes: LigneEchange[]; setLignes: (f: (l: LigneEchange[]) => LigneEchange[]) => void; onPanier: (p: { total: number } | null) => void;
}) {
  const t = useT();
  const { fmt } = useDevise();
  const [saisie, setSaisie] = useState("");
  const [q, setQ] = useState("");
  const articles = useLecture<{ articles: ArticleResolu[] }>(q ? `/api/pos/articles?q=${encodeURIComponent(q)}&limite=8` : null, caisseId);
  const [calcul, setCalcul] = useState<{ total: number } | null>(null);
  const [erreur, setErreur] = useState<ErreurAppel | null>(null);

  // Total de la nouvelle vente : calculé par le serveur (prix, promotions, taxes), jamais ici.
  const corps = JSON.stringify(lignes.map((l) => ({ produitId: l.article.produitId, varianteId: l.varianteId, quantite: l.quantite, ...(l.numeroSerie.trim() ? { numeroSerie: l.numeroSerie.trim() } : {}) })));
  useEffect(() => {
    if (corps === "[]") { setCalcul(null); setErreur(null); onPanier(null); return; }
    const abandon = new AbortController();
    void appelPos<{ panier: PanierCalcule }>("/api/pos/ventes/calculer", { method: "POST", caisseId, corps: { lignes: JSON.parse(corps), clientId }, signal: abandon.signal }).then((r) => {
      if (abandon.signal.aborted) return;
      if (r.ok) { setCalcul({ total: r.donnees.panier.total }); setErreur(null); onPanier({ total: r.donnees.panier.total }); }
      else if (r.code !== "annule") { setCalcul(null); setErreur({ code: r.code, message: r.message }); onPanier(null); }
    });
    return () => abandon.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corps, caisseId, clientId]);

  const ajouter = (a: ArticleResolu) => {
    const varianteId = a.varianteId ?? (a.variantes.length ? a.variantes[0].id : null);
    setLignes((l) => [...l, { cle: nouvelleCle(), article: a, varianteId, quantite: a.uniteVente === "kg" ? 1000 : 1, numeroSerie: a.numeroSerie ?? "" }]);
    setSaisie(""); setQ("");
  };
  const modifier = (cle: string, modif: Partial<LigneEchange>) => setLignes((l) => l.map((x) => (x.cle === cle ? { ...x, ...modif } : x)));

  return (
    <div className="space-y-3 rounded-xl border border-[#E8E8E8] p-3">
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setQ(saisie.trim()); }}>
        <Saisie label="Article emporté en échange" value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder={t("Nom, référence ou code-barres")} className="min-w-0 flex-1" />
        <Bouton type="submit" variante="secondaire" icone={<Search size={15} aria-hidden />} charge={articles.charge}>{t("Chercher")}</Bouton>
      </form>
      {q && articles.erreur && <EtatPos code={articles.erreur.code} message={articles.erreur.message} compact />}
      {q && articles.donnees && (articles.donnees.articles.length === 0 ? <p className="text-[12px] text-[#888888]">{t("Aucun article trouvé.")}</p> : (
        <ul className="divide-y divide-[#F0F0F0]">
          {articles.donnees.articles.map((a) => (
            <li key={`${a.produitId}:${a.varianteId ?? ""}`}>
              <button type="button" onClick={() => ajouter(a)} className="flex min-h-11 w-full items-center gap-3 px-1 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#111111]">
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{a.nom}</span>
                <span className="text-[11px] text-[#888888]">{t("Stock")} : {a.stockMagasin ?? a.stock}</span>
                <span className="w-24 text-right text-[13px] font-bold tabular-nums">{fmt(a.prix)}{a.uniteVente === "kg" ? "/kg" : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      ))}

      {lignes.length > 0 && (
        <ul className="divide-y divide-[#F0F0F0] border-t border-[#F0F0F0]">
          {lignes.map((l) => (
            <li key={l.cle} className="flex flex-wrap items-end gap-2 py-2">
              <p className="min-w-0 flex-1 basis-40 self-center truncate text-[13px] font-semibold">{l.article.nom}</p>
              {l.article.variantes.length > 0 && (
                <Champ label="Variante" labelMasque className="w-40">
                  {(a) => <select {...a} className={CLASSE_SAISIE} value={l.varianteId ?? ""} onChange={(e) => modifier(l.cle, { varianteId: e.target.value })}>{l.article.variantes.map((v) => <option key={v.id} value={v.id}>{v.nom} : {v.valeur}</option>)}</select>}
                </Champ>
              )}
              {l.article.suiviSerie
                ? <Saisie label="Numéro de série" labelMasque placeholder={t("Numéro de série")} value={l.numeroSerie} onChange={(e) => modifier(l.cle, { numeroSerie: e.target.value })} className="w-44" />
                : <Saisie label={l.article.uniteVente === "kg" ? "Poids (g)" : "Quantité"} labelMasque inputMode="numeric" suffixe={l.article.uniteVente === "kg" ? "g" : "×"} value={String(l.quantite)} onChange={(e) => modifier(l.cle, { quantite: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })} className="w-28" />}
              <BoutonIcone label={t("Retirer {0}", l.article.nom)} variante="danger" onClick={() => setLignes((x) => x.filter((y) => y.cle !== l.cle))}><Trash2 size={16} aria-hidden /></BoutonIcone>
            </li>
          ))}
        </ul>
      )}
      {erreur && <p role="alert" className="text-[12.5px] leading-relaxed text-[#B91C1C]">{t(erreur.message)}</p>}
      {calcul && <p className="text-right text-[12.5px] text-[#666666]">{t("Total des nouveaux articles")} : <strong className="text-[#111111]">{fmt(calcul.total)}</strong></p>}
    </div>
  );
}

function Resultat({ fait, onNouveau }: { fait: { retour: ResultatEchange; message: string }; onNouveau: () => void }) {
  const t = useT();
  const { fmt } = useDevise();
  const r = fait.retour;
  const bon = useRef<HTMLDivElement>(null);
  return (
    <Carte>
      <div className="space-y-4" role="status">
        <div>
          <Badge ton="positif">{t(r.rejoue ? "Déjà enregistré — aucun doublon" : "Retour enregistré")}</Badge>
          <p className="mt-2 text-[13.5px] leading-relaxed">{t(fait.message)}</p>
        </div>
        {r.remboursements.length > 0 && (
          <ul className="divide-y divide-[#F0F0F0]">
            {r.remboursements.map((p) => (
              <li key={p.mode} className="flex items-center gap-3 py-2 text-[13px]">
                <span className="flex-1 font-semibold">{t("À rendre en")} {t(p.libelle).toLowerCase()}</span>
                {p.nonVerifie && <BadgePaiement statut="declaratif" />}
                <span className="font-bold tabular-nums">{fmt(p.montant)}</span>
              </li>
            ))}
          </ul>
        )}
        {r.avoir && (
          <div className="rounded-xl border border-[#FDE68A] bg-[#FFF7ED] p-4">
            <div ref={bon}>
              <h2 className="text-[12px] font-bold uppercase tracking-wide text-[#B45309]">{t("Avoir client")}</h2>
              <p className="mt-1 font-mono text-[22px] font-bold tracking-wider">{r.avoir.code}</p>
              <p className="text-[13px]">{t("Montant")} : <strong>{fmt(r.avoir.montant)}</strong></p>
              <p className="text-[12px] text-[#666666]">{t("Émis le")} {new Date().toLocaleDateString(t.loc)} — {t("vente d'origine")} #{r.numero}. {t("À présenter en caisse pour payer avec cet avoir.")}</p>
            </div>
            <div className="mt-3"><Bouton variante="secondaire" taille="compact" icone={<Printer size={14} aria-hidden />} onClick={() => imprimerElement(bon.current, `${t("Avoir")} ${r.avoir!.code}`)}>{t("Imprimer l'avoir")}</Bouton></div>
          </div>
        )}
        {r.vente && <p className="text-[13px]">{t("Nouvelle vente enregistrée : #{0}, total {1}.", r.vente.numero, fmt(r.vente.total))}{r.vente.monnaie > 0 ? ` ${t("Monnaie à rendre : {0}", fmt(r.vente.monnaie))}.` : ""}</p>}
        {r.erreurVente && (
          <p role="alert" className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2 text-[12.5px] leading-relaxed text-[#B45309]">
            {t("Le retour est fait, mais la nouvelle vente n'a pas été enregistrée :")} {t(r.erreurVente.message)} {t("Le client garde son avoir : utilisez-le comme moyen de paiement à la caisse.")}
          </p>
        )}
        {r.pointsRepris > 0 && <p className="text-[12px] text-[#666666]">{t("Points de fidélité repris : {0}.", r.pointsRepris)}</p>}
        <div className="flex justify-end"><Bouton onClick={onNouveau}>{t("Nouveau retour")}</Bouton></div>
      </div>
    </Carte>
  );
}

function HistoriqueRetours({ caisseId }: { caisseId: string | null }) {
  const t = useT();
  const { fmt } = useDevise();
  const h = useLecture<Historique>("/api/pos/retours?limite=50", caisseId);
  if (h.erreur) return <EtatPos code={h.erreur.code} message={h.erreur.message} onReessayer={() => void h.recharger()} />;
  if (!h.donnees) return <EtatChargement />;
  if (!h.donnees.retours.length) return <EtatVide titre="Aucun retour enregistré en caisse" />;
  return (
    <Carte>
      <ul className="divide-y divide-[#F0F0F0]">
        {h.donnees.retours.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate text-[13px] font-semibold">#{r.numero} · {r.clientNom}</p>
              <p className="text-[11px] text-[#888888]">{new Date(r.createdAt).toLocaleString(t.loc, { dateStyle: "medium", timeStyle: "short" })} · {t(RAISONS.find(([v]) => v === r.raison)?.[1] ?? r.raison)}{r.sansRecu ? ` · ${t("sans reçu")}` : ""}</p>
            </div>
            <Badge ton="neutre">{t(LIBELLES_TYPE[r.type] ?? r.type)}</Badge>
            {r.avoir && <Badge ton={r.avoir.statut === "actif" && r.avoir.solde > 0 ? "accent" : "neutre"}>{r.avoir.code} · {t("solde")} {fmt(r.avoir.solde)}</Badge>}
            <span className="w-24 text-right text-[13px] font-bold tabular-nums">{fmt(r.montant)}</span>
          </li>
        ))}
      </ul>
    </Carte>
  );
}
