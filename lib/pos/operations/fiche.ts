// Fiche produit universelle (§10) et états du stock par lieu (§27). SERVEUR uniquement.
//
// - `ficheProduit` : tout ce qu'on sait d'un article, en un appel — prix, coût
//   et marge (masqués sans le droit « voir_couts »), stock par lieu, ventes,
//   fournisseur, promotions, lots, numéros de série, variantes. Les écrans
//   « contrôle prix » et « contrôle stock » en sont des vues réduites.
// - `CHAMPS_PAR_COMMERCE` : ce que la fiche montre selon le type de commerce.
// - `etatsStock` : les 7 états (physique, réservé, bloqué, endommagé,
//   disponible, en transit, en commande) de PLUSIEURS articles en 4 requêtes.
//   Mêmes règles que `disponibilite` (lib/pos/stock.ts), qui ne traite qu'un
//   article à la fois : l'écran de stock ne peut pas l'appeler 40 fois par page.
// - `deplacerEtat` : met des unités en « bloqué » ou « endommagé » dans un lieu
//   (elles restent dans le stock physique, mais ne sont plus vendables).
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../prisma";
import { aDroit } from "../droits";
import { ErreurPos } from "../erreurs";
import { lireReglagesPos } from "../flags";
import { resoudreCode } from "../catalogue";
import { entrepotDuMagasin, entrepotPrincipal } from "../magasins";
import { promotionsActives } from "../promotions";
import { disponibilite, stocksDuLieu, type Disponibilite } from "../stock";
import { cleArticle, TYPES_COMMERCE, type ContextePos, type TypeCommerce } from "../types";
import { etatLot } from "./lots";

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaClient;

// ─── Champs selon le type de commerce ─────────────────────────────────────────

export type ChampsFiche = { lots: boolean; series: boolean; variantes: boolean; poids: boolean; fournisseur: boolean };

/**
 * Blocs de la fiche mis en avant pour chaque type de commerce. Un bloc éteint
 * ici s'affiche quand même si l'article porte la donnée (un lot enregistré, un
 * suivi par numéro de série, des variantes) : la table décide de ce qu'on
 * montre VIDE, jamais de ce qu'on cache.
 */
export const CHAMPS_PAR_COMMERCE: Record<TypeCommerce, ChampsFiche> = {
  RETAIL:      { lots: false, series: false, variantes: true,  poids: false, fournisseur: true },
  SUPERMARKET: { lots: true,  series: false, variantes: false, poids: true,  fournisseur: true },
  WHOLESALE:   { lots: true,  series: false, variantes: false, poids: true,  fournisseur: true },
  FASHION:     { lots: false, series: false, variantes: true,  poids: false, fournisseur: true },
  ELECTRONICS: { lots: false, series: true,  variantes: true,  poids: false, fournisseur: true },
  PHARMACY:    { lots: true,  series: false, variantes: false, poids: false, fournisseur: true },
  RESTAURANT:  { lots: true,  series: false, variantes: true,  poids: true,  fournisseur: false },
  GROCERY:     { lots: true,  series: false, variantes: false, poids: true,  fournisseur: true },
  HARDWARE:    { lots: false, series: true,  variantes: true,  poids: true,  fournisseur: true },
  SERVICES:    { lots: false, series: false, variantes: true,  poids: false, fournisseur: false },
};

/** Champs d'une fiche : ceux du type de commerce, plus ceux que l'article impose par ses données. PURE. */
export function champsFiche(type: string | null | undefined, article: { lots: number; suiviSerie: boolean; variantes: number; auPoids: boolean }): ChampsFiche {
  const base = CHAMPS_PAR_COMMERCE[(TYPES_COMMERCE as readonly string[]).includes(type ?? "") ? (type as TypeCommerce) : "RETAIL"];
  return {
    lots: base.lots || article.lots > 0,
    series: base.series || article.suiviSerie,
    variantes: article.variantes > 0, // un bloc « variantes » vide n'apprend rien
    poids: base.poids || article.auPoids,
    fournisseur: base.fournisseur,
  };
}

/** Marge unitaire et taux de marge sur le prix de vente. PURE. null si le coût est inconnu. */
export function margeArticle(prix: number, cout: number | null | undefined): { marge: number | null; margePct: number | null } {
  if (cout === null || cout === undefined) return { marge: null, margePct: null };
  const marge = Math.round((prix - cout) * 100) / 100;
  return { marge, margePct: prix > 0 ? Math.round((marge / prix) * 1000) / 10 : null };
}

// ─── Lieux ────────────────────────────────────────────────────────────────────

export type LieuBoutique = { id: string; nom: string; principal: boolean; actif: boolean; magasins: string[] };

/** Entrepôts de la boutique (le principal d'abord) avec les magasins qui y vendent. */
export async function lieuxBoutique(tenantId: string): Promise<LieuBoutique[]> {
  const [entrepots, principal] = await Promise.all([
    prisma.entrepot.findMany({
      where: { tenantId }, orderBy: [{ principal: "desc" }, { createdAt: "asc" }],
      select: { id: true, nom: true, actif: true, magasins: { where: { actif: true }, select: { nom: true } } },
    }),
    entrepotPrincipal(prisma, tenantId),
  ]);
  // « Principal » au sens du stock (entrepotPrincipal) : marqué tel, sinon le plus ancien actif.
  return entrepots
    .map((e) => ({ id: e.id, nom: e.nom, principal: e.id === principal?.id, actif: e.actif, magasins: e.magasins.map((m) => m.nom) }))
    .sort((a, b) => Number(b.principal) - Number(a.principal));
}

// ─── États du stock, par lots d'articles ──────────────────────────────────────

export type ArticleStock = { produitId: string; varianteId?: string | null; stock: number; stockReserve?: number };
type LigneLieu = { entrepotId: string; quantite: number; bloque: number; endommage: number };

/**
 * Les 7 états d'un article, dans un entrepôt ou pour toute la boutique. PURE —
 * même règle que `disponibilite` : le principal est un reliquat (total moins
 * les autres entrepôts), le réservé de la vitrine ne pèse que sur le total et
 * sur le principal, et jamais sur une variante.
 */
export function calculerEtats(p: {
  total: number; stockReserve: number; estVariante: boolean; lignes: LigneLieu[];
  principalId: string | null; entrepotId: string | null; enTransit: number; enCommande: number;
}): Disponibilite {
  const ici = p.entrepotId ? p.lignes.filter((l) => l.entrepotId === p.entrepotId) : p.lignes;
  const somme = (ls: LigneLieu[], f: (l: LigneLieu) => number) => ls.reduce((s, l) => s + f(l), 0);
  const estPrincipal = !!p.entrepotId && p.principalId === p.entrepotId;
  const physique = !p.entrepotId ? p.total
    : estPrincipal ? p.total - somme(p.lignes.filter((l) => l.entrepotId !== p.entrepotId), (l) => l.quantite)
    : somme(ici, (l) => l.quantite);
  const reserve = p.estVariante || (p.entrepotId && !estPrincipal) ? 0 : p.stockReserve;
  const bloque = somme(ici, (l) => l.bloque);
  const endommage = somme(ici, (l) => l.endommage);
  return { physique, reserve, bloque, endommage, disponible: Math.max(0, physique - reserve - bloque - endommage), enTransit: p.enTransit, enCommande: p.enCommande };
}

/** États de plusieurs articles (clé = cleArticle), pour un entrepôt ou pour toute la boutique. */
export async function etatsStock(db: Db, tenantId: string, articles: ArticleStock[], entrepotId?: string | null): Promise<Map<string, Disponibilite>> {
  const resultat = new Map<string, Disponibilite>();
  if (!articles.length) return resultat;
  const produitIds = [...new Set(articles.map((a) => a.produitId))];
  const [principal, lignes, transit, commande] = await Promise.all([
    entrepotPrincipal(db, tenantId),
    db.stockEntrepot.findMany({
      where: { produitId: { in: produitIds }, entrepot: { tenantId } },
      select: { entrepotId: true, produitId: true, varianteId: true, quantite: true, bloque: true, endommage: true },
    }),
    db.ligneTransfert.findMany({
      where: { produitId: { in: produitIds }, transfert: { tenantId, statut: { in: ["expedie", "partiellement_recu"] }, ...(entrepotId ? { entrepotDestinationId: entrepotId } : {}) } },
      select: { cleArticle: true, quantiteExpediee: true, quantiteRecue: true },
    }),
    db.ligneBonCommande.findMany({
      where: { produitId: { in: produitIds }, bonCommande: { tenantId, statut: { in: ["envoye", "confirme", "partiellement_recu"] }, ...(entrepotId ? { entrepotId } : {}) } },
      select: { produitId: true, varianteId: true, quantite: true, quantiteRecue: true },
    }),
  ]);
  for (const a of articles) {
    const cle = cleArticle(a.produitId, a.varianteId);
    resultat.set(cle, calculerEtats({
      total: a.stock, stockReserve: a.stockReserve ?? 0, estVariante: !!a.varianteId,
      lignes: lignes.filter((l) => cleArticle(l.produitId, l.varianteId) === cle),
      principalId: principal?.id ?? null, entrepotId: entrepotId ?? null,
      enTransit: transit.filter((l) => l.cleArticle === cle).reduce((s, l) => s + Math.max(0, l.quantiteExpediee - l.quantiteRecue), 0),
      enCommande: commande.filter((l) => cleArticle(l.produitId, l.varianteId) === cle).reduce((s, l) => s + Math.max(0, l.quantite - l.quantiteRecue), 0),
    }));
  }
  return resultat;
}

const ZERO: Disponibilite = { physique: 0, reserve: 0, bloque: 0, endommage: 0, disponible: 0, enTransit: 0, enCommande: 0 };

/** Somme d'états (article à variantes : le produit vaut la somme de ses variantes). PURE. */
export function sommerEtats(etats: (Disponibilite | undefined)[]): Disponibilite {
  return etats.reduce<Disponibilite>((s, e) => (e ? {
    physique: s.physique + e.physique, reserve: s.reserve + e.reserve, bloque: s.bloque + e.bloque, endommage: s.endommage + e.endommage,
    disponible: s.disponible + e.disponible, enTransit: s.enTransit + e.enTransit, enCommande: s.enCommande + e.enCommande,
  } : s), ZERO);
}

/**
 * Verrouille la ligne de l'article (les mouvements d'un même article se suivent,
 * comme dans mouvementStock) et rend son stock total. À appeler en tête d'une
 * transaction qui lit le stock avant de l'écrire.
 */
export async function verrouillerArticle(tx: Tx, tenantId: string, produitId: string, varianteId?: string | null): Promise<{ nom: string; stock: number; uniteVente: string }> {
  const produit = await tx.produit.findFirst({ where: { id: produitId, tenantId }, select: { nom: true, type: true, uniteVente: true, _count: { select: { variantes: { where: { actif: true } } } } } });
  if (!produit) throw new ErreurPos("introuvable", 404, "Ce produit est introuvable dans cette boutique.");
  if (produit.type !== "physique") throw new ErreurPos("invalide", 400, `« ${produit.nom} » n'a pas de stock suivi.`);
  if (!varianteId && produit._count.variantes) throw new ErreurPos("variante_requise", 422, `« ${produit.nom} » a des variantes : choisissez laquelle.`, { produitId });
  if (varianteId) {
    const touche = await tx.variante.updateMany({ where: { id: varianteId, produitId }, data: { stock: { increment: 0 } } });
    if (!touche.count) throw new ErreurPos("introuvable", 404, `Cette variante de « ${produit.nom} » est introuvable.`);
    const v = await tx.variante.findUniqueOrThrow({ where: { id: varianteId }, select: { stock: true, nom: true, valeur: true } });
    return { nom: `${produit.nom} (${v.nom}: ${v.valeur})`, stock: v.stock, uniteVente: produit.uniteVente };
  }
  await tx.produit.updateMany({ where: { id: produitId, tenantId }, data: { stock: { increment: 0 } } });
  const p = await tx.produit.findUniqueOrThrow({ where: { id: produitId }, select: { stock: true } });
  return { nom: produit.nom, stock: p.stock, uniteVente: produit.uniteVente };
}

/**
 * Ajoute (delta > 0) ou retire (delta < 0) des unités de l'état « bloqué » ou
 * « endommagé » d'un lieu. Le stock physique ne change pas : seul le disponible
 * bouge. Refuse de bloquer plus que ce qui est physiquement là. `souple` :
 * borne au lieu de refuser (blocage d'un lot dont une partie est déjà sortie).
 * L'article doit avoir été verrouillé (verrouillerArticle) par l'appelant.
 */
export async function deplacerEtat(tx: Tx, p: { tenantId: string; entrepotId: string; produitId: string; varianteId?: string | null; stock: number; champ: "bloque" | "endommage"; delta: number; souple?: boolean; nom?: string }): Promise<{ bloque: number; endommage: number; physique: number }> {
  const varianteId = p.varianteId ?? null;
  const physique = (await stocksDuLieu(tx, p.tenantId, p.entrepotId, [{ produitId: p.produitId, varianteId, stock: p.stock }])).get(cleArticle(p.produitId, varianteId)) ?? 0;
  const ligne = await tx.stockEntrepot.findFirst({ where: { entrepotId: p.entrepotId, produitId: p.produitId, varianteId, entrepot: { tenantId: p.tenantId } } });
  const avant = { bloque: ligne?.bloque ?? 0, endommage: ligne?.endommage ?? 0 };
  let delta = p.delta;
  if (delta > 0) {
    const libre = Math.max(0, physique - avant.bloque - avant.endommage);
    if (delta > libre) {
      if (!p.souple) throw new ErreurPos("stock_insuffisant", 409, `Il n'y a que ${libre} unité(s) libre(s) de « ${p.nom ?? "cet article"} » dans ce lieu.`, { libre });
      delta = libre;
    }
  } else if (-delta > avant[p.champ]) {
    if (!p.souple) throw new ErreurPos("invalide", 409, `Seules ${avant[p.champ]} unité(s) de « ${p.nom ?? "cet article"} » sont dans cet état dans ce lieu.`, { present: avant[p.champ] });
    delta = -avant[p.champ];
  }
  const apres = { ...avant, [p.champ]: avant[p.champ] + delta };
  if (delta !== 0) {
    if (ligne) await tx.stockEntrepot.update({ where: { id: ligne.id }, data: { [p.champ]: apres[p.champ] } });
    // Lieu sans ligne (entrepôt principal jamais ventilé) : la ligne naît avec la quantité réellement présente.
    else await tx.stockEntrepot.create({ data: { entrepotId: p.entrepotId, produitId: p.produitId, varianteId, quantite: physique, [p.champ]: apres[p.champ] } });
  }
  return { ...apres, physique };
}

// ─── Fiche ────────────────────────────────────────────────────────────────────

export type VentesPeriode = { quantite: number; montant: number };
export type LotFiche = { id: string; codeLot: string; quantiteRestante: number; dateExpiration: string | null; statut: string; etat: string; joursRestants: number | null; cout: number | null; entrepotId: string | null };
export type SerieFiche = { id: string; numero: string; statut: string; varianteId: string | null; garantieFinAt: string | null; venduAt: string | null; client: string | null };
export type FicheProduit = {
  produitId: string; varianteId: string | null; nom: string; variante: string | null; image: string | null;
  sku: string | null; codeBarres: string | null; categorie: string | null; marque: string | null;
  uniteVente: "piece" | "kg"; actif: boolean; suiviSerie: boolean; garantieMois: number | null; stockMin: number | null;
  typeCommerce: string; champs: ChampsFiche; devise: string;
  prix: number;
  /** false : la personne n'a pas le droit « voir_couts » — coût, marge et prix d'achat sont alors null. */
  coutsVisibles: boolean;
  prixAchat: number | null; marge: number | null; margePct: number | null;
  stock: { total: Disponibilite; lieux: (LieuBoutique & Disponibilite & { courant: boolean })[] };
  ventes: { aujourdhui: VentesPeriode; jours7: VentesPeriode; jours30: VentesPeriode };
  fournisseur: { id: string | null; nom: string; principal: boolean; prix: number | null; devise: string | null; moq: number | null; delaiJours: number | null } | null;
  dernierAchat: { cout: number; quantite: number; date: string } | null;
  promotions: { id: string; nom: string; type: string; valeur: number | null }[];
  lots: LotFiche[]; seuilExpirationJours: number;
  series: { compte: Record<string, number>; liste: SerieFiche[]; scanne: SerieFiche | null };
  variantes: { id: string; libelle: string; sku: string | null; codeBarres: string | null; prix: number; cout: number | null; marge: number | null; margePct: number | null; stock: number; stockLieu: number | null; actif: boolean }[];
  /** Poids lu sur une étiquette de balance, en grammes. */
  poidsGrammes: number | null;
};

const LIEUX_MAX = 12;

/** Une promotion vise-t-elle cet article ? Même ciblage direct que le moteur (produits, variantes, catégories) ; sans cible, elle vaut pour tout. */
function promotionVise(regles: Record<string, unknown>, a: { produitId: string; varianteId: string | null; categorie: string | null }): boolean {
  const liste = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const produits = liste(regles.produitIds), variantes = liste(regles.varianteIds), categories = liste(regles.categories).map((c) => c.trim().toLowerCase());
  if (produits.length && !produits.includes(a.produitId)) return false;
  if (variantes.length && a.varianteId && !variantes.includes(a.varianteId)) return false;
  if (categories.length && !categories.includes((a.categorie ?? "").trim().toLowerCase())) return false;
  return true;
}

/**
 * Fiche d'un article, désigné par un code lu (code-barres, SKU, numéro de
 * série, étiquette de balance) ou par ses identifiants. 404 « inconnu » si le
 * code ne correspond à rien dans la boutique.
 */
export async function ficheProduit(ctx: ContextePos, p: { code?: string | null; produitId?: string | null; varianteId?: string | null }): Promise<FicheProduit> {
  let produitId = p.produitId ?? null, varianteId = p.varianteId ?? null, numeroSerieId: string | null = null, poidsGrammes: number | null = null;
  if (!produitId) {
    const code = p.code?.trim();
    if (!code) throw new ErreurPos("invalide", 400, "Scannez un article ou saisissez son code.");
    const article = await resoudreCode(ctx.tenantId, code, { magasinId: ctx.magasinId });
    if (!article) throw new ErreurPos("inconnu", 404, `Aucun article ne porte le code ${code} dans cette boutique.`, { code });
    produitId = article.produitId; varianteId = article.varianteId; numeroSerieId = article.numeroSerieId ?? null; poidsGrammes = article.poidsGrammes ?? null;
  }

  const [produit, tenant, reglages, magasin, lieux] = await Promise.all([
    prisma.produit.findFirst({
      where: { id: produitId, tenantId: ctx.tenantId },
      select: {
        id: true, nom: true, prix: true, cout: true, stock: true, stockReserve: true, stockMin: true, sku: true, codeBarres: true, images: true,
        categorie: true, marque: true, uniteVente: true, actif: true, suiviSerie: true, garantieMois: true, type: true,
        nomFournisseur: true, prixFournisseur: true,
        fournisseur: { select: { id: true, nom: true, delaiLivraison: true } },
        variantes: { orderBy: [{ nom: "asc" }, { valeur: "asc" }], select: { id: true, nom: true, valeur: true, prix: true, cout: true, stock: true, sku: true, codeBarres: true, image: true, actif: true } },
      },
    }),
    prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { devise: true } }),
    lireReglagesPos(ctx.tenantId),
    prisma.magasin.findFirst({ where: { id: ctx.magasinId, tenantId: ctx.tenantId }, select: { typeCommerce: true } }),
    lieuxBoutique(ctx.tenantId),
  ]);
  if (!produit) throw new ErreurPos("introuvable", 404, "Cet article est introuvable dans cette boutique.");
  const variante = varianteId ? produit.variantes.find((v) => v.id === varianteId) ?? null : null;
  if (varianteId && !variante) throw new ErreurPos("introuvable", 404, `Cette variante de « ${produit.nom} » est introuvable.`);
  const actives = produit.variantes.filter((v) => v.actif);
  // Article « simple » : le produit sans variante, ou une variante précise. Sinon la fiche additionne les variantes.
  const simple = !!variante || !actives.length;
  const lieuCourant = await entrepotDuMagasin(prisma, ctx.tenantId, ctx.magasinId);
  const lieuxActifs = lieux.filter((l) => l.actif).slice(0, LIEUX_MAX);
  const coutsVisibles = aDroit(ctx, "voir_couts");
  const prix = variante?.prix ?? produit.prix;
  const cout = variante?.cout ?? produit.cout;
  const maintenant = new Date();
  const debutJour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const ilYA = (jours: number) => new Date(maintenant.getTime() - jours * 86_400_000);

  const articles: ArticleStock[] = simple
    ? [{ produitId: produit.id, varianteId: variante?.id ?? null, stock: variante ? variante.stock : produit.stock, stockReserve: produit.stockReserve }]
    : actives.map((v) => ({ produitId: produit.id, varianteId: v.id, stock: v.stock }));
  const etatsDe = async (entrepotId: string | null): Promise<Disponibilite> =>
    // Article simple : la fonction des fondations fait foi. Produit à variantes : somme de ses variantes.
    simple ? disponibilite(ctx.tenantId, produit.id, variante?.id ?? null, entrepotId)
      : sommerEtats([...(await etatsStock(prisma, ctx.tenantId, articles, entrepotId)).values()]);
  const ventesDepuis = async (depuis: Date): Promise<VentesPeriode> => {
    const lignes = await prisma.ligneCommande.findMany({
      where: { produitId: produit.id, ...(variante ? { varianteId: variante.id } : {}), commande: { tenantId: ctx.tenantId, createdAt: { gte: depuis }, statut: { notIn: ["annulee", "annule", "cancelled"] } } },
      select: { quantite: true, quantiteRetournee: true, prix: true, remise: true },
      take: 5000, // ponytail: plafond de lecture ; au-delà, passer à un agrégat SQL (SUM(prix * quantite))
    });
    return lignes.reduce((s, l) => {
      const q = Math.max(0, l.quantite - l.quantiteRetournee);
      return { quantite: s.quantite + q, montant: Math.round((s.montant + l.prix * q - (l.quantite ? (l.remise * q) / l.quantite : 0)) * 100) / 100 };
    }, { quantite: 0, montant: 0 });
  };

  const [total, parLieu, stocksIci, aujourdhui, jours7, jours30, offre, reception, promotions, lots, compteSeries, series] = await Promise.all([
    etatsDe(null),
    Promise.all(lieuxActifs.map((l) => etatsDe(l.id))),
    stocksDuLieu(prisma, ctx.tenantId, lieuCourant, produit.variantes.map((v) => ({ produitId: produit.id, varianteId: v.id, stock: v.stock }))),
    ventesDepuis(debutJour), ventesDepuis(ilYA(7)), ventesDepuis(ilYA(30)),
    prisma.produitFournisseur.findFirst({
      where: { tenantId: ctx.tenantId, produitId: produit.id, principal: true },
      select: { prixUnitaire: true, devise: true, moq: true, delaiProduction: true, fournisseur: { select: { id: true, nom: true, delaiLivraison: true } } },
    }),
    prisma.ligneReception.findFirst({
      where: { produitId: produit.id, ...(variante ? { varianteId: variante.id } : {}), reception: { tenantId: ctx.tenantId, statut: "validee" } },
      orderBy: { reception: { recuAt: "desc" } },
      select: { coutUnitaire: true, quantite: true, reception: { select: { recuAt: true } } },
    }),
    reglages.flags.smart_promotions ? promotionsActives(prisma, ctx.tenantId, { magasinId: ctx.magasinId }) : Promise.resolve([]),
    prisma.lotTracabilite.findMany({
      where: { tenantId: ctx.tenantId, produitId: produit.id, statut: { in: ["actif", "bloque"] }, quantiteRestante: { gt: 0 } },
      orderBy: [{ dateExpiration: { sort: "asc", nulls: "last" } }, { dateReception: "asc" }], take: 30,
      select: { id: true, codeLot: true, quantiteRestante: true, dateExpiration: true, statut: true, cout: true, entrepotId: true },
    }),
    prisma.numeroSerie.groupBy({ by: ["statut"], where: { tenantId: ctx.tenantId, produitId: produit.id, ...(variante ? { varianteId: variante.id } : {}) }, _count: { _all: true } }),
    prisma.numeroSerie.findMany({
      where: { tenantId: ctx.tenantId, produitId: produit.id, ...(variante ? { varianteId: variante.id } : {}), ...(numeroSerieId ? { OR: [{ id: numeroSerieId }, { statut: "en_stock" }] } : { statut: "en_stock" }) },
      orderBy: { createdAt: "desc" }, take: 30,
      select: { id: true, numero: true, statut: true, varianteId: true, garantieFinAt: true, venduAt: true, clientId: true },
    }),
  ]);
  const clients = await prisma.client.findMany({ where: { tenantId: ctx.tenantId, id: { in: series.flatMap((s) => (s.clientId ? [s.clientId] : [])) } }, select: { id: true, nom: true } });
  const versSerie = (s: (typeof series)[number]): SerieFiche => ({
    id: s.id, numero: s.numero, statut: s.statut, varianteId: s.varianteId, garantieFinAt: s.garantieFinAt?.toISOString() ?? null,
    venduAt: s.venduAt?.toISOString() ?? null, client: clients.find((c) => c.id === s.clientId)?.nom ?? null,
  });

  const fournisseur: FicheProduit["fournisseur"] = offre
    ? { id: offre.fournisseur.id, nom: offre.fournisseur.nom, principal: true, prix: coutsVisibles ? offre.prixUnitaire : null, devise: offre.devise, moq: offre.moq, delaiJours: offre.fournisseur.delaiLivraison === null ? null : (offre.delaiProduction ?? 0) + offre.fournisseur.delaiLivraison }
    : produit.fournisseur ? { id: produit.fournisseur.id, nom: produit.fournisseur.nom, principal: false, prix: coutsVisibles ? produit.prixFournisseur : null, devise: null, moq: null, delaiJours: produit.fournisseur.delaiLivraison }
    : produit.nomFournisseur ? { id: null, nom: produit.nomFournisseur, principal: false, prix: coutsVisibles ? produit.prixFournisseur : null, devise: null, moq: null, delaiJours: null }
    : null;

  return {
    produitId: produit.id, varianteId: variante?.id ?? null, nom: produit.nom, variante: variante ? `${variante.nom}: ${variante.valeur}` : null,
    image: variante?.image ?? produit.images[0] ?? null, sku: variante?.sku ?? produit.sku, codeBarres: variante?.codeBarres ?? produit.codeBarres,
    categorie: produit.categorie, marque: produit.marque, uniteVente: produit.uniteVente === "kg" ? "kg" : "piece",
    actif: produit.actif && (variante?.actif ?? true), suiviSerie: produit.suiviSerie, garantieMois: produit.garantieMois, stockMin: produit.stockMin,
    typeCommerce: magasin?.typeCommerce ?? reglages.typeCommerce,
    champs: champsFiche(magasin?.typeCommerce ?? reglages.typeCommerce, { lots: lots.length, suiviSerie: produit.suiviSerie, variantes: produit.variantes.length, auPoids: produit.uniteVente === "kg" }),
    devise: tenant?.devise ?? "XAF",
    prix, coutsVisibles, prixAchat: coutsVisibles ? cout ?? null : null,
    ...(coutsVisibles ? margeArticle(prix, cout) : { marge: null, margePct: null }),
    stock: { total, lieux: lieuxActifs.map((l, i) => ({ ...l, ...parLieu[i], courant: l.id === lieuCourant })) },
    ventes: { aujourdhui, jours7, jours30 },
    fournisseur,
    dernierAchat: coutsVisibles && reception ? { cout: reception.coutUnitaire, quantite: reception.quantite, date: reception.reception.recuAt.toISOString() } : null,
    promotions: promotions
      .filter((pr) => promotionVise(pr.regles, { produitId: produit.id, varianteId: variante?.id ?? null, categorie: produit.categorie }))
      .map((pr) => ({ id: pr.id, nom: pr.nom, type: pr.type, valeur: pr.valeur })),
    lots: lots.map((l) => {
      const e = etatLot(l, maintenant, reglages.reglages.stock.seuilExpirationJours);
      return { id: l.id, codeLot: l.codeLot, quantiteRestante: l.quantiteRestante, dateExpiration: l.dateExpiration?.toISOString() ?? null, statut: l.statut, etat: e.etat, joursRestants: e.joursRestants, cout: coutsVisibles ? l.cout : null, entrepotId: l.entrepotId };
    }),
    seuilExpirationJours: reglages.reglages.stock.seuilExpirationJours,
    series: {
      compte: Object.fromEntries(compteSeries.map((c) => [c.statut, c._count._all])),
      liste: series.map(versSerie),
      scanne: numeroSerieId ? series.filter((s) => s.id === numeroSerieId).map(versSerie)[0] ?? null : null,
    },
    variantes: produit.variantes.map((v) => {
      const c = v.cout ?? produit.cout;
      return {
        id: v.id, libelle: `${v.nom}: ${v.valeur}`, sku: v.sku, codeBarres: v.codeBarres, prix: v.prix ?? produit.prix,
        cout: coutsVisibles ? c ?? null : null, ...(coutsVisibles ? margeArticle(v.prix ?? produit.prix, c) : { marge: null, margePct: null }),
        stock: v.stock, stockLieu: stocksIci.get(cleArticle(produit.id, v.id)) ?? null, actif: v.actif,
      };
    }),
    poidsGrammes,
  };
}
