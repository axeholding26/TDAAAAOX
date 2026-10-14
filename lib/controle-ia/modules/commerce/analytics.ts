// Module « commerce » — analyses et recherche unifiée. Les chiffres viennent des commandes
// réelles : une vente compte quand son paiement est acquis (PAIEMENT.PAYE), comme partout
// dans Axso. Ce qui n'est pas mesuré (coût non saisi, ROAS non remonté, visites non suivies)
// est rendu null et dit, jamais estimé en silence. Le bénéfice net (publicité, livraison,
// commissions, retours) vient de lib/sourcing/profit.ts, le même calcul que l'écran Profit.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAIEMENT } from "@/lib/commandes";
import { produitsDormants, stockActuel } from "@/lib/pos/analytics/ventes";
import { tableauDeBord } from "@/lib/sourcing/profit";
import type { ModuleKey } from "@/lib/permissions";
import type { CtxOutil } from "../../types";
import { LIBELLES_SEGMENT, SEGMENTS, indicateursCampagne, marge, variation, type Segment } from "./analyse";
import { achatsParClient } from "./ventes";
import { JOUR, arrondi, depuisJours, limite, lu, nombre, objet, parmi, peutLire, refuser, texte, textes, type Args, type Outil } from "./commun";

const JOURS = { type: "number", description: "Période en jours jusqu'à aujourd'hui : 30 par défaut, 365 au plus" };
const jours = (a: Args) => nombre(a, "days", { min: 1, max: 365, entier: true }) ?? 30;
const devise = async (tenantId: string) => (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { devise: true } }))?.devise ?? "XAF";

// ─── Ventes ──────────────────────────────────────────────────────────────────
async function synthese(tenantId: string, debut: Date, fin: Date) {
  const [payees, commandes, annulees, visites, canaux] = await Promise.all([
    prisma.commande.aggregate({ where: { tenantId, paiementStatut: PAIEMENT.PAYE, createdAt: { gte: debut, lt: fin } }, _sum: { montantTotal: true }, _count: true }),
    prisma.commande.count({ where: { tenantId, statut: { not: "annulee" }, createdAt: { gte: debut, lt: fin } } }),
    prisma.commande.count({ where: { tenantId, statut: "annulee", createdAt: { gte: debut, lt: fin } } }),
    prisma.analytics.aggregate({ where: { tenantId, type: "page_view", date: { gte: debut, lt: fin } }, _sum: { valeur: true } }),
    prisma.commande.groupBy({ by: ["canal"], where: { tenantId, paiementStatut: PAIEMENT.PAYE, createdAt: { gte: debut, lt: fin } }, _sum: { montantTotal: true }, _count: true }),
  ]);
  const ca = payees._sum.montantTotal ?? 0, vues = visites._sum.valeur ?? 0;
  return {
    revenue: Math.round(ca), paid_orders: payees._count, orders: commandes, cancelled: annulees,
    average_order: payees._count ? Math.round(ca / payees._count) : null,
    visits: vues || null,
    // Visites de la vitrine en ligne seulement : la conversion ne compte que les commandes en ligne.
    conversion_rate: vues ? arrondi(((canaux.find((c) => c.canal === "en_ligne")?._count ?? 0) / vues) * 100) : null,
    by_channel: canaux.map((c) => ({ channel: c.canal, revenue: Math.round(c._sum.montantTotal ?? 0), orders: c._count })),
  };
}

/** Ventes payées par produit sur une période ; coût = coût figé sur la ligne, sinon celui de la fiche (null = inconnu). */
async function ventesParProduit(tenantId: string, debut: Date, fin = new Date()) {
  const lignes = await prisma.$queryRaw<{ id: string; unites: number; ca: number; ca_couvert: number; cout: number }[]>(Prisma.sql`
    SELECT lc."produitId" AS id,
      SUM(GREATEST(lc."quantite" - lc."quantiteRetournee", 0))::float8 AS unites,
      SUM(lc."prix" * lc."quantite" - lc."remise")::float8 AS ca,
      SUM(CASE WHEN COALESCE(lc."cout", p."cout") IS NULL THEN 0 ELSE lc."prix" * lc."quantite" - lc."remise" END)::float8 AS ca_couvert,
      SUM(COALESCE(lc."cout", p."cout", 0) * lc."quantite")::float8 AS cout
    FROM "LigneCommande" lc JOIN "Commande" c ON c."id" = lc."commandeId" JOIN "Produit" p ON p."id" = lc."produitId"
    WHERE c."tenantId" = ${tenantId} AND c."paiementStatut" = ${PAIEMENT.PAYE} AND c."createdAt" >= ${debut} AND c."createdAt" < ${fin}
    GROUP BY 1`);
  return new Map(lignes.map((l) => [l.id, l]));
}

/**
 * Produits actifs qui se vendent mal : au plus `max` unités vendues sur la période, parmi ceux qui existaient
 * déjà au début (un produit d'hier n'a pas eu le temps de se vendre). Les moins vendus d'abord, puis le plus gros stock.
 * ponytail: 2 000 produits actifs examinés au plus ; passer en SQL si un catalogue dépasse.
 */
async function seVendentMal(tenantId: string, n: number, max: number, nb: number) {
  const debut = depuisJours(n);
  const [ventes, produits] = await Promise.all([
    ventesParProduit(tenantId, debut),
    prisma.produit.findMany({ where: { tenantId, actif: true, createdAt: { lt: debut } }, select: { id: true, nom: true, prix: true, stock: true, type: true, vues: true }, take: 2000 }),
  ]);
  const liste = produits.map((p) => ({ product_id: p.id, name: p.nom, price: p.prix, stock: p.type === "physique" ? p.stock : null, views: p.vues, units_sold: ventes.get(p.id)?.unites ?? 0 }))
    .filter((p) => p.units_sold <= max)
    .sort((a, b) => a.units_sold - b.units_sold || (b.stock ?? 0) - (a.stock ?? 0));
  return { total: liste.length, products: liste.slice(0, nb) };
}

async function segments(tenantId: string) {
  const [achats, inscrits] = await Promise.all([achatsParClient(tenantId), prisma.client.count({ where: { tenantId } })]);
  const total = achats.clients.reduce((s, c) => s + c.achats.depense, 0);
  const rows = SEGMENTS.filter((s) => s !== "prospect").map((s) => {
    const du = achats.clients.filter((c) => c.segment === s);
    const depense = du.reduce((t, c) => t + c.achats.depense, 0);
    return { segment: s as Segment, label: LIBELLES_SEGMENT[s], customers: du.length, revenue: Math.round(depense), revenue_share: total ? arrondi((depense / total) * 100) : null, average_spent: du.length ? Math.round(depense / du.length) : null };
  });
  const acheteurs = achats.clients.length;
  return {
    customers: inscrits, buyers: acheteurs, prospects: Math.max(0, inscrits - acheteurs),
    repeat_rate: acheteurs ? arrondi((achats.clients.filter((c) => c.achats.commandes > 1).length / acheteurs) * 100) : null,
    vip_threshold: achats.vip || null, segments: rows, truncated: achats.tronque,
  };
}

async function campagnes(tenantId: string, n: number) {
  const depuis = depuisJours(n);
  const [pubs, emails, sms] = await Promise.all([
    prisma.campagne.findMany({ where: { tenantId, OR: [{ updatedAt: { gte: depuis } }, { statut: "active" }] }, orderBy: { updatedAt: "desc" }, take: 30 }),
    prisma.campagneEmail.findMany({ where: { tenantId, createdAt: { gte: depuis } }, orderBy: { createdAt: "desc" }, take: 20, select: { sujet: true, segment: true, nbEnvoyes: true, statut: true, createdAt: true } }),
    prisma.campagneSMS.findMany({ where: { tenantId, createdAt: { gte: depuis } }, orderBy: { createdAt: "desc" }, take: 20, select: { nom: true, segment: true, nbEnvoyes: true, nbLivres: true, statut: true, createdAt: true } }),
  ]);
  return {
    ads: pubs.map((c) => ({
      campaign_id: c.id, name: c.nom, platform: c.plateforme, status: c.statut, budget: c.budget, spend: c.depense,
      impressions: c.impressions, clicks: c.clics, conversions: c.conversions, ...indicateursCampagne({ depense: c.depense, impressions: c.impressions, clics: c.clics, conversions: c.conversions, roas: c.roas }),
    })),
    emails: emails.map((e) => ({ subject: e.sujet, segment: e.segment, sent: e.nbEnvoyes, status: e.statut, at: e.createdAt.toISOString() })),
    sms: sms.map((s) => ({ name: s.nom, segment: s.segment, sent: s.nbEnvoyes, delivered: s.nbLivres, status: s.statut, at: s.createdAt.toISOString() })),
    // Axso ne relie pas une vente à l'email ou au SMS qui l'a amenée : aucune conversion n'est attribuée.
    attribution: "Les emails et SMS n'ont pas de suivi des ventes : seuls les envois sont connus. ROAS, CPA et conversions ne sont donnés que pour les campagnes publicitaires dont la régie les a remontés.",
  };
}

async function marges(tenantId: string, n: number, nb: number) {
  const ventes = await ventesParProduit(tenantId, depuisJours(n));
  const lignes = [...ventes.values()];
  const total = marge({ ca: lignes.reduce((s, l) => s + l.ca, 0), caCouvert: lignes.reduce((s, l) => s + l.ca_couvert, 0), cout: lignes.reduce((s, l) => s + (l.ca_couvert ? l.cout : 0), 0) });
  const noms = new Map((await prisma.produit.findMany({ where: { tenantId, id: { in: lignes.map((l) => l.id) } }, select: { id: true, nom: true } })).map((p) => [p.id, p.nom]));
  const parProduit = lignes.map((l) => ({ product_id: l.id, name: noms.get(l.id) ?? "?", revenue: Math.round(l.ca), ...marge({ ca: l.ca, caCouvert: l.ca_couvert, cout: l.ca_couvert ? l.cout : 0 }) }));
  const connus = parProduit.filter((p) => p.taux !== null);
  return {
    gross_margin: total.marge, gross_margin_rate: total.taux, cost_coverage: total.couverture,
    lowest_margin: [...connus].sort((a, b) => a.taux! - b.taux!).slice(0, nb),
    highest_margin: [...connus].sort((a, b) => b.marge! - a.marge!).slice(0, nb),
    missing_cost: parProduit.filter((p) => p.taux === null).sort((a, b) => b.revenue - a.revenue).slice(0, nb).map((p) => ({ product_id: p.product_id, name: p.name, revenue: p.revenue })),
  };
}

/** Bénéfice net estimé, ROAS et CAC : seulement quand une dépense publicitaire est connue (sinon null, et dit). */
async function net(tenantId: string, n: number) {
  const t = await tableauDeBord(tenantId, n);
  const pub = t.postes.publicite > 0;
  return {
    estimated_net_profit: Math.round(t.kpi.benefice), costs: Object.fromEntries(Object.entries(t.postes).map(([k, v]) => [k, Math.round(v)])),
    ad_spend: t.postes.publicite || null, roas: pub && t.kpi.roas !== null ? arrondi(t.kpi.roas) : null, cac: pub && t.kpi.cac !== null ? Math.round(t.kpi.cac) : null,
    note: pub ? "Bénéfice, ROAS et CAC estimés : la dépense publicitaire cumulée des campagnes est répartie au prorata des jours." : "Aucune dépense publicitaire enregistrée : ROAS et CAC ne sont pas calculables.",
    lines_without_cost: t.lignesSansCout,
  };
}

// ─── Recherche unifiée ───────────────────────────────────────────────────────
const SOURCES: Record<string, ModuleKey> = {
  products: "produits", orders: "commandes", customers: "clients", suppliers: "produits",
  campaigns: "marketing", media: "marketing", pages: "boutique", automations: "marketing",
};
const FILTRES = ["slow_sellers", "out_of_stock", "low_stock", "unpaid_orders", "inactive_customers"] as const;
const MODULE_FILTRE: Record<(typeof FILTRES)[number], ModuleKey> = { slow_sellers: "produits", out_of_stock: "produits", low_stock: "produits", unpaid_orders: "commandes", inactive_customers: "clients" };
const contient = (q: string) => ({ contains: q, mode: "insensitive" as const });

async function chercher(source: string, q: string, tenantId: string, nb: number): Promise<unknown[]> {
  switch (source) {
    case "products":
      return (await prisma.produit.findMany({ where: { tenantId, OR: [{ nom: contient(q) }, { sku: contient(q) }, { codeBarres: q }, { categorie: contient(q) }, { tags: { has: q.toLowerCase() } }] }, take: nb, orderBy: { ventes: "desc" }, select: { id: true, nom: true, prix: true, stock: true, actif: true } }))
        .map((p) => ({ product_id: p.id, name: p.nom, price: p.prix, stock: p.stock, active: p.actif }));
    case "orders":
      return (await prisma.commande.findMany({ where: { tenantId, OR: [{ numero: contient(q) }, { clientNom: contient(q) }, { clientTelephone: contient(q) }] }, take: nb, orderBy: { createdAt: "desc" }, select: { id: true, numero: true, statut: true, montantTotal: true, clientNom: true, createdAt: true } }))
        .map((c) => ({ order_id: c.id, number: c.numero, status: c.statut, total: c.montantTotal, customer: c.clientNom, at: c.createdAt.toISOString() }));
    case "customers":
      return (await prisma.client.findMany({ where: { tenantId, OR: [{ nom: contient(q) }, { telephone: contient(q) }, { email: contient(q) }] }, take: nb, select: { id: true, nom: true, telephone: true, ville: true } }))
        .map((c) => ({ customer_id: c.id, name: c.nom, phone: c.telephone, city: c.ville }));
    case "suppliers":
      return (await prisma.fournisseur.findMany({ where: { tenantId, OR: [{ nom: contient(q) }, { pays: contient(q) }] }, take: nb, select: { id: true, nom: true, pays: true, actif: true } }))
        .map((f) => ({ supplier_id: f.id, name: f.nom, country: f.pays, active: f.actif }));
    case "campaigns":
      return [
        ...(await prisma.campagne.findMany({ where: { tenantId, nom: contient(q) }, take: nb, select: { id: true, nom: true, plateforme: true, statut: true } })).map((c) => ({ campaign_id: c.id, kind: "ads", name: c.nom, platform: c.plateforme, status: c.statut })),
        ...(await prisma.campagneEmail.findMany({ where: { tenantId, sujet: contient(q) }, take: nb, select: { id: true, sujet: true, nbEnvoyes: true } })).map((c) => ({ campaign_id: c.id, kind: "email", name: c.sujet, sent: c.nbEnvoyes })),
      ].slice(0, nb);
    case "media":
      return (await prisma.mediaIA.findMany({ where: { tenantId, OR: [{ type: q.toLowerCase() }, { fournisseur: contient(q) }, { metadonnees: { path: ["prompt"], string_contains: q } }] }, take: nb, orderBy: { createdAt: "desc" }, select: { id: true, type: true, url: true, createdAt: true } }))
        .map((m) => ({ media_id: m.id, type: m.type, url: m.url, at: m.createdAt.toISOString() }));
    case "automations":
      return (await prisma.automatisationIA.findMany({ where: { tenantId, nom: contient(q) }, take: nb, select: { id: true, nom: true, actif: true, executions: true } }))
        .map((x) => ({ automation_id: x.id, name: x.nom, active: x.actif, runs: x.executions }));
    case "pages": {
      // Les pages vivent dans Tenant.themeConfig : on cherche le texte dans chacune.
      const cfg = ((await prisma.tenant.findUnique({ where: { id: tenantId }, select: { themeConfig: true } }))?.themeConfig ?? {}) as Record<string, any>;
      const bas = q.toLowerCase();
      return Object.entries({ home: cfg.builderTree, about: cfg.aboutPage, contact: cfg.contactPage, product: cfg.productPage })
        .filter(([, v]) => v && JSON.stringify(v).toLowerCase().includes(bas)).map(([page]) => ({ page, hint: "get_pages avec cette page pour le détail" }));
    }
  }
  return [];
}

async function filtrer(filtre: (typeof FILTRES)[number], a: Args, tenantId: string, nb: number) {
  const n = jours(a);
  switch (filtre) {
    case "slow_sellers": return seVendentMal(tenantId, n, nombre(a, "max_units", { entier: true, max: 1000 }) ?? 2, nb);
    case "out_of_stock":
    case "low_stock": {
      const where: Prisma.ProduitWhereInput = filtre === "out_of_stock"
        ? { tenantId, actif: true, type: "physique", stock: { lte: 0 } }
        : { tenantId, actif: true, type: "physique", stock: { gt: 0, lte: prisma.produit.fields.stockMin } };
      const [total, produits] = await Promise.all([prisma.produit.count({ where }), prisma.produit.findMany({ where, take: nb, orderBy: { ventes: "desc" }, select: { id: true, nom: true, stock: true, stockMin: true, ventes: true } })]);
      return { total, products: produits.map((p) => ({ product_id: p.id, name: p.nom, stock: p.stock, reorder_point: p.stockMin, lifetime_sales: p.ventes })) };
    }
    case "unpaid_orders": {
      const where = { tenantId, paiementStatut: PAIEMENT.ATTENTE, statut: { notIn: ["annulee"] }, createdAt: { gte: depuisJours(n) } };
      const [total, commandes] = await Promise.all([prisma.commande.count({ where }), prisma.commande.findMany({ where, take: nb, orderBy: { createdAt: "asc" }, select: { id: true, numero: true, statut: true, montantTotal: true, clientNom: true, createdAt: true } })]);
      return { total, orders: commandes.map((c) => ({ order_id: c.id, number: c.numero, status: c.statut, total: c.montantTotal, customer: c.clientNom, at: c.createdAt.toISOString() })) };
    }
    case "inactive_customers": {
      const achats = await achatsParClient(tenantId);
      const limiteDate = Date.now() - n * JOUR;
      const du = achats.clients.filter((c) => c.achats.derniere && c.achats.derniere.getTime() < limiteDate).sort((x, y) => y.achats.depense - x.achats.depense);
      const fiches = await prisma.client.findMany({ where: { tenantId, id: { in: du.slice(0, nb).map((c) => c.id) } }, select: { id: true, nom: true, telephone: true } });
      return { total: du.length, customers: du.slice(0, nb).flatMap((c) => { const f = fiches.find((x) => x.id === c.id); return f ? [{ customer_id: f.id, name: f.nom, phone: f.telephone, spent: Math.round(c.achats.depense), last_order_at: c.achats.derniere!.toISOString() }] : []; }) };
    }
  }
}

const refusSection = (ctx: CtxOutil, m: ModuleKey) => !peutLire(ctx, m);

export const OUTILS_ANALYTICS: Outil[] = [
  {
    name: "get_sales_summary", module: "finance", niveau: "lecture", capacite: "finances",
    description: "Chiffres de vente d'une période, comparés à la période précédente de même durée : chiffre d'affaires encaissé, commandes, annulations, panier moyen, visites et taux de conversion de la boutique en ligne, répartition boutique en ligne / caisse. Pour le détail de la caisse seule : pos_ventes_jour.",
    parameters: objet({ days: JOURS }),
    sortie: "{ days, currency, current: { revenue, paid_orders, orders, cancelled, average_order, visits, conversion_rate, by_channel[] }, previous, trend: { revenue_pct, orders_pct } }",
    exemple: { days: 30 },
    run: async (a, ctx) => {
      const n = jours(a), fin = new Date(), debut = depuisJours(n), avant = new Date(debut.getTime() - n * JOUR);
      const [actuel, precedent, dev] = await Promise.all([synthese(ctx.tenantId, debut, fin), synthese(ctx.tenantId, avant, debut), devise(ctx.tenantId)]);
      const trend = { revenue_pct: variation(actuel.revenue, precedent.revenue), orders_pct: variation(actuel.orders, precedent.orders) };
      return lu(`Ventes des ${n} derniers jours : ${actuel.revenue} ${dev} encaissés, ${actuel.paid_orders} commande(s) payée(s)${trend.revenue_pct !== null ? ` (${trend.revenue_pct >= 0 ? "+" : ""}${trend.revenue_pct} % vs période précédente)` : ""}.${actuel.visits ? "" : " Visites non suivies sur la période : conversion inconnue."}`,
        { days: n, currency: dev, current: actuel, previous: precedent, trend });
    },
  },
  {
    name: "analyze_product_performance", module: "produits", niveau: "lecture", capacite: "catalogue",
    description: "Produits gagnants et produits qui ne se vendent pas, sur une période : top par chiffre d'affaires et par unités, produits actifs qui se vendent mal (au plus max_units vendus), produits dormants (en stock, aucune vente). Pour une recherche filtrée paginée : axso_search filter=slow_sellers.",
    parameters: objet({ days: JOURS, max_units: { type: "number", description: "Seuil « se vend mal » : unités vendues au plus (2 par défaut)" }, limit: { type: "number", description: "10 par défaut, 30 au plus" } }),
    sortie: "{ days, winners_by_revenue[], winners_by_units[], slow_sellers: { total, products[] }, dormant: { total, products[] } }",
    exemple: { days: 30, max_units: 1 },
    run: async (a, ctx) => {
      const n = jours(a), nb = limite(a, 10, 30);
      const [ventes, lents, dormants] = await Promise.all([
        ventesParProduit(ctx.tenantId, depuisJours(n)),
        seVendentMal(ctx.tenantId, n, nombre(a, "max_units", { entier: true, max: 1000 }) ?? 2, nb),
        produitsDormants(ctx.tenantId, { jours: n, limite: nb, voirCouts: peutLire(ctx, "finance") }),
      ]);
      const lignes = [...ventes.values()];
      const noms = new Map((await prisma.produit.findMany({ where: { tenantId: ctx.tenantId, id: { in: lignes.map((l) => l.id) } }, select: { id: true, nom: true } })).map((p) => [p.id, p.nom]));
      const fiche = (l: (typeof lignes)[number]) => ({ product_id: l.id, name: noms.get(l.id) ?? "?", units: l.unites, revenue: Math.round(l.ca) });
      return lu(`${lignes.length} produit(s) vendu(s) en ${n} jours ; ${lents.total} produit(s) actifs se vendent mal ; ${dormants.total} dormant(s) avec du stock.`, {
        days: n,
        winners_by_revenue: [...lignes].sort((x, y) => y.ca - x.ca).slice(0, nb).map(fiche),
        winners_by_units: [...lignes].sort((x, y) => y.unites - x.unites).slice(0, nb).map(fiche),
        slow_sellers: lents,
        dormant: { total: dormants.total, products: dormants.produits.map((p) => ({ product_id: p.produitId, name: p.nom, stock: p.stock, stock_value: p.valeur, last_sale_at: p.derniereVente })) },
      });
    },
  },
  {
    name: "analyze_customer_segments", module: "clients", niveau: "lecture", capacite: "clients",
    description: "Poids de chaque segment de clients (VIP, fidèles, nouveaux, occasionnels, à risque, perdus), calculé sur les commandes payées : nombre de clients, chiffre d'affaires et part du total, panier moyen ; taux de réachat et clients qui n'ont jamais acheté. Pour la liste des clients d'un segment : segment_customers.",
    parameters: objet(),
    sortie: "{ customers, buyers, prospects, repeat_rate, vip_threshold, segments: [{ segment, customers, revenue, revenue_share, average_spent }] }",
    exemple: {},
    run: async (_a, ctx) => {
      const s = await segments(ctx.tenantId);
      return lu(`${s.buyers} client(s) ont acheté sur ${s.customers} ; taux de réachat ${s.repeat_rate ?? "—"} %.${s.vip_threshold ? "" : " Moins de 10 acheteurs : pas de segment VIP."}`, s);
    },
  },
  {
    name: "analyze_campaign_performance", module: "marketing", niveau: "lecture", capacite: "marketing",
    description: "Résultats des campagnes marketing de la période : publicités (dépense, impressions, clics, conversions, CTR, CPC, CPA, ROAS quand la régie les a remontés), emails et SMS envoyés. Ne calcule jamais un ROAS ou une conversion qui n'a pas été mesuré.",
    parameters: objet({ days: JOURS }),
    sortie: "{ ads: [{ campaign_id, name, platform, status, spend, ctr, cpc, cpa, roas }], emails[], sms[], attribution }",
    exemple: { days: 30 },
    run: async (a, ctx) => {
      const r = await campagnes(ctx.tenantId, jours(a));
      return lu(`${r.ads.length} campagne(s) publicitaire(s), ${r.emails.length} email(s), ${r.sms.length} SMS sur la période.${r.ads.some((c) => c.roas !== null) ? "" : " Aucun ROAS remonté par les régies."}`, r);
    },
  },
  {
    name: "analyze_margin", module: "finance", niveau: "lecture", capacite: "finances",
    description: "Marge sur les ventes payées de la période : marge brute (prix de vente − coût d'achat) et sa couverture (part du chiffre d'affaires dont le coût est connu), produits à plus faible et plus forte marge, produits vendus sans coût saisi ; bénéfice net estimé après livraison, publicité, commissions et retours, avec ROAS et coût d'acquisition s'il y a eu de la publicité. Pour la caisse seule : pos_marge.",
    parameters: objet({ days: JOURS, limit: { type: "number", description: "5 par défaut, 20 au plus" } }),
    sortie: "{ gross_margin, gross_margin_rate, cost_coverage, lowest_margin[], highest_margin[], missing_cost[], net: { estimated_net_profit, costs, roas, cac, note } }",
    exemple: { days: 30 },
    run: async (a, ctx) => {
      const n = jours(a);
      const [m, n2] = await Promise.all([marges(ctx.tenantId, n, limite(a, 5, 20)), net(ctx.tenantId, n)]);
      return lu(m.gross_margin === null ? "Marge brute non calculable : aucun produit vendu n'a de coût d'achat saisi (update_product, cost)." : `Marge brute ${m.gross_margin} (${m.gross_margin_rate} %), calculée sur ${m.cost_coverage} % du chiffre d'affaires. ${n2.note}`, { days: n, ...m, net: n2 });
    },
  },
  {
    name: "generate_business_report", module: "finance", niveau: "lecture", capacite: "finances",
    description: "Rapport d'activité complet sur une période, à présenter au marchand : ventes et tendance, marge et bénéfice estimé, produits gagnants et dormants, état du stock, segments de clients, campagnes. Les sections que cette connexion n'a pas le droit de lire sont omises (et signalées). Ce qui n'est pas mesuré est indiqué, jamais inventé.",
    parameters: objet({ days: JOURS }),
    sortie: "{ days, currency, sales, margin, products, stock, customers, campaigns, unavailable: [sections omises] }",
    exemple: { days: 30 },
    run: async (a, ctx) => {
      const n = jours(a), t = ctx.tenantId, nb = 5;
      const omises: string[] = [];
      const si = <T>(m: ModuleKey, nom: string, f: () => Promise<T>) => (refusSection(ctx, m) ? (omises.push(nom), Promise.resolve(null)) : f());
      const fin = new Date(), debut = depuisJours(n);
      const [dev, ventes, precedent, m, benef, produits, stock, clients, camp] = await Promise.all([
        devise(t), synthese(t, debut, fin), synthese(t, new Date(debut.getTime() - n * JOUR), debut), marges(t, n, nb), net(t, n),
        si("produits", "products", async () => {
          const [ventesP, dormants, lents] = await Promise.all([ventesParProduit(t, debut), produitsDormants(t, { jours: n, limite: nb }), seVendentMal(t, n, 2, nb)]);
          const top = [...ventesP.values()].sort((x, y) => y.ca - x.ca).slice(0, nb);
          const noms = new Map((await prisma.produit.findMany({ where: { tenantId: t, id: { in: top.map((l) => l.id) } }, select: { id: true, nom: true } })).map((p) => [p.id, p.nom]));
          return { winners: top.map((l) => ({ name: noms.get(l.id), units: l.unites, revenue: Math.round(l.ca) })), slow_sellers: lents.total, dormant: { total: dormants.total, top: dormants.produits.map((p) => ({ name: p.nom, stock: p.stock })) } };
        }),
        si("produits", "stock", async () => {
          const [s, rupture, bas] = await Promise.all([
            stockActuel(t), prisma.produit.count({ where: { tenantId: t, actif: true, type: "physique", stock: { lte: 0 } } }),
            prisma.produit.count({ where: { tenantId: t, actif: true, type: "physique", stock: { gt: 0, lte: prisma.produit.fields.stockMin } } }),
          ]);
          return { units: s.unites, value_at_cost: s.valeur || null, out_of_stock: rupture, below_reorder_point: bas };
        }),
        si("clients", "customers", () => segments(t)),
        si("marketing", "campaigns", async () => { const c = await campagnes(t, n); return { ads: c.ads.slice(0, nb), emails_sent: c.emails.reduce((s, e) => s + e.sent, 0), sms_sent: c.sms.reduce((s, x) => s + x.sent, 0), attribution: c.attribution }; }),
      ]);
      const report = {
        days: n, currency: dev,
        sales: { ...ventes, trend: { revenue_pct: variation(ventes.revenue, precedent.revenue), orders_pct: variation(ventes.orders, precedent.orders) } },
        margin: { gross_margin: m.gross_margin, gross_margin_rate: m.gross_margin_rate, cost_coverage: m.cost_coverage, lowest_margin: m.lowest_margin, ...benef },
        products: produits, stock, customers: clients, campaigns: camp, unavailable: omises,
      };
      return lu(`Rapport des ${n} derniers jours (${dev}).${omises.length ? ` Sections non accessibles à cette connexion : ${omises.join(", ")}.` : ""}`, report);
    },
  },
  {
    // Traverse plusieurs modules : déclaré sur produits (lecture), chaque autre source est filtrée ici selon ctx.grille.
    name: "axso_search", module: "produits", niveau: "lecture", capacite: "catalogue",
    description: "Recherche unifiée dans la boutique : une requête, plusieurs sources (products, orders, customers, suppliers, campaigns, media, pages, automations) — seules celles que cette connexion peut lire sont interrogées. Ou un filtre prêt à l'emploi, sans requête : slow_sellers (produits qui se vendent mal depuis `days` jours), out_of_stock, low_stock (sous le seuil de réapprovisionnement), unpaid_orders, inactive_customers (aucun achat depuis `days` jours). Résultats courts et plafonnés : ouvre ensuite l'élément avec get_product, get_order ou get_customer.",
    parameters: objet({
      query: { type: "string", description: "Texte cherché : nom, numéro de commande, téléphone, email, référence…" },
      sources: { type: "array", items: { type: "string", enum: Object.keys(SOURCES) }, description: "Sources à interroger (défaut : toutes celles autorisées)" },
      filter: { type: "string", enum: FILTRES }, days: JOURS,
      max_units: { type: "number", description: "slow_sellers : unités vendues au plus (2 par défaut)" },
      limit: { type: "number", description: "Résultats par source : 5 par défaut, 20 au plus" },
    }),
    sortie: "query : { results: { <source>: [...] }, skipped: [sources non autorisées] } ; filter : { filter, total, products|orders|customers[] }",
    exemple: { filter: "slow_sellers", days: 30 },
    run: async (a, ctx) => {
      const nb = limite(a, 5, 20);
      const q = texte(a, "query", { max: 100 });
      if (a.filter != null && a.filter !== "") {
        const filtre = parmi(a, "filter", FILTRES);
        if (refusSection(ctx, MODULE_FILTRE[filtre])) return refuser("INSUFFICIENT_PERMISSION", `Le filtre ${filtre} lit le module « ${MODULE_FILTRE[filtre]} », non accordé à cette connexion.`);
        const r = await filtrer(filtre, a, ctx.tenantId, nb);
        return lu(`${r.total} résultat(s) pour ${filtre}${["slow_sellers", "unpaid_orders", "inactive_customers"].includes(filtre) ? ` (${jours(a)} jours)` : ""}.`, { filter: filtre, ...r });
      }
      if (!q || q.length < 2) return refuser("INVALID_INPUT", "Donne « query » (2 caractères au moins) ou « filter ».");
      const demandees = textes(a, "sources", 8, 20) ?? Object.keys(SOURCES);
      const inconnues = demandees.filter((s) => !SOURCES[s]);
      if (inconnues.length) return refuser("INVALID_INPUT", `Sources inconnues : ${inconnues.join(", ")}.`);
      const permises = demandees.filter((s) => peutLire(ctx, SOURCES[s]));
      const resultats = Object.fromEntries(await Promise.all(permises.map(async (s) => [s, await chercher(s, q, ctx.tenantId, nb)] as const)));
      const trouves = Object.values(resultats).reduce((n, l) => n + l.length, 0);
      const ignorees = demandees.filter((s) => !permises.includes(s));
      return lu(`${trouves} résultat(s) pour « ${q} »${ignorees.length ? ` (non interrogé, droit non accordé : ${ignorees.join(", ")})` : ""}.`, { query: q, results: resultats, skipped: ignorees });
    },
  },
];
