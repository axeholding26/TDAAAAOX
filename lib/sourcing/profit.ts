// Tableau de bord profit — calculé sur les VRAIES commandes de la boutique.
// SERVEUR uniquement.
//
// Règle : ne jamais confondre chiffre d'affaires et bénéfice.
//   CA − coût produit − transport − taxes − livraison − publicité − paiements
//      − retours = BÉNÉFICE NET ESTIMÉ
//
// « Estimé » parce que trois postes ne sont pas mesurés :
// - la publicité est la dépense cumulée des campagnes, répartie au prorata des
//   jours de la période (pas d'historique journalier) ;
// - le coût d'un produit vient de sa fiche sourcing (coût rendu) ou, à défaut,
//   de son coût / prix fournisseur ; un produit sans coût compte pour 0 et est
//   signalé (`lignesSansCout`) ;
// - le coût de livraison est supposé égal aux frais facturés au client, y
//   compris pour les commandes refusées (livraison perdue).
import { prisma } from "../prisma";
import { PAIEMENT } from "../commandes";
import { contexteCalcul } from "./acces";
import { evaluerProduit, ETAPES_GAGNANTES } from "./produit-source";

const JOUR = 86400_000;
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export async function tableauDeBord(tenantId: string, jours = 30) {
  const depuis = new Date(Date.now() - jours * JOUR);
  const ctx = await contexteCalcul(tenantId);

  const [commandes, sources, campagnes, commissions, retours, vues, cfs] = await Promise.all([
    prisma.commande.findMany({
      where: { tenantId, createdAt: { gte: depuis } },
      select: {
        id: true, statut: true, paiementStatut: true, methodePaiement: true, montantTotal: true, montantLivraison: true,
        createdAt: true, expedieeAt: true, livreeAt: true,
        lignes: { select: { produitId: true, nom: true, prix: true, quantite: true, produit: { select: { cout: true, prixFournisseur: true } } } },
      },
    }),
    prisma.produitSource.findMany({ where: { tenantId } }),
    // Campagne n'a pas d'historique journalier, seulement une dépense cumulée : elle est répartie plus bas au prorata des jours de la période.
    prisma.campagne.findMany({ where: { tenantId, depense: { gt: 0 } }, select: { depense: true, statut: true, dateDebut: true, dateFin: true, createdAt: true, updatedAt: true } }),
    prisma.commission.aggregate({ where: { tenantId, createdAt: { gte: depuis }, commande: { paiementStatut: PAIEMENT.PAYE } }, _sum: { montantCommission: true } }),
    prisma.retourRMA.findMany({ where: { tenantId, createdAt: { gte: depuis }, statut: { in: ["accepte", "clos"] } }, select: { montant: true, commande: { select: { paiementStatut: true } } } }),
    prisma.analytics.count({ where: { tenantId, type: "page_view", date: { gte: depuis } } }),
    prisma.commandeFournisseur.findMany({ where: { tenantId, createdAt: { gte: depuis }, statut: { in: ["expedie", "livre"] } }, select: { createdAt: true, updatedAt: true } }),
  ]);

  // Coût unitaire par produit de la boutique : fiche sourcing liée, sinon coût saisi sur le produit.
  const coutSource = new Map<string, { produit: number; transport: number; taxes: number }>();
  for (const s of sources) {
    if (!s.produitId) continue;
    const l = Object.fromEntries(evaluerProduit(s, ctx).cout.lignes.map((x) => [x.cle, x.montant]));
    coutSource.set(s.produitId, { produit: l.produit, transport: l.transport + l.assurance, taxes: l.droits + l.transitaire + l.dedouanement });
  }

  const payees = commandes.filter((c) => c.paiementStatut === PAIEMENT.PAYE);
  const livrees = commandes.filter((c) => c.statut === "livree");
  const refusees = commandes.filter((c) => c.statut === "annulee" && c.expedieeAt);
  const actives = commandes.filter((c) => c.statut !== "annulee");

  const postes = { produit: 0, transport: 0, taxes: 0, livraison: 0, publicite: 0, paiements: 0, retours: 0 };
  let lignesSansCout = 0;
  const parProduit = new Map<string, { produitId: string; nom: string; quantite: number; ca: number; cout: number }>();
  const parJour = new Map<string, { date: string; ca: number; couts: number; commandes: number }>();
  for (let i = jours - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * JOUR).toISOString().slice(0, 10);
    parJour.set(date, { date, ca: 0, couts: 0, commandes: 0 });
  }

  for (const c of commandes) {
    const jour = parJour.get(c.createdAt.toISOString().slice(0, 10));
    if (jour && c.statut !== "annulee") jour.commandes++;
    if (c.paiementStatut !== PAIEMENT.PAYE) continue;
    let coutCommande = c.montantLivraison;
    postes.livraison += c.montantLivraison;
    for (const l of c.lignes) {
      const s = coutSource.get(l.produitId);
      const u = s ?? { produit: l.produit.cout ?? l.produit.prixFournisseur ?? 0, transport: 0, taxes: 0 };
      if (!s && l.produit.cout == null && l.produit.prixFournisseur == null) lignesSansCout++;
      postes.produit += u.produit * l.quantite;
      postes.transport += u.transport * l.quantite;
      postes.taxes += u.taxes * l.quantite;
      const coutLigne = (u.produit + u.transport + u.taxes) * l.quantite;
      coutCommande += coutLigne;
      const p = parProduit.get(l.produitId) ?? { produitId: l.produitId, nom: l.nom, quantite: 0, ca: 0, cout: 0 };
      p.quantite += l.quantite; p.ca += l.prix * l.quantite; p.cout += coutLigne;
      parProduit.set(l.produitId, p);
    }
    if (jour) { jour.ca += c.montantTotal; jour.couts += coutCommande; }
  }
  postes.livraison += refusees.reduce((s, c) => s + c.montantLivraison, 0);
  // Part de la dépense cumulée de chaque campagne tombant dans la période (dépense supposée régulière sur sa durée).
  const maintenant = Date.now();
  postes.publicite = Math.round(campagnes.reduce((s, c) => {
    const debut = (c.dateDebut ?? c.createdAt).getTime();
    const fin = Math.min(maintenant, c.statut === "active" ? maintenant : (c.dateFin ?? c.updatedAt).getTime());
    const dansPeriode = Math.max(0, fin - Math.max(debut, depuis.getTime()));
    return s + c.depense * Math.min(1, dansPeriode / Math.max(fin - debut, JOUR));
  }, 0));
  postes.paiements = commissions._sum.montantCommission ?? 0;
  // Une commande remboursée est déjà sortie du CA (paiementStatut) : la compter ici la déduirait deux fois.
  // Reste ce qui est rendu sur une vente toujours comptée (avoir, retour partiel).
  postes.retours = retours.reduce((s, r) => s + (r.commande.paiementStatut === PAIEMENT.PAYE ? r.montant ?? 0 : 0), 0);

  const ca = payees.reduce((s, c) => s + c.montantTotal, 0);
  const gmv = actives.reduce((s, c) => s + c.montantTotal, 0);
  const totalCouts = Object.values(postes).reduce((s, n) => s + n, 0);
  const benefice = ca - totalCouts;
  const finalisees = livrees.length + refusees.length;
  const moyenneJours = (dates: { debut: Date; fin: Date | null }[]) => {
    const d = dates.filter((x) => x.fin).map((x) => (x.fin!.getTime() - x.debut.getTime()) / JOUR);
    return d.length ? Math.round((d.reduce((s, n) => s + n, 0) / d.length) * 10) / 10 : null;
  };
  const testes = sources.filter((s) => s.etape !== "decouverte");

  return {
    jours, devise: ctx.devise,
    kpi: {
      gmv, ca, benefice,
      commandes: actives.length,
      panierMoyen: ratio(ca, payees.length),
      coutPublicitaire: postes.publicite,
      roas: ratio(ca, postes.publicite),
      // Sans dépense publicitaire déclarée, le coût d'acquisition n'est pas « 0 » : il est inconnu.
      cac: postes.publicite > 0 ? ratio(postes.publicite, payees.length) : null,
      margeBrute: ratio(ca - postes.produit - postes.transport - postes.taxes, ca),
      margeNette: ratio(benefice, ca),
      tauxLivraison: ratio(livrees.length, finalisees),
      tauxRefus: ratio(refusees.length, finalisees),
      tauxRetour: ratio(retours.length, livrees.length),
      tauxConversion: ratio(actives.length, vues),
      delaiFournisseurJours: moyenneJours(cfs.map((c) => ({ debut: c.createdAt, fin: c.updatedAt }))),
      delaiLivraisonJours: moyenneJours(livrees.map((c) => ({ debut: c.createdAt, fin: c.livreeAt }))),
      tauxSuccesProduits: ratio(testes.filter((s) => (ETAPES_GAGNANTES as string[]).includes(s.etape)).length, testes.length),
    },
    /** Du CA au bénéfice, poste par poste. */
    postes,
    lignesSansCout,
    refus: { livrees: livrees.length, refusees: refusees.length },
    serie: [...parJour.values()].map((j) => ({ ...j, marge: j.ca - j.couts })),
    /** Produits les plus rentables de la période (ventes réelles, avant publicité). */
    topProduits: [...parProduit.values()].map((p) => ({ ...p, benefice: p.ca - p.cout })).sort((a, b) => b.benefice - a.benefice).slice(0, 8),
  };
}

export type TableauDeBord = Awaited<ReturnType<typeof tableauDeBord>>;
