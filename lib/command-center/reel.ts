// Données RÉELLES : lit la base Axso et la ramène au format commun (types.ts).
// Ce qui n'existe pas encore en base (acquisition, dépenses marketing,
// incidents, expériences) est déclaré dans `manques` : les pages l'affichent
// comme « pas encore de données », jamais en inventant.
import "server-only";
import { prisma } from "@/lib/prisma";
import { versXAF } from "@/lib/devise-convert";
import { tauxDuJour } from "@/lib/taux-change";
import { PLATFORM_TENANT_SLUG } from "@/lib/wallet";
import { lireRefAbonnement } from "@/lib/abonnement-paiement";
import type { Dataset, Marchand, Commande, PaiementAbonnement, EvtIA, EvtFonction, PlanId, TypeIA, StatutCommande } from "./types";
import { PRIX_PLAN, PAYS } from "./types";
import { sujetDe } from "@/lib/signalements";

const ISO_PAR_NOM: Record<string, string> = Object.fromEntries(Object.entries(PAYS).map(([iso, nom]) => [nom.toLowerCase(), iso]));
const normPays = (p: string) => (p.length === 2 ? p.toUpperCase() : ISO_PAR_NOM[p.toLowerCase()] ?? (p.toLowerCase() === "ghana" ? "GH" : p));
const normPlan = (p: string): PlanId => (p === "palier1" || p === "palier2" ? p : "palier0");

const TYPE_USAGE: Record<string, TypeIA> = {
  generated_content: "description", generated_image: "image", generated_video: "pub", agent_workflow: "agent",
  automation_run: "agent", supplier_search: "agent", mcp_call: "agent", tool_execution: "agent", ai_call: "conversation",
};

function statut(c: { paiementStatut: string; statut: string }): StatutCommande {
  if (c.paiementStatut === "completed") return "payee";
  if (c.paiementStatut === "refunded") return "remboursee";
  if (c.paiementStatut === "failed") return "echouee";
  if (c.statut === "annulee") return "annulee";
  return "en_attente";
}

export async function chargerReel(): Promise<Dataset> {
  const [taux, tenants, cmds, produits, subs, usages, convs, stock, marketing, builder] = await Promise.all([
    tauxDuJour(),
    // Hors boutique interne de la plateforme et boutiques « systeme » (pas des marchands).
    prisma.tenant.findMany({ where: { slug: { not: PLATFORM_TENANT_SLUG }, statut: { not: "systeme" } }, select: { id: true, nomBoutique: true, pays: true, planType: true, categorie: true, statut: true, createdAt: true } }),
    prisma.commande.findMany({
      where: { tenant: { slug: { not: PLATFORM_TENANT_SLUG } } },
      select: { id: true, tenantId: true, clientId: true, createdAt: true, montantTotal: true, devise: true, statut: true, paiementStatut: true, methodePaiement: true, canal: true, livreeAt: true, expedieeAt: true, echecCount: true, commission: { select: { montantCommission: true, devise: true, statut: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.produit.groupBy({ by: ["tenantId"], _count: { _all: true }, _min: { createdAt: true } }),
    prisma.walletTransaction.findMany({ where: { reference: { startsWith: "SUB-" }, wallet: { tenant: { slug: PLATFORM_TENANT_SLUG } } }, select: { reference: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.usageIA.findMany({ select: { tenantId: true, type: true, nombre: true, cout: true, updatedAt: true } }),
    // Requêtes Axia = messages envoyés par le marchand (pas 1 par conversation).
    prisma.$queryRaw<{ tenantId: string; updatedAt: Date; n: number }[]>`SELECT "tenantId", "updatedAt", (SELECT count(*)::int FROM jsonb_array_elements(CASE WHEN jsonb_typeof(messages) = 'array' THEN messages ELSE '[]'::jsonb END) m WHERE m->>'role' = 'user') AS n FROM "AxiaConversation"`,
    prisma.stockMouvement.findMany({ where: { type: { not: "vente" } }, select: { tenantId: true, createdAt: true } }),
    Promise.all([
      prisma.campagne.findMany({ select: { tenantId: true, createdAt: true } }),
      prisma.campagneEmail.findMany({ select: { tenantId: true, createdAt: true } }),
      prisma.campagneSMS.findMany({ select: { tenantId: true, createdAt: true } }),
      prisma.postPlanifie.findMany({ select: { tenantId: true, createdAt: true } }),
    ]).then((l) => l.flat()),
    // Constructeur : publications / instantanés et brouillons de la vitrine (Tenant.updatedAt bouge aussi sur les actions admin et les tâches système).
    Promise.all([
      prisma.versionBoutique.findMany({ select: { tenantId: true, createdAt: true } }),
      prisma.brouillonBoutique.findMany({ select: { tenantId: true, updatedAt: true } }).then((l) => l.map((b) => ({ tenantId: b.tenantId, createdAt: b.updatedAt }))),
    ]).then((l) => l.flat()),
  ]);
  // Tickets support = signalements des marchands (« Signaler un problème »).
  const signalements = await prisma.signalement.findMany({ select: { id: true, tenantId: true, page: true, createdAt: true, resoluLe: true } });
  const stockFaible = await prisma.produit.groupBy({ by: ["tenantId"], where: { stock: { lte: 3 }, actif: true } as any, _count: { _all: true } }).catch(() => []);

  const ids = new Set(tenants.map((t) => t.id));
  const commandes: Commande[] = cmds.filter((c) => ids.has(c.tenantId)).map((c) => {
    const pos = c.canal === "pos";
    const livraison: Commande["livraison"] = pos ? "sans_objet" : c.livreeAt ? "livree" : c.echecCount > 0 ? "echec" : c.expedieeAt ? "expediee" : "non_expediee";
    return {
      id: c.id, marchandId: c.tenantId, clientId: c.clientId, date: c.createdAt.getTime(),
      montant: versXAF(c.montantTotal, c.devise, taux), statut: statut(c), methode: c.methodePaiement, canal: pos ? "pos" : "en_ligne", livraison,
      delaiLivraisonH: c.livreeAt ? Math.round((c.livreeAt.getTime() - c.createdAt.getTime()) / 3600_000) : null,
      commission: c.commission?.statut === "captured" ? versXAF(c.commission.montantCommission, c.commission.devise, taux) : 0,
    };
  });

  const abonnements: PaiementAbonnement[] = [];
  // Une même référence SUB-… porte la ligne CREDIT et la ligne FRAIS NotchPay : un paiement = une référence.
  const vues = new Set<string>();
  for (const s of subs) {
    if (!s.reference || vues.has(s.reference)) continue;
    vues.add(s.reference);
    const ref = lireRefAbonnement(s.reference);
    if (ref && ids.has(ref.tenantId)) abonnements.push({ marchandId: ref.tenantId, date: s.createdAt.getTime(), plan: ref.plan as PlanId, montant: PRIX_PLAN[ref.plan as PlanId] });
  }

  const ia: EvtIA[] = [
    // Usage agrégé par mois : daté de sa dernière mise à jour (jamais dans le futur, contrairement au 15 du mois).
    ...usages.map((u) => ({ marchandId: u.tenantId, date: u.updatedAt.getTime(), type: TYPE_USAGE[u.type] ?? "agent", nombre: u.nombre, tokens: 0, cout: u.cout })),
    ...convs.filter((c) => c.n > 0).map((c) => ({ marchandId: c.tenantId, date: c.updatedAt.getTime(), type: "conversation" as TypeIA, nombre: c.n, tokens: 0, cout: 0 })),
  ].filter((e) => ids.has(e.marchandId)).sort((a, b) => a.date - b.date);

  // Usage des fonctionnalités, déduit des traces existantes (pas de suivi d'événements dédié pour l'instant).
  const fonctions: EvtFonction[] = [
    ...commandes.map((c) => ({ marchandId: c.marchandId, date: c.date, fonction: (c.canal === "pos" ? "pos" : "commandes") as EvtFonction["fonction"] })),
    ...commandes.filter((c) => c.livraison !== "sans_objet" && c.livraison !== "non_expediee").map((c) => ({ marchandId: c.marchandId, date: c.date, fonction: "livraison" as const })),
    ...commandes.filter((c) => c.statut === "payee" && c.canal === "en_ligne" && !c.methode.includes("cod")).map((c) => ({ marchandId: c.marchandId, date: c.date, fonction: "paiements" as const })),
    ...ia.map((e) => ({ marchandId: e.marchandId, date: e.date, fonction: "axia" as const })),
    ...stock.map((s) => ({ marchandId: s.tenantId, date: s.createdAt.getTime(), fonction: "stock" as const })),
    ...marketing.map((m) => ({ marchandId: m.tenantId, date: m.createdAt.getTime(), fonction: "marketing" as const })),
    ...builder.map((b) => ({ marchandId: b.tenantId, date: b.createdAt.getTime(), fonction: "constructeur" as const })),
  ].filter((e) => ids.has(e.marchandId)).sort((a, b) => a.date - b.date);

  const prodPar = new Map(produits.map((p) => [p.tenantId, p]));
  const faiblePar = new Map((stockFaible as any[]).map((p) => [p.tenantId, p._count._all as number]));
  const premiere = new Map<string, number>(), premierPaiement = new Map<string, number>(), derniere = new Map<string, number>();
  for (const c of commandes) {
    if (!premiere.has(c.marchandId)) premiere.set(c.marchandId, c.date);
    if (c.statut === "payee" && c.canal === "en_ligne" && !c.methode.includes("cod") && !premierPaiement.has(c.marchandId)) premierPaiement.set(c.marchandId, c.date);
  }
  for (const e of [...commandes, ...fonctions]) derniere.set(e.marchandId, Math.max(derniere.get(e.marchandId) ?? 0, e.date));

  const marchands: Marchand[] = tenants.map((t) => ({
    id: t.id, nom: t.nomBoutique, pays: normPays(t.pays), plan: normPlan(t.planType), industrie: t.categorie || "Autre",
    source: "inconnu", creeLe: t.createdAt.getTime(), derniereActivite: derniere.get(t.id) ?? t.createdAt.getTime(), actif: t.statut === "active",
    etapes: { boutique: t.createdAt.getTime(), produit: prodPar.get(t.id)?._min.createdAt?.getTime() ?? null, commande: premiere.get(t.id) ?? null, paiement: premierPaiement.get(t.id) ?? null },
    nbProduits: prodPar.get(t.id)?._count._all ?? 0, produitsStockFaible: faiblePar.get(t.id) ?? 0,
  }));

  return {
    source: "reel", genereA: Date.now(),
    manques: ["acquisition", "marketing", "incidents", "experiences", "tokens"],
    marchands, commandes, abonnements, ia, fonctions, visites: [], depenses: [], experiences: [], incidents: [],
    tickets: signalements.filter((x) => ids.has(x.tenantId)).map((x) => ({ id: x.id, marchandId: x.tenantId, date: x.createdAt.getTime(), resoluLe: x.resoluLe?.getTime() ?? null, sujet: sujetDe(x.page) })),
  };
}
