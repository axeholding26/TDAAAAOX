"use client";
// Écran « Transferts de stock » (§32) : demande, approbation, préparation au
// scan, expédition (le stock quitte la source : « en transit »), réception au
// scan (partielle possible, écarts signalés), clôture d'un manque, annulation.
// Les boutons affichés sont ceux que le serveur autorise (`actions`) : statut
// courant × droits de la personne.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Badge, Bouton, BoutonIcone, CLASSE_SAISIE, Champ, EtatChargement, EtatPos, EtatVide, FOCUS, Modale, Saisie, type Ton } from "@/components/pos/ui";
import type { ScanEmis } from "@/lib/pos/client/bus";
import { cn } from "@/lib/utils";
import { appelPos, Carte, ChoixArticle, EnTete, jour, nouvelleCle, Onglets, Page, PosteScan, qte, SelectLieu, useCaisse, useLecture, Vignette, type ArticleChoisi, type Lieu } from "./commun";

type Resume = { id: string; numero: string; statut: string; source: string; destination: string; createdAt: string; expedieAt: string | null; recuAt: string | null; lignes: number; demande: number; expedie: number; recu: number };
type Liste = { transferts: Resume[]; curseurSuivant: string | null; lieux: Lieu[]; lieuCourant: string; droits: { creer: boolean; approuver: boolean; recevoir: boolean } };
type Ligne = { id: string; nom: string; variante: string | null; sku: string | null; codeBarres: string | null; image: string | null; uniteVente: string; quantiteDemandee: number; quantiteExpediee: number; quantiteRecue: number; stockSource: number };
type Detail = {
  transfert: { id: string; numero: string; statut: string; notes: string | null; source: string; destination: string; demandePar: string | null; approuvePar: string | null; createdAt: string; expedieAt: string | null; recuAt: string | null };
  lignes: Ligne[]; actions: string[];
};
type Resultat = { statut: string; numero: string; ecarts: { nom: string; expedie: number; recu: number }[] };

const STATUTS: Record<string, { libelle: string; ton: Ton }> = {
  brouillon: { libelle: "Brouillon", ton: "neutre" }, demande: { libelle: "Demandé", ton: "info" }, approuve: { libelle: "Approuvé", ton: "info" },
  en_preparation: { libelle: "En préparation", ton: "accent" }, expedie: { libelle: "Expédié — en transit", ton: "attention" },
  partiellement_recu: { libelle: "Partiellement reçu", ton: "attention" }, recu: { libelle: "Reçu", ton: "positif" }, annule: { libelle: "Annulé", ton: "neutre" },
};
const FAIT: Record<string, string> = {
  demander: "Demande envoyée.", approuver: "Transfert approuvé.", preparer: "Préparation commencée.", expedier: "Transfert expédié : le stock a quitté le lieu de départ.",
  recevoir: "Réception enregistrée : le stock est entré dans le lieu d'arrivée.", cloturer: "Transfert clôturé.", annuler: "Transfert annulé. Aucun stock n'a bougé.",
};

function Nouveau({ liste, caisseId, onCree, onFermer }: { liste: Liste; caisseId: string | null; onCree: (id: string) => void; onFermer: () => void }) {
  const t = useT();
  const actifs = liste.lieux.filter((l) => l.actif);
  const [source, setSource] = useState(liste.lieuCourant);
  const [destination, setDestination] = useState(actifs.find((l) => l.id !== liste.lieuCourant)?.id ?? "");
  const [lignes, setLignes] = useState<(ArticleChoisi & { quantite: string })[]>([]);
  const [notes, setNotes] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const cle = useRef(nouvelleCle());

  const creer = async (demander: boolean) => {
    const corps = lignes.map((l) => {
      const n = Number(l.quantite.replace(",", "."));
      return { produitId: l.produitId, varianteId: l.varianteId, quantite: l.uniteVente === "kg" ? Math.round(n * 1000) : n };
    });
    if (!source || !destination || source === destination) { setErreur("Choisissez un lieu de départ et un lieu d'arrivée différents."); return; }
    if (!corps.length) { setErreur("Ajoutez au moins un article au transfert."); return; }
    if (corps.some((l) => !Number.isInteger(l.quantite) || l.quantite < 1)) { setErreur("Indiquez une quantité entière pour chaque article."); return; }
    setEnvoi(true); setErreur(null);
    const r = await appelPos<{ transfertId: string; numero: string }>("/api/pos/transferts", { method: "POST", caisseId, corps: { cle: cle.current, entrepotSourceId: source, entrepotDestinationId: destination, lignes: corps, notes: notes.trim() || null, demander } });
    setEnvoi(false);
    if (!r.ok) { setErreur(r.message); return; }
    toast.success(t(demander ? "Transfert {0} demandé." : "Transfert {0} enregistré en brouillon.", r.donnees.numero));
    onCree(r.donnees.transfertId);
  };

  return (
    <Modale ouverte onFermer={onFermer} titre="Nouveau transfert" description="Rien ne bouge dans le stock avant l'expédition." taille="lg" verrouillee={envoi}
      actions={<><Bouton variante="secondaire" onClick={() => creer(false)} disabled={envoi}>{t("Enregistrer le brouillon")}</Bouton><Bouton onClick={() => creer(true)} charge={envoi}>{t("Demander le transfert")}</Bouton></>}>
      {actifs.length < 2 ? <EtatVide titre="Un seul lieu de stock" texte="Un transfert se fait entre deux entrepôts ou magasins. Créez un second magasin ou un second entrepôt pour transférer du stock." compact /> : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SelectLieu label="Départ" lieux={liste.lieux} valeur={source} onChange={setSource} />
            <SelectLieu label="Arrivée" lieux={liste.lieux} valeur={destination} onChange={setDestination} exclure={source} tous="Choisir…" />
          </div>
          <ChoixArticle caisseId={caisseId} onChoisir={(a) => setLignes((l) => (l.some((x) => x.produitId === a.produitId && x.varianteId === a.varianteId) ? l : [...l, { ...a, quantite: a.uniteVente === "kg" ? "" : "1" }]))} />
          {lignes.length > 0 && (
            <ul className="divide-y divide-[#F0F0F0] rounded-xl border border-[#E8E8E8]">
              {lignes.map((l, i) => (
                <li key={`${l.produitId}:${l.varianteId ?? ""}`} className="flex items-center gap-2 p-2">
                  <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#111111]">{l.nom}{l.variante ? ` — ${l.variante}` : ""}<span className="block text-[11px] font-normal text-[#888888]">{t("Stock total : {0}", qte(l.stock, l.uniteVente, t.loc))}</span></p>
                  <Saisie label={t("Quantité de {0}", l.nom)} labelMasque inputMode="decimal" value={l.quantite} suffixe={l.uniteVente === "kg" ? "kg" : undefined} className="w-28"
                    onChange={(e) => setLignes((ls) => ls.map((x, j) => (j === i ? { ...x, quantite: e.target.value } : x)))} />
                  <BoutonIcone label={t("Retirer {0}", l.nom)} onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}><Trash2 size={16} aria-hidden /></BoutonIcone>
                </li>
              ))}
            </ul>
          )}
          <Saisie label="Note (facultatif)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          {erreur && <p role="alert" className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">{t(erreur)}</p>}
        </div>
      )}
    </Modale>
  );
}

function Fiche({ id, caisseId, onRetour }: { id: string; caisseId: string | null; onRetour: () => void }) {
  const t = useT();
  const { donnees, erreur, recharger } = useLecture<Detail>(`/api/pos/transferts/${id}`, caisseId);
  // Réception en cours de saisie : quantités reçues MAINTENANT, par ligne (envoyées d'un coup à la validation).
  const [recu, setRecu] = useState<Record<string, number>>({});
  const [alerte, setAlerte] = useState<string | null>(null);
  const [confirme, setConfirme] = useState<"annuler" | "cloturer" | "expedier_tout" | null>(null);
  const [motif, setMotif] = useState("");
  const [sort, setSort] = useState("perte");
  const [envoi, setEnvoi] = useState<string | null>(null);
  const cle = useRef(nouvelleCle());
  const file = useRef<Promise<void>>(Promise.resolve());
  // Copie lisible tout de suite par les scans, qui arrivent plus vite que les rendus.
  const recuRef = useRef(recu);
  useEffect(() => { recuRef.current = recu; }, [recu]);
  useEffect(() => { setRecu({}); }, [donnees?.transfert.statut]);

  const agir = async (action: string, plus: Record<string, unknown> = {}): Promise<boolean> => {
    setEnvoi(action);
    const r = await appelPos<Resultat>(`/api/pos/transferts/${id}`, { method: "PATCH", caisseId, corps: { cle: cle.current, action, ...plus } });
    setEnvoi(null);
    if (!r.ok) { if (action === "preparation") setAlerte(r.message); else toast.error(t(r.message)); if (r.code === "conflit") void recharger(); return false; }
    cle.current = nouvelleCle();
    if (action !== "preparation") {
      toast.success(t(action === "recevoir" && r.donnees.statut === "partiellement_recu" ? "Réception partielle enregistrée : le reste est encore attendu." : FAIT[action] ?? "Enregistré."));
      setConfirme(null); setMotif("");
    }
    setAlerte(null);
    await recharger();
    return true;
  };

  if (erreur && !donnees) return <Page><EtatPos code={erreur.code} message={erreur.message} onReessayer={recharger} /><Bouton variante="secondaire" onClick={onRetour}>{t("Retour aux transferts")}</Bouton></Page>;
  if (!donnees) return <Page><EtatChargement texte="Chargement du transfert…" /></Page>;
  const { transfert: tr, lignes, actions } = donnees;
  const prepare = actions.includes("preparation");
  const recoit = actions.includes("recevoir");
  const reste = (l: Ligne) => l.quantiteExpediee - l.quantiteRecue;

  const fixer = (l: Ligne, valeur: number) => {
    if (prepare) {
      if (valeur > l.quantiteDemandee) { setAlerte(`« ${l.nom} » : on ne prépare pas plus que la quantité demandée (${l.quantiteDemandee}).`); return; }
      file.current = file.current.then(async () => { await agir("preparation", { lignes: [{ ligneId: l.id, quantite: Math.max(0, valeur) }] }); });
    } else if (recoit) {
      if (valeur > reste(l)) { setAlerte(`« ${l.nom} » : il n'en reste que ${reste(l)} à recevoir. Un surplus se corrige par un ajustement de stock.`); return; }
      setAlerte(null); setRecu((x) => ({ ...x, [l.id]: Math.max(0, valeur) }));
    }
  };
  const surScan = (s: ScanEmis) => {
    file.current = file.current.then(async () => {
      const r = await appelPos<{ ligneId: string; quantite: number }>(`/api/pos/transferts/${id}?code=${encodeURIComponent(s.code)}`, { caisseId });
      if (!r.ok) { setAlerte(r.message); return; }
      const l = lignes.find((x) => x.id === r.donnees.ligneId);
      if (!l) { void recharger(); return; }
      if (prepare) {
        // La quantité préparée fait foi côté serveur : on relit avant d'ajouter (deux préparateurs, deux scans rapprochés).
        const frais = await appelPos<Detail>(`/api/pos/transferts/${id}`, { caisseId });
        const courant = frais.ok ? frais.donnees.lignes.find((x) => x.id === l.id)?.quantiteExpediee ?? l.quantiteExpediee : l.quantiteExpediee;
        if (courant + r.donnees.quantite > l.quantiteDemandee) { setAlerte(`« ${l.nom} » : la quantité demandée (${l.quantiteDemandee}) est déjà préparée.`); return; }
        await agir("preparation", { lignes: [{ ligneId: l.id, quantite: courant + r.donnees.quantite }] });
      } else {
        const suivant = (recuRef.current[l.id] ?? 0) + r.donnees.quantite;
        if (suivant > reste(l)) { setAlerte(`« ${l.nom} » : tout ce qui a été expédié est déjà scanné.`); return; }
        recuRef.current = { ...recuRef.current, [l.id]: suivant };
        setAlerte(null); setRecu(recuRef.current);
      }
    });
  };
  const totalRecu = Object.values(recu).reduce((s, n) => s + n, 0);
  const ecarts = ["partiellement_recu", "recu"].includes(tr.statut) ? lignes.filter((l) => l.quantiteRecue < l.quantiteExpediee) : [];

  return (
    <Page>
      <button type="button" onClick={onRetour} className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-xl text-[12.5px] font-semibold text-[#666666] hover:text-[#111111]", FOCUS)}><ArrowLeft size={15} aria-hidden />{t("Tous les transferts")}</button>
      <EnTete titre={`${t("Transfert")} ${tr.numero}`} sousTitre={[`${t("demandé le {0}", jour(tr.createdAt, t.loc, true))}${tr.demandePar ? ` ${t("par")} ${tr.demandePar}` : ""}`, tr.approuvePar && `${t("approuvé par")} ${tr.approuvePar}`, tr.expedieAt && t("expédié le {0}", jour(tr.expedieAt, t.loc, true)), tr.recuAt && t("clos le {0}", jour(tr.recuAt, t.loc, true))].filter(Boolean).join(" · ")}>
        <Badge ton={STATUTS[tr.statut]?.ton ?? "neutre"}>{t(STATUTS[tr.statut]?.libelle ?? tr.statut)}</Badge>
      </EnTete>
      <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-[#111111]">{tr.source}<ArrowRight size={16} aria-label={t("vers")} />{tr.destination}</p>
      {tr.notes && <p className="text-[12.5px] text-[#666666]">{tr.notes}</p>}

      {(prepare || recoit) && (
        <Carte titre={prepare ? "Préparer l'expédition" : "Réceptionner"} actions={<PosteScan contexte="transfert" caisseId={caisseId} onScan={surScan} />}>
          <p className="text-[12px] text-[#666666]">{t(prepare ? "Scannez chaque article mis dans le colis : la quantité préparée monte d'une unité. Vous pouvez aussi la saisir dans le tableau." : "Scannez chaque article reçu, ou saisissez les quantités. Rien n'entre en stock avant « Valider la réception ».")}</p>
          {alerte && <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]"><AlertTriangle size={15} className="mt-0.5 flex-shrink-0" aria-hidden />{t(alerte)}</p>}
        </Carte>
      )}

      {ecarts.length > 0 && (
        <div role="status" className="rounded-2xl border border-[#FCD34D] bg-[#FFFBEB] p-3 text-[12.5px] text-[#92400E]">
          <p className="flex items-center gap-1.5 font-bold"><AlertTriangle size={15} aria-hidden />{t("Écart entre l'expédié et le reçu")}</p>
          <ul className="mt-1 list-inside list-disc">{ecarts.map((l) => <li key={l.id}>{l.nom}{l.variante ? ` — ${l.variante}` : ""} : {t("{0} expédié(s), {1} reçu(s)", qte(l.quantiteExpediee, l.uniteVente, t.loc), qte(l.quantiteRecue, l.uniteVente, t.loc))}</li>)}</ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[#E8E8E8] bg-white">
        <table className="w-full min-w-[560px] text-left text-[12.5px]">
          <caption className="sr-only">{t("Articles du transfert")}</caption>
          <thead><tr className="border-b border-[#F0F0F0] text-[10.5px] uppercase tracking-wide text-[#666666]">
            <th scope="col" className="px-3 py-2 font-semibold">{t("Article")}</th>
            {["Demandé", prepare ? "Préparé" : "Expédié", "Reçu", ...(recoit ? ["Reçu maintenant"] : []), ...(["brouillon", "demande", "approuve", "en_preparation"].includes(tr.statut) ? ["Stock au départ"] : [])].map((c) => <th key={c} scope="col" className="px-3 py-2 text-right font-semibold">{t(c)}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-[#F0F0F0]">
            {lignes.map((l) => {
              const champ = (valeur: number, max: number) => (
                <input type="number" inputMode="numeric" min={0} max={max} value={valeur} aria-label={t("Quantité de {0}", l.nom)}
                  onChange={(e) => fixer(l, Math.floor(Number(e.target.value) || 0))} className={cn(CLASSE_SAISIE, "ml-auto w-24 text-right tabular-nums")} />
              );
              return (
                <tr key={l.id}>
                  <th scope="row" className="px-3 py-2 font-normal">
                    <span className="flex items-center gap-2"><Vignette src={l.image} taille={32} />
                      <span className="min-w-0"><span className="block truncate font-semibold text-[#111111]">{l.nom}{l.variante ? ` — ${l.variante}` : ""}</span><span className="block truncate text-[11px] text-[#888888]">{[l.sku, l.codeBarres, l.uniteVente === "kg" && t("quantités en grammes")].filter(Boolean).join(" · ")}</span></span>
                    </span>
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{l.quantiteDemandee.toLocaleString(t.loc)}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">{prepare ? champ(l.quantiteExpediee, l.quantiteDemandee) : l.quantiteExpediee.toLocaleString(t.loc)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.quantiteRecue.toLocaleString(t.loc)}</td>
                  {recoit && <td className="px-3 py-2 text-right">{reste(l) > 0 ? champ(recu[l.id] ?? 0, reste(l)) : <span className="text-[#15803D]">{t("complet")}</span>}</td>}
                  {["brouillon", "demande", "approuve", "en_preparation"].includes(tr.statut) && <td className={cn("px-3 py-2 text-right tabular-nums", l.stockSource < l.quantiteDemandee ? "font-bold text-[#B91C1C]" : "text-[#555555]")}>{l.stockSource.toLocaleString(t.loc)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {actions.length > 0 ? (
        <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-2 border-t border-[#E8E8E8] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
          {actions.includes("annuler") && <Bouton variante="danger" onClick={() => setConfirme("annuler")}>{t("Annuler le transfert")}</Bouton>}
          {actions.includes("demander") && <Bouton onClick={() => agir("demander")} charge={envoi === "demander"}>{t("Demander le transfert")}</Bouton>}
          {actions.includes("approuver") && <Bouton onClick={() => agir("approuver")} charge={envoi === "approuver"}>{t("Approuver")}</Bouton>}
          {actions.includes("preparer") && <Bouton onClick={() => agir("preparer")} charge={envoi === "preparer"}>{t("Commencer la préparation")}</Bouton>}
          {actions.includes("expedier") && <Bouton variante="secondaire" onClick={() => setConfirme("expedier_tout")}>{t("Tout expédier comme demandé")}</Bouton>}
          {actions.includes("expedier") && <Bouton onClick={() => agir("expedier")} charge={envoi === "expedier"} disabled={!lignes.some((l) => l.quantiteExpediee > 0)}>{t("Expédier ce qui est préparé")}</Bouton>}
          {actions.includes("cloturer") && tr.statut === "partiellement_recu" && <Bouton variante="secondaire" onClick={() => setConfirme("cloturer")}>{t("Clôturer avec l'écart")}</Bouton>}
          {recoit && <Bouton onClick={() => agir("recevoir", { lignes: Object.entries(recu).filter(([, q]) => q > 0).map(([ligneId, quantite]) => ({ ligneId, quantite })) })} charge={envoi === "recevoir"} disabled={!totalRecu}>{t("Valider la réception ({0})", totalRecu)}</Bouton>}
        </div>
      ) : !["recu", "annule"].includes(tr.statut) && <p className="text-[12.5px] text-[#666666]">{t("La prochaine étape de ce transfert revient à une personne qui en a le droit.")}</p>}

      {confirme && (
        <Modale ouverte onFermer={() => setConfirme(null)} taille="sm" verrouillee={!!envoi}
          titre={confirme === "annuler" ? "Annuler ce transfert ?" : confirme === "cloturer" ? "Clôturer avec un écart" : "Tout expédier comme demandé ?"}
          description={confirme === "annuler" ? "Aucun stock n'a encore bougé : l'annulation ne change rien au stock." : confirme === "cloturer" ? "Ce qui a été expédié mais jamais reçu ne sera plus attendu. Dites ce que devient ce manque." : "Les quantités demandées quittent le stock du lieu de départ, sans préparation ligne à ligne."}
          actions={<><Bouton variante="secondaire" onClick={() => setConfirme(null)} disabled={!!envoi}>{t("Retour")}</Bouton>
            <Bouton variante={confirme === "annuler" ? "danger" : "primaire"} charge={!!envoi}
              onClick={() => (confirme === "expedier_tout" ? agir("expedier", { tout: true }) : agir(confirme, { motif: motif.trim() || null, ...(confirme === "cloturer" ? { sort } : {}) }))}>
              {t(confirme === "annuler" ? "Annuler le transfert" : confirme === "cloturer" ? "Clôturer" : "Expédier")}
            </Bouton></>}>
          {confirme === "cloturer" && (
            <Champ label="Le manque" className="mb-3">
              {(a) => <select {...a} value={sort} onChange={(e) => setSort(e.target.value)} className={CLASSE_SAISIE}><option value="perte">{t("est perdu en route (il sort du stock)")}</option><option value="retour_source">{t("est resté au départ (il retourne dans son stock)")}</option></select>}
            </Champ>
          )}
          {confirme !== "expedier_tout" && <Saisie label={confirme === "cloturer" ? "Motif" : "Motif (facultatif)"} value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} />}
        </Modale>
      )}
    </Page>
  );
}

export function EcranTransferts() {
  const t = useT();
  const [caisseId] = useCaisse();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState(false);
  const [filtre, setFiltre] = useState<"en_cours" | "all">("en_cours");
  const { donnees, erreur, charge, recharger } = useLecture<Liste>(ouvert ? null : `/api/pos/transferts?statut=${filtre}&limite=30`, caisseId);

  if (ouvert) return <Fiche id={ouvert} caisseId={caisseId} onRetour={() => setOuvert(null)} />;
  return (
    <Page>
      <EnTete titre="Transferts de stock" sousTitre="Déplacez du stock d'un magasin ou d'un entrepôt à un autre : demande, approbation, préparation, expédition, réception.">
        {donnees?.droits.creer && <Bouton onClick={() => setNouveau(true)} icone={<Plus size={15} aria-hidden />}>{t("Nouveau transfert")}</Bouton>}
      </EnTete>
      <Onglets label="Transferts affichés" actif={filtre} onChange={setFiltre} onglets={[{ id: "en_cours", libelle: "En cours" }, { id: "all", libelle: "Tous" }]} />
      {erreur ? <EtatPos code={erreur.code} message={erreur.message} onReessayer={recharger} />
        : !donnees ? <EtatChargement texte="Chargement des transferts…" />
        : !donnees.transferts.length ? <EtatVide titre="Aucun transfert" texte={filtre === "en_cours" ? "Aucun transfert n'est en cours." : "Aucun transfert n'a encore été créé."} />
        : (
          <ul className={cn("space-y-2", charge && "opacity-60")}>
            {donnees.transferts.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => setOuvert(x.id)} className={cn("flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E8E8E8] bg-white p-4 text-left hover:border-[#F5A623]", FOCUS)}>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-bold text-[#111111]">{x.numero} · {x.source} → {x.destination}</span>
                    <span className="block text-[11.5px] text-[#666666]">{jour(x.createdAt, t.loc)} · {t("{0} article(s)", x.lignes)} · {t("demandé {0}, expédié {1}, reçu {2}", x.demande, x.expedie, x.recu)}</span>
                  </span>
                  <Badge ton={STATUTS[x.statut]?.ton ?? "neutre"}>{t(STATUTS[x.statut]?.libelle ?? x.statut)}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      {nouveau && donnees && <Nouveau liste={donnees} caisseId={caisseId} onFermer={() => setNouveau(false)} onCree={(id) => { setNouveau(false); setOuvert(id); }} />}
    </Page>
  );
}
