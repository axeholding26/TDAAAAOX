// Détail d'une vente en caisse (reçu, retour, annulation).
// GET /api/pos/ventes/:id — droit : vendre (ventes de sa caisse) ou voir_caisse (toutes).
import { prisma } from "@/lib/prisma";
import { CANAL } from "@/lib/commandes";
import { routePos } from "@/lib/pos/acces";
import { aDroit, exigerUnDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { MODES_PAIEMENT } from "@/lib/pos/paiements";
import type { ModePaiement } from "@/lib/pos/types";

export const GET = routePos<{ id: string }>(async (ctx, _req, { id }) => {
  exigerUnDroit(ctx, "vendre", "voir_caisse");
  const vente = await prisma.commande.findFirst({
    where: { id, tenantId: ctx.tenantId, canal: CANAL.POS, ...(aDroit(ctx, "voir_caisse") ? {} : { caisseId: ctx.caisseId }) },
    include: {
      lignes: true,
      paiements: { orderBy: { createdAt: "asc" } },
      facture: { select: { id: true, numero: true, statut: true } },
      client: { select: { id: true, nom: true, telephone: true, email: true, pointsFidelite: true, niveauFidelite: true } },
    },
  });
  if (!vente) throw new ErreurPos("introuvable", 404, "Cette vente est introuvable dans cette boutique.");
  const voirCouts = aDroit(ctx, "voir_couts");
  return {
    vente: {
      ...vente,
      lignes: vente.lignes.map((l) => (voirCouts ? l : { ...l, cout: null })),
      // `nonVerifie` : paiement confirmé par le caissier, jamais par un prestataire — à afficher tel quel.
      paiements: vente.paiements.map((p) => ({ ...p, libelle: MODES_PAIEMENT[p.mode as ModePaiement]?.libelle ?? p.mode, nonVerifie: p.declaratif })),
    },
  };
});
