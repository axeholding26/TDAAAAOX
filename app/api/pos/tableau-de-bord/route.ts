// Pilotage en direct du magasin (§36, §37).
// GET /api/pos/tableau-de-bord?debut=&fin=&tz=&magasinId=&caisseId=&vendeurId=&produitId=&categorie=
// Droit : voir_analytics. Coût et marge ne sont rendus qu'avec voir_couts.
// Tous les chiffres viennent de lib/pos/analytics/ventes.ts (ventes de caisse
// réelles, retours déduits, magasins de démonstration exclus).
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { aDroit, exigerDroit } from "@/lib/pos/droits";
import { agregerVentes, encaissements, indicateurs, lireFiltres, periodePrecedente, totalVentes } from "@/lib/pos/analytics/ventes";
import { listesFiltres } from "@/lib/pos/analytics/listes";

/** Faits montrés dans « Activité en direct » (les mêmes types arrivent ensuite par le flux temps réel). */
const TYPES_ACTIVITE = ["sale.created", "sale.cancelled", "return.created", "scan.created", "cash.opened", "cash.closed", "cash.movement", "device.connected", "device.disconnected", "alert.created"];

export const GET = routePos(async (ctx, req) => {
  exigerDroit(ctx, "voir_analytics");
  const voirCouts = aDroit(ctx, "voir_couts");
  const f = await lireFiltres(ctx, new URL(req.url).searchParams);

  const [tenant, total, precedent, parMagasin, modes, listes, evenements] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { devise: true } }),
    totalVentes(f),
    totalVentes(periodePrecedente(f)),
    agregerVentes(f, "magasin"),
    encaissements(f),
    listesFiltres(f),
    prisma.evenementPos.findMany({
      where: {
        tenantId: ctx.tenantId, type: { in: TYPES_ACTIVITE },
        ...(f.magasinId ? { magasinId: f.magasinId } : f.magasinsAutorises.length ? { OR: [{ magasinId: { in: f.magasinsAutorises } }, { magasinId: null }] } : {}),
        ...(f.caisseId ? { caisseId: f.caisseId } : {}),
      },
      orderBy: { seq: "desc" }, take: 30,
    }),
  ]);

  const aCredit = Math.max(0, modes.find((m) => m.mode === "credit")?.montant ?? 0);
  const chiffres = new Map(parMagasin.map((a) => [a.cle, a]));
  return {
    periode: { debut: f.debut.toISOString(), fin: f.fin.toISOString() },
    devise: tenant.devise, voirCouts,
    resume: indicateurs(total, voirCouts),
    precedent: { ca: precedent.ca, transactions: precedent.transactions },
    /** Part vendue à crédit sur la période, et le reste (encaissé, tous moyens). */
    aCredit, encaisse: Math.max(0, total.ca - aCredit),
    encaissements: modes,
    magasins: listes.magasins.filter((m) => !m.demo).map((m) => {
      const a = chiffres.get(m.id);
      return {
        id: m.id, nom: m.nom, actif: m.actif, ca: a?.ca ?? 0, transactions: a?.transactions ?? 0,
        marge: voirCouts ? a?.marge ?? 0 : null,
        caisses: m.caisses.filter((c) => c.actif).length, caissesOuvertes: m.caisses.filter((c) => c.ouverte).length,
      };
    }),
    /** Ventes d'avant la caisse 2.0, sans magasin enregistré. */
    sansMagasin: chiffres.get("") ? { ca: chiffres.get("")!.ca, transactions: chiffres.get("")!.transactions } : null,
    activite: evenements.map((e) => ({ seq: e.seq.toString(), type: e.type, magasinId: e.magasinId, caisseId: e.caisseId, payload: e.payload, createdAt: e.createdAt.toISOString() })),
    filtres: listes,
  };
});
