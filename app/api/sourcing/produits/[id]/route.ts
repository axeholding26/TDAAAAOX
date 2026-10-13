// Fiche d'un produit sourcé : lecture avec évaluation complète, mise à jour des
// hypothèses (coûts, prix, score, mode, étape), suppression.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { accesSourcing, contexteCalcul, journaliser, erreur, reponseErreur } from "@/lib/sourcing/acces";
import { evaluerProduit, schemaHypotheses, MODES_APPRO, ETAPES_PRODUIT } from "@/lib/sourcing/produit-source";
import { schemaProduitSource, connecteur } from "@/lib/sourcing/connecteurs";
import { CRITERES_ESTIMES } from "@/lib/sourcing/score";
import { budgetTest, AVERTISSEMENT_IA } from "@/lib/sourcing/ia";
import { prixClient } from "@/lib/pricing";

type Ctx = { params: Promise<{ id: string }> };

const montant = z.number().nonnegative().max(1e12).optional();
const part = z.number().min(0).max(0.95).optional();

const schemaMaj = z.object({
  fiche: schemaProduitSource.partial().optional(),
  favori: z.boolean().optional(),
  /** Fournisseur de la boutique chargé de ce produit (ses commandes lui sont routées). */
  fournisseurId: z.string().nullable().optional(),
  etape: z.enum(ETAPES_PRODUIT.map((e) => e.cle) as [string, ...string[]]).optional(),
  modeAppro: z.enum(MODES_APPRO.map((m) => m.cle) as [string, ...string[]]).optional(),
  parametresCout: schemaHypotheses.optional(),
  tarification: z.object({
    mode: z.enum(["marge_fixe", "marge_pct", "psychologique", "auto"]).optional(),
    margeFixe: montant, margePct: part, prixVente: montant,
  }).strict().optional(),
  criteresScore: z.partialRecord(z.enum(CRITERES_ESTIMES.map((c) => c.cle) as [string, ...string[]]), z.number().int().min(1).max(5)).optional(),
});

async function reponse(tenantId: string, id: string) {
  const source = await prisma.produitSource.findFirst({ where: { id, tenantId } });
  if (!source) return erreur("Produit introuvable", 404);
  const [contexte, produit] = await Promise.all([
    contexteCalcul(tenantId),
    source.produitId ? prisma.produit.findFirst({ where: { id: source.produitId, tenantId }, select: { id: true, slug: true, prix: true, type: true, stock: true, actif: true, ventes: true } }) : null,
  ]);
  const evaluation = evaluerProduit(source, contexte);
  // Prix payé en ligne par le client (commission Axso ajoutée) ; null si ce produit se paie à la livraison.
  const taux = (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { commissionRate: true } }))?.commissionRate ?? 0.1;
  const enLigne = evaluation.cout.prixVente ? prixClient(evaluation.cout.prixVente, taux, MODES_APPRO.find((m) => m.cle === source.modeAppro)?.typeProduit ?? "dropshipping") : null;
  return NextResponse.json({
    source, contexte, evaluation, produit,
    prixEnLigne: enLigne && enLigne !== evaluation.cout.prixVente ? enLigne : null,
    budgetTest: budgetTest(evaluation),
    avertissementIA: AVERTISSEMENT_IA,
    connecteur: { id: source.connecteur, nom: connecteur(source.connecteur).nom, statut: connecteur(source.connecteur).statut },
  });
}

export async function GET(_req: Request, { params }: Ctx) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  return reponse(acces.tenantId, (await params).id);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const { id } = await params;
  try {
    const brut = await req.json();
    const body = schemaMaj.parse(brut);
    // zod 4 applique les valeurs par défaut même sur un schéma partiel : on ne garde que
    // les champs réellement envoyés, sinon modifier le nom remettrait images, devise et MOQ à zéro.
    const fiche = Object.fromEntries(Object.entries(body.fiche ?? {}).filter(([cle]) => cle in (brut?.fiche ?? {})));
    const source = await prisma.produitSource.findFirst({ where: { id, tenantId: acces.tenantId } });
    if (!source) return erreur("Produit introuvable", 404);

    let fournisseur: { id: string; nom: string } | null = null;
    if (body.fournisseurId) {
      fournisseur = await prisma.fournisseur.findFirst({ where: { id: body.fournisseurId, tenantId: acces.tenantId }, select: { id: true, nom: true } });
      if (!fournisseur) return erreur("Fournisseur introuvable", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.produitSource.update({
        where: { id },
        data: {
          ...fiche,
          ...(body.fournisseurId !== undefined && { fournisseurId: fournisseur?.id ?? null, ...(fournisseur && { fournisseurNom: fournisseur.nom }) }),
          ...(body.favori !== undefined && { favori: body.favori }),
          ...(body.etape && { etape: body.etape }),
          ...(body.modeAppro && { modeAppro: body.modeAppro }),
          ...(body.parametresCout && { parametresCout: body.parametresCout }),
          ...(body.tarification && { tarification: body.tarification }),
          // Fusion : une note envoyée seule ne doit pas effacer les autres estimations déjà saisies.
          ...(body.criteresScore && { criteresScore: { ...(source.criteresScore as Record<string, number> | null), ...body.criteresScore } }),
        },
      });
      if (body.fournisseurId !== undefined && source.produitId) {
        await tx.produit.updateMany({ where: { id: source.produitId, tenantId: acces.tenantId }, data: { fournisseurId: fournisseur?.id ?? null, ...(fournisseur && { nomFournisseur: fournisseur.nom }) } });
      }
      // Changement de mode d'un produit déjà en boutique : son type suit. Passer au
      // stock local active le stock strict (lib/stock.ts) — il repart de 0 jusqu'à
      // la réception de la marchandise, pour ne jamais vendre un stock inexistant.
      if (body.modeAppro && body.modeAppro !== source.modeAppro && source.produitId) {
        const versDropshipping = body.modeAppro === "dropshipping";
        const etaitDropshipping = source.modeAppro === "dropshipping";
        if (versDropshipping !== etaitDropshipping) {
          await tx.produit.updateMany({
            where: { id: source.produitId, tenantId: acces.tenantId },
            data: versDropshipping ? { type: "dropshipping" } : { type: "physique", stock: 0 },
          });
          // Avec des variantes, le stock vendable est le leur (lib/stock.ts) : il repart de 0 lui aussi.
          if (!versDropshipping) await tx.variante.updateMany({ where: { produitId: source.produitId, produit: { tenantId: acces.tenantId } }, data: { stock: 0 } });
        }
      }
    });

    const cles = Object.keys(body);
    if (cles.some((c) => ["etape", "modeAppro", "tarification"].includes(c))) {
      await journaliser(acces, "produit_modifie", `ProduitSource:${id}`, { etape: body.etape, modeAppro: body.modeAppro, tarification: body.tarification });
    }
    return reponse(acces.tenantId, id);
  } catch (e) {
    return reponseErreur(e);
  }
}

// Supprime la fiche sourcing seulement : le produit publié en boutique, lui, reste.
export async function DELETE(_req: Request, { params }: Ctx) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const { id } = await params;
  const r = await prisma.produitSource.deleteMany({ where: { id, tenantId: acces.tenantId } });
  if (!r.count) return erreur("Produit introuvable", 404);
  await journaliser(acces, "produit_supprime", `ProduitSource:${id}`);
  return NextResponse.json({ ok: true });
}
