// Rejeu d'UNE mutation de la file hors ligne (aujourd'hui : une vente).
// POST /api/pos/sync/rejeu — corps : schemaRejeu
//   { cle, type: "vente", payload, appareilId, userId, creeLocalAt, version, tentatives, local }.
//   Réponse : { ok, commandeId, numero, total, paye, du, monnaie, conflits, rejoue }.
// Idempotent sur `cle` : rejouée (réponse perdue, double envoi), la même clé
// rend la vente d'origine avec `rejoue: true`, jamais un doublon.
// Droit : vendre (et encaisser, vérifié à l'écriture des paiements).
// PAS conditionné au drapeau offline_pos : une vente déjà faite doit pouvoir
// être synchronisée même si le mode hors ligne a été éteint entre-temps. Le
// quota du palier gratuit ne s'applique pas non plus : la vente a eu lieu.
// Règles de conflit : lib/pos/hors-ligne/conflits.ts et service.ts.
import { routePos } from "@/lib/pos/acces";
import { rejouerVente, schemaRejeu } from "@/lib/pos/hors-ligne/service";

export const POST = routePos(async (ctx, req) => ({ ok: true, ...(await rejouerVente(ctx, schemaRejeu.parse(await req.json()))) }));
