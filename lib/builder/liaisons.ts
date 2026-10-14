// Liaisons produits du bloc « products » : une RÈGLE (meilleures ventes, collection, forte
// marge, dormants…) au lieu d'une liste copiée — la grille suit le catalogue à chaque rendu.
// Pur : construit la requête Prisma et l'ordre final ; le rendu (components/storefront/
// blocks/widgets/ProductsBlock.tsx) exécute la requête.

export const REGLES = [
  "meilleures_ventes", "nouveautes", "mis_en_avant", "collection", "categorie",
  "forte_marge", "stock_bas", "dormants", "marge_peu_vendus", "recherche",
] as const;
export type Regle = (typeof REGLES)[number];
export const TRIS = ["recent", "ventes", "featured", "prix_asc", "prix_desc"] as const;

/** Règles calculées hors base (marge, ventes sur la période) : on lit un lot de candidats puis on trie. */
const CANDIDATS = 200; // ponytail: 200 candidats max pour marge/dormants, passer en SQL brut au-delà

const borne = (v: unknown, min: number, max: number, defaut: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut;
};

const ORDRE: Record<string, any> = {
  recent: { createdAt: "desc" }, ventes: { ventes: "desc" }, featured: { featured: "desc" },
  prix_asc: { prix: "asc" }, prix_desc: { prix: "desc" },
};

export interface RequeteLiaison {
  where: Record<string, any>;
  orderBy: Record<string, any> | Record<string, any>[];
  take: number;
  /** Compter les ventes depuis cette date (dormants, marge_peu_vendus). */
  ventesDepuis?: Date;
  /** Tri/filtre à appliquer après lecture. */
  apres?: "marge" | "dormants" | "marge_peu_vendus";
  nombre: number;
}

/**
 * Règle d'un bloc products → requête. Sans `regle`, l'ancien `tri` (recent|ventes|featured)
 * garde exactement son comportement : toutes les boutiques déjà construites restent identiques.
 */
export function requeteLiaison(config: Record<string, any>, tenantId: string, maintenant = new Date()): RequeteLiaison {
  const nombre = borne(config.nombre, 1, 24, 8);
  const where: Record<string, any> = { tenantId, actif: true, visibleListage: true };
  const ordreTri = ORDRE[config.tri] ?? ORDRE.recent;
  const base = { where, orderBy: ordreTri, take: nombre, nombre };
  const jours = borne(config.jours, 7, 365, 30);
  const depuis = new Date(maintenant.getTime() - jours * 86_400_000);

  switch (config.regle as Regle | undefined) {
    case "meilleures_ventes": return { ...base, orderBy: { ventes: "desc" } };
    case "nouveautes": return { ...base, orderBy: { createdAt: "desc" } };
    case "mis_en_avant": return { ...base, where: { ...where, featured: true } };
    case "collection":
      return { ...base, where: { ...where, collections: { some: { tenantId, slug: String(config.collection ?? ""), actif: true } } } };
    case "categorie":
      return { ...base, where: { ...where, categorie: { equals: String(config.categorie ?? ""), mode: "insensitive" } } };
    case "recherche": {
      const mot = String(config.motCle ?? "").trim().slice(0, 60);
      return { ...base, where: { ...where, OR: [{ nom: { contains: mot, mode: "insensitive" } }, { description: { contains: mot, mode: "insensitive" } }, { tags: { has: mot } }] } };
    }
    case "stock_bas":
      // Physique seulement (un digital n'a pas de stock) et encore achetable : « dernières pièces ».
      return { ...base, where: { ...where, type: { not: "digital" }, stock: { gt: 0, lte: borne(config.seuilStock, 1, 100, 5) } }, orderBy: { stock: "asc" } };
    case "forte_marge":
      return { ...base, where: { ...where, cout: { not: null } }, orderBy: { ventes: "desc" }, take: CANDIDATS, apres: "marge" };
    case "dormants":
      // Produits en ligne depuis au moins la période : un produit neuf n'est pas « dormant ».
      return { ...base, where: { ...where, createdAt: { lt: depuis } }, orderBy: { createdAt: "asc" }, take: CANDIDATS, ventesDepuis: depuis, apres: "dormants" };
    case "marge_peu_vendus":
      return { ...base, where: { ...where, cout: { not: null }, createdAt: { lt: depuis } }, orderBy: { createdAt: "asc" }, take: CANDIDATS, ventesDepuis: depuis, apres: "marge_peu_vendus" };
  }
  return base;
}

type Ligne = { prix: number; cout?: number | null; _count?: { lignesCommande?: number } };
const marge = (p: Ligne) => p.prix - (p.cout ?? p.prix);
const ventesPeriode = (p: Ligne) => p._count?.lignesCommande ?? 0;

/** Ordre final des règles calculées (pur) ; les autres sont déjà triées par la base. */
export function selectionner<T extends Ligne>(lignes: T[], r: Pick<RequeteLiaison, "apres" | "nombre">): T[] {
  let l = [...lignes];
  if (r.apres === "marge") l = l.filter((p) => marge(p) > 0).sort((a, b) => marge(b) - marge(a));
  if (r.apres === "dormants") l.sort((a, b) => ventesPeriode(a) - ventesPeriode(b));
  if (r.apres === "marge_peu_vendus") {
    // « Peu vendus » = au plus la médiane des ventes de la période ; parmi eux, la plus forte marge d'abord.
    const v = l.map(ventesPeriode).sort((a, b) => a - b);
    const mediane = v.length ? v[Math.floor((v.length - 1) / 2)] : 0;
    l = l.filter((p) => marge(p) > 0 && ventesPeriode(p) <= mediane).sort((a, b) => marge(b) - marge(a));
  }
  return l.slice(0, r.nombre);
}
