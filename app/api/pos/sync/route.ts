// Synchronisation hors ligne de la caisse.
// GET  /api/pos/sync — appel léger : « le serveur répond-il, et suis-je encore
//   connecté ? ». Sert à la détection de connexion du poste (navigator.onLine ne
//   suffit pas) et dit si le mode hors ligne est activé pour la boutique.
//   Réponse : { ok, serveurAt, tenantId, userId, actif }. 401 = session expirée.
// POST /api/pos/sync — fin d'un passage de rejeu : publie `sync.completed`.
//   Corps : { cle, appareilId?, envoyees, conflits, aTraiter, restantes }. Droit : vendre.
import { routePos } from "@/lib/pos/acces";
import { flagActif } from "@/lib/pos/flags";
import { schemaFinSync, terminerSynchronisation } from "@/lib/pos/hors-ligne/service";

export const GET = routePos(async (ctx) => ({
  ok: true, serveurAt: new Date().toISOString(), tenantId: ctx.tenantId, userId: ctx.userId,
  actif: await flagActif(ctx.tenantId, "offline_pos"),
}));

export const POST = routePos(async (ctx, req) => terminerSynchronisation(ctx, schemaFinSync.parse(await req.json())));
