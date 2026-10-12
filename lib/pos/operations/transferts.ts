// Transferts de stock entre entrepôts / magasins (§32). SERVEUR uniquement.
//
// Un magasin vend le stock de son entrepôt : transférer d'entrepôt à entrepôt
// couvre magasin ↔ magasin et dépôt ↔ magasin.
//
// STATUTS ET PASSAGES (ACTIONS_TRANSFERT) :
//   brouillon → demande → approuve → en_preparation → expedie → recu
//                                                         └→ partiellement_recu → recu
//   brouillon | demande | approuve | en_preparation → annule
//
// STOCK — rien ne bouge avant l'expédition.
// - Expédition : `transfert_sortie` de l'entrepôt source, pour la quantité
//   préparée de chaque ligne. Le total de l'article baisse : la marchandise est
//   « en transit » (visible dans la disponibilité de la destination).
// - Réception : `transfert_entree` dans l'entrepôt de destination, pour la
//   quantité réellement reçue. Réception en plusieurs fois possible.
// LOTS — un lot n'a qu'un lieu. L'expédition entame les lots de la source (premier
// périmé, premier sorti, comme une vente). Ce qui arrive devient à destination un
// lot « <code d'origine>-<numéro du transfert> » qui garde date de péremption, coût
// et fournisseur : chercher le code d'origine retrouve donc aussi ce qui a été
// transféré. Un manque renvoyé à la source recrédite les lots d'origine.
// - Écart (reçu < expédié) : le transfert reste « partiellement reçu » jusqu'à
//   ce qu'un responsable le clôture, en déclarant le manque perdu en route ou en
//   le renvoyant dans le stock de la source. On ne peut pas recevoir plus que ce
//   qui a été expédié (un surplus se corrige par un ajustement de stock).
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { genererNumeroCommande } from "../../utils";
import { journaliserAudit } from "../audit";
import { nomsUtilisateurs } from "../caisse/mouvements";
import { exigerLieu, exigerUnDroit, lieuAutorise } from "../droits";
import { ErreurPos } from "../erreurs";
import { exigerStockAvance } from "../flags";
import { publierEvenement } from "../evenements";
import { avecIdempotence, avecRepriseCollision } from "../idempotence";
import { mouvementStock, resoudreLieu, stocksDuLieu } from "../stock";
import { cleArticle, type ActionPos, type ContextePos, type DroitsPos } from "../types";

export const STATUTS_TRANSFERT = ["brouillon", "demande", "approuve", "en_preparation", "expedie", "recu", "partiellement_recu", "annule"] as const;
export type StatutTransfert = (typeof STATUTS_TRANSFERT)[number];
export type ActionTransfert = "demander" | "approuver" | "preparer" | "preparation" | "expedier" | "recevoir" | "cloturer" | "annuler";

/**
 * Passages autorisés : statuts de départ et droits (un seul suffit). `vers` null
 * = le statut d'arrivée dépend du résultat (réception) ou ne change pas
 * (enregistrement des quantités préparées).
 */
export const ACTIONS_TRANSFERT: Record<ActionTransfert, { depuis: StatutTransfert[]; vers: StatutTransfert | null; droits: ActionPos[] }> = {
  demander:    { depuis: ["brouillon"], vers: "demande", droits: ["transfert_creer"] },
  approuver:   { depuis: ["demande"], vers: "approuve", droits: ["transfert_approuver"] },
  preparer:    { depuis: ["approuve"], vers: "en_preparation", droits: ["transfert_creer", "transfert_approuver"] },
  preparation: { depuis: ["en_preparation"], vers: null, droits: ["transfert_creer", "transfert_approuver"] },
  expedier:    { depuis: ["en_preparation"], vers: "expedie", droits: ["transfert_creer", "transfert_approuver"] },
  recevoir:    { depuis: ["expedie", "partiellement_recu"], vers: null, droits: ["transfert_recevoir"] },
  cloturer:    { depuis: ["expedie", "partiellement_recu"], vers: "recu", droits: ["transfert_approuver"] },
  annuler:     { depuis: ["brouillon", "demande", "approuve", "en_preparation"], vers: "annule", droits: ["transfert_creer", "transfert_approuver"] },
};

/** Actions qu'une personne peut faire sur un transfert dans cet état. PURE. */
export function actionsPossibles(statut: string, droits: DroitsPos): ActionTransfert[] {
  return (Object.keys(ACTIONS_TRANSFERT) as ActionTransfert[]).filter((a) => (ACTIONS_TRANSFERT[a].depuis as string[]).includes(statut) && ACTIONS_TRANSFERT[a].droits.some((d) => droits[d]));
}

/** Statut après une réception. PURE. */
export function statutApresReception(lignes: { quantiteExpediee: number; quantiteRecue: number }[]): "recu" | "partiellement_recu" {
  return lignes.every((l) => l.quantiteRecue >= l.quantiteExpediee) ? "recu" : "partiellement_recu";
}

const id = z.string().trim().min(1).max(64);
const cle = z.string().trim().min(8).max(200);

export const schemaTransfert = z.object({
  cle,
  entrepotSourceId: id,
  entrepotDestinationId: id,
  lignes: z.array(z.object({ produitId: id, varianteId: id.nullish(), quantite: z.number().int().min(1).max(10_000_000) })).min(1, "Ajoutez au moins un article au transfert.").max(200),
  notes: z.string().trim().max(500).nullish(),
  /** true : la demande part tout de suite (statut « demande ») ; sinon le transfert reste en brouillon. */
  demander: z.boolean().optional(),
});
export type DemandeTransfert = z.infer<typeof schemaTransfert>;

/** Crée un transfert (brouillon, ou déjà demandé). Aucun stock ne bouge. */
export async function creerTransfert(ctx: ContextePos, d: DemandeTransfert): Promise<{ transfertId: string; numero: string; statut: string; rejoue: boolean }> {
  exigerUnDroit(ctx, "transfert_creer");
  await exigerStockAvance(ctx.tenantId);
  if (d.entrepotSourceId === d.entrepotDestinationId) throw new ErreurPos("invalide", 422, "Le lieu de départ et le lieu d'arrivée doivent être différents.");
  // Une même ligne saisie deux fois : les quantités s'additionnent.
  const parArticle = new Map<string, { produitId: string; varianteId: string | null; quantite: number }>();
  for (const l of d.lignes) {
    const k = cleArticle(l.produitId, l.varianteId);
    parArticle.set(k, { produitId: l.produitId, varianteId: l.varianteId ?? null, quantite: (parArticle.get(k)?.quantite ?? 0) + l.quantite });
  }
  const { resultat, rejoue } = await avecRepriseCollision(() => avecIdempotence(ctx.tenantId, d.cle, "transfert.cree", async (tx) => {
    await resoudreLieu(tx, ctx.tenantId, d.entrepotSourceId);
    await resoudreLieu(tx, ctx.tenantId, d.entrepotDestinationId);
    // Membre limité à certains magasins : il demande POUR l'un des siens, ou envoie DEPUIS l'un des siens.
    if (!(await lieuAutorise(tx, ctx, d.entrepotSourceId))) await exigerLieu(tx, ctx, d.entrepotDestinationId);
    const produits = await tx.produit.findMany({
      where: { tenantId: ctx.tenantId, id: { in: [...new Set(d.lignes.map((l) => l.produitId))] } },
      select: { id: true, nom: true, type: true, variantes: { where: { actif: true }, select: { id: true } } },
    });
    for (const l of parArticle.values()) {
      const p = produits.find((x) => x.id === l.produitId);
      if (!p) throw new ErreurPos("introuvable", 404, "Un article du transfert est introuvable dans cette boutique.", { produitId: l.produitId });
      if (p.type !== "physique") throw new ErreurPos("invalide", 400, `« ${p.nom} » n'a pas de stock suivi : il ne se transfère pas.`);
      if (l.varianteId && !p.variantes.some((v) => v.id === l.varianteId)) throw new ErreurPos("introuvable", 404, `Cette variante de « ${p.nom} » est introuvable.`);
      if (!l.varianteId && p.variantes.length) throw new ErreurPos("variante_requise", 422, `« ${p.nom} » a des variantes : choisissez laquelle transférer.`, { produitId: p.id });
    }
    const statut = d.demander ? "demande" : "brouillon";
    const transfert = await tx.transfertStock.create({
      data: {
        tenantId: ctx.tenantId, numero: genererNumeroCommande().replace(/^AX/, "TR"), entrepotSourceId: d.entrepotSourceId, entrepotDestinationId: d.entrepotDestinationId,
        statut, demandePar: ctx.userId, notes: d.notes || null,
        lignes: { create: [...parArticle.entries()].map(([k, l]) => ({ cleArticle: k, produitId: l.produitId, varianteId: l.varianteId, quantiteDemandee: l.quantite })) },
      },
    });
    await journaliserAudit(tx, ctx, { action: d.demander ? "transfert.demande" : "transfert.cree", entite: "TransfertStock", entiteId: transfert.id, apres: { numero: transfert.numero, statut, source: d.entrepotSourceId, destination: d.entrepotDestinationId, lignes: parArticle.size } });
    return { transfertId: transfert.id, numero: transfert.numero, statut };
  }, { appareilId: ctx.appareilId, userId: ctx.userId }));
  return { ...resultat, rejoue };
}

/** Transferts de la boutique, les plus récents d'abord. */
export async function listerTransferts(ctx: ContextePos, f: { statut?: string | null; curseur?: string | null; limite?: number }) {
  const limite = Math.min(Math.max(Math.floor(f.limite ?? 20), 1), 50);
  const enCours = ["demande", "approuve", "en_preparation", "expedie", "partiellement_recu"];
  const transferts = await prisma.transfertStock.findMany({
    where: { tenantId: ctx.tenantId, ...(f.statut === "en_cours" ? { statut: { in: enCours } } : f.statut && f.statut !== "all" ? { statut: f.statut } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limite + 1,
    ...(f.curseur ? { cursor: { id: f.curseur }, skip: 1 } : {}),
    include: { lignes: { select: { quantiteDemandee: true, quantiteExpediee: true, quantiteRecue: true } } },
  });
  const page = transferts.slice(0, limite);
  const entrepots = await prisma.entrepot.findMany({ where: { tenantId: ctx.tenantId, id: { in: [...new Set(page.flatMap((t) => [t.entrepotSourceId, t.entrepotDestinationId]))] } }, select: { id: true, nom: true } });
  const nom = (entrepotId: string) => entrepots.find((e) => e.id === entrepotId)?.nom ?? "Lieu supprimé";
  const somme = (ls: (typeof page)[number]["lignes"], k: "quantiteDemandee" | "quantiteExpediee" | "quantiteRecue") => ls.reduce((s, l) => s + l[k], 0);
  return {
    transferts: page.map((t) => ({
      id: t.id, numero: t.numero, statut: t.statut, source: nom(t.entrepotSourceId), destination: nom(t.entrepotDestinationId),
      createdAt: t.createdAt.toISOString(), expedieAt: t.expedieAt?.toISOString() ?? null, recuAt: t.recuAt?.toISOString() ?? null,
      lignes: t.lignes.length, demande: somme(t.lignes, "quantiteDemandee"), expedie: somme(t.lignes, "quantiteExpediee"), recu: somme(t.lignes, "quantiteRecue"),
    })),
    curseurSuivant: transferts.length > limite ? page[page.length - 1].id : null,
  };
}

/** Un transfert, ses lignes (avec le stock présent à la source) et ce que la personne peut en faire. */
export async function lireTransfert(ctx: ContextePos, transfertId: string) {
  const t = await prisma.transfertStock.findFirst({
    where: { id: transfertId, tenantId: ctx.tenantId },
    include: { lignes: { orderBy: { id: "asc" }, include: { produit: { select: { nom: true, sku: true, codeBarres: true, images: true, uniteVente: true, stock: true, variantes: { select: { id: true, nom: true, valeur: true, sku: true, codeBarres: true, stock: true } } } } } } },
  });
  if (!t) throw new ErreurPos("introuvable", 404, "Ce transfert est introuvable dans cette boutique.");
  const [entrepots, noms, stocks] = await Promise.all([
    prisma.entrepot.findMany({ where: { tenantId: ctx.tenantId, id: { in: [t.entrepotSourceId, t.entrepotDestinationId] } }, select: { id: true, nom: true } }),
    nomsUtilisateurs(ctx.tenantId, [t.demandePar, t.approuvePar]),
    stocksDuLieu(prisma, ctx.tenantId, t.entrepotSourceId, t.lignes.map((l) => ({ produitId: l.produitId, varianteId: l.varianteId, stock: l.produit.variantes.find((v) => v.id === l.varianteId)?.stock ?? l.produit.stock }))),
  ]);
  const nom = (entrepotId: string) => entrepots.find((e) => e.id === entrepotId)?.nom ?? "Lieu supprimé";
  return {
    transfert: {
      id: t.id, numero: t.numero, statut: t.statut, notes: t.notes,
      entrepotSourceId: t.entrepotSourceId, source: nom(t.entrepotSourceId), entrepotDestinationId: t.entrepotDestinationId, destination: nom(t.entrepotDestinationId),
      demandePar: noms[t.demandePar] ?? null, approuvePar: t.approuvePar ? noms[t.approuvePar] ?? null : null,
      createdAt: t.createdAt.toISOString(), expedieAt: t.expedieAt?.toISOString() ?? null, recuAt: t.recuAt?.toISOString() ?? null,
    },
    lignes: t.lignes.map((l) => {
      const v = l.produit.variantes.find((x) => x.id === l.varianteId);
      return {
        id: l.id, cleArticle: l.cleArticle, produitId: l.produitId, varianteId: l.varianteId, nom: l.produit.nom, variante: v ? `${v.nom}: ${v.valeur}` : null,
        sku: v?.sku ?? l.produit.sku, codeBarres: v?.codeBarres ?? l.produit.codeBarres, image: l.produit.images[0] ?? null, uniteVente: l.produit.uniteVente,
        quantiteDemandee: l.quantiteDemandee, quantiteExpediee: l.quantiteExpediee, quantiteRecue: l.quantiteRecue,
        stockSource: stocks.get(l.cleArticle) ?? 0,
      };
    }),
    actions: actionsPossibles(t.statut, ctx.droits),
  };
}

export const schemaActionTransfert = z.object({
  cle,
  action: z.enum(["demander", "approuver", "preparer", "preparation", "expedier", "recevoir", "cloturer", "annuler"]),
  /** preparation : quantité préparée de chaque ligne (valeur exacte). recevoir : quantité reçue MAINTENANT (s'ajoute au déjà reçu). */
  lignes: z.array(z.object({ ligneId: id, quantite: z.number().int().min(0).max(10_000_000) })).max(200).optional(),
  /** expedier : expédier toutes les lignes pour la quantité demandée, sans préparation ligne à ligne. */
  tout: z.boolean().optional(),
  /** cloturer : sort du manque (expédié mais jamais reçu). */
  sort: z.enum(["perte", "retour_source"]).optional(),
  motif: z.string().trim().max(300).nullish(),
});
export type DemandeActionTransfert = z.infer<typeof schemaActionTransfert>;

const codeArrivee = (codeLot: string, numero: string) => `${codeLot}-${numero}`;

/** Lots partis avec ce transfert pour un produit et pas encore arrivés à destination, dans l'ordre d'expédition. */
async function lotsEnTransit(tx: Prisma.TransactionClient, tenantId: string, t: { id: string; numero: string }, produitId: string) {
  const sorties = await tx.stockMouvement.findMany({
    where: { tenantId, transfertId: t.id, produitId, type: "transfert_sortie", lotId: { not: null } },
    orderBy: { createdAt: "asc" }, select: { quantite: true, lot: true },
  });
  const partis = new Map<string, { origine: NonNullable<(typeof sorties)[number]["lot"]>; quantite: number }>();
  for (const s of sorties) if (s.lot) partis.set(s.lot.id, { origine: s.lot, quantite: (partis.get(s.lot.id)?.quantite ?? 0) + s.quantite });
  if (!partis.size) return [];
  const arrives = await tx.lotTracabilite.findMany({
    where: { tenantId, codeLot: { in: [...partis.values()].map((x) => codeArrivee(x.origine.codeLot, t.numero)) } }, select: { codeLot: true, quantiteInitiale: true },
  });
  return [...partis.values()]
    .map((x) => ({ origine: x.origine, quantite: x.quantite - (arrives.find((a) => a.codeLot === codeArrivee(x.origine.codeLot, t.numero))?.quantiteInitiale ?? 0) }))
    .filter((x) => x.quantite > 0);
}

export type ResultatTransfert = {
  transfertId: string; numero: string; statut: string;
  /** Lignes où le reçu reste inférieur à l'expédié (après réception ou clôture). */
  ecarts: { nom: string; expedie: number; recu: number }[];
};

const AUDIT: Record<ActionTransfert, string> = {
  demander: "transfert.demande", approuver: "transfert.approuve", preparer: "transfert.en_preparation", preparation: "transfert.preparation",
  expedier: "transfert.expedie", recevoir: "transfert.recu", cloturer: "transfert.cloture", annuler: "transfert.annule",
};

/** Fait avancer un transfert d'un statut au suivant, en bougeant le stock à l'expédition et à la réception. */
export async function actionTransfert(ctx: ContextePos, transfertId: string, d: DemandeActionTransfert): Promise<ResultatTransfert & { rejoue: boolean }> {
  const regle = ACTIONS_TRANSFERT[d.action];
  exigerUnDroit(ctx, ...regle.droits);
  const motif = d.motif?.trim() ?? "";
  if (d.action === "cloturer" && (motif.length < 3 || !d.sort)) throw new ErreurPos("motif_requis", 422, "Pour clôturer un transfert incomplet, indiquez ce que devient le manque et pourquoi (3 caractères au moins).");

  const { resultat, rejoue } = await avecIdempotence<ResultatTransfert>(ctx.tenantId, d.cle, `transfert.${d.action}`, async (tx) => {
    const avant = await tx.transfertStock.findFirst({ where: { id: transfertId, tenantId: ctx.tenantId }, select: { statut: true } });
    if (!avant) throw new ErreurPos("introuvable", 404, "Ce transfert est introuvable dans cette boutique.");
    // Bascule conditionnelle : verrouille le transfert et écarte une demande concurrente (double expédition, double réception).
    const bascule = await tx.transfertStock.updateMany({
      where: { id: transfertId, tenantId: ctx.tenantId, statut: { in: regle.depuis } },
      // Sans statut d'arrivée fixe, on réécrit le statut courant : l'écriture pose le verrou (la réception recalcule le sien plus bas).
      data: { statut: regle.vers ?? avant.statut, ...(d.action === "approuver" ? { approuvePar: ctx.userId } : {}), ...(d.action === "expedier" ? { expedieAt: new Date() } : {}), ...(d.action === "cloturer" ? { recuAt: new Date() } : {}) },
    });
    if (!bascule.count) throw new ErreurPos("conflit", 409, `Ce transfert est « ${avant.statut} » : cette action n'est plus possible. Rechargez la page.`);
    const t = await tx.transfertStock.findUniqueOrThrow({ where: { id: transfertId }, include: { lignes: { include: { produit: { select: { nom: true } } } } } });
    // Membre limité à certains magasins : on reçoit à l'arrivée, on prépare / expédie au départ ; le reste demande d'être de l'un des deux.
    if (d.action === "recevoir") await exigerLieu(tx, ctx, t.entrepotDestinationId);
    else if (d.action === "preparation" || d.action === "expedier" || !(await lieuAutorise(tx, ctx, t.entrepotDestinationId))) await exigerLieu(tx, ctx, t.entrepotSourceId);
    const demandees = new Map((d.lignes ?? []).map((l) => [l.ligneId, l.quantite]));
    for (const ligneId of demandees.keys()) if (!t.lignes.some((l) => l.id === ligneId)) throw new ErreurPos("introuvable", 404, "Une ligne ne fait pas partie de ce transfert. Rechargez la page.");
    let statut: string = regle.vers ?? t.statut;
    let lignes = t.lignes;
    const relire = async () => { lignes = (await tx.transfertStock.findUniqueOrThrow({ where: { id: transfertId }, include: { lignes: { include: { produit: { select: { nom: true } } } } } })).lignes; };
    const touches = new Set<string>();

    if (d.action === "preparation") {
      for (const l of lignes) {
        const q = demandees.get(l.id);
        if (q === undefined) continue;
        if (q > l.quantiteDemandee) throw new ErreurPos("invalide", 422, `« ${l.produit.nom} » : ${q} préparé(s) pour ${l.quantiteDemandee} demandé(s). On ne prépare pas plus que la demande.`);
        await tx.ligneTransfert.update({ where: { id: l.id }, data: { quantiteExpediee: q } });
      }
      await relire();
    }

    if (d.action === "expedier") {
      for (const l of lignes) {
        const q = demandees.get(l.id) ?? (d.tout ? l.quantiteDemandee : l.quantiteExpediee);
        if (q > l.quantiteDemandee) throw new ErreurPos("invalide", 422, `« ${l.produit.nom} » : on n'expédie pas plus que la quantité demandée (${l.quantiteDemandee}).`);
        if (q !== l.quantiteExpediee) await tx.ligneTransfert.update({ where: { id: l.id }, data: { quantiteExpediee: q } });
      }
      await relire();
      if (!lignes.some((l) => l.quantiteExpediee > 0)) throw new ErreurPos("invalide", 422, "Aucun article n'est préparé. Scannez les articles à expédier, ou expédiez tout comme demandé.");
      const lieu = await resoudreLieu(tx, ctx.tenantId, t.entrepotSourceId);
      for (const l of lignes.filter((x) => x.quantiteExpediee > 0)) {
        await mouvementStock(tx, { tenantId: ctx.tenantId, produitId: l.produitId, varianteId: l.varianteId, lieu, type: "transfert_sortie", quantite: l.quantiteExpediee, motif: `Transfert ${t.numero} — expédition`, refs: { transfertId }, creePar: ctx.userId });
        touches.add(l.produitId);
      }
    }

    if (d.action === "recevoir") {
      if (![...demandees.values()].some((q) => q > 0)) throw new ErreurPos("invalide", 422, "Indiquez au moins une quantité reçue.");
      const lieu = await resoudreLieu(tx, ctx.tenantId, t.entrepotDestinationId);
      for (const l of lignes) {
        const q = demandees.get(l.id) ?? 0;
        if (q <= 0) continue;
        const attendu = l.quantiteExpediee - l.quantiteRecue;
        if (q > attendu) throw new ErreurPos("invalide", 422, `« ${l.produit.nom} » : ${q} reçu(s) alors qu'il en reste ${attendu} à recevoir. Un surplus se corrige par un ajustement de stock.`);
        await tx.ligneTransfert.update({ where: { id: l.id }, data: { quantiteRecue: { increment: q } } });
        const entree = { tenantId: ctx.tenantId, produitId: l.produitId, varianteId: l.varianteId, lieu, type: "transfert_entree" as const, motif: `Transfert ${t.numero} — réception`, creePar: ctx.userId };
        // Les lots suivent la marchandise : ce qui arrive recrée à destination le lot parti de la source.
        let horsLot = q;
        for (const { origine, quantite } of await lotsEnTransit(tx, ctx.tenantId, t, l.produitId)) {
          const n = Math.floor(Math.min(quantite, horsLot));
          if (n <= 0) continue;
          const o = origine;
          const arrive = await tx.lotTracabilite.upsert({
            where: { tenantId_codeLot: { tenantId: ctx.tenantId, codeLot: codeArrivee(o.codeLot, t.numero) } },
            create: {
              tenantId: ctx.tenantId, produitId: l.produitId, codeLot: codeArrivee(o.codeLot, t.numero), quantiteInitiale: n, quantiteRestante: n, entrepotId: t.entrepotDestinationId,
              dateReception: o.dateReception, dateExpiration: o.dateExpiration, certification: o.certification, cout: o.cout,
              fournisseurId: o.fournisseurId, fournisseurNom: o.fournisseurNom, fournisseurRef: o.fournisseurRef, notes: `Issu du lot ${o.codeLot} — transfert ${t.numero}`,
            },
            update: { quantiteInitiale: { increment: n }, quantiteRestante: { increment: n } },
          });
          if (arrive.statut === "epuise") await tx.lotTracabilite.update({ where: { id: arrive.id }, data: { statut: "actif" } });
          await mouvementStock(tx, { ...entree, quantite: n, refs: { transfertId, lotId: arrive.id } });
          horsLot -= n;
        }
        if (horsLot > 0) await mouvementStock(tx, { ...entree, quantite: horsLot, refs: { transfertId } });
        touches.add(l.produitId);
      }
      await relire();
      statut = statutApresReception(lignes);
      await tx.transfertStock.update({ where: { id: transfertId }, data: { statut, ...(statut === "recu" ? { recuAt: new Date() } : {}) } });
    }

    const ecarts = ["expedie", "partiellement_recu", "recu"].includes(statut)
      ? lignes.filter((l) => l.quantiteRecue < l.quantiteExpediee).map((l) => ({ nom: l.produit.nom, expedie: l.quantiteExpediee, recu: l.quantiteRecue }))
      : [];

    if (d.action === "cloturer" && d.sort === "retour_source") {
      // Le manque revient dans le stock de la source : il n'est donc pas perdu.
      const lieu = await resoudreLieu(tx, ctx.tenantId, t.entrepotSourceId);
      // Lots déjà recrédités dans cette clôture (deux lignes d'un même produit à variantes partagent ses lots).
      const rendus = new Map<string, number>();
      for (const l of lignes.filter((x) => x.quantiteRecue < x.quantiteExpediee)) {
        const retour = { tenantId: ctx.tenantId, produitId: l.produitId, varianteId: l.varianteId, lieu, type: "transfert_entree" as const, motif: `Transfert ${t.numero} — retour du manque à la source`, creePar: ctx.userId };
        let horsLot = l.quantiteExpediee - l.quantiteRecue;
        for (const { origine, quantite } of await lotsEnTransit(tx, ctx.tenantId, t, l.produitId)) {
          const n = Math.floor(Math.min(quantite - (rendus.get(origine.id) ?? 0), horsLot));
          if (n <= 0) continue;
          await tx.lotTracabilite.update({ where: { id: origine.id }, data: { quantiteRestante: { increment: n }, ...(origine.statut === "epuise" ? { statut: "actif" } : {}) } });
          rendus.set(origine.id, (rendus.get(origine.id) ?? 0) + n);
          await mouvementStock(tx, { ...retour, quantite: n, refs: { transfertId, lotId: origine.id } });
          horsLot -= n;
        }
        if (horsLot > 0) await mouvementStock(tx, { ...retour, quantite: horsLot, refs: { transfertId } });
        touches.add(l.produitId);
      }
    }

    // L'enregistrement des quantités préparées n'est pas un fait critique : pas d'entrée d'audit à chaque scan.
    if (d.action !== "preparation") {
      await journaliserAudit(tx, ctx, {
        action: d.action === "recevoir" && statut === "partiellement_recu" ? "transfert.partiellement_recu" : AUDIT[d.action],
        entite: "TransfertStock", entiteId: transfertId, motif: motif || null,
        avant: { statut: avant.statut }, apres: { statut, numero: t.numero, ...(d.action === "cloturer" ? { sort: d.sort } : {}), ...(ecarts.length ? { ecarts } : {}), ...(d.action === "recevoir" ? { recu: Object.fromEntries(demandees) } : {}) },
      });
    }
    if (touches.size) await publierEvenement(tx, { tenantId: ctx.tenantId, magasinId: ctx.magasinId, type: "inventory.updated", payload: { origine: "transfert", transfertId, numero: t.numero, statut, produitIds: [...touches] } });
    return { transfertId, numero: t.numero, statut, ecarts };
  }, { appareilId: ctx.appareilId, userId: ctx.userId });
  return { ...resultat, rejoue };
}
