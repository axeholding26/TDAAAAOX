// Réglages de la caisse et contexte de travail.
// GET   /api/pos/reglages — tout ce qu'il faut pour démarrer un écran de caisse
//   en un appel : réglages, drapeaux, droits de la personne, magasin, caisse,
//   session ouverte, devise, moyens de paiement et leur état réel.
// PATCH /api/pos/reglages — droit : gerer_reglages. Corps : schemaReglages
//   (partiel : seules les clés envoyées changent). Tracé dans le journal d'audit.
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { journaliserAudit } from "@/lib/pos/audit";
import { enregistrerReglagesPos, lireReglagesPos, sessionObligatoire } from "@/lib/pos/flags";
import { MODES_PAIEMENT } from "@/lib/pos/paiements";
import { schemaReglages } from "@/lib/pos/schemas";

export const GET = routePos(async (ctx) => {
  const [reglages, boutique, caisse, session] = await Promise.all([
    lireReglagesPos(ctx.tenantId),
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { nomBoutique: true, devise: true, tauxTVA: true, pays: true, logoUrl: true, adresse: true, telephone: true } }),
    prisma.caisse.findFirst({ where: { id: ctx.caisseId, tenantId: ctx.tenantId }, select: { id: true, nom: true, magasin: { select: { id: true, nom: true, ville: true, adresse: true, telephone: true, entrepotId: true } } } }),
    ctx.sessionCaisseId
      ? prisma.sessionCaisse.findUnique({ where: { id: ctx.sessionCaisseId }, select: { id: true, ouvertePar: true, ouverteAt: true, fondsInitial: true, nbVentes: true } })
      : null,
  ]);
  return {
    ...reglages,
    sessionObligatoire: sessionObligatoire(reglages),
    droits: ctx.droits,
    utilisateur: { id: ctx.userId, nom: ctx.userNom, appareilId: ctx.appareilId ?? null },
    boutique,
    magasin: caisse?.magasin ?? null,
    caisse: caisse ? { id: caisse.id, nom: caisse.nom } : null,
    session,
    // Moyens proposés par la boutique, avec leur état réel (actif | declaratif | a_connecter).
    modesPaiement: reglages.reglages.paiements.modes.map((m) => MODES_PAIEMENT[m]).filter(Boolean),
  };
});

export const PATCH = routePos(async (ctx, req) => {
  exigerDroit(ctx, "gerer_reglages");
  const modif = schemaReglages.parse(await req.json());
  const apres = await prisma.$transaction(async (tx) => {
    const r = await enregistrerReglagesPos(ctx.tenantId, modif, tx);
    await journaliserAudit(tx, ctx, { action: "reglages.modifies", entite: "ReglagesPos", entiteId: ctx.tenantId, avant: r.avant, apres: r.apres });
    return r.apres;
  });
  return { ok: true, ...apres };
});
