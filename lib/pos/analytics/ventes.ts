// Chiffres de vente du magasin — pilotage, analytics, alertes, AXIA. SERVEUR uniquement.
//
// UNE SEULE définition des chiffres, agrégée par la base (aucune vente n'est
// chargée en mémoire) :
// - Ventes comptées : canal "pos" (ou l'ancien client fictif "pos@local" tant
//   que le SQL de la migration n'a pas rattrapé leur canal), non annulées, hors
//   magasins de démonstration (Magasin.demo).
// - Chiffre d'affaires = ce que les clients ont payé (remises déduites) moins
//   la valeur des articles retournés. Le total de chaque vente est réparti sur
//   ses lignes au prorata de leur montant net (même règle que
//   lib/pos/caisse/calculs.ts → ventilerVente, sans l'arrondi par ligne), puis
//   chaque ligne ne garde que sa part non retournée (quantiteRetournee).
// - Marge = chiffre d'affaires HORS TAXES − coût. Coût = celui figé sur la
//   ligne à la vente (LigneCommande.cout) ; pour les ventes d'avant la caisse
//   2.0, le coût ACTUEL du produit le remplace : c'est une approximation,
//   comptée dans `lignesCoutApproche` et signalée à l'écran.
// - Une vente à crédit compte dans le chiffre d'affaires dès la vente.
import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { droitsUtilisateur } from "../acces";
import { ErreurPos } from "../erreurs";
import type { ContextePos } from "../types";

export type FiltresVentes = {
  tenantId: string;
  debut: Date;
  /** Borne exclue. */
  fin: Date;
  /** Fuseau du navigateur (IANA), pour découper par heure et par jour. */
  tz: string;
  /** Magasins permis au membre ; vide = tous. */
  magasinsAutorises: string[];
  magasinId?: string | null;
  caisseId?: string | null;
  vendeurId?: string | null;
  produitId?: string | null;
  categorie?: string | null;
};

export const DIMENSIONS = ["total", "heure", "jour", "creneau", "vendeur", "caisse", "magasin", "produit", "categorie"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export type Agregat = {
  /** Valeur de la dimension : "14" (heure), "2026-10-11" (jour), "3:14" (jour ISO 1-7 : heure), identifiant, ou "total". */
  cle: string;
  /** Nom du produit (dimension « produit » seulement). */
  nom: string | null;
  transactions: number;
  ca: number;
  caHT: number;
  cout: number;
  marge: number;
  unites: number;
  remises: number;
  retours: number;
  lignesCoutApproche: number;
};

const JOUR_MS = 86_400_000;

function fuseauValide(tz: string | null): string {
  if (!tz || tz.length > 64) return "UTC";
  try { new Intl.DateTimeFormat("fr", { timeZone: tz }); return tz; } catch { return "UTC"; }
}

function lireDate(v: string | null, defaut: Date): Date {
  if (!v) return defaut;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new ErreurPos("invalide", 400, "La période demandée est illisible.");
  return d;
}

/**
 * Filtres d'une requête (`?debut=&fin=&tz=&magasinId=&caisseId=&vendeurId=&produitId=&categorie=`).
 * Par défaut : les dernières 24 heures. La période est bornée à 400 jours.
 * Un membre affecté à certains magasins ne voit que ceux-là.
 */
export async function lireFiltres(ctx: ContextePos, p: URLSearchParams): Promise<FiltresVentes> {
  const fin = lireDate(p.get("fin"), new Date());
  const debut = lireDate(p.get("debut"), new Date(fin.getTime() - JOUR_MS));
  if (debut >= fin) throw new ErreurPos("invalide", 400, "La date de début doit précéder la date de fin.");
  if (fin.getTime() - debut.getTime() > 400 * JOUR_MS) throw new ErreurPos("invalide", 400, "La période demandée est trop longue : choisissez au plus 400 jours.");
  const acces = await droitsUtilisateur(ctx.tenantId, ctx.userId);
  const magasinsAutorises = acces?.magasinIds ?? [];
  const magasinId = p.get("magasinId") || null;
  if (magasinId && magasinsAutorises.length && !magasinsAutorises.includes(magasinId)) {
    throw new ErreurPos("non_autorise", 403, "Vous n'êtes pas affecté à ce magasin. Demandez à un responsable.");
  }
  const court = (v: string | null) => (v && v.length <= 120 ? v : null);
  return {
    tenantId: ctx.tenantId, debut, fin, tz: fuseauValide(p.get("tz")), magasinsAutorises, magasinId,
    caisseId: court(p.get("caisseId")), vendeurId: court(p.get("vendeurId")), produitId: court(p.get("produitId")), categorie: court(p.get("categorie")),
  };
}

/** Même période, décalée d'autant en arrière (comparaison « période précédente »). */
export function periodePrecedente(f: FiltresVentes): FiltresVentes {
  const duree = f.fin.getTime() - f.debut.getTime();
  return { ...f, debut: new Date(f.debut.getTime() - duree), fin: f.debut };
}

/** Conditions SQL sur la vente (alias `c`) : boutique, canal, période, magasin, caisse, vendeur. */
export function conditionsVente(f: FiltresVentes, o: { annulees?: boolean } = {}): Prisma.Sql {
  const c: Prisma.Sql[] = [
    Prisma.sql`c."tenantId" = ${f.tenantId}`,
    Prisma.sql`(c."canal" = 'pos' OR c."clientEmail" = 'pos@local')`,
    o.annulees ? Prisma.sql`c."statut" = 'annulee'` : Prisma.sql`c."statut" <> 'annulee'`,
    Prisma.sql`c."createdAt" >= ${f.debut} AND c."createdAt" < ${f.fin}`,
    Prisma.sql`(c."magasinId" IS NULL OR c."magasinId" NOT IN (SELECT m.id FROM "Magasin" m WHERE m."tenantId" = ${f.tenantId} AND m."demo"))`,
  ];
  if (f.magasinsAutorises.length) c.push(Prisma.sql`c."magasinId" IN (${Prisma.join(f.magasinsAutorises)})`);
  if (f.magasinId) c.push(Prisma.sql`c."magasinId" = ${f.magasinId}`);
  if (f.caisseId) c.push(Prisma.sql`c."caisseId" = ${f.caisseId}`);
  if (f.vendeurId) c.push(Prisma.sql`c."vendeurId" = ${f.vendeurId}`);
  return Prisma.join(c, " AND ");
}

/** Le même filtre, pour une requête Prisma classique sur Commande. */
export function ouVente(f: FiltresVentes): Prisma.CommandeWhereInput {
  return {
    tenantId: f.tenantId, OR: [{ canal: "pos" }, { clientEmail: "pos@local" }], statut: { not: "annulee" },
    createdAt: { gte: f.debut, lt: f.fin },
    ...(f.magasinId ? { magasinId: f.magasinId } : f.magasinsAutorises.length ? { magasinId: { in: f.magasinsAutorises } } : {}),
    ...(f.caisseId ? { caisseId: f.caisseId } : {}),
    ...(f.vendeurId ? { vendeurId: f.vendeurId } : {}),
  };
}

function expressionCle(d: Dimension, tz: string): Prisma.Sql {
  // createdAt est un horodatage UTC sans fuseau : on le replace en UTC puis dans le fuseau demandé.
  const local = Prisma.sql`(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})`;
  switch (d) {
    case "heure": return Prisma.sql`EXTRACT(HOUR FROM ${local})::int::text`;
    case "jour": return Prisma.sql`to_char(${local}, 'YYYY-MM-DD')`;
    case "creneau": return Prisma.sql`EXTRACT(ISODOW FROM ${local})::int::text || ':' || EXTRACT(HOUR FROM ${local})::int::text`;
    case "vendeur": return Prisma.sql`COALESCE("vendeurId", '')`;
    case "caisse": return Prisma.sql`COALESCE("caisseId", '')`;
    case "magasin": return Prisma.sql`COALESCE("magasinId", '')`;
    case "produit": return Prisma.sql`"produitId"`;
    case "categorie": return Prisma.sql`COALESCE("categorie", '')`;
    default: return Prisma.sql`'total'`;
  }
}

type LigneBrute = { cle: string; nom: string | null; transactions: bigint; ca: number | null; ca_ht: number | null; cout: number | null; unites: number | null; remises: number | null; retours: number | null; approche: bigint };

/**
 * Chiffres de vente groupés par `dimension`. Les filtres produit et catégorie
 * s'appliquent aux lignes, APRÈS la répartition du total de la vente (qui se
 * fait sur toutes ses lignes).
 */
export async function agregerVentes(f: FiltresVentes, dimension: Dimension = "total"): Promise<Agregat[]> {
  const net = Prisma.sql`CASE WHEN lc."offert" THEN 0 ELSE GREATEST(0, lc."prix" * lc."quantite" - lc."remise") END`;
  const filtresLigne: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (f.produitId) filtresLigne.push(Prisma.sql`"produitId" = ${f.produitId}`);
  if (f.categorie) filtresLigne.push(Prisma.sql`"categorie" = ${f.categorie}`);
  const lignes = await prisma.$queryRaw<LigneBrute[]>(Prisma.sql`
    WITH l AS (
      SELECT lc."commandeId", lc."produitId", lc."quantite", lc."quantiteRetournee", lc."mesure",
        c."createdAt", c."magasinId", c."caisseId", c."vendeurId", c."montantTotal", c."montantReduction",
        p."categorie", p."nom" AS "produitNom",
        GREATEST(COALESCE(lc."tauxTVA", 0), 0) AS taux,
        COALESCE(lc."cout", CASE WHEN lc."mesure" IS NOT NULL THEN p."cout" / 1000 ELSE p."cout" END, 0) AS cout_u,
        (lc."cout" IS NULL) AS approche,
        lc."prix" * lc."quantite" AS brut,
        ${net} AS net,
        SUM(${net}) OVER (PARTITION BY lc."commandeId") AS somme,
        SUM(lc."remise" + CASE WHEN lc."offert" THEN 1 ELSE 0 END) OVER (PARTITION BY lc."commandeId") AS remises_lignes
      FROM "Commande" c
      JOIN "LigneCommande" lc ON lc."commandeId" = c."id"
      JOIN "Produit" p ON p."id" = lc."produitId"
      WHERE ${conditionsVente(f)}
    ), n AS (
      SELECT l.*,
        CASE WHEN somme > 0 THEN "montantTotal" * net / somme ELSE 0 END AS total_l,
        CASE WHEN "quantite" > 0 THEN GREATEST("quantite" - "quantiteRetournee", 0)::float8 / "quantite" ELSE 0 END AS part,
        GREATEST("quantite" - "quantiteRetournee", 0) AS restant
      FROM l
    )
    SELECT ${expressionCle(dimension, f.tz)} AS cle,
      MAX("produitNom") AS nom,
      COUNT(DISTINCT "commandeId") FILTER (WHERE part > 0) AS transactions,
      SUM(total_l * part) AS ca,
      SUM(total_l * part / (1 + taux)) AS ca_ht,
      SUM(cout_u * restant) AS cout,
      SUM(CASE WHEN "mesure" IS NOT NULL THEN (CASE WHEN part > 0 THEN 1 ELSE 0 END) ELSE restant END) AS unites,
      -- remise de la ligne (ou valeur d'un article offert) ; ancienne caisse : part de la remise globale de la vente
      SUM((brut - net) + CASE WHEN remises_lignes = 0 AND somme > 0 THEN "montantReduction" * net / somme ELSE 0 END) AS remises,
      SUM(total_l * (1 - part)) AS retours,
      COUNT(*) FILTER (WHERE approche AND part > 0) AS approche
    FROM n
    WHERE ${Prisma.join(filtresLigne, " AND ")}
    GROUP BY 1
  `);
  return lignes.map((l) => {
    const caHT = l.ca_ht ?? 0, cout = l.cout ?? 0;
    return {
      cle: l.cle, nom: dimension === "produit" ? l.nom : null, transactions: Number(l.transactions),
      ca: l.ca ?? 0, caHT, cout, marge: caHT - cout, unites: Number(l.unites ?? 0),
      remises: l.remises ?? 0, retours: l.retours ?? 0, lignesCoutApproche: Number(l.approche),
    };
  });
}

const VIDE: Agregat = { cle: "total", nom: null, transactions: 0, ca: 0, caHT: 0, cout: 0, marge: 0, unites: 0, remises: 0, retours: 0, lignesCoutApproche: 0 };

/** Total de la période (une ligne, à zéro s'il n'y a aucune vente). */
export async function totalVentes(f: FiltresVentes): Promise<Agregat> {
  return (await agregerVentes(f, "total"))[0] ?? VIDE;
}

export type Indicateurs = {
  ca: number; transactions: number; panierMoyen: number; unites: number; remises: number; retours: number;
  /** Part du chiffre d'affaires brut (avant retours) revenue en retours, en %. */
  tauxRetour: number;
  /** null quand le lecteur n'a pas le droit de voir les coûts. */
  marge: number | null; margePct: number | null; cout: number | null;
  lignesCoutApproche: number;
};

/** PURE. Indicateurs affichés à partir d'un agrégat ; `voirCouts` false masque coût et marge. */
export function indicateurs(a: Agregat, voirCouts: boolean): Indicateurs {
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
  return {
    ca: a.ca, transactions: a.transactions, panierMoyen: a.transactions > 0 ? a.ca / a.transactions : 0, unites: a.unites,
    remises: a.remises, retours: a.retours, tauxRetour: pct(a.retours, a.ca + a.retours),
    marge: voirCouts ? a.marge : null, margePct: voirCouts ? pct(a.marge, a.caHT) : null, cout: voirCouts ? a.cout : null,
    lignesCoutApproche: voirCouts ? a.lignesCoutApproche : 0,
  };
}

/** Encaissements nets de la période par moyen (remboursements déduits). Les ventes d'avant la caisse 2.0 n'ont pas de ligne de paiement. */
export async function encaissements(f: FiltresVentes): Promise<{ mode: string; montant: number; nombre: number }[]> {
  const groupes = await prisma.paiementVente.groupBy({
    by: ["mode"],
    where: { tenantId: f.tenantId, statut: { in: ["confirme", "rembourse"] }, commande: ouVente(f) },
    _sum: { montant: true }, _count: { _all: true },
  });
  return groupes.map((g) => ({ mode: g.mode, montant: g._sum.montant ?? 0, nombre: g._count._all })).sort((a, b) => b.montant - a.montant);
}

/** Ventes annulées de la période, par vendeur (clé "" = vendeur inconnu). */
export async function annulations(f: FiltresVentes): Promise<{ vendeurId: string; nombre: number; montant: number }[]> {
  const lignes = await prisma.$queryRaw<{ vendeur: string; nombre: bigint; montant: number | null }[]>(Prisma.sql`
    SELECT COALESCE(c."vendeurId", '') AS vendeur, COUNT(*) AS nombre, SUM(c."montantTotal") AS montant
    FROM "Commande" c WHERE ${conditionsVente(f, { annulees: true })} GROUP BY 1`);
  return lignes.map((l) => ({ vendeurId: l.vendeur, nombre: Number(l.nombre), montant: l.montant ?? 0 }));
}

/** Remboursements versés sur la période (lignes de paiement négatives), par personne qui a remboursé. */
export async function remboursements(f: FiltresVentes): Promise<{ userId: string; nombre: number; montant: number }[]> {
  const groupes = await prisma.paiementVente.groupBy({
    by: ["encaissePar"],
    where: {
      tenantId: f.tenantId, montant: { lt: 0 }, statut: "rembourse", createdAt: { gte: f.debut, lt: f.fin },
      commande: { ...ouVente(f), createdAt: undefined, statut: undefined },
    },
    _sum: { montant: true }, _count: { _all: true },
  });
  return groupes.map((g) => ({ userId: g.encaissePar, nombre: g._count._all, montant: -(g._sum.montant ?? 0) }));
}

/** Écarts de caisse des sessions fermées sur la période, par personne qui a fermé. */
export async function ecartsCaisse(f: FiltresVentes): Promise<{ userId: string; sessions: number; avecEcart: number; ecartNet: number; ecartAbsolu: number }[]> {
  const cond: Prisma.Sql[] = [
    Prisma.sql`s."tenantId" = ${f.tenantId}`, Prisma.sql`s."statut" = 'fermee'`,
    Prisma.sql`s."fermeeAt" >= ${f.debut} AND s."fermeeAt" < ${f.fin}`,
    Prisma.sql`s."magasinId" NOT IN (SELECT m.id FROM "Magasin" m WHERE m."tenantId" = ${f.tenantId} AND m."demo")`,
  ];
  if (f.magasinsAutorises.length) cond.push(Prisma.sql`s."magasinId" IN (${Prisma.join(f.magasinsAutorises)})`);
  if (f.magasinId) cond.push(Prisma.sql`s."magasinId" = ${f.magasinId}`);
  if (f.caisseId) cond.push(Prisma.sql`s."caisseId" = ${f.caisseId}`);
  const lignes = await prisma.$queryRaw<{ userid: string; sessions: bigint; avec: bigint; net: number | null; absolu: number | null }[]>(Prisma.sql`
    SELECT COALESCE(s."fermeePar", '') AS userid, COUNT(*) AS sessions,
      COUNT(*) FILTER (WHERE COALESCE(s."ecart", 0) <> 0) AS avec,
      SUM(COALESCE(s."ecart", 0)) AS net, SUM(ABS(COALESCE(s."ecart", 0))) AS absolu
    FROM "SessionCaisse" s WHERE ${Prisma.join(cond, " AND ")} GROUP BY 1`);
  return lignes.map((l) => ({ userId: l.userid, sessions: Number(l.sessions), avecEcart: Number(l.avec), ecartNet: l.net ?? 0, ecartAbsolu: l.absolu ?? 0 }));
}

/**
 * Pertes déclarées sur la période (mouvements de stock « perte »), valorisées
 * au coût ACTUEL du produit (le mouvement ne porte pas de coût) : une estimation.
 */
export async function pertes(f: FiltresVentes): Promise<{ quantite: number; valeur: number; mouvements: number; produits: { produitId: string; nom: string; quantite: number; valeur: number }[] }> {
  const lignes = await prisma.$queryRaw<{ id: string; nom: string; quantite: number | null; valeur: number | null; mouvements: bigint }[]>(Prisma.sql`
    SELECT p."id", p."nom", SUM(m."quantite") AS quantite, COUNT(*) AS mouvements,
      SUM(m."quantite" * COALESCE(p."cout", 0) / CASE WHEN p."uniteVente" = 'kg' THEN 1000 ELSE 1 END) AS valeur
    FROM "StockMouvement" m JOIN "Produit" p ON p."id" = m."produitId"
    WHERE m."tenantId" = ${f.tenantId} AND m."type" = 'perte' AND m."createdAt" >= ${f.debut} AND m."createdAt" < ${f.fin}
    GROUP BY 1, 2 ORDER BY valeur DESC NULLS LAST LIMIT 50`);
  const produits = lignes.map((l) => ({ produitId: l.id, nom: l.nom, quantite: l.quantite ?? 0, valeur: l.valeur ?? 0 }));
  return {
    quantite: produits.reduce((s, p) => s + p.quantite, 0), valeur: produits.reduce((s, p) => s + p.valeur, 0),
    mouvements: lignes.reduce((s, l) => s + Number(l.mouvements), 0), produits: produits.slice(0, 10),
  };
}

/** Stock actuel de la boutique (produits physiques actifs ; avec variantes, c'est leur somme) : unités et valeur au coût actuel. */
export async function stockActuel(tenantId: string): Promise<{ unites: number; valeur: number }> {
  const [l] = await prisma.$queryRaw<{ unites: number | null; valeur: number | null }[]>(Prisma.sql`
    SELECT SUM(s.q / s.div) AS unites, SUM(s.q * s.cout / s.div) AS valeur FROM (
      SELECT GREATEST(COALESCE((SELECT SUM(v."stock") FROM "Variante" v WHERE v."produitId" = p."id" AND v."actif"), p."stock"), 0)::float8 AS q,
        COALESCE(p."cout", 0) AS cout, CASE WHEN p."uniteVente" = 'kg' THEN 1000 ELSE 1 END AS div
      FROM "Produit" p WHERE p."tenantId" = ${tenantId} AND p."type" = 'physique' AND p."actif"
    ) s`);
  return { unites: l?.unites ?? 0, valeur: l?.valeur ?? 0 };
}

export type ProduitDormant = { produitId: string; nom: string; stock: number; valeur: number | null; derniereVente: string | null };

/**
 * Produits dormants : physiques, actifs, en stock, sans aucune vente (tous
 * canaux) depuis `jours` jours. Rend le nombre total et les `limite` plus
 * gros stocks immobilisés.
 */
export async function produitsDormants(tenantId: string, o: { jours?: number; limite?: number; voirCouts?: boolean } = {}): Promise<{ jours: number; total: number; produits: ProduitDormant[] }> {
  const jours = o.jours ?? 60;
  const depuis = new Date(Date.now() - jours * JOUR_MS);
  const where: Prisma.ProduitWhereInput = {
    tenantId, type: "physique", actif: true, stock: { gt: 0 }, createdAt: { lt: depuis },
    lignesCommande: { none: { commande: { tenantId, createdAt: { gte: depuis }, statut: { not: "annulee" } } } },
  };
  const [total, produits] = await Promise.all([
    prisma.produit.count({ where }),
    prisma.produit.findMany({ where, orderBy: { stock: "desc" }, take: Math.min(o.limite ?? 10, 50), select: { id: true, nom: true, stock: true, cout: true, uniteVente: true } }),
  ]);
  const dernieres = produits.length
    ? await prisma.$queryRaw<{ id: string; date: Date }[]>(Prisma.sql`
        SELECT lc."produitId" AS id, MAX(c."createdAt") AS date FROM "LigneCommande" lc JOIN "Commande" c ON c."id" = lc."commandeId"
        WHERE c."tenantId" = ${tenantId} AND c."statut" <> 'annulee' AND lc."produitId" IN (${Prisma.join(produits.map((p) => p.id))}) GROUP BY 1`)
    : [];
  const derniere = new Map(dernieres.map((d) => [d.id, d.date]));
  return {
    jours, total,
    produits: produits.map((p) => {
      const div = p.uniteVente === "kg" ? 1000 : 1;
      return {
        produitId: p.id, nom: p.nom, stock: p.stock / div,
        valeur: o.voirCouts && p.cout !== null ? (p.stock * p.cout) / div : null,
        derniereVente: derniere.get(p.id)?.toISOString() ?? null,
      };
    }),
  };
}
