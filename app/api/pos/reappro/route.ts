// Réapprovisionnement de la caisse.
// GET  /api/pos/reappro — droit : achat_creer ou achat_valider.
//   Réponse : { aCommander, sansRecommandation, analyses, fournisseurs, peutCreer }.
//   Chaque ligne porte le détail du calcul (lib/pos/achats/reappro.ts).
// POST /api/pos/reappro — droit : achat_creer.
//   Corps : { lignes: [{ produitId, quantite, fournisseurId }], cle }.
//   Prépare un bon de commande EN BROUILLON par fournisseur (source « reappro »),
//   au prix d'achat connu du produit (0 = à compléter sur le bon).
//   Réponse : 201 { ok, bons: [{ id, numero, fournisseur, lignes, montantTotal }], rejoue }.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { aDroit, exigerDroit, exigerUnDroit } from "@/lib/pos/droits";
import { creerBons, MAX_LIGNES_BON, type DemandeBon } from "@/lib/pos/achats/bons";
import { recommandationsReappro } from "@/lib/pos/achats/reappro";

const schema = z.object({
  lignes: z.array(z.object({
    produitId: z.string().min(1),
    fournisseurId: z.string().min(1, "Choisissez un fournisseur pour chaque produit."),
    quantite: z.number().int().positive().max(10_000_000),
  })).min(1, "Sélectionnez au moins un produit à commander.").max(500),
});

export const GET = routePos(async (ctx) => {
  exigerUnDroit(ctx, "achat_creer", "achat_valider");
  const [reco, fournisseurs] = await Promise.all([
    recommandationsReappro(ctx.tenantId),
    prisma.fournisseur.findMany({ where: { tenantId: ctx.tenantId, actif: true }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
  ]);
  return { ...reco, fournisseurs, peutCreer: aDroit(ctx, "achat_creer") };
});

export const POST = routePos(async (ctx, req) => {
  exigerDroit(ctx, "achat_creer");
  const corps = await req.json();
  const { lignes } = schema.parse(corps);
  const couts = new Map((await prisma.produit.findMany({ where: { tenantId: ctx.tenantId, id: { in: lignes.map((l) => l.produitId) } }, select: { id: true, cout: true } })).map((p) => [p.id, p.cout ?? 0]));
  const parFournisseur = new Map<string, DemandeBon>();
  for (const l of lignes) {
    const bon = parFournisseur.get(l.fournisseurId) ?? { fournisseurId: l.fournisseurId, lignes: [] };
    bon.lignes.push({ produitId: l.produitId, quantite: l.quantite, prixUnitaire: couts.get(l.produitId) ?? 0 });
    parFournisseur.set(l.fournisseurId, bon);
  }
  const demandes = [...parFournisseur.values()];
  if (demandes.some((d) => d.lignes.length > MAX_LIGNES_BON)) {
    return NextResponse.json({ error: `Un bon de commande contient ${MAX_LIGNES_BON} lignes au plus : commandez ce fournisseur en plusieurs fois.`, code: "invalide" }, { status: 400 });
  }
  const r = await creerBons(ctx, demandes, "reappro", cleIdempotence(req, corps));
  return NextResponse.json(
    { ok: true, ...r, ...(r.rejoue ? { message: "Ces bons de commande ont déjà été préparés. Aucun doublon n'a été créé." } : {}) },
    { status: r.rejoue ? 200 : 201 },
  );
});
