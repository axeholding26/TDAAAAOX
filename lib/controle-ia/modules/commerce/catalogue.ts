// Module « commerce » — catalogue et stock : ce que lib/axia/tools.ts ne couvre pas
// (fiche complète d'un produit, création en une transaction, variantes, catégories,
// collections, niveaux et mouvements de stock, avancement d'un transfert).
// Toute écriture de stock passe par mouvementStock (lib/pos/stock.ts), jamais par Produit.stock.
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { categoriesDeLaBoutique, nettoyerOptions } from "@/lib/categories-produits";
import { disponibilite, mouvementStock, resoudreLieu, stocksDuLieu, type TypeMouvement } from "@/lib/pos/stock";
import { cleArticle, type ContextePos } from "@/lib/pos/types";
import { TOUS_DROITS } from "@/lib/pos/droits";
import { assurerMagasinParDefaut } from "@/lib/pos/magasins";
import { actionTransfert, lireTransfert, listerTransferts, type ActionTransfert } from "@/lib/pos/operations/transferts";
import type { CtxOutil } from "../../types";
import {
  VERSION, booleen, decalage, limite, liste, lu, nombre, objet, ok, parmi, peutLire, refuser, requis, texte, textes, url, urls,
  type Args, type Outil,
} from "./commun";

const TYPES_PRODUIT = ["physique", "digital", "dropshipping"] as const;
const ID = { type: "string", description: "Identifiant du produit (donné par lister_produits, rechercher_produits ou axso_search)" };

async function produitDe(tenantId: string, id: string) {
  return (await prisma.produit.findFirst({ where: { id, tenantId }, select: { id: true, nom: true, actif: true, type: true } }))
    ?? refuser("NOT_FOUND", "Produit introuvable dans cette boutique.");
}

/** Slug libre dans la boutique (@@unique([tenantId, slug])). */
async function slugLibre(tenantId: string, nom: string) {
  const base = slugify(nom) || "produit";
  const pris = await prisma.produit.findUnique({ where: { tenantId_slug: { tenantId, slug: base } }, select: { id: true } });
  return pris ? `${base}-${Date.now().toString(36)}` : base;
}

/** Chaque identifiant doit désigner un élément de la boutique : un id d'une autre boutique est « introuvable ». */
async function exigerTous(compter: Promise<number>, ids: string[], quoi: string) {
  if (ids.length && (await compter) !== new Set(ids).size) refuser("NOT_FOUND", `${quoi} : au moins un identifiant est introuvable dans cette boutique.`);
}

/** Champs d'une variante communs à la création et à la modification. */
function champsVariante(a: Args) {
  return {
    nom: texte(a, "name", { max: 40 }), valeur: texte(a, "value", { max: 60 }), prix: nombre(a, "price"),
    sku: texte(a, "sku", { max: 60 }), codeBarres: texte(a, "barcode", { max: 60 }), image: url(a, "image"), cout: nombre(a, "cost"),
  };
}
const sansVides = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** Champs modifiables d'un produit, hors prix (mettre_a_jour_prix), stock (adjust_inventory) et mise en vente (archive_product). */
function champsProduit(a: Args) {
  return sansVides({
    nom: texte(a, "name", { max: 150 }), description: texte(a, "description", { max: 10_000 }), categorie: texte(a, "category", { max: 60 }),
    tags: textes(a, "tags", 30, 40), images: urls(a, "images", 12), videos: urls(a, "videos", 4),
    sku: texte(a, "sku", { max: 60 }), codeBarres: texte(a, "barcode", { max: 60 }), cout: nombre(a, "cost"), poids: nombre(a, "weight", { max: 10_000 }),
    marque: texte(a, "brand", { max: 60 }), featured: booleen(a, "featured"), visibleListage: booleen(a, "listed"),
    metaTitle: texte(a, "meta_title", { max: 60 }), metaDesc: texte(a, "meta_description", { max: 155 }),
  });
}
const PROPRIETES_PRODUIT = {
  name: { type: "string" }, description: { type: "string" }, category: { type: "string", description: "Nom de la catégorie (get_catalog les liste)" },
  tags: { type: "array", items: { type: "string" } },
  images: { type: "array", items: { type: "string" }, description: "Adresses https des images (12 au plus) ; remplace la liste" },
  videos: { type: "array", items: { type: "string" }, description: "Adresses https des vidéos (4 au plus)" },
  sku: { type: "string" }, barcode: { type: "string", description: "Code-barres EAN/UPC, unique dans la boutique" },
  cost: { type: "number", description: "Coût d'achat unitaire (sert au calcul de la marge)" }, weight: { type: "number", description: "Poids en kg" },
  brand: { type: "string" }, featured: { type: "boolean", description: "Mis en avant" }, listed: { type: "boolean", description: "false = absent du catalogue, accessible par son lien" },
  meta_title: { type: "string" }, meta_description: { type: "string" },
};
const PROPRIETES_VARIANTE = {
  name: { type: "string", description: "Nom de l'option, ex. « Taille »" }, value: { type: "string", description: "Valeur, ex. « XL »" },
  price: { type: "number", description: "Prix propre à la variante (sinon celui du produit)" }, sku: { type: "string" }, barcode: { type: "string" },
  image: { type: "string" }, cost: { type: "number" },
};

/** Contexte des fonctions de la caisse (transferts). Les droits ont déjà été vérifiés par le serveur (module produits, écriture). */
async function contextePos(ctx: CtxOutil): Promise<ContextePos> {
  return { tenantId: ctx.tenantId, userId: ctx.userId, userNom: `IA ${ctx.client}`, ...(await assurerMagasinParDefaut(ctx.tenantId)), droits: TOUS_DROITS };
}

const MOUVEMENTS: Record<string, TypeMouvement> = { add: "entree", remove: "sortie", loss: "perte", set: "ajustement" };
const ACTIONS_TRANSFERT: Record<string, ActionTransfert> = { request: "demander", approve: "approuver", prepare: "preparer", ship: "expedier", receive: "recevoir", cancel: "annuler" };

export const OUTILS_CATALOGUE: Outil[] = [
  // ─── Produits ──────────────────────────────────────────────────────────────
  {
    name: "get_product", module: "produits", niveau: "lecture", capacite: "catalogue",
    description: "Fiche complète d'UN produit : prix, stock, variantes, médias, catégorie, collections, référencement, et sa `version`. À appeler avant de modifier un produit (update_product, manage_variants, archive_product) : repasse `version` à l'écriture pour ne pas écraser un changement fait entre-temps.",
    parameters: objet({ product_id: ID }, ["product_id"]),
    sortie: "{ product: { id, name, price, stock, variants[], collections[], … }, version }",
    exemple: { product_id: "cmf0abc123" },
    run: async (a, ctx) => {
      const p = await prisma.produit.findFirst({
        where: { id: requis(a, "product_id", 64), tenantId: ctx.tenantId },
        include: {
          variantes: { take: 100, orderBy: { nom: "asc" } },
          collections: { select: { id: true, nom: true } },
          fournisseur: { select: { id: true, nom: true } },
        },
      });
      if (!p) return refuser("NOT_FOUND", "Produit introuvable dans cette boutique.");
      const couts = peutLire(ctx, "finance"); // coût d'achat et prix fournisseur : comme dans l'interface, réservés à qui voit les finances
      const product = {
        id: p.id, name: p.nom, slug: p.slug, type: p.type, active: p.actif, listed: p.visibleListage, featured: p.featured,
        description: p.description?.slice(0, 2000) ?? null, category: p.categorie, tags: p.tags, brand: p.marque,
        price: p.prix, compare_at_price: p.prixCompare, ...(couts && { cost: p.cout, supplier_price: p.prixFournisseur }),
        sku: p.sku, barcode: p.codeBarres, weight: p.poids, unit: p.uniteVente,
        stock: p.variantes.length ? p.variantes.filter((v) => v.actif).reduce((s, v) => s + v.stock, 0) : p.stock, reserved: p.stockReserve, reorder_point: p.stockMin,
        images: p.images, videos: p.videos, meta_title: p.metaTitle, meta_description: p.metaDesc,
        sales: p.ventes, views: p.vues, supplier: p.fournisseur, collections: p.collections.map((c) => ({ id: c.id, name: c.nom })),
        variants: p.variantes.map((v) => ({ id: v.id, name: v.nom, value: v.valeur, price: v.prix, stock: v.stock, sku: v.sku, barcode: v.codeBarres, image: v.image, active: v.actif, ...(couts && { cost: v.cout }) })),
        created_at: p.createdAt.toISOString(),
      };
      return lu(`Produit « ${p.nom} »${p.actif ? "" : " (archivé / brouillon)"}.`, { product, version: p.updatedAt.toISOString() });
    },
  },
  {
    name: "create_product", module: "produits", niveau: "ecriture", risque: "faible", capacite: "catalogue",
    description: "Crée un produit COMPLET en une seule opération : fiche, variantes (tailles, couleurs…), images, vidéos et stock initial — tout est créé, ou rien. Le produit naît en BROUILLON (invisible sur la boutique) : mets-le en vente avec archive_product (archived=false). Préfère cet outil à ajouter_produit dès qu'il y a des variantes, plusieurs médias ou un stock par variante.",
    parameters: objet({
      ...PROPRIETES_PRODUIT,
      price: { type: "number", description: "Prix de vente, dans la devise de la boutique" },
      compare_at_price: { type: "number", description: "Prix barré" },
      type: { type: "string", enum: TYPES_PRODUIT, description: "physique (défaut), digital ou dropshipping" },
      stock: { type: "number", description: "Stock initial (produit physique sans variante ; en grammes pour un produit vendu au kg)" },
      reorder_point: { type: "number", description: "Seuil de réapprovisionnement" },
      variants: { type: "array", description: "50 au plus. Avec des variantes, le stock se donne par variante.", items: { type: "object", properties: { ...PROPRIETES_VARIANTE, stock: { type: "number" } }, required: ["name", "value"] } },
      collection_ids: { type: "array", items: { type: "string" } },
      file_url: { type: "string", description: "Fichier livré après achat (produit digital)" }, file_name: { type: "string" },
      supplier_id: { type: "string", description: "Fournisseur (lister_fournisseurs)" }, supplier_price: { type: "number" }, supplier_url: { type: "string" },
    }, ["name", "price"]),
    sortie: "{ product_id, version, active: false, variants, stock }",
    exemple: { name: "Robe wax Amina", price: 15000, category: "Robes", images: ["https://…/robe.jpg"], variants: [{ name: "Taille", value: "M", stock: 4 }, { name: "Taille", value: "L", stock: 2 }] },
    run: async (a, ctx) => {
      const tenantId = ctx.tenantId;
      const nom = requis(a, "name", 150);
      const prix = nombre(a, "price", { requis: true, min: 0 })!;
      const type = parmi(a, "type", TYPES_PRODUIT, "physique");
      const stock = nombre(a, "stock", { entier: true, max: 10_000_000 }) ?? 0;
      const variantes = (liste(a, "variants", 50) ?? []).map((v: Args) => ({
        ...sansVides(champsVariante(v)), nom: requis(v, "name", 40), valeur: requis(v, "value", 60), stock: nombre(v, "stock", { entier: true, max: 10_000_000 }) ?? 0,
      }));
      if (type !== "physique" && (stock || variantes.some((v) => v.stock))) return refuser("INVALID_INPUT", "Seul un produit physique a un stock suivi : retire « stock ».");
      const champs = champsProduit(a);
      const collections = textes(a, "collection_ids", 20, 64) ?? [];
      const fournisseurId = texte(a, "supplier_id", { max: 64 });
      await exigerTous(prisma.collection.count({ where: { tenantId, id: { in: collections } } }), collections, "collection_ids");
      await exigerTous(prisma.fournisseur.count({ where: { tenantId, id: fournisseurId ?? "" } }), fournisseurId ? [fournisseurId] : [], "supplier_id");
      const slug = await slugLibre(tenantId, nom);

      // Produit, variantes, médias et stock dans UNE transaction : une rupture au milieu ne laisse rien derrière elle.
      const cree = await prisma.$transaction(async (tx) => {
        const p = await tx.produit.create({
          data: {
            ...champs, tenantId, nom, slug, prix, type, actif: false, stock: 0,
            prixCompare: nombre(a, "compare_at_price"), stockMin: nombre(a, "reorder_point", { entier: true, max: 10_000_000 }),
            fichierUrl: url(a, "file_url"), fichierNom: texte(a, "file_name", { max: 150 }),
            fournisseurId, prixFournisseur: nombre(a, "supplier_price"), urlFournisseur: url(a, "supplier_url"),
            ...(collections.length && { collections: { connect: collections.map((id) => ({ id })) } }),
          },
          select: { id: true },
        });
        // Le stock initial entre par le journal (StockMouvement), comme une réception : il reste traçable.
        const lieu = type === "physique" ? await resoudreLieu(tx, tenantId) : null;
        const entrer = async (quantite: number, varianteId?: string) => {
          if (quantite > 0) await mouvementStock(tx, { tenantId, produitId: p.id, varianteId, type: "entree", quantite, motif: `Stock initial — IA ${ctx.client}`, creePar: ctx.userId, lieu });
        };
        for (const { stock: quantite, ...v } of variantes) {
          const variante = await tx.variante.create({ data: { ...v, produitId: p.id }, select: { id: true } });
          await entrer(quantite, variante.id);
        }
        if (!variantes.length) await entrer(stock);
        // Médias produits par Axso (MediaIA) : on note où ils servent.
        const medias = await tx.mediaIA.findMany({ where: { tenantId, url: { in: [...(champs.images ?? []), ...(champs.videos ?? [])] } }, select: { id: true, usage: true } });
        for (const m of medias) {
          const usage = (m.usage ?? {}) as Record<string, any>;
          await tx.mediaIA.update({ where: { id: m.id }, data: { usage: { ...usage, produits: [...new Set([...(usage.produits ?? []), p.id])] } } });
        }
        return tx.produit.findUniqueOrThrow({ where: { id: p.id }, select: { id: true, updatedAt: true } });
      }, { timeout: 20_000 });

      const total = variantes.length ? variantes.reduce((s, v) => s + v.stock, 0) : stock;
      return ok(
        `Produit « ${nom} » créé en BROUILLON (${variantes.length} variante(s), ${(champs.images ?? []).length} image(s), stock ${total}). Il n'est pas encore visible sur la boutique : archive_product avec archived=false le met en vente.`,
        { product_id: cree.id, version: cree.updatedAt.toISOString(), active: false, variants: variantes.length, stock: total },
      );
    },
  },
  {
    name: "update_product", module: "produits", niveau: "ecriture", risque: "faible", capacite: "catalogue",
    description: "Modifie la fiche d'un produit : nom, description, catégorie, tags, images, vidéos, référence, code-barres, coût, poids, marque, mise en avant, référencement. Ne change NI le prix (mettre_a_jour_prix), NI le stock (adjust_inventory), NI la mise en vente (archive_product). Ne renseigne que les champs à changer.",
    parameters: objet({ product_id: ID, version: VERSION, ...PROPRIETES_PRODUIT }, ["product_id"]),
    sortie: "{ product_id, version, changed: [champs modifiés] }",
    exemple: { product_id: "cmf0abc123", version: "2026-10-13T09:12:44.120Z", description: "Robe en wax 100 % coton, coupe évasée.", tags: ["wax", "robe"] },
    run: async (a, ctx) => {
      const p = await produitDe(ctx.tenantId, requis(a, "product_id", 64));
      const data = champsProduit(a);
      if (!Object.keys(data).length) return refuser("INVALID_INPUT", "Aucun champ à modifier.");
      const maj = await prisma.produit.update({ where: { id: p.id }, data, select: { updatedAt: true } });
      return ok(`Produit « ${data.nom ?? p.nom} » mis à jour (${Object.keys(data).join(", ")}).`, { product_id: p.id, version: maj.updatedAt.toISOString(), changed: Object.keys(data) });
    },
  },
  {
    // Effet réel : Produit.actif. Rien n'est supprimé, les commandes passées gardent leurs lignes ; mais le produit
    // quitte (ou rejoint) la vitrine tout de suite — c'est une publication, donc risque moyen.
    name: "archive_product", module: "produits", niveau: "ecriture", risque: "moyen", capacite: "catalogue",
    description: "Retire un produit de la vente (archived=true, défaut) ou le remet en vente (archived=false) — c'est aussi ainsi qu'on publie un brouillon créé par create_product. Rien n'est supprimé : fiche, stock et historique des ventes sont gardés. À préférer à la suppression pour un produit qui ne se vend plus.",
    parameters: objet({ product_id: ID, archived: { type: "boolean", description: "true (défaut) = retirer de la vente ; false = remettre en vente" }, version: VERSION }, ["product_id"]),
    sortie: "{ product_id, active, version }",
    exemple: { product_id: "cmf0abc123", archived: true },
    run: async (a, ctx) => {
      const p = await produitDe(ctx.tenantId, requis(a, "product_id", 64));
      const actif = booleen(a, "archived") === false;
      const maj = await prisma.produit.update({ where: { id: p.id }, data: { actif }, select: { updatedAt: true } });
      return ok(
        p.actif === actif ? `« ${p.nom} » était déjà ${actif ? "en vente" : "archivé"}.` : actif ? `« ${p.nom} » est en vente sur la boutique.` : `« ${p.nom} » est archivé : il n'apparaît plus sur la boutique (fiche, stock et historique gardés).`,
        { product_id: p.id, active: actif, version: maj.updatedAt.toISOString() },
      );
    },
  },
  {
    name: "duplicate_product", module: "produits", niveau: "ecriture", risque: "faible", capacite: "catalogue",
    description: "Copie un produit (fiche, médias, variantes) en BROUILLON, pour décliner une gamme sans tout ressaisir. La copie repart avec un stock à 0, sans ventes, sans référence ni code-barres (ils doivent rester uniques).",
    parameters: objet({ product_id: ID, name: { type: "string", description: "Nom de la copie (défaut : « <nom> (copie) »)" } }, ["product_id"]),
    sortie: "{ product_id (la copie), version, active: false }",
    exemple: { product_id: "cmf0abc123", name: "Robe wax Amina — édition bleue" },
    run: async (a, ctx) => {
      const source = await prisma.produit.findFirst({ where: { id: requis(a, "product_id", 64), tenantId: ctx.tenantId }, include: { variantes: true } });
      if (!source) return refuser("NOT_FOUND", "Produit introuvable dans cette boutique.");
      const { id: _id, slug: _slug, createdAt: _c, updatedAt: _u, ventes: _v, vues: _vu, stock: _s, stockReserve: _r, sku: _sku, codeBarres: _cb, chariowProduitId: _ch, variantes, faq, champsCommande, ...fiche } = source;
      const nom = texte(a, "name", { max: 150 }) ?? `${source.nom} (copie)`;
      const copie = await prisma.produit.create({
        data: {
          ...fiche, nom, slug: await slugLibre(ctx.tenantId, nom), actif: false, stock: 0,
          faq: faq ?? undefined, champsCommande: champsCommande ?? undefined,
          variantes: { create: variantes.map((v) => ({ nom: v.nom, valeur: v.valeur, prix: v.prix, image: v.image, actif: v.actif, dimension: v.dimension, cout: v.cout })) },
        },
        select: { id: true, updatedAt: true },
      });
      return ok(`« ${nom} » créé en BROUILLON à partir de « ${source.nom} » (${variantes.length} variante(s), stock à 0).`, { product_id: copie.id, version: copie.updatedAt.toISOString(), active: false });
    },
  },

  // ─── Catégories, collections, variantes ────────────────────────────────────
  {
    name: "get_catalog", module: "produits", niveau: "lecture", capacite: "catalogue",
    description: "Structure du catalogue : catégories (avec leurs attributs de variantes — Taille, Couleur… — et le nombre de produits) et collections. À appeler avant de ranger un produit ou de créer des variantes.",
    parameters: objet(),
    sortie: "{ categories: [{ id, name, attributes: [{ name, values[] }], products }], collections: [{ id, name, active, products }] }",
    exemple: {},
    run: async (_a, ctx) => {
      const [categories, comptes, collections] = await Promise.all([
        categoriesDeLaBoutique(ctx.tenantId),
        prisma.produit.groupBy({ by: ["categorie"], where: { tenantId: ctx.tenantId }, _count: true }),
        prisma.collection.findMany({ where: { tenantId: ctx.tenantId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, nom: true, actif: true, _count: { select: { produits: true } } } }),
      ]);
      return lu(`${categories.length} catégorie(s), ${collections.length} collection(s).`, {
        categories: categories.slice(0, 100).map((c) => ({ id: c.id, name: c.nom, attributes: nettoyerOptions(c.options).map((o) => ({ name: o.nom, values: o.valeurs })), products: comptes.find((x) => x.categorie === c.nom)?._count ?? 0 })),
        collections: collections.map((c) => ({ id: c.id, name: c.nom, active: c.actif, products: c._count.produits })),
      });
    },
  },
  {
    // Même règle que Catalogue → Catégories (app/api/categories) : Produit.categorie garde le NOM, un renommage suit donc les produits.
    name: "manage_categories", module: "produits", niveau: "ecriture", risque: "faible", capacite: "catalogue",
    description: "Crée ou modifie une catégorie de produits et ses ATTRIBUTS de variantes (ex. Taille : S, M, L ; Couleur : rouge, bleu). Renommer une catégorie renomme aussi la catégorie de ses produits. Pour supprimer : delete_catalog_item.",
    parameters: objet({
      action: { type: "string", enum: ["create", "update"] },
      category_id: { type: "string", description: "Catégorie à modifier (get_catalog)" },
      name: { type: "string" },
      attributes: { type: "array", description: "Remplace les attributs (10 au plus)", items: { type: "object", properties: { name: { type: "string" }, values: { type: "array", items: { type: "string" } } }, required: ["name", "values"] } },
      order: { type: "number", description: "Position dans la liste (0 = première)" },
      version: VERSION,
    }, ["action"]),
    sortie: "{ category_id, name, attributes }",
    exemple: { action: "create", name: "Robes", attributes: [{ name: "Taille", values: ["S", "M", "L"] }] },
    run: async (a, ctx) => {
      const tenantId = ctx.tenantId;
      const action = parmi(a, "action", ["create", "update"] as const);
      const nom = texte(a, "name", { max: 60 });
      const attributs = liste(a, "attributes", 10);
      const options = attributs && nettoyerOptions(attributs.map((o: Args) => ({ nom: o?.name, valeurs: o?.values })));
      const slug = nom ? slugify(nom) : "";
      if (nom && !slug) return refuser("INVALID_INPUT", "Nom de catégorie invalide.");
      const rendre = (c: { id: string; nom: string; options: unknown }, phrase: string) =>
        ok(phrase, { category_id: c.id, name: c.nom, attributes: nettoyerOptions(c.options).map((o) => ({ name: o.nom, values: o.valeurs })) });

      if (action === "create") {
        if (!nom) return refuser("INVALID_INPUT", "« name » est obligatoire pour créer une catégorie.");
        if (await prisma.categorieProduit.findUnique({ where: { tenantId_slug: { tenantId, slug } } })) return refuser("CONFLICT", `La catégorie « ${nom} » existe déjà.`);
        const c = await prisma.categorieProduit.create({ data: { tenantId, nom, slug, ordre: await prisma.categorieProduit.count({ where: { tenantId } }), options: options ?? [] } });
        return rendre(c, `Catégorie « ${nom} » créée.`);
      }
      const c = await prisma.categorieProduit.findFirst({ where: { id: requis(a, "category_id", 64), tenantId } });
      if (!c) return refuser("NOT_FOUND", "Catégorie introuvable dans cette boutique.");
      const renomme = !!nom && nom !== c.nom;
      if (renomme && await prisma.categorieProduit.findFirst({ where: { tenantId, slug, id: { not: c.id } } })) return refuser("CONFLICT", `La catégorie « ${nom} » existe déjà.`);
      const ordre = nombre(a, "order", { entier: true, max: 10_000 });
      const [maj] = await prisma.$transaction([
        prisma.categorieProduit.update({ where: { id: c.id }, data: { ...(options && { options }), ...(ordre !== undefined && { ordre }), ...(renomme && { nom, slug }) } }),
        ...(renomme ? [prisma.produit.updateMany({ where: { tenantId, categorie: c.nom }, data: { categorie: nom } })] : []),
      ]);
      return rendre(maj, `Catégorie « ${maj.nom} » mise à jour${renomme ? " (ses produits suivent le nouveau nom)" : ""}.`);
    },
  },
  {
    name: "manage_collections", module: "produits", niveau: "ecriture", risque: "faible", capacite: "catalogue",
    description: "Crée ou modifie une collection (sélection de produits mise en avant : « Nouveautés », « Fête des mères »…) et y ajoute ou en retire des produits. Pour supprimer : delete_catalog_item.",
    parameters: objet({
      action: { type: "string", enum: ["create", "update"] },
      collection_id: { type: "string", description: "Collection à modifier (get_catalog)" },
      name: { type: "string" }, description: { type: "string" }, image_url: { type: "string" },
      active: { type: "boolean", description: "false = collection masquée" },
      add_product_ids: { type: "array", items: { type: "string" }, description: "Produits à ajouter (100 au plus)" },
      remove_product_ids: { type: "array", items: { type: "string" }, description: "Produits à retirer" },
    }, ["action"]),
    sortie: "{ collection_id, name, active, products }",
    exemple: { action: "create", name: "Nouveautés", add_product_ids: ["cmf0abc123"] },
    run: async (a, ctx) => {
      const tenantId = ctx.tenantId;
      const action = parmi(a, "action", ["create", "update"] as const);
      const ajouter = textes(a, "add_product_ids", 100, 64) ?? [], retirer = textes(a, "remove_product_ids", 100, 64) ?? [];
      await exigerTous(prisma.produit.count({ where: { tenantId, id: { in: ajouter } } }), ajouter, "add_product_ids");
      const nom = texte(a, "name", { max: 80 });
      const champs = sansVides({ nom, slug: nom && (slugify(nom) || undefined), description: texte(a, "description", { max: 500 }), imageUrl: url(a, "image_url"), actif: booleen(a, "active") });
      const select = { id: true, nom: true, actif: true, _count: { select: { produits: true } } } as const;
      const lier = { ...(ajouter.length && { connect: ajouter.map((id) => ({ id })) }), ...(retirer.length && { disconnect: retirer.map((id) => ({ id })) }) };

      let c;
      if (action === "create") {
        if (!nom) return refuser("INVALID_INPUT", "« name » est obligatoire pour créer une collection.");
        c = await prisma.collection.create({ data: { ...champs, tenantId, nom, slug: slugify(nom) || "collection", produits: lier }, select });
      } else {
        const existante = await prisma.collection.findFirst({ where: { id: requis(a, "collection_id", 64), tenantId }, select: { id: true } });
        if (!existante) return refuser("NOT_FOUND", "Collection introuvable dans cette boutique.");
        c = await prisma.collection.update({ where: { id: existante.id }, data: { ...champs, produits: lier }, select });
      }
      return ok(`Collection « ${c.nom} » ${action === "create" ? "créée" : "mise à jour"} : ${c._count.produits} produit(s).`, { collection_id: c.id, name: c.nom, active: c.actif, products: c._count.produits });
    },
  },
  {
    // Une variante porte son propre prix : même niveau de risque qu'un changement de prix.
    name: "manage_variants", module: "produits", niveau: "ecriture", risque: "moyen", capacite: "catalogue",
    description: "Ajoute une variante à un produit (taille, couleur, contenance…) ou en modifie une : libellé, prix propre, référence, code-barres, image, coût, active ou non. Le STOCK d'une variante se règle avec adjust_inventory (variant_id). Pour supprimer : delete_catalog_item.",
    parameters: objet({
      action: { type: "string", enum: ["create", "update"] }, product_id: ID,
      variant_id: { type: "string", description: "Variante à modifier (get_product les liste)" },
      ...PROPRIETES_VARIANTE, active: { type: "boolean", description: "false = variante retirée de la vente" }, version: VERSION,
    }, ["action", "product_id"]),
    sortie: "{ product_id, variant_id, name, value, price, active }",
    exemple: { action: "create", product_id: "cmf0abc123", name: "Taille", value: "XL", price: 16000 },
    run: async (a, ctx) => {
      const p = await produitDe(ctx.tenantId, requis(a, "product_id", 64));
      const action = parmi(a, "action", ["create", "update"] as const);
      const champs = sansVides({ ...champsVariante(a), actif: booleen(a, "active") });
      const select = { id: true, nom: true, valeur: true, prix: true, actif: true } as const;
      let v;
      if (action === "create") {
        v = await prisma.variante.create({ data: { ...champs, produitId: p.id, nom: requis(a, "name", 40), valeur: requis(a, "value", 60) }, select });
      } else {
        const existante = await prisma.variante.findFirst({ where: { id: requis(a, "variant_id", 64), produitId: p.id }, select: { id: true } });
        if (!existante) return refuser("NOT_FOUND", `Variante introuvable sur « ${p.nom} ».`);
        if (!Object.keys(champs).length) return refuser("INVALID_INPUT", "Aucun champ à modifier.");
        v = await prisma.variante.update({ where: { id: existante.id }, data: champs, select });
      }
      // La version du produit avance aussi : une variante modifiée périme la fiche lue.
      await prisma.produit.update({ where: { id: p.id }, data: { updatedAt: new Date() } });
      return ok(`Variante « ${v.nom} : ${v.valeur} » ${action === "create" ? "ajoutée à" : "mise à jour sur"} « ${p.nom} »${action === "create" ? " (stock à 0 : adjust_inventory pour l'approvisionner)" : ""}.`,
        { product_id: p.id, variant_id: v.id, name: v.nom, value: v.valeur, price: v.prix, active: v.actif });
    },
  },
  {
    name: "delete_catalog_item", module: "produits", niveau: "ecriture", risque: "eleve", capacite: "catalogue",
    description: "SUPPRIME définitivement un élément du catalogue — un seul identifiant par appel : produit (jamais vendu ni mouvementé, sinon archive_product), variante (stock à 0), catégorie (ses produits restent, sans catégorie) ou collection (ses produits restent). Irréversible : préfère archive_product pour un produit qui ne se vend plus.",
    parameters: objet({ product_id: { type: "string" }, variant_id: { type: "string" }, category_id: { type: "string" }, collection_id: { type: "string" } }),
    sortie: "{ deleted: { type, id, name } }",
    exemple: { collection_id: "cmf0col456" },
    run: async (a, ctx) => {
      const tenantId = ctx.tenantId;
      const cibles = (["product_id", "variant_id", "category_id", "collection_id"] as const).filter((k) => texte(a, k, { max: 64 }));
      if (cibles.length !== 1) return refuser("INVALID_INPUT", "Donne exactement un identifiant : product_id, variant_id, category_id ou collection_id.");
      const id = requis(a, cibles[0], 64);
      const fait = (type: string, name: string) => ok(`${type} « ${name} » supprimé(e) définitivement.`, { deleted: { type, id, name } });

      if (cibles[0] === "product_id") {
        const p = await prisma.produit.findFirst({ where: { id, tenantId }, select: { nom: true, _count: { select: { lignesCommande: true, stockMouvements: true } } } });
        if (!p) return refuser("NOT_FOUND", "Produit introuvable dans cette boutique.");
        // Un produit qui a une histoire (ventes, stock) ne se supprime pas : factures et journal de stock y renvoient.
        if (p._count.lignesCommande || p._count.stockMouvements) return refuser("CONFLICT", `« ${p.nom} » a déjà été vendu ou mouvementé en stock : il ne peut pas être supprimé. Utilise archive_product pour le retirer de la vente.`);
        await prisma.$transaction([
          prisma.stockEntrepot.deleteMany({ where: { produitId: id } }),
          prisma.variante.deleteMany({ where: { produitId: id } }),
          prisma.produit.delete({ where: { id } }),
        ]);
        return fait("Produit", p.nom);
      }
      if (cibles[0] === "variant_id") {
        const v = await prisma.variante.findFirst({ where: { id, produit: { tenantId } }, select: { nom: true, valeur: true, stock: true, produitId: true } });
        if (!v) return refuser("NOT_FOUND", "Variante introuvable dans cette boutique.");
        if (v.stock > 0) return refuser("CONFLICT", `Il reste ${v.stock} unité(s) de « ${v.nom} : ${v.valeur} » : remets son stock à 0 (adjust_inventory) ou désactive-la (manage_variants, active=false).`);
        await prisma.$transaction([prisma.stockEntrepot.deleteMany({ where: { varianteId: id } }), prisma.variante.delete({ where: { id } })]);
        return fait("Variante", `${v.nom} : ${v.valeur}`);
      }
      if (cibles[0] === "category_id") {
        const c = await prisma.categorieProduit.findFirst({ where: { id, tenantId }, select: { nom: true } });
        if (!c) return refuser("NOT_FOUND", "Catégorie introuvable dans cette boutique.");
        await prisma.$transaction([
          prisma.produit.updateMany({ where: { tenantId, categorie: c.nom }, data: { categorie: null } }),
          prisma.categorieProduit.delete({ where: { id } }),
        ]);
        return fait("Catégorie", c.nom);
      }
      const c = await prisma.collection.findFirst({ where: { id, tenantId }, select: { nom: true } });
      if (!c) return refuser("NOT_FOUND", "Collection introuvable dans cette boutique.");
      await prisma.collection.delete({ where: { id } });
      return fait("Collection", c.nom);
    },
  },

  // ─── Stock ─────────────────────────────────────────────────────────────────
  {
    name: "get_inventory", module: "produits", niveau: "lecture", capacite: "stock",
    description: "État du stock. Sans product_id : niveaux de tous les produits physiques, du plus bas au plus haut (paginé). Avec product_id : détail par variante — présent, réservé par des paniers, bloqué, abîmé, DISPONIBLE, en transit, en commande — pour toute la boutique ou un entrepôt. view=movements : journal des mouvements d'un produit. view=transfers : transferts entre entrepôts. Pour les ruptures et le réassort conseillé : pos_produits_rupture et pos_quoi_commander.",
    parameters: objet({
      view: { type: "string", enum: ["levels", "movements", "transfers"], description: "levels par défaut" },
      product_id: { type: "string" }, warehouse_id: { type: "string", description: "Entrepôt (les entrepôts sont listés dans la réponse)" },
      status: { type: "string", description: "view=transfers : en_cours (défaut), brouillon, demande, approuve, en_preparation, expedie, recu, annule ou all" },
      limit: { type: "number", description: "20 par défaut, 50 au plus" }, offset: { type: "number" },
    }),
    sortie: "levels : { items[], total, warehouses[] } ou { product, articles[], warehouses[] } ; movements : { movements[] } ; transfers : { transfers[] }",
    exemple: { product_id: "cmf0abc123" },
    run: async (a, ctx) => {
      const tenantId = ctx.tenantId;
      const vue = parmi(a, "view", ["levels", "movements", "transfers"] as const, "levels");
      const max = limite(a, 20, 50);
      const produitId = texte(a, "product_id", { max: 64 });
      const entrepotId = texte(a, "warehouse_id", { max: 64 }) ?? null;

      if (vue === "transfers") {
        // Lecture seule : listerTransferts ne lit que la boutique du contexte.
        const r = await listerTransferts({ tenantId, userId: ctx.userId, userNom: "", magasinId: "", caisseId: "", droits: TOUS_DROITS }, { statut: texte(a, "status", { max: 30 }) ?? "en_cours", limite: max });
        return lu(`${r.transferts.length} transfert(s).`, { transfers: r.transferts.map((t) => ({ id: t.id, number: t.numero, status: t.statut, from: t.source, to: t.destination, lines: t.lignes, requested: t.demande, shipped: t.expedie, received: t.recu, created_at: t.createdAt })) });
      }
      if (vue === "movements") {
        if (!produitId) return refuser("INVALID_INPUT", "view=movements demande « product_id ».");
        const p = await produitDe(tenantId, produitId);
        const mouvements = await prisma.stockMouvement.findMany({ where: { tenantId, produitId: p.id }, orderBy: { createdAt: "desc" }, take: max, skip: decalage(a) });
        return lu(`${mouvements.length} dernier(s) mouvement(s) de « ${p.nom} ».`, { product_id: p.id, movements: mouvements.map((m) => ({ type: m.type, quantity: m.quantite, before: m.stockAvant, after: m.stockApres, reason: m.motif, variant_id: m.varianteId, warehouse_id: m.entrepotId, order_id: m.commandeId, at: m.createdAt.toISOString() })) });
      }

      const entrepots = (await prisma.entrepot.findMany({ where: { tenantId, actif: true }, select: { id: true, nom: true, principal: true }, take: 30 })).map((e) => ({ id: e.id, name: e.nom, main: e.principal }));
      if (produitId) {
        const p = await prisma.produit.findFirst({ where: { id: produitId, tenantId }, select: { id: true, nom: true, type: true, uniteVente: true, stockMin: true, variantes: { where: { actif: true }, select: { id: true, nom: true, valeur: true }, take: 30 } } });
        if (!p) return refuser("NOT_FOUND", "Produit introuvable dans cette boutique.");
        if (p.type !== "physique") return lu(`« ${p.nom} » (${p.type}) n'a pas de stock suivi.`, { product: { id: p.id, name: p.nom, type: p.type }, articles: [] });
        const articles = [];
        for (const v of p.variantes.length ? p.variantes : [null]) {
          const d = await disponibilite(tenantId, p.id, v?.id, entrepotId);
          articles.push({ variant_id: v?.id ?? null, variant: v ? `${v.nom}: ${v.valeur}` : null, on_hand: d.physique, reserved: d.reserve, blocked: d.bloque, damaged: d.endommage, available: d.disponible, in_transit: d.enTransit, on_order: d.enCommande });
        }
        return lu(`Stock de « ${p.nom} »${entrepotId ? " dans cet entrepôt" : ""} : ${articles.reduce((s, x) => s + x.available, 0)} disponible(s)${p.uniteVente === "kg" ? " (en grammes)" : ""}.`,
          { product: { id: p.id, name: p.nom, unit: p.uniteVente, reorder_point: p.stockMin }, articles, warehouses: entrepots });
      }
      const where = { tenantId, type: "physique", actif: true };
      const [produits, total] = await Promise.all([
        prisma.produit.findMany({ where, orderBy: [{ stock: "asc" }, { id: "asc" }], take: max, skip: decalage(a), select: { id: true, nom: true, sku: true, stock: true, stockMin: true, stockReserve: true, variantes: { where: { actif: true }, select: { stock: true } } } }),
        prisma.produit.count({ where }),
      ]);
      // ponytail: tri sur Produit.stock, qui ne suit pas le total d'un produit à variantes ; passer à une requête SQL (somme des variantes) si l'ordre exact compte.
      return lu(`${produits.length} produit(s) physiques sur ${total}, du stock le plus bas au plus haut.`, {
        items: produits.map((p) => ({ product_id: p.id, name: p.nom, sku: p.sku, stock: p.variantes.length ? p.variantes.reduce((s, v) => s + v.stock, 0) : p.stock, variants: p.variantes.length, reserved: p.stockReserve, reorder_point: p.stockMin })),
        total, warehouses: entrepots,
      });
    },
  },
  {
    // Le stock est strict (une rupture refuse la vente) : un mauvais ajustement bloque ou ouvre des ventes à tort.
    name: "adjust_inventory", module: "produits", niveau: "ecriture", risque: "moyen", capacite: "stock",
    description: "Corrige le stock d'un produit physique (ou d'une variante), avec un motif gardé dans le journal : add (réception, retour en rayon), remove (sortie), loss (casse, vol, périmé) ou set (fixer la quantité réellement comptée). Refusé si la sortie dépasse le stock. Pour un produit à variantes, précise variant_id. Pour un produit vendu au kg, les quantités sont en grammes.",
    parameters: objet({
      product_id: ID, variant_id: { type: "string" }, warehouse_id: { type: "string", description: "Entrepôt concerné (défaut : entrepôt principal)" },
      mode: { type: "string", enum: ["add", "remove", "loss", "set"] },
      quantity: { type: "number", description: "Entier. add/remove/loss : quantité à déplacer (≥ 1). set : quantité finale (≥ 0)." },
      reason: { type: "string", description: "Motif, visible par le marchand dans le journal de stock" }, version: VERSION,
    }, ["product_id", "mode", "quantity", "reason"]),
    sortie: "{ product_id, variant_id, before, after, warehouse_stock }",
    exemple: { product_id: "cmf0abc123", mode: "set", quantity: 12, reason: "Inventaire du 13 octobre" },
    run: async (a, ctx) => {
      const tenantId = ctx.tenantId;
      const mode = parmi(a, "mode", ["add", "remove", "loss", "set"] as const);
      const quantite = nombre(a, "quantity", { requis: true, entier: true, min: mode === "set" ? 0 : 1, max: 10_000_000 })!;
      const motif = requis(a, "reason", 200);
      const varianteId = texte(a, "variant_id", { max: 64 }) ?? null;
      const entrepotId = texte(a, "warehouse_id", { max: 64 }) ?? null;
      const p = await prisma.produit.findFirst({ where: { id: requis(a, "product_id", 64), tenantId }, select: { id: true, nom: true, _count: { select: { variantes: { where: { actif: true } } } } } });
      if (!p) return refuser("NOT_FOUND", "Produit introuvable dans cette boutique.");
      if (!varianteId && p._count.variantes) return refuser("INVALID_INPUT", `« ${p.nom} » a des variantes : précise « variant_id » (get_product les liste).`);

      const r = await prisma.$transaction(async (tx) => {
        const lieu = await resoudreLieu(tx, tenantId, entrepotId);
        let ecart = quantite;
        if (mode === "set") {
          // Écart signé entre la quantité comptée et ce que le système croit avoir (dans l'entrepôt visé, sinon au total).
          const total = varianteId
            ? (await tx.variante.findFirst({ where: { id: varianteId, produitId: p.id }, select: { stock: true } }))?.stock
            : (await tx.produit.findUniqueOrThrow({ where: { id: p.id }, select: { stock: true } })).stock;
          if (total === undefined) return refuser("NOT_FOUND", `Variante introuvable sur « ${p.nom} ».`);
          const present = entrepotId ? (await stocksDuLieu(tx, tenantId, entrepotId, [{ produitId: p.id, varianteId, stock: total }])).get(cleArticle(p.id, varianteId)) ?? 0 : total;
          ecart = quantite - present;
        }
        return mouvementStock(tx, { tenantId, produitId: p.id, varianteId, lieu, type: MOUVEMENTS[mode], quantite: ecart, motif: `${motif} — IA ${ctx.client}`, creePar: ctx.userId });
      });
      return ok(`Stock de « ${p.nom} » : ${r.stockAvant} → ${r.stockApres}${r.stockAvant === r.stockApres ? " (déjà à cette quantité, rien n'a bougé)" : ""}.`,
        { product_id: p.id, variant_id: varianteId, before: r.stockAvant, after: r.stockApres, warehouse_stock: r.stockEntrepot });
    },
  },
  {
    // Le stock bouge à l'expédition (sortie de la source) et à la réception (entrée à destination).
    name: "transfer_inventory", module: "produits", niveau: "ecriture", risque: "moyen", capacite: "stock",
    description: "Fait avancer un transfert de stock entre deux entrepôts ou magasins, déjà préparé avec pos_preparer_transfert : request (demander), approve, prepare, ship (expédie tout ce qui est demandé : le stock quitte la source), receive (réceptionne tout ce qui reste attendu : le stock entre à destination), cancel (avant expédition). get_inventory view=transfers donne les numéros.",
    parameters: objet({
      transfer: { type: "string", description: "Numéro (TR-…) ou identifiant du transfert" },
      action: { type: "string", enum: Object.keys(ACTIONS_TRANSFERT) }, reason: { type: "string" },
    }, ["transfer", "action"]),
    sortie: "{ transfer_id, number, status, gaps: [{ name, shipped, received }] }",
    exemple: { transfer: "TR-20261013-K3P9QX", action: "ship" },
    run: async (a, ctx) => {
      const ref = requis(a, "transfer", 64);
      const action = parmi(a, "action", Object.keys(ACTIONS_TRANSFERT));
      const t = await prisma.transfertStock.findFirst({ where: { tenantId: ctx.tenantId, OR: [{ id: ref }, { numero: ref }] }, select: { id: true } });
      if (!t) return refuser("NOT_FOUND", "Transfert introuvable dans cette boutique (get_inventory view=transfers les liste).");
      const pos = await contextePos(ctx);
      const lignes = action === "receive"
        ? (await lireTransfert(pos, t.id)).lignes.map((l) => ({ ligneId: l.id, quantite: l.quantiteExpediee - l.quantiteRecue })).filter((l) => l.quantite > 0)
        : undefined;
      const r = await actionTransfert(pos, t.id, { cle: `ia:${randomUUID()}`, action: ACTIONS_TRANSFERT[action], ...(action === "ship" && { tout: true }), ...(lignes && { lignes }), motif: texte(a, "reason", { max: 300 }) });
      return ok(`Transfert ${r.numero} : ${r.statut}.${r.ecarts.length ? ` Écarts : ${r.ecarts.map((e) => `${e.nom} (${e.recu}/${e.expedie})`).join(", ")}.` : ""}`,
        { transfer_id: r.transfertId, number: r.numero, status: r.statut, gaps: r.ecarts.map((e) => ({ name: e.nom, shipped: e.expedie, received: e.recu })) });
    },
  },
  {
    name: "set_reorder_rules", module: "produits", niveau: "ecriture", risque: "faible", capacite: "stock",
    description: "Fixe le seuil de réapprovisionnement de produits physiques : sous ce stock, Axso alerte le marchand et propose un réassort (pos_quoi_commander s'en sert comme stock de sécurité). Un seul seuil par appel, pour 1 à 50 produits ; reorder_point=null retire le seuil.",
    parameters: objet({ product_ids: { type: "array", items: { type: "string" } }, reorder_point: { type: ["number", "null"], description: "Entier ≥ 0, ou null pour retirer le seuil" } }, ["product_ids", "reorder_point"]),
    sortie: "{ updated, reorder_point }",
    exemple: { product_ids: ["cmf0abc123", "cmf0abc456"], reorder_point: 5 },
    run: async (a, ctx) => {
      const ids = textes(a, "product_ids", 50, 64) ?? [];
      if (!ids.length) return refuser("INVALID_INPUT", "« product_ids » est obligatoire.");
      const seuil = a.reorder_point === null ? null : nombre(a, "reorder_point", { requis: true, entier: true, max: 10_000_000 })!;
      const { count } = await prisma.produit.updateMany({ where: { tenantId: ctx.tenantId, id: { in: ids }, type: "physique" }, data: { stockMin: seuil } });
      if (!count) return refuser("NOT_FOUND", "Aucun de ces produits n'est un produit physique de cette boutique.");
      return ok(`Seuil de réapprovisionnement ${seuil === null ? "retiré" : `fixé à ${seuil}`} pour ${count} produit(s)${count < ids.length ? ` (${ids.length - count} ignoré(s) : introuvable ou sans stock suivi)` : ""}.`, { updated: count, reorder_point: seuil });
    },
  },
];
