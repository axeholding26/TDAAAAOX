// Expéditions internationales (fournisseur → pays → entrepôt local).
// Le suivi est saisi par le marchand à partir des informations de son
// fournisseur ou de son transitaire : aucun transporteur n'est interrogé.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { accesSourcing, contexteCalcul, journaliser, erreur, reponseErreur } from "@/lib/sourcing/acces";
import { STATUTS_EXPEDITION, transitionExpeditionValide } from "@/lib/sourcing/statuts";
import { configPays } from "@/lib/sourcing/pays";

const date = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "date invalide").transform((s) => new Date(s));
const champs = {
  mode: z.enum(["aerien", "maritime", "express", "routier"]).optional(),
  transporteur: z.string().max(120).optional(),
  transitaire: z.string().max(120).optional(),
  trackingNo: z.string().max(120).optional(),
  pointEntree: z.string().max(80).optional(),
  entrepotId: z.string().nullable().optional(),
  poidsKg: z.number().positive().max(1e6).optional(),
  cout: z.number().nonnegative().max(1e12).optional(),
  dateExpedition: date.optional(),
  arriveeEstimee: date.optional(),
  notes: z.string().max(2000).optional(),
};
const schemaCreation = z.object({
  ...champs,
  commandeFournisseurId: z.string().optional(),
  produitSourceId: z.string().optional(),
  quantite: z.number().int().positive().max(1e7).optional(),
  paysOrigine: z.string().length(2).default("CN"),
});
const schemaMaj = z.object({ ...champs, id: z.string(), statut: z.enum([...STATUTS_EXPEDITION, "annulee"]).optional(), note: z.string().max(500).optional() });

// GET ?statut=…
import { avancerCommandeFournisseur } from "@/lib/sourcing/fournisseurs/service";
export async function GET(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const statut = new URL(req.url).searchParams.get("statut");
  const expeditions = await prisma.expedition.findMany({
    where: { tenantId: acces.tenantId, ...(statut ? { statut } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  // Pas de relations Prisma sur Expedition : libellés chargés à part, toujours filtrés par boutique.
  const ids = <K extends "commandeId" | "produitSourceId" | "entrepotId">(k: K) => [...new Set(expeditions.map((e) => e[k]).filter((v): v is string => !!v))];
  const [commandes, sources, entrepots] = await Promise.all([
    prisma.commande.findMany({ where: { tenantId: acces.tenantId, id: { in: ids("commandeId") } }, select: { id: true, numero: true, clientNom: true } }),
    prisma.produitSource.findMany({ where: { tenantId: acces.tenantId, id: { in: ids("produitSourceId") } }, select: { id: true, nom: true, produitId: true } }),
    prisma.entrepot.findMany({ where: { tenantId: acces.tenantId }, select: { id: true, nom: true, ville: true } }),
  ]);
  return NextResponse.json({
    expeditions: expeditions.map((e) => ({
      ...e,
      commande: commandes.find((c) => c.id === e.commandeId) ?? null,
      produit: sources.find((s) => s.id === e.produitSourceId) ?? null,
      entrepot: entrepots.find((x) => x.id === e.entrepotId) ?? null,
    })),
    entrepots,
  });
}

export async function POST(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  try {
    const body = schemaCreation.parse(await req.json());
    const ctx = await contexteCalcul(acces.tenantId);

    // Tout id reçu doit appartenir à la boutique.
    const [cf, source, entrepot] = await Promise.all([
      body.commandeFournisseurId ? prisma.commandeFournisseur.findFirst({ where: { id: body.commandeFournisseurId, tenantId: acces.tenantId }, select: { id: true, commandeId: true } }) : null,
      body.produitSourceId ? prisma.produitSource.findFirst({ where: { id: body.produitSourceId, tenantId: acces.tenantId }, select: { id: true } }) : null,
      body.entrepotId ? prisma.entrepot.findFirst({ where: { id: body.entrepotId, tenantId: acces.tenantId }, select: { id: true } }) : null,
    ]);
    if (body.commandeFournisseurId && !cf) return erreur("Commande fournisseur introuvable", 404);
    if (body.produitSourceId && !source) return erreur("Produit introuvable", 404);
    if (body.entrepotId && !entrepot) return erreur("Entrepôt introuvable", 404);
    if (!cf && !source) return erreur("Rattachez l'expédition à une commande fournisseur ou à un produit à réapprovisionner.");
    // Une seule expédition active par commande fournisseur (deux clics = une expédition).
    if (cf) {
      const deja = await prisma.expedition.findFirst({ where: { tenantId: acces.tenantId, commandeFournisseurId: cf.id, statut: { not: "annulee" } }, select: { id: true } });
      if (deja) return NextResponse.json({ id: deja.id });
    }

    const statut = body.trackingNo || body.dateExpedition ? "expediee" : "en_preparation";
    const e = await prisma.expedition.create({
      data: {
        ...body, tenantId: acces.tenantId, commandeId: cf?.commandeId, statut,
        paysDestination: ctx.pays, devise: ctx.devise,
        pointEntree: body.pointEntree ?? ctx.reglages.pointEntree ?? configPays(ctx.pays).pointEntree,
        evenements: [{ statut, date: new Date().toISOString() }],
      },
    });
    if (cf && statut === "expediee") await synchroniserCommandeFournisseur(acces.tenantId, cf.id, body.trackingNo);
    await journaliser(acces, "expedition_creee", `Expedition:${e.id}`, { statut, commandeFournisseurId: cf?.id, produitSourceId: source?.id });
    return NextResponse.json({ id: e.id }, { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}

/**
 * Le colis est parti : la commande fournisseur passe à « expédié » et la commande
 * client reçoit le numéro de suivi. Écriture directe, volontairement SANS passer
 * la commande client à « expédiée » : ce statut annonce au client la livraison
 * locale (WhatsApp + code de remise), ce qui serait faux pendant le transit international.
 */
async function synchroniserCommandeFournisseur(tenantId: string, id: string, trackingNo?: string | null) {
  // Déjà expédiée (simple mise à jour du suivi) : la transition est refusée, seul le numéro change.
  await avancerCommandeFournisseur(tenantId, id, "expedie");
  if (!trackingNo) return;
  const cf = await prisma.commandeFournisseur.update({ where: { id }, data: { trackingNo } });
  await prisma.commande.update({ where: { id: cf.commandeId }, data: { numeroSuivi: trackingNo } });
}

export async function PATCH(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  try {
    const { id, statut, note, ...maj } = schemaMaj.parse(await req.json());
    const e = await prisma.expedition.findFirst({ where: { id, tenantId: acces.tenantId } });
    if (!e) return erreur("Expédition introuvable", 404);
    if (statut && statut !== e.statut && !transitionExpeditionValide(e.statut, statut)) return erreur("Cette expédition ne peut pas revenir en arrière.", 409);
    if (maj.entrepotId && !(await prisma.entrepot.findFirst({ where: { id: maj.entrepotId, tenantId: acces.tenantId }, select: { id: true } }))) return erreur("Entrepôt introuvable", 404);

    const change = statut && statut !== e.statut ? statut : null;
    let stockEntre = 0;
    let aRepartir = false;
    await prisma.$transaction(async (tx) => {
      await tx.expedition.update({
        where: { id },
        data: {
          ...maj,
          ...(change && {
            statut: change,
            evenements: [...((e.evenements as object[]) ?? []), { statut: change, date: new Date().toISOString(), ...(note ? { note } : {}) }],
            ...(change === "expediee" && !e.dateExpedition && !maj.dateExpedition && { dateExpedition: new Date() }),
            ...(change === "entrepot_local" && { arriveeReelle: new Date() }),
          }),
        },
      });

      // Arrivée d'un réapprovisionnement : entrée en stock du produit de la boutique,
      // une seule fois (stockRecu), tracée comme tout mouvement de stock.
      if (change === "entrepot_local" && e.produitSourceId && e.quantite) {
        const source = await tx.produitSource.findFirst({ where: { id: e.produitSourceId, tenantId: acces.tenantId }, select: { produitId: true } });
        const produit = source?.produitId ? await tx.produit.findFirst({ where: { id: source.produitId, tenantId: acces.tenantId, type: "physique" }, select: { id: true, stock: true } }) : null;
        const pris = produit ? await tx.expedition.updateMany({ where: { id, stockRecu: false }, data: { stockRecu: true } }) : null;
        if (produit && pris?.count) {
          await tx.produit.update({ where: { id: produit.id }, data: { stock: { increment: e.quantite } } });
          await tx.stockMouvement.create({
            data: { tenantId: acces.tenantId, produitId: produit.id, type: "entree", quantite: e.quantite, stockAvant: produit.stock, stockApres: produit.stock + e.quantite, motif: `Réception expédition ${e.trackingNo ?? id}`, creePar: acces.userId },
          });
          const entrepotId = maj.entrepotId ?? e.entrepotId;
          if (entrepotId) {
            const ligne = await tx.stockEntrepot.findFirst({ where: { entrepotId, produitId: produit.id, varianteId: null }, select: { id: true } });
            if (ligne) await tx.stockEntrepot.update({ where: { id: ligne.id }, data: { quantite: { increment: e.quantite } } });
            else await tx.stockEntrepot.create({ data: { entrepotId, produitId: produit.id, quantite: e.quantite } });
          }
          stockEntre = e.quantite;
          // Avec des variantes, le stock vendable est le leur (lib/stock.ts) : l'expédition ne dit pas
          // combien d'unités par variante, le marchand doit donc répartir lui-même.
          aRepartir = (await tx.variante.count({ where: { produitId: produit.id, actif: true } })) > 0;
        }
      }
    });

    if (e.commandeFournisseurId && (change === "expediee" || (maj.trackingNo && maj.trackingNo !== e.trackingNo))) {
      await synchroniserCommandeFournisseur(acces.tenantId, e.commandeFournisseurId, maj.trackingNo ?? e.trackingNo);
    }
    if (change) await journaliser(acces, "expedition_statut", `Expedition:${id}`, { de: e.statut, vers: change, stockEntre });
    return NextResponse.json({ ok: true, stockEntre, aRepartir });
  } catch (err) {
    return reponseErreur(err);
  }
}
