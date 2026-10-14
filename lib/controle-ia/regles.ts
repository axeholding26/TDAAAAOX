// AXSO CONTROL — règles pures (aucun accès base) des IA externes reliées par OAuth :
// droits demandés (scopes), niveau de risque d'un outil, décision selon le mode,
// PKCE et identifiant de client signé. Testé dans tests/controle-ia.test.ts.
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { MODULES, type GrillePermissions, type ModuleKey, type Niveau } from "@/lib/permissions";

// ─── Droits (scopes) ─────────────────────────────────────────────────────────
// Domaines (lecture / écriture). Chacun s'appuie sur un module de lib/permissions.ts (droits du
// compte) ; stock, fournisseurs et analyses sont des domaines plus fins que leur module :
// « products » couvre aussi stock et fournisseurs, « finance » couvre aussi les analyses.
export const DOMAINES: Record<string, { module: ModuleKey; libelle: string; parent?: string; lectureSeule?: boolean }> = {
  store: { module: "boutique", libelle: "Boutique et design" },
  products: { module: "produits", libelle: "Catalogue" },
  inventory: { module: "produits", libelle: "Stock", parent: "products" },
  suppliers: { module: "produits", libelle: "Fournisseurs et sourcing", parent: "products" },
  orders: { module: "commandes", libelle: "Commandes, livraisons et retours" },
  customers: { module: "clients", libelle: "Clients" },
  marketing: { module: "marketing", libelle: "Marketing, contenus et réseaux sociaux" },
  analytics: { module: "finance", libelle: "Analyses et chiffres", parent: "finance", lectureSeule: true },
  finance: { module: "finance", libelle: "Factures et paiements" },
};

// Droits sensibles et droits d'agent : jamais accordés par un simple « modifier », le marchand
// les coche un par un (écran d'autorisation).
export const SCOPES_FINS: Record<string, string> = {
  "axso:pricing:write": "Changer les prix et créer des remises ou codes promo",
  "axso:publish:write": "Mettre en ligne la boutique et ses changements",
  "axso:campaigns:launch": "Lancer des campagnes (envois aux clients, publicité)",
  "axso:payments:write": "Engager de l'argent (paiements, achats fournisseurs, budget publicitaire)",
  "axso:refunds:write": "Rembourser et annuler des commandes payées",
  "axso:delete:write": "Supprimer définitivement des produits, médias ou données",
  "axso:settings:write": "Modifier les réglages (livraison, référencement, webhooks)",
  "axso:creative:write": "Générer des images, vidéos et voix (consomme les crédits de génération)",
  "axso:agent:execute": "Faire exécuter des objectifs et des plans par les agents Axso",
  "axso:agent:background": "Créer des automatisations et tâches de fond",
  "axso:agent:autonomous": "Autoriser le mode autonome (actions sans validation, dans tes limites)",
};

export const SCOPES = [
  ...Object.entries(DOMAINES).flatMap(([d, v]) => (v.lectureSeule ? [`axso:${d}:read`] : [`axso:${d}:read`, `axso:${d}:write`])),
  ...Object.keys(SCOPES_FINS),
];

// Anciens noms (premières connexions) → noms actuels : une connexion déjà accordée garde ses droits.
const RENOMMES: Record<string, string[]> = {
  "axso:payments:execute": ["axso:payments:write", "axso:refunds:write"],
  "axso:automation:write": ["axso:agent:execute", "axso:agent:background"],
};
export function normaliserScopes(scopes: string[]): string[] {
  return [...new Set(scopes.flatMap((s) => RENOMMES[s] ?? [s]))];
}

/** Droit fin exigé par un outil, en plus de son domaine (outils AXIA et modules : une seule table). */
const SCOPES_OUTILS: Record<string, string> = {
  // prix et remises
  mettre_a_jour_prix: "axso:pricing:write", creer_code_promo: "axso:pricing:write",
  create_promotion: "axso:pricing:write",
  pos_preparer_promotion: "axso:pricing:write",
  // mise en ligne
  publier_boutique: "axso:publish:write", axso_builder_publish: "axso:publish:write",
  axso_builder_restore_snapshot: "axso:publish:write", axso_builder_rollback: "axso:publish:write",
  // campagnes et envois en masse
  envoyer_campagne_email: "axso:campaigns:launch", whatsapp_diffusion: "axso:campaigns:launch", sms_campagne: "axso:campaigns:launch",
  launch_campaign: "axso:campaigns:launch", meta_creer_campagne_ads: "axso:campaigns:launch",
  // argent
  payer_commission_affilie: "axso:payments:write", router_commande_fournisseur: "axso:payments:write", marquer_especes_remises: "axso:payments:write",
  // remboursements
  initier_retour: "axso:refunds:write", creer_retour: "axso:refunds:write", mettre_a_jour_retour: "axso:refunds:write",
  cancel_order: "axso:refunds:write",
  // suppressions définitives
  delete_catalog_item: "axso:delete:write", delete_media: "axso:delete:write", axso_builder_delete_asset: "axso:delete:write",
  // réglages
  configurer_livraison: "axso:settings:write", ajouter_regle_livraison: "axso:settings:write",
  axso_builder_update_store_seo: "axso:settings:write", manage_webhooks: "axso:settings:write",
  // génération
  generer_image: "axso:creative:write", generer_video: "axso:creative:write", generer_voiceover: "axso:creative:write",
  higgsfield_generer_video: "axso:creative:write", higgsfield_generer_image: "axso:creative:write",
  higgsfield_video_produit: "axso:creative:write", higgsfield_appeler_outil: "axso:creative:write",
  // agents
  creer_automation: "axso:agent:background",
};
export const scopeFinAxia = (outil: string): string | undefined => SCOPES_OUTILS[outil];

// Droits des orchestrations (objectifs, délégation, automatisations, webhooks) : jamais lancées par une autre orchestration.
export const SCOPE_OBJECTIFS = "axso:agent:execute";
export const SCOPE_AUTOMATISATION = "axso:agent:background";
export const estOrchestration = (scope: string | undefined) => scope === SCOPE_OBJECTIFS || scope === SCOPE_AUTOMATISATION;

const RE_STOCK = /stock|inventaire|inventory|entrepot|rupture|reorder|transfer|overstock|forecast_demand/;
const RE_FOURNISSEUR = /fournisseur|supplier|sourcing|landed|manufactur|import_product|winning_product|commande_fournisseur/;
const RE_ANALYSE = /stats|rapport|report|analy|summary|marge|margin|performance|get_sales|revenue|profit|best_sellers|worst_sellers|conversion|metrics|forecast|anomal|insight|pos_ventes|pos_caisse/;

/** Domaine d'un outil (pour le scope exigé) : déclaré, sinon déduit de son module et de son nom. */
export function domaineOutil(o: { name: string; module: ModuleKey | null; niveau: "lecture" | "ecriture"; domaine?: string }): string | null {
  if (o.domaine) return o.domaine;
  if (!o.module) return null;
  if (o.module === "produits") return RE_STOCK.test(o.name) ? "inventory" : RE_FOURNISSEUR.test(o.name) ? "suppliers" : "products";
  if (o.module === "finance") return o.niveau === "lecture" && RE_ANALYSE.test(o.name) ? "analytics" : "finance";
  return Object.entries(DOMAINES).find(([, d]) => d.module === o.module && !d.parent)?.[0] ?? null;
}

/** Vrai si les scopes ouvrent ce domaine à ce niveau (écrire implique lire ; le domaine parent couvre ses sous-domaines). */
export function scopeCouvre(scopes: string[], domaine: string, niveau: "lecture" | "ecriture"): boolean {
  const parent = DOMAINES[domaine]?.parent;
  const ok = (d: string) => scopes.includes(`axso:${d}:write`) || (niveau === "lecture" && scopes.includes(`axso:${d}:read`));
  return ok(domaine) || (!!parent && ok(parent));
}

/** Fournisseur d'IA reconnu d'après le nom déclaré et l'adresse de retour (affichage et statistiques). */
export function fournisseurDuClient(nom: string, redirectUri: string): "claude" | "chatgpt" | "gemini" | "autre" {
  const t = `${nom} ${redirectUri}`.toLowerCase();
  return /claude|anthropic/.test(t) ? "claude" : /chatgpt|openai/.test(t) ? "chatgpt" : /gemini|google/.test(t) ? "gemini" : "autre";
}

const RANG: Niveau[] = ["aucun", "lecture", "ecriture"];
const grilleVide = () => Object.fromEntries(MODULES.map((m) => [m, "aucun"])) as GrillePermissions;

/** Droits ouverts par une liste de scopes ; tout scope inconnu est ignoré. */
export function grilleDesScopes(scopes: string[]): GrillePermissions {
  const g = grilleVide();
  for (const s of scopes) {
    const [, domaine, acces] = s.split(":");
    const d = s.startsWith("axso:") ? DOMAINES[domaine] : undefined;
    if (!d || (acces !== "read" && acces !== "write") || (d.lectureSeule && acces === "write")) continue;
    const niveau: Niveau = acces === "write" ? "ecriture" : "lecture";
    if (RANG.indexOf(niveau) > RANG.indexOf(g[d.module])) g[d.module] = niveau;
  }
  return g;
}

/** Le plus petit des deux droits, module par module : une IA n'a jamais plus que le compte qui l'a autorisée. */
export function intersecter(a: GrillePermissions, b: GrillePermissions): GrillePermissions {
  const g = grilleVide();
  for (const m of MODULES) g[m] = RANG[Math.min(RANG.indexOf(a[m]), RANG.indexOf(b[m]))];
  return g;
}

// ─── Risque et décision ──────────────────────────────────────────────────────
export type Mode = "assistant" | "copilot" | "autopilot";
export const MODES: Mode[] = ["assistant", "copilot", "autopilot"];
export type Risque = "faible" | "moyen" | "eleve";

// Argent qui sort et envois en masse : accord du marchand quel que soit le mode.
const ELEVE = new Set([
  "payer_commission_affilie", "router_commande_fournisseur", "marquer_especes_remises",
  "initier_retour", "creer_retour", "mettre_a_jour_retour",
  "meta_creer_campagne_ads", "whatsapp_diffusion", "sms_campagne", "envoyer_campagne_email",
]);

/** `sensible` = estSensible() de lib/axia/confirmation.ts (prix, envois, publication, livraison…). */
export function risqueOutil(nom: string, sensible: boolean): Risque {
  return ELEVE.has(nom) ? "eleve" : sensible ? "moyen" : "faible";
}

/**
 * Assistant : toute modification attend l'accord. Copilote : comme AXIA, seules les actions
 * sensibles attendent. Autopilote : les actions sensibles partent seules, sauf risque élevé.
 */
export function decider(mode: Mode, risque: Risque, ecriture: boolean): "executer" | "accord" {
  if (!ecriture) return "executer";
  if (risque === "eleve" || mode === "assistant") return "accord";
  return risque === "moyen" && mode !== "autopilot" ? "accord" : "executer";
}

export const VARIATION_PRIX_DEFAUT = 15;

/**
 * Autopilote et risque élevé : l'action ne part seule que si son montant est connu et tient
 * dans la limite fixée par le marchand (0 = jamais sans accord).
 */
export function dansLimite(montant: { type: "pub" | "transaction"; valeur: number } | null | undefined, limites: { budgetPubMax: number; transactionMax: number }): boolean {
  if (!montant || !(montant.valeur >= 0)) return false;
  const plafond = montant.type === "pub" ? limites.budgetPubMax : limites.transactionMax;
  return plafond > 0 && montant.valeur <= plafond;
}

/** Autopilote : un changement de prix au-delà de la limite (en %) repasse par l'accord du marchand. */
export function prixHorsLimite(ancien: number, nouveau: number, maxPourcent: number): boolean {
  if (!(ancien > 0)) return true;
  return (Math.abs(nouveau - ancien) / ancien) * 100 > maxPourcent;
}

// ─── OAuth ───────────────────────────────────────────────────────────────────
export const empreinte = (jeton: string) => createHash("sha256").update(jeton).digest("hex");

export function pkceValide(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

/** https partout ; http seulement vers la machine de l'utilisateur (applications de bureau). */
export function redirectionAcceptable(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.hash || u.username || u.password) return false;
    return u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname));
  } catch { return false; }
}

export interface ClientIA { nom: string; redirectUris: string[] }

const secret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
const signer = (corps: string) => createHmac("sha256", secret()).update(`client-ia:${corps}`).digest("base64url");

// Enregistrement dynamique (RFC 7591) sans table : le client_id EST la fiche du client,
// signée par Axso. Une IA ne peut donc ni l'inventer ni changer ses adresses de retour.
export function creerClientId(nom: unknown, redirectUris: unknown): string | null {
  if (!secret() || !Array.isArray(redirectUris) || !redirectUris.length || redirectUris.length > 5) return null;
  if (!redirectUris.every((u) => typeof u === "string" && u.length <= 300 && redirectionAcceptable(u))) return null;
  const propre = (typeof nom === "string" ? nom : "").replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 40) || "Assistant IA";
  const corps = Buffer.from(JSON.stringify({ nom: propre, redirectUris })).toString("base64url");
  return `${corps}.${signer(corps)}`;
}

export function lireClientId(clientId: string | null | undefined): ClientIA | null {
  const [corps, signature] = (clientId ?? "").split(".");
  if (!corps || !signature || !secret()) return null;
  const attendu = Buffer.from(signer(corps)), recu = Buffer.from(signature);
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return null;
  try { return JSON.parse(Buffer.from(corps, "base64url").toString()) as ClientIA; } catch { return null; }
}
