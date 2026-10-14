// Stock par lieu — LA fonction qui écrit le stock : `mouvementStock`.
// SERVEUR uniquement. lib/stock.ts (sortirStock / rendreStock : vitrine,
// caisse, annulations) passe par elle ; inventaires, transferts, réceptions et
// retours partiels l'appellent directement.
//
// DEUX NIVEAUX, ÉCRITS ENSEMBLE DANS LA MÊME TRANSACTION
// - Produit.stock / Variante.stock : le TOTAL de l'article, tous lieux
//   confondus. La vitrine ne connaît que lui.
// - StockEntrepot : la VENTILATION par entrepôt (un magasin vend le stock de
//   son entrepôt).
// Invariant : somme des StockEntrepot d'un article = son total.
//
// L'ENTREPÔT PRINCIPAL EST UN RELIQUAT — son stock n'est jamais lu dans sa
// ligne StockEntrepot : c'est « le total moins ce qui est rangé dans les autres
// entrepôts ». Conséquences :
// - aucune initialisation n'est nécessaire, l'invariant tient par construction ;
// - le code d'avant le POS 2.0 qui ne change que le total (fiche produit,
//   /api/pos/stock, réception d'expédition) reste juste : il agit sur le principal ;
// - un mouvement sans lieu (vitrine) porte sur l'entrepôt principal, SANS
//   contrôle de lieu : la vitrine vend le total, comme avant ;
// - la ligne StockEntrepot du principal, quand elle existe, est recopiée à
//   chaque mouvement (pour les écrans qui la lisent) et porte bloque / endommage.
//
// QUANTITÉS — entières : pièces, ou GRAMMES pour un produit au poids
// (Produit.uniteVente = "kg", voir lib/pos/tarification.ts).
//
// LOTS — une sortie de type « vente » consomme les lots du produit en FEFO :
// date d'expiration la plus proche d'abord (sans date en dernier, puis le plus
// anciennement reçu). Les lots périmés, bloqués, rappelés ou épuisés ne sont
// jamais consommés. Un mouvement StockMouvement est écrit par lot entamé.
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { ErreurPos } from "./erreurs";
import { entrepotPrincipal } from "./magasins";
import { cleArticle } from "./types";
import { publier } from "../controle-ia/evenements";

type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaClient;

export const TYPES_MOUVEMENT = ["entree", "sortie", "ajustement", "perte", "vente", "retour", "transfert_sortie", "transfert_entree", "reception", "inventaire"] as const;
export type TypeMouvement = (typeof TYPES_MOUVEMENT)[number];

/** Sens de chaque type : +1 entre, −1 sort, 0 = `quantite` est un écart SIGNÉ (ajustement, inventaire). */
const SENS: Record<TypeMouvement, 1 | -1 | 0> = {
  entree: 1, retour: 1, transfert_entree: 1, reception: 1,
  sortie: -1, perte: -1, vente: -1, transfert_sortie: -1,
  ajustement: 0, inventaire: 0,
};

/** Lieu d'un mouvement. `explicite` = demandé par l'appelant (sinon : entrepôt principal par défaut). */
export type LieuStock = { entrepotId: string; estPrincipal: boolean; explicite: boolean } | null;

/**
 * Lieu sur lequel porte un mouvement : l'entrepôt demandé (vérifié : il est à
 * la boutique), sinon l'entrepôt principal, sinon null (boutique sans entrepôt :
 * seul le total est tenu). À résoudre une fois pour une série de mouvements.
 */
export async function resoudreLieu(db: Db, tenantId: string, entrepotId?: string | null): Promise<LieuStock> {
  const principal = await entrepotPrincipal(db, tenantId);
  if (!entrepotId) return principal ? { entrepotId: principal.id, estPrincipal: true, explicite: false } : null;
  if (entrepotId !== principal?.id) {
    const e = await db.entrepot.findFirst({ where: { id: entrepotId, tenantId }, select: { id: true } });
    if (!e) throw new ErreurPos("introuvable", 404, "Cet entrepôt est introuvable dans cette boutique.");
  }
  return { entrepotId, estPrincipal: entrepotId === principal?.id, explicite: true };
}

export type DemandeMouvement = {
  tenantId: string;
  produitId: string;
  varianteId?: string | null;
  /** Lieu du mouvement ; absent = entrepôt principal. */
  entrepotId?: string | null;
  type: TypeMouvement;
  /** Positive (le sens vient du type) ; écart SIGNÉ pour « ajustement » et « inventaire ». */
  quantite: number;
  motif?: string | null;
  /** Pièces d'origine. `lotId` : sur un retour, le lot recrédité ; sur une sortie, le lot précis à débiter (sinon FEFO pour une vente). */
  refs?: { commandeId?: string | null; lotId?: string | null; transfertId?: string | null; comptageId?: string | null; receptionId?: string | null };
  creePar?: string | null;
  /** Laisse le stock passer sous zéro (vente hors ligne rejouée, réglage « vente sans stock ») au lieu de refuser. */
  autoriserNegatif?: boolean;
  /** Lieu déjà résolu par resoudreLieu() (série de mouvements) — évite deux lectures par mouvement. */
  lieu?: LieuStock;
};

export type ResultatMouvement = {
  /** Total de l'article avant et après. */
  stockAvant: number;
  stockApres: number;
  /** Quantité dans l'entrepôt du mouvement après coup ; null pour une boutique sans entrepôt. */
  stockEntrepot: number | null;
  /** Lots entamés (vente, expédition d'un transfert) ou recrédité (retour). */
  lots: { lotId: string; quantite: number }[];
};

/**
 * Applique un mouvement de stock : total de l'article, ventilation de
 * l'entrepôt, lots, journal StockMouvement — tout ou rien, dans la transaction
 * de l'appelant. Lève ErreurPos « stock_insuffisant » (409) si la sortie
 * dépasse le stock et que `autoriserNegatif` n'est pas demandé.
 */
export async function mouvementStock(tx: Tx, p: DemandeMouvement): Promise<ResultatMouvement> {
  if (!Number.isInteger(p.quantite)) throw new ErreurPos("invalide", 400, "La quantité doit être un nombre entier (en grammes pour un produit au poids).");
  const sens = SENS[p.type];
  if (sens === undefined) throw new ErreurPos("invalide", 400, "Ce type de mouvement de stock n'existe pas.");
  const delta = sens === 0 ? p.quantite : sens * Math.abs(p.quantite);

  const produit = await tx.produit.findFirst({ where: { id: p.produitId, tenantId: p.tenantId }, select: { nom: true, type: true, stock: true, stockMin: true } });
  if (!produit) throw new ErreurPos("introuvable", 404, "Ce produit est introuvable dans cette boutique.");
  if (produit.type !== "physique") throw new ErreurPos("invalide", 400, `« ${produit.nom} » n'a pas de stock suivi.`);
  const varianteId = p.varianteId ?? null;
  const variante = varianteId ? await tx.variante.findFirst({ where: { id: varianteId, produitId: p.produitId }, select: { nom: true, valeur: true } }) : null;
  if (varianteId && !variante) throw new ErreurPos("introuvable", 404, `Cette variante de « ${produit.nom} » est introuvable.`);
  const nom = variante ? `${produit.nom} (${variante.nom}: ${variante.valeur})` : produit.nom;

  // 1. Total de l'article. La mise à jour conditionnelle refuse de passer sous
  //    zéro et verrouille la ligne : les mouvements d'un même article se suivent.
  const strict = delta < 0 && !p.autoriserNegatif;
  const filtre = strict ? { stock: { gte: -delta } } : {};
  const touche = varianteId
    ? await tx.variante.updateMany({ where: { id: varianteId, ...filtre }, data: { stock: { increment: delta } } })
    : await tx.produit.updateMany({ where: { id: p.produitId, ...filtre }, data: { stock: { increment: delta } } });
  if (touche.count === 0) throw new ErreurPos("stock_insuffisant", 409, `Stock insuffisant pour « ${nom} ».`, { produitId: p.produitId, varianteId });
  const { stock: stockApres } = varianteId
    ? await tx.variante.findUniqueOrThrow({ where: { id: varianteId }, select: { stock: true } })
    : await tx.produit.findUniqueOrThrow({ where: { id: p.produitId }, select: { stock: true } });
  const stockAvant = stockApres - delta;
  // Franchissement du seuil d'alerte (il n'existe que sur le produit, pas sur ses variantes) : événement du bus AXSO CONTROL, sans effet sur le mouvement.
  if (!varianteId && produit.stockMin && stockApres <= produit.stockMin && stockAvant > produit.stockMin) publier(p.tenantId, "inventory.low", { produitId: p.produitId, nom: produit.nom, stock: stockApres, seuil: produit.stockMin });

  // 2. Ventilation par entrepôt.
  const lieu = p.lieu !== undefined ? p.lieu : await resoudreLieu(tx, p.tenantId, p.entrepotId);
  let stockEntrepot: number | null = null;
  if (lieu) {
    const lignes = await tx.stockEntrepot.findMany({ where: { produitId: p.produitId, varianteId } });
    const ligne = lignes.find((l) => l.entrepotId === lieu.entrepotId) ?? null;
    const ailleurs = lignes.filter((l) => l.entrepotId !== lieu.entrepotId).reduce((s, l) => s + l.quantite, 0);
    // Principal = reliquat (total − autres entrepôts) ; autre entrepôt = sa ligne, zéro s'il n'en a pas.
    const iciAvant = lieu.estPrincipal ? stockAvant - ailleurs : ligne?.quantite ?? 0;
    // Une vente ou un départ en transfert ne touche pas aux unités bloquées ou abîmées.
    const vendable = p.type === "vente" || p.type === "transfert_sortie" ? iciAvant - (ligne?.bloque ?? 0) - (ligne?.endommage ?? 0) : iciAvant;
    if (strict && lieu.explicite && vendable < -delta) {
      throw new ErreurPos("stock_insuffisant", 409, `Stock insuffisant dans ce magasin pour « ${nom} ».`, {
        produitId: p.produitId, varianteId, disponibleIci: Math.max(0, vendable), disponibleAilleurs: Math.max(0, stockAvant - iciAvant),
      });
    }
    stockEntrepot = iciAvant + delta;
    if (ligne) await tx.stockEntrepot.update({ where: { id: ligne.id }, data: { quantite: stockEntrepot } });
    else if (lieu.explicite) await tx.stockEntrepot.create({ data: { entrepotId: lieu.entrepotId, produitId: p.produitId, varianteId, quantite: stockEntrepot } });
  }

  // 3. Lots.
  const lots: { lotId: string; quantite: number }[] = [];
  // Un transfert emporte ses lots comme une vente (premier périmé, premier sorti) : ils sont recréés à l'arrivée
  // par lib/pos/operations/transferts.ts, sinon la traçabilité resterait accrochée à l'entrepôt de départ.
  if (delta < 0 && (p.type === "vente" || p.type === "transfert_sortie" || p.refs?.lotId)) {
    const candidats = await tx.lotTracabilite.findMany({
      where: {
        tenantId: p.tenantId, produitId: p.produitId, statut: "actif", quantiteRestante: { gt: 0 },
        ...(p.refs?.lotId
          ? { id: p.refs.lotId }
          : {
              AND: [
                { OR: [{ dateExpiration: null }, { dateExpiration: { gt: new Date() } }] },
                ...(lieu ? [{ OR: [{ entrepotId: null }, { entrepotId: lieu.entrepotId }] }] : []),
              ],
            }),
      },
      orderBy: [{ dateExpiration: { sort: "asc", nulls: "last" } }, { dateReception: "asc" }],
    });
    let reste = -delta;
    for (const lot of candidats) {
      if (reste <= 0) break;
      const pris = Math.min(lot.quantiteRestante, reste);
      await tx.lotTracabilite.update({ where: { id: lot.id }, data: { quantiteRestante: { decrement: pris }, ...(pris >= lot.quantiteRestante ? { statut: "epuise" } : {}) } });
      lots.push({ lotId: lot.id, quantite: pris });
      reste -= pris;
    }
    // Vente d'un article suivi par lots : ce que le FEFO n'a pas trouvé ne peut sortir « hors lot » que
    // s'il existe réellement des unités sans lot. Sinon, ce qui reste en rayon est périmé ou bloqué : refus.
    // (Un produit sans aucun lot n'est pas concerné ; le rejeu hors ligne et « vente sans stock » passent.)
    if (reste > 0 && strict && p.type === "vente" && !p.refs?.lotId) {
      // Un lot ne porte pas de variante : pour un article à variantes, la comparaison se fait au niveau
      // du produit entier (toutes variantes, tous lieux), seule échelle où lots et stock se correspondent.
      const porteurs = await tx.lotTracabilite.findMany({
        where: { tenantId: p.tenantId, produitId: p.produitId, quantiteRestante: { gt: 0 }, ...(lieu && !varianteId ? { OR: [{ entrepotId: null }, { entrepotId: lieu.entrepotId }] } : {}) },
        select: { statut: true, quantiteRestante: true },
      });
      // Les lots relus sont déjà diminués de ce que cette vente vient d'y prendre : on le rajoute pour retrouver l'état d'avant.
      const enLots = porteurs.reduce((s, l) => s + l.quantiteRestante, 0) + lots.reduce((s, l) => s + l.quantite, 0);
      const presentAvant = varianteId
        ? ((await tx.variante.aggregate({ where: { produitId: p.produitId }, _sum: { stock: true } }))._sum.stock ?? 0) - delta
        : (stockEntrepot ?? stockApres) - delta;
      const horsLotPermis = Math.max(0, presentAvant - enLots);
      if (reste > horsLotPermis) {
        const bloques = porteurs.filter((l) => l.statut === "bloque").reduce((s, l) => s + l.quantiteRestante, 0);
        const perimes = porteurs.filter((l) => l.statut !== "bloque").reduce((s, l) => s + l.quantiteRestante, 0);
        throw new ErreurPos("lot_indisponible", 409, `Les lots restants de « ${nom} » sont périmés ou bloqués : cet article ne peut pas être vendu. Retirez les lots périmés du stock, ou débloquez le lot concerné.`, { produitId: p.produitId, varianteId, perimes, bloques });
      }
    }
  } else if (delta > 0 && p.type === "retour" && p.refs?.lotId) {
    const lot = await tx.lotTracabilite.findFirst({ where: { id: p.refs.lotId, tenantId: p.tenantId }, select: { id: true, statut: true } });
    if (lot) {
      await tx.lotTracabilite.update({ where: { id: lot.id }, data: { quantiteRestante: { increment: delta }, ...(lot.statut === "epuise" ? { statut: "actif" } : {}) } });
      lots.push({ lotId: lot.id, quantite: delta });
    }
  }

  // 4. Journal : une ligne par lot entamé, plus une pour ce qui ne vient d'aucun lot.
  if (delta !== 0) {
    const horsLot = Math.abs(delta) - lots.reduce((s, l) => s + l.quantite, 0);
    // Une réception rattache son mouvement au lot qu'elle vient de créer (refs.lotId), sans le recréditer.
    const lotHorsConsommation = delta > 0 && p.type !== "retour" ? p.refs?.lotId ?? null : null;
    const morceaux: { lotId: string | null; quantite: number }[] = [...lots, ...(horsLot > 0 ? [{ lotId: lotHorsConsommation, quantite: horsLot }] : [])];
    let courant = stockAvant;
    for (const m of morceaux) {
      const apres = courant + Math.sign(delta) * m.quantite;
      await tx.stockMouvement.create({
        data: {
          tenantId: p.tenantId, produitId: p.produitId, varianteId, entrepotId: lieu?.entrepotId ?? null,
          type: p.type, quantite: m.quantite, stockAvant: courant, stockApres: apres, motif: p.motif ?? null,
          lotId: m.lotId, commandeId: p.refs?.commandeId ?? null, transfertId: p.refs?.transfertId ?? null,
          comptageId: p.refs?.comptageId ?? null, receptionId: p.refs?.receptionId ?? null, creePar: p.creePar ?? null,
        },
      });
      courant = apres;
    }
  }
  return { stockAvant, stockApres, stockEntrepot, lots };
}

/**
 * Stock d'une liste d'articles dans UN entrepôt (clé = cleArticle). Règle du
 * reliquat : l'entrepôt principal contient le total moins ce qui est rangé
 * ailleurs ; un autre entrepôt contient sa ligne, rien s'il n'en a pas.
 */
export async function stocksDuLieu(db: Db, tenantId: string, entrepotId: string, articles: { produitId: string; varianteId?: string | null; stock: number }[]): Promise<Map<string, number>> {
  const resultat = new Map<string, number>();
  if (!articles.length) return resultat;
  const [principal, lignes] = await Promise.all([
    entrepotPrincipal(db, tenantId),
    db.stockEntrepot.findMany({
      where: { produitId: { in: [...new Set(articles.map((a) => a.produitId))] }, entrepot: { tenantId } },
      select: { entrepotId: true, produitId: true, varianteId: true, quantite: true },
    }),
  ]);
  for (const a of articles) {
    const cle = cleArticle(a.produitId, a.varianteId);
    const siennes = lignes.filter((l) => cleArticle(l.produitId, l.varianteId) === cle);
    const quantite = (ls: typeof siennes) => ls.reduce((s, l) => s + l.quantite, 0);
    resultat.set(cle, principal?.id === entrepotId
      ? a.stock - quantite(siennes.filter((l) => l.entrepotId !== entrepotId))
      : quantite(siennes.filter((l) => l.entrepotId === entrepotId)));
  }
  return resultat;
}

export type Disponibilite = {
  /** Présent physiquement (dans l'entrepôt demandé, sinon partout). */
  physique: number;
  /** Retenu par des paniers de la vitrine (compté sur le total et sur l'entrepôt principal). */
  reserve: number;
  bloque: number;
  endommage: number;
  /** DISPONIBLE = PHYSIQUE − RÉSERVÉ − BLOQUÉ − ENDOMMAGÉ (jamais négatif). */
  disponible: number;
  /** Expédié par transfert, pas encore reçu (vers l'entrepôt demandé, sinon partout). */
  enTransit: number;
  /** Commandé à un fournisseur, pas encore reçu. */
  enCommande: number;
};

/** État du stock d'un article, pour un entrepôt ou pour toute la boutique. */
export async function disponibilite(tenantId: string, produitId: string, varianteId?: string | null, entrepotId?: string | null): Promise<Disponibilite> {
  const vId = varianteId ?? null;
  const produit = await prisma.produit.findFirst({
    where: { id: produitId, tenantId },
    select: { stock: true, stockReserve: true, variantes: { where: { id: vId ?? "" }, select: { stock: true } } },
  });
  if (!produit || (vId && !produit.variantes.length)) throw new ErreurPos("introuvable", 404, "Cet article est introuvable dans cette boutique.");
  const total = vId ? produit.variantes[0].stock : produit.stock;

  const [principal, lignes, transit, commande] = await Promise.all([
    entrepotPrincipal(prisma, tenantId),
    prisma.stockEntrepot.findMany({ where: { produitId, varianteId: vId, entrepot: { tenantId } }, select: { entrepotId: true, quantite: true, bloque: true, endommage: true } }),
    prisma.ligneTransfert.findMany({
      where: { produitId, varianteId: vId, transfert: { tenantId, statut: { in: ["expedie", "partiellement_recu"] }, ...(entrepotId ? { entrepotDestinationId: entrepotId } : {}) } },
      select: { quantiteExpediee: true, quantiteRecue: true },
    }),
    prisma.ligneBonCommande.findMany({
      where: { produitId, varianteId: vId, bonCommande: { tenantId, statut: { in: ["envoye", "confirme", "partiellement_recu"] }, ...(entrepotId ? { entrepotId } : {}) } },
      select: { quantite: true, quantiteRecue: true },
    }),
  ]);
  const ici = entrepotId ? lignes.filter((l) => l.entrepotId === entrepotId) : lignes;
  const somme = (f: (l: (typeof lignes)[number]) => number) => ici.reduce((s, l) => s + f(l), 0);
  const estPrincipal = !!entrepotId && principal?.id === entrepotId;
  const physique = !entrepotId ? total
    : estPrincipal ? total - lignes.filter((l) => l.entrepotId !== entrepotId).reduce((s, l) => s + l.quantite, 0)
    : somme((l) => l.quantite);
  // Une réservation de variante sort déjà du stock de la variante (app/api/stock/reserver) : rien à retrancher une seconde fois.
  const reserve = vId || (entrepotId && !estPrincipal) ? 0 : produit.stockReserve;
  const bloque = somme((l) => l.bloque);
  const endommage = somme((l) => l.endommage);
  return {
    physique, reserve, bloque, endommage,
    disponible: Math.max(0, physique - reserve - bloque - endommage),
    enTransit: transit.reduce((s, l) => s + Math.max(0, l.quantiteExpediee - l.quantiteRecue), 0),
    enCommande: commande.reduce((s, l) => s + Math.max(0, l.quantite - l.quantiteRecue), 0),
  };
}

export type ReliquatPrincipal = {
  produitId: string;
  varianteId: string | null;
  /** Ce que l'entrepôt contient réellement (règle du reliquat). */
  quantite: number;
  /** Sa ligne StockEntrepot, si elle existe (sa quantité peut être en retard sur le reliquat). */
  ligne: { id: string; quantite: number; bloque: number; endommage: number } | null;
};

/**
 * Contenu réel de l'entrepôt PRINCIPAL, article par article : le total moins
 * ce qui est rangé dans les autres entrepôts. Lecture seule.
 * ponytail: tout le catalogue physique est lu d'un coup (changement de principal, suppression d'entrepôt : gestes rares) — agrégat SQL au-delà de quelques dizaines de milliers d'articles.
 */
export async function reliquatsDuPrincipal(db: Db, tenantId: string, entrepotId: string): Promise<ReliquatPrincipal[]> {
  const produits = await db.produit.findMany({ where: { tenantId, type: "physique" }, select: { id: true, stock: true, variantes: { select: { id: true, stock: true } } } });
  const lignes = await db.stockEntrepot.findMany({ where: { entrepot: { tenantId } }, select: { id: true, entrepotId: true, produitId: true, varianteId: true, quantite: true, bloque: true, endommage: true } });
  const ailleurs = new Map<string, number>();
  const siennes = new Map<string, ReliquatPrincipal["ligne"]>();
  for (const l of lignes) {
    const cle = cleArticle(l.produitId, l.varianteId);
    if (l.entrepotId === entrepotId) siennes.set(cle, l);
    else ailleurs.set(cle, (ailleurs.get(cle) ?? 0) + l.quantite);
  }
  return produits.flatMap((p) => [{ id: null as string | null, stock: p.stock }, ...p.variantes].map((a) => {
    const cle = cleArticle(p.id, a.id);
    return { produitId: p.id, varianteId: a.id, quantite: a.stock - (ailleurs.get(cle) ?? 0), ligne: siennes.get(cle) ?? null };
  }));
}

/**
 * Écrit dans ses lignes StockEntrepot ce que l'entrepôt principal contient
 * réellement. À appeler, dans la même transaction, quand il CESSE d'être le
 * principal : il devient un entrepôt ordinaire, lu dans ses lignes, et le
 * nouveau principal (reliquat) retrouve exactement ce qu'il avait — aucune
 * quantité ne change de lieu. Renvoie le nombre de lignes écrites.
 */
export async function figerStockPrincipal(tx: Tx, tenantId: string, entrepotId: string): Promise<number> {
  const articles = await reliquatsDuPrincipal(tx, tenantId, entrepotId);
  const aCorriger = articles.filter((a) => a.ligne && a.ligne.quantite !== a.quantite);
  const aCreer = articles.filter((a) => !a.ligne && a.quantite !== 0);
  for (const a of aCorriger) await tx.stockEntrepot.update({ where: { id: a.ligne!.id }, data: { quantite: a.quantite } });
  if (aCreer.length) await tx.stockEntrepot.createMany({ data: aCreer.map((a) => ({ entrepotId, produitId: a.produitId, varianteId: a.varianteId, quantite: a.quantite })) });
  return aCorriger.length + aCreer.length;
}
