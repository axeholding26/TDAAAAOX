// Données RÉELLES : lit la base Axso et la ramène au format commun (types.ts).
// Ce qui n'existe pas encore en base (acquisition, dépenses marketing, tickets,
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
  const [taux, tenants, cmds, produits, subs, usages, convs, stock, marketing] = await Promise.all([
    tauxDuJour(),
    prisma.tenant.findMany({ where: { slug: { not: PLATFORM_TENANT_SLUG } }, select: { id: true, nomBoutique: true, pays: true, planType: true, categorie: true, statut: true, createdAt: true, updatedAt: true } }),
    prisma.commande.findMany({
      where: { tenant: { slug: { not: PLATFORM_TENANT_SLUG } } },
      select: { id: true, tenantId: true, clientId: true, createdAt: true, montantTotal: true, devise: true, statut: true, paiementStatut: true, methodePaiement: true, canal: true, livreeAt: true, expedieeAt: true, echecCount: true, commission: { select: { montantCommission: true, devise: true, statut: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.produit.groupBy({ by: ["tenantId"], _count: { _all: true }, _min: { createdAt: true } }),
    prisma.walletTransaction.findMany({ where: { reference: { startsWith: "SUB-" }, wallet: { tenant: { slug: PLATFORM_TENANT_SLUG } } }, select: { reference: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
    prisma.usageIA.findMany({ select: { tenantId: true, periode: true, type: true, nombre: true, cout: true } }),
    prisma.axiaConversation.findMany({ select: { tenantId: true, updatedAt: true } }),
    prisma.stockMouvement.findMany({ where: { type: { not: "vente" } }, select: { tenantId: true, createdAt: true } }),
    Promise.all([
      prisma.campagne.findMany({ select: { tenantId: true, createdAt: true } }),
      prisma.campagneEmail.findMany({ select: { tenantId: true, createdAt: true } }),
      prisma.campagneSMS.findMany({ select: { tenantId: true, createdAt: true } }),
      prisma.postPlanifie.findMany({ select: { tenantId: true, createdAt: true } }),
    ]).then((l) => l.flat()),
  ]);
  const stockFaible = await prisma.produit.groupBy({ by: ["tenantId"], where: { stock: { lte: 3 }, actif: true } as any, _count: { _all: true } }).catch(() => []);

  const ids = new Set(tenants.map((t) => t.id));
  const commandes: Commande[] = cmds.map((c) => {
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
  for (const s of subs) {
    const ref = s.reference && lireRefAbonnement(s.reference);
    if (ref && ids.has(ref.tenantId)) abonnements.push({ marchandId: ref.tenantId, date: s.createdAt.getTime(), plan: ref.plan as PlanId, montant: PRIX_PLAN[ref.plan as PlanId] });
  }

  const ia: EvtIA[] = [
    ...usages.map((u) => ({ marchandId: u.tenantId, date: new Date(`${u.periode}-15T12:00:00Z`).getTime(), type: TYPE_USAGE[u.type] ?? "agent", nombre: u.nombre, tokens: 0, cout: u.cout })),
    ...convs.map((c) => ({ marchandId: c.tenantId, date: c.updatedAt.getTime(), type: "conversation" as TypeIA, nombre: 1, tokens: 0, cout: 0 })),
  ].filter((e) => ids.has(e.marchandId)).sort((a, b) => a.date - b.date);

  // Usage des fonctionnalités, déduit des traces existantes (pas de suivi d'événements dédié pour l'instant).
  const fonctions: EvtFonction[] = [
    ...commandes.map((c) => ({ marchandId: c.marchandId, date: c.date, fonction: (c.canal === "pos" ? "pos" : "commandes") as EvtFonction["fonction"] })),
    ...commandes.filter((c) => c.livraison !== "sans_objet" && c.livraison !== "non_expediee").map((c) => ({ marchandId: c.marchandId, date: c.date, fonction: "livraison" as const })),
    ...commandes.filter((c) => c.statut === "payee" && c.canal === "en_ligne" && !c.methode.includes("cod")).map((c) => ({ marchandId: c.marchandId, date: c.date, fonction: "paiements" as const })),
    ...ia.map((e) => ({ marchandId: e.marchandId, date: e.date, fonction: "axia" as const })),
    ...stock.map((s) => ({ marchandId: s.tenantId, date: s.createdAt.getTime(), fonction: "stock" as const })),
    ...marketing.map((m) => ({ marchandId: m.tenantId, date: m.createdAt.getTime(), fonction: "marketing" as const })),
    ...tenants.map((t) => ({ marchandId: t.id, date: t.updatedAt.getTime(), fonction: "constructeur" as const })),
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
    source: "inconnu", creeLe: t.createdAt.getTime(), derniereActivite: derniere.get(t.id) ?? t.updatedAt.getTime(), actif: t.statut === "active",
    etapes: { boutique: t.createdAt.getTime(), produit: prodPar.get(t.id)?._min.createdAt?.getTime() ?? null, commande: premiere.get(t.id) ?? null, paiement: premierPaiement.get(t.id) ?? null },
    nbProduits: prodPar.get(t.id)?._count._all ?? 0, produitsStockFaible: faiblePar.get(t.id) ?? 0,
  }));

  return {
    source: "reel", genereA: Date.now(),
    manques: ["acquisition", "marketing", "tickets", "incidents", "experiences", "tokens"],
    marchands, commandes, abonnements, ia, fonctions, visites: [], depenses: [], experiences: [], incidents: [], tickets: [],
  };
}
