// Encaissement du remboursement d'une dette client.
// POST /api/pos/credit/remboursements — droits : encaisser ET (gerer_credit ou vente_credit).
// Corps : { clientId, montant, mode (especes | mobile_money | carte | virement | qr), reference?, prestataire?, cle }.
// Réponse : { ok, clientId, rembourse, resteDu, affectations, nonVerifie, rejoue }.
// L'argent est affecté aux ventes à crédit du client, la plus ancienne échéance
// d'abord, et compté dans la session de caisse ouverte (voir lib/pos/credit.ts).
// `nonVerifie` : le moyen est déclaratif (confirmé par le caissier, pas par un prestataire).
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { exigerDroit, exigerUnDroit } from "@/lib/pos/droits";
import { ErreurPos, erreurs } from "@/lib/pos/erreurs";
import { journaliserAudit } from "@/lib/pos/audit";
import { publierEvenement } from "@/lib/pos/evenements";
import { lireReglagesPos, sessionObligatoire } from "@/lib/pos/flags";
import { avecIdempotence } from "@/lib/pos/idempotence";
import { MODES_PAIEMENT, ajouterPaiement } from "@/lib/pos/paiements";
import { MODES_REMBOURSEMENT, encaisserRemboursement } from "@/lib/pos/credit";
import { arrondir, decimalesDevise } from "@/lib/pos/tarification";

const schema = z.object({
  clientId: z.string().trim().min(1).max(64),
  montant: z.number().finite().positive().max(1e12),
  mode: z.enum(MODES_REMBOURSEMENT),
  reference: z.string().trim().max(120).nullish(),
  prestataire: z.string().trim().max(60).nullish(),
  cle: z.string().trim().min(8).max(200).optional(),
});

export const POST = routePos(async (ctx, req) => {
  exigerDroit(ctx, "encaisser");
  exigerUnDroit(ctx, "gerer_credit", "vente_credit");
  const corps = await req.json();
  const d = schema.parse(corps);
  const cle = cleIdempotence(req, corps);
  if (!cle) throw erreurs.invalide("La demande n'a pas d'identifiant. Rechargez la page puis réessayez.");

  const [r, tenant] = await Promise.all([
    lireReglagesPos(ctx.tenantId),
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { devise: true } }),
  ]);
  const def = MODES_PAIEMENT[d.mode];
  if (!r.reglages.paiements.modes.includes(d.mode)) {
    throw new ErreurPos("mode_desactive", 422, `Le moyen de paiement « ${def.libelle} » n'est pas activé dans les réglages de la caisse.`);
  }
  const obligatoire = sessionObligatoire(r);
  if (obligatoire && !ctx.sessionCaisseId) throw new ErreurPos("caisse_fermee", 409, "La caisse est fermée. Ouvrez-la pour encaisser ce remboursement.");
  const montant = arrondir(d.montant, decimalesDevise(tenant.devise));

  const { resultat, rejoue } = await avecIdempotence(ctx.tenantId, cle, "credit.rembourser", async (tx) => {
    // Verrou de la session : la fermeture attend cet encaissement ; fermée entre-temps, on ne s'y rattache pas.
    let ici = ctx;
    if (ctx.sessionCaisseId) {
      const ouverte = await tx.sessionCaisse.updateMany({ where: { id: ctx.sessionCaisseId, statut: "ouverte" }, data: { nbVentes: { increment: 0 } } });
      if (ouverte.count === 0) {
        if (obligatoire) throw new ErreurPos("caisse_fermee", 409, "La session de caisse vient d'être fermée. Ouvrez-la de nouveau pour encaisser.");
        ici = { ...ctx, sessionCaisseId: undefined };
      }
    }
    const res = await encaisserRemboursement(tx, ici, { clientId: d.clientId, montant, mode: d.mode, reference: d.reference, prestataire: d.prestataire }, ajouterPaiement);
    await journaliserAudit(tx, ici, {
      action: "credit.rembourse", entite: "Client", entiteId: d.clientId,
      avant: { du: res.resteDu + res.rembourse },
      apres: { du: res.resteDu, rembourse: res.rembourse, mode: d.mode, declaratif: def.statut === "declaratif", reference: d.reference ?? null, ventes: res.affectations.map((a) => ({ commandeId: a.commandeId, montant: a.montant })) },
    });
    await publierEvenement(tx, {
      tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: ctx.caisseId, type: "payment.updated",
      payload: { origine: "remboursement_credit", clientId: d.clientId, montant: res.rembourse, mode: d.mode, declaratif: def.statut === "declaratif", commandeIds: res.affectations.map((a) => a.commandeId), par: ctx.userNom },
    });
    return res;
  }, { userId: ctx.userId, appareilId: ctx.appareilId });
  return { ok: true, ...resultat, nonVerifie: def.statut === "declaratif", rejoue };
});
