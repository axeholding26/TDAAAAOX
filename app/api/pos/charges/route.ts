// Charges d'exploitation du magasin (loyer, salaires, énergie… et dépenses
// sorties d'une caisse). Droit : voir_couts ou rapprochement.
// GET  /api/pos/charges?debut=&fin=&statut= — liste et totaux.
// POST /api/pos/charges — enregistre une charge.
// La boutique vient de la session (accesPos), jamais de la requête.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { exigerUnDroit } from "@/lib/pos/droits";
import { journaliserAudit } from "@/lib/pos/audit";
import { CATEGORIES_CHARGE } from "@/lib/pos/caisse/mouvements";

const dateOptionnelle = z.preprocess((v) => (v ? new Date(v as string) : null), z.date().nullable());

const schemaCharge = z.object({
  categorie: z.enum(CATEGORIES_CHARGE),
  description: z.string().trim().min(1).max(300),
  // Le formulaire envoie le montant en texte.
  montant: z.coerce.number().finite().positive().max(1e12),
  frequence: z.enum(["ponctuelle", "hebdomadaire", "mensuelle", "annuelle"]).catch("ponctuelle"),
  statut: z.enum(["payee", "en_attente", "en_retard"]).catch("payee"),
  dateEnregistrement: dateOptionnelle.optional(),
  dateEcheance: dateOptionnelle.optional(),
  fournisseur: z.string().trim().max(120).nullish(),
  reference: z.string().trim().max(120).nullish(),
  notes: z.string().trim().max(500).nullish(),
});

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "voir_couts", "rapprochement");
  const p = new URL(req.url).searchParams;
  const date = (cle: string) => { const d = p.get(cle) ? new Date(p.get(cle)!) : null; return d && !Number.isNaN(d.getTime()) ? d : undefined; };
  const debut = date("debut"), fin = date("fin"), statut = p.get("statut");
  const charges = await prisma.chargeExploitation.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(debut || fin ? { dateEnregistrement: { gte: debut, lte: fin } } : {}),
      ...(statut && statut !== "all" ? { statut } : {}),
    },
    orderBy: { dateEnregistrement: "desc" }, take: 300,
  });
  const parCategorie: Record<string, number> = {};
  for (const c of charges) parCategorie[c.categorie] = (parCategorie[c.categorie] || 0) + c.montant;
  return {
    charges,
    stats: {
      total: Math.round(charges.reduce((s, c) => s + c.montant, 0) * 100) / 100,
      enAttente: charges.filter((c) => c.statut === "en_attente").reduce((s, c) => s + c.montant, 0),
      parCategorie,
    },
  };
});

export const POST = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "voir_couts", "rapprochement");
  const d = schemaCharge.parse(await req.json());
  const { devise } = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { devise: true } });
  const charge = await prisma.$transaction(async (tx) => {
    const c = await tx.chargeExploitation.create({
      data: {
        tenantId: ctx.tenantId, categorie: d.categorie, description: d.description, montant: d.montant, devise,
        frequence: d.frequence, statut: d.statut, dateEnregistrement: d.dateEnregistrement ?? new Date(), dateEcheance: d.dateEcheance ?? null,
        fournisseur: d.fournisseur || null, reference: d.reference || null, notes: d.notes || null, creePar: ctx.userId,
      },
    });
    await journaliserAudit(tx, ctx, { action: "charge.creee", entite: "ChargeExploitation", entiteId: c.id, apres: { categorie: c.categorie, description: c.description, montant: c.montant, statut: c.statut } });
    return c;
  });
  return NextResponse.json({ charge }, { status: 201 });
});
