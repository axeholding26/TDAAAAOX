// Création rapide d'un produit depuis la caisse (code scanné non reconnu).
// POST /api/pos/produits — droit : creer_produit (module « pos » en écriture au proxy).
// Corps : { cle, nom, codeBarres?, categorie?, prix, cout?, tauxTVA? (fraction),
//           uniteVente: "piece" | "kg", stockInitial (pièces, ou GRAMMES si kg) }
// Réponse : 201 { ok, article: ArticleResolu, rejoue }.
//
// Pourquoi pas POST /api/produits : son schéma (lib/validations.ts) retire
// `tauxTVA` et `uniteVente`, ne contrôle pas le droit « creer_produit », n'écrit
// ni audit ni mouvement de stock. Ici : même transaction pour le produit, son
// stock initial (mouvementStock), le journal d'audit et l'événement.
import { NextResponse } from "next/server";
import { z } from "zod";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { journaliserAudit } from "@/lib/pos/audit";
import { exigerDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { publierEvenement } from "@/lib/pos/evenements";
import { avecIdempotence } from "@/lib/pos/idempotence";
import { entrepotDuMagasin } from "@/lib/pos/magasins";
import { mouvementStock } from "@/lib/pos/stock";
import type { ArticleResolu } from "@/lib/pos/types";
import { slugify } from "@/lib/utils";

const schema = z.object({
  cle: z.string().trim().min(8).max(200).optional(),
  nom: z.string().trim().min(2, "Le nom doit compter au moins 2 caractères.").max(120),
  codeBarres: z.string().trim().min(1).max(64).nullish(),
  categorie: z.string().trim().max(80).nullish(),
  /** À la pièce, ou au KILO pour un produit au poids. */
  prix: z.number().finite().positive("Le prix de vente doit être supérieur à zéro.").max(1e12),
  cout: z.number().finite().min(0).max(1e12).nullish(),
  /** Fraction (0.1925) ; absent = taux de la boutique. */
  tauxTVA: z.number().finite().min(0).max(1).nullish(),
  uniteVente: z.enum(["piece", "kg"]).default("piece"),
  stockInitial: z.number().int().min(0).max(10_000_000).default(0),
});

export const POST = routePos(async (ctx, req) => {
  exigerDroit(ctx, "creer_produit");
  const d = schema.parse(await req.json());
  const cle = cleIdempotence(req, d);
  if (!cle) throw new ErreurPos("invalide", 400, "La demande n'a pas d'identifiant. Rechargez la page puis réessayez.");

  try {
    const { resultat, rejoue } = await avecIdempotence<ArticleResolu>(ctx.tenantId, cle, "produit.creer", async (tx) => {
      const produit = await tx.produit.create({
        data: {
          tenantId: ctx.tenantId, nom: d.nom,
          slug: `${slugify(d.nom) || "produit"}-${Math.random().toString(36).slice(2, 8)}`,
          prix: d.prix, cout: d.cout ?? null, tauxTVA: d.tauxTVA ?? null, uniteVente: d.uniteVente,
          codeBarres: d.codeBarres || null, categorie: d.categorie || null, type: "physique", stock: 0,
        },
      });
      if (d.stockInitial > 0) {
        await mouvementStock(tx, {
          tenantId: ctx.tenantId, produitId: produit.id, type: "entree", quantite: d.stockInitial,
          entrepotId: await entrepotDuMagasin(tx, ctx.tenantId, ctx.magasinId), motif: "Stock initial (création en caisse)", creePar: ctx.userId,
        });
      }
      await journaliserAudit(tx, ctx, {
        action: "produit.cree", entite: "Produit", entiteId: produit.id,
        apres: { nom: d.nom, prix: d.prix, cout: d.cout ?? null, tauxTVA: d.tauxTVA ?? null, uniteVente: d.uniteVente, codeBarres: d.codeBarres ?? null, categorie: d.categorie ?? null, stockInitial: d.stockInitial },
      });
      if (d.stockInitial > 0) {
        await publierEvenement(tx, { tenantId: ctx.tenantId, magasinId: ctx.magasinId, type: "inventory.updated", payload: { origine: "produit.cree", produitIds: [produit.id] } });
      }
      return {
        produitId: produit.id, varianteId: null, nom: produit.nom, variante: null, prix: produit.prix, cout: produit.cout, tauxTVA: produit.tauxTVA,
        uniteVente: d.uniteVente, image: null, sku: null, codeBarres: produit.codeBarres, categorie: produit.categorie, marque: null,
        stock: d.stockInitial, stockMagasin: d.stockInitial, suiviSerie: false, actif: true, variantes: [],
      };
    }, { appareilId: ctx.appareilId, userId: ctx.userId });
    return NextResponse.json({ ok: true, article: resultat, rejoue }, { status: rejoue ? 200 : 201 });
  } catch (e) {
    // Unicité (boutique, code-barres) : traitée autour de la transaction, jamais dedans.
    if ((e as { code?: string })?.code === "P2002") throw new ErreurPos("conflit", 409, "Ce code-barres est déjà utilisé par un autre produit de la boutique. Recherchez-le dans le catalogue.");
    throw e;
  }
});
