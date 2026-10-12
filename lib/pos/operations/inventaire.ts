// Inventaires (§26) : complet, partiel, par rayon, par catégorie, par produit,
// cyclique. SERVEUR uniquement.
//
// DÉROULÉ — en_cours (on compte : scan → comptage → suivant) → a_valider (le
// comptage est clos, on relit Théorique / Compté / Écart) → valide (les écarts
// sont appliqués au stock) ou annule (rien n'est appliqué).
//
// QUANTITÉ THÉORIQUE : FIGÉE À LA PREMIÈRE LECTURE DE CHAQUE LIGNE, pas au
// démarrage. Les ventes continuent pendant qu'on compte : figer au démarrage
// ferait passer pour un manque tout ce qui se vend avant qu'on arrive au rayon.
// - À la première lecture d'un article, on note le stock du lieu à cet instant.
// - Chaque scan suivant ajoute au compté sans toucher au théorique.
// - Saisir une quantité exacte (« fixer ») est un recomptage : le théorique est
//   refigé à cet instant.
// - À la validation, on applique l'ÉCART (compté − théorique) en mouvement
//   « inventaire », jamais « stock = compté » : ce qui s'est vendu après la
//   lecture reste déduit. Un écart négatif est borné au stock présent.
// - Limite assumée : si le stock d'un article bouge ENTRE sa première lecture
//   et la fin de son comptage, on ne peut pas savoir si l'unité vendue avait
//   déjà été comptée. Ces lignes sont signalées (`mouvementsDepuis`) pour être
//   recomptées avant validation.
//
// Les articles non comptés ne sont PAS modifiés, sauf demande explicite
// (« mettre à zéro les non comptés »).
//
// UN SEUL inventaire ouvert par lieu : un article ne peut pas être dans deux
// comptages à la fois (ses écarts seraient appliqués deux fois). Plusieurs
// personnes comptent dans le même inventaire.
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { journaliserAudit, verrouBoutique } from "../audit";
import { nomsUtilisateurs } from "../caisse/mouvements";
import { resoudreCode } from "../catalogue";
import { aDroit, exigerDroit, exigerLieu, exigerUnDroit } from "../droits";
import { ErreurPos } from "../erreurs";
import { exigerStockAvance } from "../flags";
import { publierEvenement } from "../evenements";
import { avecIdempotence } from "../idempotence";
import { entrepotDuMagasin } from "../magasins";
import { mouvementStock, resoudreLieu, stocksDuLieu } from "../stock";
import { cleArticle, type ContextePos } from "../types";

type Tx = Prisma.TransactionClient;

export const TYPES_INVENTAIRE = ["complet", "partiel", "rayon", "categorie", "produit", "cyclique"] as const;
export type TypeInventaire = (typeof TYPES_INVENTAIRE)[number];

// ponytail: un inventaire prépare au plus 5 000 lignes d'un coup (une requête IN par lot d'articles) ;
// au-delà, compter par catégorie. Pour lever le plafond : créer les lignes par paquets.
const LIGNES_MAX = 5000;
// ponytail: la validation applique au plus 500 écarts dans UNE transaction (30 s, ~7 requêtes par
// mouvementStock). Au-delà : valider par catégorie, ou ajouter un mouvement de stock groupé aux fondations.
const ECARTS_MAX = 500;
const OUVERTS = ["en_cours", "a_valider"];

const id = z.string().trim().min(1).max(64);
const cle = z.string().trim().min(8).max(200);

export const schemaInventaire = z.object({
  cle,
  type: z.enum(TYPES_INVENTAIRE),
  entrepotId: id.nullish(),
  perimetre: z.object({
    /** Catégories comptées (types « categorie » et « rayon »). */
    categories: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    /** Articles comptés (types « produit » et « rayon » en liste). */
    produitIds: z.array(id).max(500).optional(),
    /** Nombre d'articles proposés (type « cyclique »). */
    nombre: z.number().int().min(1).max(500).optional(),
  }).default({}),
  notes: z.string().trim().max(500).nullish(),
});
export type DemandeInventaire = z.infer<typeof schemaInventaire>;

/** Écart d'une ligne. PURE. null tant que la ligne n'est pas comptée. */
export function ecartLigne(l: { quantiteTheorique: number; quantiteComptee: number | null }): number | null {
  return l.quantiteComptee === null ? null : l.quantiteComptee - l.quantiteTheorique;
}

/** Écart réellement applicable : un manque ne peut pas dépasser ce qui est présent dans le lieu. PURE. */
export function ecartApplicable(ecart: number, stockPresent: number): number {
  return ecart < 0 ? 0 - Math.min(-ecart, Math.max(0, stockPresent)) : ecart;
}

/**
 * Inventaire cyclique : les articles du lieu comptés depuis le plus longtemps
 * (jamais comptés d'abord), d'après les inventaires validés.
 */
export async function propositionCyclique(db: Pick<Tx, "$queryRaw">, tenantId: string, entrepotId: string, nombre: number): Promise<{ produitId: string; varianteId: string | null }[]> {
  return db.$queryRaw<{ produitId: string; varianteId: string | null }[]>`
    SELECT p."id" AS "produitId", v."id" AS "varianteId"
    FROM "Produit" p
    LEFT JOIN "Variante" v ON v."produitId" = p."id" AND v."actif" = true
    LEFT JOIN "LigneComptage" l ON l."produitId" = p."id" AND l."varianteId" IS NOT DISTINCT FROM v."id" AND l."compteAt" IS NOT NULL
      AND l."comptageId" IN (SELECT c."id" FROM "ComptageInventaire" c WHERE c."tenantId" = ${tenantId} AND c."entrepotId" = ${entrepotId} AND c."statut" = 'valide')
    WHERE p."tenantId" = ${tenantId} AND p."type" = 'physique' AND p."actif" = true
    GROUP BY p."id", p."nom", v."id"
    ORDER BY MAX(l."compteAt") ASC NULLS FIRST, p."nom" ASC
    LIMIT ${nombre}`;
}

/** Démarre un inventaire et prépare ses lignes (aucune pour un inventaire « partiel » : elles naissent au scan). */
export async function creerInventaire(ctx: ContextePos, d: DemandeInventaire): Promise<{ comptageId: string; lignes: number; rejoue: boolean }> {
  exigerDroit(ctx, "inventaire_compter");
  await exigerStockAvance(ctx.tenantId);
  const entrepotId = d.entrepotId ?? (await entrepotDuMagasin(prisma, ctx.tenantId, ctx.magasinId));
  const categories = d.perimetre.categories ?? [];
  const produitIds = d.perimetre.produitIds ?? [];
  if (d.type === "categorie" && !categories.length) throw new ErreurPos("invalide", 422, "Choisissez la ou les catégories à compter.");
  if (d.type === "produit" && !produitIds.length) throw new ErreurPos("invalide", 422, "Choisissez le ou les articles à compter.");
  if (d.type === "rayon" && !categories.length && !produitIds.length) throw new ErreurPos("invalide", 422, "Un rayon se définit par des catégories ou par une liste d'articles.");

  const { resultat, rejoue } = await avecIdempotence(ctx.tenantId, d.cle, "inventaire.demarre", async (tx) => {
    // Sous verrou de boutique : deux démarrages simultanés ne passent pas tous les deux le contrôle ci-dessous.
    await verrouBoutique(tx, ctx.tenantId);
    const lieu = await resoudreLieu(tx, ctx.tenantId, entrepotId);
    if (!lieu) throw new ErreurPos("introuvable", 404, "Aucun lieu de stock n'existe pour cette boutique.");
    await exigerLieu(tx, ctx, lieu.entrepotId);
    const ouvert = await tx.comptageInventaire.findFirst({ where: { tenantId: ctx.tenantId, entrepotId: lieu.entrepotId, statut: { in: OUVERTS } }, select: { id: true } });
    if (ouvert) throw new ErreurPos("inventaire_ouvert", 409, "Un inventaire est déjà ouvert pour ce lieu. Terminez-le ou annulez-le avant d'en démarrer un autre.", { comptageId: ouvert.id });

    let articles: { produitId: string; varianteId: string | null; stock: number }[] = [];
    if (d.type !== "partiel") {
      const cibles = d.type === "cyclique" ? await propositionCyclique(tx, ctx.tenantId, lieu.entrepotId, d.perimetre.nombre ?? 30) : null;
      const produits = await tx.produit.findMany({
        where: {
          tenantId: ctx.tenantId, type: "physique", actif: true,
          ...(cibles ? { id: { in: [...new Set(cibles.map((c) => c.produitId))] } }
            : d.type === "complet" ? {}
            : { OR: [...(categories.length ? [{ categorie: { in: categories } }] : []), ...(produitIds.length ? [{ id: { in: produitIds } }] : [])] }),
        },
        select: { id: true, stock: true, variantes: { where: { actif: true }, select: { id: true, stock: true } } },
        take: LIGNES_MAX + 1,
      });
      articles = produits.flatMap((p) => (p.variantes.length ? p.variantes.map((v) => ({ produitId: p.id, varianteId: v.id as string | null, stock: v.stock })) : [{ produitId: p.id, varianteId: null, stock: p.stock }]));
      if (cibles) articles = articles.filter((a) => cibles.some((c) => c.produitId === a.produitId && c.varianteId === a.varianteId));
      if (!articles.length) throw new ErreurPos("invalide", 422, "Aucun article physique actif ne correspond à ce périmètre.");
      if (articles.length > LIGNES_MAX) throw new ErreurPos("trop_grand", 422, `Ce périmètre dépasse ${LIGNES_MAX} articles. Comptez par catégorie ou par rayon.`);
    }
    const comptage = await tx.comptageInventaire.create({
      data: { tenantId: ctx.tenantId, entrepotId: lieu.entrepotId, type: d.type, perimetre: d.perimetre as Prisma.InputJsonValue, statut: "en_cours", creePar: ctx.userId, notes: d.notes || null },
    });
    if (articles.length) {
      // Théorique provisoire (stock au démarrage) : il sera refigé à la première lecture de la ligne.
      const stocks = await stocksDuLieu(tx, ctx.tenantId, lieu.entrepotId, articles);
      await tx.ligneComptage.createMany({
        data: articles.map((a) => ({ comptageId: comptage.id, cleArticle: cleArticle(a.produitId, a.varianteId), produitId: a.produitId, varianteId: a.varianteId, quantiteTheorique: stocks.get(cleArticle(a.produitId, a.varianteId)) ?? 0 })),
      });
    }
    await journaliserAudit(tx, ctx, { action: "inventaire.demarre", entite: "ComptageInventaire", entiteId: comptage.id, apres: { type: d.type, entrepotId: lieu.entrepotId, perimetre: d.perimetre, lignes: articles.length } });
    return { comptageId: comptage.id, lignes: articles.length };
  }, { appareilId: ctx.appareilId, userId: ctx.userId });
  return { ...resultat, rejoue };
}

/** Inventaires de la boutique, les plus récents d'abord (historique compris). */
export async function listerInventaires(ctx: ContextePos, f: { statut?: string | null; curseur?: string | null; limite?: number }) {
  const limite = Math.min(Math.max(Math.floor(f.limite ?? 20), 1), 50);
  const comptages = await prisma.comptageInventaire.findMany({
    where: { tenantId: ctx.tenantId, ...(f.statut === "ouverts" ? { statut: { in: OUVERTS } } : f.statut && f.statut !== "all" ? { statut: f.statut } : {}) },
    orderBy: [{ demarreAt: "desc" }, { id: "desc" }], take: limite + 1,
    ...(f.curseur ? { cursor: { id: f.curseur }, skip: 1 } : {}),
    include: { _count: { select: { lignes: true } } },
  });
  const page = comptages.slice(0, limite);
  const [comptees, entrepots, noms] = await Promise.all([
    prisma.ligneComptage.groupBy({ by: ["comptageId"], where: { comptageId: { in: page.map((c) => c.id) }, compteAt: { not: null } }, _count: { _all: true } }),
    prisma.entrepot.findMany({ where: { tenantId: ctx.tenantId, id: { in: [...new Set(page.map((c) => c.entrepotId))] } }, select: { id: true, nom: true } }),
    nomsUtilisateurs(ctx.tenantId, page.flatMap((c) => [c.creePar, c.validePar])),
  ]);
  return {
    inventaires: page.map((c) => ({
      id: c.id, type: c.type, statut: c.statut, entrepotId: c.entrepotId, entrepotNom: entrepots.find((e) => e.id === c.entrepotId)?.nom ?? null,
      demarreAt: c.demarreAt.toISOString(), valideAt: c.valideAt?.toISOString() ?? null, notes: c.notes,
      creePar: noms[c.creePar] ?? null, validePar: c.validePar ? noms[c.validePar] ?? null : null,
      lignes: c._count.lignes, comptees: comptees.find((x) => x.comptageId === c.id)?._count._all ?? 0,
    })),
    curseurSuivant: comptages.length > limite ? page[page.length - 1].id : null,
  };
}

/** Un inventaire, son résumé et une page de ses lignes (Théorique / Compté / Écart). */
export async function lireInventaire(ctx: ContextePos, comptageId: string, f: { q?: string | null; filtre?: string | null; curseur?: string | null; limite?: number }) {
  const comptage = await prisma.comptageInventaire.findFirst({ where: { id: comptageId, tenantId: ctx.tenantId } });
  if (!comptage) throw new ErreurPos("introuvable", 404, "Cet inventaire est introuvable dans cette boutique.");
  const limite = Math.min(Math.max(Math.floor(f.limite ?? 50), 1), 100);
  const terme = f.q?.trim().slice(0, 80);
  const where: Prisma.LigneComptageWhereInput = {
    comptageId,
    ...(f.filtre === "comptes" ? { compteAt: { not: null } } : f.filtre === "non_comptes" ? { compteAt: null } : f.filtre === "ecarts" ? { compteAt: { not: null }, ecart: { not: 0 } } : {}),
    ...(terme ? { produit: { OR: [{ nom: { contains: terme, mode: "insensitive" } }, { sku: { contains: terme, mode: "insensitive" } }, { codeBarres: { startsWith: terme } }] } } : {}),
  };
  const couts = aDroit(ctx, "voir_couts");
  const [lignes, total, comptees, enEcart, ecarts, entrepot, principal, noms] = await Promise.all([
    prisma.ligneComptage.findMany({
      where, take: limite + 1, ...(f.curseur ? { cursor: { id: f.curseur }, skip: 1 } : {}),
      // Lignes comptées le plus récemment en tête : le dernier scan est toujours visible.
      orderBy: [{ compteAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
      include: { produit: { select: { nom: true, sku: true, codeBarres: true, images: true, uniteVente: true, variantes: { select: { id: true, nom: true, valeur: true, sku: true, codeBarres: true } } } } },
    }),
    prisma.ligneComptage.count({ where: { comptageId } }),
    prisma.ligneComptage.count({ where: { comptageId, compteAt: { not: null } } }),
    prisma.ligneComptage.count({ where: { comptageId, compteAt: { not: null }, ecart: { not: 0 } } }),
    prisma.ligneComptage.findMany({ where: { comptageId, compteAt: { not: null }, ecart: { not: 0 } }, select: { ecart: true, varianteId: true, produit: { select: { cout: true, uniteVente: true, variantes: { select: { id: true, cout: true } } } } }, take: LIGNES_MAX }),
    prisma.entrepot.findFirst({ where: { id: comptage.entrepotId, tenantId: ctx.tenantId }, select: { id: true, nom: true } }),
    resoudreLieu(prisma, ctx.tenantId, comptage.entrepotId).catch(() => null),
    nomsUtilisateurs(ctx.tenantId, [comptage.creePar, comptage.validePar]),
  ]);
  const page = lignes.slice(0, limite);

  // Mouvements du lieu survenus APRÈS la première lecture de chaque ligne (inventaire encore ouvert seulement).
  const lues = page.filter((l) => l.compteAt);
  const mouvements = OUVERTS.includes(comptage.statut) && lues.length
    ? await prisma.stockMouvement.findMany({
        where: {
          tenantId: ctx.tenantId, produitId: { in: [...new Set(lues.map((l) => l.produitId))] },
          createdAt: { gt: new Date(Math.min(...lues.map((l) => l.compteAt!.getTime()))) },
          // Les mouvements d'avant le POS 2.0 n'ont pas de lieu : ils portent sur l'entrepôt principal.
          OR: [{ entrepotId: comptage.entrepotId }, ...(principal?.estPrincipal ? [{ entrepotId: null }] : [])],
        },
        select: { produitId: true, varianteId: true, stockAvant: true, stockApres: true, createdAt: true }, take: 2000,
      })
    : [];

  let plus = 0, moins = 0, valeur = 0;
  for (const e of ecarts) {
    const ecart = e.ecart ?? 0;
    if (ecart > 0) plus += ecart; else moins += ecart;
    const cout = e.produit.variantes.find((v) => v.id === e.varianteId)?.cout ?? e.produit.cout ?? 0;
    valeur += ecart * (e.produit.uniteVente === "kg" ? cout / 1000 : cout);
  }
  return {
    inventaire: {
      id: comptage.id, type: comptage.type, statut: comptage.statut, perimetre: comptage.perimetre, notes: comptage.notes,
      entrepotId: comptage.entrepotId, entrepotNom: entrepot?.nom ?? null,
      demarreAt: comptage.demarreAt.toISOString(), valideAt: comptage.valideAt?.toISOString() ?? null,
      creePar: noms[comptage.creePar] ?? null, validePar: comptage.validePar ? noms[comptage.validePar] ?? null : null,
      estCreateur: comptage.creePar === ctx.userId,
    },
    resume: { lignes: total, comptees, nonComptees: total - comptees, enEcart, ecartPlus: plus, ecartMoins: moins, valeurEcart: couts ? Math.round(valeur * 100) / 100 : null, plafondEcarts: ECARTS_MAX },
    lignes: page.map((l) => {
      const v = l.produit.variantes.find((x) => x.id === l.varianteId);
      return {
        id: l.id, produitId: l.produitId, varianteId: l.varianteId, nom: l.produit.nom, variante: v ? `${v.nom}: ${v.valeur}` : null,
        sku: v?.sku ?? l.produit.sku, codeBarres: v?.codeBarres ?? l.produit.codeBarres, image: l.produit.images[0] ?? null, uniteVente: l.produit.uniteVente,
        quantiteTheorique: l.quantiteTheorique, quantiteComptee: l.compteAt ? l.quantiteComptee : null, ecart: l.compteAt ? ecartLigne(l) : null,
        compteAt: l.compteAt?.toISOString() ?? null,
        mouvementsDepuis: l.compteAt ? mouvements.filter((m) => m.produitId === l.produitId && (m.varianteId ?? null) === l.varianteId && m.createdAt > l.compteAt!).reduce((s, m) => s + (m.stockApres - m.stockAvant), 0) : 0,
      };
    }),
    curseurSuivant: lignes.length > limite ? page[page.length - 1].id : null,
  };
}

export const schemaComptage = z.object({
  cle,
  /** Code lu (code-barres, SKU, numéro de série, étiquette de balance)… */
  code: z.string().trim().min(1).max(128).nullish(),
  /** …ou article choisi à la main. */
  produitId: id.nullish(),
  varianteId: id.nullish(),
  /** Pièces (grammes pour un article au poids). « ajouter » : s'ajoute au compté (négatif = corriger un scan en trop). « fixer » : quantité exacte. */
  quantite: z.number().int().min(-1_000_000).max(10_000_000).nullish(),
  mode: z.enum(["ajouter", "fixer"]).default("ajouter"),
});
export type DemandeComptage = z.infer<typeof schemaComptage>;

export type LigneComptee = {
  ligneId: string; produitId: string; varianteId: string | null; nom: string; variante: string | null; image: string | null; uniteVente: string;
  quantiteTheorique: number; quantiteComptee: number; ecart: number; ajoute: number;
};

/** Compte un article dans un inventaire en cours (scan ou saisie). Idempotent par clé : un scan renvoyé ne compte pas deux fois. */
export async function compterArticle(ctx: ContextePos, comptageId: string, d: DemandeComptage): Promise<LigneComptee & { rejoue: boolean }> {
  exigerDroit(ctx, "inventaire_compter");
  let produitId = d.produitId ?? null, varianteId = d.varianteId ?? null, poids: number | null = null;
  if (!produitId) {
    if (!d.code) throw new ErreurPos("invalide", 400, "Scannez un article ou choisissez-le dans la liste.");
    const article = await resoudreCode(ctx.tenantId, d.code);
    if (!article) throw new ErreurPos("inconnu", 404, `Aucun article ne porte le code ${d.code} dans cette boutique.`, { code: d.code });
    produitId = article.produitId; varianteId = article.varianteId; poids = article.poidsGrammes ?? null;
  }
  const quantite = d.quantite ?? poids ?? 1;
  if (d.mode === "fixer" && quantite < 0) throw new ErreurPos("invalide", 400, "La quantité comptée ne peut pas être négative.");
  if (d.mode === "ajouter" && quantite === 0) throw new ErreurPos("invalide", 400, "Indiquez une quantité à ajouter.");

  const { resultat, rejoue } = await avecIdempotence<LigneComptee>(ctx.tenantId, d.cle, "inventaire.comptage", async (tx) => {
    // Verrou partagé sur l'inventaire : plusieurs personnes comptent en même temps, mais la clôture attend la fin des comptages en cours.
    const ouverts = await tx.$queryRaw<{ entrepotId: string }[]>`SELECT "entrepotId" FROM "ComptageInventaire" WHERE "id" = ${comptageId} AND "tenantId" = ${ctx.tenantId} AND "statut" = 'en_cours' FOR SHARE`;
    if (!ouverts.length) {
      const existe = await tx.comptageInventaire.findFirst({ where: { id: comptageId, tenantId: ctx.tenantId }, select: { statut: true } });
      if (!existe) throw new ErreurPos("introuvable", 404, "Cet inventaire est introuvable dans cette boutique.");
      throw new ErreurPos("conflit", 409, "Cet inventaire n'est plus en cours de comptage. Rouvrez-le pour continuer à compter.");
    }
    const entrepotId = ouverts[0].entrepotId;
    await exigerLieu(tx, ctx, entrepotId);
    const produit = await tx.produit.findFirst({
      where: { id: produitId!, tenantId: ctx.tenantId },
      select: { id: true, nom: true, type: true, stock: true, images: true, uniteVente: true, variantes: { where: { actif: true }, select: { id: true, nom: true, valeur: true, stock: true } } },
    });
    if (!produit) throw new ErreurPos("introuvable", 404, "Cet article est introuvable dans cette boutique.");
    if (produit.type !== "physique") throw new ErreurPos("invalide", 400, `« ${produit.nom} » n'a pas de stock suivi : il ne se compte pas.`);
    const variante = varianteId ? produit.variantes.find((v) => v.id === varianteId) ?? null : null;
    if (varianteId && !variante) throw new ErreurPos("introuvable", 404, `Cette variante de « ${produit.nom} » est introuvable.`);
    if (!variante && produit.variantes.length) {
      throw new ErreurPos("variante_requise", 422, `« ${produit.nom} » a des variantes : choisissez celle que vous comptez.`, { produitId: produit.id, variantes: produit.variantes.map((v) => ({ id: v.id, libelle: `${v.nom}: ${v.valeur}` })) });
    }
    const cleA = cleArticle(produit.id, variante?.id);
    const ici = (await stocksDuLieu(tx, ctx.tenantId, entrepotId, [{ produitId: produit.id, varianteId: variante?.id ?? null, stock: variante ? variante.stock : produit.stock }])).get(cleA) ?? 0;
    const maintenant = new Date();
    const premiere = { quantiteTheorique: ici, quantiteComptee: quantite, comptePar: ctx.userId, compteAt: maintenant };
    const cible = { comptageId, cleArticle: cleA };

    const appliquer = async (): Promise<boolean> => {
      // 1. Première lecture d'une ligne préparée (ou recomptage exact) : le théorique est figé maintenant.
      const fige = await tx.ligneComptage.updateMany({ where: { ...cible, ...(d.mode === "fixer" ? {} : { compteAt: null }) }, data: premiere });
      if (fige.count) return true;
      if (d.mode === "fixer") return false;
      // 2. Lecture suivante : on ajoute, le théorique ne bouge plus.
      const ajoute = await tx.ligneComptage.updateMany({ where: { ...cible, quantiteComptee: { gte: -quantite } }, data: { quantiteComptee: { increment: quantite }, comptePar: ctx.userId } });
      return ajoute.count > 0;
    };
    if (quantite < 0 && d.mode === "ajouter" && !(await tx.ligneComptage.count({ where: { ...cible, compteAt: { not: null }, quantiteComptee: { gte: -quantite } } }))) {
      throw new ErreurPos("invalide", 409, `On ne peut pas retirer ${-quantite} : « ${produit.nom} » n'a pas été compté autant.`);
    }
    if (!(await appliquer())) {
      // 3. Article hors des lignes préparées (inventaire partiel, article trouvé dans le rayon) : la ligne naît ici.
      //    skipDuplicates : si un autre scan vient de la créer, on retombe sur l'étape 2.
      const cree = await tx.ligneComptage.createMany({ data: [{ ...cible, produitId: produit.id, varianteId: variante?.id ?? null, ...premiere }], skipDuplicates: true });
      if (!cree.count && !(await appliquer())) throw new ErreurPos("conflit", 409, "Ce comptage n'a pas pu être enregistré. Réessayez.");
    }
    // La ligne est verrouillée par l'écriture ci-dessus : l'écart relu ici est exact.
    const ligne = await tx.ligneComptage.findUniqueOrThrow({ where: { comptageId_cleArticle: cible } });
    const ecart = (ligne.quantiteComptee ?? 0) - ligne.quantiteTheorique;
    await tx.ligneComptage.update({ where: { id: ligne.id }, data: { ecart } });
    return {
      ligneId: ligne.id, produitId: produit.id, varianteId: variante?.id ?? null, nom: produit.nom, variante: variante ? `${variante.nom}: ${variante.valeur}` : null,
      image: produit.images[0] ?? null, uniteVente: produit.uniteVente,
      quantiteTheorique: ligne.quantiteTheorique, quantiteComptee: ligne.quantiteComptee ?? 0, ecart, ajoute: quantite,
    };
  }, { appareilId: ctx.appareilId, userId: ctx.userId });
  return { ...resultat, rejoue };
}

export const schemaActionInventaire = z.object({
  cle,
  action: z.enum(["cloturer", "rouvrir", "zero_non_comptes", "valider", "annuler"]),
  motif: z.string().trim().max(300).nullish(),
});
export type ActionInventaire = z.infer<typeof schemaActionInventaire>;

export type ResultatInventaire = {
  comptageId: string; statut: string;
  /** Validation : nombre de lignes dont l'écart a modifié le stock. */
  appliquees: number;
  /** Validation : manques bornés au stock présent (le stock avait baissé depuis le comptage). */
  plafonnees: { nom: string; ecart: number; applique: number }[];
  /** Validation : lignes laissées de côté (article supprimé depuis). */
  ignorees: number;
  /** Mise à zéro : nombre de lignes passées à zéro. */
  misesAZero: number;
};

/** Fait avancer un inventaire : clôturer, rouvrir, mettre à zéro les non comptés, valider (applique les écarts), annuler. */
export async function actionInventaire(ctx: ContextePos, comptageId: string, d: ActionInventaire): Promise<ResultatInventaire & { rejoue: boolean }> {
  if (d.action === "valider" || d.action === "zero_non_comptes") exigerDroit(ctx, "inventaire_valider");
  else exigerUnDroit(ctx, "inventaire_compter", "inventaire_valider");

  const { resultat, rejoue } = await avecIdempotence<ResultatInventaire>(ctx.tenantId, d.cle, `inventaire.${d.action}`, async (tx) => {
    const comptage = await tx.comptageInventaire.findFirst({ where: { id: comptageId, tenantId: ctx.tenantId } });
    if (!comptage) throw new ErreurPos("introuvable", 404, "Cet inventaire est introuvable dans cette boutique.");
    await exigerLieu(tx, ctx, comptage.entrepotId);
    const vide: ResultatInventaire = { comptageId, statut: comptage.statut, appliquees: 0, plafonnees: [], ignorees: 0, misesAZero: 0 };
    /** Bascule de statut conditionnelle : verrouille l'inventaire et écarte une demande concurrente. */
    const basculer = async (depuis: string[], vers: string, plus: Prisma.ComptageInventaireUpdateManyMutationInput = {}) => {
      const r = await tx.comptageInventaire.updateMany({ where: { id: comptageId, tenantId: ctx.tenantId, statut: { in: depuis } }, data: { statut: vers, ...plus } });
      if (!r.count) throw new ErreurPos("conflit", 409, comptage.statut === "valide" ? "Cet inventaire a déjà été validé. Rien n'a été modifié." : comptage.statut === "annule" ? "Cet inventaire a été annulé." : "L'état de cet inventaire a changé. Rechargez la page.");
    };

    if (d.action === "cloturer") {
      await basculer(["en_cours"], "a_valider");
      if (!(await tx.ligneComptage.count({ where: { comptageId, compteAt: { not: null } } }))) throw new ErreurPos("invalide", 422, "Aucun article n'a encore été compté dans cet inventaire.");
      await journaliserAudit(tx, ctx, { action: "inventaire.cloture", entite: "ComptageInventaire", entiteId: comptageId, avant: { statut: "en_cours" }, apres: { statut: "a_valider" } });
      return { ...vide, statut: "a_valider" };
    }
    if (d.action === "rouvrir") {
      await basculer(["a_valider"], "en_cours");
      await journaliserAudit(tx, ctx, { action: "inventaire.rouvert", entite: "ComptageInventaire", entiteId: comptageId, avant: { statut: "a_valider" }, apres: { statut: "en_cours" }, motif: d.motif || null });
      return { ...vide, statut: "en_cours" };
    }
    if (d.action === "annuler") {
      // Celui qui a démarré l'inventaire peut l'abandonner tant qu'il compte ; sinon il faut le droit de valider.
      if (!aDroit(ctx, "inventaire_valider") && !(comptage.creePar === ctx.userId && comptage.statut === "en_cours")) exigerDroit(ctx, "inventaire_valider");
      await basculer(OUVERTS, "annule");
      await journaliserAudit(tx, ctx, { action: "inventaire.annule", entite: "ComptageInventaire", entiteId: comptageId, avant: { statut: comptage.statut }, apres: { statut: "annule" }, motif: d.motif || null });
      return { ...vide, statut: "annule" };
    }
    if (d.action === "zero_non_comptes") {
      await basculer(OUVERTS, comptage.statut); // verrou, sans changer d'état
      // « Il n'y en a aucun » : compté 0 contre le théorique noté au démarrage (le manque sera borné au stock présent à la validation).
      const misesAZero = await tx.$executeRaw`UPDATE "LigneComptage" SET "quantiteComptee" = 0, "ecart" = -"quantiteTheorique", "compteAt" = NOW(), "comptePar" = ${ctx.userId} WHERE "comptageId" = ${comptageId} AND "compteAt" IS NULL`;
      await journaliserAudit(tx, ctx, { action: "inventaire.non_comptes_a_zero", entite: "ComptageInventaire", entiteId: comptageId, apres: { lignes: misesAZero }, motif: d.motif || null });
      return { ...vide, misesAZero };
    }

    // ── Validation : applique les écarts, une seule fois. ──
    await basculer(["a_valider"], "valide", { validePar: ctx.userId, valideAt: new Date() });
    const lieu = await resoudreLieu(tx, ctx.tenantId, comptage.entrepotId);
    const lignes = await tx.ligneComptage.findMany({ where: { comptageId, compteAt: { not: null } }, select: { id: true, produitId: true, varianteId: true, quantiteTheorique: true, quantiteComptee: true } });
    const enEcart = lignes.filter((l) => (ecartLigne(l) ?? 0) !== 0);
    if (enEcart.length > ECARTS_MAX) throw new ErreurPos("trop_grand", 422, `Cet inventaire compte ${enEcart.length} écarts : au-delà de ${ECARTS_MAX}, validez par catégorie (un inventaire par rayon).`);
    const produits = await tx.produit.findMany({
      where: { tenantId: ctx.tenantId, type: "physique", id: { in: [...new Set(enEcart.map((l) => l.produitId))] } },
      select: { id: true, nom: true, stock: true, variantes: { select: { id: true, stock: true } } },
    });
    const connus = enEcart.flatMap((l) => {
      const p = produits.find((x) => x.id === l.produitId);
      const v = l.varianteId ? p?.variantes.find((x) => x.id === l.varianteId) : null;
      return !p || (l.varianteId && !v) || (!l.varianteId && p.variantes.length) ? [] : [{ ...l, nom: p.nom, stock: v ? v.stock : p.stock }];
    });
    const presents = lieu ? await stocksDuLieu(tx, ctx.tenantId, lieu.entrepotId, connus) : new Map<string, number>();
    const plafonnees: ResultatInventaire["plafonnees"] = [];
    let appliquees = 0, plus = 0, moins = 0;
    const date = comptage.demarreAt.toISOString().slice(0, 10);
    for (const l of connus) {
      const ecart = ecartLigne(l) ?? 0;
      const applique = ecartApplicable(ecart, lieu ? presents.get(cleArticle(l.produitId, l.varianteId)) ?? 0 : l.stock);
      if (applique !== ecart) plafonnees.push({ nom: l.nom, ecart, applique });
      if (applique === 0) continue;
      // Une vente passée entre la lecture ci-dessus et ce mouvement lève « stock_insuffisant » : toute la validation est annulée, à relancer.
      await mouvementStock(tx, { tenantId: ctx.tenantId, produitId: l.produitId, varianteId: l.varianteId, lieu, type: "inventaire", quantite: applique, motif: `Inventaire du ${date}`, refs: { comptageId }, creePar: ctx.userId });
      appliquees++;
      if (applique > 0) plus += applique; else moins += applique;
    }
    await journaliserAudit(tx, ctx, {
      action: "inventaire.valide", entite: "ComptageInventaire", entiteId: comptageId, motif: d.motif || null,
      avant: { statut: "a_valider" }, apres: { statut: "valide", lignesComptees: lignes.length, ecartsAppliques: appliquees, ecartPlus: plus, ecartMoins: moins, plafonnees: plafonnees.length, ignorees: enEcart.length - connus.length },
    });
    if (appliquees) await publierEvenement(tx, { tenantId: ctx.tenantId, magasinId: ctx.magasinId, type: "inventory.updated", payload: { origine: "inventaire", comptageId, produitIds: [...new Set(connus.map((l) => l.produitId))].slice(0, 200) } });
    return { comptageId, statut: "valide", appliquees, plafonnees: plafonnees.slice(0, 20), ignorees: enEcart.length - connus.length, misesAZero: 0 };
  }, { appareilId: ctx.appareilId, userId: ctx.userId });
  return { ...resultat, rejoue };
}
