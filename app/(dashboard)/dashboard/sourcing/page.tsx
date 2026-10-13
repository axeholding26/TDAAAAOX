"use client";
// AXSO Sourcing — l'interface unique du module : une conversation avec
// l'assistant (lib/sourcing/assistant.ts), le dossier produit en cours à côté,
// et en dessous les blocs du quotidien (à faire, expéditions, stocks, bénéfice,
// calcul rapide), qui fonctionnent aussi quand l'IA est indisponible.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2, Send, Settings, Sparkles, Users } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { ETAPES_PRODUIT, MODES_APPRO, type ContexteCalcul, type Evaluation } from "@/lib/sourcing/produit-source";
import type { CarteAssistant, Proposition } from "@/lib/sourcing/assistant";
import { Bouton, Carte, Champ, ChampNombre, Chargement, CLASSE_CHAMP, Entete, Erreur, Estimation, Onglets, Page, Pastille, envoyer, useApi } from "@/components/dashboard/sourcing/ui";
import { Calculateur, type FicheCalcul } from "@/components/dashboard/sourcing/Calculateur";
import { TableauDeBordProfit } from "@/components/dashboard/sourcing/TableauDeBordProfit";
import { BlocCommandes } from "@/components/dashboard/sourcing/blocs/Commandes";
import { BlocExpeditions } from "@/components/dashboard/sourcing/blocs/Expeditions";
import { BlocStocks } from "@/components/dashboard/sourcing/blocs/Stocks";

type Message = { role: "user" | "assistant"; content: string; cartes?: CarteAssistant[]; propositions?: (Proposition & { etat?: "envoi" | "fait" | "erreur"; message?: string })[] };
type Bloc = "commandes" | "expeditions" | "stocks" | "benefice" | "calcul";
const BLOCS: { cle: Bloc; libelle: string }[] = [
  { cle: "commandes", libelle: "À faire" }, { cle: "expeditions", libelle: "Expéditions" }, { cle: "stocks", libelle: "Stocks" },
  { cle: "benefice", libelle: "Bénéfice" }, { cle: "calcul", libelle: "Calcul rapide" },
];
const EXEMPLES = [
  "J'ai repéré un produit, aide-moi à voir si ça vaut le coup",
  "Combien je gagne si je vends à 12 900 ?",
  "Quel fournisseur choisir ?",
  "Où en sont mes commandes ?",
];

export default function PageSourcing() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  // L'adresse fait foi (?bloc= et ?dossier=) : les liens internes des blocs changent d'onglet ou de dossier.
  const dossierId = params.get("dossier");
  const bloc: Bloc = BLOCS.some((b) => b.cle === params.get("bloc")) ? (params.get("bloc") as Bloc) : "commandes";
  // Incrémenté après chaque réponse ou action confirmée : dossier et blocs relisent leurs données.
  const [version, setVersion] = useState(0);
  const ia = useApi<{ iaDisponible: boolean }>("/api/sourcing/assistant");
  const aller = (b: Bloc, d: string | null) => router.replace(`/dashboard/sourcing?bloc=${b}${d ? `&dossier=${d}` : ""}`, { scroll: false });
  const changerBloc = (b: Bloc) => aller(b, dossierId);
  const setDossierId = (d: string | null) => aller(bloc, d);

  return (
    <Page>
      <Entete badge="AXSO Sourcing" titre="Votre assistant d'import et de dropshipping"
        sousTitre="Dites ce que vous voulez faire : il calcule votre coût réel, conseille un prix, compare vos fournisseurs et suit vos commandes."
        actions={<>
          <Bouton variante="secondaire" href="/dashboard/sourcing/fournisseurs" petit><Users size={13} />{t("Mes fournisseurs")}</Bouton>
          <Bouton variante="secondaire" href="/dashboard/sourcing/reglages" petit><Settings size={13} />{t("Réglages")}</Bouton>
        </>} />

      {ia.erreur ? <Erreur message={ia.erreur} /> : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-start">
          <Conversation iaDisponible={ia.data?.iaDisponible ?? true} dossierId={dossierId}
            onReponse={(id) => { if (id) setDossierId(id); setVersion((v) => v + 1); }} />
          <div id="dossier-en-cours" className="min-w-0 scroll-mt-4">
            <Dossier id={dossierId} version={version} onChoix={setDossierId} onChange={() => setVersion((v) => v + 1)} />
          </div>
        </div>
      )}

      <Onglets<Bloc> onglets={BLOCS} actif={bloc} onChange={changerBloc} />
      <div key={`${bloc}-${version}`}>
        {bloc === "commandes" && <BlocCommandes />}
        {bloc === "expeditions" && <BlocExpeditions />}
        {bloc === "stocks" && <BlocStocks />}
        {bloc === "benefice" && <TableauDeBordProfit />}
        {bloc === "calcul" && <CalculRapide />}
      </div>
    </Page>
  );
}

// ── Conversation ──────────────────────────────────────────────────────────────

function Conversation({ iaDisponible, dossierId, onReponse }: { iaDisponible: boolean; dossierId: string | null; onReponse: (dossierId: string | null) => void }) {
  const t = useT();
  const [messages, setMessages] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState("");
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => { fin.current?.scrollIntoView({ block: "nearest" }); }, [messages, attente]);

  async function demander(texte: string) {
    const question = texte.trim();
    if (!question || attente) return;
    const suite: Message[] = [...messages, { role: "user", content: question }];
    setMessages(suite); setSaisie(""); setErreur(null); setAttente(true);
    try {
      const r = await envoyer<{ reponse: string; cartes: CarteAssistant[]; propositions: Proposition[]; dossierId: string | null }>("/api/sourcing/assistant", "POST", {
        messages: suite.slice(-12).map(({ role, content }) => ({ role, content })), dossierId,
      });
      setMessages([...suite, { role: "assistant", content: r.reponse, cartes: r.cartes, propositions: r.propositions }]);
      onReponse(r.dossierId);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setAttente(false);
    }
  }

  /** Le clic du marchand EST la confirmation : l'action part sur la route existante, avec ses contrôles. */
  async function confirmer(iMessage: number, iProp: number) {
    const p = messages[iMessage]?.propositions?.[iProp];
    if (!p || p.etat === "fait" || p.etat === "envoi") return;
    const marquer = (etat: "envoi" | "fait" | "erreur", message?: string) => setMessages((ms) => ms.map((m, i) => i !== iMessage ? m : { ...m, propositions: m.propositions?.map((x, j) => (j === iProp ? { ...x, etat, message } : x)) }));
    marquer("envoi");
    try {
      await envoyer(p.appel.url, p.appel.method, p.appel.body);
      marquer("fait");
      onReponse(null);
    } catch (e) {
      marquer("erreur", (e as Error).message);
    }
  }

  return (
    <Carte className="flex flex-col">
      <div className="space-y-3 overflow-y-auto pr-1" style={{ maxHeight: "62vh", minHeight: 220 }} aria-live="polite">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <Sparkles size={22} className="mx-auto text-[#F5A623]" />
            <p className="text-[14px] font-bold text-[#111111] mt-2">{t("Par quoi on commence ?")}</p>
            <p className="text-[12px] text-[#666666] mt-1">{t("Donnez le nom et le prix d'achat d'un produit, ou posez votre question.")}</p>
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {EXEMPLES.map((e) => (
                <button key={e} type="button" disabled={!iaDisponible} onClick={() => demander(t(e))}
                  className="text-[12px] px-3 py-1.5 rounded-full border border-[#E8E8E8] text-[#444444] hover:border-[#F5A623] disabled:opacity-50">{t(e)}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "space-y-2"}>
            <p className={`text-[13px] leading-relaxed whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 ${m.role === "user" ? "bg-[#111111] text-white max-w-[85%]" : "bg-[#F7F7F8] text-[#111111]"}`}>{m.content}</p>
            {m.cartes?.map((c, j) => <CarteReponse key={j} carte={c} />)}
            {m.propositions?.map((p, j) => (
              <div key={j} className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-3">
                <p className="text-[13px] font-bold text-[#111111]">{p.libelle}</p>
                <p className="text-[12px] text-[#666666] mt-0.5 leading-relaxed">{p.detail}</p>
                {p.etat === "erreur" && <p role="alert" className="text-[12px] text-[#B91C1C] font-semibold mt-1.5">{t(p.message ?? "Erreur")}</p>}
                <div className="mt-2">
                  {p.etat === "fait"
                    ? <Pastille ton="positif"><Check size={11} />{t("Fait")}</Pastille>
                    : <Bouton petit charge={p.etat === "envoi"} onClick={() => confirmer(i, j)}>{t(p.etat === "erreur" ? "Réessayer" : "Confirmer")}</Bouton>}
                </div>
              </div>
            ))}
          </div>
        ))}
        {attente && <p className="text-[12px] text-[#888888] flex items-center gap-2"><Loader2 size={13} className="animate-spin" />{t("L'assistant calcule…")}</p>}
        <div ref={fin} />
      </div>

      {erreur && <div className="mt-3"><Erreur message={erreur} /></div>}
      {!iaDisponible && <div className="mt-3"><Estimation>{t("L'assistant est momentanément indisponible. Le calcul rapide, les commandes et les stocks, plus bas, fonctionnent sans lui.")}</Estimation></div>}

      <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); demander(saisie); }}>
        <textarea value={saisie} onChange={(e) => setSaisie(e.target.value)} rows={2} maxLength={4000} disabled={!iaDisponible}
          aria-label={t("Votre message à l'assistant")} placeholder={t("Ex. : écouteurs sans fil, 4 dollars pièce, 80 g, je veux les vendre au Cameroun")}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); demander(saisie); } }}
          className={`${CLASSE_CHAMP} resize-none flex-1`} />
        <Bouton type="submit" disabled={!saisie.trim() || attente || !iaDisponible} charge={attente}><Send size={14} /><span className="sr-only">{t("Envoyer")}</span></Bouton>
      </form>
    </Carte>
  );
}

function CarteReponse({ carte }: { carte: CarteAssistant }) {
  const t = useT();
  return (
    <div className="rounded-2xl border border-[#EBEBEB] bg-white p-3">
      <p className="text-[12px] font-bold text-[#111111] mb-1.5">{carte.titre}</p>
      <dl className="space-y-1">
        {carte.lignes.map((l, i) => (
          <div key={i} className="flex items-start justify-between gap-3 text-[12px]">
            <dt className="text-[#666666]">{t(l.libelle)}</dt>
            <dd className={`text-right ${l.fort ? "font-bold text-[#111111]" : "text-[#444444]"}`}>{l.valeur}</dd>
          </div>
        ))}
      </dl>
      {carte.note && <p className="text-[11px] text-[#AAAAAA] mt-2 leading-relaxed">{t(carte.note)}</p>}
    </div>
  );
}

// ── Dossier en cours ──────────────────────────────────────────────────────────

type Resume = { id: string; nom: string; etape: string; produitId: string | null };
type Detail = {
  source: { id: string; nom: string; etape: string; modeAppro: string; fournisseurNom: string | null; fournisseurId: string | null; produitId: string | null; poidsKg: number | null };
  evaluation: Evaluation; produit: { actif: boolean; ventes: number } | null; prixEnLigne: number | null;
};

function Dossier({ id, version, onChoix, onChange }: { id: string | null; version: number; onChoix: (id: string | null) => void; onChange: () => void }) {
  const t = useT();
  const { fmt } = useDevise();
  const liste = useApi<{ produits: Resume[] }>("/api/sourcing/produits");
  const detail = useApi<Detail>(id ? `/api/sourcing/produits/${id}` : null);
  const fournisseur = useApi<{ analyse: { score: number; confiance: string; risque: { niveau: string } } }>(detail.data?.source.fournisseurId ? `/api/fournisseurs/${detail.data.source.fournisseurId}` : null);
  const fournisseurs = useApi<{ fournisseurs: { id: string; nom: string }[] }>("/api/fournisseurs");
  const [nouveau, setNouveau] = useState(false);
  const [action, setAction] = useState<{ charge: boolean; erreur: string | null }>({ charge: false, erreur: null });
  const { recharger: relireListe } = liste;
  const { recharger: relireDetail } = detail;
  useEffect(() => { if (version) { relireListe(); relireDetail(); } }, [version, relireListe, relireDetail]);

  const d = id ? detail.data : null;
  const produits = liste.data?.produits ?? [];
  const rattacher = async (fournisseurId: string | null) => {
    if (!d) return;
    setAction({ charge: true, erreur: null });
    try { await envoyer(`/api/sourcing/produits/${d.source.id}`, "PATCH", { fournisseurId }); setAction({ charge: false, erreur: null }); onChange(); }
    catch (e) { setAction({ charge: false, erreur: (e as Error).message }); }
  };
  const publier = async () => {
    if (!d) return;
    setAction({ charge: true, erreur: null });
    try { await envoyer(`/api/sourcing/produits/${d.source.id}/publier`, "POST"); setAction({ charge: false, erreur: null }); onChange(); }
    catch (e) { setAction({ charge: false, erreur: (e as Error).message }); }
  };

  return (
    <Carte titre="Dossier en cours" actions={<Bouton variante="secondaire" petit onClick={() => setNouveau((v) => !v)}>{t(nouveau ? "Fermer" : "Nouveau dossier")}</Bouton>}>
      {nouveau && <NouveauDossier onCree={(nid) => { setNouveau(false); onChoix(nid); onChange(); }} />}
      {produits.length > 0 && (
        <select value={id ?? ""} onChange={(e) => onChoix(e.target.value || null)} aria-label={t("Choisir un dossier")} className={`${CLASSE_CHAMP} mb-3`}>
          <option value="">{t("Choisir un dossier…")}</option>
          {produits.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </select>
      )}
      {liste.chargement && !liste.data && <Chargement />}
      {!id && !liste.chargement && !nouveau && (
        <p className="text-[13px] text-[#666666] leading-relaxed">
          {t(produits.length ? "Choisissez un dossier, ou décrivez un nouveau produit à l'assistant." : "Aucun dossier pour l'instant. Donnez à l'assistant le nom et le prix d'achat d'un produit : son coût réel et son prix conseillé s'afficheront ici.")}
        </p>
      )}
      {id && detail.erreur && <Erreur message={detail.erreur} />}
      {id && detail.chargement && !d && <Chargement />}
      {d && (() => {
        const { cout, conseil, score } = d.evaluation;
        const etape = ETAPES_PRODUIT.find((e) => e.cle === d.source.etape) ?? ETAPES_PRODUIT[0];
        const prochaine = !d.source.poidsKg ? "Donnez le poids du produit : sans lui, le transport n'est pas compté."
          : !d.source.fournisseurId ? "Rattachez un fournisseur pour que les commandes lui soient transmises."
          : !d.source.produitId ? "Publiez le produit dans votre boutique pour lancer le test."
          : etape.objectif;
        return (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-bold text-[#111111] leading-snug">{d.source.nom}</p>
              <Pastille ton={d.source.produitId ? "positif" : "neutre"}>{t(d.source.produitId ? "En boutique" : "Pas encore publié")}</Pastille>
            </div>
            <dl className="space-y-1">
              {cout.lignes.filter((l) => l.montant > 0).map((l) => (
                <div key={l.cle} className="flex justify-between gap-3 text-[12px]"><dt className="text-[#666666]">{t(l.libelle)}</dt><dd className="text-[#444444]">{fmt(l.montant)}</dd></div>
              ))}
              <div className="flex justify-between gap-3 text-[13px] font-bold border-t border-[#F0F0F0] pt-1.5"><dt>{t("Coût réel par commande")}</dt><dd>{fmt(cout.coutTotal)}</dd></div>
              <div className="flex justify-between gap-3 text-[13px]"><dt className="text-[#666666]">{t("Prix de vente")}</dt><dd className="font-semibold">{cout.prixVente ? fmt(cout.prixVente) : "—"}</dd></div>
              {d.prixEnLigne && <div className="flex justify-between gap-3 text-[12px]"><dt className="text-[#666666]">{t("Payé par le client en ligne (commission Axso incluse)")}</dt><dd className="text-[#444444]">{fmt(d.prixEnLigne)}</dd></div>}
              <div className="flex justify-between gap-3 text-[13px] font-bold"><dt>{t("Bénéfice par commande livrée")}</dt>
                <dd style={{ color: (cout.margeNette ?? 0) > 0 ? "#15803D" : "#B91C1C" }}>{cout.margeNette === null ? "—" : fmt(cout.margeNette)}</dd></div>
            </dl>
            <p className="text-[11px] text-[#B45309] leading-relaxed">{t("Droits de douane, refus et retours sont des estimations tant que vous ne les avez pas réglés.")}</p>
            <details className="text-[12px] text-[#666666]">
              <summary className="cursor-pointer font-semibold text-[#111111]">{t("Prix conseillé : {0}", fmt(conseil.prix))}</summary>
              <ul className="mt-1.5 space-y-1 list-disc pl-4 leading-relaxed">{conseil.explication.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </details>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-xl bg-[#F7F7F8] p-2.5"><p className="text-[#888888]">{t("Score du produit")}</p><p className="font-bold text-[#111111]">{score.total}/100</p><p className="text-[#666666] leading-snug">{t(score.verdict)}</p>
                <p className="text-[#AAAAAA] leading-snug mt-0.5">{t("Calculé sur {0} % des critères.", Math.round(score.confiance * 100))}</p></div>
              <div className="rounded-xl bg-[#F7F7F8] p-2.5"><p className="text-[#888888]">{t("Fournisseur")}</p>
                <select value={d.source.fournisseurId ?? ""} disabled={action.charge} onChange={(e) => rattacher(e.target.value || null)} aria-label={t("Fournisseur de ce produit")}
                  className="w-full bg-transparent font-bold text-[#111111] text-[12px] outline-none -ml-1">
                  <option value="">{d.source.fournisseurId ? t("Aucun") : d.source.fournisseurNom ? `${d.source.fournisseurNom} (${t("non rattaché")})` : t("Aucun")}</option>
                  {(fournisseurs.data?.fournisseurs ?? []).map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                </select>
                <p className="text-[#666666] leading-snug">{fournisseur.data
                  ? t("Score {0}/100 · risque {1}", fournisseur.data.analyse.score, t(fournisseur.data.analyse.risque.niveau))
                  : d.source.fournisseurId ? t("Analyse en cours…")
                  : (fournisseurs.data?.fournisseurs.length ?? 0) > 0 ? t("Choisissez-le dans la liste.") : <Link className="underline" href="/dashboard/sourcing/fournisseurs">{t("Ajoutez d'abord un fournisseur.")}</Link>}</p></div>
            </div>
            <p className="text-[12px] text-[#666666]"><span className="font-bold text-[#111111]">{t("Étape : {0}", t(etape.libelle))}</span>{" · "}{t(MODES_APPRO.find((m) => m.cle === d.source.modeAppro)?.libelle ?? d.source.modeAppro)}</p>
            <p className="text-[12px] rounded-xl border border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] p-2.5 leading-relaxed"><span className="font-bold">{t("Prochaine action :")}</span>{" "}{t(prochaine)}</p>
            {action.erreur && <Erreur message={action.erreur} />}
            <div className="flex flex-wrap gap-2">
              <Bouton onClick={publier} charge={action.charge} disabled={!cout.prixVente}>{t(d.source.produitId ? "Mettre à jour le prix en boutique" : "Publier dans ma boutique")}</Bouton>
              {d.source.fournisseurId && <Bouton variante="secondaire" href={`/dashboard/sourcing/fournisseurs/${d.source.fournisseurId}`}>{t("Fiche du fournisseur")}</Bouton>}
            </div>
          </div>
        );
      })()}
    </Carte>
  );
}

/** Ouvrir un dossier sans passer par l'assistant (utile aussi quand l'IA est indisponible). */
function NouveauDossier({ onCree }: { onCree: (id: string) => void }) {
  const t = useT();
  const [f, setF] = useState<{ nom: string; prix?: number; devise: string; poids?: number }>({ nom: "", devise: "USD" });
  const [etat, setEtat] = useState<{ charge: boolean; erreur: string | null }>({ charge: false, erreur: null });
  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    setEtat({ charge: true, erreur: null });
    try {
      const r = await envoyer<{ id: string }>("/api/sourcing/produits", "POST", { donnees: { nom: f.nom, prixFournisseur: f.prix, deviseFournisseur: f.devise, ...(f.poids ? { poidsKg: f.poids } : {}) } });
      onCree(r.id);
    } catch (err) { setEtat({ charge: false, erreur: (err as Error).message }); }
  };
  return (
    <form onSubmit={creer} className="space-y-2.5 mb-3 pb-3 border-b border-[#F0F0F0]">
      <Champ label="Nom du produit"><input required minLength={2} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} className={CLASSE_CHAMP} /></Champ>
      <div className="grid grid-cols-2 gap-2">
        <ChampNombre label="Prix d'achat" valeur={f.prix} onChange={(prix) => setF({ ...f, prix })} />
        <Champ label="Devise"><select value={f.devise} onChange={(e) => setF({ ...f, devise: e.target.value })} className={CLASSE_CHAMP}>
          {["USD", "CNY", "EUR", "XAF", "XOF", "NGN", "GHS", "KES"].map((d) => <option key={d}>{d}</option>)}</select></Champ>
      </div>
      <ChampNombre label="Poids d'une unité" suffixe="kg" pas={0.01} valeur={f.poids} onChange={(poids) => setF({ ...f, poids })} aide="Sert à calculer le transport." />
      {etat.erreur && <Erreur message={etat.erreur} />}
      <Bouton type="submit" charge={etat.charge} disabled={!f.nom.trim() || !f.prix}>{t("Ouvrir le dossier")}</Bouton>
    </form>
  );
}

// ── Calcul rapide (sans IA, sans rien enregistrer) ────────────────────────────

function CalculRapide() {
  const t = useT();
  const { data: contexte, erreur, chargement } = useApi<ContexteCalcul>("/api/sourcing/reglages");
  const [fiche, setFiche] = useState<FicheCalcul>({ prixFournisseur: 0, deviseFournisseur: "USD", modeAppro: "dropshipping", parametresCout: {}, tarification: {} });
  const mode = MODES_APPRO.find((m) => m.cle === fiche.modeAppro) ?? MODES_APPRO[0];
  if (chargement && !contexte) return <Chargement />;
  if (erreur || !contexte) return <Erreur message={erreur ?? "Erreur"} />;
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[#666666] leading-relaxed">{t("Entrez le prix du fournisseur et vos frais : Axso calcule votre coût réel, le prix à afficher et votre bénéfice par commande.")}</p>
      <Carte titre="Comment recevez-vous la marchandise ?" aide={mode.resume}>
        <Onglets onglets={MODES_APPRO.map((m) => ({ cle: m.cle, libelle: m.libelle }))} actif={mode.cle} onChange={(modeAppro) => setFiche((x) => ({ ...x, modeAppro }))} />
      </Carte>
      <Calculateur editionFiche fiche={fiche} contexte={contexte} onChange={(partiel) => setFiche((x) => ({ ...x, ...partiel }))} />
    </div>
  );
}
