// Fournisseurs d'un produit : comparaison et recommandation.
// GET   /api/pos/achats/fournisseurs?produitId=&quantite= — droit : achat_creer ou achat_valider.
//   Réponse : ComparaisonFournisseurs (lib/pos/achats/fournisseurs.ts) + { peutChoisir }.
//   Les prix d'achat ne sont montrés qu'à ceux qui achètent : ces deux droits y donnent accès.
// PATCH /api/pos/achats/fournisseurs — droit : achat_valider. Corps : { produitId, offreId }.
//   Désigne le fournisseur principal du produit. Réponse : { ok, produitId, offreId }.
import { z } from "zod";
import { routePos } from "@/lib/pos/acces";
import { aDroit, exigerUnDroit } from "@/lib/pos/droits";
import { erreurs } from "@/lib/pos/erreurs";
import { comparerFournisseursProduit, definirFournisseurPrincipal } from "@/lib/pos/achats/fournisseurs";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "achat_creer", "achat_valider");
  const q = new URL(req.url).searchParams;
  const produitId = q.get("produitId");
  if (!produitId) throw erreurs.invalide("Aucun produit n'a été choisi.");
  return { ...(await comparerFournisseursProduit(ctx.tenantId, produitId, Number(q.get("quantite")) || undefined)), peutChoisir: aDroit(ctx, "achat_valider") };
});

export const PATCH = routePos(async (ctx, req) => {
  const { produitId, offreId } = z.object({ produitId: z.string().min(1), offreId: z.string().min(1) }).parse(await req.json());
  return definirFournisseurPrincipal(ctx, produitId, offreId);
});
