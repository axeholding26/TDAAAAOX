"use client";
// Commandes fournisseurs : où en est chaque commande dans le parcours complet
// (14 étapes, lib/sourcing/statuts.ts) et quelle est la prochaine action du
// marchand. Aucun fournisseur n'est connecté : la commande se transmet à la main.
import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Copy, ExternalLink, Mail, MapPin, MessageCircle, Truck } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { ETAPES_COMMANDE, LIBELLES_EXPEDITION, MOTIFS_ANNULATION, libelleEtape, type StatutExpedition } from "@/lib/sourcing/statuts";
import type { RouteLigne } from "@/lib/sourcing/routage";
import { Bouton, Carte, Champ, Chargement, CLASSE_CHAMP, Erreur, Estimation, EtatVide, Onglets, Pastille, envoyer, useApi, versDossier } from "@/components/dashboard/sourcing/ui";

interface CommandeFournisseur {
  id: string; statut: "en_attente" | "envoye" | "confirme" | "expedie" | "livre" | "annule";
  reference: string | null; trackingNo: string | null; montantFournisseur: number | null; createdAt: string; fournisseurId: string | null;
  fournisseur: { nom: string; telephone: string | null; email: string | null; url: string | null } | null;
  expeditionId: string | null; message: string;
}
interface Commande {
  id: string; numero: string; clientNom: string; clientTelephone: string | null; ville: string; pays: string;
  montantTotal: number; devise: string; statut: string; paiementStatut: string; methodePaiement: string | null; createdAt: string;
  articles: string; etape: string;
  expedition: { id: string; statut: StatutExpedition; trackingNo: string | null; arriveeEstimee: string | null } | null;
  sansFournisseur: boolean; commandesFournisseur: CommandeFournisseur[];
}
interface Itineraire {
  lignes: RouteLigne[];
  transporteur: { nom: string; mode: string | null; frais: number; delai: string | number | null } | null;
  coutAppro: number | null; delaiApproJours: number;
}

type Groupe = "a_commander" | "en_cours" | "livrees" | "problemes";
const ISSUES = ["echec_livraison", "retournee"];
// Étapes où la suite se joue dans le cycle de livraison local existant.
const LIVRAISON_LOCALE = ["entrepot_local", "en_livraison", "echec_livraison"];

function groupe(c: Commande): Groupe {
  if (c.sansFournisseur || ISSUES.includes(c.etape) || c.statut === "annulee") return "problemes";
  if (c.etape === "livree") return "livrees";
  if (c.commandesFournisseur.some((cf) => cf.statut === "en_attente")) return "a_commander";
  return "en_cours";
}

const MODES = [
  { cle: "aerien", libelle: "Aérien" }, { cle: "maritime", libelle: "Maritime" },
  { cle: "express", libelle: "Express" }, { cle: "routier", libelle: "Routier" },
];
const texte = (s: string) => s.trim() || undefined;

export function BlocCommandes() {
  const t = useT();
  const { data, erreur, chargement, recharger } = useApi<{ commandes: Commande[] }>("/api/sourcing/commandes");
  const [filtre, setFiltre] = useState<Groupe>("a_commander");
  const commandes = data?.commandes ?? [];
  const nombre = (g: Groupe) => commandes.filter((c) => groupe(c) === g).length;
  const visibles = commandes.filter((c) => groupe(c) === filtre);

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[#666666] leading-relaxed">{t("Aucun fournisseur n'est encore connecté automatiquement : vous transmettez la commande vous-même, Axso prépare le message.")}</p>

      {erreur && <Erreur message={erreur} />}
      {chargement && !data && <Chargement />}

      {data && commandes.length === 0 && (
        <EtatVide titre="Aucune commande à faire livrer par un fournisseur"
          texte="Dès qu'un client commande un produit en dropshipping, la commande apparaît ici avec le message prêt à envoyer à votre fournisseur." />
      )}

      {commandes.length > 0 && (
        <>
          <Onglets<Groupe> actif={filtre} onChange={setFiltre} onglets={[
            { cle: "a_commander", libelle: "À commander", nombre: nombre("a_commander") },
            { cle: "en_cours", libelle: "En cours", nombre: nombre("en_cours") },
            { cle: "livrees", libelle: "Livrées", nombre: nombre("livrees") },
            { cle: "problemes", libelle: "Problèmes", nombre: nombre("problemes") },
          ]} />
          {visibles.length === 0 && <p className="text-[13px] text-[#666666] text-center py-6">{t("Aucune commande dans cette catégorie.")}</p>}
          <div className="space-y-3">
            {visibles.map((c) => <CarteCommande key={c.id} c={c} recharger={recharger} />)}
          </div>
        </>
      )}
    </div>
  );
}

function CarteCommande({ c, recharger }: { c: Commande; recharger: () => void }) {
  const t = useT();
  const { fmt } = useDevise();
  const [frise, setFrise] = useState(false);
  const [itineraire, setItineraire] = useState(false);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const index = ETAPES_COMMANDE.findIndex((e) => e.cle === c.etape);
  const issue = ISSUES.includes(c.etape);
  const annulee = c.statut === "annulee";
  const couleur = issue ? "#B91C1C" : "#F5A623";
  // Une issue (échec, retour) n'est pas une étape « franchie » du parcours normal.
  const franchie = (i: number) => i < index && !(issue && (ETAPES_COMMANDE[i].cle === "echec_livraison" || (ETAPES_COMMANDE[i].cle === "livree" && c.etape !== "retournee")));

  // Le produit a pu être rattaché à un fournisseur depuis : la création est idempotente.
  async function creerCommandeFournisseur() {
    setCharge(true); setErreur(null);
    try { await envoyer("/api/dropshipping/commandes-fournisseur", "POST", { commandeId: c.id }); recharger(); }
    catch (e) { setErreur((e as Error).message); }
    finally { setCharge(false); }
  }

  return (
    <Carte>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-[#111111]">{t("Commande #{0}", c.numero)}</p>
          <p className="text-[12px] text-[#666666] mt-0.5">{c.clientNom} · {c.ville}</p>
          <p className="text-[12px] text-[#666666] mt-1 leading-relaxed">{c.articles}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[14px] font-bold text-[#111111] tabular-nums">{fmt(c.montantTotal)}</p>
          <p className="text-[11px] text-[#AAAAAA]">{new Date(c.createdAt).toLocaleDateString(t.loc)}</p>
        </div>
      </div>

      {/* Frise compacte : étape courante + progression ; frise complète dépliable. */}
      <div className="mt-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {annulee ? <Pastille ton="attention">{t("Commande annulée")}</Pastille>
            : <Pastille ton={issue ? "attention" : c.etape === "livree" ? "positif" : "accent"}>{issue && <AlertTriangle size={9} />}{t(libelleEtape(c.etape))}</Pastille>}
          <button type="button" aria-expanded={frise} onClick={() => setFrise((v) => !v)} className="flex items-center gap-1 text-[11px] font-semibold text-[#666666]">
            {t("Étape {0}/{1}", index + 1, ETAPES_COMMANDE.length)}<ChevronDown size={12} className={frise ? "rotate-180" : ""} />
          </button>
        </div>
        <div className="h-1.5 rounded-full bg-[#F0F0F0] mt-2 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${((index + 1) / ETAPES_COMMANDE.length) * 100}%`, background: couleur }} />
        </div>
        {frise && (
          <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {ETAPES_COMMANDE.map((e, i) => {
              const courante = i === index;
              return (
                <li key={e.cle} className="flex items-center gap-2 text-[12px]">
                  <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-white"
                    style={{ background: courante ? couleur : franchie(i) ? "#111111" : "#E8E8E8" }}>
                    {franchie(i) && <Check size={10} />}
                  </span>
                  <span className={courante ? "font-bold" : ""} style={{ color: courante ? (issue ? "#B91C1C" : "#111111") : franchie(i) ? "#666666" : "#AAAAAA" }}>
                    {i + 1}. {t(e.libelle)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {erreur && <div className="mt-3"><Erreur message={erreur} /></div>}

      {c.sansFournisseur && (
        <div className="mt-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] p-3">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#B91C1C]"><AlertTriangle size={14} />{t("Produit sans fournisseur rattaché")}</p>
          <p className="text-[12px] text-[#666666] mt-1 leading-relaxed">{t("Cette commande ne peut pas être transmise : rattachez un fournisseur au produit, puis créez la commande fournisseur.")}</p>
          <div className="flex gap-2 flex-wrap mt-2">
            <Bouton onClick={versDossier} petit>{t("Rattacher un fournisseur")}</Bouton>
            {!annulee && <Bouton onClick={creerCommandeFournisseur} charge={charge} variante="secondaire" petit>{t("Créer la commande fournisseur")}</Bouton>}
          </div>
        </div>
      )}

      {!annulee && c.commandesFournisseur.map((cf) => <BlocFournisseur key={cf.id} c={c} cf={cf} recharger={recharger} />)}

      <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-[#F5F5F5]">
        <Bouton onClick={() => setItineraire((v) => !v)} variante="secondaire" petit><MapPin size={11} />{t(itineraire ? "Masquer l'itinéraire" : "Voir l'itinéraire")}</Bouton>
        <Bouton href={`/dashboard/commandes/${c.id}`} variante={LIVRAISON_LOCALE.includes(c.etape) ? "primaire" : "secondaire"} petit>
          {t(LIVRAISON_LOCALE.includes(c.etape) ? "Gérer la livraison au client" : "Fiche de la commande")}<ChevronRight size={11} />
        </Bouton>
      </div>
      {itineraire && <BlocItineraire commandeId={c.id} />}
    </Carte>
  );
}

function BlocFournisseur({ c, cf, recharger }: { c: Commande; cf: CommandeFournisseur; recharger: () => void }) {
  const t = useT();
  const [reference, setReference] = useState("");
  const [copie, setCopie] = useState(false);
  const [formulaire, setFormulaire] = useState(false);
  const [exp, setExp] = useState({ trackingNo: "", transporteur: "", mode: "aerien", arriveeEstimee: "" });
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const nom = cf.fournisseur?.nom ?? t("votre fournisseur");

  async function agir(action: () => Promise<unknown>) {
    setCharge(true); setErreur(null);
    try { await action(); recharger(); }
    catch (e) { setErreur((e as Error).message); }
    finally { setCharge(false); }
  }
  // Uniquement envoye / confirme / annule : « expedie » et « livre » préviendraient le client à tort.
  const statut = (s: "envoye" | "confirme" | "annule", motif?: string) => agir(() => envoyer("/api/dropshipping/commandes-fournisseur", "PATCH", { id: cf.id, statut: s, motif, reference: texte(reference) }));
  const expedier = () => agir(() => envoyer("/api/sourcing/expeditions", "POST", {
    commandeFournisseurId: cf.id, trackingNo: texte(exp.trackingNo), transporteur: texte(exp.transporteur), mode: exp.mode,
    // La date d'expédition fait démarrer le suivi à « Expédiée » même sans numéro de suivi.
    dateExpedition: new Date().toISOString(),
    arriveeEstimee: exp.arriveeEstimee ? `${exp.arriveeEstimee}T12:00:00.000Z` : undefined,
  }));

  const telephone = cf.fournisseur?.telephone?.replace(/\D/g, "");
  const lien = "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold bg-white text-[#111111] border border-[#E8E8E8] hover:border-[#F5A623]";

  return (
    <div className="mt-3 rounded-xl border border-[#E8E8E8] p-3">
      {erreur && <div className="mb-2"><Erreur message={erreur} /></div>}

      {cf.statut === "en_attente" && (
        <>
          <p className="text-[13px] font-bold text-[#111111]">{t("À commander chez {0}", nom)}</p>
          <p className="text-[11px] text-[#AAAAAA] mt-0.5 leading-relaxed">{t("Aucun fournisseur n'est encore connecté automatiquement : vous transmettez la commande vous-même, Axso prépare le message.")}</p>
          <pre className="mt-2 rounded-xl bg-[#F5F5F5] p-3 text-[12px] text-[#111111] whitespace-pre-wrap break-words max-h-48 overflow-y-auto" style={{ fontFamily: "inherit" }}>{cf.message}</pre>
          <div className="flex gap-2 flex-wrap mt-2">
            <button className={lien} onClick={() => navigator.clipboard.writeText(cf.message).then(() => { setCopie(true); setTimeout(() => setCopie(false), 2000); }).catch(() => setErreur(t("Copie impossible : sélectionnez le texte à la main.")))}>
              {copie ? <Check size={11} /> : <Copy size={11} />}{t(copie ? "Copié" : "Copier")}
            </button>
            {telephone && <a className={lien} target="_blank" rel="noopener noreferrer" href={`https://wa.me/${telephone}?text=${encodeURIComponent(cf.message)}`}><MessageCircle size={11} />WhatsApp</a>}
            {cf.fournisseur?.email && <a className={lien} href={`mailto:${cf.fournisseur.email}?subject=${encodeURIComponent(t("Commande #{0}", c.numero))}&body=${encodeURIComponent(cf.message)}`}><Mail size={11} />{t("E-mail")}</a>}
            {cf.fournisseur?.url && <a className={lien} target="_blank" rel="noopener noreferrer" href={cf.fournisseur.url}><ExternalLink size={11} />{t("Site du fournisseur")}</a>}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Champ label="Référence fournisseur (facultatif)">
              <input value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} className={CLASSE_CHAMP} />
            </Champ>
            <Bouton onClick={() => statut("envoye")} charge={charge}>{t("J'ai passé la commande")}</Bouton>
          </div>
        </>
      )}

      {(cf.statut === "envoye" || cf.statut === "confirme") && !cf.expeditionId && (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[13px] font-bold text-[#111111]">{t(cf.statut === "confirme" ? "Commande confirmée par {0}" : "Commande passée chez {0}", nom)}</p>
            {cf.reference && <Pastille>{t("Réf. {0}", cf.reference)}</Pastille>}
          </div>
          {!formulaire ? (
            <div className="flex gap-2 flex-wrap mt-2">
              {cf.statut === "envoye" && <Bouton onClick={() => statut("confirme")} charge={charge} variante="secondaire" petit>{t("Le fournisseur a confirmé")}</Bouton>}
              <Bouton onClick={() => setFormulaire(true)} petit><Truck size={11} />{t("Le fournisseur a expédié")}</Bouton>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Champ label="Numéro de suivi" aide="Donné par votre fournisseur. Vous pourrez l'ajouter plus tard.">
                <input value={exp.trackingNo} maxLength={120} onChange={(e) => setExp({ ...exp, trackingNo: e.target.value })} className={CLASSE_CHAMP} />
              </Champ>
              <Champ label="Transporteur"><input value={exp.transporteur} maxLength={120} onChange={(e) => setExp({ ...exp, transporteur: e.target.value })} className={CLASSE_CHAMP} /></Champ>
              <Champ label="Mode de transport">
                <select value={exp.mode} onChange={(e) => setExp({ ...exp, mode: e.target.value })} className={CLASSE_CHAMP}>
                  {MODES.map((m) => <option key={m.cle} value={m.cle}>{t(m.libelle)}</option>)}
                </select>
              </Champ>
              <Champ label="Arrivée estimée"><input type="date" value={exp.arriveeEstimee} onChange={(e) => setExp({ ...exp, arriveeEstimee: e.target.value })} className={CLASSE_CHAMP} /></Champ>
              <div className="sm:col-span-2 flex gap-2">
                <Bouton onClick={expedier} charge={charge} petit>{t("Enregistrer l'expédition")}</Bouton>
                <Bouton onClick={() => setFormulaire(false)} variante="secondaire" petit>{t("Fermer")}</Bouton>
              </div>
            </div>
          )}
        </>
      )}

      {cf.expeditionId && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#111111]"><Truck size={13} className="text-[#B45309]" />
              {c.expedition?.id === cf.expeditionId ? t(LIBELLES_EXPEDITION[c.expedition.statut] ?? c.expedition.statut) : t("Expédition en cours")}
            </p>
            <p className="text-[12px] text-[#666666] mt-0.5">
              {nom}
              {c.expedition?.id === cf.expeditionId && c.expedition.trackingNo ? ` · ${t("Suivi {0}", c.expedition.trackingNo)}` : ""}
              {c.expedition?.id === cf.expeditionId && c.expedition.arriveeEstimee ? ` · ${t("Arrivée estimée le {0}", new Date(c.expedition.arriveeEstimee).toLocaleDateString(t.loc))}` : ""}
            </p>
          </div>
          <Bouton href="/dashboard/sourcing?bloc=expeditions" variante="secondaire" petit>{t("Suivre l'expédition")}<ChevronRight size={11} /></Bouton>
        </div>
      )}

      {/* Déclarées « expédiée » ou « livrée » depuis l'ancien onglet Dropshipping, sans expédition suivie. */}
      {(cf.statut === "expedie" || cf.statut === "livre") && !cf.expeditionId && (
        <p className="text-[13px] text-[#111111]">
          <span className="font-bold">{t(cf.statut === "livre" ? "Livrée par {0}" : "Expédiée par {0}", nom)}</span>
          {cf.trackingNo && <span className="text-[#666666]"> · {t("Suivi {0}", cf.trackingNo)}</span>}
        </p>
      )}

      {cf.statut === "annule" && <p className="text-[13px] text-[#B91C1C] font-semibold">{t("Commande annulée chez {0}", nom)}</p>}

      {(cf.statut === "en_attente" || cf.statut === "envoye" || cf.statut === "confirme") && !cf.expeditionId && (
        // Le motif décide si l'annulation compte contre la fiabilité du fournisseur.
        <select disabled={charge} value="" aria-label={t("Annuler la commande fournisseur")} className="block text-[11px] text-[#666666] underline mt-3 bg-transparent"
          onChange={(e) => { if (e.target.value) statut("annule", e.target.value); }}>
          <option value="">{t("Annuler la commande fournisseur…")}</option>
          {Object.entries(MOTIFS_ANNULATION).map(([cle, libelle]) => <option key={cle} value={cle}>{t(libelle)}</option>)}
        </select>
      )}
    </div>
  );
}

const ORIGINES: Record<RouteLigne["origine"], { libelle: string; ton: "positif" | "info" | "attention" }> = {
  stock_local: { libelle: "Stock local", ton: "positif" },
  fournisseur: { libelle: "Fournisseur", ton: "info" },
  indisponible: { libelle: "Indisponible", ton: "attention" },
};

function BlocItineraire({ commandeId }: { commandeId: string }) {
  const t = useT();
  const { fmt } = useDevise();
  const { data, erreur, chargement } = useApi<Itineraire>(`/api/sourcing/routage?commandeId=${commandeId}`);

  return (
    <div className="mt-3 space-y-3">
      {erreur && <Erreur message={erreur} />}
      {chargement && !data && <Chargement />}
      {data && (
        <>
          <p className="text-[11px] text-[#AAAAAA] leading-relaxed">{t("Itinéraire proposé : rien n'est réservé ni commandé automatiquement.")}</p>
          {data.lignes.map((l) => (
            <div key={l.produitId} className="rounded-xl bg-[#FAFAFA] border border-[#F0F0F0] p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-semibold text-[#111111]">{l.quantite} × {l.nom}</p>
                <Pastille ton={ORIGINES[l.origine].ton}>{t(ORIGINES[l.origine].libelle)}</Pastille>
              </div>
              {l.etapes.length > 0 && (
                <ol className="flex items-center gap-x-1 gap-y-1 flex-wrap mt-2 text-[12px] text-[#111111]">
                  {l.etapes.map((e, i) => (
                    <li key={i} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight size={11} className="text-[#AAAAAA]" />}{e}
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-[12px] text-[#666666] mt-2 leading-relaxed">{l.explication}</p>
              {l.origine !== "indisponible" && (
                <p className="flex items-center gap-2 flex-wrap text-[12px] text-[#111111] mt-2">
                  <span>{t("Coût d'approvisionnement : {0}", l.cout === null ? "—" : fmt(l.cout))}</span>
                  <span>· {l.delaiJours > 0 ? t("Délai : {0} jours", l.delaiJours) : t("Disponible tout de suite")}</span>
                  <Estimation />
                </p>
              )}
            </div>
          ))}
          <div className="rounded-xl border border-[#E8E8E8] p-3 text-[12px]">
            <p className="font-semibold text-[#111111]">{t("Livraison locale au client")}</p>
            {data.transporteur ? (
              <p className="text-[#666666] mt-1">
                {data.transporteur.nom} · {t("Frais : {0}", fmt(data.transporteur.frais))}
                {data.transporteur.delai ? ` · ${t("Délai : {0}", data.transporteur.delai)}` : ""}
              </p>
            ) : <p className="text-[#666666] mt-1">{t("Aucun transporteur local configuré pour cette ville.")}</p>}
            <p className="flex items-center gap-2 flex-wrap text-[#111111] mt-2">
              <span>{t("Total approvisionnement : {0}", data.coutAppro === null ? "—" : fmt(data.coutAppro))}</span>
              <span>· {t("Prêt à livrer dans {0} jours", data.delaiApproJours)}</span>
              <Estimation />
            </p>
          </div>
          {data.lignes.some((l) => l.origine === "indisponible") && (
            <button type="button" onClick={versDossier} className="text-[12px] font-bold text-[#B45309] underline">{t("Rattacher un fournisseur")}</button>
          )}
        </>
      )}
    </div>
  );
}
