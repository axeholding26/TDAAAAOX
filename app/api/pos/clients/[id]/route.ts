// Fiche d'un client à la caisse.
// GET   /api/pos/clients/[id] — droits : vendre, gerer_clients, gerer_credit ou gerer_fidelite.
//   Réponse : { client: ResumeClient & { valeurPoints, pointsAcquis }, achats, echeances, enRetard, avoirs, fidelite, creditActif }.
// PATCH /api/pos/clients/[id] — corps partiel :
//   { nom?, telephone?, email?, segment? (null = automatique) }        droit gerer_clients
//   { creditPlafond?, creditBloque?, creditEcheanceJours? (null = délai de la boutique) }  droit gerer_credit
//   Réponse : { ok, client }. Tracé dans le journal d'audit.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { exigerDroit, exigerUnDroit } from "@/lib/pos/droits";
import { ErreurPos, erreurs } from "@/lib/pos/erreurs";
import { journaliserAudit } from "@/lib/pos/audit";
import { lireReglagesPos } from "@/lib/pos/flags";
import { echeancesCredit } from "@/lib/pos/credit";
import { pointsAcquis } from "@/lib/pos/fidelite";
import { decimalesDevise, arrondir } from "@/lib/pos/tarification";
import { SEGMENTS, derniersAchats } from "@/lib/pos/promotions/segments";
import { SELECTION_CLIENT, nouveauCodeClient, resumeClient } from "../_clients";

type Params = { id: string };

export const GET = routePos<Params>(async (ctx, _req, { id }) => {
  exigerUnDroit(ctx, "vendre", "gerer_clients", "gerer_credit", "gerer_fidelite");
  const client = await prisma.client.findFirst({ where: { id, tenantId: ctx.tenantId }, select: SELECTION_CLIENT });
  if (!client) throw erreurs.introuvable("Ce client");

  const [achats, dernier, echeances, avoirs, acquis, { reglages }, tenant] = await Promise.all([
    prisma.commande.findMany({
      where: { tenantId: ctx.tenantId, clientId: id }, orderBy: { createdAt: "desc" }, take: 10,
      select: { id: true, numero: true, createdAt: true, montantTotal: true, montantPaye: true, statut: true, canal: true, _count: { select: { lignes: true } } },
    }),
    derniersAchats(prisma, ctx.tenantId, [id]),
    echeancesCredit(prisma, ctx.tenantId, [id]),
    prisma.avoirClient.findMany({
      where: { tenantId: ctx.tenantId, clientId: id, statut: "actif", solde: { gt: 0 }, OR: [{ expireAt: null }, { expireAt: { gt: new Date() } }] },
      select: { id: true, code: true, solde: true, expireAt: true }, orderBy: { createdAt: "desc" }, take: 10,
    }),
    pointsAcquis(prisma, ctx.tenantId, id),
    lireReglagesPos(ctx.tenantId),
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { devise: true } }),
  ]);
  const numeros = new Map((await prisma.commande.findMany({ where: { tenantId: ctx.tenantId, id: { in: echeances.map((e) => e.commandeId) } }, select: { id: true, numero: true } })).map((c) => [c.id, c.numero]));
  const f = reglages.fidelite;
  return {
    client: {
      ...resumeClient(client, dernier.get(id) ?? null),
      pointsAcquis: acquis,
      /** Ce que valent ses points s'il les utilise (0 si le point n'a pas de valeur). */
      valeurPoints: f.active ? arrondir(client.pointsFidelite * f.valeurPoint, decimalesDevise(tenant.devise)) : 0,
    },
    achats: achats.map((a) => ({ id: a.id, numero: a.numero, date: a.createdAt.toISOString(), total: a.montantTotal, paye: a.montantPaye, statut: a.statut, canal: a.canal, lignes: a._count.lignes })),
    echeances: echeances.map((e) => ({ commandeId: e.commandeId, numero: numeros.get(e.commandeId) ?? null, reste: e.reste, echeance: e.echeanceAt?.toISOString() ?? null, enRetard: e.enRetard, joursRetard: e.joursRetard })),
    enRetard: echeances.filter((e) => e.enRetard).reduce((s, e) => s + e.reste, 0),
    avoirs: avoirs.map((a) => ({ id: a.id, code: a.code, solde: a.solde, expire: a.expireAt?.toISOString() ?? null })),
    fidelite: { active: f.active, valeurPoint: f.valeurPoint, seuils: f.seuils },
    creditActif: reglages.credit.actif,
  };
});

const schemaModif = z.object({
  nom: z.string().trim().min(2).max(80),
  telephone: z.string().trim().min(6).max(30).regex(/^[+\d][\d\s().-]*$/, "Indiquez un numéro de téléphone valide."),
  email: z.string().trim().toLowerCase().email().max(120).nullable(),
  segment: z.enum(SEGMENTS).nullable(),
  creditPlafond: z.number().finite().min(0).max(1e12),
  creditBloque: z.boolean(),
  creditEcheanceJours: z.number().int().min(1).max(365).nullable(),
}).partial().refine((d) => Object.keys(d).length > 0, "Aucune modification envoyée.");

const CHAMPS_CREDIT = ["creditPlafond", "creditBloque", "creditEcheanceJours"] as const;

export const PATCH = routePos<Params>(async (ctx, req, { id }) => {
  const d = schemaModif.parse(await req.json());
  const touche = (champs: readonly string[]) => champs.some((c) => c in d);
  if (touche(["nom", "telephone", "email", "segment"])) exigerDroit(ctx, "gerer_clients");
  if (touche(CHAMPS_CREDIT)) exigerDroit(ctx, "gerer_credit");

  const client = await prisma.$transaction(async (tx) => {
    const avant = await tx.client.findFirst({ where: { id, tenantId: ctx.tenantId }, select: SELECTION_CLIENT });
    if (!avant) throw erreurs.introuvable("Ce client");
    const doublon = (d.telephone && d.telephone !== avant.telephone) || (d.email && d.email !== avant.email)
      ? await tx.client.findFirst({
          where: { tenantId: ctx.tenantId, id: { not: id }, OR: [...(d.telephone ? [{ telephone: d.telephone }] : []), ...(d.email ? [{ email: d.email }] : [])] },
          select: { nom: true },
        })
      : null;
    if (doublon) throw new ErreurPos("client_existant", 409, `Ce numéro ou cet e-mail est déjà celui de ${doublon.nom}.`);
    // Un client venu de la vitrine n'a pas encore de code : il le reçoit à la première modification.
    const codeClient = avant.codeClient ?? (await nouveauCodeClient(tx, ctx.tenantId));
    await tx.client.updateMany({ where: { id, tenantId: ctx.tenantId }, data: { ...d, codeClient } });
    const apres = await tx.client.findUniqueOrThrow({ where: { id }, select: SELECTION_CLIENT });

    const extrait = (c: typeof avant, champs: readonly string[]) => Object.fromEntries(champs.filter((k) => k in d).map((k) => [k, (c as Record<string, unknown>)[k]]));
    if (touche(["nom", "telephone", "email", "segment"])) {
      const champs = ["nom", "telephone", "email", "segment"];
      await journaliserAudit(tx, ctx, { action: "client.modifie", entite: "Client", entiteId: id, avant: extrait(avant, champs), apres: extrait(apres, champs) });
    }
    if (touche(CHAMPS_CREDIT)) {
      await journaliserAudit(tx, ctx, { action: "credit.regles_client_modifiees", entite: "Client", entiteId: id, avant: extrait(avant, CHAMPS_CREDIT), apres: extrait(apres, CHAMPS_CREDIT) });
    }
    return apres;
  });
  const dernier = await derniersAchats(prisma, ctx.tenantId, [id]);
  return { ok: true, client: resumeClient(client, dernier.get(id) ?? null) };
});
