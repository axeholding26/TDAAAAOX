// Bons de commande fournisseur de la caisse (BonCommande) : création, lignes,
// cycle de vie, envoi. SERVEUR uniquement.
//
// Ce n'est PAS CommandeFournisseur (routage dropshipping d'une commande
// client) : un bon de commande réassortit le stock d'un entrepôt.
// Les montants sont dans la devise de la boutique. Les règles (transitions,
// total, texte) sont dans ./regles.ts.
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { emailReel, envoyerEmailTexte, hasResend } from "../../email";
import { formatMontant, genererNumeroCommande } from "../../utils";
import { journaliserAudit } from "../audit";
import { aDroit, exigerDroit } from "../droits";
import { ErreurPos, erreurs } from "../erreurs";
import { avecIdempotence, avecRepriseCollision, mutationConnue } from "../idempotence";
import { entrepotDuMagasin } from "../magasins";
import { decimalesDevise } from "../tarification";
import { cleArticle, type ContextePos } from "../types";
import { ACTIONS_BON, texteBon, totalBon, transitionBon, type ActionBon, type StatutBon } from "./regles";

type Tx = Prisma.TransactionClient;

export const MAX_LIGNES_BON = 200;

const schemaLigneBon = z.object({
  produitId: z.string().min(1),
  varianteId: z.string().min(1).nullish(),
  quantite: z.number().int("La quantité doit être un nombre entier.").positive("La quantité doit être supérieure à zéro.").max(10_000_000),
  prixUnitaire: z.number().min(0, "Le prix d'achat ne peut pas être négatif.").max(1e12),
});
const dateOptionnelle = z.string().nullish().refine((d) => !d || !Number.isNaN(Date.parse(d)), "La date de livraison est illisible.");

export const schemaBon = z.object({
  fournisseurId: z.string().min(1, "Choisissez un fournisseur."),
  entrepotId: z.string().min(1).nullish(),
  dateAttendue: dateOptionnelle,
  notes: z.string().trim().max(1000).nullish(),
  lignes: z.array(schemaLigneBon).min(1, "Ajoutez au moins un produit au bon de commande.").max(MAX_LIGNES_BON, `Un bon de commande contient ${MAX_LIGNES_BON} lignes au plus.`),
});
export type DemandeBon = z.infer<typeof schemaBon>;

export const schemaActionBon = z.object({
  action: z.enum(Object.keys(ACTIONS_BON) as [ActionBon, ...ActionBon[]]),
  motif: z.string().trim().max(500).nullish(),
});

/** Numéro de bon : BC-YYYYMMDD-XXXXXX (même tirage que les numéros de vente), unique par boutique ; une collision fait retirer un numéro. */
const numeroBon = () => genererNumeroCommande().replace(/^AX-/, "BC-");

// ─── Lecture ─────────────────────────────────────────────────────────────────

const INCLURE = {
  fournisseur: { select: { id: true, nom: true, email: true, telephone: true } },
  lignes: {
    orderBy: { id: "asc" },
    include: { produit: { select: { nom: true, sku: true, codeBarres: true, uniteVente: true, suiviSerie: true, variantes: { select: { id: true, nom: true, valeur: true, sku: true, codeBarres: true, actif: true } } } } },
  },
} satisfies Prisma.BonCommandeInclude;
type BonCharge = Prisma.BonCommandeGetPayload<{ include: typeof INCLURE }>;

function vueBon(b: BonCharge, entrepots: Map<string, { id: string; nom: string; adresse: string | null; ville: string | null }>) {
  return {
    id: b.id, numero: b.numero, statut: b.statut as StatutBon, source: b.source, devise: b.devise, montantTotal: b.montantTotal,
    dateAttendue: b.dateAttendue?.toISOString() ?? null, createdAt: b.createdAt.toISOString(), notes: b.notes, creePar: b.creePar,
    fournisseur: b.fournisseur,
    entrepot: entrepots.get(b.entrepotId) ?? null,
    lignes: b.lignes.map((l) => {
      const v = l.varianteId ? l.produit.variantes.find((x) => x.id === l.varianteId) : null;
      return {
        id: l.id, produitId: l.produitId, varianteId: l.varianteId, nom: l.produit.nom, variante: v ? `${v.nom}: ${v.valeur}` : null,
        sku: v?.sku ?? l.produit.sku, codeBarres: v?.codeBarres ?? l.produit.codeBarres,
        uniteVente: l.produit.uniteVente, suiviSerie: l.produit.suiviSerie,
        // Variantes proposées à la réception quand la ligne n'en précise aucune.
        variantes: l.varianteId ? [] : l.produit.variantes.filter((x) => x.actif).map((x) => ({ id: x.id, libelle: `${x.nom}: ${x.valeur}` })),
        quantite: l.quantite, quantiteRecue: l.quantiteRecue, prixUnitaire: l.prixUnitaire,
      };
    }),
  };
}
export type BonVue = ReturnType<typeof vueBon>;

async function entrepotsBoutique(tenantId: string) {
  const liste = await prisma.entrepot.findMany({ where: { tenantId }, select: { id: true, nom: true, adresse: true, ville: true } });
  return new Map(liste.map((e) => [e.id, e]));
}

export async function listerBons(tenantId: string, p: { statut?: string | null; curseur?: string | null; limite?: number } = {}) {
  const limite = Math.min(Math.max(p.limite ?? 30, 1), 100);
  const [bons, entrepots] = await Promise.all([
    prisma.bonCommande.findMany({
      where: { tenantId, ...(p.statut ? { statut: p.statut } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limite + 1, ...(p.curseur ? { cursor: { id: p.curseur }, skip: 1 } : {}),
      include: INCLURE,
    }),
    entrepotsBoutique(tenantId),
  ]);
  const page = bons.slice(0, limite);
  return { bons: page.map((b) => vueBon(b, entrepots)), curseurSuivant: bons.length > limite ? page[page.length - 1].id : null };
}

export async function lireBon(tenantId: string, id: string): Promise<BonVue> {
  const [bon, entrepots] = await Promise.all([
    prisma.bonCommande.findFirst({ where: { id, tenantId }, include: INCLURE }),
    entrepotsBoutique(tenantId),
  ]);
  if (!bon) throw erreurs.introuvable("Ce bon de commande");
  return vueBon(bon, entrepots);
}

// ─── Écriture ────────────────────────────────────────────────────────────────

/** Vérifie que chaque ligne désigne un produit physique (et une variante) de la boutique ; rend l'unité de vente par produit. */
async function verifierLignes(tenantId: string, bons: Pick<DemandeBon, "lignes">[]): Promise<Map<string, string>> {
  const ids = [...new Set(bons.flatMap((b) => b.lignes.map((l) => l.produitId)))];
  const produits = await prisma.produit.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, nom: true, type: true, uniteVente: true, variantes: { select: { id: true } } } });
  const parId = new Map(produits.map((p) => [p.id, p]));
  for (const b of bons) {
    const vus = new Set<string>();
    for (const l of b.lignes) {
      const p = parId.get(l.produitId);
      if (!p) throw erreurs.introuvable("Un des produits du bon");
      if (p.type !== "physique") throw erreurs.invalide(`« ${p.nom} » n'a pas de stock suivi : il ne peut pas figurer sur un bon de commande.`);
      if (l.varianteId && !p.variantes.some((v) => v.id === l.varianteId)) throw erreurs.introuvable(`La variante choisie pour « ${p.nom} »`);
      const cle = cleArticle(l.produitId, l.varianteId);
      if (vus.has(cle)) throw erreurs.invalide(`« ${p.nom} » apparaît deux fois sur le bon. Regroupez-le sur une seule ligne.`);
      vus.add(cle);
    }
  }
  return new Map(produits.map((p) => [p.id, p.uniteVente]));
}

async function verifierTiers(tenantId: string, fournisseurIds: string[], entrepotIds: string[]) {
  const [fournisseurs, entrepots] = await Promise.all([
    prisma.fournisseur.findMany({ where: { tenantId, id: { in: fournisseurIds } }, select: { id: true, nom: true } }),
    prisma.entrepot.findMany({ where: { tenantId, id: { in: entrepotIds } }, select: { id: true } }),
  ]);
  if (fournisseurIds.some((id) => !fournisseurs.some((f) => f.id === id))) throw erreurs.introuvable("Ce fournisseur");
  if (entrepotIds.some((id) => !entrepots.some((e) => e.id === id))) throw erreurs.introuvable("Cet entrepôt");
  return new Map(fournisseurs.map((f) => [f.id, f.nom]));
}

/**
 * Crée un ou plusieurs bons EN BROUILLON dans une seule transaction (le
 * réapprovisionnement en prépare un par fournisseur). Rejouer la même clé rend
 * les bons d'origine.
 */
export async function creerBons(ctx: ContextePos, demandes: DemandeBon[], source: "manuel" | "reappro", cle: string | undefined) {
  exigerDroit(ctx, "achat_creer");
  if (!demandes.length) throw erreurs.invalide("Aucun bon de commande à créer.");
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { devise: true } });
  const decimales = decimalesDevise(tenant.devise);
  const entrepotDefaut = demandes.some((d) => !d.entrepotId) ? await entrepotDuMagasin(prisma, ctx.tenantId, ctx.magasinId) : "";
  const [noms, unites] = await Promise.all([
    verifierTiers(ctx.tenantId, [...new Set(demandes.map((d) => d.fournisseurId))], [...new Set(demandes.flatMap((d) => (d.entrepotId ? [d.entrepotId] : [])))]),
    verifierLignes(ctx.tenantId, demandes),
  ]);

  const { resultat, rejoue } = await avecRepriseCollision(() => avecIdempotence(ctx.tenantId, cle ?? "", "achat.creer", async (tx) => {
    const bons: { id: string; numero: string; fournisseur: string; lignes: number; montantTotal: number }[] = [];
    for (const d of demandes) {
      const montantTotal = totalBon(d.lignes.map((l) => ({ ...l, uniteVente: unites.get(l.produitId) })), decimales);
      const bon = await tx.bonCommande.create({
        data: {
          tenantId: ctx.tenantId, numero: numeroBon(), fournisseurId: d.fournisseurId, entrepotId: d.entrepotId ?? entrepotDefaut,
          devise: tenant.devise, montantTotal, dateAttendue: d.dateAttendue ? new Date(d.dateAttendue) : null, source, creePar: ctx.userId, notes: d.notes || null,
          lignes: { create: d.lignes.map((l) => ({ produitId: l.produitId, varianteId: l.varianteId ?? null, quantite: l.quantite, prixUnitaire: l.prixUnitaire })) },
        },
        select: { id: true, numero: true },
      });
      bons.push({ ...bon, fournisseur: noms.get(d.fournisseurId) ?? "", lignes: d.lignes.length, montantTotal });
    }
    for (const b of bons) {
      await journaliserAudit(tx, ctx, { action: "achat.cree", entite: "BonCommande", entiteId: b.id, apres: { numero: b.numero, fournisseur: b.fournisseur, lignes: b.lignes, montantTotal: b.montantTotal, source } });
    }
    return { bons };
  }, { userId: ctx.userId, appareilId: ctx.appareilId }));
  return { ...resultat, rejoue };
}

/** Remplace le contenu d'un bon encore en brouillon (fournisseur, lignes, date, note). */
export async function modifierBon(ctx: ContextePos, id: string, d: DemandeBon) {
  exigerDroit(ctx, "achat_creer");
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { devise: true } });
  const [, unites] = await Promise.all([
    verifierTiers(ctx.tenantId, [d.fournisseurId], d.entrepotId ? [d.entrepotId] : []),
    verifierLignes(ctx.tenantId, [d]),
  ]);
  const montantTotal = totalBon(d.lignes.map((l) => ({ ...l, uniteVente: unites.get(l.produitId) })), decimalesDevise(tenant.devise));
  await prisma.$transaction(async (tx) => {
    const avant = await tx.bonCommande.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { numero: true, statut: true, montantTotal: true, fournisseurId: true, _count: { select: { lignes: true } } } });
    if (!avant) throw erreurs.introuvable("Ce bon de commande");
    // La mise à jour conditionnelle verrouille le bon : un envoi simultané attend, puis l'un des deux échoue.
    const touche = await tx.bonCommande.updateMany({
      where: { id, tenantId: ctx.tenantId, statut: "brouillon" },
      data: { fournisseurId: d.fournisseurId, ...(d.entrepotId ? { entrepotId: d.entrepotId } : {}), montantTotal, dateAttendue: d.dateAttendue ? new Date(d.dateAttendue) : null, notes: d.notes || null },
    });
    if (!touche.count) throw new ErreurPos("transition_refusee", 409, "Ce bon de commande n'est plus un brouillon : il ne peut plus être modifié. Rechargez la page pour voir son état actuel.");
    await tx.ligneBonCommande.deleteMany({ where: { bonCommandeId: id } });
    await tx.ligneBonCommande.createMany({ data: d.lignes.map((l) => ({ bonCommandeId: id, produitId: l.produitId, varianteId: l.varianteId ?? null, quantite: l.quantite, prixUnitaire: l.prixUnitaire })) });
    await journaliserAudit(tx, ctx, {
      action: "achat.modifie", entite: "BonCommande", entiteId: id,
      avant: { fournisseurId: avant.fournisseurId, lignes: avant._count.lignes, montantTotal: avant.montantTotal },
      apres: { numero: avant.numero, fournisseurId: d.fournisseurId, lignes: d.lignes.length, montantTotal },
    });
  });
  return lireBon(ctx.tenantId, id);
}

/** Fait avancer un bon (envoyer, confirmer, solder, annuler) selon ACTIONS_BON. */
export async function changerStatutBon(ctx: ContextePos, id: string, action: ActionBon, motif: string | null | undefined, cle: string | undefined) {
  const regle = ACTIONS_BON[action];
  if (regle.motif && (motif ?? "").trim().length < 3) throw erreurs.invalide("Indiquez le motif en quelques mots : il sera conservé dans le journal.");
  const { resultat, rejoue } = await avecIdempotence(ctx.tenantId, cle ?? "", `achat.${action}`, async (tx) => {
    const bon = await tx.bonCommande.findFirst({ where: { id, tenantId: ctx.tenantId }, select: { numero: true, statut: true, _count: { select: { lignes: true } } } });
    if (!bon) throw erreurs.introuvable("Ce bon de commande");
    // Celui qui prépare les bons peut abandonner un brouillon ; tout le reste demande le droit de valider les achats.
    if (!(action === "annuler" && bon.statut === "brouillon" && aDroit(ctx, "achat_creer"))) exigerDroit(ctx, regle.droit);
    const vers = transitionBon(bon.statut, action);
    if (action === "envoyer" && !bon._count.lignes) throw erreurs.invalide("Ce bon de commande est vide : ajoutez au moins un produit avant de l'envoyer.");
    const touche = await tx.bonCommande.updateMany({ where: { id, tenantId: ctx.tenantId, statut: bon.statut }, data: { statut: vers } });
    if (!touche.count) throw erreurs.conflit("Ce bon de commande vient d'être modifié par quelqu'un d'autre. Rechargez la page.");
    await journaliserAudit(tx, ctx, { action: `achat.${vers}`, entite: "BonCommande", entiteId: id, avant: { statut: bon.statut }, apres: { numero: bon.numero, statut: vers }, motif: motif?.trim() || null });
    return { id, numero: bon.numero, statut: vers };
  }, { userId: ctx.userId, appareilId: ctx.appareilId });
  return { ...resultat, rejoue };
}

// ─── Envoi ───────────────────────────────────────────────────────────────────

/** Texte du bon, prêt à copier ou à envoyer, avec les coordonnées de la boutique. */
export async function texteDuBon(tenantId: string, bon: BonVue): Promise<{ texte: string; boutique: string; emailBoutique: string }> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { nomBoutique: true, telephone: true, email: true } });
  const texte = texteBon({
    numero: bon.numero, boutique: tenant.nomBoutique, telephoneBoutique: tenant.telephone, fournisseur: bon.fournisseur.nom,
    date: bon.createdAt, dateAttendue: bon.dateAttendue, notes: bon.notes, total: bon.montantTotal,
    lieuLivraison: bon.entrepot ? [bon.entrepot.nom, bon.entrepot.adresse, bon.entrepot.ville].filter(Boolean).join(", ") : null,
    lignes: bon.lignes,
  }, (m) => formatMontant(m, bon.devise), decimalesDevise(bon.devise));
  return { texte, boutique: tenant.nomBoutique, emailBoutique: tenant.email };
}

/**
 * Envoie le bon par e-mail au fournisseur (Resend, le service d'e-mails
 * d'AXSO). Rien n'est simulé : sans adresse e-mail du fournisseur ou sans
 * service configuré, la fonction refuse et le bon ne change pas d'état.
 * Un brouillon réellement parti passe à « envoyé ».
 */
export async function envoyerBonParEmail(ctx: ContextePos, id: string, cle: string | undefined) {
  exigerDroit(ctx, "achat_valider");
  const bon = await lireBon(ctx.tenantId, id);
  if (bon.statut === "annule" || bon.statut === "recu") throw new ErreurPos("transition_refusee", 409, "Ce bon de commande est clos : il ne peut plus être envoyé.");
  if (!bon.lignes.length) throw erreurs.invalide("Ce bon de commande est vide : ajoutez au moins un produit avant de l'envoyer.");
  const destinataire = bon.fournisseur.email;
  if (!emailReel(destinataire)) throw new ErreurPos("email_absent", 422, "Ce fournisseur n'a pas d'adresse e-mail. Rien n'a été envoyé : copiez le texte du bon ou envoyez-le par WhatsApp.");
  if (!hasResend()) throw new ErreurPos("integration_en_attente", 501, "L'envoi d'e-mails n'est pas configuré sur ce serveur. Rien n'a été envoyé : copiez le texte du bon ou envoyez-le par WhatsApp.");

  // Même demande rejouée (double appui, réponse perdue) : l'e-mail est déjà parti, on ne le renvoie pas.
  const cleEnvoi = cle ? `${cle}:email` : undefined;
  if (cleEnvoi && (await mutationConnue(ctx.tenantId, cleEnvoi, "achat.email"))) return { envoyeA: destinataire, bon, rejoue: true };

  const { texte, boutique, emailBoutique } = await texteDuBon(ctx.tenantId, bon);
  if (!(await envoyerEmailTexte({ a: destinataire, repondreA: emailBoutique, boutique, sujet: `Bon de commande ${bon.numero}`, texte }))) {
    throw new ErreurPos("envoi_echoue", 502, "L'e-mail n'a pas pu être envoyé. Rien n'est parti : réessayez, ou copiez le texte du bon.");
  }
  // ponytail: la clé est inscrite juste APRÈS l'envoi — un arrêt du serveur entre les deux laisserait repartir un second e-mail au nouvel essai. Passer la clé à Resend (idempotencyKey) si cela arrive.
  if (cleEnvoi) await avecIdempotence(ctx.tenantId, cleEnvoi, "achat.email", async () => ({ envoyeA: destinataire }), { userId: ctx.userId });
  const motif = `Envoyé par e-mail à ${destinataire}`;
  if (bon.statut === "brouillon") await changerStatutBon(ctx, id, "envoyer", motif, cle);
  else await prisma.$transaction((tx) => journaliserAudit(tx, ctx, { action: "achat.email_envoye", entite: "BonCommande", entiteId: id, apres: { numero: bon.numero }, motif }));
  return { envoyeA: destinataire, bon: await lireBon(ctx.tenantId, id), rejoue: false };
}
