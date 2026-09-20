import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Marqueur des commandes créées par la caisse POS (voir /api/commandes/pos-creer)
const POS_CLIENT_EMAIL = "pos@local";

// GET — rapport de rentabilité de la boutique physique : chiffre d'affaires,
// coût des marchandises vendues, charges d'exploitation, résultat net,
// détail de marge par produit, et fonds généraux cumulés (tout historique).
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { searchParams } = new URL(req.url);

    const now = new Date();
    const debutParam = searchParams.get("debut");
    const finParam = searchParams.get("fin");
    const debut = debutParam ? new Date(debutParam) : new Date(now.getFullYear(), now.getMonth(), 1);
    const fin = finParam ? new Date(finParam) : now;

    const [ventes, charges, ventesCumulTotal, chargesCumulTotal] = await Promise.all([
      prisma.commande.findMany({
        where: { tenantId, clientEmail: POS_CLIENT_EMAIL, createdAt: { gte: debut, lte: fin } },
        include: { lignes: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.chargeExploitation.findMany({
        where: { tenantId, dateEnregistrement: { gte: debut, lte: fin } },
      }),
      prisma.commande.aggregate({
        where: { tenantId, clientEmail: POS_CLIENT_EMAIL },
        _sum: { montantTotal: true },
      }),
      prisma.chargeExploitation.aggregate({
        where: { tenantId },
        _sum: { montant: true },
      }),
    ]);

    const produitIds = [...new Set(ventes.flatMap(v => v.lignes.map(l => l.produitId)))];
    const produits = produitIds.length
      ? await prisma.produit.findMany({ where: { id: { in: produitIds } }, select: { id: true, nom: true, images: true, cout: true } })
      : [];
    const produitMap = new Map(produits.map(p => [p.id, p]));

    const parProduitMap = new Map<string, { produitId: string; nom: string; image: string | null; quantiteVendue: number; revenu: number; cout: number }>();
    let revenuTotal = 0;
    let coutTotal = 0;

    for (const vente of ventes) {
      for (const ligne of vente.lignes) {
        const revenuLigne = ligne.prix * ligne.quantite;
        const produit = produitMap.get(ligne.produitId);
        const coutUnitaire = produit?.cout ?? 0;
        const coutLigne = coutUnitaire * ligne.quantite;

        revenuTotal += revenuLigne;
        coutTotal += coutLigne;

        const existant = parProduitMap.get(ligne.produitId);
        if (existant) {
          existant.quantiteVendue += ligne.quantite;
          existant.revenu += revenuLigne;
          existant.cout += coutLigne;
        } else {
          parProduitMap.set(ligne.produitId, {
            produitId: ligne.produitId,
            nom: produit?.nom ?? ligne.nom,
            image: produit?.images?.[0] ?? ligne.imageUrl ?? null,
            quantiteVendue: ligne.quantite,
            revenu: revenuLigne,
            cout: coutLigne,
          });
        }
      }
    }

    const chargesTotal = charges.reduce((s, c) => s + c.montant, 0);
    const parCategorieCharge: Record<string, number> = {};
    for (const c of charges) parCategorieCharge[c.categorie] = Math.round(((parCategorieCharge[c.categorie] || 0) + c.montant) * 100) / 100;

    // Bénéfice net par produit = marge brute − quote-part des charges
    // d'exploitation, répartie au prorata du revenu de chaque produit (une
    // charge fixe comme le loyer ne "appartient" à aucun produit en
    // particulier — l'allocation proportionnelle est la convention standard
    // pour donner un résultat net exploitable produit par produit).
    const parProduit = [...parProduitMap.values()]
      .map(p => {
        const beneficeBrut = p.revenu - p.cout;
        const quotePartCharges = revenuTotal > 0 ? chargesTotal * (p.revenu / revenuTotal) : 0;
        const beneficeNet = beneficeBrut - quotePartCharges;
        return {
          ...p,
          revenu: Math.round(p.revenu * 100) / 100,
          cout: Math.round(p.cout * 100) / 100,
          beneficeBrut: Math.round(beneficeBrut * 100) / 100,
          beneficeBrutPct: p.revenu > 0 ? Math.round((beneficeBrut / p.revenu) * 1000) / 10 : 0,
          quotePartCharges: Math.round(quotePartCharges * 100) / 100,
          beneficeNet: Math.round(beneficeNet * 100) / 100,
          beneficeNetPct: p.revenu > 0 ? Math.round((beneficeNet / p.revenu) * 1000) / 10 : 0,
          // alias legacy pour compatibilité — même valeur que beneficeBrut
          marge: Math.round(beneficeBrut * 100) / 100,
          margePct: p.revenu > 0 ? Math.round((beneficeBrut / p.revenu) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.beneficeNet - a.beneficeNet);

    const entreesTotales = ventesCumulTotal._sum.montantTotal ?? 0;
    const chargesTotalesCumul = chargesCumulTotal._sum.montant ?? 0;

    return NextResponse.json({
      periode: { debut: debut.toISOString(), fin: fin.toISOString() },
      resume: {
        revenu: Math.round(revenuTotal * 100) / 100,
        coutMarchandises: Math.round(coutTotal * 100) / 100,
        // Bénéfice brut = revenu − coût des marchandises vendues (avant charges fixes)
        beneficeBrut: Math.round((revenuTotal - coutTotal) * 100) / 100,
        chargesExploitation: Math.round(chargesTotal * 100) / 100,
        // Bénéfice net = bénéfice brut − charges d'exploitation (résultat réel)
        beneficeNet: Math.round((revenuTotal - coutTotal - chargesTotal) * 100) / 100,
        nombreVentes: ventes.length,
        // alias legacy pour compatibilité
        margeCommerciale: Math.round((revenuTotal - coutTotal) * 100) / 100,
        resultatNet: Math.round((revenuTotal - coutTotal - chargesTotal) * 100) / 100,
      },
      parProduit,
      parCategorieCharge,
      fondsGeneraux: {
        entreesTotales: Math.round(entreesTotales * 100) / 100,
        chargesTotales: Math.round(chargesTotalesCumul * 100) / 100,
        soldeNet: Math.round((entreesTotales - chargesTotalesCumul) * 100) / 100,
      },
    });
  } catch (err) {
    console.error("[pos/comptabilite GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
