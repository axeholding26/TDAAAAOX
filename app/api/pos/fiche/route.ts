// Fiche produit universelle (§10).
// GET /api/pos/fiche?code=            — article désigné par un code lu (code-barres, SKU, numéro de série, étiquette de balance)
// GET /api/pos/fiche?produitId=&varianteId=
//   Réponse : { fiche } (lib/pos/operations/fiche.ts → FicheProduit). 404 « inconnu » si le code ne correspond à rien.
//   Coût, marge et prix d'achat sont null sans le droit voir_couts (fiche.coutsVisibles = false).
//   Droit : voir_stock, scanner ou vendre. Accepte un téléphone appairé.
import { routePos } from "@/lib/pos/acces";
import { exigerUnDroit } from "@/lib/pos/droits";
import { ficheProduit } from "@/lib/pos/operations/fiche";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "voir_stock", "scanner", "vendre");
  const p = new URL(req.url).searchParams;
  return { fiche: await ficheProduit(ctx, { code: p.get("code"), produitId: p.get("produitId"), varianteId: p.get("varianteId") }) };
});
