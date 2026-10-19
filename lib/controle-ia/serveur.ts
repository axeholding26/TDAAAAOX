// AXSO CONTROL — côté serveur : jetons OAuth des IA externes et exécution de leurs
// appels d'outils. Deux sources d'outils, un seul circuit : les outils d'AXIA
// (lib/axia/tools.ts) et les modules spécialisés (lib/controle-ia/modules). Pour chaque
// appel : droits → politique (accord du marchand) → idempotence → exécution → reçu → journal.
// La boutique et le compte viennent TOUJOURS du jeton, jamais des paramètres envoyés par l'IA.
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { planActif } from "@/lib/abonnement";
import { palierAuMoins, NOMS_PALIERS, type Palier } from "@/lib/plans";
import { permissionsSession } from "@/lib/permissions-server";
import type { GrillePermissions, ModuleKey } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { AXIA_TOOLS, executerOutilDirect } from "@/lib/axia/tools";
import { moduleRequis, niveauRequis } from "@/lib/axia/droits";
import { estSensible, demanderConfirmation } from "@/lib/axia/confirmation";
import {
  DOMAINES, SCOPES_FINS, VARIATION_PRIX_DEFAUT, dansLimite, decider, empreinte, fournisseurDuClient, grilleDesScopes,
  intersecter, lireClientId, pkceValide, prixHorsLimite, risqueOutil, scopeFinAxia, normaliserScopes, estOrchestration, domaineOutil, type Mode, type Risque,
} from "./regles";
import type { CodeErreur, CtxOutil, Limites, ModuleIA, OutilIA, ResultatIA } from "./types";
import { MODULES_IA } from "./modules";
import { annulerAction, conclureInstantane, conflitVersion, prendreInstantane } from "./recus";
import { statutTache } from "./taches";

const DUREE_CODE = 5 * 60_000, DUREE_ACCES = 3600_000, DUREE_RAFRAICHISSEMENT = 60 * 86_400_000;
const nouveauJeton = () => randomBytes(32).toString("base64url");

// ─── Jetons ──────────────────────────────────────────────────────────────────
export interface DonneesCode { userId: string; boutiques: string[]; client: string; scopes: string[]; clientId: string; redirectUri: string; challenge: string }

export async function emettreCode(donnees: DonneesCode): Promise<string> {
  const code = nouveauJeton();
  await prisma.jetonIA.create({ data: { hash: empreinte(code), type: "code", expireLe: new Date(Date.now() + DUREE_CODE), donnees: donnees as any } });
  return code;
}

/** Consomme un jeton à usage unique (code ou rafraîchissement) : la suppression est atomique, un rejeu échoue. */
const consommer = async (jeton: string, type: string) =>
  (await prisma.jetonIA.deleteMany({ where: { hash: empreinte(jeton), type, expireLe: { gt: new Date() } } })).count === 1;

async function paireDeJetons(connexionId: string, scopes: string[]) {
  const acces = nouveauJeton(), rafraichissement = nouveauJeton();
  await prisma.jetonIA.createMany({
    data: [
      { hash: empreinte(acces), type: "acces", connexionId, expireLe: new Date(Date.now() + DUREE_ACCES) },
      { hash: empreinte(rafraichissement), type: "rafraichissement", connexionId, expireLe: new Date(Date.now() + DUREE_RAFRAICHISSEMENT) },
    ],
  });
  return { access_token: acces, token_type: "Bearer", expires_in: DUREE_ACCES / 1000, refresh_token: rafraichissement, scope: scopes.join(" ") };
}

export async function echangerCode(p: { code: string; clientId: string; redirectUri: string; verifier: string }) {
  // Lu puis supprimé sous condition : un seul des appels concurrents obtient le code.
  const j = await prisma.jetonIA.findUnique({ where: { hash: empreinte(p.code) } });
  if (!j || !(await consommer(p.code, "code"))) return null;
  const d = j.donnees as unknown as DonneesCode | undefined;
  if (!d?.boutiques?.length || !lireClientId(p.clientId) || d.clientId !== p.clientId || d.redirectUri !== p.redirectUri || !pkceValide(p.verifier, d.challenge)) return null;
  // Reconnexion de la même IA par le même compte : l'ancienne connexion est remplacée.
  const anciennes = { userId: d.userId, client: d.client, tenantId: { in: d.boutiques }, revoqueLe: null };
  await prisma.jetonIA.deleteMany({ where: { OR: [{ connexion: anciennes }, { expireLe: { lt: new Date() } }] } });
  await prisma.connexionIA.updateMany({ where: anciennes, data: { revoqueLe: new Date() } });
  const connexion = await prisma.connexionIA.create({
    data: { userId: d.userId, tenantId: d.boutiques[0], boutiques: d.boutiques, client: d.client, fournisseur: fournisseurDuClient(d.client, d.redirectUri), scopes: d.scopes },
  });
  return paireDeJetons(connexion.id, d.scopes);
}

export async function rafraichir(jeton: string) {
  const j = await prisma.jetonIA.findUnique({ where: { hash: empreinte(jeton) }, include: { connexion: true } });
  if (!j?.connexion || j.connexion.revoqueLe || !(await consommer(jeton, "rafraichissement"))) return null;
  return paireDeJetons(j.connexion.id, j.connexion.scopes);
}

/** Révocation immédiate : la connexion est marquée et tous ses jetons sont détruits. Ses automatisations s'arrêtent (plus de contexte). */
export async function revoquer(id: string, filtre: { tenantId?: string; userId?: string; boutique?: string }) {
  const { boutique, ...f } = filtre;
  const r = await prisma.connexionIA.updateMany({ where: { id, ...f, ...(boutique && { boutiques: { has: boutique } }), revoqueLe: null }, data: { revoqueLe: new Date() } });
  if (r.count) await prisma.jetonIA.deleteMany({ where: { connexionId: id } });
  return r.count > 0;
}

// ─── Contexte d'une requête ──────────────────────────────────────────────────
export interface ContexteIA {
  connexionId: string; userId: string; tenantId: string; boutiques: string[]; client: string; fournisseur: string; scopes: string[];
  mode: Mode; limites: Limites; grille: GrillePermissions; plan: Palier;
  /** Appel fait par une orchestration d'Axso (objectif, automatisation), pas directement par l'IA. */
  interne?: boolean;
  /** Verrou d'urgence du marchand : aucune modification de la boutique par une IA. */
  editionBloquee?: boolean;
  /** Ce que le client MCP déclare savoir faire (initialize). */
  capacitesClient?: Record<string, unknown>;
  requete?: string;
}

const nombre = (v: unknown, defaut: number) => (Number(v) >= 0 && v !== null && v !== "" ? Number(v) : defaut);

/**
 * Identité d'une connexion. Droits et plan sont relus à chaque appel : un rôle retiré, une
 * boutique quittée ou un plan expiré prennent effet tout de suite. `tenantId` ne peut désigner
 * qu'une boutique autorisée à la connexion (accord donné sur une boutique précise).
 */
export async function contexteDeConnexion(connexionId: string, tenantId?: string): Promise<ContexteIA | null> {
  const c = await prisma.connexionIA.findUnique({ where: { id: connexionId } });
  if (!c || c.revoqueLe) return null;
  const boutiques = c.boutiques.length ? c.boutiques : [c.tenantId];
  const boutique = tenantId ?? c.tenantId;
  if (!boutiques.includes(boutique)) return null;
  const [droitsCompte, { plan }, t] = await Promise.all([
    permissionsSession({ user: { id: c.userId, tenantId: boutique } }),
    planActif(boutique),
    prisma.tenant.findUnique({ where: { id: boutique }, select: { editionIaBloquee: true } }),
  ]);
  const l = (c.limites ?? {}) as Record<string, unknown>;
  const scopes = normaliserScopes(c.scopes);
  return {
    connexionId: c.id, userId: c.userId, tenantId: boutique, boutiques, client: c.client, fournisseur: c.fournisseur, scopes,
    // Autopilote seulement si le marchand a coché le droit « mode autonome » à la connexion.
    mode: c.mode === "autopilot" && !scopes.includes("axso:agent:autonomous") ? "copilot" : c.mode as Mode,
    plan, grille: intersecter(grilleDesScopes(scopes), droitsCompte),
    limites: {
      variationPrixMax: nombre(l.variationPrixMax, VARIATION_PRIX_DEFAUT), budgetPubMax: nombre(l.budgetPubMax, 0), transactionMax: nombre(l.transactionMax, 0),
      risqueBuilderMax: l.risqueBuilderMax === "moyen" ? "moyen" : "faible",
    },
    editionBloquee: !!t?.editionIaBloquee, capacitesClient: (c.capacitesClient ?? {}) as Record<string, unknown>,
  };
}

/** Identité d'une requête MCP, dérivée du seul jeton. */
export async function contexteDuJeton(bearer: string | null): Promise<ContexteIA | null> {
  if (!bearer) return null;
  const j = await prisma.jetonIA.findUnique({ where: { hash: empreinte(bearer) }, select: { type: true, expireLe: true, connexionId: true } });
  if (!j?.connexionId || j.type !== "acces" || j.expireLe < new Date()) return null;
  return contexteDeConnexion(j.connexionId);
}

/** Les IA externes passent par le même palier qu'AXIA (Pro et plus) ; certains outils demandent le palier supérieur (OutilIA.tier). */
export const planSuffisant = (plan: Palier) => palierAuMoins(plan, "palier1");

// ─── Limites de débit ────────────────────────────────────────────────────────
// Réglables par variables d'environnement (MCP_LIMITE_*), en appels.
// ponytail: compteurs en mémoire, par instance ; passer sur une base partagée si le trafic le demande.
const env = (nom: string, defaut: number) => Number(process.env[nom]) > 0 ? Number(process.env[nom]) : defaut;
const MIN = 60_000, JOUR = 86_400_000;
const DEBITS = {
  connexionMin: rateLimit({ windowMs: MIN, max: env("MCP_LIMITE_CONNEXION_MIN", 60), keyPrefix: "mcp:c" }),
  connexionJour: rateLimit({ windowMs: JOUR, max: env("MCP_LIMITE_CONNEXION_JOUR", 5000), keyPrefix: "mcp:cj" }),
  boutiqueMin: rateLimit({ windowMs: MIN, max: env("MCP_LIMITE_BOUTIQUE_MIN", 240), keyPrefix: "mcp:b" }),
  compteMin: rateLimit({ windowMs: MIN, max: env("MCP_LIMITE_COMPTE_MIN", 240), keyPrefix: "mcp:u" }),
  fournisseurMin: rateLimit({ windowMs: MIN, max: env("MCP_LIMITE_FOURNISSEUR_MIN", 6000), keyPrefix: "mcp:f" }),
  ipMin: rateLimit({ windowMs: MIN, max: env("MCP_LIMITE_IP_MIN", 600), keyPrefix: "mcp:ip" }),
  outilMin: rateLimit({ windowMs: MIN, max: env("MCP_LIMITE_OUTIL_MIN", 30), keyPrefix: "mcp:o" }),
};

/** Vrai si la requête dépasse une limite (connexion, boutique, compte, fournisseur d'IA, adresse IP ; par minute et par jour). */
export function debitDepasse(ctx: ContexteIA, ip: string): boolean {
  return [
    DEBITS.connexionMin.check(ctx.connexionId), DEBITS.connexionJour.check(ctx.connexionId), DEBITS.boutiqueMin.check(ctx.tenantId),
    DEBITS.compteMin.check(ctx.userId), DEBITS.fournisseurMin.check(ctx.fournisseur), DEBITS.ipMin.check(ip),
  ].some((r) => !r.success);
}

// ─── Catalogue d'outils ──────────────────────────────────────────────────────
interface Fiche extends Omit<OutilIA, "module" | "risque"> { module: ModuleKey | null; risque: Risque; source: "coeur" | "axia" | ModuleIA }

// Jamais exposés : la délégation AXIA lance des sous-agents qui n'appliquent pas les droits (voir axso_delegate, module objectifs).
// modifier_produit / supprimer_produit : les IA externes ont update_product, manage_variants, adjust_inventory et
// delete_catalog_item, soumis à leurs propres limites (variation de prix, risque élevé).
const EXCLUS = new Set(["deleguer_vers_agent", "modifier_produit", "supprimer_produit"]);
const CAPACITES_AXIA: Record<ModuleKey, string> = {
  produits: "catalogue", commandes: "commandes", clients: "clients", boutique: "boutique", marketing: "marketing",
  finance: "finances", pos: "caisse", equipe: "equipe", parametres: "parametres",
};
const objet = (properties: Record<string, any> = {}, required: string[] = []) => ({ type: "object" as const, properties, required });

const COEUR: Fiche[] = [
  { name: "axso_contexte", description: "À appeler en premier : boutique sur laquelle tu travailles, autres boutiques accessibles, plan, droits accordés, mode (assistant, copilote, autopilote), limites et résumé de l'activité.", parameters: objet() },
  { name: "axso_capacites", description: "Liste ce que tu peux faire ici (catalogue, commandes, étude de marché, sourcing, création, marketing, automatisations…) et pourquoi une capacité est indisponible (plan, droit non accordé, service non relié).", parameters: objet() },
  { name: "axso_choisir_boutique", description: "Change la boutique sur laquelle tu travailles, parmi celles que le marchand a autorisées. Si la demande du marchand ne dit pas clairement quelle boutique, demande-lui avant.", parameters: objet({ boutique: { type: "string", description: "Identifiant court (slug) de la boutique, donné par axso_contexte" } }, ["boutique"]) },
  { name: "axso_statut_tache", description: "Avancement et résultat d'une tâche longue (étude, génération, import, objectif) lancée par un autre outil qui a renvoyé un job_id.", parameters: objet({ job_id: { type: "string" } }, ["job_id"]) },
  { name: "axso_decouvrir", description: "Outils avancés d'une capacité (ex. « builder_structure », « builder_design ») avec leur schéma complet : ils ne sont pas tous listés d'office. Appelle-les ensuite avec axso_outil.", parameters: objet({ capacite: { type: "string", description: "Identifiant de capacité donné par axso_capacites" } }, ["capacite"]) },
  { name: "axso_outil", description: "Appelle un outil avancé découvert avec axso_decouvrir (mêmes droits, accords et journal que les autres outils).", parameters: objet({ name: { type: "string" }, arguments: { type: "object" } }, ["name"]) },
  { name: "axso_annuler_action", description: "Annule une modification faite par cette connexion (prix, fiche produit, thème, pages, réglages) : remet l'état d'avant, si personne n'a modifié l'élément depuis. L'action_id est renvoyé par chaque modification.", parameters: objet({ action_id: { type: "string" } }, ["action_id"]), niveauEcriture: true },
].map(({ niveauEcriture, ...o }: any) => ({ ...o, module: null, niveau: niveauEcriture ? "ecriture" : "lecture", risque: "faible", capacite: "controle", source: "coeur" }) as Fiche);

const AXIA: Fiche[] = AXIA_TOOLS.filter((o) => !EXCLUS.has(o.name) && niveauRequis(o.name)).map((o) => ({
  name: o.name, description: o.description, parameters: o.parameters as Fiche["parameters"], tier: o.tier,
  module: moduleRequis(o.name), niveau: niveauRequis(o.name)!, risque: risqueOutil(o.name, estSensible(o.name)),
  scope: scopeFinAxia(o.name), capacite: CAPACITES_AXIA[moduleRequis(o.name)!], source: "axia",
  ...(o.name === "meta_creer_campagne_ads" && { montant: (a: Record<string, any>) => ({ type: "pub" as const, valeur: Number(a.budget_jour) }) }),
}));

// Un nom d'outil n'existe qu'une fois : le cœur puis AXIA l'emportent sur un module qui le redéclarerait.
const CATALOGUE: Fiche[] = (() => {
  const vus = new Set<string>();
  const modules = MODULES_IA.flatMap((m) => m.outils.map((o) => ({ ...o, risque: o.risque ?? "faible", scope: o.scope ?? scopeFinAxia(o.name), source: m }) as Fiche));
  return [...COEUR, ...AXIA, ...modules].filter((f) => !vus.has(f.name) && vus.add(f.name));
})();
const fiche = (nom: string) => CATALOGUE.find((f) => f.name === nom);

const erreur = (code: CodeErreur, resultat: string, donnees?: Record<string, unknown>): ResultatIA => ({ succes: false, code, resultat: `${code} : ${resultat}`, donnees });

/** Refus (plan, droit du module, droit fin) ou null si l'outil est ouvert. `grille` et `scopes` : ceux de l'IA, ou ceux du marchand qui valide. */
function refus(f: Fiche, plan: Palier, grille: GrillePermissions, scopes: string[] | null): ResultatIA | null {
  if (!planSuffisant(plan) || (f.tier && !palierAuMoins(plan, f.tier))) {
    return erreur("PLAN_REQUIRED", `cet outil demande le Palier ${NOMS_PALIERS[f.tier && !palierAuMoins(plan, f.tier) ? f.tier : "palier1"]} d'Axso.`, { action: "UPGRADE_PLAN" });
  }
  if (f.module) {
    const n = grille[f.module];
    if (n === "aucun" || (f.niveau === "ecriture" && n !== "ecriture")) {
      const domaine = domaineOutil(f);
      return erreur("INSUFFICIENT_PERMISSION", "cet outil n'est pas ouvert à cette connexion (droit non accordé, ou rôle du compte). Le marchand peut refaire la connexion avec plus de droits ; tu ne peux pas les augmenter toi-même.",
        { required_scope: domaine ? `axso:${domaine}:${f.niveau === "ecriture" ? "write" : "read"}` : undefined, action: "RECONNECT_WITH_SCOPE" });
    }
  }
  if (f.scope && scopes && !scopes.includes(f.scope)) {
    return erreur("INSUFFICIENT_PERMISSION", `il manque le droit « ${SCOPES_FINS[f.scope] ?? f.scope} ». Le marchand doit refaire la connexion en le cochant.`, { required_scope: f.scope, action: "RECONNECT_WITH_SCOPE" });
  }
  return null;
}

const CLE = { idempotency_key: { type: "string", description: "Clé unique de ton choix : le même appel rejoué avec la même clé n'est exécuté qu'une fois." } };

/** Outils visibles par cette connexion (découverte dynamique : plan, droits accordés, droits du compte). */
export function outilsDisponibles(ctx: ContexteIA) {
  return CATALOGUE.filter((f) => !f.cache && !refus(f, ctx.plan, ctx.grille, ctx.scopes)).map(versSchema(ctx));
}

/** Outils avancés d'une capacité, ouverts à cette connexion. */
export function outilsCaches(ctx: ContexteIA, capacite: string) {
  return CATALOGUE.filter((f) => f.capacite === capacite && !refus(f, ctx.plan, ctx.grille, ctx.scopes)).map(versSchema(ctx));
}

const versSchema = (ctx: ContexteIA) => (f: Fiche) => {
  const ecriture = f.niveau === "ecriture";
  const accord = ecriture && decider(ctx.mode, f.risque, true) === "accord";
  return {
    name: f.name,
    description: `${f.description}${ecriture ? ` [risque ${f.risque}${f.evaluerRisque ? " (recalculé selon les changements)" : ""}${accord ? " — attend l'accord du marchand" : ""}]` : ""}${f.sortie ? ` Renvoie : ${f.sortie}` : ""}`,
    inputSchema: ecriture ? { ...f.parameters, properties: { ...f.parameters.properties, ...CLE } } : f.parameters,
    annotations: { readOnlyHint: !ecriture, destructiveHint: f.risque === "eleve" },
  };
};

/** Documentation de tous les outils (publique : aucune donnée de boutique). */
export function catalogue() {
  return CATALOGUE.map((f) => ({
    name: f.name, version: "1", description: f.description, input_schema: f.parameters, output: f.sortie ?? "Texte ; données structurées quand elles existent.",
    capability: f.capacite, plan: f.tier ?? "palier1",
    permissions: [...(f.module ? [`axso:${domaineOutil(f) ?? f.module}:${f.niveau === "ecriture" ? "write" : "read"}`] : []), ...(f.scope ? [f.scope] : [])],
    risk_level: f.niveau === "lecture" ? "none" : f.risque,
    idempotency: f.niveau === "ecriture" ? "idempotency_key accepté : un appel rejoué avec la même clé n'est exécuté qu'une fois." : "Lecture : sans effet.",
    errors: ["INSUFFICIENT_PERMISSION", "PLAN_REQUIRED", "APPROVAL_REQUIRED", "NOT_FOUND", "INVALID_INPUT", "CONFLICT", "RATE_LIMITED", "UNAVAILABLE", "INTERNAL"],
    example: f.exemple,
  }));
}

async function capacites(ctx: ContexteIA): Promise<ResultatIA> {
  // Par module ET capacité : « Meta non relié » ne rend pas indisponible la création d'images du même module.
  const indispo = new Map<string, string | null>();
  for (const f of CATALOGUE) {
    if (typeof f.source !== "object" || !f.source.indisponible) continue;
    const cle = `${f.source.id}:${f.capacite}`;
    if (!indispo.has(cle)) indispo.set(cle, (await f.source.indisponible(ctx.tenantId, f.capacite).catch(() => "module momentanément indisponible")) ?? null);
  }
  const groupes = new Map<string, { id: string; available: boolean; tools: string[]; reason?: string }>();
  for (const f of CATALOGUE) {
    const g = groupes.get(f.capacite) ?? { id: f.capacite, available: false, tools: [] };
    const r = refus(f, ctx.plan, ctx.grille, ctx.scopes);
    const service = typeof f.source === "object" ? indispo.get(`${f.source.id}:${f.capacite}`) : null;
    if (!r && !service) { g.available = true; g.tools.push(f.name); delete g.reason; }
    else if (!g.available) g.reason = service ?? r?.resultat;
    groupes.set(f.capacite, g);
  }
  const liste = [...groupes.values()];
  return {
    succes: true, donnees: { capabilities: liste },
    resultat: liste.map((g) => g.available ? `✓ ${g.id} : ${g.tools.length} outils` : `✕ ${g.id} : ${g.reason}`).join("\n"),
  };
}

async function contexteBusiness(ctx: ContexteIA): Promise<ResultatIA> {
  const boutiques = await prisma.tenant.findMany({ where: { id: { in: ctx.boutiques } }, select: { id: true, nomBoutique: true, slug: true } });
  const active = boutiques.find((b) => b.id === ctx.tenantId);
  const droits = Object.values(DOMAINES).map((d) => `${d.libelle} : ${ctx.grille[d.module]}`).join(" · ");
  const fins = Object.keys(SCOPES_FINS).filter((s) => ctx.scopes.includes(s)).map((s) => SCOPES_FINS[s]);
  const autres = boutiques.filter((b) => b.id !== ctx.tenantId);
  const blocs = [
    `Boutique active : ${active?.nomBoutique} (${active?.slug}).${autres.length ? ` Autres boutiques autorisées : ${autres.map((b) => `${b.nomBoutique} (${b.slug})`).join(", ")} — change avec axso_choisir_boutique ; si le marchand ne précise pas la boutique, demande-lui.` : ""}`,
    `Plan : ${NOMS_PALIERS[ctx.plan]}. Droits : ${droits}${fins.length ? `. Droits particuliers : ${fins.join(" ; ")}` : ""}`,
    `Mode : ${ctx.mode}. Les outils marqués « attend l'accord du marchand » ne sont pas exécutés tout de suite : il les valide dans Axso (Contrôle IA). Limites en autopilote — variation de prix : ${ctx.limites.variationPrixMax} % ; budget publicitaire par action : ${ctx.limites.budgetPubMax || "toujours avec accord"} ; achat ou paiement par action : ${ctx.limites.transactionMax || "toujours avec accord"}.`,
  ];
  for (const [outil, args] of [["lire_boutique", {}], ["stats_globales", { periode: "30j" }]] as const) {
    const f = fiche(outil);
    if (f && !refus(f, ctx.plan, ctx.grille, ctx.scopes)) blocs.push((await executerOutilDirect(outil, args, ctx.tenantId)).resultat);
  }
  return {
    succes: true, resultat: blocs.join("\n\n"),
    donnees: { business: active, other_businesses: autres, plan: ctx.plan, mode: ctx.mode, scopes: ctx.scopes, limits: ctx.limites, provider: ctx.fournisseur },
  };
}

async function choisirBoutique(ctx: ContexteIA, cible: string): Promise<ResultatIA> {
  const b = await prisma.tenant.findFirst({ where: { id: { in: ctx.boutiques }, OR: [{ slug: cible }, { id: cible }] }, select: { id: true, nomBoutique: true, slug: true } });
  if (!b) return erreur("NOT_FOUND", "cette boutique n'est pas autorisée pour cette connexion. Le marchand peut refaire la connexion en la cochant.");
  await prisma.connexionIA.update({ where: { id: ctx.connexionId }, data: { tenantId: b.id } });
  return { succes: true, resultat: `Tu travailles maintenant sur ${b.nomBoutique} (${b.slug}). Rappelle axso_contexte pour ses droits et son activité.`, donnees: { business: b } };
}

const ECHEC = "l'action a échoué côté Axso. Vérifie l'état avec un outil de lecture avant de réessayer.";

function ctxOutil(ctx: ContexteIA): CtxOutil {
  return {
    tenantId: ctx.tenantId, userId: ctx.userId, connexionId: ctx.connexionId, client: ctx.client, plan: ctx.plan, grille: ctx.grille,
    mode: ctx.mode, limites: ctx.limites, appeler: (nom, args) => appelerOutil({ ...ctx, interne: true }, nom, args),
  };
}

/** Exécution brute d'un outil, sans politique : à n'appeler qu'après les contrôles (ou après accord du marchand). */
async function executer(f: Fiche, args: Record<string, any>, ctx: ContexteIA): Promise<ResultatIA> {
  try {
    if (f.source === "coeur") {
      if (f.name === "axso_contexte") return await contexteBusiness(ctx);
      if (f.name === "axso_capacites") return await capacites(ctx);
      if (f.name === "axso_choisir_boutique") return await choisirBoutique(ctx, String(args.boutique ?? ""));
      if (f.name === "axso_statut_tache") return await statutTache(ctx.tenantId, String(args.job_id ?? ""));
      if (f.name === "axso_decouvrir") {
        const outils = outilsCaches(ctx, String(args.capacite ?? ""));
        return outils.length
          ? { succes: true, resultat: outils.map((o) => `• ${o.name} — ${o.description}`).join("\n"), donnees: { tools: outils } }
          : erreur("NOT_FOUND", "aucun outil ouvert pour cette capacité (voir axso_capacites).");
      }
      if (f.name === "axso_outil") {
        const nom = String(args.name ?? "");
        if (fiche(nom)?.source === "coeur") return erreur("INVALID_INPUT", "appelle cet outil directement.");
        return await appelerOutil(ctx, nom, args.arguments && typeof args.arguments === "object" ? args.arguments : {});
      }
      // Annulation : seulement les actions de cette connexion, et seulement si elle a encore le droit de l'outil d'origine.
      const a = await prisma.actionIA.findFirst({ where: { id: String(args.action_id ?? ""), tenantId: ctx.tenantId, connexionId: ctx.connexionId }, select: { outil: true } });
      const origine = a && fiche(a.outil);
      if (!origine) return erreur("NOT_FOUND", "action introuvable pour cette connexion.");
      return refus(origine, ctx.plan, ctx.grille, ctx.scopes) ?? await annulerAction(ctx.tenantId, String(args.action_id));
    }
    if (f.source === "axia") {
      const r = await executerOutilDirect(f.name, args, ctx.tenantId);
      // executerOutilDirect renvoie « Erreur: <exception> » : jamais d'erreur interne (base de données…) au modèle.
      if (!r.succes && r.resultat.startsWith("Erreur: ")) throw new Error(r.resultat);
      return r;
    }
    return await f.source.executer(f.name, args, ctxOutil(ctx));
  } catch (err: any) {
    // Un module en panne ne fait tomber ni le serveur ni les autres outils.
    console.error(JSON.stringify({ evt: "mcp_outil_erreur", outil: f.name, tenant: ctx.tenantId, requete: ctx.requete, message: String(err?.message).slice(0, 300) }));
    return typeof f.source === "object" ? erreur("UNAVAILABLE", `le module « ${f.source.nom} » est momentanément indisponible. Rien n'a été modifié par cet appel ; le reste d'Axso fonctionne.`) : erreur("INTERNAL", ECHEC);
  }
}

// Les valeurs compressées du reçu (gros arbres de page) restent en base : le modèle n'en reçoit que la taille.
const allege = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(allege)
  : v && typeof v === "object" ? ("~gz" in v ? { "~compresse": true, caracteres: String((v as any)["~gz"]).length } : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, allege(x)])))
  : v;

/** Exécute une écriture en gardant le reçu (avant / après) dans le journal. */
async function executerAvecRecu(f: Fiche, args: Record<string, any>, ctx: ContexteIA, actionId: string): Promise<ResultatIA> {
  const trace = (etape: string) => (err: any) => { console.error(JSON.stringify({ evt: "mcp_recu_erreur", etape, outil: f.name, action: actionId, message: String(err?.message).slice(0, 200) })); return null; };
  const instantane = f.niveau === "ecriture" ? await prendreInstantane(ctx.tenantId, f.name, args).catch(trace("avant")) : null;
  const r = await executer(f, args, ctx);
  const recu = instantane && r.succes ? await conclureInstantane(ctx.tenantId, instantane).catch(trace("apres")) : null;
  await prisma.actionIA.update({
    where: { id: actionId },
    data: { ...(r.donnees && { donnees: r.donnees as any }), ...(recu && { ressources: recu.ressources as any, avant: recu.avant, apres: recu.apres }) },
  }).catch(trace("journal"));
  return {
    ...r, actionId,
    donnees: f.niveau === "ecriture" ? { ...r.donnees, action_id: actionId, ...(recu && { receipt: { changed_resources: recu.ressources, before: allege(recu.avant), after: allege(recu.apres), timestamp: new Date().toISOString() } }) } : r.donnees,
  };
}

const resumer = (args: Record<string, any>) => JSON.stringify(args ?? {}).slice(0, 600);
const statutDe = (r: ResultatIA) => (r.succes ? "execute" : "echec");

/** Exécute un appel d'outil venu d'une IA externe (ou d'une orchestration qui agit pour elle). */
export async function appelerOutil(ctx: ContexteIA, nom: string, brut: Record<string, any>): Promise<ResultatIA> {
  const { idempotency_key, ...args } = brut && typeof brut === "object" && !Array.isArray(brut) ? brut : {};
  const cle = typeof idempotency_key === "string" && idempotency_key ? idempotency_key.slice(0, 120) : null;
  const f = fiche(nom);
  const base = { tenantId: ctx.tenantId, connexionId: ctx.connexionId, client: ctx.client, outil: nom.slice(0, 80), risque: f?.risque ?? "faible", entree: resumer(args), requete: ctx.requete };

  const interdit = !f ? erreur("NOT_FOUND", "cet outil n'existe pas.")
    // Une orchestration ne peut pas en lancer une autre (ni créer d'automatisation) : pas de boucle, pas d'autonomie en cascade.
    : ctx.interne && estOrchestration(f.scope) ? erreur("INSUFFICIENT_PERMISSION", "une orchestration ne peut pas lancer cet outil.")
    : refus(f, ctx.plan, ctx.grille, ctx.scopes)
    // Verrou d'urgence : plus aucune modification de la boutique par une IA, quel que soit le mode.
    ?? (ctx.editionBloquee && f.module === "boutique" && f.niveau === "ecriture"
      ? erreur("POLICY_BLOCKED", "le marchand a bloqué la modification de sa boutique par les IA (Axso → Contrôle IA). Rien n'a été modifié ; seul lui peut lever ce verrou.")
      : null);
  if (interdit || !f) {
    await prisma.actionIA.create({ data: { ...base, statut: "refuse", sortie: interdit!.resultat.slice(0, 300) } }).catch(() => {});
    // Refus d'un appel par axso_outil : le code est celui de l'outil visé.
    return avecCodeBuilder(nom === "axso_outil" ? fiche(String(args.name ?? "")) : f, interdit!);
  }
  if (f.niveau === "ecriture" && !DEBITS.outilMin.check(`${ctx.connexionId}:${nom}`).success) return erreur("RATE_LIMITED", "trop d'appels à cet outil, réessaie dans une minute.");

  // Idempotence : la ligne du journal est créée AVANT l'exécution, sous une clé unique.
  const action = await prisma.actionIA.create({ data: { ...base, cleIdempotence: cle } }).catch(() => null);
  if (!action) {
    const deja = cle ? await prisma.actionIA.findFirst({ where: { connexionId: ctx.connexionId, cleIdempotence: cle } }) : null;
    if (!deja) return erreur("INTERNAL", ECHEC);
    return { succes: deja.statut !== "echec", resultat: `Déjà traité avec cette clé (${deja.statut}) : ${deja.sortie}`, actionId: deja.id, donnees: { action_id: deja.id, status: deja.statut, replayed: true } };
  }

  const debut = Date.now();
  const ecriture = f.niveau === "ecriture";
  let risqueFinal: Risque = f.risque;
  let r: ResultatIA;
  let statut: string;

  const conflit = ecriture ? await conflitVersion(ctx.tenantId, nom, args).catch(() => null) : null;
  if (conflit) {
    r = erreur("CONFLICT", conflit, { action: "RELOAD_AND_RETRY" });
    statut = "refuse";
  } else {
    // Risque recalculé selon l'effet réel (ex. taille d'une refonte à publier).
    const evalue = f.evaluerRisque ? await f.evaluerRisque(args, ctxOutil(ctx)).catch(() => null) : null;
    const risque = evalue?.risque ?? f.risque;
    risqueFinal = risque;
    let accord = decider(ctx.mode, risque, ecriture) === "accord";
    // Autopilote : au-delà du seuil fixé par le marchand pour les modifications de boutique, accord.
    if (!accord && evalue && ctx.mode === "autopilot" && risque === "moyen" && ctx.limites.risqueBuilderMax === "faible") accord = true;
    // Copilote : ce qui change la boutique en ligne attend toujours l'accord, quel que soit le risque.
    if (!accord && ctx.mode !== "autopilot" && f.enLigne?.(args)) accord = true;
    // Autopilote : une action à risque élevé part seule si son montant tient dans la limite du marchand.
    if (accord && !evalue && ctx.mode === "autopilot" && f.risque === "eleve" && dansLimite(f.montant?.(args), ctx.limites)) accord = false;
    if (!accord && ctx.mode === "autopilot" && nom === "mettre_a_jour_prix") {
      const p = await prisma.produit.findFirst({ where: { id: String(args.produitId), tenantId: ctx.tenantId }, select: { prix: true } });
      accord = !p || prixHorsLimite(p.prix, Number(args.prix), ctx.limites.variationPrixMax);
    }

    if (accord) {
      // La demande d'accord montre au marchand l'effet calculé (changements, aperçu) ; les paramètres exécutés restent `args`.
      const vue = evalue ? { ...args, ...(evalue.resume && { modifications: evalue.resume }), risque: risque, ...(evalue.apercu && { apercu: evalue.apercu }) } : args;
      await demanderConfirmation(ctx.tenantId, nom, vue, undefined, true, ctx.client, { connexionId: ctx.connexionId, actionId: action.id });
      r = {
        succes: true, code: "APPROVAL_REQUIRED", actionId: action.id,
        resultat: `EN ATTENTE D'ACCORD : « ${nom.replace(/_/g, " ")} » n'est PAS encore fait. Le marchand doit l'autoriser dans Axso (menu Contrôle IA). Dis-lui ce que tu as préparé et qu'il doit valider ; ne dis jamais que c'est fait.`,
        donnees: { action_id: action.id, status: "pending_approval", approval: { required: true, where: "Axso → Contrôle IA", risk: risque, changes: evalue?.resume, preview: evalue?.apercu } },
      };
      statut = "accord_demande";
    } else {
      r = await executerAvecRecu(f, args, ctx, action.id);
      statut = statutDe(r);
    }
  }

  await Promise.all([
    prisma.actionIA.update({ where: { id: action.id }, data: { statut, risque: risqueFinal, sortie: r.resultat.slice(0, 1000), dureeMs: Date.now() - debut, ...(statut === "accord_demande" && { args }) } }),
    prisma.connexionIA.update({ where: { id: ctx.connexionId }, data: { utiliseLe: new Date() } }),
  ]).catch(() => {});
  return avecCodeBuilder(f, r);
}

/** Outils du Builder : codes d'erreur BUILDER_* en plus des codes communs. */
const CODES_BUILDER: Partial<Record<CodeErreur, string>> = {
  INSUFFICIENT_PERMISSION: "BUILDER_SCOPE_REQUIRED", PLAN_REQUIRED: "BUILDER_PLAN_REQUIRED", NOT_FOUND: "BUILDER_RESOURCE_NOT_FOUND",
  INVALID_INPUT: "BUILDER_SCHEMA_INVALID", POLICY_BLOCKED: "BUILDER_POLICY_BLOCKED", APPROVAL_REQUIRED: "BUILDER_APPROVAL_REQUIRED",
  CONFLICT: "BUILDER_VERSION_CONFLICT", ASSET_INVALID: "BUILDER_ASSET_INVALID", VALIDATION_FAILED: "BUILDER_VALIDATION_FAILED",
};
function avecCodeBuilder(f: Fiche | undefined, r: ResultatIA): ResultatIA {
  if (!f?.capacite.startsWith("builder") || !r.code || !CODES_BUILDER[r.code]) return r;
  return { ...r, donnees: { ...r.donnees, builder_code: CODES_BUILDER[r.code] } };
}

// ─── Accord du marchand ──────────────────────────────────────────────────────
export interface ActionAccord { outil: string; args?: Record<string, any>; ia: { connexionId: string; actionId: string } }

/** Vrai si ce membre peut voir et décider la demande d'une IA (il a lui-même le droit de l'outil). */
export function accordVisible(outil: string, droits: GrillePermissions): boolean {
  const f = fiche(outil);
  if (!f?.module) return !!f;
  return f.niveau === "ecriture" ? droits[f.module] === "ecriture" : droits[f.module] !== "aucun";
}

/**
 * Le marchand a dit oui (app/api/axia/propositions) : l'action part avec les droits de la
 * connexion ET ceux de la personne qui valide, revérifiés maintenant.
 */
export async function executerAccordIA(tenantId: string, action: ActionAccord, droitsValideur: GrillePermissions): Promise<{ succes: boolean; resultat: string }> {
  const f = fiche(action.outil);
  const ctx = await contexteDeConnexion(action.ia.connexionId, tenantId);
  if (!f || !ctx) return { succes: false, resultat: "La connexion de cette IA a été coupée : l'action n'est pas exécutée." };
  const interdit = refus(f, ctx.plan, ctx.grille, ctx.scopes) ?? (accordVisible(action.outil, droitsValideur) ? null : erreur("INSUFFICIENT_PERMISSION", "ton rôle ne permet pas d'autoriser cette action."));
  const debut = Date.now();
  const r = interdit ?? await executerAvecRecu(f, action.args ?? {}, ctx, action.ia.actionId);
  await prisma.actionIA.updateMany({ where: { id: action.ia.actionId, tenantId }, data: { statut: interdit ? "refuse" : statutDe(r), sortie: `Autorisé par le marchand. ${r.resultat}`.slice(0, 1000), dureeMs: Date.now() - debut } });
  return { succes: r.succes, resultat: r.resultat };
}

/** Retire une demande d'accord encore en attente (objectif annulé…) : le marchand ne peut plus la valider. */
export async function retirerAccord(tenantId: string, actionId: string) {
  await prisma.axiaProposition.deleteMany({ where: { tenantId, type: "confirmation", statut: { in: ["nouveau", "vu"] }, action: { path: ["ia", "actionId"], equals: actionId } } });
  await prisma.actionIA.updateMany({ where: { id: actionId, tenantId, statut: "accord_demande" }, data: { statut: "refuse", sortie: "Demande retirée : l'objectif a été annulé." } });
}

/** Le marchand a dit non : le journal le garde. */
export const noterRefusIA = (tenantId: string, actionId: string) =>
  prisma.actionIA.updateMany({ where: { id: actionId, tenantId }, data: { statut: "refuse", sortie: "Refusé par le marchand." } });
