// Alertes du magasin (§41) : stock, finance, commerce, opérationnel. SERVEUR uniquement.
//
// - `calculerAlertes(tenantId)` relit la base et rend la liste des alertes en
//   cours. Chaque alerte porte une `explication` : la règle et les chiffres qui
//   l'ont déclenchée. Rien n'est stocké : une alerte disparaît quand sa cause
//   disparaît.
// - Une alerte = une cause (`cle` stable). Les ruptures de dix produits font UNE
//   alerte « 10 produits en rupture », pas dix.
// - `notifierAlertes` prévient le marchand (cloche du tableau de bord +
//   événement temps réel `alert.created`) au plus UNE fois par alerte et par
//   jour : le registre d'idempotence (MutationPos, type "alerte") sert de
//   mémoire, il n'y a donc pas de doublon même si deux lectures tombent en
//   même temps.
// - Déclenchement : à la lecture (GET /api/pos/alertes) ET par la tâche
//   planifiée /api/cron/pos/alertes. Le calcul ne dépend d'aucun planificateur.
//
// Seuils : constantes ci-dessous (aucune clé de ReglagesPos ne les porte).
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { avecIdempotence } from "./idempotence";
import { lireReglagesPos } from "./flags";
import { publierEvenement } from "./evenements";
import { alertesLots } from "./operations/lots";
import { totalVentes, type FiltresVentes } from "./analytics/ventes";

export const SEUILS = {
  /** Jours sans vente à partir desquels un produit en stock est « dormant ». */
  dormantJours: 60,
  /** Fenêtre d'observation des écarts de caisse, remboursements, ventes et marge. */
  fenetreJours: 7,
  /** Part du chiffre d'affaires encaissé au-delà de laquelle les remboursements sont jugés inhabituels. */
  remboursementsPct: 10,
  /** … et nombre minimal de remboursements pour en parler. */
  remboursementsMin: 3,
  /** Âge d'un paiement déclaré jamais pointé. */
  paiementNonRapprocheJours: 7,
  /** Baisse du chiffre d'affaires (7 jours contre les 7 précédents) qui déclenche l'alerte. */
  baisseVentesPct: 25,
  /** … seulement si la période précédente comptait au moins autant de ventes. */
  baisseVentesMinTransactions: 10,
  margeFaiblePct: 10,
  hausseCoutPct: 10,
  caisseSansSignalMinutes: 10,
  scannerSansSignalMinutes: 5,
  sessionLongueHeures: 24,
} as const;

/** Seuils en vigueur pour une boutique : constantes ci-dessus, retouchées par ses réglages (dormant, marge faible, remboursements). */
export async function seuilsAlertes(tenantId: string): Promise<{ [K in keyof typeof SEUILS]: number }> {
  return { ...SEUILS, ...(await lireReglagesPos(tenantId)).reglages.alertes };
}

export type CategorieAlerte = "stock" | "finance" | "commerce" | "operationnel";
export type GraviteAlerte = "info" | "attention" | "critique";

export type Alerte = {
  /** Identifiant stable de la cause (dédoublonnage). */
  cle: string;
  categorie: CategorieAlerte;
  gravite: GraviteAlerte;
  titre: string;
  message: string;
  /** Règle et chiffres qui ont déclenché l'alerte. */
  explication: string;
  /** Écran où agir. */
  lien: string;
};

const JOUR = 86_400_000;
const nb = (n: number) => Math.round(n).toLocaleString("fr-FR");
const exemples = (noms: string[]) => (noms.length ? ` : ${noms.slice(0, 3).join(", ")}${noms.length > 3 ? "…" : ""}` : "");

/**
 * Alertes en cours d'une boutique, les plus graves d'abord.
 * `voirCouts` false retire les alertes qui révèlent une marge ou un prix d'achat.
 * Une source illisible (table d'un lot pas encore déployée) est ignorée : les autres alertes sortent quand même.
 */
export async function calculerAlertes(tenantId: string, o: { voirCouts?: boolean } = {}): Promise<Alerte[]> {
  const voirCouts = o.voirCouts ?? true;
  // Seuils de la boutique : ceux de l'écran Réglages (reglages.alertes) priment sur les constantes.
  const S = await seuilsAlertes(tenantId);
  const maintenant = Date.now();
  const depuis = new Date(maintenant - S.fenetreJours * JOUR);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { devise: true } });
  const devise = tenant?.devise ?? "";
  const filtres: FiltresVentes = { tenantId, debut: depuis, fin: new Date(maintenant), tz: "UTC", magasinsAutorises: [] };
  const physiques = { tenantId, type: "physique", actif: true } as const;
  const dormantDepuis = new Date(maintenant - S.dormantJours * JOUR);
  const dormants: Prisma.ProduitWhereInput = {
    ...physiques, stock: { gt: 0 }, createdAt: { lt: dormantDepuis },
    lignesCommande: { none: { commande: { tenantId, createdAt: { gte: dormantDepuis }, statut: { not: "annulee" } } } },
  };
  const magasinsReels = { magasinId: { notIn: (await prisma.magasin.findMany({ where: { tenantId, demo: true }, select: { id: true } })).map((m) => m.id) } };

  const sources = await Promise.allSettled([
    /* 0 */ prisma.produit.findMany({ where: { ...physiques, stock: { lte: 0 }, variantes: { none: { actif: true, stock: { gt: 0 } } } }, select: { nom: true }, take: 200 }),
    /* 1 */ prisma.produit.findMany({ where: { ...physiques, stock: { gt: 0, lte: prisma.produit.fields.stockMin } }, select: { nom: true }, take: 200 }),
    /* 2 */ Promise.all([prisma.produit.count({ where: dormants }), prisma.produit.findMany({ where: dormants, orderBy: { stock: "desc" }, take: 3, select: { nom: true } })]),
    /* 3 */ alertesLots(tenantId, { limite: 200 }),
    /* 4 */ prisma.sessionCaisse.findMany({
      where: { tenantId, statut: "fermee", fermeeAt: { gte: depuis }, NOT: [{ ecart: null }, { ecart: 0 }], ...magasinsReels },
      orderBy: { fermeeAt: "desc" }, take: 5, select: { id: true, ecart: true, fermeeAt: true, caisse: { select: { nom: true } } },
    }),
    /* 5 */ prisma.paiementVente.aggregate({ where: { tenantId, montant: { lt: 0 }, statut: "rembourse", createdAt: { gte: depuis } }, _sum: { montant: true }, _count: { _all: true } }),
    /* 6 */ prisma.paiementVente.aggregate({
      where: { tenantId, declaratif: true, rapprochement: "a_rapprocher", montant: { gt: 0 }, statut: "confirme", createdAt: { lt: new Date(maintenant - S.paiementNonRapprocheJours * JOUR) } },
      _sum: { montant: true }, _count: { _all: true },
    }),
    /* 7 */ Promise.all([totalVentes(filtres), totalVentes({ ...filtres, debut: new Date(depuis.getTime() - S.fenetreJours * JOUR), fin: depuis })]),
    /* 8 */ prisma.$queryRaw<{ nom: string; cout: number; precedent: number }[]>(Prisma.sql`
      SELECT x.nom, x.cout, x.precedent FROM (
        SELECT p."nom" AS nom, lr."coutUnitaire" AS cout,
          LAG(lr."coutUnitaire") OVER (PARTITION BY lr."produitId", lr."varianteId" ORDER BY r."recuAt") AS precedent,
          ROW_NUMBER() OVER (PARTITION BY lr."produitId", lr."varianteId" ORDER BY r."recuAt" DESC) AS rang
        FROM "LigneReception" lr JOIN "ReceptionAchat" r ON r."id" = lr."receptionId" JOIN "Produit" p ON p."id" = lr."produitId"
        WHERE r."tenantId" = ${tenantId} AND r."statut" = 'validee' AND r."recuAt" >= ${new Date(maintenant - 180 * JOUR)}
      ) x WHERE x.rang = 1 AND x.precedent > 0 AND x.cout >= x.precedent * ${1 + S.hausseCoutPct / 100} LIMIT 20`),
    /* 9 */ prisma.sessionCaisse.findMany({
      where: { tenantId, statut: "ouverte", ...magasinsReels },
      select: { id: true, caisseId: true, ouverteAt: true, caisse: { select: { nom: true, dernierSignalAt: true } } },
    }),
    /* 10 */ prisma.appareilPos.findMany({ where: { tenantId, statut: "actif", caisseId: { not: null } }, select: { id: true, nom: true, caisseId: true, dernierSignalAt: true } }),
    /* 11 */ prisma.mutationPos.count({ where: { tenantId, statut: "conflit", recueAt: { gte: depuis } } }),
  ] as const);
  // Une source illisible rend null : son alerte est sautée, les autres sortent.
  const lu = <T,>(s: PromiseSettledResult<T>, i: number): T | null => {
    if (s.status === "rejected") console.warn("[pos-alertes] source", i, (s.reason as Error)?.message?.slice(0, 120));
    return s.status === "fulfilled" ? s.value : null;
  };

  const alertes: Alerte[] = [];
  const ajouter = (a: Alerte) => alertes.push(a);

  // ─── Stock ──────────────────────────────────────────────────────────────────
  const ruptures = lu(sources[0], 0);
  if (ruptures?.length) ajouter({
    cle: "stock.rupture", categorie: "stock", gravite: "critique", lien: "/dashboard/pos/stock",
    titre: "Produits en rupture de stock",
    message: `${ruptures.length >= 200 ? "200 produits ou plus" : `${ruptures.length} produit(s)`} en rupture${exemples(ruptures.map((p) => p.nom))}.`,
    explication: "Produits physiques actifs dont le stock (et celui de toutes leurs variantes) est à zéro.",
  });
  const faibles = lu(sources[1], 1);
  if (faibles?.length) ajouter({
    cle: "stock.faible", categorie: "stock", gravite: "attention", lien: "/dashboard/pos/stock",
    titre: "Stock faible",
    message: `${faibles.length} produit(s) sous leur seuil d'alerte${exemples(faibles.map((p) => p.nom))}.`,
    explication: "Produits dont le stock est descendu au niveau ou sous le « stock minimum » saisi sur leur fiche. Un produit sans seuil saisi n'est pas surveillé.",
  });
  const dorm = lu(sources[2], 2);
  if (dorm && dorm[0] > 0) ajouter({
    cle: "stock.dormant", categorie: "stock", gravite: "info", lien: "/dashboard/pos/analytics",
    titre: "Produits dormants",
    message: `${dorm[0]} produit(s) en stock sans aucune vente depuis ${S.dormantJours} jours${exemples(dorm[1].map((p) => p.nom))}.`,
    explication: `Produits physiques actifs, en stock, créés depuis plus de ${S.dormantJours} jours et absents de toute vente sur cette durée.`,
  });
  const lots = lu(sources[3], 3);
  if (lots?.expires.length) ajouter({
    cle: "stock.expire", categorie: "stock", gravite: "critique", lien: "/dashboard/pos/tracabilite",
    titre: "Lots expirés encore en stock",
    message: `${lots.expires.length} lot(s) expiré(s)${exemples(lots.expires.map((l) => `${l.produitNom} (${l.codeLot})`))}.`,
    explication: "Lots actifs dont la date d'expiration est passée et dont il reste de la quantité.",
  });
  if (lots?.expirentBientot.length) ajouter({
    cle: "stock.expire_bientot", categorie: "stock", gravite: "attention", lien: "/dashboard/pos/tracabilite",
    titre: "Lots proches de l'expiration",
    message: `${lots.expirentBientot.length} lot(s) expirent dans les ${lots.seuilJours} jours${exemples(lots.expirentBientot.map((l) => `${l.produitNom} (${l.joursRestants} j)`))}.`,
    explication: `Lots actifs, encore en stock, dont la date d'expiration tombe dans les ${lots.seuilJours} prochains jours.`,
  });

  // ─── Finance ────────────────────────────────────────────────────────────────
  for (const s of lu(sources[4], 4) ?? []) ajouter({
    cle: `finance.ecart.${s.id}`, categorie: "finance", gravite: "attention", lien: "/dashboard/pos/session",
    titre: `Écart de caisse — ${s.caisse.nom}`,
    message: `${(s.ecart ?? 0) > 0 ? "Excédent" : "Manque"} de ${nb(Math.abs(s.ecart ?? 0))} ${devise} à la fermeture du ${s.fermeeAt?.toLocaleDateString("fr-FR") ?? ""}.`,
    explication: `Espèces comptées à la fermeture différentes des espèces attendues. Sessions fermées depuis ${S.fenetreJours} jours.`,
  });
  const ventes = lu(sources[7], 7);
  const rembourses = lu(sources[5], 5);
  if (rembourses && ventes) {
    const montant = -(rembourses._sum.montant ?? 0), nombre = rembourses._count._all;
    const base = ventes[0].ca + ventes[0].retours;
    if (nombre >= S.remboursementsMin && base > 0 && (montant / base) * 100 > S.remboursementsPct) ajouter({
      cle: "finance.remboursements", categorie: "finance", gravite: "attention", lien: "/dashboard/pos/retours",
      titre: "Remboursements inhabituels",
      message: `${nombre} remboursements pour ${nb(montant)} ${devise} en ${S.fenetreJours} jours, soit ${Math.round((montant / base) * 100)} % des ventes.`,
      explication: `Au moins ${S.remboursementsMin} remboursements dont le total dépasse ${S.remboursementsPct} % des ventes de caisse des ${S.fenetreJours} derniers jours.`,
    });
  }
  const nonRapproches = lu(sources[6], 6);
  if (nonRapproches && nonRapproches._count._all > 0) ajouter({
    cle: "finance.non_rapproche", categorie: "finance", gravite: "attention", lien: "/dashboard/pos/rapprochement",
    titre: "Paiements déclarés jamais vérifiés",
    message: `${nonRapproches._count._all} paiement(s) non vérifié(s) pour ${nb(nonRapproches._sum.montant ?? 0)} ${devise} attendent d'être pointés depuis plus de ${S.paiementNonRapprocheJours} jours.`,
    explication: "Paiements Mobile Money, carte, virement ou QR confirmés par le caissier seulement : AXSO ne les a pas vérifiés. Pointez-les sur vos relevés.",
  });

  // ─── Commerce ───────────────────────────────────────────────────────────────
  if (ventes) {
    const [actuel, precedent] = ventes;
    if (precedent.transactions >= S.baisseVentesMinTransactions && precedent.ca > 0) {
      const baisse = Math.round(((precedent.ca - actuel.ca) / precedent.ca) * 100);
      if (baisse >= S.baisseVentesPct) ajouter({
        cle: "commerce.baisse_ventes", categorie: "commerce", gravite: "attention", lien: "/dashboard/pos/analytics",
        titre: "Baisse des ventes",
        message: `Ventes en baisse de ${baisse} % : ${nb(actuel.ca)} ${devise} sur ${S.fenetreJours} jours contre ${nb(precedent.ca)} ${devise} les ${S.fenetreJours} jours précédents.`,
        explication: `Chiffre d'affaires de caisse des ${S.fenetreJours} derniers jours inférieur d'au moins ${S.baisseVentesPct} % à celui des ${S.fenetreJours} jours d'avant (qui comptaient au moins ${S.baisseVentesMinTransactions} ventes).`,
      });
    }
    const margePct = actuel.caHT > 0 ? (actuel.marge / actuel.caHT) * 100 : null;
    // Sans aucun coût saisi, la « marge » vaudrait 100 % : on ne conclut rien.
    if (voirCouts && margePct !== null && actuel.cout > 0 && actuel.transactions >= S.baisseVentesMinTransactions && margePct < S.margeFaiblePct) ajouter({
      cle: "commerce.marge_faible", categorie: "commerce", gravite: "attention", lien: "/dashboard/pos/analytics",
      titre: "Marge faible",
      message: `Marge de ${Math.round(margePct * 10) / 10} % sur les ${S.fenetreJours} derniers jours.`,
      explication: `Marge (ventes hors taxes moins coût des articles vendus) inférieure à ${S.margeFaiblePct} % des ventes hors taxes.${actuel.lignesCoutApproche ? " Certaines lignes utilisent le coût actuel du produit : la marge est approchée." : ""}`,
    });
  }
  const hausses = lu(sources[8], 8);
  if (voirCouts && hausses?.length) ajouter({
    cle: "commerce.cout_hausse", categorie: "commerce", gravite: "attention", lien: "/dashboard/pos/receptions",
    titre: "Prix fournisseur en hausse",
    message: `${hausses.length} article(s) reçus plus cher qu'à la réception précédente${exemples(hausses.map((h) => `${h.nom} (+${Math.round(((h.cout - h.precedent) / h.precedent) * 100)} %)`))}.`,
    explication: `Coût unitaire de la dernière réception validée supérieur d'au moins ${S.hausseCoutPct} % à celui de la réception d'avant (180 derniers jours).`,
  });

  // ─── Opérationnel ───────────────────────────────────────────────────────────
  const ouvertes = lu(sources[9], 9) ?? [];
  for (const s of ouvertes) {
    const signal = s.caisse.dernierSignalAt?.getTime() ?? 0;
    if (maintenant - signal > S.caisseSansSignalMinutes * 60_000) ajouter({
      cle: `operationnel.caisse_sans_signal.${s.caisseId}`, categorie: "operationnel", gravite: "attention", lien: "/dashboard/pos/supervision",
      titre: `Caisse ouverte sans signal — ${s.caisse.nom}`,
      message: signal ? `Aucun signe de vie depuis ${Math.round((maintenant - signal) / 60_000)} minutes alors que la session est ouverte.` : "La session est ouverte mais ce poste n'a jamais donné signe de vie.",
      explication: `Session de caisse ouverte dont le poste n'a pas été vu depuis plus de ${S.caisseSansSignalMinutes} minutes : écran fermé, poste éteint ou hors ligne.`,
    });
    if (maintenant - s.ouverteAt.getTime() > S.sessionLongueHeures * 3_600_000) ajouter({
      cle: `operationnel.session_longue.${s.id}`, categorie: "operationnel", gravite: "attention", lien: "/dashboard/pos/session",
      titre: `Caisse non fermée — ${s.caisse.nom}`,
      message: `Session ouverte depuis le ${s.ouverteAt.toLocaleDateString("fr-FR")} : la caisse n'a pas été comptée.`,
      explication: `Session de caisse ouverte depuis plus de ${S.sessionLongueHeures} heures.`,
    });
  }
  const caissesOuvertes = new Set(ouvertes.map((s) => s.caisseId));
  const muets = (lu(sources[10], 10) ?? []).filter((a) => a.caisseId && caissesOuvertes.has(a.caisseId) && maintenant - (a.dernierSignalAt?.getTime() ?? 0) > S.scannerSansSignalMinutes * 60_000);
  if (muets.length) ajouter({
    cle: "operationnel.scanner_deconnecte", categorie: "operationnel", gravite: "info", lien: "/dashboard/pos/supervision",
    titre: "Scanner déconnecté",
    message: `${muets.length} scanner(s) sans signal sur une caisse ouverte${exemples(muets.map((a) => a.nom))}.`,
    explication: `Téléphones appairés à une caisse dont la session est ouverte, sans signe de vie depuis plus de ${S.scannerSansSignalMinutes} minutes.`,
  });
  const conflits = lu(sources[11], 11);
  if (conflits) ajouter({
    cle: "operationnel.sync_conflit", categorie: "operationnel", gravite: "attention", lien: "/dashboard/pos/journal",
    titre: "Synchronisation à vérifier",
    message: `${conflits} opération(s) arrivée(s) en conflit en ${S.fenetreJours} jours.`,
    explication: "Opérations saisies hors ligne puis enregistrées avec un conflit (stock dépassé, numéro de série déjà vendu…) : elles demandent une vérification humaine.",
  });

  const ordre: Record<GraviteAlerte, number> = { critique: 0, attention: 1, info: 2 };
  return alertes.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]);
}

/**
 * Prévient le marchand des alertes « attention » et « critique » pas encore
 * annoncées aujourd'hui. Rend le nombre d'alertes nouvellement annoncées.
 */
export async function notifierAlertes(tenantId: string, alertes: Alerte[]): Promise<number> {
  const jour = new Date().toISOString().slice(0, 10);
  const candidates = alertes.filter((a) => a.gravite !== "info").map((a) => ({ a, cle: `alerte:${jour}:${a.cle}`.slice(0, 200) }));
  if (!candidates.length) return 0;
  const connues = new Set((await prisma.mutationPos.findMany({ where: { tenantId, cle: { in: candidates.map((c) => c.cle) } }, select: { cle: true } })).map((m) => m.cle));
  let nouvelles = 0;
  for (const { a, cle } of candidates) {
    if (connues.has(cle)) continue;
    try {
      const { rejoue } = await avecIdempotence(tenantId, cle, "alerte", async (tx) => {
        await tx.notificationMarchand.create({ data: { tenantId, type: "pos_alerte", titre: a.titre, message: a.message, lien: a.lien } });
        await publierEvenement(tx, { tenantId, type: "alert.created", payload: { cle: a.cle, categorie: a.categorie, gravite: a.gravite, titre: a.titre, message: a.message, lien: a.lien } });
        return { cle: a.cle };
      });
      if (!rejoue) nouvelles++;
    } catch (e) {
      console.warn("[pos-alertes] notification", a.cle, (e as Error)?.message?.slice(0, 120));
    }
  }
  return nouvelles;
}
