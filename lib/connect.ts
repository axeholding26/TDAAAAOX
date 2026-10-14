// Axso Connect — le SEUL endroit qui lit ou écrit les secrets de ConnecteurConfig
// (jetons OAuth, clés d'API saisies par le marchand). Ils sont chiffrés au repos
// (lib/chiffrement.ts) et ne sortent d'ici, en clair, que pour un usage serveur :
// jamais vers le navigateur ni vers un agent (pour l'affichage : etatConnexions).
//
// Rien n'est propre à un fournisseur : un service de plus (Microsoft, TikTok…) = un `type`
// de plus. Est secret, où qu'il soit dans `config`, tout texte rangé sous une clé dont le
// nom contient token / secret / password / apiKey / credential.
import { Prisma } from "@prisma/client";
import type { ConnecteurConfig } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chiffrer, dechiffrer, estChiffre } from "@/lib/chiffrement";

const SENSIBLE = /token|secret|password|api_?key|credential/i;
// Champs de `config` qui identifient le compte externe (jamais un secret).
const COMPTE = ["email", "user_name", "user_id", "display_phone", "numero_affiche", "verified_name", "phone_number_id"];

// Applique `f` à chaque texte secret de `v` (une clé sensible rend tout son contenu sensible).
function surSecrets(v: unknown, f: (s: string) => string | null, sensible = false): unknown {
  if (typeof v === "string") return sensible && v ? f(v) : v;
  if (Array.isArray(v)) return v.map((x) => surSecrets(x, f, sensible));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, surSecrets(x, f, sensible || SENSIBLE.test(k))]));
  return v;
}

type Ligne = Pick<ConnecteurConfig, "type" | "statut" | "pageId" | "igUserId" | "accessToken" | "config" | "createdAt" | "updatedAt">;

/** Secrets d'une ligne brute rendus en clair. Un secret illisible (clé changée) devient null : le service paraît non relié. */
export function enClair<L extends { accessToken?: string | null; config?: unknown }>(ligne: L): L {
  return {
    ...ligne,
    ...(ligne.accessToken != null && { accessToken: dechiffrer(ligne.accessToken) }),
    ...(ligne.config !== undefined && { config: surSecrets(ligne.config, dechiffrer) }),
  } as L;
}

/** Connexion d'une boutique, secrets déchiffrés. USAGE SERVEUR UNIQUEMENT : ne jamais renvoyer tel quel. */
export const lireConnexion = (tenantId: string, type: string) => lireConnexionPar({ tenantId, type });

/** Idem par un autre critère (webhook entrant : on ne connaît que l'identifiant du compte externe). */
export async function lireConnexionPar(where: Prisma.ConnecteurConfigWhereInput) {
  const ligne = await prisma.connecteurConfig.findFirst({ where });
  return ligne && enClair(ligne);
}

export interface DonneesConnexion {
  statut?: string;
  pageId?: string | null;
  igUserId?: string | null;
  accessToken?: string | null;
  config?: Record<string, unknown>;
}

/** Données prêtes à écrire : secrets chiffrés, champs absents laissés de côté. */
export function aEnregistrer(d: DonneesConnexion) {
  return {
    ...(d.statut !== undefined && { statut: d.statut }),
    ...(d.pageId !== undefined && { pageId: d.pageId }),
    ...(d.igUserId !== undefined && { igUserId: d.igUserId }),
    ...(d.accessToken !== undefined && { accessToken: d.accessToken ? chiffrer(d.accessToken) : d.accessToken }),
    ...(d.config !== undefined && { config: surSecrets(d.config, chiffrer) as Prisma.InputJsonValue }),
  };
}

/**
 * Crée ou met à jour la connexion. Un champ absent (undefined) n'est pas touché ;
 * `config`, s'il est fourni, remplace l'ancien en entier. Ne renvoie aucun secret.
 */
export async function enregistrerConnexion(tenantId: string, type: string, donnees: DonneesConnexion) {
  const data = aEnregistrer(donnees);
  return prisma.connecteurConfig.upsert({
    where: { tenantId_type: { tenantId, type } },
    create: { tenantId, type, ...data },
    update: data,
    select: { id: true, type: true, statut: true, pageId: true, igUserId: true },
  });
}

/** Déconnecte un service : ses jetons et sa configuration sont effacés. */
export async function deconnecter(tenantId: string, type: string) {
  await prisma.connecteurConfig.updateMany({
    where: { tenantId, type },
    data: { statut: "inactif", accessToken: null, pageId: null, igUserId: null, config: {} },
  });
}

/** Fiche d'une connexion SANS aucun secret (affichable). null : la ligne ne porte aucun jeton (rien de relié). */
export function etatDeLigne(l: Ligne) {
  let secrets = 0, enClairEnBase = 0, illisibles = 0;
  const voir = (s: string) => { secrets++; if (!estChiffre(s)) enClairEnBase++; else if (dechiffrer(s) === null) illisibles++; return null; };
  if (l.accessToken) voir(l.accessToken);
  surSecrets(l.config, voir);
  if (!secrets) return null;

  const cfg = (l.config && typeof l.config === "object" && !Array.isArray(l.config) ? l.config : {}) as Record<string, unknown>;
  const compte: Record<string, string> = {};
  if (l.pageId) compte.pageId = l.pageId;
  if (l.igUserId) compte.igUserId = l.igUserId;
  for (const k of COMPTE) if (typeof cfg[k] === "string" && cfg[k]) compte[k] = cfg[k] as string;
  const droits = Array.isArray(cfg.scopes) ? cfg.scopes.filter((s): s is string => typeof s === "string")
    : typeof cfg.scope === "string" ? cfg.scope.split(/[\s,]+/).filter(Boolean) : [];
  const expiration = typeof cfg.expires_at === "string" || typeof cfg.expires_at === "number" ? new Date(cfg.expires_at) : null;
  const expireLe = expiration && !isNaN(+expiration) ? expiration : null;

  return {
    type: l.type,
    // « a_reconnecter » : jeton illisible avec la clé actuelle. « expire » : date d'expiration connue et dépassée.
    statut: illisibles ? "a_reconnecter" : expireLe && expireLe < new Date() ? "expire" : l.statut,
    compte,
    droits,
    expireLe,
    // false : jeton hérité encore en clair en base (il se chiffre à la prochaine écriture).
    chiffre: enClairEnBase === 0,
    creeLe: l.createdAt,
    majLe: l.updatedAt,
  };
}

/** Services reliés d'une boutique, sans aucun secret. */
export async function etatConnexions(tenantId: string) {
  const lignes = await prisma.connecteurConfig.findMany({ where: { tenantId }, orderBy: { type: "asc" } });
  return lignes.map(etatDeLigne).filter((e) => e !== null);
}
