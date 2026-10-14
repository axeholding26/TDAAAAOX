// Reçus, annulation et verrou optimiste des actions d'une IA (contrat utilisé par serveur.ts).
// Avant une écriture : état des éléments visés. Après : seuls les champs réellement modifiés
// sont gardés (ActionIA.avant / apres). Annuler = remettre « avant », seulement si l'élément
// vaut encore « après » : on n'écrase jamais une modification faite entre-temps.
import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CodeErreur, ResultatIA } from "./types";

type Ressource = { type: string; id: string };
export interface Instantane { ressources: Ressource[]; avant: Record<string, any>; creations?: { type: string; depuis: string | null }[] }
export interface Recu { ressources: Ressource[]; avant: Record<string, any>; apres: Record<string, any> }

// ─── Table des éléments suivis ───────────────────────────────────────────────
interface TypeRessource {
  /** Délégué Prisma. */
  modele: string;
  /** Convention de paramètre : <mot>Id, <mot>_id, <mot>_ids… ou `id` quand le nom de l'outil contient le mot. */
  mots: string[];
  /** Le modèle a `updatedAt` : verrou optimiste possible. */
  version?: true;
  /** Liste fermée de colonnes (sinon : toutes, sauf `ignores` et ce qui ressemble à un secret). */
  champs?: string[];
  /** Compteurs qui bougent sans l'IA (ventes, vues…) : hors reçu. */
  ignores?: string[];
  /** Montrés dans le reçu, jamais restaurés : les remettre exige une écriture métier (mouvement de stock, points…). */
  figes?: string[];
  /** Colonne qui, remplie, dit que l'élément est synchronisé avec un service externe : rien n'est restauré. */
  externe?: string;
}

/** Pour suivre un nouveau type d'élément : une ligne ici. */
export const TYPES: Record<string, TypeRessource> = {
  // Thème, design d'accueil, fiche produit, pages À propos/Contact vivent tous dans Tenant.themeConfig.
  // Liste fermée : ni plan, ni commission, ni KYC, ni moyens de paiement dans un reçu.
  boutique: {
    modele: "tenant", mots: [], version: true,
    champs: ["nomBoutique", "description", "categorie", "pays", "devise", "whatsapp", "whatsappNumero", "email", "telephone", "adresse", "logoUrl", "bannerUrl",
      "themeId", "themeConfig", "statut", "metaTitle", "metaDescription", "socialLinks", "parametresLivraison", "parametresCommande", "tauxTVA",
      "metaPixelId", "tiktokPixelId", "snapPixelId", "gtmId"],
  },
  produit: { modele: "produit", mots: ["produit", "product"], version: true, ignores: ["ventes", "vues", "stockReserve"], figes: ["stock"] },
  campagne: { modele: "campagne", mots: ["campagne", "campaign"], version: true, externe: "externalId", ignores: ["depense", "impressions", "clics", "conversions", "cpc", "cpa", "roas"] },
  client: { modele: "client", mots: ["client", "customer"], ignores: ["totalCommandes", "totalDepense"], figes: ["pointsFidelite", "creditUtilise"] },
  codePromo: { modele: "codePromo", mots: ["codepromo", "promocode", "promo", "discount", "coupon"], ignores: ["utilisations"] },
  collection: { modele: "collection", mots: ["collection"] },
  categorie: { modele: "categorieProduit", mots: ["categorie", "category"], version: true },
  popup: { modele: "popupCampagne", mots: ["popup"], version: true, ignores: ["affichages", "clics"] },
  workflow: { modele: "automationWorkflow", mots: ["workflow", "automation"], version: true, ignores: ["declenchements", "conversions"] },
  automatisation: { modele: "automatisationIA", mots: ["automatisation", "automation"], version: true, ignores: ["connexionId", "prochaineExecution", "derniereExecution", "executions", "dernierResultat"] },
  regleLivraison: { modele: "reglePort", mots: ["regle", "regleport", "reglelivraison", "shippingrule"], version: true },
  fournisseur: {
    modele: "fournisseur", mots: ["fournisseur", "supplier"], version: true,
    ignores: ["catalogueCount", "livraisonsTotal", "livraisonsOk", "scoreGlobal", "scoreFabricant", "niveauRisque", "labelVerifie", "signatureRisque", "analyseLe"],
  },
};

const B: [string, string?][] = [["boutique"]];
/** Outils dont la cible ne se devine pas par convention : outil → [type, paramètre qui porte l'id]. À compléter. */
export const OUTILS: Record<string, [string, string?][]> = {
  mettre_a_jour_prix: [["produit", "produitId"]],
  enrichir_produit: [["produit", "produitId"]],
  // « fiche produit » = le gabarit de la page produit (themeConfig.productPage), pas un produit.
  modifier_fiche_produit: B, modifier_boutique: B, modifier_couleurs: B, modifier_theme: B, modifier_design_accueil: B,
  personnaliser_page_boutique: B, modifier_page: B, configurer_livraison: B, publier_boutique: B,
};

/** Sans paramètre d'id : un outil dont le nom parle de la boutique (thème, pages, réglages…) la modifie. */
const BOUTIQUE = /(^|_)(boutique|store|shop|theme|design|page|pages|homepage|accueil|couleurs|colors|branding|livraison|shipping|settings|parametres|seo)(_|$)/;
const CREATION = /^(ajouter|creer|create|add|importer|import|dupliquer|duplicate)_/;
/** Ce qui est parti est parti : envoi, argent, publication sur un réseau, commande (fournisseur ou client). */
const IRREVERSIBLE = /(^|_)(envoyer|send|payer|pay|rembourser|refund|retrait|withdraw|virement|transfer|poster|post|lancer|launch|commander|order|router|facture|invoice)(_|$)|publish_(post|social|ad)|statut_commande|especes_remises|assigner_livreur|_retour$/;
export const irreversible = (outil: string) => !OUTILS[outil] && IRREVERSIBLE.test(outil);

const SECRET = /token|jeton|secret|password|motdepasse|hash|apikey|clesecrete|cleapi/i;
const HORS = ["id", "tenantId", "createdAt", "updatedAt"];
const MAX_RESSOURCES = 50;
/** Au-delà (en caractères JSON), une valeur est compressée ; un reçu entier trop gros perd ses valeurs compressées. */
const SEUIL = 2000;
const MAX_RECU = 120_000;

const sansAccent = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const cle = (r: Ressource) => `${r.type}:${r.id}`;

/** Éléments visés par un appel : table OUTILS, sinon convention de nom de paramètre (produitId, product_id, campaign_ids…). */
export function ciblesDe(tenantId: string, outil: string, args: Record<string, any>): Ressource[] {
  const cibles = new Map<string, Ressource>();
  const ajouter = (type: string, v: unknown) => {
    for (const id of Array.isArray(v) ? v : [v]) if (typeof id === "string" && id) cibles.set(`${type}:${id}`, { type, id });
  };
  const fixe = OUTILS[outil];
  if (fixe) {
    for (const [type, param] of fixe) ajouter(type, param ? args?.[param] : tenantId);
  } else {
    const nom = sansAccent(outil);
    for (const [param, v] of Object.entries(args ?? {})) {
      const p = sansAccent(param);
      for (const [type, t] of Object.entries(TYPES)) {
        if (t.mots.some((m) => p === `${m}id` || p === `${m}ids` || ((p === "id" || p === "ids") && nom.includes(m)))) ajouter(type, v);
      }
    }
    // La boutique en dernier : le verrou `version` porte d'abord sur l'élément désigné par un id.
    if (BOUTIQUE.test(outil)) ajouter("boutique", tenantId);
  }
  return [...cibles.values()].slice(0, MAX_RESSOURCES);
}

/** Types qu'un outil de création peut faire naître (d'après son nom). */
export function typesCrees(outil: string): string[] {
  if (!CREATION.test(outil)) return [];
  const nom = sansAccent(outil);
  return Object.entries(TYPES).filter(([, t]) => t.mots.some((m) => nom.includes(m))).map(([type]) => type);
}

// ─── Diff (pur) ──────────────────────────────────────────────────────────────
const objet = (v: any): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
/** JSON à clés triées : deux valeurs égales donnent la même chaîne, quel que soit l'ordre des clés. */
const canon = (v: any): string | undefined =>
  JSON.stringify(v, (_k, x) => (objet(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);
const SUR = /^$|[.[\]]/; // clé ou id qui casserait l'écriture du chemin : on ne descend pas

/** Deux tableaux d'objets portant les mêmes `id` dans le même ordre (blocs d'une page) : on compare bloc par bloc. */
function memesIds(a: any, b: any): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return false;
  const ok = a.every((e, i) => objet(e) && objet(b[i]) && typeof e.id === "string" && !SUR.test(e.id) && e.id === b[i].id);
  return ok && new Set(a.map((e) => e.id)).size === a.length;
}

const compacte = (v: any) => {
  const j = JSON.stringify(v);
  return j && j.length > SEUIL ? { "~gz": gzipSync(j).toString("base64"), octets: j.length } : v;
};
const decompacte = (v: any) => (objet(v) && typeof v["~gz"] === "string" ? JSON.parse(gunzipSync(Buffer.from(v["~gz"], "base64")).toString()) : v);

/** Long texte (HTML d'une section) : on ne garde que le passage qui a changé + l'empreinte du texte entier. */
function feuilles(a: any, b: any): [any, any] {
  if (typeof a === "string" && typeof b === "string" && a.length + b.length > SEUIL) {
    const max = Math.min(a.length, b.length);
    const haut = (c: number) => c >= 0xd800 && c <= 0xdbff, bas = (c: number) => c >= 0xdc00 && c <= 0xdfff;
    let d = 0, f = 0;
    while (d < max && a[d] === b[d]) d++;
    if (d && haut(a.charCodeAt(d - 1))) d--; // ne coupe pas un emoji en deux (jsonb refuse une demi-paire)
    while (f < max - d && a[a.length - 1 - f] === b[b.length - 1 - f]) f++;
    if (f && bas(a.charCodeAt(a.length - f))) f--;
    const ma = a.slice(d, a.length - f), mb = b.slice(d, b.length - f);
    if (ma.length + mb.length <= SEUIL) return [{ "~extrait": ma, debut: d, fin: f, sha: sha(a) }, { "~extrait": mb, debut: d, fin: f, sha: sha(b) }];
  }
  return [compacte(a), compacte(b)];
}

/**
 * Champs réellement modifiés entre deux états, à plat : { "prix": …, "themeConfig.colors.accent": …,
 * "themeConfig.builderTree[sec_1].config.html": … }. Un chemin absent de `avant` n'existait pas ;
 * absent de `apres`, il a été retiré.
 */
export function diff(a: any, b: any, chemin = "", r: { avant: Record<string, any>; apres: Record<string, any> } = { avant: {}, apres: {} }) {
  if (canon(a) === canon(b)) return r;
  if (objet(a) && objet(b)) {
    const cles = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    if (!cles.some((k) => SUR.test(k))) {
      for (const k of cles) diff(a[k], b[k], chemin ? `${chemin}.${k}` : k, r);
      return r;
    }
  } else if (memesIds(a, b)) {
    a.forEach((e: any, i: number) => diff(e, b[i], `${chemin}[${e.id}]`, r));
    return r;
  }
  const [fa, fb] = feuilles(a, b);
  if (a !== undefined) r.avant[chemin] = fa;
  if (b !== undefined) r.apres[chemin] = fb;
  return r;
}

type Jeton = { cle?: string; id?: string };
const jetons = (chemin: string): Jeton[] => [...chemin.matchAll(/\[([^\]]+)\]|([^.[\]]+)/g)].map((m) => (m[1] !== undefined ? { id: m[1] } : { cle: m[2] }));
const descendre = (o: any, j: Jeton) => (j.id !== undefined ? (Array.isArray(o) ? o.find((e) => e?.id === j.id) : undefined) : objet(o) ? o[j.cle!] : undefined);
const lireChemin = (racine: any, chemin: string) => jetons(chemin).reduce(descendre, racine);
const ABSENT = Symbol("absent");

function poser(racine: any, chemin: string, v: any): boolean {
  const js = jetons(chemin), dernier = js.pop()!;
  const parent = js.reduce(descendre, racine);
  if (dernier.id !== undefined) {
    const i = Array.isArray(parent) ? parent.findIndex((e) => e?.id === dernier.id) : -1;
    if (i < 0) return false;
    parent[i] = v;
  } else {
    if (!objet(parent)) return false;
    if (v === ABSENT) delete parent[dernier.cle!]; else parent[dernier.cle!] = v;
  }
  return true;
}

/**
 * Annulation d'un élément (pur) : `conflits` = champs qui ne valent plus « après » (quelqu'un y a touché) ;
 * sinon `data` = colonnes à réécrire. `laisses` = champs non restaurables (figés, ou valeur trop grosse non gardée).
 */
export function preparerAnnulation(actuel: Record<string, any>, avant: Record<string, any>, apres: Record<string, any>, figes: string[] = []) {
  const conflits: string[] = [], laisses: string[] = [], restaures: string[] = [];
  const suivant = structuredClone(actuel);
  const data: Record<string, any> = {};
  for (const chemin of new Set([...Object.keys(avant), ...Object.keys(apres)])) {
    const colonne = jetons(chemin)[0]?.cle ?? chemin;
    const av = avant[chemin], ap = apres[chemin];
    if (figes.includes(colonne) || av?.["~omis"] || ap?.["~omis"]) { laisses.push(chemin); continue; }
    const cur = lireChemin(actuel, chemin);
    const extrait = objet(ap) && typeof ap["~extrait"] === "string" && objet(av);
    const intact = !(chemin in apres) ? cur === undefined
      : extrait ? typeof cur === "string" && sha(cur) === ap.sha
      : canon(cur) === canon(decompacte(ap));
    const v = () => (!(chemin in avant) ? ABSENT : extrait ? cur.slice(0, av.debut) + av["~extrait"] + cur.slice(cur.length - av.fin) : decompacte(av));
    if (!intact || !poser(suivant, chemin, v())) { conflits.push(chemin); continue; }
    restaures.push(chemin);
    data[colonne] = suivant[colonne];
  }
  return { conflits, laisses, restaures, data: conflits.length ? {} : data };
}

/** Reçu trop gros : les valeurs compressées (arbre de page remplacé en entier…) ne sont pas gardées, donc pas annulables. */
export function borner(recu: Recu): Recu {
  if (JSON.stringify(recu).length <= MAX_RECU) return recu;
  const omettre = (etats: Record<string, any>) => Object.fromEntries(Object.entries(etats).map(([k, champs]) =>
    [k, Object.fromEntries(Object.entries(champs as Record<string, any>).map(([c, v]) => [c, objet(v) && v["~gz"] ? { "~omis": true, octets: v.octets } : v]))]));
  return { ressources: recu.ressources, avant: omettre(recu.avant), apres: omettre(recu.apres) };
}

// ─── Verrou optimiste (pur) ──────────────────────────────────────────────────
/** `version` = updatedAt lu par l'IA (ISO, avec ou sans fuseau — UTC par défaut —, ou millisecondes). null si illisible. Tolérance zéro. */
export function memeVersion(version: unknown, updatedAt: Date): boolean | null {
  const s = version instanceof Date ? version.toISOString() : String(version ?? "").trim();
  const d = /^\d{11,}$/.test(s) ? new Date(Number(s)) : new Date(/^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(s) ? `${s}Z` : s);
  return Number.isNaN(d.getTime()) ? null : d.getTime() === updatedAt.getTime();
}

// ─── Base de données ─────────────────────────────────────────────────────────
type Db = Record<string, any>;
const ou = (tenantId: string, r: Ressource) => (r.type === "boutique" ? { id: tenantId } : { id: r.id, tenantId });
const nommer = (r: Ressource, etat: any) => `${r.type} « ${etat?.nom ?? etat?.nomBoutique ?? etat?.code ?? etat?.sujet ?? r.id} »`;

/** État suivi d'un élément (colonnes simples, sans secret), tel qu'il sera rangé en JSON. */
async function lire(db: Db, tenantId: string, r: Ressource): Promise<Record<string, any> | null> {
  const t = TYPES[r.type];
  if (!t || (r.type === "boutique" && r.id !== tenantId)) return null;
  const ligne = await db[t.modele].findFirst({ where: ou(tenantId, r), ...(t.champs && { select: Object.fromEntries(t.champs.map((c) => [c, true])) }) });
  if (!ligne) return null;
  const garde = Object.entries(ligne).filter(([k]) => t.champs || (!HORS.includes(k) && !t.ignores?.includes(k) && !SECRET.test(k)));
  return JSON.parse(JSON.stringify(Object.fromEntries(garde)));
}

/** Avant une écriture : état des éléments que l'outil va modifier (null si l'outil n'est pas suivi). */
export async function prendreInstantane(tenantId: string, outil: string, args: Record<string, any>): Promise<Instantane | null> {
  const inst: Instantane = { ressources: [], avant: {} };
  for (const r of ciblesDe(tenantId, outil, args)) {
    const etat = await lire(prisma, tenantId, r);
    if (!etat) continue;
    inst.ressources.push(r);
    inst.avant[cle(r)] = etat;
  }
  // Création : on retient la ligne la plus récente du type, pour reconnaître après coup celles qui sont nées.
  const crees = typesCrees(outil);
  if (crees.length) {
    inst.creations = await Promise.all(crees.map(async (type) => {
      const d = await (prisma as Db)[TYPES[type].modele].findFirst({ where: { tenantId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
      return { type, depuis: d ? d.createdAt.toISOString() : null };
    }));
  }
  return inst.ressources.length || crees.length ? inst : null;
}

/** Après l'écriture : ne garde que ce qui a réellement changé (null si rien n'a changé). */
export async function conclureInstantane(tenantId: string, instantane: Instantane): Promise<Recu | null> {
  const recu: Recu = { ressources: [], avant: {}, apres: {} };
  for (const r of instantane.ressources) {
    const avant = instantane.avant[cle(r)];
    const apres = await lire(prisma, tenantId, r);
    const d = apres ? diff(avant, apres) : { avant: { "~supprime": nommer(r, avant) }, apres: null };
    if (!Object.keys(d.avant).length && !Object.keys(d.apres ?? {}).length) continue;
    recu.ressources.push(r);
    recu.avant[cle(r)] = d.avant;
    if (d.apres) recu.apres[cle(r)] = d.apres;
  }
  // ponytail: une ligne créée par le marchand pendant l'exécution de l'outil serait attribuée à l'IA
  // (fenêtre de quelques ms à quelques s) ; faire renvoyer l'id créé par l'outil si ça gêne.
  for (const c of instantane.creations ?? []) {
    const nees = await (prisma as Db)[TYPES[c.type].modele].findMany({
      where: { tenantId, ...(c.depuis && { createdAt: { gt: new Date(c.depuis) } }) }, orderBy: { createdAt: "asc" }, take: MAX_RESSOURCES,
    });
    for (const n of nees) {
      const r = { type: c.type, id: n.id };
      recu.ressources.push(r);
      recu.apres[cle(r)] = { "~cree": nommer(r, n) };
    }
  }
  return recu.ressources.length ? borner(recu) : null;
}

/** `version` (date de dernière modification lue par l'IA) périmée : message de conflit, sinon null. */
export async function conflitVersion(tenantId: string, outil: string, args: Record<string, any>): Promise<string | null> {
  const version = args?.version;
  if (version == null || version === "") return null;
  // ponytail: une seule `version` par appel, donc un seul élément vérifié (le premier qui a updatedAt) ;
  // pour un outil en lot, passer à un paramètre `versions: { id: date }`.
  const r = ciblesDe(tenantId, outil, args).find((c) => TYPES[c.type]?.version);
  if (!r) return null;
  const ligne = await (prisma as Db)[TYPES[r.type].modele].findFirst({ where: ou(tenantId, r), select: { updatedAt: true } });
  if (!ligne) return null; // introuvable : l'outil le dira lui-même
  const ok = memeVersion(version, ligne.updatedAt);
  const actuelle = ligne.updatedAt.toISOString();
  if (ok === null) return `le paramètre version est illisible (attendu : la date updatedAt lue, ex. ${actuelle}). Rien n'a été modifié.`;
  return ok ? null : `l'élément (${r.type}) a été modifié depuis ta lecture : sa version est maintenant ${actuelle}. Rien n'a été modifié. Relis-le, vérifie que ton changement a encore du sens, puis réessaie avec cette version.`;
}

const court = (v: any) => {
  if (v === undefined) return "(absent)";
  if (objet(v) && "~extrait" in v) return JSON.stringify(String(v["~extrait"]).slice(0, 60));
  if (objet(v) && ("~gz" in v || "~omis" in v)) return `(${v.octets} caractères)`;
  const j = JSON.stringify(v);
  return j.length > 80 ? `${j.slice(0, 80)}…` : j;
};
const refus = (code: CodeErreur, resultat: string): ResultatIA => ({ succes: false, code, resultat });

/** Remet les éléments d'une action dans leur état d'avant, si personne ne les a modifiés depuis. */
export async function annulerAction(tenantId: string, actionId: string): Promise<ResultatIA> {
  const a = await prisma.actionIA.findFirst({ where: { id: actionId, tenantId } });
  if (!a) return refus("NOT_FOUND", "action introuvable.");
  if (a.annuleLe) return refus("INVALID_INPUT", `cette action a déjà été annulée le ${a.annuleLe.toISOString()}.`);
  if (a.statut !== "execute") return refus("INVALID_INPUT", `cette action n'a pas été exécutée (statut : ${a.statut}) : il n'y a rien à annuler.`);
  if (irreversible(a.outil)) return refus("INVALID_INPUT", `« ${a.outil} » n'est pas annulable par nature (envoi, paiement, publication ou commande déjà partis). Rien n'a été modifié ; s'il faut corriger, fais une nouvelle action et dis-le au marchand.`);

  const avant = (a.avant ?? {}) as Record<string, any>, apres = (a.apres ?? {}) as Record<string, any>;
  const ressources = (Array.isArray(a.ressources) ? a.ressources : []) as unknown as Ressource[];
  if (!ressources.length) return refus("INVALID_INPUT", "cette action n'a pas de reçu (rien de suivi n'a été modifié) : il n'y a rien à restaurer.");
  const cibles = ressources.filter((r) => TYPES[r.type] && objet(avant[cle(r)]) && objet(apres[cle(r)]));
  if (!cibles.length) {
    return refus("INVALID_INPUT", ressources.some((r) => apres[cle(r)]?.["~cree"])
      ? "cette action a créé un élément : une création ne s'annule pas automatiquement. Désactive-le ou supprime-le avec l'outil prévu, après accord du marchand."
      : "cette action a supprimé un élément : une suppression ne s'annule pas automatiquement.");
  }

  let bilan: { conflits: string[]; laisses: string[]; faits: string[]; boutique: boolean };
  try {
    // Sérialisable : si quelqu'un écrit la même ligne pendant la restauration, PostgreSQL refuse la transaction.
    bilan = await prisma.$transaction(async (tx: Db) => {
      const conflits: string[] = [], laisses: string[] = [], faits: string[] = [];
      const ecritures: { r: Ressource; data: Record<string, any> }[] = [];
      for (const r of cibles) {
        const t = TYPES[r.type], k = cle(r);
        const actuel = await lire(tx, tenantId, r);
        if (!actuel) { conflits.push(`${nommer(r, null)} : supprimé depuis`); continue; }
        const nom = nommer(r, actuel);
        if (t.externe && actuel[t.externe]) { laisses.push(`${nom} : synchronisé avec un service externe`); continue; }
        const p = preparerAnnulation(actuel, avant[k], apres[k], t.figes);
        conflits.push(...p.conflits.map((c) => `${nom} : ${c} (attendu ${court(apres[k][c])}, trouvé ${court(lireChemin(actuel, c))})`));
        laisses.push(...p.laisses.map((c) => `${nom} : ${c}`));
        if (p.conflits.length || !p.restaures.length) continue;
        // Colonne Json remise à vide : Prisma exige DbNull (une liste String[] n'est jamais nulle).
        for (const [col, v] of Object.entries(p.data)) if (v === null && typeof actuel[col] === "object") p.data[col] = Prisma.DbNull;
        ecritures.push({ r, data: p.data });
        faits.push(...p.restaures.map((c) => `${nom} : ${c} : ${court(apres[k][c])} → ${court(avant[k][c])}`));
      }
      if (conflits.length || !ecritures.length) return { conflits, laisses, faits: [], boutique: false };
      // Tout ou rien : on n'écrit qu'une fois tous les éléments vérifiés.
      const { count } = await tx.actionIA.updateMany({ where: { id: actionId, tenantId, annuleLe: null }, data: { annuleLe: new Date() } });
      if (!count) return { conflits: ["action déjà annulée à l'instant"], laisses, faits: [], boutique: false };
      for (const e of ecritures) await tx[TYPES[e.r.type].modele].updateMany({ where: ou(tenantId, e.r), data: e.data });
      return { conflits, laisses, faits, boutique: ecritures.some((e) => e.r.type === "boutique") };
    }, { isolationLevel: "Serializable" });
  } catch (err: any) {
    if (err?.code === "P2034") return refus("CONFLICT", "l'élément est en cours de modification par quelqu'un d'autre : rien n'a été restauré. Relis-le puis réessaie.");
    throw err;
  }

  if (bilan.conflits.length) {
    return { ...refus("CONFLICT", `annulation refusée, rien n'a été restauré : modifié depuis cette action — ${bilan.conflits.join(" ; ")}. Relis l'élément et propose au marchand une correction manuelle.`), donnees: { action_id: actionId, conflicts: bilan.conflits } };
  }
  if (!bilan.faits.length) {
    return refus("INVALID_INPUT", `rien n'est restaurable automatiquement pour cette action (${bilan.laisses.join(" ; ")}). Corrige avec l'outil métier prévu (ajustement de stock inverse, reprise de la campagne…).`);
  }
  if (bilan.boutique) {
    // Cache de la vitrine : sans effet (et sans erreur) hors requête Next.
    try {
      const b = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
      if (b) (await import("next/cache")).revalidatePath(`/${b.slug}`, "layout");
    } catch {}
  }
  return {
    succes: true,
    resultat: `Action annulée (${a.outil}). Restauré — ${bilan.faits.join(" ; ")}.${bilan.laisses.length ? ` NON restauré (à corriger avec l'outil métier) — ${bilan.laisses.join(" ; ")}.` : ""}`,
    donnees: { action_id: actionId, undone: true, restored: bilan.faits, not_restored: bilan.laisses },
  };
}
