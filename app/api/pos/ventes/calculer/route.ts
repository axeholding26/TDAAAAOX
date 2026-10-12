// Aperçu d'un panier, calculé par le serveur avec les prix relus en base.
// POST /api/pos/ventes/calculer — droit : vendre. Corps : schemaPanier.
// N'écrit rien. Rend le panier calculé (totaux, taxes, remises, alertes de
// droits) : c'est exactement ce que la vente enregistrera.
import { routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { schemaPanier } from "@/lib/pos/schemas";
import { preparerPanier } from "@/lib/pos/vente";

export const POST = routePos(async (ctx, req) => {
  exigerDroit(ctx, "vendre");
  const { panier, devise, client } = await preparerPanier(ctx, schemaPanier.parse(await req.json()));
  return { panier, devise, client };
});
