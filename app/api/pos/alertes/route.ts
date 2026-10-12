// Alertes du magasin (§41).
// GET /api/pos/alertes → { alertes: Alerte[], seuils, calculeAt }
// Droit : voir_analytics ou voir_caisse. Les alertes de marge et de prix
// d'achat ne sortent qu'avec voir_couts.
// Calculées À LA LECTURE (aucun planificateur requis). La lecture prévient
// aussi le marchand des nouvelles alertes, une fois par alerte et par jour
// (lib/pos/alertes.ts → notifierAlertes), après l'envoi de la réponse.
import { after } from "next/server";
import { routePos } from "@/lib/pos/acces";
import { aDroit, exigerUnDroit } from "@/lib/pos/droits";
import { calculerAlertes, notifierAlertes, seuilsAlertes } from "@/lib/pos/alertes";

export const GET = routePos(async (ctx) => {
  exigerUnDroit(ctx, "voir_analytics", "voir_caisse");
  const voirCouts = aDroit(ctx, "voir_couts");
  const alertes = await calculerAlertes(ctx.tenantId, { voirCouts });
  // La cloche est celle de la boutique : on n'y pousse que ce que ce lecteur a lui-même le droit de voir.
  after(() => notifierAlertes(ctx.tenantId, alertes).catch((e) => console.warn("[pos-alertes]", e?.message?.slice(0, 120))));
  return { alertes, seuils: await seuilsAlertes(ctx.tenantId), calculeAt: new Date().toISOString() };
});
