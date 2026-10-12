// Comptabilité du magasin : chiffre d'affaires, taxes, remises, retours, coût
// des marchandises vendues, charges d'exploitation, résultat, marge par produit.
// GET /api/pos/comptabilite?debut=&fin= — droit : voir_couts.
//
// CE QUI EST COMPTÉ
// - Ventes de caisse : canal "pos" (caisse 2.0 et ancienne caisse depuis la
//   migration pos_v2), ou le client fictif "pos@local" des ventes antérieures
//   tant que leur canal n'a pas été rattrapé par le SQL de la migration.
//   Les ventes annulées sont exclues.
// - Chiffre d'affaires = ce que les clients ont réellement payé (remises
//   déduites), moins la valeur des articles retournés. Le total de chaque vente
//   est réparti sur ses lignes (ventilerVente) : c'est juste pour une remise par
//   ligne (caisse 2.0) comme pour une remise globale (ancienne caisse).
// - Marge = chiffre d'affaires HORS TAXES − coût des marchandises vendues.
// - Coût : celui figé sur la ligne au moment de la vente (LigneCommande.cout).
//   Ventes d'avant la caisse 2.0 : ce coût n'existe pas, le coût ACTUEL du
//   produit est pris à la place — une APPROXIMATION, signalée dans la réponse
//   (`approximation`), jamais présentée comme exacte.
// - Charges : ChargeExploitation de la période, dépenses de caisse comprises.
import { prisma } from "@/lib/prisma";
import { PAIEMENT } from "@/lib/commandes";
import { routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { decimalesDevise } from "@/lib/pos/tarification";
import { partRetournee, ventilerVente } from "@/lib/pos/caisse/calculs";

const VENTES_CAISSE = { OR: [{ canal: "pos" }, { clientEmail: "pos@local" }] };
const centimes = (n: number) => Math.round(n * 100) / 100;

function lireDate(v: string | null, defaut: Date): Date {
  if (!v) return defaut;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new ErreurPos("invalide", 400, "La période demandée est illisible.");
  return d;
}

export const GET = routePos(async (ctx, req) => {
  exigerDroit(ctx, "voir_couts");
  const { tenantId } = ctx;
  const p = new URL(req.url).searchParams;
  const now = new Date();
  const debut = lireDate(p.get("debut"), new Date(now.getFullYear(), now.getMonth(), 1));
  const fin = lireDate(p.get("fin"), now);

  const [tenant, ventes, charges, ventesCumul, retoursCumul, chargesCumul] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { devise: true } }),
    prisma.commande.findMany({
      where: { tenantId, ...VENTES_CAISSE, statut: { not: "annulee" }, createdAt: { gte: debut, lte: fin } },
      select: { id: true, montantTotal: true, montantReduction: true, lignes: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.chargeExploitation.findMany({ where: { tenantId, dateEnregistrement: { gte: debut, lte: fin } }, select: { categorie: true, montant: true } }),
    prisma.commande.aggregate({ where: { tenantId, ...VENTES_CAISSE, statut: { not: "annulee" }, paiementStatut: PAIEMENT.PAYE }, _sum: { montantTotal: true } }),
    // Retours partiels traités en caisse : la vente reste « payée », seule leur valeur sort des entrées.
    // (Une vente entièrement retournée passe « remboursée » : elle est déjà hors de la somme ci-dessus.)
    prisma.retourRMA.aggregate({ where: { tenantId, traitePar: { not: null }, statut: "accepte", commande: { ...VENTES_CAISSE, statut: { not: "annulee" }, paiementStatut: PAIEMENT.PAYE } }, _sum: { montant: true } }),
    prisma.chargeExploitation.aggregate({ where: { tenantId }, _sum: { montant: true } }),
  ]);
  const dec = decimalesDevise(tenant.devise);

  const produitIds = [...new Set(ventes.flatMap((v) => v.lignes.map((l) => l.produitId)))];
  const produits = produitIds.length
    ? await prisma.produit.findMany({ where: { id: { in: produitIds }, tenantId }, select: { id: true, nom: true, images: true, cout: true } })
    : [];
  const produitMap = new Map(produits.map((x) => [x.id, x]));

  const parProduitMap = new Map<string, { produitId: string; nom: string; image: string | null; quantiteVendue: number; revenu: number; revenuHT: number; cout: number }>();
  let revenu = 0, taxes = 0, cout = 0, retours = 0, remises = 0, nombreVentes = 0;
  let lignesCoutActuel = 0, lignesSansCout = 0;

  for (const vente of ventes) {
    remises += vente.montantReduction;
    let gardee = false;
    for (const l of ventilerVente(vente.montantTotal, vente.lignes, dec)) {
      const rendu = partRetournee(l.total, l.quantite, 0, l.quantiteRetournee, dec);
      const revenuLigne = l.total - rendu;
      const taxeLigne = l.taxe - partRetournee(l.taxe, l.quantite, 0, l.quantiteRetournee, dec);
      retours += rendu;
      if (l.restant <= 0) continue;
      gardee = true;

      // Coût figé à la vente ; sinon coût actuel du produit (au kilo pour un produit au poids, la ligne étant en grammes).
      const produit = produitMap.get(l.produitId);
      let coutUnitaire = l.cout;
      if (coutUnitaire === null) {
        if (produit?.cout !== null && produit?.cout !== undefined) { coutUnitaire = l.mesure !== null ? produit.cout / 1000 : produit.cout; lignesCoutActuel++; }
        else { coutUnitaire = 0; lignesSansCout++; }
      }
      const coutLigne = coutUnitaire * l.restant;
      revenu += revenuLigne; taxes += taxeLigne; cout += coutLigne;

      const existant = parProduitMap.get(l.produitId) ?? {
        produitId: l.produitId, nom: produit?.nom ?? l.nom, image: produit?.images?.[0] ?? l.imageUrl ?? null,
        quantiteVendue: 0, revenu: 0, revenuHT: 0, cout: 0,
      };
      // Une ligne au poids compte pour une vente, pas pour ses grammes.
      existant.quantiteVendue += l.mesure !== null ? 1 : l.restant;
      existant.revenu += revenuLigne; existant.revenuHT += revenuLigne - taxeLigne; existant.cout += coutLigne;
      parProduitMap.set(l.produitId, existant);
    }
    if (gardee) nombreVentes++;
  }

  const revenuHT = revenu - taxes;
  const chargesTotal = charges.reduce((s, c) => s + c.montant, 0);
  const parCategorieCharge: Record<string, number> = {};
  for (const c of charges) parCategorieCharge[c.categorie] = centimes((parCategorieCharge[c.categorie] || 0) + c.montant);

  // Bénéfice net par produit = marge brute − quote-part des charges d'exploitation,
  // répartie au prorata du revenu de chaque produit (une charge fixe comme le loyer
  // n'appartient à aucun produit : l'allocation proportionnelle est la convention usuelle).
  const parProduit = [...parProduitMap.values()]
    .map((x) => {
      const beneficeBrut = x.revenuHT - x.cout;
      const quotePartCharges = revenuHT > 0 ? chargesTotal * (x.revenuHT / revenuHT) : 0;
      const beneficeNet = beneficeBrut - quotePartCharges;
      const pct = (n: number) => (x.revenuHT > 0 ? Math.round((n / x.revenuHT) * 1000) / 10 : 0);
      return {
        produitId: x.produitId, nom: x.nom, image: x.image, quantiteVendue: x.quantiteVendue,
        revenu: centimes(x.revenu), revenuHT: centimes(x.revenuHT), cout: centimes(x.cout),
        beneficeBrut: centimes(beneficeBrut), beneficeBrutPct: pct(beneficeBrut),
        quotePartCharges: centimes(quotePartCharges),
        beneficeNet: centimes(beneficeNet), beneficeNetPct: pct(beneficeNet),
        // alias d'avant la caisse 2.0 — mêmes valeurs que beneficeBrut
        marge: centimes(beneficeBrut), margePct: pct(beneficeBrut),
      };
    })
    .sort((a, b) => b.beneficeNet - a.beneficeNet);

  const entreesTotales = (ventesCumul._sum.montantTotal ?? 0) - (retoursCumul._sum.montant ?? 0);
  const chargesTotalesCumul = chargesCumul._sum.montant ?? 0;
  const beneficeBrut = revenuHT - cout;

  return {
    periode: { debut: debut.toISOString(), fin: fin.toISOString() },
    devise: tenant.devise,
    resume: {
      /** Chiffre d'affaires TTC, remises et retours déduits. */
      revenu: centimes(revenu),
      revenuHT: centimes(revenuHT),
      taxes: centimes(taxes),
      /** Remises accordées sur les ventes de la période (déjà déduites du revenu). */
      remises: centimes(remises),
      /** Valeur des articles retournés sur les ventes de la période (déjà déduite du revenu). */
      retours: centimes(retours),
      coutMarchandises: centimes(cout),
      // Bénéfice brut = revenu hors taxes − coût des marchandises vendues (avant charges fixes)
      beneficeBrut: centimes(beneficeBrut),
      chargesExploitation: centimes(chargesTotal),
      // Bénéfice net = bénéfice brut − charges d'exploitation
      beneficeNet: centimes(beneficeBrut - chargesTotal),
      nombreVentes,
      // alias d'avant la caisse 2.0
      margeCommerciale: centimes(beneficeBrut),
      resultatNet: centimes(beneficeBrut - chargesTotal),
    },
    /** Lignes dont le coût n'est pas celui du jour de la vente : la marge affichée est alors approchée. */
    approximation: { lignesCoutActuel, lignesSansCout },
    parProduit,
    parCategorieCharge,
    fondsGeneraux: {
      entreesTotales: centimes(entreesTotales),
      chargesTotales: centimes(chargesTotalesCumul),
      soldeNet: centimes(entreesTotales - chargesTotalesCumul),
    },
  };
});
