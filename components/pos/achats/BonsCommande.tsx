"use client";
// Bons de commande fournisseur : liste, création et modification d'un
// brouillon, fiche d'un bon (document imprimable, texte prêt à envoyer,
// gestes de statut). Données : /api/pos/achats.
//
// Envoi : AXSO n'envoie un bon que par e-mail, et seulement si le fournisseur
// a une adresse et que le service est configuré. « Copier », « WhatsApp » et
// « Ouvrir ma messagerie » préparent le message : c'est le marchand qui
// l'envoie, puis qui marque le bon comme envoyé.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Mail, MessageCircle, PackageCheck, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { appelPos, nouvelleCle } from "@/components/pos/crm/appel";
import { Carte, imprimerElement, lireMontant, useLecture } from "@/components/pos/finance/commun";
import { Badge, Bouton, BoutonIcone, CLASSE_SAISIE, Champ, EtatChargement, EtatPos, EtatVide, FOCUS, Modale, Saisie, Tiroir, type Ton } from "@/components/pos/ui";
import { libelleQuantite, montantBrut } from "@/lib/pos/tarification";
import type { UniteVente } from "@/lib/pos/types";
import type { BonVue } from "@/lib/pos/achats/bons";
import { ACTIONS_BON, LIBELLES_STATUT_BON, STATUTS_BON, STATUTS_RECEVABLES, type ActionBon, type StatutBon } from "@/lib/pos/achats/regles";
import { RechercheArticle } from "./RechercheArticle";

type Liste = {
  bons: BonVue[]; curseurSuivant: string | null; entrepotId: string;
  fournisseurs: { id: string; nom: string; email: string | null; telephone: string | null }[];
  entrepots: { id: string; nom: string }[];
  droits: { creer: boolean; valider: boolean; recevoir: boolean };
};
type Fiche = { bon: BonVue; texte: string; emailPossible: boolean };
type LigneEdition = { produitId: string; varianteId: string | null; nom: string; variante: string | null; uniteVente: string; quantite: string; prix: string };

const TONS_STATUT: Record<StatutBon, Ton> = { brouillon: "neutre", envoye: "info", confirme: "accent", partiellement_recu: "attention", recu: "positif", annule: "danger" };
const SOURCES: Record<string, string> = { manuel: "Saisi à la main", reappro: "Préparé par le réapprovisionnement", axia: "Préparé par Axia" };
const qte = (n: number, unite: string) => libelleQuantite(n, unite as UniteVente);
const unite = (u: string): UniteVente => (u === "kg" ? "kg" : "piece");
// Lien sortant (WhatsApp, messagerie) aux allures du bouton « secondaire » du kit.
const LIEN_EXTERNE = `inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E8E8E8] bg-white px-3 text-[12px] font-bold text-[#111111] hover:border-[#F5A623] ${FOCUS}`;

// ─── Éditeur d'un brouillon ──────────────────────────────────────────────────

function EditeurBon({ ouvert, bon, liste, onFermer, onEnregistre }: { ouvert: boolean; bon: BonVue | null; liste: Liste; onFermer: () => void; onEnregistre: (b: BonVue) => void }) {
  const t = useT();
  const { fmt } = useDevise();
  const [fournisseurId, setFournisseurId] = useState("");
  const [entrepotId, setEntrepotId] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lignes, setLignes] = useState<LigneEdition[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const cle = useRef(nouvelleCle());

  useEffect(() => {
    if (!ouvert) return;
    setErreur(null);
    setFournisseurId(bon?.fournisseur.id ?? "");
    setEntrepotId(bon?.entrepot?.id ?? liste.entrepotId);
    setDate(bon?.dateAttendue?.slice(0, 10) ?? "");
    setNotes(bon?.notes ?? "");
    setLignes(bon?.lignes.map((l) => ({ produitId: l.produitId, varianteId: l.varianteId, nom: l.nom, variante: l.variante, uniteVente: l.uniteVente, quantite: String(l.quantite), prix: String(l.prixUnitaire) })) ?? []);
  }, [ouvert, bon, liste.entrepotId]);

  const modifier = (i: number, c: Partial<LigneEdition>) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...c } : l)));
  const total = lignes.reduce((s, l) => s + (montantBrut(lireMontant(l.prix) || 0, Number(l.quantite) || 0, unite(l.uniteVente), 2) || 0), 0);

  async function enregistrer() {
    if (!fournisseurId) { setErreur("Choisissez un fournisseur."); return; }
    if (!lignes.length) { setErreur("Ajoutez au moins un produit au bon de commande."); return; }
    const propres = lignes.map((l) => ({ produitId: l.produitId, varianteId: l.varianteId, quantite: Number(l.quantite), prixUnitaire: l.prix.trim() === "" ? 0 : lireMontant(l.prix) }));
    if (propres.some((l) => !Number.isInteger(l.quantite) || l.quantite <= 0 || !(l.prixUnitaire >= 0))) { setErreur("Vérifiez les lignes : la quantité est un nombre entier supérieur à zéro, le prix un nombre positif."); return; }
    setErreur(null); setEnvoi(true);
    const corps = { fournisseurId, entrepotId: entrepotId || null, dateAttendue: date ? new Date(`${date}T12:00:00`).toISOString() : null, notes: notes.trim() || null, lignes: propres };
    const r = bon
      ? await appelPos<Fiche>(`/api/pos/achats/${bon.id}`, { method: "PATCH", corps })
      : await appelPos<Fiche>("/api/pos/achats", { corps, cle: cle.current });
    setEnvoi(false);
    if (!r.ok) { setErreur(r.message); return; }
    cle.current = nouvelleCle();
    toast.success(t(bon ? "Brouillon mis à jour" : "Bon de commande créé en brouillon"));
    onEnregistre(r.donnees.bon);
  }

  return (
    <Modale ouverte={ouvert} onFermer={onFermer} titre={bon ? `Modifier le bon ${bon.numero}` : "Nouveau bon de commande"} description="Le bon reste un brouillon tant que vous ne l'avez pas envoyé." taille="xl" verrouillee={envoi}
      actions={<><Bouton variante="secondaire" onClick={onFermer} disabled={envoi}>{t("Annuler")}</Bouton><Bouton charge={envoi} onClick={() => void enregistrer()}>{t("Enregistrer le brouillon")}</Bouton></>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Champ label="Fournisseur">
            {(a) => (
              <select {...a} className={CLASSE_SAISIE} value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)}>
                <option value="">{t("Choisir…")}</option>
                {liste.fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
              </select>
            )}
          </Champ>
          <Champ label="Livré à">
            {(a) => <select {...a} className={CLASSE_SAISIE} value={entrepotId} onChange={(e) => setEntrepotId(e.target.value)}>{liste.entrepots.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}</select>}
          </Champ>
          <Saisie label="Livraison souhaitée le" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {liste.fournisseurs.length === 0 && <p className="text-[12px] text-[#B45309]">{t("Aucun fournisseur actif. Créez-en un dans Sourcing, ou importez votre liste depuis Import / export.")}</p>}

        <RechercheArticle onChoisir={(a) => setLignes((ls) => (ls.some((l) => l.produitId === a.produitId && l.varianteId === a.varianteId)
          ? ls
          : [...ls, { produitId: a.produitId, varianteId: a.varianteId, nom: a.nom, variante: a.variante, uniteVente: a.uniteVente, quantite: a.uniteVente === "kg" ? "1000" : "1", prix: a.cout != null ? String(a.cout) : "" }]))} />

        {lignes.length > 0 && (
          <ul className="divide-y divide-[#F0F0F0] rounded-xl border border-[#E8E8E8]">
            {lignes.map((l, i) => (
              <li key={`${l.produitId}:${l.varianteId ?? ""}`} className="flex flex-wrap items-end gap-2 p-3">
                <p className="min-w-0 flex-1 basis-40 self-center text-[13px] font-semibold">{l.nom}{l.variante ? <span className="font-normal text-[#666666]"> · {l.variante}</span> : null}</p>
                <Saisie label={l.uniteVente === "kg" ? "Grammes" : "Quantité"} type="number" inputMode="numeric" min={1} step={1} className="w-28" value={l.quantite} onChange={(e) => modifier(i, { quantite: e.target.value })} />
                <Saisie label={l.uniteVente === "kg" ? "Prix d'achat au kilo" : "Prix d'achat"} inputMode="decimal" className="w-36" value={l.prix} placeholder={t("À confirmer")} onChange={(e) => modifier(i, { prix: e.target.value })} />
                <BoutonIcone label={t("Retirer {0}", l.nom)} variante="danger" onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}><Trash2 size={16} aria-hidden /></BoutonIcone>
              </li>
            ))}
          </ul>
        )}
        <Champ label="Note pour le fournisseur">{(a) => <textarea {...a} rows={2} maxLength={1000} className={CLASSE_SAISIE} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Champ>
        <p className="text-right text-[14px] font-bold tabular-nums">{t("Total")} : {fmt(total)}</p>
        {erreur && <p role="alert" className="text-[12.5px] font-semibold text-[#B91C1C]">{t(erreur)}</p>}
      </div>
    </Modale>
  );
}

// ─── Fiche d'un bon ──────────────────────────────────────────────────────────

function FicheBon({ id, droits, onChange, onModifier }: { id: string; droits: Liste["droits"]; onChange: () => void; onModifier: (b: BonVue) => void }) {
  const t = useT();
  const { fmt } = useDevise();
  const { donnees: d, erreur, recharger } = useLecture<Fiche>(`/api/pos/achats/${id}`);
  const [geste, setGeste] = useState<ActionBon | null>(null);
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [refus, setRefus] = useState<{ code: string; message: string } | null>(null);
  const feuille = useRef<HTMLDivElement>(null);
  const cle = useRef(nouvelleCle());

  if (erreur && !d) return <EtatPos code={erreur.code} message={erreur.message} onReessayer={() => void recharger()} compact />;
  if (!d) return <EtatChargement texte="Chargement du bon de commande…" compact />;
  const { bon, texte } = d;
  const gestes = (Object.keys(ACTIONS_BON) as ActionBon[]).filter((a) => (ACTIONS_BON[a].de as readonly string[]).includes(bon.statut) && (droits.valider || (a === "annuler" && bon.statut === "brouillon" && droits.creer)));
  const telephone = bon.fournisseur.telephone?.replace(/\D/g, "") ?? "";
  const jour = (iso: string) => new Date(iso).toLocaleDateString(t.loc, { day: "2-digit", month: "long", year: "numeric" });

  async function appliquer(action: ActionBon, raison?: string) {
    setEnvoi(action); setRefus(null);
    const r = await appelPos<Fiche>(`/api/pos/achats/${id}`, { method: "PATCH", corps: { action, motif: raison || null }, cle: cle.current });
    setEnvoi(null);
    if (!r.ok) { setRefus({ code: r.code, message: r.message }); return; }
    cle.current = nouvelleCle();
    setGeste(null); setMotif("");
    toast.success(t("Bon {0} : {1}", bon.numero, t(LIBELLES_STATUT_BON[r.donnees.bon.statut]).toLowerCase()));
    void recharger(); onChange();
  }
  async function envoyerEmail() {
    setEnvoi("email"); setRefus(null);
    const r = await appelPos<{ envoyeA: string }>(`/api/pos/achats/${id}/email`, { corps: {}, cle: cle.current });
    setEnvoi(null);
    if (!r.ok) { setRefus({ code: r.code, message: r.message }); return; }
    cle.current = nouvelleCle();
    toast.success(t("Bon envoyé par e-mail à {0}", r.donnees.envoyeA));
    void recharger(); onChange();
  }
  async function copier() {
    try { await navigator.clipboard.writeText(texte); toast.success(t("Texte du bon copié")); }
    catch { toast.error(t("La copie a échoué. Sélectionnez le texte ci-dessous puis copiez-le.")); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge ton={TONS_STATUT[bon.statut]}>{t(LIBELLES_STATUT_BON[bon.statut])}</Badge>
        <span className="text-[12px] text-[#888888]">{t(SOURCES[bon.source] ?? bon.source)}</span>
      </div>
      {refus && (refus.code === "transition_refusee" || refus.code === "conflit"
        ? <EtatPos code="conflit" message={refus.message} onReessayer={() => { setRefus(null); void recharger(); onChange(); }} compact />
        : <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-[12.5px] text-[#B91C1C]">{t(refus.message)}</p>)}

      {/* Document imprimable : balisage simple, repris tel quel par imprimerElement. */}
      <div ref={feuille} className="rounded-2xl border border-[#E8E8E8] bg-white p-4 text-[12.5px]">
        <h2 className="text-[16px] font-bold">{t("Bon de commande")} {bon.numero}</h2>
        <p>{t("Fournisseur")} : {bon.fournisseur.nom}</p>
        <p>{t("Date")} : {jour(bon.createdAt)}{bon.dateAttendue ? ` · ${t("Livraison souhaitée le")} ${jour(bon.dateAttendue)}` : ""}</p>
        {bon.entrepot && <p>{t("Livré à")} : {[bon.entrepot.nom, bon.entrepot.adresse, bon.entrepot.ville].filter(Boolean).join(", ")}</p>}
        <table className="mt-3 w-full border-collapse">
          <thead><tr className="border-b border-[#E8E8E8] text-left text-[11px] uppercase text-[#888888]"><th className="py-1.5 font-semibold">{t("Produit")}</th><th className="py-1.5 font-semibold">{t("Commandé")}</th><th className="py-1.5 font-semibold">{t("Reçu")}</th><th className="py-1.5 text-right font-semibold">{t("Montant")}</th></tr></thead>
          <tbody>
            {bon.lignes.map((l) => (
              <tr key={l.id} className="border-b border-[#F0F0F0]">
                <td className="py-1.5">{l.nom}{l.variante ? ` (${l.variante})` : ""}{l.sku ? ` · ${l.sku}` : ""}</td>
                <td className="py-1.5 tabular-nums">{qte(l.quantite, l.uniteVente)}{l.prixUnitaire > 0 ? ` × ${fmt(l.prixUnitaire)}` : ""}</td>
                <td className="py-1.5 tabular-nums">{qte(l.quantiteRecue, l.uniteVente)}{l.quantiteRecue > l.quantite ? ` (${t("plus que commandé")})` : ""}</td>
                <td className="py-1.5 text-right tabular-nums">{l.prixUnitaire > 0 ? fmt(montantBrut(l.prixUnitaire, l.quantite, unite(l.uniteVente), 2)) : t("Prix à confirmer")}</td>
              </tr>
            ))}
            <tr className="total"><td className="py-2 font-bold" colSpan={3}>{t("Total")}</td><td className="py-2 text-right font-bold tabular-nums">{fmt(bon.montantTotal)}</td></tr>
          </tbody>
        </table>
        {bon.notes && <p className="mt-2">{t("Note")} : {bon.notes}</p>}
      </div>

      <section className="space-y-2">
        <h3 className="text-[12px] font-bold text-[#111111]">{t("Envoyer au fournisseur")}</h3>
        <div className="flex flex-wrap gap-2">
          <Bouton variante="secondaire" taille="compact" icone={<Printer size={14} aria-hidden />} onClick={() => { if (!imprimerElement(feuille.current, `${t("Bon de commande")} ${bon.numero}`)) toast.error(t("L'impression n'a pas pu démarrer.")); }}>{t("Imprimer")}</Bouton>
          <Bouton variante="secondaire" taille="compact" icone={<Copy size={14} aria-hidden />} onClick={() => void copier()}>{t("Copier le texte")}</Bouton>
          {telephone.length >= 8 && <a className={LIEN_EXTERNE} target="_blank" rel="noopener noreferrer" href={`https://wa.me/${telephone}?text=${encodeURIComponent(texte)}`}><MessageCircle size={14} aria-hidden />{t("Ouvrir WhatsApp")}</a>}
          {bon.fournisseur.email && <a className={LIEN_EXTERNE} href={`mailto:${bon.fournisseur.email}?subject=${encodeURIComponent(`Bon de commande ${bon.numero}`)}&body=${encodeURIComponent(texte)}`}><Mail size={14} aria-hidden />{t("Ouvrir ma messagerie")}</a>}
          {d.emailPossible && droits.valider && bon.statut !== "recu" && bon.statut !== "annule" && <Bouton taille="compact" charge={envoi === "email"} icone={<Mail size={14} aria-hidden />} onClick={() => void envoyerEmail()}>{t("Envoyer par e-mail depuis AXSO")}</Bouton>}
        </div>
        <p className="text-[11.5px] leading-relaxed text-[#888888]">
          {d.emailPossible
            ? t("« Envoyer par e-mail depuis AXSO » envoie réellement le bon à {0}. Les autres boutons préparent le message : c'est vous qui l'envoyez.", bon.fournisseur.email)
            : t(bon.fournisseur.email ? "L'envoi d'e-mails depuis AXSO n'est pas configuré (intégration en attente). Ces boutons préparent le message : c'est vous qui l'envoyez, puis vous marquez le bon comme envoyé." : "Ce fournisseur n'a pas d'adresse e-mail. Ces boutons préparent le message : c'est vous qui l'envoyez, puis vous marquez le bon comme envoyé.")}
        </p>
        <textarea readOnly aria-label={t("Texte du bon de commande")} rows={8} className={`${CLASSE_SAISIE} font-mono text-[12px]`} value={texte} onFocus={(e) => e.currentTarget.select()} />
      </section>

      <div className="flex flex-wrap gap-2 border-t border-[#F0F0F0] pt-4">
        {bon.statut === "brouillon" && droits.creer && <Bouton variante="secondaire" icone={<Pencil size={14} aria-hidden />} onClick={() => onModifier(bon)}>{t("Modifier")}</Bouton>}
        {droits.recevoir && STATUTS_RECEVABLES.includes(bon.statut) && <Bouton variante="sombre" icone={<PackageCheck size={15} aria-hidden />} href={`/dashboard/pos/receptions?bon=${bon.id}`}>{t("Réceptionner")}</Bouton>}
        {gestes.map((a) => (
          <Bouton key={a} variante={a === "annuler" ? "danger" : a === "envoyer" ? "primaire" : "secondaire"} charge={envoi === a}
            onClick={() => (ACTIONS_BON[a].motif ? (setGeste(a), setMotif(""), setRefus(null)) : void appliquer(a))}>{t(ACTIONS_BON[a].libelle)}</Bouton>
        ))}
      </div>
      {gestes.length === 0 && !droits.valider && bon.statut !== "recu" && bon.statut !== "annule" && <p className="text-[12px] text-[#888888]">{t("Faire avancer ce bon demande le droit de valider les achats.")}</p>}

      <Modale ouverte={!!geste} onFermer={() => setGeste(null)} titre={geste ? ACTIONS_BON[geste].libelle : ""} description="Le motif est conservé dans le journal d'audit." taille="sm" verrouillee={!!envoi}
        actions={<><Bouton variante="secondaire" onClick={() => setGeste(null)} disabled={!!envoi}>{t("Retour")}</Bouton><Bouton variante={geste === "annuler" ? "danger" : "primaire"} charge={!!envoi} disabled={motif.trim().length < 3} onClick={() => geste && void appliquer(geste, motif.trim())}>{t("Confirmer")}</Bouton></>}>
        <Champ label="Motif">{(a) => <textarea {...a} rows={3} maxLength={500} className={CLASSE_SAISIE} value={motif} onChange={(e) => setMotif(e.target.value)} />}</Champ>
      </Modale>
    </div>
  );
}

// ─── Liste ───────────────────────────────────────────────────────────────────

export function BonsCommande() {
  const t = useT();
  const { fmt } = useDevise();
  const [statut, setStatut] = useState("");
  const { donnees: d, erreur, charge, recharger } = useLecture<Liste>(`/api/pos/achats${statut ? `?statut=${statut}` : ""}`);
  const [suite, setSuite] = useState<{ bons: BonVue[]; curseur: string | null } | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [edition, setEdition] = useState<{ bon: BonVue | null } | null>(null);
  const [chargeSuite, setChargeSuite] = useState(false);

  useEffect(() => { setSuite(null); }, [d]);
  if (erreur && !d) return <EtatPos code={erreur.code} message={erreur.message} onReessayer={() => void recharger()} />;
  if (!d) return <EtatChargement texte="Chargement des bons de commande…" />;
  const bons = [...d.bons, ...(suite?.bons ?? [])];
  const curseur = suite ? suite.curseur : d.curseurSuivant;

  async function voirPlus() {
    setChargeSuite(true);
    const r = await appelPos<Liste>(`/api/pos/achats?curseur=${curseur}${statut ? `&statut=${statut}` : ""}`);
    setChargeSuite(false);
    if (!r.ok) { toast.error(t(r.message)); return; }
    setSuite({ bons: [...(suite?.bons ?? []), ...r.donnees.bons], curseur: r.donnees.curseurSuivant });
  }

  return (
    <>
      <Carte titre="Bons de commande" actions={d.droits.creer ? <Bouton taille="compact" icone={<Plus size={15} aria-hidden />} onClick={() => setEdition({ bon: null })}>{t("Nouveau bon")}</Bouton> : undefined}>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label={t("Filtrer les bons de commande")}>
          {["", ...STATUTS_BON].map((s) => (
            <button key={s} type="button" aria-pressed={statut === s} onClick={() => setStatut(s)}
              className={`min-h-11 rounded-xl border px-3 text-[12px] font-semibold ${FOCUS} ${statut === s ? "border-[#111111] bg-[#111111] text-white" : "border-[#E8E8E8] bg-white text-[#111111]"}`}>
              {t(s ? LIBELLES_STATUT_BON[s as StatutBon] : "Tous")}
            </button>
          ))}
        </div>
        {bons.length === 0 ? (
          <EtatVide compact titre={statut ? "Aucun bon de commande dans cet état" : "Aucun bon de commande"} texte={statut ? undefined : "Créez un bon à la main, ou laissez la section « À commander » en préparer un par fournisseur."} />
        ) : (
          <ul className={`divide-y divide-[#F0F0F0] ${charge ? "opacity-60" : ""}`}>
            {bons.map((b) => {
              const recu = b.lignes.reduce((s, l) => s + Math.min(l.quantiteRecue, l.quantite), 0), commande = b.lignes.reduce((s, l) => s + l.quantite, 0);
              return (
                <li key={b.id}>
                  <button type="button" onClick={() => setOuvert(b.id)} className={`flex min-h-14 w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl px-1 py-2 text-left hover:bg-[#FAFAFA] ${FOCUS}`}>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-bold">{b.fournisseur.nom}</span><Badge ton={TONS_STATUT[b.statut]}>{t(LIBELLES_STATUT_BON[b.statut])}</Badge></span>
                      <span className="block text-[12px] text-[#666666]">
                        {b.numero} · {new Date(b.createdAt).toLocaleDateString(t.loc)} · {t("{0} ligne(s)", b.lignes.length)}
                        {b.statut === "partiellement_recu" && commande > 0 ? ` · ${t("{0} % reçu", Math.round((recu / commande) * 100))}` : ""}
                        {b.dateAttendue && STATUTS_RECEVABLES.includes(b.statut) ? ` · ${t("attendu le")} ${new Date(b.dateAttendue).toLocaleDateString(t.loc)}` : ""}
                      </span>
                    </span>
                    <span className="text-[14px] font-bold tabular-nums">{fmt(b.montantTotal)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {curseur && <div className="mt-3 text-center"><Bouton variante="secondaire" charge={chargeSuite} onClick={() => void voirPlus()}>{t("Voir plus")}</Bouton></div>}
      </Carte>

      <Tiroir ouverte={!!ouvert} onFermer={() => setOuvert(null)} titre="Bon de commande" largeur="lg">
        {ouvert && <FicheBon key={ouvert} id={ouvert} droits={d.droits} onChange={() => void recharger()} onModifier={(bon) => { setOuvert(null); setEdition({ bon }); }} />}
      </Tiroir>
      <EditeurBon ouvert={!!edition} bon={edition?.bon ?? null} liste={d} onFermer={() => setEdition(null)} onEnregistre={(b) => { setEdition(null); void recharger(); setOuvert(b.id); }} />
    </>
  );
}
