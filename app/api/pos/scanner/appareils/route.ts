// Appareils enregistrés (téléphones-scanners) et leur état de connexion.
// GET /api/pos/scanner/appareils — ceux de la caisse de travail (en-tête x-pos-caisse).
// GET /api/pos/scanner/appareils?portee=boutique — tous (droit : gerer_appareils ou voir_caisse).
import { routePos } from "@/lib/pos/acces";
import { listerAppareils } from "@/lib/pos/scanner/service";
import { SEUIL_SIGNAL_MS } from "@/lib/pos/scanner/regles";

export const GET = routePos(async (ctx, req) => {
  const portee = new URL(req.url).searchParams.get("portee") === "boutique" ? "boutique" : "caisse";
  return {
    appareils: await listerAppareils(ctx, portee), caisseId: ctx.caisseId,
    peutGerer: ctx.droits.gerer_appareils, seuilSignalMs: SEUIL_SIGNAL_MS,
  };
});
