"use client";
// Écran de caisse AXSO POS 2.0 — chef d'orchestre.
//
//   barre : AXSO | magasin | caisse | caissier | état réseau
//   gauche : recherche / scan, catégories, articles      droite : panier, PAYER
//
// - Démarre par GET /api/pos/reglages (réglages, droits, caisse, session).
// - Le panier vit dans store/posStore ; le total affiché est calculé tout de
//   suite ici (calculerPanier), puis CONFIRMÉ par /api/pos/ventes/calculer :
//   c'est le serveur qui fait foi, et l'encaissement attend sa réponse.
// - La vente part par envoyerMutation("vente", …) avec la clé du store : la
//   même à chaque nouvel essai, donc jamais de doublon.
// - Scans : tout arrive par le bus (douchette clavier, caméra, téléphone) ; les
//   sources viennent de components/pos/scanner (bouton caméra, capteur clavier).
// - Raccourcis : F2 recherche, F3 client, F4 remise, F5 payer, F6 suspendre,
//   F7 reprendre, F8 retours, F9 caisse, Échap annuler. F5 ne recharge jamais.
// - Mode simple (reglages.mode) : scan → panier → paiement, le reste est replié.
// - Mode hors ligne (drapeau offline_pos, components/pos/hors-ligne) : sans
//   réseau, la caisse démarre et calcule sur le catalogue gardé sur l'appareil ;
//   la vente est mise en file et le reçu est PROVISOIRE. Drapeau éteint : rien
//   de tout cela n'est branché.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ShoppingCart, Smartphone, Store } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/I18nProvider";
import { DeviseProvider, useDevise } from "@/components/dashboard/DeviseProvider";
import { BadgeConnexion, Bouton, CLASSE_SAISIE, EtatChargement, EtatHorsLigne, EtatNonAutorise, EtatPos, Modale, Saisie, Tiroir } from "@/components/pos/ui";
import type { DonneesRecu } from "@/components/pos/recu/Recu";
import CapteurClavier from "@/components/pos/scanner/CapteurClavier";
import { useFluxPos } from "@/components/pos/scanner/useFluxPos";
import { surScan } from "@/lib/pos/client/bus";
import { envoyerMutation, nouvelleCle, type Reponse } from "@/lib/pos/client/transport";
import { repartirPaiements } from "@/lib/pos/paiements";
import { calculerPanier, decimalesDevise, libelleQuantite } from "@/lib/pos/tarification";
import type { ArticleResolu, DemandePaiementPos, PanierCalcule, ResultatVente } from "@/lib/pos/types";
import { usePosStore } from "@/store/posStore";
import { appelPos, CLE_CAISSE, type Demarrage } from "./api";
import { Catalogue } from "./Catalogue";
import { PaniersSuspendus, RemiseVente, SuspendrePanier } from "./Dialogues";
import { EditeurLigne } from "./EditeurLigne";
import { ligneDepuisArticle, lireNombre, precisionsRequises, versDemande, type ContenuPanier, type LigneCaisse } from "./logique";
import { Paiement } from "./Paiement";
import { Panier, type EtatCalcul } from "./Panier";
import { BandeauHorsLigne, EcranSynchronisation } from "@/components/pos/hors-ligne/Synchronisation";
import { demarrerHorsLigne, preparerHorsLigne, useHorsLigne } from "@/components/pos/hors-ligne/useHorsLigne";
import { ProduitInconnu } from "./ProduitInconnu";
import { RecuVente } from "./RecuVente";
import { SelecteurClient } from "./SelecteurClient";

type CaisseListee = { id: string; nom: string; actif: boolean; magasinNom: string };
type Fenetre = null | "client" | "ficheClient" | "remise" | "suspendre" | "suspendus" | "annuler" | "panier" | "appairage" | "synchronisation";

// Caméra du poste (lecture continue, émet sur le bus) : chargée à la demande, zxing ne pèse rien avant.
const BoutonScanner = dynamic(() => import("@/components/pos/scanner/BoutonScanner"), { ssr: false });
const ModaleAppairage = dynamic(() => import("@/components/pos/scanner/ModaleAppairage"), { ssr: false });
// Fiches du client (lot CRM) et de l'article (lot stock) : ouvertes à la demande, dans un tiroir.
const FicheClientCaisse = dynamic(() => import("@/components/pos/crm/FicheClientCaisse").then((m) => m.FicheClientCaisse), { ssr: false });
const FicheProduit = dynamic(() => import("@/components/pos/stock/FicheProduit"), { ssr: false });

const ETROIT = "(max-width: 767px)";
/** Téléphone : le panier passe dans un tiroir bas. */
function useEtroit() {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(ETROIT); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia(ETROIT).matches,
    () => false,
  );
}

function useEnLigne() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener("online", cb); window.addEventListener("offline", cb); return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); }; },
    () => navigator.onLine,
    () => true,
  );
}

export function EcranCaisse({ kiosque = false, actionsBarre, onNaviguer }: {
  /** Plein écran du caissier « pur » : pas de menu autour ; Retours et Session passent par `onNaviguer`. */
  kiosque?: boolean;
  /** Kiosque : ouvre l'onglet Retours ou Session. Absent : navigation vers la page du tableau de bord. */
  onNaviguer?: (ecran: "retours" | "session") => void;
  /** Boutons ajoutés au bout de la barre (déconnexion du kiosque). */
  actionsBarre?: React.ReactNode;
}) {
  const [caisseId, setCaisseId] = useState<string | null>(null);
  const [demarrage, setDemarrage] = useState<Demarrage | null>(null);
  const [etat, setEtat] = useState<"chargement" | "pret" | { code: string; message: string }>("chargement");
  const [caisses, setCaisses] = useState<CaisseListee[]>([]);

  const charger = useCallback(async (id: string | null): Promise<void> => {
    const r = await appelPos<Demarrage>("/api/pos/reglages", { caisseId: id });
    if (!r.ok) {
      // La caisse retenue sur ce poste n'existe plus ou n'est plus autorisée : on repart de la caisse par défaut.
      if (id && (r.status === 404 || r.status === 403)) { try { localStorage.removeItem(CLE_CAISSE); } catch { /* stockage indisponible */ } return charger(null); }
      return setEtat({ code: r.code, message: r.message });
    }
    setDemarrage(r.donnees);
    setCaisseId(r.donnees.caisse?.id ?? null);
    setEtat("pret");
    const c = await appelPos<{ caisses?: CaisseListee[] }>("/api/pos/caisses", { caisseId: r.donnees.caisse?.id });
    if (c.ok) setCaisses((c.donnees.caisses ?? []).filter((x) => x.actif));
  }, []);

  useEffect(() => {
    let retenue: string | null = null;
    try { retenue = localStorage.getItem(CLE_CAISSE); } catch { /* stockage indisponible */ }
    // Poste déjà utilisé hors ligne : sa base locale est rouverte d'abord, pour que la caisse démarre même sans réseau.
    preparerHorsLigne().finally(() => charger(retenue));
  }, [charger]);

  const changerCaisse = (id: string) => {
    try { localStorage.setItem(CLE_CAISSE, id); } catch { /* stockage indisponible */ }
    setEtat("chargement");
    charger(id);
  };

  if (etat === "chargement" && !demarrage) return <EtatChargement texte="Ouverture de la caisse…" />;
  if (typeof etat === "object" || !demarrage) {
    const e = typeof etat === "object" ? etat : { code: "erreur_serveur", message: "La caisse n'a pas pu démarrer." };
    return <EtatPos code={e.code} message={e.message} onReessayer={() => { setEtat("chargement"); charger(caisseId); }} />;
  }
  return (
    <DeviseProvider devise={demarrage.boutique.devise || "XAF"}>
      <Caisse d={demarrage} caisseId={caisseId} caisses={caisses} recharge={etat === "chargement"} kiosque={kiosque} actionsBarre={actionsBarre} onNaviguer={onNaviguer}
        onChangerCaisse={changerCaisse} onRecharger={() => charger(caisseId)} />
    </DeviseProvider>
  );
}

function Caisse({ d, caisseId, caisses, recharge, kiosque, actionsBarre, onNaviguer, onChangerCaisse, onRecharger }: {
  d: Demarrage; caisseId: string | null; caisses: CaisseListee[]; recharge: boolean; kiosque: boolean; actionsBarre?: React.ReactNode;
  onNaviguer?: (ecran: "retours" | "session") => void;
  onChangerCaisse: (id: string) => void; onRecharger: () => Promise<void>;
}) {
  const t = useT();
  const router = useRouter();
  const { fmt, devise } = useDevise();
  const etroit = useEtroit();
  const navigateurEnLigne = useEnLigne();
  // Mode hors ligne en service : l'état vient d'un appel de contrôle au serveur, pas seulement du navigateur.
  const hl = useHorsLigne();
  const enLigne = hl.actif ? hl.enLigne : navigateurEnLigne;
  const { lignes, remise, codePromo, client, note } = usePosStore();
  const champ = useRef<HTMLInputElement>(null);
  const [fenetre, setFenetre] = useState<Fenetre>(null);
  const [edition, setEdition] = useState<{ ligne: LigneCaisse; nouveau: boolean } | null>(null);
  const [inconnu, setInconnu] = useState<string | null>(null);
  const [veutPayer, setVeutPayer] = useState(false);
  // Avoir choisi sur la fiche du client : proposé à l'ouverture du paiement. Fiche d'article ouverte depuis une ligne.
  const [avoirChoisi, setAvoirChoisi] = useState<{ code: string; solde: number } | null>(null);
  const [ficheArticle, setFicheArticle] = useState<{ produitId: string; varianteId: string | null; nom: string } | null>(null);
  const naviguer = (ecran: "retours" | "session") => (onNaviguer ? onNaviguer(ecran) : router.push(`/dashboard/pos/${ecran}`));
  // F3 / bouton Client : la fiche du client associé (points, crédit, avoirs), sinon la recherche.
  const ouvrirClient = () => setFenetre(usePosStore.getState().client ? "ficheClient" : "client");
  useEffect(() => { setAvoirChoisi(null); }, [client?.id]);
  const [recu, setRecu] = useState<{ donnees: DonneesRecu; commandeId: string; rejoue: boolean; provisoire: boolean } | null>(null);
  const [version, setVersion] = useState(0);
  const [annonce, setAnnonce] = useState("");

  const modeSimple = d.mode === "simple";
  const fermee = d.sessionObligatoire && !d.session;
  // Téléphones appairés (drapeau scanner_v2) : leurs scans arrivent par le flux temps réel, qui les remet sur le bus.
  const telephones = d.flags.scanner_v2;
  useFluxPos({ caisseId, actif: telephones && !fermee });
  // Présence de l'écran de vente : sans ce signal, le serveur refuse les scans de vente des téléphones
  // (ils n'iraient dans aucun panier). Retiré dès qu'on quitte l'écran.
  useEffect(() => {
    if (!telephones || fermee) return;
    const signaler = (ecran: "vente" | null) => void appelPos("/api/pos/scanner/signal", { method: "POST", caisseId, corps: { ecran } });
    signaler("vente");
    const minuterie = setInterval(() => signaler("vente"), 15_000);
    return () => { clearInterval(minuterie); signaler(null); };
  }, [telephones, fermee, caisseId]);
  const focusRecherche = useCallback(() => { setTimeout(() => champ.current?.focus(), 0); }, []);
  useEffect(() => {
    demarrerHorsLigne(d, caisseId).then((restaure) => { if (restaure) toast.message(t("Le panier en cours avant le rechargement a été restauré.")); });
  }, [d, caisseId, t]);

  // ── Total : calcul local immédiat, puis confirmation du serveur ──────────────
  const local = useMemo(() => calculerPanier(lignes, {
    tauxTVA: d.boutique.tauxTVA, droits: d.droits, client, devise,
    prixTTC: d.reglages.taxes.prixTTC, plafondRemisePct: d.reglages.remises.plafondPct, remise,
  }), [lignes, remise, client, devise, d]);
  const signature = useMemo(() => (lignes.length ? JSON.stringify({ lignes: lignes.map(versDemande), clientId: client?.id ?? null, remise, codePromo: codePromo || null }) : ""), [lignes, client, remise, codePromo]);
  const [serveur, setServeur] = useState<{ signature: string; panier: PanierCalcule } | null>(null);
  const [refusCalcul, setRefusCalcul] = useState<{ signature: string; code: string; message: string } | null>(null);
  const [essaiCalcul, setEssaiCalcul] = useState(0);

  useEffect(() => {
    if (!signature) return;
    const ctrl = new AbortController();
    const minuterie = setTimeout(async () => {
      const r = await appelPos<{ panier: PanierCalcule }>("/api/pos/ventes/calculer", { method: "POST", caisseId, corps: JSON.parse(signature), signal: ctrl.signal });
      if (ctrl.signal.aborted || (!r.ok && r.code === "annule")) return;
      if (r.ok) { setServeur({ signature, panier: r.donnees.panier }); setRefusCalcul(null); }
      else setRefusCalcul({ signature, code: r.code, message: r.message });
    }, 250);
    return () => { clearTimeout(minuterie); ctrl.abort(); };
  }, [signature, caisseId, essaiCalcul]);
  // Le réseau revient : on redemande la confirmation du total.
  useEffect(() => { if (enLigne) setEssaiCalcul((n) => n + 1); }, [enLigne]);

  const confirme = !!signature && serveur?.signature === signature;
  const panier = confirme ? serveur!.panier : local;
  const erreurCalcul = signature && refusCalcul?.signature === signature ? refusCalcul : null;
  const etatCalcul: EtatCalcul = confirme ? "confirme" : erreurCalcul ? "erreur" : "attente";
  const bloquant = panier.alertes.some((a) => a.bloquant);
  // Refus du serveur, panier vidé ou alerte bloquante : la demande de paiement en attente tombe.
  useEffect(() => { if (erreurCalcul || !signature || bloquant) setVeutPayer(false); }, [erreurCalcul, signature, bloquant]);
  const paiementOuvert = veutPayer && confirme && !bloquant && lignes.length > 0;

  // ── Ajout d'un article ───────────────────────────────────────────────────────
  const ajouterArticle = useCallback((a: ArticleResolu, parScan = false) => {
    if (!a.actif) { toast.error(t("« {0} » est désactivé et ne peut pas être vendu.", a.nom)); return; }
    const ligne = ligneDepuisArticle(a);
    const p = precisionsRequises(a);
    if (p.variante || p.poids || p.serie) { setEdition({ ligne, nouveau: true }); return; }
    usePosStore.getState().ajouter(ligne);
    const message = t("{0} ajouté au panier", `${a.nom}${a.uniteVente === "kg" ? ` (${libelleQuantite(ligne.quantite, "kg")})` : ""}`);
    setAnnonce(message);
    // Au scan, le caissier regarde l'article ou la caméra, pas le panier : confirmation visible.
    if (parScan) toast.success(message);
  }, [t]);

  // ── Scans (bus) ──────────────────────────────────────────────────────────────
  // Une fenêtre de saisie est ouverte (paiement, ligne, client…) : un scan n'y a pas sa place.
  const occupe = paiementOuvert || !!edition || !!inconnu || !!ficheArticle || (fenetre !== null && fenetre !== "panier");
  // Aucun scan n'est perdu : celui qui arrive pendant une fenêtre attend ici, puis rejoint le panier à sa fermeture.
  const scansEnAttente = useRef<string[]>([]);
  const reprise = useRef(false);
  const [nbEnAttente, setNbEnAttente] = useState(0);
  const surCode = async (code: string) => {
    if (fermee) return;
    // Scanner l'article du client suivant referme le reçu de la vente précédente.
    if (recu && !occupe) setRecu(null);
    else if (occupe) {
      scansEnAttente.current.push(code);
      setNbEnAttente(scansEnAttente.current.length);
      toast.warning(t("Scan mis en attente ({0}) : il sera ajouté au panier dès la fermeture de cette fenêtre.", scansEnAttente.current.length), { id: "scans-en-attente", duration: 8000 });
      return;
    }
    const r = await appelPos<{ article: ArticleResolu }>(`/api/pos/scan?code=${encodeURIComponent(code)}`, { caisseId });
    if (r.ok) return ajouterArticle(r.donnees.article, true);
    if (r.code === "inconnu") return setInconnu(code);
    toast.error(t(r.message));
  };
  const surCodeRef = useRef(surCode);
  surCodeRef.current = surCode;
  useEffect(() => surScan((scan) => { if (!scan.contexte || scan.contexte === "vente") surCodeRef.current(scan.code); }), []);
  // Fenêtre refermée : les scans en attente sont repris un par un (l'un d'eux peut rouvrir une fenêtre — variante, poids — et faire patienter les suivants).
  useEffect(() => {
    // Tant que le reçu de la vente est affiché, on attend aussi : le reprendre ici le refermerait avant l'impression.
    if (occupe || recu || reprise.current || !scansEnAttente.current.length) return;
    reprise.current = true;
    const code = scansEnAttente.current.shift()!;
    void surCodeRef.current(code).finally(() => { reprise.current = false; setNbEnAttente(scansEnAttente.current.length); });
  }, [occupe, recu, nbEnAttente]);

  // ── Encaissement ─────────────────────────────────────────────────────────────
  const encaisser = async (paiements: DemandePaiementPos[]): Promise<Reponse<ResultatVente>> => {
    const s = usePosStore.getState();
    const r = await envoyerMutation<ResultatVente>("vente", {
      lignes: s.lignes.map(versDemande), clientId: s.client?.id ?? null, paiements,
      remise: s.remise, codePromo: s.codePromo || null, note: s.note || null,
    }, s.cleVente, { caisseId });
    if (!r.ok) {
      // La caisse a été fermée ailleurs entre-temps : l'écran repasse sur l'ouverture de caisse.
      if (r.code === "caisse_fermee") onRecharger();
      return r;
    }
    const v = r.donnees;
    // Vente gardée sur l'appareil (hors ligne) : numéro provisoire, rien n'est encore sur le serveur.
    const provisoire = (v as { provisoire?: boolean }).provisoire === true;
    // Rejeu d'une vente dont le contenu a changé depuis : seul ce que le serveur rend est sûr.
    const fidele = !r.rejoue || v.total === panier.total;
    let repartis: ReturnType<typeof repartirPaiements>["paiements"] = [];
    try { if (fidele) repartis = repartirPaiements(panier.total, paiements, decimalesDevise(devise)).paiements; } catch { /* déjà validé par l'écran de paiement */ }
    setRecu({
      commandeId: v.commandeId, rejoue: r.rejoue, provisoire,
      donnees: {
        numero: v.numero, date: new Date().toISOString(),
        boutique: { nom: d.boutique.nomBoutique, adresse: d.magasin?.adresse ?? d.boutique.adresse, telephone: d.magasin?.telephone ?? d.boutique.telephone },
        magasin: d.magasin?.nom, caisse: d.caisse?.nom, caissier: d.utilisateur.nom, client: s.client?.nom ?? null,
        lignes: fidele ? panier.lignes.map((l, i) => ({
          nom: s.lignes[i]?.nom || l.nom, variante: s.lignes[i]?.nom ? l.variante : null,
          quantite: libelleQuantite(l.quantite, l.uniteVente), prix: l.prixApplique, unite: l.uniteVente === "kg" ? " /kg" : "",
          montant: l.brut - l.remiseLigne - l.remisePromotion, remise: l.remiseLigne + l.remisePromotion, offert: !!l.offert,
          commentaire: l.commentaire, numeroSerie: l.numeroSerie,
        })) : null,
        sousTotal: panier.sousTotal, totalRemises: panier.totalRemises, taxes: fidele ? panier.taxesParTaux : [], prixTTC: d.reglages.taxes.prixTTC,
        total: v.total,
        paiements: repartis.map((p) => {
          const def = d.modesPaiement.find((m) => m.id === p.mode);
          return { libelle: (def?.libelle ?? p.mode) + (provisoire && def?.statut === "declaratif" ? ` (${t("à confirmer")})` : ""), montant: p.montant, nonVerifie: def?.statut === "declaratif", reference: p.reference, recu: p.montantRecu };
        }),
        du: v.du, monnaie: v.monnaie,
        entete: provisoire ? [d.reglages.recu.entete, t("REÇU PROVISOIRE — EN ATTENTE DE SYNCHRONISATION")].filter(Boolean).join("\n") : d.reglages.recu.entete, piedDePage: d.reglages.recu.piedDePage, afficherTVA: d.reglages.recu.afficherTVA, format: d.reglages.recu.format,
      },
    });
    s.vider();
    setVeutPayer(false);
    setAvoirChoisi(null);
    setFenetre(null);
    setVersion((n) => n + 1);
    return r;
  };

  // ── Mise en attente ──────────────────────────────────────────────────────────
  // Une clé par contenu de panier : un nouvel essai du même panier ne le suspend pas deux fois.
  const cleSuspension = useRef<string | null>(null);
  useEffect(() => { cleSuspension.current = null; }, [signature]);
  const suspendre = async (libelle: string) => {
    const s = usePosStore.getState();
    cleSuspension.current ??= nouvelleCle();
    const instantane: ContenuPanier = { lignes: s.lignes, remise: s.remise, codePromo: s.codePromo, client: s.client, note: s.note };
    const r = await envoyerMutation("panier.suspendre", {
      libelle: libelle || null, clientId: s.client?.id ?? null,
      contenu: { lignes: s.lignes.map(versDemande), remise: s.remise, codePromo: s.codePromo || null, caisse: instantane },
    }, cleSuspension.current, { caisseId });
    if (!r.ok) return { code: r.code, message: r.message };
    s.vider();
    setFenetre(null);
    toast.success((r.donnees as { local?: boolean })?.local ? t("Panier mis en attente sur cet appareil : il n'est visible que de cette caisse.") : t("Panier mis en attente."));
    focusRecherche();
    return null;
  };

  // ── Raccourcis clavier ───────────────────────────────────────────────────────
  const raccourci = (e: KeyboardEvent) => {
    const dialogue = !!document.querySelector("dialog[open]");
    if (e.key === "Escape") { if (!dialogue && lignes.length) { e.preventDefault(); setFenetre("annuler"); } return; }
    if (!/^F[2-9]$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
    // Toujours : F5 ne doit jamais recharger la page au milieu d'une vente.
    e.preventDefault();
    if (dialogue || fermee) return;
    if (e.key === "F2") { champ.current?.focus(); champ.current?.select(); }
    else if (e.key === "F3") ouvrirClient();
    else if (e.key === "F4") { if (lignes.length) setFenetre("remise"); }
    else if (e.key === "F5") { if (lignes.length && !bloquant && !erreurCalcul) setVeutPayer(true); }
    else if (e.key === "F6") { if (lignes.length && d.droits.suspendre_panier) setFenetre("suspendre"); }
    else if (e.key === "F7") setFenetre("suspendus");
    else if (e.key === "F8") { if (d.droits.retour) naviguer("retours"); }
    else if (e.key === "F9") naviguer("session");
  };
  const raccourciRef = useRef(raccourci);
  raccourciRef.current = raccourci;
  useEffect(() => {
    const ecoute = (e: KeyboardEvent) => raccourciRef.current(e);
    window.addEventListener("keydown", ecoute, true);
    return () => window.removeEventListener("keydown", ecoute, true);
  }, []);

  useEffect(() => { if (!fermee) focusRecherche(); }, [fermee, focusRecherche]);

  const fermer = () => { setFenetre(null); focusRecherche(); };
  const panierNoeud = (
    <Panier panier={panier} etatCalcul={etatCalcul} erreurCalcul={erreurCalcul} paiementDemande={veutPayer && !paiementOuvert} onReverifier={() => setEssaiCalcul((n) => n + 1)} modeSimple={modeSimple} caisseId={caisseId}
      droits={d.droits} onNaviguer={naviguer}
      onModifier={(id) => { const l = usePosStore.getState().lignes.find((x) => x.id === id); if (l) setEdition({ ligne: l, nouveau: false }); }}
      onPayer={() => setVeutPayer(true)} onClient={ouvrirClient} onRemise={() => setFenetre("remise")}
      onSuspendre={() => setFenetre("suspendre")} onReprendre={() => setFenetre("suspendus")} onAnnuler={() => setFenetre("annuler")} onAjouter={ajouterArticle} />
  );

  return (
    <div className="flex flex-col gap-3" style={{ "--pos-chrome": kiosque ? "9.5rem" : "10.5rem" } as React.CSSProperties}>
      <p className="sr-only" role="status" aria-live="polite">{annonce}</p>
      {/* Douchette USB / Bluetooth quand le curseur n'est pas dans un champ (le champ de recherche gère la sienne). */}
      <CapteurClavier contexte="vente" caisseId={caisseId} actif={!fermee} />

      {/* Barre : AXSO | magasin | caisse | caissier | réseau */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-[#111111] px-3 py-2 text-white sm:px-4">
        <span className="text-[15px] font-bold tracking-wide text-[#F5A623]">AXSO</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-semibold"><Store size={14} aria-hidden className="flex-shrink-0 text-white/60" /><span className="truncate">{d.magasin?.nom ?? d.boutique.nomBoutique}</span></span>
        {caisses.length > 1 ? (
          <label className="flex items-center gap-1.5 text-[12px] text-white/70">
            <span className="sr-only sm:not-sr-only">{t("Caisse")}</span>
            <select value={caisseId ?? ""} onChange={(e) => onChangerCaisse(e.target.value)} disabled={recharge || lignes.length > 0}
              title={lignes.length > 0 ? t("Terminez la vente en cours avant de changer de caisse.") : undefined}
              className={`${CLASSE_SAISIE} !min-h-11 !w-auto max-w-[11rem] !py-1 text-[12.5px] font-semibold`}>
              {caisses.map((c) => <option key={c.id} value={c.id}>{caisses.some((x) => x.magasinNom !== c.magasinNom) ? `${c.magasinNom} — ${c.nom}` : c.nom}</option>)}
            </select>
          </label>
        ) : <span className="text-[12.5px] font-semibold text-white/80">{d.caisse?.nom}</span>}
        <span className="min-w-0 flex-1 truncate text-right text-[12.5px] text-white/80">{d.utilisateur.nom}</span>
        {telephones && d.droits.gerer_appareils && !modeSimple && (
          <button type="button" onClick={() => setFenetre("appairage")} aria-label={t("Connecter un scanner")} title={t("Connecter un scanner")}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <Smartphone size={17} aria-hidden />
          </button>
        )}
        {hl.actif || hl.enAttente > 0 || hl.aTraiter > 0 ? (
          <button type="button" onClick={() => setFenetre("synchronisation")} aria-label={t("Ouvrir la synchronisation")} title={t("Synchronisation")}
            className="flex min-h-11 flex-shrink-0 items-center rounded-xl px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <BadgeConnexion etat={!enLigne ? "hors_ligne" : hl.synchronisation ? "synchronisation" : "en_ligne"} enAttente={hl.enAttente + hl.aTraiter} />
          </button>
        ) : <BadgeConnexion etat={enLigne ? "en_ligne" : "hors_ligne"} />}
        {actionsBarre}
      </header>

      {hl.actif || hl.enAttente > 0 || hl.aTraiter > 0 ? <BandeauHorsLigne onOuvrir={() => setFenetre("synchronisation")} /> : !enLigne && (
        <EtatHorsLigne compact titre="Mode hors ligne" texte="La connexion est interrompue. Vous pouvez continuer à préparer le panier ; l'encaissement, la recherche et le scan reprendront dès le retour du réseau. Aucune vente n'est enregistrée tant que la caisse ne l'a pas confirmé." />
      )}

      {fermee ? (
        <OuvertureCaisse d={d} caisseId={caisseId} onOuverte={onRecharger} />
      ) : (
        <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
          <Catalogue caisseId={caisseId} modeSimple={modeSimple} champRef={champ} onAjouter={ajouterArticle} version={version}
            actions={<BoutonScanner contexte="vente" caisseId={caisseId} className="min-h-12 flex-shrink-0" />} />
          {!etroit && (
            <aside className="sticky top-0 flex max-h-[calc(100dvh-var(--pos-chrome))] min-h-[24rem] flex-col rounded-2xl border border-[#E8E8E8] bg-white p-3">
              {panierNoeud}
            </aside>
          )}
        </div>
      )}

      {/* Téléphone : le panier est un tiroir bas, résumé dans une barre toujours visible. */}
      {etroit && !fermee && (
        <div className="sticky bottom-2 z-10 flex items-center gap-2 rounded-2xl bg-[#111111] p-2 shadow-xl">
          <button type="button" onClick={() => setFenetre("panier")} className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <ShoppingCart size={18} aria-hidden className="flex-shrink-0 text-[#F5A623]" />
            <span className="min-w-0">
              <span className="block text-[11px] text-white/70">{t("Panier")} · {t("{0} article(s)", panier.articles)}</span>
              <span className="block truncate text-[16px] font-bold tabular-nums">{fmt(panier.total)}</span>
            </span>
          </button>
          <Bouton onClick={() => setVeutPayer(true)} disabled={!lignes.length || bloquant || !!erreurCalcul} charge={veutPayer && !paiementOuvert && lignes.length > 0} className="min-h-12">{t("Payer")}</Bouton>
        </div>
      )}
      {etroit && fenetre === "panier" && <Modale ouverte onFermer={fermer} titre="Panier">{panierNoeud}</Modale>}

      {edition && (
        <EditeurLigne key={edition.ligne.id} ligne={edition.ligne} nouveau={edition.nouveau} droits={d.droits} plafondRemisePct={d.reglages.remises.plafondPct} modeSimple={modeSimple}
          onFermer={() => { setEdition(null); if (edition.nouveau) focusRecherche(); }}
          onFiche={modeSimple || !d.droits.voir_stock || !enLigne ? undefined : () => { setFicheArticle({ produitId: edition.ligne.produitId, varianteId: edition.ligne.varianteId ?? null, nom: edition.ligne.nom }); setEdition(null); }}
          onRetirer={() => { usePosStore.getState().retirer(edition.ligne.id); setEdition(null); }}
          onValider={(l) => {
            const s = usePosStore.getState();
            if (edition.nouveau) { s.ajouter(l); setAnnonce(t("{0} ajouté au panier", l.nom)); focusRecherche(); } else s.modifier(l.id, l);
            setEdition(null);
          }} />
      )}
      {inconnu && (
        <ProduitInconnu code={inconnu} caisseId={caisseId} peutCreer={d.droits.creer_produit} tauxTVABoutique={d.boutique.tauxTVA}
          onFermer={() => { setInconnu(null); focusRecherche(); }} onRechercher={() => { setInconnu(null); focusRecherche(); }}
          onCree={(a) => { setInconnu(null); setVersion((n) => n + 1); ajouterArticle(a); focusRecherche(); }} />
      )}
      {fenetre === "client" && (
        <SelecteurClient caisseId={caisseId} peutCreer={d.droits.vendre || d.droits.gerer_clients} onFermer={() => setFenetre(null)}
          onChoisir={(c) => { usePosStore.getState().definir({ client: c }); setFenetre(null); }} />
      )}
      {fenetre === "ficheClient" && client && (
        <Tiroir ouverte onFermer={fermer} titre={client.nom} description="Fidélité, crédit, avoirs et derniers achats de ce client."
          actions={<>
            <Bouton variante="secondaire" onClick={() => { usePosStore.getState().definir({ client: null }); fermer(); }}>{t("Retirer de la vente")}</Bouton>
            <Bouton variante="secondaire" onClick={() => setFenetre("client")}>{t("Changer de client")}</Bouton>
          </>}>
          <FicheClientCaisse clientId={client.id} caisseId={caisseId}
            // Points changés en avoir, ou avoir existant choisi : il sera proposé comme premier paiement.
            onAvoirCree={(a) => setAvoirChoisi({ code: a.code, solde: a.montant })}
            onUtiliserAvoir={(a) => { setAvoirChoisi(a); fermer(); toast.success(t("Avoir {0} retenu : il sera proposé au paiement.", a.code)); }} />
        </Tiroir>
      )}
      {ficheArticle && (
        <Tiroir ouverte onFermer={() => { setFicheArticle(null); focusRecherche(); }} largeur="lg" titre={ficheArticle.nom} description="Stock par lieu, ventes et analyse de cet article.">
          <FicheProduit produitId={ficheArticle.produitId} varianteId={ficheArticle.varianteId} caisseId={caisseId} />
        </Tiroir>
      )}
      {fenetre === "remise" && (
        <RemiseVente remise={remise} codePromo={codePromo} note={note} peutRemiser={d.droits.remise} horsPlafond={d.droits.remise_hors_plafond} plafondPct={d.reglages.remises.plafondPct}
          onFermer={fermer} onValider={(v) => { usePosStore.getState().definir(v); fermer(); }} />
      )}
      {fenetre === "appairage" && <ModaleAppairage ouverte onFermer={fermer} caisseId={caisseId} caisseNom={d.caisse?.nom} />}
      {fenetre === "synchronisation" && <EcranSynchronisation ouverte onFermer={fermer} />}
      {fenetre === "suspendre" && <SuspendrePanier onFermer={fermer} onValider={suspendre} />}
      {fenetre === "suspendus" && (
        <PaniersSuspendus caisseId={caisseId} panierOccupe={lignes.length > 0} onFermer={fermer}
          onReprendre={(contenu) => { usePosStore.getState().charger(contenu); fermer(); }} />
      )}
      <Modale ouverte={fenetre === "annuler"} onFermer={fermer} taille="sm" titre="Annuler la vente en cours ?" description="Le panier sera vidé. Rien n'a été encaissé ni enregistré."
        actions={<><Bouton variante="secondaire" onClick={fermer}>{t("Garder la vente")}</Bouton><Bouton variante="danger" onClick={() => { usePosStore.getState().vider(); fermer(); }}>{t("Vider le panier")}</Bouton></>}>
        <p className="text-[13px] text-[#555555]">{t("{0} article(s) pour {1}.", panier.articles, fmt(panier.total))}</p>
      </Modale>
      {paiementOuvert && (
        <Paiement total={panier.total} modes={d.modesPaiement} creditActif={d.reglages.credit.actif} droitCredit={d.droits.vente_credit} client={client} caisseId={caisseId} avoir={avoirChoisi}
          horsLigne={hl.actif && (!enLigne || hl.reconnexion)}
          onChoisirClient={() => setFenetre("client")} onEncaisser={encaisser} onFermer={() => { setVeutPayer(false); focusRecherche(); }} />
      )}
      {recu && (
        <RecuVente recu={recu.donnees} commandeId={recu.commandeId} rejoue={recu.rejoue} provisoire={recu.provisoire} caisseId={caisseId} peutAnnuler={d.droits.annuler_vente}
          onFermer={() => { setRecu(null); focusRecherche(); }}
          onAnnulee={() => { setRecu(null); setVersion((n) => n + 1); toast.success(t("Vente annulée : le stock et les paiements ont été remis en ordre.")); focusRecherche(); }} />
      )}
    </div>
  );
}

/** Caisse fermée alors que la session est obligatoire : fonds de caisse puis ouverture. */
function OuvertureCaisse({ d, caisseId, onOuverte }: { d: Demarrage; caisseId: string | null; onOuverte: () => Promise<void> }) {
  const t = useT();
  const { devise } = useDevise();
  const [fonds, setFonds] = useState(String(d.reglages.caisse.fondsInitialDefaut || 0));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null);
  // Une clé par demande d'ouverture : un double appui n'ouvre pas deux sessions.
  const cle = useRef(nouvelleCle());

  if (!d.droits.ouvrir_caisse) {
    return <EtatNonAutorise titre="La caisse est fermée" texte="Une session de caisse doit être ouverte avant de vendre, et votre compte ne peut pas l'ouvrir. Demandez à un responsable." />;
  }
  const montant = lireNombre(fonds);
  const ouvrir = async () => {
    if (montant === null) return setErreur({ code: "invalide", message: "Indiquez le fonds de caisse (0 si le tiroir est vide)." });
    setEnvoi(true); setErreur(null);
    const r = await envoyerMutation("caisse.ouvrir", { fondsInitial: montant }, cle.current, { caisseId });
    // Déjà ouverte ailleurs : on recharge, l'écran de vente s'affiche.
    if (r.ok || r.code === "caisse_deja_ouverte") { await onOuverte(); cle.current = nouvelleCle(); }
    else setErreur({ code: r.code, message: r.message });
    setEnvoi(false);
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); ouvrir(); }} className="mx-auto w-full max-w-md space-y-4 rounded-2xl border border-[#E8E8E8] bg-white p-5">
      <div>
        <h2 className="text-[17px] font-bold text-[#111111]">{t("Ouvrir la caisse")}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[#666666]">{t("Comptez les espèces présentes dans le tiroir : c'est le fonds de caisse. Il sert à calculer le montant attendu à la fermeture.")}</p>
      </div>
      <Saisie label="Fonds de caisse" inputMode="decimal" autoFocus value={fonds} onChange={(e) => setFonds(e.target.value)} onFocus={(e) => e.target.select()} suffixe={devise} disabled={envoi} />
      {erreur && <EtatPos compact code={erreur.code} message={erreur.message} />}
      <Bouton type="submit" taille="grand" large charge={envoi}>{t("Ouvrir la caisse")}</Bouton>
    </form>
  );
}
