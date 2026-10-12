// Catalogue vu par la caisse : résoudre un code lu, chercher des articles.
// SERVEUR uniquement.
//
// - `resoudreCode` : un code (scanner, caméra, clavier) → un article. Dans
//   l'ordre : code-barres de VARIANTE, code-barres de produit, SKU de variante,
//   SKU de produit, numéro de série, étiquette de balance (poids embarqué).
// - `rechercherArticles` : recherche côté serveur, paginée par curseur — plus
//   de plafond à 200 produits filtrés dans le navigateur.
// Tout est borné à la boutique (tenantId) ; les variantes, qui n'ont pas de
// tenantId, sont toujours atteintes à travers leur produit.
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { lireReglagesPos } from "./flags";
import { entrepotDuMagasin } from "./magasins";
import { stocksDuLieu } from "./stock";
import { cleArticle, normaliserSerie, type ArticleResolu } from "./types";

const SELECTION = {
  id: true, nom: true, prix: true, cout: true, stock: true, sku: true, codeBarres: true, images: true, categorie: true,
  marque: true, uniteVente: true, tauxTVA: true, suiviSerie: true, actif: true, type: true,
  variantes: { where: { actif: true }, select: { id: true, nom: true, valeur: true, prix: true, cout: true, stock: true, sku: true, codeBarres: true, image: true } },
} satisfies Prisma.ProduitSelect;
type ProduitCatalogue = Prisma.ProduitGetPayload<{ select: typeof SELECTION }>;

/** Produit (et variante précise, le cas échéant) → article de caisse. `stocks` = stock dans le magasin, par cleArticle. */
function versArticle(p: ProduitCatalogue, varianteId: string | null, stocks: Map<string, number> | null): ArticleResolu {
  const v = varianteId ? p.variantes.find((x) => x.id === varianteId) ?? null : null;
  const ici = (vId: string | null) => (stocks ? stocks.get(cleArticle(p.id, vId)) ?? 0 : null);
  return {
    produitId: p.id, varianteId: v?.id ?? null, nom: p.nom, variante: v ? `${v.nom}: ${v.valeur}` : null,
    prix: v?.prix ?? p.prix, cout: v?.cout ?? p.cout, tauxTVA: p.tauxTVA, uniteVente: p.uniteVente === "kg" ? "kg" : "piece",
    image: v?.image ?? p.images[0] ?? null, sku: v?.sku ?? p.sku, codeBarres: v?.codeBarres ?? p.codeBarres,
    categorie: p.categorie, marque: p.marque,
    // Avec des variantes, le stock vendable est le leur (lib/stock.ts) : le total affiché est leur somme.
    stock: v ? v.stock : p.variantes.length ? p.variantes.reduce((s, x) => s + x.stock, 0) : p.stock,
    stockMagasin: v ? ici(v.id) : p.variantes.length ? (stocks ? p.variantes.reduce((s, x) => s + (ici(x.id) ?? 0), 0) : null) : ici(null),
    suiviSerie: p.suiviSerie, actif: p.actif,
    variantes: p.variantes.map((x) => ({
      id: x.id, nom: x.nom, valeur: x.valeur, prix: x.prix ?? p.prix, cout: x.cout ?? p.cout,
      stock: x.stock, stockMagasin: ici(x.id), sku: x.sku, codeBarres: x.codeBarres, image: x.image,
    })),
  };
}

async function stocksMagasin(tenantId: string, magasinId: string | null | undefined, produits: ProduitCatalogue[]): Promise<Map<string, number> | null> {
  if (!magasinId || !produits.length) return null;
  const entrepotId = await entrepotDuMagasin(prisma, tenantId, magasinId);
  return stocksDuLieu(prisma, tenantId, entrepotId, produits.flatMap((p): { produitId: string; varianteId: string | null; stock: number }[] =>
    p.variantes.length ? p.variantes.map((v) => ({ produitId: p.id, varianteId: v.id, stock: v.stock })) : [{ produitId: p.id, varianteId: null, stock: p.stock }]));
}

/**
 * Étiquette de balance EAN-13 « PP AAAAA GGGGG C » : préfixe (2 chiffres),
 * code article (5), poids en grammes (5), clé. PURE. Le produit correspondant
 * est celui dont le code-barres vaut les 7 premiers chiffres (PP + AAAAA).
 */
export function decoderEanPoids(code: string, prefixes: string[]): { codeArticle: string; grammes: number } | null {
  if (!/^\d{13}$/.test(code) || !prefixes.includes(code.slice(0, 2))) return null;
  const grammes = Number(code.slice(7, 12));
  return grammes > 0 ? { codeArticle: code.slice(0, 7), grammes } : null;
}

/**
 * Article désigné par un code lu, ou null s'il est inconnu de la boutique.
 * Rend `varianteId` quand le code est celui d'une variante ; sinon, si
 * l'article a des variantes (`variantes` non vide), la caisse doit faire choisir.
 */
export async function resoudreCode(tenantId: string, codeLu: string, options: { magasinId?: string | null } = {}): Promise<ArticleResolu | null> {
  const code = codeLu.trim();
  if (!code || code.length > 128) return null;

  const [variantes, produits] = await Promise.all([
    prisma.variante.findMany({
      where: { actif: true, OR: [{ codeBarres: code }, { sku: code }], produit: { tenantId } },
      select: { id: true, codeBarres: true, produit: { select: SELECTION } }, take: 5,
    }),
    prisma.produit.findMany({ where: { tenantId, OR: [{ codeBarres: code }, { sku: code }] }, select: SELECTION, take: 5 }),
  ]);
  const variante = variantes.find((v) => v.codeBarres === code) ?? null;
  const produit = produits.find((p) => p.codeBarres === code) ?? null;
  const trouve: { p: ProduitCatalogue; varianteId: string | null } | null =
    variante ? { p: variante.produit, varianteId: variante.id }
    : produit ? { p: produit, varianteId: null }
    : variantes[0] ? { p: variantes[0].produit, varianteId: variantes[0].id }
    : produits[0] ? { p: produits[0], varianteId: null }
    : null;
  if (trouve) return versArticle(trouve.p, trouve.varianteId, await stocksMagasin(tenantId, options.magasinId, [trouve.p]));

  // Numéro de série / IMEI d'une unité.
  const serie = await prisma.numeroSerie.findFirst({
    where: { tenantId, numero: { equals: normaliserSerie(code), mode: "insensitive" } },
    select: { id: true, numero: true, varianteId: true, produit: { select: SELECTION } },
  });
  if (serie) {
    const article = versArticle(serie.produit, serie.varianteId, await stocksMagasin(tenantId, options.magasinId, [serie.produit]));
    return { ...article, numeroSerieId: serie.id, numeroSerie: serie.numero };
  }

  // Étiquette de balance : le poids est dans le code.
  if (/^2\d{12}$/.test(code)) {
    const { reglages } = await lireReglagesPos(tenantId);
    const balance = decoderEanPoids(code, reglages.balance.prefixesPoids);
    if (balance) {
      const pese = await prisma.produit.findFirst({ where: { tenantId, codeBarres: balance.codeArticle, uniteVente: "kg" }, select: SELECTION });
      if (pese) return { ...versArticle(pese, null, await stocksMagasin(tenantId, options.magasinId, [pese])), poidsGrammes: balance.grammes };
    }
  }
  return null;
}

export type OptionsRecherche = {
  /** Magasin dont on veut le stock (stockMagasin) ; absent : seul le stock total est rendu. */
  magasinId?: string | null;
  categorie?: string | null;
  /** Identifiant du dernier article de la page précédente. */
  curseur?: string | null;
  /** 1 à 100, 40 par défaut. */
  limite?: number;
  /** Types de produits vendus en caisse (défaut : physique). */
  types?: string[];
};

/**
 * Articles actifs de la boutique correspondant à `q` (nom, SKU, code-barres,
 * marque — y compris SKU et code-barres des variantes), triés par nom.
 * `curseurSuivant` non nul = il reste des articles : le repasser dans `curseur`.
 */
export async function rechercherArticles(tenantId: string, q: string | null | undefined, o: OptionsRecherche = {}): Promise<{ articles: ArticleResolu[]; curseurSuivant: string | null }> {
  const limite = Math.min(Math.max(Math.floor(o.limite ?? 40), 1), 100);
  const terme = q?.trim().slice(0, 100) ?? "";
  const where: Prisma.ProduitWhereInput = {
    tenantId, actif: true, type: { in: o.types?.length ? o.types : ["physique"] },
    ...(o.categorie ? { categorie: o.categorie } : {}),
    ...(terme
      ? {
          OR: [
            { nom: { contains: terme, mode: "insensitive" } },
            { sku: { contains: terme, mode: "insensitive" } },
            { codeBarres: { startsWith: terme } },
            { marque: { contains: terme, mode: "insensitive" } },
            { variantes: { some: { OR: [{ sku: { contains: terme, mode: "insensitive" } }, { codeBarres: { startsWith: terme } }] } } },
          ],
        }
      : {}),
  };
  const produits = await prisma.produit.findMany({
    where, select: SELECTION,
    orderBy: [{ nom: "asc" }, { id: "asc" }],
    take: limite + 1,
    ...(o.curseur ? { cursor: { id: o.curseur }, skip: 1 } : {}),
  });
  const page = produits.slice(0, limite);
  const stocks = await stocksMagasin(tenantId, o.magasinId, page);
  return {
    articles: page.map((p) => versArticle(p, null, stocks)),
    curseurSuivant: produits.length > limite ? page[page.length - 1].id : null,
  };
}

/** Catégories des articles vendables en caisse, avec leur nombre d'articles (colonne de gauche de l'écran). */
export async function categoriesCatalogue(tenantId: string): Promise<{ nom: string; articles: number }[]> {
  const groupes = await prisma.produit.groupBy({
    by: ["categorie"], where: { tenantId, actif: true, type: "physique", categorie: { not: null } },
    _count: { _all: true }, orderBy: { categorie: "asc" },
  });
  return groupes.filter((g) => g.categorie).map((g) => ({ nom: g.categorie as string, articles: g._count._all }));
}
