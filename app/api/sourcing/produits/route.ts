// Catalogue sourcing : produits repérés chez des fournisseurs (ProduitSource),
// avec leur évaluation (coût réel, prix conseillé, score) calculée à la lecture.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { accesSourcing, contexteCalcul, journaliser, erreur, reponseErreur } from "@/lib/sourcing/acces";
import { connecteur } from "@/lib/sourcing/connecteurs";
import { evaluerProduit, ETAPES_GAGNANTES } from "@/lib/sourcing/produit-source";

// GET ?vue=tous|favoris|test|gagnants&q=…
export async function GET(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const { searchParams } = new URL(req.url);
  const vue = searchParams.get("vue") ?? "tous";
  const q = searchParams.get("q")?.trim();

  const [sources, contexte, aAnalyser] = await Promise.all([
    prisma.produitSource.findMany({
      where: {
        tenantId: acces.tenantId,
        ...(vue === "favoris" ? { favori: true } : vue === "test" ? { etape: "test" } : vue === "gagnants" ? { etape: { in: ETAPES_GAGNANTES } } : {}),
        ...(q ? { nom: { contains: q, mode: "insensitive" as const } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    contexteCalcul(acces.tenantId),
    // Produits de la boutique achetés chez un fournisseur mais jamais analysés : proposés à l'analyse.
    prisma.produit.findMany({
      where: { tenantId: acces.tenantId, actif: true, prixFournisseur: { not: null }, type: { in: ["dropshipping", "physique"] } },
      select: { id: true, nom: true, images: true, prix: true, prixFournisseur: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const lies = new Set((await prisma.produitSource.findMany({ where: { tenantId: acces.tenantId, produitId: { not: null } }, select: { produitId: true } })).map((s) => s.produitId));

  return NextResponse.json({
    produits: sources.map((s) => {
      const ev = evaluerProduit(s, contexte);
      return {
        id: s.id, nom: s.nom, image: s.images[0] ?? null, connecteur: s.connecteur, fournisseurNom: s.fournisseurNom,
        favori: s.favori, etape: s.etape, modeAppro: s.modeAppro, produitId: s.produitId,
        coutTotal: ev.cout.coutTotal, prixVente: ev.cout.prixVente, prixConseille: ev.conseil.prix, margeNette: ev.cout.margeNette,
        tauxMargeNette: ev.cout.tauxMargeNette, score: ev.score.total, confianceScore: ev.score.confiance, niveau: ev.score.niveau, verdict: ev.score.verdict,
        // Estimations du marchand (1 à 5, 5 = favorable) — null tant qu'il ne les a pas saisies.
        concurrence: (s.criteresScore as Record<string, number>)?.concurrence ?? null,
        logistique: (s.criteresScore as Record<string, number>)?.livraison ?? null,
      };
    }),
    aAnalyser: aAnalyser.filter((p) => !lies.has(p.id)).map((p) => ({ ...p, image: p.images[0] ?? null, images: undefined })),
    devise: contexte.devise,
    pays: contexte.pays,
  });
}

const schemaCreation = z.object({
  connecteur: z.string().max(40).default("manuel"),
  url: z.string().url().max(2000).optional(),
  donnees: z.unknown().optional(),
  /** Analyser un produit déjà en boutique : la fiche source est créée à partir de lui. */
  produitId: z.string().optional(),
});

// POST — importer un produit dans le catalogue sourcing (pas encore dans la boutique).
export async function POST(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  try {
    const body = schemaCreation.parse(await req.json());

    if (body.produitId) {
      const p = await prisma.produit.findFirst({ where: { id: body.produitId, tenantId: acces.tenantId }, include: { fournisseur: { select: { nom: true } }, tenant: { select: { devise: true } } } });
      if (!p) return erreur("Produit introuvable", 404);
      const deja = await prisma.produitSource.findFirst({ where: { tenantId: acces.tenantId, produitId: p.id }, select: { id: true } });
      if (deja) return NextResponse.json({ id: deja.id });
      const source = await prisma.produitSource.create({
        data: {
          tenantId: acces.tenantId, connecteur: "manuel", nom: p.nom, description: p.description, images: p.images, videos: p.videos,
          url: p.urlFournisseur, sku: p.sku, poidsKg: p.poids,
          // Le prix fournisseur d'un produit de la boutique est tenu dans la devise de la boutique.
          prixFournisseur: p.prixFournisseur ?? p.cout ?? 0, deviseFournisseur: p.tenant.devise,
          fournisseurNom: p.fournisseur?.nom ?? p.nomFournisseur, fournisseurId: p.fournisseurId,
          modeAppro: p.type === "dropshipping" ? "dropshipping" : "stock_vendeur",
          tarification: { prixVente: p.prix }, etape: p.ventes > 0 ? "test" : "decouverte", produitId: p.id,
        },
      });
      await journaliser(acces, "produit_analyse", `ProduitSource:${source.id}`, { produitId: p.id });
      return NextResponse.json({ id: source.id }, { status: 201 });
    }

    const c = connecteur(body.connecteur);
    const fiche = await c.importer({ url: body.url, donnees: body.donnees });
    const { fournisseurNom, ...reste } = fiche;
    const data = { ...reste, fournisseurNom, tenantId: acces.tenantId, connecteur: c.id };
    // Même produit du même connecteur importé deux fois : la fiche est mise à jour, pas dupliquée.
    // À la mise à jour, seuls les champs réellement envoyés sont écrits : sinon les valeurs par
    // défaut du schéma (MOQ 1, variantes et images vides) effaceraient celles déjà enregistrées.
    const envoyes = { ...(body.donnees as object), ...(body.url ? { url: body.url } : {}) };
    const source = fiche.refExterne
      ? await prisma.produitSource.upsert({
          where: { tenantId_connecteur_refExterne: { tenantId: acces.tenantId, connecteur: c.id, refExterne: fiche.refExterne } },
          create: data, update: Object.fromEntries(Object.entries(reste).filter(([cle]) => cle in envoyes)),
        })
      : await prisma.produitSource.create({ data });
    await journaliser(acces, "produit_importe", `ProduitSource:${source.id}`, { connecteur: c.id, nom: source.nom });
    return NextResponse.json({ id: source.id }, { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}
