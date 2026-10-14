import { prisma } from "./prisma";
import { redirect } from "next/navigation";
import { boutiquesDuCompte } from "./tenant";
import { planActif } from "./abonnement";
import { palierAuMoins, type Palier } from "./plans";
import { TOUT_ECRITURE, grillePourMembre, type ModuleKey, type GrillePermissions } from "./permissions";

// Fonctions serveur du système de permissions équipe — jamais importées
// depuis un composant client (voir le commentaire en tête de lib/permissions.ts).
// Permissions volontairement DÉCOUPLÉES du JWT : recalculées à chaque appel
// via une lecture DB légère, comme planActif() dans lib/abonnement.ts — ça
// garantit qu'une suspension ou un changement de rôle prend effet
// immédiatement, dès la requête suivante, sans avoir à réécrire le cookie.

const AUCUN_PARTOUT: GrillePermissions = {
  commandes: "aucun", produits: "aucun", pos: "aucun", clients: "aucun",
  marketing: "aucun", finance: "aucun", equipe: "aucun", parametres: "aucun", boutique: "aucun",
};

/**
 * Permissions effectives pour la session courante, sur la boutique active.
 * Propriétaire de la boutique => accès complet ; membre d'équipe => sa grille ;
 * tout autre compte (livreur, membre d'une autre boutique...) => aucun accès.
 */
export async function permissionsSession(session: any): Promise<GrillePermissions> {
  const userId = session?.user?.id as string | undefined;
  const tenantId = session?.user?.tenantId as string | undefined;
  if (!userId || !tenantId) return AUCUN_PARTOUT;

  const [proprio, membre] = await Promise.all([
    prisma.proprietaireBoutique.findUnique({ where: { userId_tenantId: { userId, tenantId } }, select: { id: true } }),
    prisma.membreEquipe.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { role: true, permissions: true, statut: true },
    }),
  ]);

  if (proprio) return TOUT_ECRITURE;
  if (membre) return membre.statut === "suspendu" ? AUCUN_PARTOUT : grillePourMembre(membre);
  // Comptes créés avant l'écriture du lien propriétaire : rattrapés ici.
  const { proprietaire } = await boutiquesDuCompte(userId);
  return proprietaire.includes(tenantId) ? TOUT_ECRITURE : AUCUN_PARTOUT;
}

/** true si le membre connecté est un caissier "pur" (préréglage par défaut, sans personnalisation) — utilisé pour le Mode Caisse plein écran. */
export async function estCaissierPur(session: any): Promise<boolean> {
  const userId = session?.user?.id as string | undefined;
  const tenantId = session?.user?.tenantId as string | undefined;
  if (!userId || !tenantId) return false;
  const membre = await prisma.membreEquipe.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { role: true, statut: true },
  });
  return !!membre && membre.statut === "actif" && membre.role === "caissier";
}

/** Vérifie qu'un niveau d'accès minimum est requis pour un module donné, pour usage dans une route API. Retourne null si autorisé, sinon un objet {status} à renvoyer tel quel. */
export async function requireNiveau(session: any, module: ModuleKey, minimum: "lecture" | "ecriture"): Promise<{ status: number; error: string } | null> {
  const grille = await permissionsSession(session);
  const niveau = grille[module];
  if (niveau === "aucun") return { status: 403, error: "Accès non autorisé à ce module" };
  if (minimum === "ecriture" && niveau !== "ecriture") return { status: 403, error: "Lecture seule — action non autorisée" };
  return null;
}

/** Accès complet à la boutique active (propriétaire, ou membre aux droits complets). */
export async function accesComplet(session: any): Promise<boolean> {
  return Object.values(await permissionsSession(session)).every((n) => n === "ecriture");
}

/**
 * Agents IA qui agissent sans confirmation (/api/ai/agent-*, copilote) : ils
 * touchent plusieurs modules à la fois, donc réservés à un accès complet sur la
 * boutique (même règle que deleguer_vers_agent d'AXIA, lib/axia/droits.ts).
 * `palierPro` : agents autonomes promis à partir du Palier Pro.
 */
export async function refusAgentIA(session: any, palierPro = true): Promise<{ status: number; error: string } | null> {
  if (!(await accesComplet(session))) return { status: 403, error: "Les agents IA sont réservés au propriétaire de la boutique" };
  if (palierPro) return refusPalier(session?.user?.tenantId, "palier1", "L'accès aux agents IA");
  return null;
}

/** 403 clair si la boutique n'a pas le palier requis (contrôle serveur des fonctions payantes). */
export async function refusPalier(tenantId: string | undefined, requis: Palier, quoi = "Cette fonctionnalité"): Promise<{ status: number; error: string } | null> {
  if (!tenantId) return { status: 401, error: "Non autorisé" };
  if (palierAuMoins((await planActif(tenantId)).plan, requis)) return null;
  return { status: 403, error: `${quoi} ${requis === "palier2" ? "nécessite le Palier Illimité" : "est disponible à partir du Palier Pro"}.` };
}

/** Envoi de fichiers : membre actif ayant l'écriture sur au moins un module (jamais lecture seule ni suspendu). */
export async function peutTeleverser(session: any): Promise<boolean> {
  return Object.values(await permissionsSession(session)).some((n) => n === "ecriture");
}

/** Page serveur du tableau de bord : même règle que le menu — sans accès au module, retour à l'accueil. */
export async function exigerModule(session: any, module: ModuleKey): Promise<void> {
  const grille = await permissionsSession(session);
  if (grille[module] === "aucun") redirect("/dashboard/accueil");
}
