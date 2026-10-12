// Mise en route de la caisse en 8 étapes (§75).
// GET  /api/pos/demarrage → { etapes: [{ id, fait, passee, facultative, detail }], faites, total, active, typeCommerce, flagsActivation }
// POST /api/pos/demarrage { action: "passer", etape } | { action: "activer" }
// Droit : gerer_reglages (lecture : gerer_reglages ou gerer_magasins).
//
// Une étape est cochée d'après les DONNÉES RÉELLES (un magasin existe, un
// produit existe, une vente a été faite…). Trois étapes ne se déduisent pas
// des données et se confirment à la main (ReglagesPos.onboarding) : travailler
// seul (pas d'utilisateur à inviter), pas de scanner, moyens de paiement vérifiés.
// L'activation finale allume les drapeaux utiles au type de commerce.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { exigerDroit, exigerUnDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { enregistrerReglagesPos, lireReglagesPos } from "@/lib/pos/flags";
import { journaliserAudit } from "@/lib/pos/audit";
import type { ContextePos, FlagPos } from "@/lib/pos/types";
import { MODELES_COMMERCE } from "@/lib/pos/types-commerce";

const ETAPES = ["magasin", "caisse", "utilisateur", "produits", "scanner", "paiements", "vente_test", "activation"] as const;
type Etape = (typeof ETAPES)[number];
/** Étapes qu'on peut confirmer à la main. */
const CONFIRMABLES = ["utilisateur", "scanner", "paiements"] as const;
/** Étapes sans lesquelles l'activation n'a pas de sens. */
const REQUISES: Etape[] = ["magasin", "caisse", "produits"];

async function etat(ctx: ContextePos) {
  const { tenantId } = ctx;
  const [reglages, magasins, caisses, membres, produits, appareils, scans, ventes] = await Promise.all([
    lireReglagesPos(tenantId),
    prisma.magasin.findMany({ where: { tenantId, demo: false, actif: true }, orderBy: { createdAt: "asc" }, take: 3, select: { nom: true } }),
    prisma.caisse.count({ where: { tenantId, actif: true, magasin: { demo: false } } }),
    prisma.membreEquipe.count({ where: { tenantId, statut: "actif" } }),
    prisma.produit.count({ where: { tenantId, actif: true, type: "physique" } }),
    prisma.appareilPos.count({ where: { tenantId, statut: "actif" } }),
    prisma.scanPos.count({ where: { tenantId } }),
    prisma.commande.count({ where: { tenantId, canal: "pos", statut: { not: "annulee" } } }),
  ]);
  const o = reglages.onboarding;
  const fait: Record<Etape, boolean> = {
    magasin: magasins.length > 0, caisse: caisses > 0, utilisateur: membres > 0, produits: produits > 0,
    scanner: appareils > 0 || scans > 0, paiements: false, vente_test: ventes > 0, activation: o.active === true,
  };
  const detail: Record<Etape, string> = {
    magasin: magasins.length ? magasins.map((m) => m.nom).join(", ") : "Aucun magasin",
    caisse: `${caisses} caisse(s) active(s)`,
    utilisateur: membres ? `${membres} membre(s) d'équipe actif(s)` : "Aucun membre d'équipe",
    produits: `${produits} produit(s) physique(s) actif(s)`,
    scanner: appareils ? `${appareils} téléphone(s) appairé(s)` : scans ? "Scanner du poste déjà utilisé" : "Aucun scanner utilisé",
    paiements: reglages.reglages.paiements.modes.join(", "),
    vente_test: ventes ? `${ventes} vente(s) en caisse` : "Aucune vente en caisse",
    activation: o.active === true ? "Caisse activée" : "À faire en dernier",
  };
  const flagsActivation = [...new Set<FlagPos>(["caisse_v2", "scanner_v2", ...MODELES_COMMERCE[reglages.typeCommerce].flags])];
  const etapes = ETAPES.map((id) => {
    const passee = (CONFIRMABLES as readonly string[]).includes(id) && o[id] === true;
    return { id, fait: fait[id] || passee, passee: passee && !fait[id], facultative: !REQUISES.includes(id) && id !== "activation", detail: detail[id] };
  });
  return { etapes, faites: etapes.filter((e) => e.fait).length, total: etapes.length, active: fait.activation, typeCommerce: reglages.typeCommerce, mode: reglages.mode, flags: reglages.flags, flagsActivation };
}

export const GET = routePos(async (ctx) => {
  exigerUnDroit(ctx, "gerer_reglages", "gerer_magasins");
  return etat(ctx);
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("passer"), etape: z.enum(CONFIRMABLES) }),
  z.object({ action: z.literal("activer") }),
]);

export const POST = routePos(async (ctx, req) => {
  exigerDroit(ctx, "gerer_reglages");
  const d = schema.parse(await req.json());
  const avant = await etat(ctx);

  if (d.action === "activer") {
    const manquantes = avant.etapes.filter((e) => REQUISES.includes(e.id) && !e.fait);
    if (manquantes.length) throw new ErreurPos("etapes_manquantes", 409, "Il manque encore un magasin, une caisse ou au moins un produit : terminez ces étapes avant d'activer la caisse.", { etapes: manquantes.map((e) => e.id) });
  }
  const modif = d.action === "passer"
    ? { onboarding: { [d.etape]: true } }
    : { onboarding: { active: true }, flags: Object.fromEntries(avant.flagsActivation.map((f) => [f, true])) as Partial<Record<FlagPos, boolean>> };

  // Rejouer la même demande ne change rien : l'opération est idempotente par nature.
  await prisma.$transaction(async (tx) => {
    const r = await enregistrerReglagesPos(ctx.tenantId, modif, tx);
    await journaliserAudit(tx, ctx, {
      action: "reglages.modifies", entite: "ReglagesPos", entiteId: ctx.tenantId,
      avant: { flags: r.avant.flags, onboarding: r.avant.onboarding }, apres: { flags: r.apres.flags, onboarding: r.apres.onboarding },
      motif: d.action === "activer" ? "Activation de la caisse (mise en route)" : `Étape de mise en route confirmée : ${d.etape}`,
    });
  });
  return { ok: true, ...(await etat(ctx)) };
});
