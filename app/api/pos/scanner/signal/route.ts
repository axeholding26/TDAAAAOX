// Signal de vie d'un téléphone-scanner (avec ?appareil=1) ou d'un poste de caisse.
// POST /api/pos/scanner/signal — corps : { etat?: "en_ligne" | "hors_ligne", ecran?: "vente" | null }.
// Rend ce que l'écran du téléphone affiche : caisse, magasin, session, droits.
import { exigerUnDroit } from "@/lib/pos/droits";
import { infosPoste, routeScanner, schemaSignal, signalDeVie } from "@/lib/pos/scanner/service";

export const POST = routeScanner(async (ctx, req) => {
  const d = schemaSignal.parse(await req.json().catch(() => ({})));
  // Poste de caisse (session marchande) : seul un compte qui travaille à la caisse signale sa présence.
  if (!ctx.appareilId) exigerUnDroit(ctx, "vendre", "scanner", "voir_caisse");
  await signalDeVie(ctx, d.etat, d.ecran);
  return { ok: true, ...(await infosPoste(ctx)) };
});
