// Lots et dates d'expiration (§14). SERVEUR uniquement.
//
// - Un lot porte : quantité, date d'expiration, coût unitaire, fournisseur,
//   entrepôt, statut (actif | bloque | epuise | perime | rappele).
// - La vente consomme les lots en FEFO (lib/pos/stock.ts → mouvementStock) :
//   seuls les lots « actif » et non expirés sont entamés.
// - BLOQUER un lot (contrôle qualité, doute, rappel en attente) : le lot n'est
//   plus consommé ET sa quantité passe dans l'état « bloqué » de son entrepôt,
//   donc sort du disponible. Débloquer fait le chemin inverse. Motif obligatoire,
//   audité.
// - PÉRIMÉ / RAPPELÉ : le reste du lot quitte le stock (mouvement « perte »).
// - `alertesLots(tenantId)` : expiration proche, expiré, lot bloqué — fonction
//   réutilisable (écran Traçabilité, alertes du pilotage).
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { journaliserAudit } from "../audit";
import { exigerLieu, exigerUnDroit, aDroit } from "../droits";
import { ErreurPos } from "../erreurs";
import { publierEvenement } from "../evenements";
import { avecIdempotence } from "../idempotence";
import { entrepotDuMagasin } from "../magasins";
import { mouvementStock, resoudreLieu, stocksDuLieu } from "../stock";
import { lireReglagesPos } from "../flags";
import { cleArticle, REGLAGES_DEFAUT, type ContextePos } from "../types";
import { deplacerEtat, verrouillerArticle } from "./fiche";

type Tx = Prisma.TransactionClient;

/**
 * Nombre de jours avant la date d'expiration à partir duquel un lot est signalé
 * « expire bientôt ». Valeur par défaut du réglage `stock.seuilExpirationJours`
 * (écran Réglages) : les lectures de la boutique passent par `seuilExpiration`.
 * 30 jours laisse le temps de solder ou de renvoyer au fournisseur.
 */
export const SEUIL_EXPIRATION_JOURS = REGLAGES_DEFAUT.stock.seuilExpirationJours;

/** Seuil « expire bientôt » réglé par la boutique, en jours. */
export async function seuilExpiration(tenantId: string): Promise<number> {
  return (await lireReglagesPos(tenantId)).reglages.stock.seuilExpirationJours;
}

const JOUR = 86_400_000;
export type EtatLot = "ok" | "expire_bientot" | "expire" | "bloque" | "epuise" | "perime" | "rappele";

/** État d'un lot à une date donnée. PURE. `joursRestants` : négatif une fois la date passée, null sans date. */
export function etatLot(l: { statut: string; dateExpiration: Date | string | null }, maintenant: Date = new Date(), seuilJours: number = SEUIL_EXPIRATION_JOURS): { etat: EtatLot; joursRestants: number | null } {
  const joursRestants = l.dateExpiration ? Math.ceil((new Date(l.dateExpiration).getTime() - maintenant.getTime()) / JOUR) : null;
  if (l.statut === "bloque") return { etat: "bloque", joursRestants };
  if (l.statut !== "actif") return { etat: (["epuise", "perime", "rappele"].includes(l.statut) ? l.statut : "epuise") as EtatLot, joursRestants };
  if (l.dateExpiration && new Date(l.dateExpiration).getTime() <= maintenant.getTime()) return { etat: "expire", joursRestants };
  if (joursRestants !== null && joursRestants <= seuilJours) return { etat: "expire_bientot", joursRestants };
  return { etat: "ok", joursRestants };
}

export type AlerteLot = {
  type: "expire" | "expire_bientot" | "bloque";
  lotId: string; codeLot: string; produitId: string; produitNom: string;
  quantiteRestante: number; dateExpiration: string | null; joursRestants: number | null; entrepotId: string | null;
};
export type AlertesLots = { seuilJours: number; expires: AlerteLot[]; expirentBientot: AlerteLot[]; bloques: AlerteLot[]; total: number };

/**
 * Alertes de lots d'une boutique : lots expirés encore en stock, lots qui
 * expirent dans `seuilJours` jours, lots bloqués. Seuls les lots qui ont encore
 * de la quantité comptent. Les plus urgents d'abord.
 */
export async function alertesLots(tenantId: string, o: { seuilJours?: number; limite?: number } = {}): Promise<AlertesLots> {
  const seuilJours = o.seuilJours ?? (await seuilExpiration(tenantId));
  const maintenant = new Date();
  const lots = await prisma.lotTracabilite.findMany({
    where: {
      tenantId, quantiteRestante: { gt: 0 },
      OR: [{ statut: "bloque" }, { statut: "actif", dateExpiration: { lte: new Date(maintenant.getTime() + seuilJours * JOUR) } }],
    },
    orderBy: [{ dateExpiration: { sort: "asc", nulls: "last" } }],
    take: Math.min(Math.max(o.limite ?? 300, 1), 1000),
    select: { id: true, codeLot: true, produitId: true, quantiteRestante: true, dateExpiration: true, statut: true, entrepotId: true, produit: { select: { nom: true } } },
  });
  const resultat: AlertesLots = { seuilJours, expires: [], expirentBientot: [], bloques: [], total: 0 };
  for (const l of lots) {
    const { etat, joursRestants } = etatLot(l, maintenant, seuilJours);
    if (etat !== "expire" && etat !== "expire_bientot" && etat !== "bloque") continue;
    const alerte: AlerteLot = {
      type: etat, lotId: l.id, codeLot: l.codeLot, produitId: l.produitId, produitNom: l.produit.nom,
      quantiteRestante: l.quantiteRestante, dateExpiration: l.dateExpiration?.toISOString() ?? null, joursRestants, entrepotId: l.entrepotId,
    };
    (etat === "expire" ? resultat.expires : etat === "expire_bientot" ? resultat.expirentBientot : resultat.bloques).push(alerte);
  }
  resultat.total = resultat.expires.length + resultat.expirentBientot.length + resultat.bloques.length;
  return resultat;
}

// ─── Lecture ──────────────────────────────────────────────────────────────────

/** Lots de la boutique, paginés par curseur. `alerte` restreint aux lots expirés / proches / bloqués. */
export async function listerLots(ctx: ContextePos, f: { statut?: string | null; alerte?: string | null; q?: string | null; curseur?: string | null; limite?: number }) {
  const limite = Math.min(Math.max(Math.floor(f.limite ?? 40), 1), 100);
  const maintenant = new Date();
  const seuilJours = await seuilExpiration(ctx.tenantId);
  const bientot = new Date(maintenant.getTime() + seuilJours * JOUR);
  const terme = f.q?.trim().slice(0, 80);
  const parAlerte: Record<string, Prisma.LotTracabiliteWhereInput> = {
    expire: { statut: "actif", quantiteRestante: { gt: 0 }, dateExpiration: { lte: maintenant } },
    expire_bientot: { statut: "actif", quantiteRestante: { gt: 0 }, dateExpiration: { gt: maintenant, lte: bientot } },
    bloque: { statut: "bloque" },
  };
  const where: Prisma.LotTracabiliteWhereInput = {
    tenantId: ctx.tenantId,
    ...(f.alerte && parAlerte[f.alerte] ? parAlerte[f.alerte] : f.statut && f.statut !== "all" ? { statut: f.statut } : {}),
    ...(terme ? { OR: [{ codeLot: { contains: terme, mode: "insensitive" } }, { produit: { nom: { contains: terme, mode: "insensitive" } } }] } : {}),
  };
  const [lots, actifs, bloques, expires, expirantBientot] = await Promise.all([
    prisma.lotTracabilite.findMany({
      where, orderBy: [{ dateReception: "desc" }, { id: "desc" }], take: limite + 1,
      ...(f.curseur ? { cursor: { id: f.curseur }, skip: 1 } : {}),
      include: { produit: { select: { nom: true, images: true, sku: true, uniteVente: true } } },
    }),
    prisma.lotTracabilite.count({ where: { tenantId: ctx.tenantId, statut: "actif" } }),
    prisma.lotTracabilite.count({ where: { tenantId: ctx.tenantId, statut: "bloque" } }),
    prisma.lotTracabilite.count({ where: { tenantId: ctx.tenantId, ...parAlerte.expire } }),
    prisma.lotTracabilite.count({ where: { tenantId: ctx.tenantId, ...parAlerte.expire_bientot } }),
  ]);
  const page = lots.slice(0, limite);
  const ids = <K extends "fournisseurId" | "entrepotId">(k: K) => [...new Set(page.flatMap((l) => (l[k] ? [l[k] as string] : [])))];
  const [fournisseurs, entrepots] = await Promise.all([
    prisma.fournisseur.findMany({ where: { tenantId: ctx.tenantId, id: { in: ids("fournisseurId") } }, select: { id: true, nom: true } }),
    prisma.entrepot.findMany({ where: { tenantId: ctx.tenantId, id: { in: ids("entrepotId") } }, select: { id: true, nom: true } }),
  ]);
  const couts = aDroit(ctx, "voir_couts");
  return {
    lots: page.map((l) => {
      const e = etatLot(l, maintenant, seuilJours);
      return {
        id: l.id, codeLot: l.codeLot, produitId: l.produitId, produit: l.produit,
        quantiteInitiale: l.quantiteInitiale, quantiteRestante: l.quantiteRestante,
        dateReception: l.dateReception.toISOString(), dateExpiration: l.dateExpiration?.toISOString() ?? null,
        statut: l.statut, etat: e.etat, joursRestants: e.joursRestants,
        // Compatibilité avec l'ancien écran : drapeaux booléens.
        expireBientot: e.etat === "expire_bientot", expire: e.etat === "expire",
        cout: couts ? l.cout : null,
        fournisseurNom: fournisseurs.find((x) => x.id === l.fournisseurId)?.nom ?? l.fournisseurNom, fournisseurRef: l.fournisseurRef,
        entrepotId: l.entrepotId, entrepotNom: entrepots.find((x) => x.id === l.entrepotId)?.nom ?? null,
        certification: l.certification, notes: l.notes,
      };
    }),
    curseurSuivant: lots.length > limite ? page[page.length - 1].id : null,
    stats: { actifs, bloques, expires, expirantBientot },
    seuilJours,
    coutsVisibles: couts,
  };
}

// ─── Réception d'un lot ───────────────────────────────────────────────────────

const id = z.string().trim().min(1).max(64);
const cle = z.string().trim().min(8).max(200);
const jour = z.string().trim().min(8).max(40).refine((s) => !Number.isNaN(Date.parse(s)), "Date illisible.");

export const schemaLot = z.object({
  cle,
  produitId: id,
  varianteId: id.nullish(),
  codeLot: z.string().trim().min(1, "Donnez un code au lot.").max(80),
  /** Pièces, ou grammes pour un produit au poids. */
  quantite: z.number().int("La quantité doit être un nombre entier.").min(1).max(10_000_000),
  cout: z.number().finite().min(0).max(1e12).nullish(),
  fournisseurId: id.nullish(),
  fournisseurNom: z.string().trim().max(160).nullish(),
  fournisseurRef: z.string().trim().max(160).nullish(),
  entrepotId: id.nullish(),
  dateReception: jour.nullish(),
  dateExpiration: jour.nullish(),
  certification: z.string().trim().max(200).nullish(),
  notes: z.string().trim().max(500).nullish(),
});
export type DemandeLot = z.infer<typeof schemaLot>;

/** Enregistre un lot reçu et crédite le stock de son entrepôt (mouvement « reception » rattaché au lot). */
export async function recevoirLot(ctx: ContextePos, d: DemandeLot): Promise<{ lotId: string; codeLot: string; stock: number; rejoue: boolean }> {
  exigerUnDroit(ctx, "reception", "ajuster_stock");
  const entrepotId = d.entrepotId ?? (await entrepotDuMagasin(prisma, ctx.tenantId, ctx.magasinId));
  const { resultat, rejoue } = await avecIdempotence(ctx.tenantId, d.cle, "lot.recu", async (tx) => {
    const existant = await tx.lotTracabilite.findUnique({ where: { tenantId_codeLot: { tenantId: ctx.tenantId, codeLot: d.codeLot } }, select: { id: true } });
    if (existant) throw new ErreurPos("conflit", 409, `Le code de lot ${d.codeLot} existe déjà. Donnez-lui un autre code.`);
    const fournisseur = d.fournisseurId ? await tx.fournisseur.findFirst({ where: { id: d.fournisseurId, tenantId: ctx.tenantId }, select: { id: true, nom: true } }) : null;
    if (d.fournisseurId && !fournisseur) throw new ErreurPos("introuvable", 404, "Ce fournisseur est introuvable dans cette boutique.");
    const lieu = await resoudreLieu(tx, ctx.tenantId, entrepotId);
    await exigerLieu(tx, ctx, lieu?.entrepotId);
    await verrouillerArticle(tx, ctx.tenantId, d.produitId, d.varianteId);
    const lot = await tx.lotTracabilite.create({
      data: {
        tenantId: ctx.tenantId, produitId: d.produitId, codeLot: d.codeLot, quantiteInitiale: d.quantite, quantiteRestante: d.quantite,
        cout: d.cout ?? null, fournisseurId: fournisseur?.id ?? null, fournisseurNom: fournisseur?.nom ?? (d.fournisseurNom || null), fournisseurRef: d.fournisseurRef || null,
        entrepotId: lieu?.entrepotId ?? null,
        dateReception: d.dateReception ? new Date(d.dateReception) : new Date(), dateExpiration: d.dateExpiration ? new Date(d.dateExpiration) : null,
        certification: d.certification || null, notes: d.notes || null,
      },
    });
    const m = await mouvementStock(tx, {
      tenantId: ctx.tenantId, produitId: d.produitId, varianteId: d.varianteId, lieu, type: "reception", quantite: d.quantite,
      motif: `Réception du lot ${d.codeLot}`, refs: { lotId: lot.id }, creePar: ctx.userId,
    });
    await journaliserAudit(tx, ctx, { action: "lot.recu", entite: "LotTracabilite", entiteId: lot.id, apres: { codeLot: d.codeLot, produitId: d.produitId, varianteId: d.varianteId ?? null, quantite: d.quantite, cout: d.cout ?? null, entrepotId: lieu?.entrepotId ?? null, dateExpiration: d.dateExpiration ?? null } });
    await publierEvenement(tx, { tenantId: ctx.tenantId, magasinId: ctx.magasinId, type: "inventory.updated", payload: { origine: "lot", lotId: lot.id, produitIds: [d.produitId] } });
    return { lotId: lot.id, codeLot: lot.codeLot, stock: m.stockApres };
  }, { appareilId: ctx.appareilId, userId: ctx.userId });
  return { ...resultat, rejoue };
}

// ─── Statut d'un lot ──────────────────────────────────────────────────────────

export const schemaActionLot = z.object({
  cle,
  action: z.enum(["bloquer", "debloquer", "perime", "rappele", "epuise", "noter"]),
  motif: z.string().trim().max(300).nullish(),
  notes: z.string().trim().max(500).nullish(),
});
export type ActionLot = z.infer<typeof schemaActionLot>;

/** Variante et entrepôt d'un lot : ceux du mouvement qui l'a fait entrer (LotTracabilite n'a pas de varianteId). */
async function origineLot(tx: Tx, lot: { id: string; entrepotId: string | null }): Promise<{ varianteId: string | null; entrepotId: string | null }> {
  const m = await tx.stockMouvement.findFirst({ where: { lotId: lot.id, type: { in: ["reception", "entree"] } }, orderBy: { createdAt: "asc" }, select: { varianteId: true, entrepotId: true } });
  return { varianteId: m?.varianteId ?? null, entrepotId: lot.entrepotId ?? m?.entrepotId ?? null };
}

/**
 * Change l'état d'un lot. Bloquer / débloquer exigent un motif. « Périmé » et
 * « rappelé » retirent le reste du lot du stock ; `stockRetire` dit combien
 * (moins que le reste du lot si le stock de l'article ne le contenait plus).
 */
export async function changerLot(ctx: ContextePos, lotId: string, d: ActionLot): Promise<{ lotId: string; statut: string; stockRetire: number; avertissement: string | null; rejoue: boolean }> {
  exigerUnDroit(ctx, "ajuster_stock");
  const motif = d.motif?.trim() ?? "";
  if ((d.action === "bloquer" || d.action === "debloquer" || d.action === "rappele") && motif.length < 3) {
    throw new ErreurPos("motif_requis", 422, "Indiquez le motif (3 caractères au moins) : il est conservé dans le journal d'audit.");
  }
  const { resultat, rejoue } = await avecIdempotence(ctx.tenantId, d.cle, "lot.action", async (tx) => {
    const lot = await tx.lotTracabilite.findFirst({ where: { id: lotId, tenantId: ctx.tenantId } });
    if (!lot) throw new ErreurPos("introuvable", 404, "Ce lot est introuvable dans cette boutique.");
    if (d.action === "noter") {
      await tx.lotTracabilite.update({ where: { id: lot.id }, data: { notes: d.notes || null } });
      return { lotId: lot.id, statut: lot.statut, stockRetire: 0, avertissement: null };
    }
    const cible = { bloquer: "bloque", debloquer: "actif", perime: "perime", rappele: "rappele", epuise: "epuise" }[d.action];
    const permis: Record<string, string[]> = { bloquer: ["actif"], debloquer: ["bloque"], perime: ["actif", "bloque"], rappele: ["actif", "bloque"], epuise: ["actif"] };
    // Bascule conditionnelle : deux demandes simultanées ne passent pas toutes les deux.
    const bascule = await tx.lotTracabilite.updateMany({ where: { id: lot.id, statut: { in: permis[d.action] } }, data: { statut: d.action === "perime" || d.action === "rappele" ? "actif" : cible } });
    if (!bascule.count) throw new ErreurPos("conflit", 409, `Ce lot est « ${lot.statut} » : cette action n'est plus possible. Rechargez la liste.`);

    const reste = Math.round(lot.quantiteRestante);
    const origine = await origineLot(tx, lot);
    const variantes = await tx.variante.count({ where: { produitId: lot.produitId, actif: true } });
    // Lot d'avant le POS 2.0 sur un article à variantes : on ne sait pas quelle variante il a créditée.
    const localisable = !variantes || !!origine.varianteId;
    const lieu = await resoudreLieu(tx, ctx.tenantId, origine.entrepotId);
    await exigerLieu(tx, ctx, lieu?.entrepotId);
    let stockRetire = 0;
    let avertissement: string | null = localisable ? null : "Ce lot n'est rattaché à aucune variante : le stock n'a pas été modifié. Corrigez-le par un ajustement.";

    if (reste > 0 && localisable && lieu && d.action !== "epuise") {
      const article = await verrouillerArticle(tx, ctx.tenantId, lot.produitId, origine.varianteId);
      const commun = { tenantId: ctx.tenantId, entrepotId: lieu.entrepotId, produitId: lot.produitId, varianteId: origine.varianteId, stock: article.stock, nom: article.nom, souple: true };
      if (d.action === "bloquer") await deplacerEtat(tx, { ...commun, champ: "bloque", delta: reste });
      else if (lot.statut === "bloque") await deplacerEtat(tx, { ...commun, champ: "bloque", delta: -reste });
      if (d.action === "perime" || d.action === "rappele") {
        const ici = (await stocksDuLieu(tx, ctx.tenantId, lieu.entrepotId, [{ produitId: lot.produitId, varianteId: origine.varianteId, stock: article.stock }])).get(cleArticle(lot.produitId, origine.varianteId)) ?? 0;
        stockRetire = Math.max(0, Math.min(reste, ici));
        if (stockRetire > 0) {
          await mouvementStock(tx, {
            tenantId: ctx.tenantId, produitId: lot.produitId, varianteId: origine.varianteId, lieu, type: "perte", quantite: stockRetire,
            motif: `Lot ${lot.codeLot} ${d.action === "perime" ? "périmé" : "rappelé"}${motif ? ` — ${motif}` : ""}`, refs: { lotId: lot.id }, creePar: ctx.userId,
          });
        }
        if (stockRetire < reste) avertissement = `Le stock de l'article ne contenait plus que ${stockRetire} des ${reste} unités de ce lot : seules celles-ci ont été retirées.`;
      }
    }
    if (d.action === "perime" || d.action === "rappele") await tx.lotTracabilite.update({ where: { id: lot.id }, data: { statut: cible, quantiteRestante: 0 } });

    await journaliserAudit(tx, ctx, {
      action: { bloquer: "lot.bloque", debloquer: "lot.debloque", perime: "lot.perime", rappele: "lot.rappele", epuise: "lot.epuise" }[d.action],
      entite: "LotTracabilite", entiteId: lot.id, motif: motif || null,
      avant: { statut: lot.statut, quantiteRestante: lot.quantiteRestante }, apres: { statut: cible, stockRetire, codeLot: lot.codeLot },
    });
    await publierEvenement(tx, { tenantId: ctx.tenantId, magasinId: ctx.magasinId, type: "inventory.updated", payload: { origine: "lot", lotId: lot.id, action: d.action, produitIds: [lot.produitId] } });
    return { lotId: lot.id, statut: cible, stockRetire, avertissement };
  }, { appareilId: ctx.appareilId, userId: ctx.userId });
  return { ...resultat, rejoue };
}
