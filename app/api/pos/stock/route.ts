// Stock intelligent (§27) : les 7 états par lieu, les ajustements, le journal.
//
// GET  /api/pos/stock?q=&filtre=&categorie=&entrepotId=&curseur=&limite=
//   filtre : all | bas | rupture. entrepotId : états dans ce lieu (absent : toute la boutique).
//   Recherche et pagination côté serveur (curseur), sans plafond.
//   Réponse : { produits: [{ id, nom, image, images, sku, codeBarres, categorie, uniteVente, stock, stockMin, prix, cout,
//   statutStock, etats: { physique, reserve, bloque, endommage, disponible, enTransit, enCommande },
//   variantes: [{ id, libelle, sku, codeBarres, stock, etats }] }], curseurSuivant,
//   stats: { total, enRupture, stockBas, valeurStock }, lieux, lieuCourant, droits: { ajuster, couts } }.
//   `cout` et `valeurStock` sont null sans le droit voir_couts. Droit : voir_stock.
// GET  /api/pos/stock?vue=mouvements&type=&produitId=&entrepotId=&du=&au=&q=&curseur=&limite=
//   Journal des mouvements, filtrable. Réponse : { mouvements, curseurSuivant, types }. Droit : voir_stock.
// GET  /api/pos/stock?vue=lieux — { lieux, lieuCourant, droits: { ajuster, reception, couts } } : entrepôts de la boutique. Droit : voir_stock.
// POST /api/pos/stock — ajustement manuel, par mouvementStock. Droit : ajuster_stock. Audité, événement inventory.updated.
//   Corps : { cle, produitId, varianteId?, entrepotId?, type, quantite?, nouveauStock?, depuis?, motif? }.
//   type : entree | sortie | perte (quantite) · ajustement (nouveauStock = quantité exacte dans le lieu) ·
//   bloquer | debloquer | endommager | reparer (quantite : change l'état, pas le stock physique).
//   depuis : "bloque" | "endommage" — une sortie ou une perte prise sur ces unités-là.
//   Motif obligatoire sauf pour une entrée ou une sortie. Réponse 201 : { ok, stock, stockLieu, bloque, endommage, rejoue }.
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { journaliserAudit } from "@/lib/pos/audit";
import { nomsUtilisateurs } from "@/lib/pos/caisse/mouvements";
import { aDroit, exigerDroit, exigerLieu } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { publierEvenement } from "@/lib/pos/evenements";
import { avecIdempotence } from "@/lib/pos/idempotence";
import { entrepotDuMagasin } from "@/lib/pos/magasins";
import { deplacerEtat, etatsStock, lieuxBoutique, sommerEtats, verrouillerArticle } from "@/lib/pos/operations/fiche";
import { mouvementStock, resoudreLieu, stocksDuLieu, TYPES_MOUVEMENT } from "@/lib/pos/stock";
import { cleArticle, type ContextePos } from "@/lib/pos/types";

async function journal(ctx: ContextePos, p: URLSearchParams) {
  const limite = Math.min(Math.max(Math.floor(Number(p.get("limite")) || 50), 1), 100);
  const date = (v: string | null) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null);
  const du = date(p.get("du")), au = date(p.get("au")), type = p.get("type"), terme = p.get("q")?.trim().slice(0, 80);
  const where: Prisma.StockMouvementWhereInput = {
    tenantId: ctx.tenantId,
    ...(type && (TYPES_MOUVEMENT as readonly string[]).includes(type) ? { type } : {}),
    ...(p.get("produitId") ? { produitId: p.get("produitId")! } : {}),
    ...(p.get("entrepotId") ? { entrepotId: p.get("entrepotId")! } : {}),
    // « au » est un jour : on inclut toute la journée.
    ...(du || au ? { createdAt: { ...(du ? { gte: du } : {}), ...(au ? { lt: new Date(au.getTime() + 86_400_000) } : {}) } } : {}),
    ...(terme ? { produit: { nom: { contains: terme, mode: "insensitive" } } } : {}),
  };
  const lignes = await prisma.stockMouvement.findMany({
    where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limite + 1,
    ...(p.get("curseur") ? { cursor: { id: p.get("curseur")! }, skip: 1 } : {}),
    include: { produit: { select: { nom: true, images: true, uniteVente: true, variantes: { select: { id: true, nom: true, valeur: true } } } }, lot: { select: { codeLot: true } } },
  });
  const page = lignes.slice(0, limite);
  const [entrepots, noms] = await Promise.all([
    prisma.entrepot.findMany({ where: { tenantId: ctx.tenantId, id: { in: [...new Set(page.flatMap((m) => (m.entrepotId ? [m.entrepotId] : [])))] } }, select: { id: true, nom: true } }),
    nomsUtilisateurs(ctx.tenantId, page.map((m) => m.creePar)),
  ]);
  return {
    mouvements: page.map((m) => {
      const v = m.produit.variantes.find((x) => x.id === m.varianteId);
      return {
        id: m.id, type: m.type, quantite: m.quantite, stockAvant: m.stockAvant, stockApres: m.stockApres, motif: m.motif, createdAt: m.createdAt.toISOString(),
        produitId: m.produitId, produit: { nom: m.produit.nom, images: m.produit.images }, variante: v ? `${v.nom}: ${v.valeur}` : null, uniteVente: m.produit.uniteVente,
        entrepot: entrepots.find((e) => e.id === m.entrepotId)?.nom ?? null, lot: m.lot?.codeLot ?? null, auteur: m.creePar ? noms[m.creePar] ?? null : null,
      };
    }),
    curseurSuivant: lignes.length > limite ? page[page.length - 1].id : null,
    types: TYPES_MOUVEMENT,
  };
}

export const GET = routePos(async (ctx, req) => {
  exigerDroit(ctx, "voir_stock");
  const p = new URL(req.url).searchParams;
  if (p.get("vue") === "mouvements") return journal(ctx, p);
  if (p.get("vue") === "lieux") {
    const [lieux, lieuCourant] = await Promise.all([lieuxBoutique(ctx.tenantId), entrepotDuMagasin(prisma, ctx.tenantId, ctx.magasinId)]);
    return { lieux, lieuCourant, droits: { ajuster: aDroit(ctx, "ajuster_stock"), reception: aDroit(ctx, "reception"), couts: aDroit(ctx, "voir_couts") } };
  }

  const limite = Math.min(Math.max(Math.floor(Number(p.get("limite")) || 40), 1), 100);
  const terme = (p.get("q") ?? p.get("search"))?.trim().slice(0, 100);
  const filtre = p.get("filtre");
  const base: Prisma.ProduitWhereInput = { tenantId: ctx.tenantId, type: "physique", actif: true };
  // Un article à variantes est en rupture dès qu'une de ses variantes actives l'est.
  const rupture: Prisma.ProduitWhereInput = { OR: [{ variantes: { none: { actif: true } }, stock: { lte: 0 } }, { variantes: { some: { actif: true, stock: { lte: 0 } } } }] };
  // Le seuil d'alerte (stockMin) n'existe que sur le produit : « stock bas » ne concerne pas les articles à variantes.
  const bas: Prisma.ProduitWhereInput = { variantes: { none: { actif: true } }, stockMin: { not: null, gt: 0 }, AND: [{ stock: { gt: 0 } }, { stock: { lte: prisma.produit.fields.stockMin } }] };
  const where: Prisma.ProduitWhereInput = {
    ...base,
    ...(p.get("categorie") ? { categorie: p.get("categorie") } : {}),
    AND: [
      ...(filtre === "rupture" ? [rupture] : filtre === "bas" ? [bas] : []),
      ...(terme ? [{ OR: [
        { nom: { contains: terme, mode: "insensitive" as const } }, { sku: { contains: terme, mode: "insensitive" as const } }, { codeBarres: { startsWith: terme } },
        { variantes: { some: { OR: [{ sku: { contains: terme, mode: "insensitive" as const } }, { codeBarres: { startsWith: terme } }] } } },
      ] }] : []),
    ],
  };
  const couts = aDroit(ctx, "voir_couts");
  const entrepotId = p.get("entrepotId") || null;
  if (entrepotId) await resoudreLieu(prisma, ctx.tenantId, entrepotId); // 404 si ce lieu n'est pas à la boutique

  const [produits, total, enRupture, stockBas, valeur, lieux, lieuCourant] = await Promise.all([
    prisma.produit.findMany({
      where, orderBy: [{ nom: "asc" }, { id: "asc" }], take: limite + 1,
      ...(p.get("curseur") ? { cursor: { id: p.get("curseur")! }, skip: 1 } : {}),
      select: {
        id: true, nom: true, images: true, sku: true, codeBarres: true, categorie: true, uniteVente: true, stock: true, stockReserve: true, stockMin: true, cout: true, prix: true,
        variantes: { where: { actif: true }, orderBy: [{ nom: "asc" }, { valeur: "asc" }], select: { id: true, nom: true, valeur: true, sku: true, codeBarres: true, stock: true } },
      },
    }),
    prisma.produit.count({ where: base }),
    prisma.produit.count({ where: { ...base, ...rupture } }),
    prisma.produit.count({ where: { ...base, ...bas } }),
    couts
      ? prisma.$queryRaw<{ valeur: number }[]>`
          SELECT COALESCE(SUM((CASE WHEN v."id" IS NULL THEN p."stock" * COALESCE(p."cout", 0) ELSE v."stock" * COALESCE(v."cout", p."cout", 0) END)
                 / (CASE WHEN p."uniteVente" = 'kg' THEN 1000 ELSE 1 END)), 0)::float8 AS "valeur"
          FROM "Produit" p LEFT JOIN "Variante" v ON v."produitId" = p."id" AND v."actif" = true
          WHERE p."tenantId" = ${ctx.tenantId} AND p."type" = 'physique' AND p."actif" = true`
      : Promise.resolve([]),
    lieuxBoutique(ctx.tenantId),
    entrepotDuMagasin(prisma, ctx.tenantId, ctx.magasinId),
  ]);
  const page = produits.slice(0, limite);
  const etats = await etatsStock(prisma, ctx.tenantId, page.flatMap((x) => (x.variantes.length
    ? x.variantes.map((v) => ({ produitId: x.id, varianteId: v.id as string | null, stock: v.stock, stockReserve: 0 }))
    : [{ produitId: x.id, varianteId: null, stock: x.stock, stockReserve: x.stockReserve }])), entrepotId);

  return {
    produits: page.map((x) => {
      const variantes = x.variantes.map((v) => ({ id: v.id, libelle: `${v.nom}: ${v.valeur}`, sku: v.sku, codeBarres: v.codeBarres, stock: v.stock, etats: etats.get(cleArticle(x.id, v.id))! }));
      const stock = variantes.length ? variantes.reduce((s, v) => s + v.stock, 0) : x.stock;
      return {
        id: x.id, nom: x.nom, image: x.images[0] ?? null, images: x.images, sku: x.sku, codeBarres: x.codeBarres, categorie: x.categorie, uniteVente: x.uniteVente,
        stock, stockMin: x.stockMin, prix: x.prix, cout: couts ? x.cout : null,
        statutStock: stock <= 0 ? "rupture" : !variantes.length && x.stockMin && stock <= x.stockMin ? "bas" : "ok",
        etats: variantes.length ? sommerEtats(variantes.map((v) => v.etats)) : etats.get(cleArticle(x.id, null))!,
        variantes,
      };
    }),
    curseurSuivant: produits.length > limite ? page[page.length - 1].id : null,
    stats: { total, enRupture, stockBas, valeurStock: couts ? Math.round((valeur[0]?.valeur ?? 0) * 100) / 100 : null },
    lieux, lieuCourant, entrepotId,
    droits: { ajuster: aDroit(ctx, "ajuster_stock"), couts },
  };
});

const TYPES_AJUSTEMENT = ["entree", "sortie", "perte", "ajustement", "bloquer", "debloquer", "endommager", "reparer"] as const;
const id = z.string().trim().min(1).max(64);
const schemaAjustement = z.object({
  cle: z.string().trim().min(8).max(200),
  produitId: id,
  varianteId: id.nullish(),
  entrepotId: id.nullish(),
  type: z.enum(TYPES_AJUSTEMENT),
  /** Pièces, ou grammes pour un article au poids. */
  quantite: z.coerce.number().int("La quantité doit être un nombre entier.").min(1).max(10_000_000).optional(),
  /** Ajustement : quantité exacte présente dans le lieu. */
  nouveauStock: z.coerce.number().int("Le stock doit être un nombre entier.").min(0).max(100_000_000).optional(),
  depuis: z.enum(["bloque", "endommage"]).nullish(),
  motif: z.string().trim().max(300).nullish(),
});

const AUDIT: Record<(typeof TYPES_AJUSTEMENT)[number], string> = {
  entree: "stock.entree", sortie: "stock.sortie", perte: "stock.perte", ajustement: "stock.ajuste",
  bloquer: "stock.bloque", debloquer: "stock.debloque", endommager: "stock.endommage", reparer: "stock.repare",
};

export const POST = routePos(async (ctx, req) => {
  exigerDroit(ctx, "ajuster_stock");
  const corps = await req.json();
  const d = schemaAjustement.parse({ ...corps, cle: cleIdempotence(req, corps) ?? crypto.randomUUID() });
  const motif = d.motif?.trim() ?? "";
  if (d.type !== "entree" && d.type !== "sortie" && motif.length < 3) throw new ErreurPos("motif_requis", 422, "Indiquez le motif (3 caractères au moins) : il est conservé dans le journal d'audit.");
  if (d.type === "ajustement" ? d.nouveauStock === undefined : d.quantite === undefined) throw new ErreurPos("invalide", 400, d.type === "ajustement" ? "Indiquez la quantité exacte présente." : "Indiquez la quantité.");
  const entrepotId = d.entrepotId ?? (await entrepotDuMagasin(prisma, ctx.tenantId, ctx.magasinId));

  const { resultat, rejoue } = await avecIdempotence(ctx.tenantId, d.cle, "stock.ajustement", async (tx) => {
    const lieu = await resoudreLieu(tx, ctx.tenantId, entrepotId);
    if (!lieu) throw new ErreurPos("introuvable", 404, "Aucun lieu de stock n'existe pour cette boutique.");
    await exigerLieu(tx, ctx, lieu.entrepotId);
    // Verrou de l'article d'abord : le stock lu ci-dessous ne bougera plus avant la fin de la transaction.
    const article = await verrouillerArticle(tx, ctx.tenantId, d.produitId, d.varianteId);
    const cle = cleArticle(d.produitId, d.varianteId);
    const ici = (await stocksDuLieu(tx, ctx.tenantId, lieu.entrepotId, [{ produitId: d.produitId, varianteId: d.varianteId, stock: article.stock }])).get(cle) ?? 0;
    const commun = { tenantId: ctx.tenantId, produitId: d.produitId, varianteId: d.varianteId, lieu, motif: motif || null, creePar: ctx.userId };
    const etat = { tenantId: ctx.tenantId, entrepotId: lieu.entrepotId, produitId: d.produitId, varianteId: d.varianteId, stock: article.stock, nom: article.nom };
    let stock = article.stock, stockLieu = ici;
    let etats: { bloque: number; endommage: number } | null = null;

    if (d.type === "entree" || d.type === "sortie" || d.type === "perte") {
      // Une sortie prise sur les unités bloquées ou abîmées les retire aussi de cet état.
      if (d.depuis && d.type !== "entree") etats = await deplacerEtat(tx, { ...etat, champ: d.depuis, delta: -d.quantite! });
      const m = await mouvementStock(tx, { ...commun, type: d.type, quantite: d.quantite! });
      stock = m.stockApres; stockLieu = m.stockEntrepot ?? stockLieu;
    } else if (d.type === "ajustement") {
      const ecart = d.nouveauStock! - ici;
      if (ecart !== 0) {
        const m = await mouvementStock(tx, { ...commun, type: "ajustement", quantite: ecart });
        stock = m.stockApres; stockLieu = m.stockEntrepot ?? stockLieu;
      }
    } else {
      etats = await deplacerEtat(tx, { ...etat, champ: d.type === "bloquer" || d.type === "debloquer" ? "bloque" : "endommage", delta: d.type === "bloquer" || d.type === "endommager" ? d.quantite! : -d.quantite! });
    }
    const ligne = await tx.stockEntrepot.findFirst({ where: { entrepotId: lieu.entrepotId, produitId: d.produitId, varianteId: d.varianteId ?? null }, select: { bloque: true, endommage: true } });
    const apres = { stockLieu, bloque: etats?.bloque ?? ligne?.bloque ?? 0, endommage: etats?.endommage ?? ligne?.endommage ?? 0 };
    await journaliserAudit(tx, ctx, {
      action: AUDIT[d.type], entite: "Produit", entiteId: d.produitId, motif: motif || null,
      avant: { stockLieu: ici, stockTotal: article.stock },
      apres: { ...apres, stockTotal: stock, article: article.nom, varianteId: d.varianteId ?? null, entrepotId: lieu.entrepotId, type: d.type, quantite: d.quantite ?? null, nouveauStock: d.nouveauStock ?? null, depuis: d.depuis ?? null },
    });
    await publierEvenement(tx, { tenantId: ctx.tenantId, magasinId: ctx.magasinId, type: "inventory.updated", payload: { origine: "ajustement", type: d.type, produitIds: [d.produitId] } });
    return { stock, ...apres };
  }, { appareilId: ctx.appareilId, userId: ctx.userId });

  return NextResponse.json(
    { ok: true, ...resultat, rejoue, ...(rejoue ? { message: "Cet ajustement a déjà été enregistré. Aucun doublon n'a été créé." } : {}) },
    { status: rejoue ? 200 : 201 },
  );
});
