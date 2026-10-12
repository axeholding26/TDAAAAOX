// Mouvements de caisse hors ventes : retrait, dépôt, dépense, correction.
// SERVEUR uniquement.
//
// Convention (lib/pos/session-caisse.ts) : `montant` POSITIF pour un dépôt, un
// retrait ou une dépense ; SIGNÉ pour une correction (+ : il y a plus dans le
// tiroir que ce que la caisse croit, − : il y a moins).
// Une dépense crée aussi une ChargeExploitation rattachée à la session : elle
// entre ainsi dans la comptabilité du magasin sans double saisie.
import { z } from "zod";
import { prisma } from "../../prisma";
import { formatMontant } from "../../utils";
import { ErreurPos } from "../erreurs";
import { exigerDroit } from "../droits";
import { journaliserAudit } from "../audit";
import { publierEvenement } from "../evenements";
import { avecIdempotence } from "../idempotence";
import { detailAttendu } from "../session-caisse";
import { arrondir, decimalesDevise } from "../tarification";
import type { ContextePos } from "../types";

export const TYPES_MOUVEMENT_CAISSE = ["retrait", "depot", "depense", "correction"] as const;
export type TypeMouvementCaisse = (typeof TYPES_MOUVEMENT_CAISSE)[number];

/** Catégories de ChargeExploitation (les mêmes que la page Charges). */
export const CATEGORIES_CHARGE = ["loyer", "electricite", "eau", "internet", "fournitures", "equipement", "salaires", "transport", "autre"] as const;

export const schemaMouvementCaisse = z.object({
  type: z.enum(TYPES_MOUVEMENT_CAISSE),
  montant: z.number().finite().min(-1e12).max(1e12),
  motif: z.string().trim().max(300),
  /** Dépense : catégorie de la charge créée (défaut « autre »). */
  categorie: z.enum(CATEGORIES_CHARGE).optional(),
  cle: z.string().trim().min(8).max(200),
});
export type DemandeMouvementCaisse = z.infer<typeof schemaMouvementCaisse>;

export type MouvementEnregistre = { id: string; type: string; montant: number; motif: string; chargeId: string | null; createdAt: string; attendu: number };

/**
 * Enregistre un mouvement sur la session ouverte de la caisse du contexte.
 * Idempotent sur `cle`, audité, diffusé (« cash.movement »). Une sortie
 * d'espèces supérieure à ce que le tiroir est censé contenir est refusée.
 */
export async function enregistrerMouvementCaisse(ctx: ContextePos, d: DemandeMouvementCaisse): Promise<MouvementEnregistre & { rejoue: boolean }> {
  exigerDroit(ctx, "mouvement_caisse");
  const sessionId = ctx.sessionCaisseId;
  if (!sessionId) throw new ErreurPos("caisse_fermee", 409, "Aucune session n'est ouverte sur cette caisse. Ouvrez la caisse pour enregistrer un mouvement.");
  if (d.motif.length < 3) throw new ErreurPos("motif_requis", 422, "Indiquez le motif de ce mouvement de caisse.");
  const { devise } = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { devise: true } });
  const montant = arrondir(d.montant, decimalesDevise(devise));
  if (!montant) throw new ErreurPos("invalide", 400, "Indiquez le montant du mouvement.");
  if (d.type !== "correction" && montant < 0) throw new ErreurPos("invalide", 400, "Indiquez un montant supérieur à zéro.");

  const { resultat, rejoue } = await avecIdempotence<MouvementEnregistre>(ctx.tenantId, d.cle, "caisse.mouvement", async (tx) => {
    // Verrou de la session : la fermeture attend ce mouvement, et une session fermée entre-temps le refuse.
    const verrou = await tx.sessionCaisse.updateMany({ where: { id: sessionId, tenantId: ctx.tenantId, statut: "ouverte" }, data: { nbVentes: { increment: 0 } } });
    if (verrou.count === 0) throw new ErreurPos("caisse_fermee", 409, "La session de caisse vient d'être fermée. Le mouvement n'a pas été enregistré.");

    const avant = await detailAttendu(tx, sessionId);
    const sortie = d.type === "retrait" || d.type === "depense" ? montant : d.type === "correction" && montant < 0 ? -montant : 0;
    if (sortie > avant.attendu) {
      throw new ErreurPos("especes_insuffisantes", 409,
        `D'après la caisse, le tiroir contient ${formatMontant(avant.attendu, devise)} : impossible d'en sortir ${formatMontant(sortie, devise)}. Si le tiroir contient davantage, enregistrez d'abord une correction.`,
        { attendu: avant.attendu });
    }

    const charge = d.type === "depense"
      ? await tx.chargeExploitation.create({
          data: {
            tenantId: ctx.tenantId, categorie: d.categorie ?? "autre", description: d.motif, montant, devise,
            frequence: "ponctuelle", statut: "payee", notes: "Dépense réglée en espèces depuis la caisse.",
            creePar: ctx.userId, magasinId: ctx.magasinId, sessionCaisseId: sessionId,
          },
          select: { id: true },
        })
      : null;
    const m = await tx.mouvementCaisse.create({
      data: { tenantId: ctx.tenantId, sessionCaisseId: sessionId, type: d.type, montant, motif: d.motif, chargeId: charge?.id ?? null, creePar: ctx.userId },
    });
    const apres = await detailAttendu(tx, sessionId);

    await journaliserAudit(tx, ctx, {
      action: "caisse.mouvement", entite: "MouvementCaisse", entiteId: m.id, motif: d.motif,
      avant: { attendu: avant.attendu }, apres: { type: d.type, montant, attendu: apres.attendu, chargeId: charge?.id ?? null },
    });
    await publierEvenement(tx, {
      tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: ctx.caisseId, type: "cash.movement",
      payload: { sessionCaisseId: sessionId, mouvementId: m.id, type: d.type, montant, motif: d.motif, par: ctx.userNom },
    });
    return { id: m.id, type: m.type, montant, motif: m.motif, chargeId: m.chargeId, createdAt: m.createdAt.toISOString(), attendu: apres.attendu };
  }, { appareilId: ctx.appareilId, userId: ctx.userId });
  return { ...resultat, rejoue };
}

/** Noms affichables d'utilisateurs de la boutique (membre d'équipe, sinon compte), par identifiant. */
export async function nomsUtilisateurs(tenantId: string, ids: (string | null | undefined)[]): Promise<Record<string, string>> {
  const uniques = [...new Set(ids.filter((i): i is string => !!i))];
  if (!uniques.length) return {};
  const [membres, comptes] = await Promise.all([
    prisma.membreEquipe.findMany({ where: { tenantId, userId: { in: uniques } }, select: { userId: true, nom: true } }),
    prisma.user.findMany({ where: { id: { in: uniques } }, select: { id: true, name: true } }),
  ]);
  const noms: Record<string, string> = {};
  // Le nom d'un compte n'est montré que s'il s'agit d'un identifiant déjà écrit dans une ligne de la boutique.
  for (const c of comptes) if (c.name) noms[c.id] = c.name;
  for (const m of membres) if (m.userId && m.nom) noms[m.userId] = m.nom;
  return noms;
}
