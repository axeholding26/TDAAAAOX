// Moteur hors ligne de la caisse — NAVIGATEUR uniquement.
//
// Tient l'état du poste (en ligne ?, ventes en attente, âge du catalogue) et
// fait le lien entre l'écran, IndexedDB (bd.ts) et le serveur (/api/pos/sync) :
//   - détection de connexion : un appel léger au serveur, pas seulement
//     navigator.onLine (qui dit « connecté » derrière un Wi-Fi sans Internet) ;
//   - instantané du catalogue, rafraîchi en ligne, daté ;
//   - lectures de la caisse servies par l'instantané quand le réseau manque
//     (`repliLectures`, branché sur appelPos par components/pos/hors-ligne) ;
//   - vente hors ligne : calcul local, mise en file, stock local décrémenté
//     (relais posé sur envoyerMutation) ;
//   - rejeu de la file au retour du réseau (logique : file.ts).
//
// Rien ne tourne tant que le drapeau `offline_pos` est éteint et qu'aucune
// vente n'attend sur ce poste : la caisse se comporte alors comme sans ce fichier.
//
// La logique (calcul, file, classement des réponses) est dans des fichiers
// purs ; ici il n'y a que les branchements.
import type { Demarrage } from "@/components/pos/caisse/api";
import { definirRelaisHorsLigne, envoyerJson, nouvelleCle, type RelaisMutation, type Reponse } from "../client/transport";
import type { LigneDemande, Remise } from "../types";
import * as stock from "./bd";
import {
  META_VIDE, VERSION_INSTANTANE, appliquerSorties, calculerLocal, preparerVenteLocale, rechercherLocal, resoudreLocal, trierArticles,
  type ArticleLocal, type ClientLocal, type MetaLocale,
} from "./catalogue-local";
import { compterFile, exporterFile, purgeables, rejouerFile, type Mutation, type ResultatRejeu } from "./file";
import { ErreurPos } from "../erreurs";

export type EtatHorsLigne = {
  /** Le mode hors ligne est en service sur ce poste (drapeau actif, base locale ouverte). */
  actif: boolean;
  /** Le serveur répond (dernier appel de contrôle). */
  enLigne: boolean;
  synchronisation: boolean;
  /** Session expirée, ou file saisie par un autre compte : la file attend une reconnexion. */
  reconnexion: boolean;
  enAttente: number;
  aTraiter: number;
  conflits: number;
  /** Date de l'instantané du catalogue ; null = pas encore téléchargé (première ouverture en ligne obligatoire). */
  catalogueAt: string | null;
  articles: number;
  derniereSynchroAt: string | null;
  /** Pourquoi la file est arrêtée (phrase du serveur), s'il y a lieu. */
  blocage: string | null;
  /** Le navigateur a promis de ne pas purger le stockage (null = pas encore demandé). */
  persistant: boolean | null;
};

const MARQUEUR = "axso_pos_hl";
const POSTE = "axso_pos_poste";
const AGE_MAX_CATALOGUE = 10 * 60_000;
const CLIENTS_MAX = 200;

let etat: EtatHorsLigne = { actif: false, enLigne: true, synchronisation: false, reconnexion: false, enAttente: 0, aTraiter: 0, conflits: 0, catalogueAt: null, articles: 0, derniereSynchroAt: null, blocage: null, persistant: null };
const abonnes = new Set<() => void>();
let bd: IDBDatabase | null = null;
let tenantId: string | null = null;
let meta: MetaLocale = META_VIDE;
let articles: ArticleLocal[] = [];
let clients: ClientLocal[] = [];
let dernierDemarrage: Demarrage | null = null;
let caisseCourante: string | null = null;
let minuterie: ReturnType<typeof setTimeout> | null = null;
let passage: Promise<void> | null = null;
let tour: Promise<void> | null = null;
let ecoute = false;

export const lireEtat = () => etat;
export function abonner(cb: () => void): () => void { abonnes.add(cb); return () => { abonnes.delete(cb); }; }
function maj(modif: Partial<EtatHorsLigne>) {
  if ((Object.keys(modif) as (keyof EtatHorsLigne)[]).every((k) => etat[k] === modif[k])) return;
  etat = { ...etat, ...modif };
  abonnes.forEach((cb) => cb());
}

const local = {
  lire(cle: string): string | null { try { return localStorage.getItem(cle); } catch { return null; } },
  ecrire(cle: string, v: string | null) { try { if (v === null) localStorage.removeItem(cle); else localStorage.setItem(cle, v); } catch { /* stockage indisponible */ } },
};

/** Identifiant de ce poste (navigateur), créé une fois : il accompagne chaque mutation. */
export function idPoste(): string {
  let id = local.lire(POSTE);
  if (!id) { id = nouvelleCle(); local.ecrire(POSTE, id); }
  return id;
}

// ── Base locale ────────────────────────────────────────────────────────────────

async function ouvrir(tenant: string) {
  bd = await stock.ouvrirBase(tenant);
  tenantId = tenant;
  const tout = await stock.tous<ArticleLocal | MetaLocale>(bd, "catalogue");
  const fiche = tout.find((x): x is MetaLocale => x.id === "__meta");
  // Format d'instantané d'une autre version : on garde les réglages, le catalogue sera retéléchargé.
  meta = fiche ? (fiche.version === VERSION_INSTANTANE ? fiche : { ...fiche, version: VERSION_INSTANTANE, genereAt: null }) : META_VIDE;
  articles = meta.genereAt ? trierArticles(tout.filter((x): x is ArticleLocal => x.id !== "__meta")) : [];
  clients = await stock.tous<ClientLocal>(bd, "clients");
  maj({ catalogueAt: meta.genereAt, articles: articles.length, derniereSynchroAt: meta.derniereSynchroAt });
  await rafraichirCompteurs();
}

async function sauverMeta(modif: Partial<MetaLocale>) {
  meta = { ...meta, ...modif, id: "__meta" };
  if (bd) await stock.ecrire(bd, "catalogue", [meta]);
}

async function rafraichirCompteurs() {
  if (!bd) return;
  maj(compterFile(await stock.lireFile(bd)));
}

// ── Connexion ──────────────────────────────────────────────────────────────────

type Controle = { etat: "en_ligne"; tenantId: string; userId: string; actif: boolean } | { etat: "hors_ligne" | "non_connecte" };

/** Le serveur répond-il, et la session est-elle encore valable ? */
async function controler(): Promise<Controle> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { etat: "hors_ligne" };
  const abandon = new AbortController();
  const delai = setTimeout(() => abandon.abort(), 6_000);
  try {
    const r = await fetch("/api/pos/sync", { cache: "no-store", signal: abandon.signal, headers: caisseCourante ? { "x-pos-caisse": caisseCourante } : {} });
    if (r.status === 401 || r.status === 403) return { etat: "non_connecte" };
    if (!r.ok) return { etat: "hors_ligne" };
    const j = await r.json().catch(() => null);
    // Une page de connexion ou un portail captif répond 200 sans ce contenu.
    return j?.tenantId ? { etat: "en_ligne", tenantId: j.tenantId, userId: j.userId, actif: j.actif === true } : { etat: r.redirected ? "non_connecte" : "hors_ligne" };
  } catch {
    return { etat: "hors_ligne" };
  } finally {
    clearTimeout(delai);
  }
}

/** Un appel de la caisse vient d'échouer faute de réseau : on bascule tout de suite, le contrôle confirmera. */
export function signalerEchecReseau() {
  maj({ enLigne: false });
  planifier(3_000);
}

function planifier(ms: number) {
  if (minuterie) clearTimeout(minuterie);
  minuterie = setTimeout(() => { minuterie = null; void faireUnTour(); }, ms);
}

function ecouter() {
  if (ecoute || typeof window === "undefined") return;
  ecoute = true;
  window.addEventListener("online", () => planifier(0));
  window.addEventListener("offline", () => maj({ enLigne: false }));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") planifier(0); });
}

/** Contrôle de connexion, puis ce qu'elle permet : ouverture de la base, rejeu de la file, rafraîchissement du catalogue. */
function faireUnTour(): Promise<void> {
  tour ??= (async () => {
    try {
      const c = await controler();
      if (c.etat === "en_ligne") {
        maj({ enLigne: true, reconnexion: false });
        await initialiser(c);
        if (bd) {
          await synchroniser();
          if (etat.actif && (!meta.genereAt || Date.now() - new Date(meta.genereAt).getTime() > AGE_MAX_CATALOGUE)) await rafraichirCatalogue();
        }
      } else if (c.etat === "non_connecte") maj({ enLigne: true, reconnexion: true });
      else maj({ enLigne: false });
    } catch (e) {
      console.warn("[pos hors ligne]", (e as Error)?.message);
    } finally {
      tour = null;
      // Rien à surveiller : le moteur s'endort (drapeau éteint, aucune vente en attente).
      if (etat.actif || etat.enAttente > 0) planifier(etat.enLigne && !etat.enAttente && !etat.reconnexion ? 60_000 : 15_000);
    }
  })();
  return tour;
}

async function initialiser(c: Extract<Controle, { etat: "en_ligne" }>) {
  if (!stock.stockageDisponible()) return;
  if (!bd || tenantId !== c.tenantId) {
    if (!c.actif && !local.lire(MARQUEUR)) return;
    await ouvrir(c.tenantId);
  }
  if (c.actif) {
    local.ecrire(MARQUEUR, JSON.stringify({ tenantId: c.tenantId }));
    if (dernierDemarrage && dernierDemarrage !== meta.demarrage) await sauverMeta({ demarrage: dernierDemarrage, userId: c.userId });
    if (!etat.actif) {
      definirRelaisHorsLigne(relais);
      maj({ actif: true });
      void stock.demanderPersistance().then((persistant) => maj({ persistant }));
    }
    return;
  }
  // Drapeau éteint : plus de vente hors ligne, mais ce qui attend sur ce poste est encore synchronisé.
  definirRelaisHorsLigne(null);
  maj({ actif: false });
  if (!etat.enAttente && !etat.aTraiter) local.ecrire(MARQUEUR, null);
}

/**
 * À appeler AVANT le premier appel de l'écran de caisse. Si ce poste a déjà
 * servi en mode hors ligne, rouvre sa base : la caisse peut alors démarrer
 * sans réseau. Rend false (et ne fait rien) sinon.
 */
export async function preparer(): Promise<boolean> {
  if (bd) return etat.actif;
  let marque: { tenantId?: string } | null = null;
  try { marque = JSON.parse(local.lire(MARQUEUR) ?? "null"); } catch { /* marqueur illisible */ }
  if (!marque?.tenantId || !stock.stockageDisponible()) return false;
  try {
    await ouvrir(marque.tenantId);
  } catch (e) {
    console.warn("[pos hors ligne] base locale illisible", (e as Error)?.message);
    return false;
  }
  if (!meta.demarrage) return false;
  definirRelaisHorsLigne(relais);
  maj({ actif: true, enLigne: typeof navigator === "undefined" || navigator.onLine !== false });
  ecouter();
  return true;
}

/** L'écran de caisse a ses réglages (du serveur, ou de l'instantané s'il a démarré sans réseau). */
export async function demarrer(d: Demarrage, caisseId: string | null): Promise<void> {
  dernierDemarrage = d;
  caisseCourante = caisseId;
  if (!d.flags.offline_pos && !local.lire(MARQUEUR)) return;
  ecouter();
  await faireUnTour();
}

// ── Catalogue ──────────────────────────────────────────────────────────────────

/** Télécharge l'instantané complet, puis le remplace d'un coup (un téléchargement interrompu ne casse rien). */
export async function rafraichirCatalogue(): Promise<boolean> {
  if (!bd) return false;
  const base = bd;
  const recus: ArticleLocal[] = [];
  let fiche: Partial<MetaLocale> | null = null;
  let curseur: string | null = null;
  // ponytail: tout le catalogue en mémoire (quelques Mo pour des milliers d'articles) ; au-delà de ~20 000 articles, passer à une recherche par index IndexedDB.
  for (let page = 0; page < 1000; page++) {
    let r: Response;
    try {
      r = await fetch(`/api/pos/sync/catalogue${curseur ? `?curseur=${encodeURIComponent(curseur)}` : ""}`, { cache: "no-store", headers: caisseCourante ? { "x-pos-caisse": caisseCourante } : {} });
    } catch { signalerEchecReseau(); return false; }
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    if (!j || !Array.isArray(j.articles)) return false;
    if (j.meta) fiche = { version: j.meta.version, genereAt: j.meta.genereAt, categories: j.meta.categories ?? [], promotions: j.meta.promotions ?? [] };
    for (const a of j.articles) recus.push({ ...a, id: a.produitId });
    curseur = j.curseurSuivant ?? null;
    if (!curseur) break;
  }
  if (!fiche || curseur) return false;
  // Les ventes pas encore connues du serveur restent retirées du stock affiché.
  const sorties = (await stock.lireFile(base)).filter((m) => m.statut === "en_attente" || m.statut === "a_traiter").flatMap((m) => m.local?.sorties ?? []);
  const corriges = new Map(appliquerSorties(recus, sorties).map((a) => [a.produitId, a]));
  const neufs = trierArticles(recus.map((a) => corriges.get(a.produitId) ?? a));
  const nouvelleMeta: MetaLocale = { ...meta, ...fiche, id: "__meta" };
  await stock.remplacer(base, "catalogue", [...neufs, nouvelleMeta]);
  meta = nouvelleMeta;
  articles = neufs;
  maj({ catalogueAt: meta.genereAt, articles: articles.length });
  return true;
}

// ── Vente hors ligne et file ───────────────────────────────────────────────────

const PAS_PRET: Reponse<never> = { ok: false, code: "hors_ligne", status: 0, message: "Connexion interrompue, et le catalogue n'a pas encore été enregistré sur cet appareil : cette vente ne peut pas être prise hors ligne. Réessayez dès que le réseau revient." };

async function vendreHorsLigne(payload: Record<string, unknown>, cle: string, caisseId: string | null): Promise<Reponse<any>> {
  if (!bd || !meta.demarrage || !meta.genereAt) return PAS_PRET;
  // Même clé déjà en file (nouvel appui sur Encaisser, panier restauré après un rechargement) : la même vente, pas une seconde.
  const existante = await stock.mutationParCle(bd, cle);
  if (existante?.local) {
    const s = existante.statut === "synchronisee" ? existante.resultat : null;
    return { ok: true, rejoue: true, donnees: { commandeId: s?.commandeId ?? `local:${cle}`, numero: s?.numero ?? existante.local.numero, total: s?.total ?? existante.local.total, paye: existante.local.paye, du: 0, monnaie: existante.local.monnaie, rejoue: true, provisoire: !s } };
  }
  const clientId = typeof payload.clientId === "string" ? payload.clientId : null;
  const prep = preparerVenteLocale({ articles, meta, payload, cle, appareilId: idPoste(), caisseId, client: clients.find((c) => c.id === clientId) ?? null, maintenant: new Date() });
  if (!prep.ok) return prep;
  const ajoutee = await stock.enfiler(bd, prep.mutation, prep.articlesModifies);
  if (ajoutee) {
    const modifies = new Map(prep.articlesModifies.map((a) => [a.produitId, a]));
    articles = articles.map((a) => modifies.get(a.produitId) ?? a);
  }
  await rafraichirCompteurs();
  planifier(2_000);
  return { ok: true, rejoue: !ajoutee, donnees: prep.resultat };
}

type PanierLocal = { id: string; libelle: string | null; total: number; createdAt: string; clientId: string | null; contenu: Record<string, unknown> };

/** Panier mis en attente sans réseau : gardé sur CET appareil seulement (les autres caisses ne le voient pas). */
async function suspendreLocal(payload: Record<string, unknown>, cle: string): Promise<Reponse<any>> {
  if (!bd) return PAS_PRET;
  const contenu = (payload.contenu ?? {}) as { lignes?: LigneDemande[]; remise?: Remise | null };
  let total = 0;
  try { total = calculerLocal(articles, meta, { lignes: contenu.lignes ?? [], remise: contenu.remise ?? null }).total; } catch { /* total inconnu : affiché à 0, recalculé à la reprise */ }
  const panier: PanierLocal = { id: `local:${cle}`, libelle: typeof payload.libelle === "string" ? payload.libelle : null, total, createdAt: new Date().toISOString(), clientId: typeof payload.clientId === "string" ? payload.clientId : null, contenu };
  await stock.ecrire(bd, "panier", [panier]);
  return { ok: true, rejoue: false, donnees: { ok: true, local: true, panier: { id: panier.id, libelle: panier.libelle, total, createdAt: panier.createdAt } } };
}

async function paniersLocaux(): Promise<PanierLocal[]> {
  return bd ? (await stock.tous<PanierLocal>(bd, "panier")).filter((p) => p.id.startsWith("local:")) : [];
}

/** Relais posé sur envoyerMutation : envoie si le serveur répond, sinon garde la vente sur l'appareil. */
const relais: RelaisMutation = async (type, payload, cle, options, direct) => {
  if (!etat.actif) return direct();
  if (type === "vente" || type === "panier.suspendre") {
    if (etat.enLigne && !etat.reconnexion) {
      // Délai borné : sur un réseau mourant, le caissier ne reste pas devant un bouton qui tourne. La même clé sera rejouée.
      const r = await direct({ delaiMs: 12_000 });
      if (r.ok) return r;
      if (r.code === "hors_ligne") signalerEchecReseau();
      else if (r.status === 401) maj({ reconnexion: true });
      else return r;
    }
    return type === "vente" ? vendreHorsLigne(payload, cle, options.caisseId ?? null) : suspendreLocal(payload, cle);
  }
  // Ouverture et fermeture de caisse : le serveur seul peut les faire.
  const r = await direct();
  if (!r.ok && r.code === "hors_ligne") signalerEchecReseau();
  return r;
};

function envoyerAuServeur(m: Mutation): Promise<Reponse<ResultatRejeu>> {
  const l = m.local;
  return envoyerJson<ResultatRejeu>("/api/pos/sync/rejeu", "POST", {
    type: m.type, payload: m.payload, appareilId: m.appareilId, userId: m.userId, creeLocalAt: m.creeLocalAt, version: m.version, tentatives: m.tentatives,
    local: { numero: l?.numero ?? "", total: l?.total ?? 0, sessionCaisseId: l?.sessionCaisseId ?? null, catalogueAt: l?.catalogueAt ?? null, prix: l?.prix ?? [] },
    ...(m.valide ? { valider: true } : {}),
  }, m.cle, { caisseId: m.caisseId, delaiMs: 45_000 });
}

/** Rejoue la file (un seul passage à la fois, un seul onglet à la fois). */
export function synchroniser(): Promise<void> {
  passage ??= (async () => {
    const base = bd;
    if (!base || !etat.enLigne) return;
    const file = await stock.lireFile(base);
    const aPurger = purgeables(file, Date.now());
    if (aPurger.length) await stock.supprimer(base, "file", aPurger.map((m) => m.ordre as number));
    if (!file.some((m) => m.statut === "en_attente")) return;
    maj({ synchronisation: true });
    const rejouer = () => rejouerFile({ lire: () => stock.lireFile(base), ecrire: (m) => stock.ecrire(base, "file", [m]), envoyer: envoyerAuServeur, maintenant: () => Date.now() });
    // Deux onglets de la même caisse : un seul rejoue (les clés rendraient le double envoi inoffensif, mais inutile).
    const bilan = navigator.locks ? await navigator.locks.request(`axso-pos-sync-${tenantId}`, { ifAvailable: true }, (verrou) => (verrou ? rejouer() : null)) : await rejouer();
    if (!bilan) return;
    maj({ reconnexion: bilan.arret === "reconnexion", blocage: bilan.arret === "bloquee" || bilan.arret === "reconnexion" || bilan.autresComptes > 0 ? bilan.message ?? null : null });
    if (bilan.arret === "reseau") maj({ enLigne: false });
    if (bilan.envoyees + bilan.aTraiter > 0) {
      const derniereSynchroAt = new Date().toISOString();
      await sauverMeta({ derniereSynchroAt, genereAt: meta.genereAt });
      maj({ derniereSynchroAt });
      // `sync.completed` côté serveur ; sans réponse, tant pis : les ventes, elles, sont enregistrées.
      void envoyerJson("/api/pos/sync", "POST", { appareilId: idPoste(), envoyees: bilan.envoyees, conflits: bilan.conflits, aTraiter: bilan.aTraiter, restantes: bilan.restantes }, nouvelleCle(), { caisseId: caisseCourante, delaiMs: 15_000 });
      // Le stock du serveur tient maintenant compte de ces ventes : on reprend le sien.
      if (etat.actif) await rafraichirCatalogue();
    }
  })().catch((e) => { console.warn("[pos hors ligne] synchronisation", (e as Error)?.message); }).finally(async () => {
    passage = null;
    maj({ synchronisation: false });
    await rafraichirCompteurs().catch(() => {});
  });
  return passage;
}

// ── Écran « Synchronisation » ──────────────────────────────────────────────────

export async function lireFileLocale(): Promise<Mutation[]> {
  return bd ? stock.lireFile(bd) : [];
}

async function modifierMutation(cle: string, modif: (m: Mutation) => Mutation) {
  if (!bd) return;
  const m = await stock.mutationParCle(bd, cle);
  if (m) await stock.ecrire(bd, "file", [modif(m)]);
  await rafraichirCompteurs();
}

/**
 * Relance tout de suite : la tête de file n'attend plus son délai, et un « à traiter » choisi repasse en attente.
 * `valider` : le compte connecté (un responsable) accepte l'écart de prix que le serveur avait refusé d'enregistrer seul.
 */
export async function relancer(cle?: string, valider = false): Promise<void> {
  if (!bd) return;
  if (cle) await modifierMutation(cle, (m) => (m.statut === "a_traiter" ? { ...m, statut: "en_attente", prochainEssaiAt: undefined, valide: valider } : m));
  for (const m of (await stock.lireFile(bd)).filter((x) => x.statut === "en_attente" && x.prochainEssaiAt)) await stock.ecrire(bd, "file", [{ ...m, prochainEssaiAt: undefined }]);
  await rafraichirCompteurs();
  await faireUnTour();
}

/** Un responsable a réglé ce cas à la main : la mutation sort des « à traiter » mais reste dans l'export. */
export const marquerTraitee = (cle: string) => modifierMutation(cle, (m) => (m.statut === "a_traiter" ? { ...m, statut: "traitee", synchroniseeAt: new Date().toISOString() } : m));
export const marquerVue = (cle: string) => modifierMutation(cle, (m) => ({ ...m, vu: true }));

/** Export de secours : toute la file de ce poste, en JSON. */
export async function exporter() {
  return exporterFile(await lireFileLocale(), { boutique: meta.demarrage?.boutique.nomBoutique ?? null, poste: idPoste(), userId: meta.userId });
}

// ── Panier en cours ────────────────────────────────────────────────────────────

/** Garde (ou efface, avec null) le panier en cours et sa clé de vente : un rechargement ne le perd plus. */
export async function sauverPanier(contenu: Record<string, unknown> | null): Promise<void> {
  if (!bd || !etat.actif) return;
  if (contenu) await stock.ecrire(bd, "panier", [{ ...contenu, id: "courant", userId: meta.userId }]);
  else await stock.supprimer(bd, "panier", ["courant"]);
}

export async function lirePanier<T>(): Promise<T | null> {
  if (!bd || !etat.actif) return null;
  const p = await stock.lire<T & { userId?: string | null }>(bd, "panier", "courant");
  return p && (!p.userId || p.userId === meta.userId) ? p : null;
}

// ── Lectures de la caisse sans réseau ──────────────────────────────────────────

type OptionsLecture = { method?: string; corps?: unknown };
const ok = <T>(donnees: T): Reponse<T> => ({ ok: true, donnees, rejoue: false });

async function memoriserClients(liste: unknown) {
  if (!bd || !Array.isArray(liste)) return;
  const vus: ClientLocal[] = liste.flatMap((c: any) => (c && typeof c.id === "string" && typeof c.nom === "string"
    ? [{ id: c.id, nom: c.nom, telephone: c.telephone ?? null, codeClient: c.codeClient ?? null, segment: c.segment ?? null, niveau: c.niveau ?? null, vuAt: Date.now() }] : []));
  if (!vus.length) return;
  const ids = new Set(vus.map((c) => c.id));
  const tous = [...vus, ...clients.filter((c) => !ids.has(c.id))].sort((a, b) => b.vuAt - a.vuAt);
  clients = tous.slice(0, CLIENTS_MAX);
  await stock.ecrire(bd, "clients", vus);
  if (tous.length > CLIENTS_MAX) await stock.supprimer(bd, "clients", tous.slice(CLIENTS_MAX).map((c) => c.id));
}

/** Réponse de l'instantané à une lecture de la caisse ; null si cette lecture n'existe pas hors ligne. */
async function repondreLocal(chemin: string, p: URLSearchParams, o: OptionsLecture): Promise<Reponse<any> | null> {
  const methode = o.method ?? "GET";
  if (methode === "GET" && chemin === "/api/pos/reglages") return meta.demarrage ? ok(meta.demarrage) : null;
  if (methode === "GET" && chemin === "/api/pos/caisses") return ok({ caisses: meta.caisses });
  if (methode === "GET" && chemin === "/api/pos/ventes/suspendus") return ok({ paniers: await paniersLocaux() });
  if (methode === "GET" && chemin === "/api/pos/clients") {
    const q = (p.get("q") ?? "").trim().toLowerCase();
    return ok({ clients: clients.filter((c) => !q || c.nom.toLowerCase().includes(q) || (c.telephone ?? "").includes(q) || (c.codeClient ?? "").toLowerCase() === q).slice(0, 20) });
  }
  if (!meta.genereAt) return null;
  // Les images viennent d'un autre serveur : sans réseau, la carte affiche son pictogramme plutôt qu'une image cassée.
  const sansImage = (a: ArticleLocal) => ({ ...a, image: null, variantes: a.variantes.map((v) => ({ ...v, image: null })) });
  if (methode === "GET" && chemin === "/api/pos/articles") {
    const r = rechercherLocal(articles, { q: p.get("q"), categorie: p.get("categorie"), curseur: p.get("curseur"), limite: Number(p.get("limite")) || undefined });
    return ok({ articles: r.articles.map(sansImage), curseurSuivant: r.curseurSuivant, ...(p.get("categories") === "1" ? { categories: meta.categories } : {}) });
  }
  if (methode === "GET" && chemin === "/api/pos/scan") {
    const a = resoudreLocal(articles, p.get("code") ?? "", meta.demarrage?.reglages.balance.prefixesPoids ?? []);
    if (a) return ok({ article: sansImage(a), varianteId: a.varianteId });
    return { ok: false, code: "inconnu", status: 404, message: "Ce code n'est pas dans le catalogue enregistré sur cet appareil." };
  }
  if (methode === "POST" && chemin === "/api/pos/ventes/calculer") {
    const d = (o.corps ?? {}) as { lignes: LigneDemande[]; clientId?: string | null; remise?: Remise | null; codePromo?: string | null };
    try {
      return ok({ panier: calculerLocal(articles, meta, d, clients.find((c) => c.id === d.clientId) ?? null), devise: meta.demarrage?.boutique.devise, client: null, local: true });
    } catch (e) {
      if (e instanceof ErreurPos) return { ok: false, code: e.code, status: e.status, message: e.message, details: e.details };
      throw e;
    }
  }
  return null;
}

const HORS_DELAI: Reponse<never> = { ok: false, code: "hors_ligne", status: 0, message: "Connexion interrompue. Vérifiez le réseau puis réessayez." };

/**
 * Enveloppe d'une lecture de la caisse (appelPos) : le réseau d'abord quand il
 * répond, l'instantané local sinon. `reseau` fait l'appel d'origine.
 */
export async function repliLectures(url: string, o: OptionsLecture, reseau: () => Promise<Reponse<any>>): Promise<Reponse<any>> {
  if (typeof window === "undefined") return reseau();
  const u = new URL(url, window.location.origin);
  const chemin = u.pathname;
  const methode = o.method ?? "GET";

  // Panier suspendu sur cet appareil : repris ou abandonné ici, réseau ou pas.
  if (methode === "PATCH" && chemin.startsWith("/api/pos/ventes/suspendus/local")) {
    const id = decodeURIComponent(chemin.slice("/api/pos/ventes/suspendus/".length));
    if (bd) await stock.supprimer(bd, "panier", [id]);
    return ok({ ok: true, panier: { id } });
  }
  if (!etat.actif) return reseau();

  if (!etat.enLigne) {
    const l = await repondreLocal(chemin, u.searchParams, o);
    if (l) return l;
  }
  // Une lecture que l'instantané sait servir n'attend pas indéfiniment un réseau mourant.
  const servie = methode === "GET" ? ["/api/pos/reglages", "/api/pos/caisses", "/api/pos/articles", "/api/pos/scan", "/api/pos/clients", "/api/pos/ventes/suspendus"].includes(chemin) : chemin === "/api/pos/ventes/calculer";
  const r = servie ? await Promise.race([reseau(), new Promise<Reponse<any>>((fin) => setTimeout(() => fin(HORS_DELAI), 8_000))]) : await reseau();
  if (r.ok) {
    if (!etat.enLigne) planifier(0);
    if (methode === "GET" && chemin === "/api/pos/clients") void memoriserClients(r.donnees?.clients);
    if (methode === "GET" && chemin === "/api/pos/caisses" && Array.isArray(r.donnees?.caisses)) void sauverMeta({ caisses: r.donnees.caisses });
    if (methode === "GET" && chemin === "/api/pos/ventes/suspendus") {
      const locaux = await paniersLocaux();
      if (locaux.length) return { ...r, donnees: { ...r.donnees, paniers: [...locaux, ...(r.donnees?.paniers ?? [])] } };
    }
    return r;
  }
  if (r.code !== "hors_ligne") return r;
  if (etat.enLigne) signalerEchecReseau();
  return (await repondreLocal(chemin, u.searchParams, o)) ?? r;
}
