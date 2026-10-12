// Analytics du magasin (§38-40).
// GET /api/pos/analytics?debut=&fin=&tz=&magasinId=&caisseId=&vendeurId=&produitId=&categorie=
// Droit : voir_analytics. Coûts, marges et valeurs de stock : voir_couts.
// Performance des caissiers : voir_caisse en plus (c'est une information de
// responsable) — sinon la section est absente (`caissiers: null`).
//
// Performance des caissiers, volontairement sobre : transactions, chiffre
// d'affaires, panier moyen, remises, annulations, remboursements, écarts de
// caisse. Pas de vitesse à la seconde, pas de temps de pause, pas de
// classement : la liste est rendue par ordre alphabétique.
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { aDroit, exigerDroit } from "@/lib/pos/droits";
import { nomsUtilisateurs } from "@/lib/pos/caisse/mouvements";
import {
  agregerVentes, annulations, ecartsCaisse, indicateurs, lireFiltres, periodePrecedente, pertes, produitsDormants,
  remboursements, stockActuel, totalVentes, type Agregat,
} from "@/lib/pos/analytics/ventes";
import { listesFiltres } from "@/lib/pos/analytics/listes";

export const GET = routePos(async (ctx, req) => {
  exigerDroit(ctx, "voir_analytics");
  const voirCouts = aDroit(ctx, "voir_couts");
  const voirCaissiers = aDroit(ctx, "voir_caisse");
  const f = await lireFiltres(ctx, new URL(req.url).searchParams);
  const jours = Math.max(1, (f.fin.getTime() - f.debut.getTime()) / 86_400_000);

  const [tenant, total, precedent, parHeure, parJour, creneaux, parVendeur, parCaisse, parMagasin, parProduit, dormants, perdu, stock, ecarts, annulees, rembourses, listes] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { devise: true } }),
    totalVentes(f), totalVentes(periodePrecedente(f)),
    agregerVentes(f, "heure"), agregerVentes(f, "jour"), agregerVentes(f, "creneau"),
    agregerVentes(f, "vendeur"), agregerVentes(f, "caisse"), agregerVentes(f, "magasin"), agregerVentes(f, "produit"),
    produitsDormants(ctx.tenantId, { voirCouts }), pertes(f), stockActuel(ctx.tenantId),
    ecartsCaisse(f), annulations(f), remboursements(f), listesFiltres(f),
  ]);

  const personnes = [...parVendeur.map((a) => a.cle), ...ecarts.map((e) => e.userId), ...annulees.map((a) => a.vendeurId), ...rembourses.map((r) => r.userId)];
  const noms = await nomsUtilisateurs(ctx.tenantId, personnes);
  const nomCaisse = new Map(listes.magasins.flatMap((m) => m.caisses.map((c) => [c.id, `${c.nom} — ${m.nom}`] as const)));
  const nomMagasin = new Map(listes.magasins.map((m) => [m.id, m.nom]));
  const ligne = (a: Agregat, nom: string) => ({ id: a.cle, nom, ...indicateurs(a, voirCouts) });

  const sommeEcarts = ecarts.reduce((s, e) => ({ sessions: s.sessions + e.sessions, avecEcart: s.avecEcart + e.avecEcart, ecartNet: s.ecartNet + e.ecartNet, ecartAbsolu: s.ecartAbsolu + e.ecartAbsolu }), { sessions: 0, avecEcart: 0, ecartNet: 0, ecartAbsolu: 0 });

  // Une ligne par personne apparaissant dans au moins une mesure, par ordre alphabétique (pas de classement).
  const caissiers = !voirCaissiers ? null : [...new Set(personnes.filter(Boolean))].map((id) => {
    const v = parVendeur.find((a) => a.cle === id);
    const e = ecarts.find((x) => x.userId === id);
    const an = annulees.find((x) => x.vendeurId === id);
    const r = rembourses.find((x) => x.userId === id);
    return {
      id, nom: noms[id] ?? "Utilisateur",
      transactions: v?.transactions ?? 0, ca: v?.ca ?? 0, panierMoyen: v && v.transactions > 0 ? v.ca / v.transactions : 0, remises: v?.remises ?? 0,
      annulations: an?.nombre ?? 0, remboursements: r?.nombre ?? 0, montantRembourse: r?.montant ?? 0,
      sessionsFermees: e?.sessions ?? 0, sessionsAvecEcart: e?.avecEcart ?? 0, ecartNet: e?.ecartNet ?? 0,
    };
  }).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  return {
    periode: { debut: f.debut.toISOString(), fin: f.fin.toISOString(), jours: Math.round(jours * 10) / 10 },
    devise: tenant.devise, voirCouts,
    resume: indicateurs(total, voirCouts),
    precedent: indicateurs(precedent, voirCouts),
    /**
     * Rotation du stock sur la période — ESTIMATION : unités vendues ÷ stock actuel (le stock moyen
     * de la période n'est pas historisé). `annuelle` extrapole le rythme de la période sur 365 jours.
     */
    rotation: stock.unites > 0
      ? { estimation: true as const, periode: Math.round((total.unites / stock.unites) * 100) / 100, annuelle: Math.round((total.unites / stock.unites) * (365 / jours) * 10) / 10, stockUnites: Math.round(stock.unites), stockValeur: voirCouts ? stock.valeur : null }
      : null,
    parHeure: Array.from({ length: 24 }, (_x, h) => { const a = parHeure.find((x) => x.cle === String(h)); return { heure: h, ca: a?.ca ?? 0, transactions: a?.transactions ?? 0 }; }),
    parJour: parJour.sort((a, b) => a.cle.localeCompare(b.cle)).map((a) => ({ jour: a.cle, ca: a.ca, transactions: a.transactions, marge: voirCouts ? a.marge : null })),
    /** Heatmap : jour ISO (1 = lundi … 7 = dimanche) × heure. Seuls les créneaux avec des ventes sont rendus. */
    heatmap: creneaux.map((a) => { const [jour, heure] = a.cle.split(":").map(Number); return { jour, heure, ca: a.ca, transactions: a.transactions }; }),
    parCaisse: parCaisse.map((a) => ligne(a, nomCaisse.get(a.cle) ?? (a.cle ? "Caisse supprimée" : "Ancienne caisse"))).sort((a, b) => b.ca - a.ca),
    parMagasin: parMagasin.map((a) => ligne(a, nomMagasin.get(a.cle) ?? (a.cle ? "Magasin" : "Sans magasin (ancienne caisse)"))).sort((a, b) => b.ca - a.ca),
    /** Ventes par vendeur — même droit que la performance des caissiers. */
    parVendeur: !voirCaissiers ? null : parVendeur.map((a) => ligne(a, noms[a.cle] ?? (a.cle ? "Utilisateur" : "Vendeur non enregistré"))).sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    produitsStars: parProduit.sort((a, b) => b.ca - a.ca).slice(0, 10).map((a) => ligne(a, a.nom ?? "Produit")),
    produitsDormants: dormants,
    /** Pertes déclarées (mouvements de stock « perte »), valorisées au coût actuel : estimation. */
    pertes: { ...perdu, valeur: voirCouts ? perdu.valeur : null, produits: perdu.produits.map((p) => ({ ...p, valeur: voirCouts ? p.valeur : null })) },
    ecartsCaisse: sommeEcarts,
    annulations: { nombre: annulees.reduce((s, a) => s + a.nombre, 0), montant: annulees.reduce((s, a) => s + a.montant, 0) },
    remboursements: { nombre: rembourses.reduce((s, r) => s + r.nombre, 0), montant: rembourses.reduce((s, r) => s + r.montant, 0) },
    caissiers,
    filtres: listes,
  };
});
