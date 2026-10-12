// Point de passage de TOUTE route /api/pos de la caisse 2.0 : qui appelle,
// pour quelle boutique, sur quelle caisse, avec quels droits. SERVEUR uniquement.
//
// Deux façons d'être reconnu :
// 1. Session marchande (cookie next-auth) : propriétaire ou membre d'équipe.
// 2. Jeton d'appareil appairé (téléphone-scanner) : en-tête
//    `Authorization: Bearer <jeton>` ou cookie httpOnly `axso_pos_appareil`.
//    Seule l'empreinte SHA-256 du jeton est en base (AppareilPos.tokenHash) ;
//    un appareil révoqué est refusé à la requête suivante.
//
// La boutique (tenantId) vient TOUJOURS de la session ou de l'appareil, jamais
// du corps ni de l'URL de la requête.
//
// ET LE PROXY ? proxy.ts → moduleApi("/api/pos/…") rend le module « pos »
// (« finance » pour comptabilite, charges, rapprochement ; aucun module pour
// import, export, audit et scanner : droits fins seuls). Le proxy ne contrôle
// ce module QUE si la requête porte une session marchande : il refuse alors un
// membre dont la grille ferme le module (lecture pour GET, écriture sinon).
// SANS session (cas du téléphone appairé), le proxy laisse passer sans rien
// vérifier : c'est accesPos() qui authentifie. Une route /api/pos qui
// n'appellerait pas accesPos() serait donc publique — ne jamais l'oublier.
// Conséquence utile : l'appel d'un téléphone appairé ne paie pas les 2 à 3
// requêtes SQL du proxy.
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "../auth";
import { prisma } from "../prisma";
import { boutiquesDuCompte } from "../tenant";
import { ErreurPos, reponseErreurPos } from "./erreurs";
import { AUCUN_DROIT, droitsAppareil, droitsPour } from "./droits";
import { resoudreCaisse } from "./magasins";
import type { ContextePos, DroitsPos } from "./types";

/** Cookie httpOnly posé sur le téléphone à l'appairage (lot scanner). */
export const COOKIE_APPAREIL = "axso_pos_appareil";
/** En-tête par lequel l'écran indique la caisse sur laquelle il travaille. */
export const ENTETE_CAISSE = "x-pos-caisse";

/** Empreinte d'un jeton d'appareil : la seule forme qui entre en base. */
export function hacherJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

function lireJeton(req: Request): string | null {
  const autorisation = req.headers.get("authorization");
  if (autorisation?.toLowerCase().startsWith("bearer ")) return autorisation.slice(7).trim() || null;
  const cookie = req.headers.get("cookie")?.split(";").map((c) => c.trim()).find((c) => c.startsWith(COOKIE_APPAREIL + "="));
  return cookie ? decodeURIComponent(cookie.slice(COOKIE_APPAREIL.length + 1)) || null : null;
}

/**
 * Droits d'un compte sur une boutique : tous pour le propriétaire, la grille
 * du rôle (retouchée par droitsPos) pour un membre actif, null sinon.
 */
export async function droitsUtilisateur(tenantId: string, userId: string): Promise<{ droits: DroitsPos; magasinIds: string[]; nom: string | null } | null> {
  const [proprio, membre] = await Promise.all([
    prisma.proprietaireBoutique.findUnique({ where: { userId_tenantId: { userId, tenantId } }, select: { id: true } }),
    prisma.membreEquipe.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { nom: true, role: true, permissions: true, statut: true, droitsPos: true, magasinIds: true },
    }),
  ]);
  if (proprio) return { droits: droitsPour({ proprietaire: true }), magasinIds: [], nom: null };
  if (membre) {
    if (membre.statut !== "actif") return null;
    return { droits: droitsPour({ proprietaire: false, ...membre }), magasinIds: membre.magasinIds, nom: membre.nom };
  }
  // Comptes créés avant l'écriture du lien propriétaire (même rattrapage que permissionsSession).
  const { proprietaire } = await boutiquesDuCompte(userId);
  return proprietaire.includes(tenantId) ? { droits: droitsPour({ proprietaire: true }), magasinIds: [], nom: null } : null;
}

/**
 * Contexte de la requête, ou la réponse de refus à renvoyer telle quelle :
 *   const ctx = await accesPos(req); if (ctx instanceof NextResponse) return ctx;
 * La caisse est celle de l'en-tête `x-pos-caisse` (vérifiée), sinon la première
 * caisse autorisée ; pour un appareil, celle à laquelle il est appairé.
 */
export async function accesPos(req: Request): Promise<ContextePos | NextResponse> {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const session = await auth();
    const u = session?.user as { id?: string; tenantId?: string | null; name?: string | null; email?: string | null } | undefined;

    if (u?.id && u.tenantId) {
      const acces = await droitsUtilisateur(u.tenantId, u.id);
      if (!acces) throw new ErreurPos("non_autorise", 403, "Votre compte n'a pas accès à la caisse de cette boutique.");
      const { magasinId, caisseId } = await resoudreCaisse(u.tenantId, { caisseId: req.headers.get(ENTETE_CAISSE), magasinIds: acces.magasinIds });
      const ouverte = await prisma.sessionCaisse.findUnique({ where: { caisseOuverteId: caisseId }, select: { id: true } });
      return {
        tenantId: u.tenantId, userId: u.id, userNom: acces.nom ?? u.name ?? u.email ?? "Utilisateur",
        magasinId, caisseId, magasinIds: acces.magasinIds, sessionCaisseId: ouverte?.id, droits: acces.droits, ip,
      };
    }

    const jeton = lireJeton(req);
    if (!jeton) throw new ErreurPos("non_connecte", 401, "Votre session a expiré. Reconnectez-vous pour continuer.");
    const appareil = await prisma.appareilPos.findUnique({ where: { tokenHash: hacherJeton(jeton) } });
    if (!appareil || appareil.statut !== "actif") {
      throw new ErreurPos("appareil_refuse", 401, "Cet appareil n'est plus autorisé. Appairez-le de nouveau depuis la caisse.");
    }
    // L'appareil agit au nom de celui qui l'a appairé, avec au plus ses droits.
    const proprietaire = await droitsUtilisateur(appareil.tenantId, appareil.appairePar);
    const { magasinId, caisseId } = await resoudreCaisse(appareil.tenantId, { caisseId: appareil.caisseId });
    const ouverte = await prisma.sessionCaisse.findUnique({ where: { caisseOuverteId: caisseId }, select: { id: true } });
    return {
      tenantId: appareil.tenantId, userId: appareil.appairePar, userNom: `Appareil « ${appareil.nom} »`,
      magasinId, caisseId, magasinIds: proprietaire?.magasinIds, sessionCaisseId: ouverte?.id, appareilId: appareil.id,
      droits: proprietaire ? droitsAppareil(proprietaire.droits) : AUCUN_DROIT, ip,
    };
  } catch (e) {
    const r = reponseErreurPos(e);
    return new NextResponse(r.body, { status: r.status, headers: r.headers });
  }
}

/**
 * Habillage d'une route de la caisse : authentifie (accesPos), exécute, et
 * traduit toute exception en phrase humaine (reponseErreurPos).
 *   export const GET = routePos(async (ctx, req) => ({ … }));
 * Le gestionnaire rend un objet (envoyé en JSON) ou une Response.
 */
export function routePos<P = Record<string, never>>(fn: (ctx: ContextePos, req: Request, params: P) => Promise<Response | object>) {
  return async (req: Request, extra: { params: Promise<P> }): Promise<Response> => {
    const ctx = await accesPos(req);
    if (ctx instanceof NextResponse) return ctx;
    try {
      const r = await fn(ctx, req, await extra.params);
      return r instanceof Response ? r : NextResponse.json(r);
    } catch (e) {
      return reponseErreurPos(e);
    }
  };
}

/** Clé d'idempotence d'une requête : en-tête `Idempotency-Key`, sinon champ `cle` du corps. */
export function cleIdempotence(req: Request, corps?: { cle?: unknown } | null): string | undefined {
  const cle = req.headers.get("idempotency-key") ?? (typeof corps?.cle === "string" ? corps.cle : null);
  return cle?.trim() || undefined;
}
