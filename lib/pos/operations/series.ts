// Numéros de série et IMEI (§12). SERVEUR uniquement.
//
// Une ligne NumeroSerie par unité : statut (en_stock | vendu | retourne |
// defectueux | bloque), garantie, client et date d'achat. La vente
// (lib/pos/vente.ts → vendreNumeroSerie) ne prend qu'un numéro « en_stock » ou
// « retourne » : un numéro vendu, bloqué ou défectueux est refusé.
//
// ENREGISTRER un numéro identifie une unité déjà en stock : cela n'ajoute pas
// de stock (c'est la réception, ou un ajustement, qui le fait).
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { journaliserAudit } from "../audit";
import { aDroit, exigerLieu, exigerUnDroit } from "../droits";
import { ErreurPos } from "../erreurs";
import { avecIdempotence } from "../idempotence";
import { resoudreLieu } from "../stock";
import { normaliserSerie, type ContextePos } from "../types";

export const STATUTS_SERIE = ["en_stock", "vendu", "retourne", "defectueux", "bloque"] as const;
export type StatutSerie = (typeof STATUTS_SERIE)[number];

/** Actions manuelles sur un numéro : statuts de départ acceptés et statut d'arrivée. PURE. */
export const ACTIONS_SERIE: Record<"bloquer" | "debloquer" | "defectueux" | "remettre_en_stock", { depuis: StatutSerie[]; vers: StatutSerie; audit: string }> = {
  bloquer: { depuis: ["en_stock", "retourne"], vers: "bloque", audit: "serie.bloquee" },
  debloquer: { depuis: ["bloque"], vers: "en_stock", audit: "serie.debloquee" },
  defectueux: { depuis: ["en_stock", "retourne", "bloque"], vers: "defectueux", audit: "serie.defectueuse" },
  remettre_en_stock: { depuis: ["retourne", "defectueux"], vers: "en_stock", audit: "serie.remise_en_stock" },
};

const SELECTION = {
  id: true, numero: true, statut: true, produitId: true, varianteId: true, entrepotId: true, lotId: true, commandeId: true, clientId: true,
  venduAt: true, garantieFinAt: true, coutAchat: true, createdAt: true,
  produit: { select: { nom: true, images: true, garantieMois: true, variantes: { select: { id: true, nom: true, valeur: true } } } },
} satisfies Prisma.NumeroSerieSelect;
type Ligne = Prisma.NumeroSerieGetPayload<{ select: typeof SELECTION }>;

async function habiller(ctx: ContextePos, lignes: Ligne[]) {
  const uniques = (ids: (string | null)[]) => [...new Set(ids.filter((i): i is string => !!i))];
  const [clients, commandes, entrepots] = await Promise.all([
    prisma.client.findMany({ where: { tenantId: ctx.tenantId, id: { in: uniques(lignes.map((l) => l.clientId)) } }, select: { id: true, nom: true, telephone: true } }),
    prisma.commande.findMany({ where: { tenantId: ctx.tenantId, id: { in: uniques(lignes.map((l) => l.commandeId)) } }, select: { id: true, numero: true } }),
    prisma.entrepot.findMany({ where: { tenantId: ctx.tenantId, id: { in: uniques(lignes.map((l) => l.entrepotId)) } }, select: { id: true, nom: true } }),
  ]);
  const couts = aDroit(ctx, "voir_couts");
  const maintenant = Date.now();
  return lignes.map((l) => {
    const v = l.produit.variantes.find((x) => x.id === l.varianteId);
    const client = clients.find((c) => c.id === l.clientId);
    return {
      id: l.id, numero: l.numero, statut: l.statut, produitId: l.produitId, varianteId: l.varianteId,
      produitNom: l.produit.nom, variante: v ? `${v.nom}: ${v.valeur}` : null, image: l.produit.images[0] ?? null,
      entrepotId: l.entrepotId, entrepotNom: entrepots.find((e) => e.id === l.entrepotId)?.nom ?? null,
      commandeId: l.commandeId, venteNumero: commandes.find((c) => c.id === l.commandeId)?.numero ?? null,
      client: client ? { id: client.id, nom: client.nom, telephone: client.telephone } : null,
      venduAt: l.venduAt?.toISOString() ?? null, garantieFinAt: l.garantieFinAt?.toISOString() ?? null,
      garantie: !l.garantieFinAt ? "aucune" : l.garantieFinAt.getTime() >= maintenant ? "en_cours" : "expiree",
      garantieMois: l.produit.garantieMois, coutAchat: couts ? l.coutAchat : null, createdAt: l.createdAt.toISOString(),
    };
  });
}

/** Recherche de numéros (numéro ou IMEI, entier ou partiel), filtrable par statut et par produit, paginée par curseur. */
export async function listerSeries(ctx: ContextePos, f: { q?: string | null; statut?: string | null; produitId?: string | null; curseur?: string | null; limite?: number }) {
  const limite = Math.min(Math.max(Math.floor(f.limite ?? 40), 1), 100);
  const terme = f.q?.trim().slice(0, 100);
  const where: Prisma.NumeroSerieWhereInput = {
    tenantId: ctx.tenantId,
    ...(f.statut && (STATUTS_SERIE as readonly string[]).includes(f.statut) ? { statut: f.statut } : {}),
    ...(f.produitId ? { produitId: f.produitId } : {}),
    ...(terme ? { OR: [{ numero: { contains: terme, mode: "insensitive" } }, { produit: { nom: { contains: terme, mode: "insensitive" } } }] } : {}),
  };
  const [lignes, compte] = await Promise.all([
    prisma.numeroSerie.findMany({ where, select: SELECTION, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limite + 1, ...(f.curseur ? { cursor: { id: f.curseur }, skip: 1 } : {}) }),
    prisma.numeroSerie.groupBy({ by: ["statut"], where: { tenantId: ctx.tenantId }, _count: { _all: true } }),
  ]);
  const page = lignes.slice(0, limite);
  return {
    series: await habiller(ctx, page),
    curseurSuivant: lignes.length > limite ? page[page.length - 1].id : null,
    stats: Object.fromEntries(compte.map((c) => [c.statut, c._count._all])) as Record<string, number>,
  };
}

/** Un numéro et son histoire : enregistrement, ventes (y compris annulées ou retournées), blocages. */
export async function detailSerie(ctx: ContextePos, serieId: string) {
  const ligne = await prisma.numeroSerie.findFirst({ where: { id: serieId, tenantId: ctx.tenantId }, select: SELECTION });
  if (!ligne) throw new ErreurPos("introuvable", 404, "Ce numéro de série est introuvable dans cette boutique.");
  const [serie] = await habiller(ctx, [ligne]);
  const [ventes, journal] = await Promise.all([
    prisma.ligneCommande.findMany({
      where: { numeroSerieId: ligne.id, commande: { tenantId: ctx.tenantId } },
      select: { quantiteRetournee: true, commande: { select: { id: true, numero: true, statut: true, createdAt: true, clientNom: true } } },
    }),
    prisma.journalAudit.findMany({
      where: { tenantId: ctx.tenantId, entite: "NumeroSerie", entiteId: ligne.id }, orderBy: { createdAt: "asc" }, take: 100,
      select: { action: true, userNom: true, motif: true, createdAt: true },
    }),
  ]);
  const libelles: Record<string, string> = {
    "serie.enregistree": "Numéro enregistré", "serie.bloquee": "Numéro bloqué", "serie.debloquee": "Numéro débloqué",
    "serie.defectueuse": "Déclaré défectueux", "serie.remise_en_stock": "Remis en stock",
  };
  const historique = [
    // Un numéro créé à la volée par une vente n'a pas d'entrée « enregistré » dans l'audit : sa date de création en tient lieu.
    ...(journal.some((j) => j.action === "serie.enregistree") ? [] : [{ date: ligne.createdAt.toISOString(), libelle: "Numéro connu de la boutique", detail: null as string | null, auteur: null as string | null }]),
    ...journal.map((j) => ({ date: j.createdAt.toISOString(), libelle: libelles[j.action] ?? j.action, detail: j.motif, auteur: j.userNom })),
    ...ventes.map((v) => ({
      date: v.commande.createdAt.toISOString(),
      libelle: v.commande.statut === "annulee" ? "Vendu, puis vente annulée" : v.quantiteRetournee > 0 ? "Vendu, puis retourné" : "Vendu",
      detail: `Vente #${v.commande.numero}${v.commande.clientNom ? ` — ${v.commande.clientNom}` : ""}`, auteur: null,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return { serie, historique };
}

const id = z.string().trim().min(1).max(64);
const cle = z.string().trim().min(8).max(200);

export const schemaSeries = z.object({
  cle,
  produitId: id,
  varianteId: id.nullish(),
  numeros: z.array(z.string().trim().min(3, "Un numéro de série fait au moins 3 caractères.").max(100)).min(1, "Saisissez au moins un numéro.").max(200),
  entrepotId: id.nullish(),
  lotId: id.nullish(),
  coutAchat: z.number().finite().min(0).max(1e12).nullish(),
  /** Active le suivi par numéro de série sur le produit s'il ne l'est pas encore (la caisse exigera alors un numéro à chaque vente). */
  activerSuivi: z.boolean().optional(),
  garantieMois: z.number().int().min(0).max(240).nullish(),
});
export type DemandeSeries = z.infer<typeof schemaSeries>;

/** Enregistre des numéros de série pour un article (à la réception ou à la main). Tout ou rien : un seul numéro déjà connu refuse la demande. */
export async function enregistrerSeries(ctx: ContextePos, d: DemandeSeries): Promise<{ enregistres: number; produitId: string; rejoue: boolean }> {
  exigerUnDroit(ctx, "reception", "ajuster_stock");
  const numeros = [...new Set(d.numeros.map((n) => normaliserSerie(n)))];
  const { resultat, rejoue } = await avecIdempotence(ctx.tenantId, d.cle, "serie.enregistree", async (tx) => {
    const produit = await tx.produit.findFirst({ where: { id: d.produitId, tenantId: ctx.tenantId }, select: { id: true, nom: true, type: true, suiviSerie: true, garantieMois: true, variantes: { where: { actif: true }, select: { id: true } } } });
    if (!produit) throw new ErreurPos("introuvable", 404, "Ce produit est introuvable dans cette boutique.");
    if (produit.type !== "physique") throw new ErreurPos("invalide", 400, `« ${produit.nom} » n'est pas un article physique : il ne porte pas de numéro de série.`);
    if (d.varianteId && !produit.variantes.some((v) => v.id === d.varianteId)) throw new ErreurPos("introuvable", 404, `Cette variante de « ${produit.nom} » est introuvable.`);
    if (!d.varianteId && produit.variantes.length) throw new ErreurPos("variante_requise", 422, `« ${produit.nom} » a des variantes : choisissez laquelle.`, { produitId: produit.id });
    if (!produit.suiviSerie && !d.activerSuivi) {
      throw new ErreurPos("suivi_inactif", 422, `« ${produit.nom} » n'est pas suivi par numéro de série. Activez le suivi pour enregistrer ses numéros : la caisse demandera alors un numéro à chaque vente.`, { produitId: produit.id });
    }
    // Lecture AVANT écriture : un doublon ne doit pas faire échouer la transaction sur l'unicité.
    // Sans tenir compte de la casse : des numéros d'avant la normalisation peuvent être en minuscules.
    const connus = await tx.numeroSerie.findMany({ where: { tenantId: ctx.tenantId, OR: numeros.map((numero) => ({ numero: { equals: numero, mode: "insensitive" as const } })) }, select: { numero: true } });
    if (connus.length) {
      throw new ErreurPos("serie_connue", 409, connus.length === 1 ? `Le numéro ${connus[0].numero} est déjà enregistré. Rien n'a été ajouté.` : `${connus.length} numéros sont déjà enregistrés (${connus.slice(0, 5).map((c) => c.numero).join(", ")}${connus.length > 5 ? "…" : ""}). Rien n'a été ajouté.`, { numeros: connus.map((c) => c.numero) });
    }
    const lieu = await resoudreLieu(tx, ctx.tenantId, d.entrepotId);
    await exigerLieu(tx, ctx, lieu?.entrepotId);
    if (d.lotId && !(await tx.lotTracabilite.findFirst({ where: { id: d.lotId, tenantId: ctx.tenantId, produitId: produit.id }, select: { id: true } }))) {
      throw new ErreurPos("introuvable", 404, "Ce lot est introuvable pour cet article.");
    }
    const garantieChange = d.garantieMois !== undefined && d.garantieMois !== null && d.garantieMois !== produit.garantieMois;
    if (!produit.suiviSerie || garantieChange) {
      await tx.produit.updateMany({ where: { id: produit.id, tenantId: ctx.tenantId }, data: { suiviSerie: true, ...(garantieChange ? { garantieMois: d.garantieMois } : {}) } });
      await journaliserAudit(tx, ctx, { action: "produit.suivi_serie", entite: "Produit", entiteId: produit.id, avant: { suiviSerie: produit.suiviSerie, garantieMois: produit.garantieMois }, apres: { suiviSerie: true, garantieMois: garantieChange ? d.garantieMois : produit.garantieMois } });
    }
    await tx.numeroSerie.createMany({
      data: numeros.map((numero) => ({ tenantId: ctx.tenantId, produitId: produit.id, varianteId: d.varianteId ?? null, numero, entrepotId: lieu?.entrepotId ?? null, lotId: d.lotId ?? null, coutAchat: d.coutAchat ?? null })),
    });
    const crees = await tx.numeroSerie.findMany({ where: { tenantId: ctx.tenantId, numero: { in: numeros } }, select: { id: true, numero: true } });
    // Une entrée d'audit par numéro : c'est elle qui ouvre l'historique de l'unité.
    for (const s of crees) await journaliserAudit(tx, ctx, { action: "serie.enregistree", entite: "NumeroSerie", entiteId: s.id, apres: { numero: s.numero, produitId: produit.id, varianteId: d.varianteId ?? null, entrepotId: lieu?.entrepotId ?? null } });
    return { enregistres: crees.length, produitId: produit.id };
  }, { appareilId: ctx.appareilId, userId: ctx.userId });
  return { ...resultat, rejoue };
}

export const schemaActionSerie = z.object({
  cle,
  action: z.enum(["bloquer", "debloquer", "defectueux", "remettre_en_stock"]),
  motif: z.string().trim().min(3, "Indiquez le motif (3 caractères au moins).").max(300),
});

/** Bloque, débloque, déclare défectueux ou remet en stock un numéro. Un numéro vendu ne se modifie que par un retour ou une annulation de vente. */
export async function changerSerie(ctx: ContextePos, serieId: string, d: z.infer<typeof schemaActionSerie>): Promise<{ id: string; numero: string; statut: string; rejoue: boolean }> {
  exigerUnDroit(ctx, "ajuster_stock");
  const regle = ACTIONS_SERIE[d.action];
  const { resultat, rejoue } = await avecIdempotence(ctx.tenantId, d.cle, "serie.action", async (tx) => {
    const serie = await tx.numeroSerie.findFirst({ where: { id: serieId, tenantId: ctx.tenantId }, select: { id: true, numero: true, statut: true } });
    if (!serie) throw new ErreurPos("introuvable", 404, "Ce numéro de série est introuvable dans cette boutique.");
    const bascule = await tx.numeroSerie.updateMany({ where: { id: serie.id, tenantId: ctx.tenantId, statut: { in: regle.depuis } }, data: { statut: regle.vers } });
    if (!bascule.count) {
      throw new ErreurPos("conflit", 409, serie.statut === "vendu"
        ? `Le numéro ${serie.numero} est vendu : il ne change d'état que par un retour ou l'annulation de la vente.`
        : `Le numéro ${serie.numero} est « ${serie.statut} » : cette action n'est pas possible.`);
    }
    await journaliserAudit(tx, ctx, { action: regle.audit, entite: "NumeroSerie", entiteId: serie.id, motif: d.motif, avant: { statut: serie.statut }, apres: { statut: regle.vers, numero: serie.numero } });
    return { id: serie.id, numero: serie.numero, statut: regle.vers as string };
  }, { appareilId: ctx.appareilId, userId: ctx.userId });
  return { ...resultat, rejoue };
}
