// Recherche de la vente d'origine d'un retour.
// GET /api/pos/retours/ventes?q= — par numéro de vente ou de facture (scan du
// reçu), client (nom, téléphone), numéro de série ou nom d'article. Sans `q` :
// dernières ventes de la caisse. Rend aussi la politique de retour (délai,
// sans reçu) et, par ligne, ce qui reste retournable. Droit : retour.
import { routePos } from "@/lib/pos/acces";
import { rechercherVentesRetour } from "@/lib/pos/retours";

export const GET = routePos(async (ctx, req) => rechercherVentesRetour(ctx, new URL(req.url).searchParams.get("q")));
