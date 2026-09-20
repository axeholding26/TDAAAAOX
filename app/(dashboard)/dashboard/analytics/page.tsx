import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatMontant } from "@/lib/utils";
import { SalesChart } from "@/components/dashboard/SalesChart";
import {
  BarChart3,
  Eye,
  ShoppingCart,
  TrendingUp,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Calendar,
  Package,
} from "lucide-react";
import { AgentActiveIndicator } from "@/components/dashboard/AgentActiveIndicator";
import { UpgradeGate } from "@/components/dashboard/UpgradeGate";
import { LiveRefreshBadge } from "@/components/dashboard/LiveRefreshBadge";
import { planActif } from "@/lib/abonnement";
import { aAcces } from "@/lib/plans";
import { BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { AnalyticsTutorial } from "@/components/dashboard/tutorials/AnalyticsTutorial";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session) redirect("/connexion");

  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) redirect("/dashboard");

  const { plan } = await planActif(tenantId);
  const avance = aAcces(plan, "analytics_avance");
  const tempsReel = aAcces(plan, "analytics_temps_reel");

  const now = new Date();
  // Palier 0 : résumé 7 jours uniquement. Palier 1+ : historique complet 30j.
  const fenetre = avance ? 30 : 7;
  const il30Jours = new Date(now.getTime() - fenetre * 24 * 60 * 60 * 1000);
  const il60Jours = new Date(now.getTime() - fenetre * 2 * 24 * 60 * 60 * 1000);

  const [
    commandesPeriode,
    commandesPrecedente,
    analyticsParType,
    analyticsParTypePrecedent,
    topProduits,
    statutDistribution,
    derniersAvis,
    tenant,
    commandesParJour,
  ] = await Promise.all([
    prisma.commande.aggregate({
      where: { tenantId, createdAt: { gte: il30Jours }, paiementStatut: "completed" },
      _sum: { montantTotal: true },
      _count: true,
    }),
    prisma.commande.aggregate({
      where: { tenantId, createdAt: { gte: il60Jours, lt: il30Jours }, paiementStatut: "completed" },
      _sum: { montantTotal: true },
      _count: true,
    }),
    prisma.analytics.groupBy({
      by: ["type"],
      where: { tenantId, date: { gte: il30Jours } },
      _sum: { valeur: true },
    }),
    prisma.analytics.groupBy({
      by: ["type"],
      where: { tenantId, date: { gte: il60Jours, lt: il30Jours } },
      _sum: { valeur: true },
    }),
    prisma.produit.findMany({
      where: { tenantId, actif: true },
      orderBy: { ventes: "desc" },
      take: 8,
    }),
    prisma.commande.groupBy({
      by: ["statut"],
      where: { tenantId },
      _count: true,
    }),
    prisma.avis.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { produit: { select: { nom: true, images: true } } },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.commande.findMany({
      where: { tenantId, createdAt: { gte: il30Jours }, paiementStatut: "completed" },
      select: { createdAt: true, montantTotal: true },
    }),
  ]);

  // Graphique jour par jour
  const donneesMap: Record<string, { montant: number; commandes: number }> = {};
  for (let i = 0; i < fenetre; i++) {
    const d = new Date(il30Jours.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    donneesMap[key] = { montant: 0, commandes: 0 };
  }
  for (const c of commandesParJour) {
    const key = new Date(c.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    if (donneesMap[key]) {
      donneesMap[key].montant += c.montantTotal;
      donneesMap[key].commandes += 1;
    }
  }
  const donnees30Jours = Object.entries(donneesMap).map(([date, v]) => ({ date, ...v }));

  const getVal = (arr: typeof analyticsParType, type: string) =>
    arr.find((a) => a.type === type)?._sum.valeur || 0;

  const pageViews      = getVal(analyticsParType, "page_view");
  const productViews   = getVal(analyticsParType, "product_view");
  const addToCart      = getVal(analyticsParType, "add_to_cart");
  const pageViewsPrev  = getVal(analyticsParTypePrecedent, "page_view");
  const productViewsPrev = getVal(analyticsParTypePrecedent, "product_view");
  const addToCartPrev  = getVal(analyticsParTypePrecedent, "add_to_cart");

  const revenuActuel       = commandesPeriode._sum.montantTotal || 0;
  const revenuPrecedent    = commandesPrecedente._sum.montantTotal || 0;
  const commandesActuel    = commandesPeriode._count;
  const commandesPrecedentCount = commandesPrecedente._count;

  const delta = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const tauxConversion = pageViews > 0 ? ((commandesActuel / pageViews) * 100).toFixed(1) : "0";

  const statutStyles: Record<string, { label: string; badgeClass: string }> = {
    en_attente:     { label: "En attente",     badgeClass: "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]" },
    confirmee:      { label: "Confirmée",      badgeClass: "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]" },
    en_preparation: { label: "En préparation", badgeClass: "bg-[#EEF1F6] text-[#7C3AED] border border-[#DDD6FE]" },
    en_livraison:   { label: "En livraison",   badgeClass: "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]" },
    livree:         { label: "Livrée",         badgeClass: "bg-[#ECFDF5] text-[#16A34A] border border-[#BBF7D0]" },
    annulee:        { label: "Annulée",        badgeClass: "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]" },
  };

  const totalCommandes = statutDistribution.reduce((s, x) => s + x._count, 0);

  const kpis = [
    {
      label: "Chiffre d'affaires",
      valeur: formatMontant(revenuActuel, tenant?.devise || "XOF"),
      delta: delta(revenuActuel, revenuPrecedent),
      accent: "#16A34A",
      icone: TrendingUp,
    },
    {
      label: "Commandes",
      valeur: commandesActuel.toString(),
      delta: delta(commandesActuel, commandesPrecedentCount),
      accent: "#2563EB",
      icone: ShoppingCart,
    },
    {
      label: "Visiteurs",
      valeur: Math.round(pageViews).toLocaleString("fr-FR"),
      delta: delta(pageViews, pageViewsPrev),
      accent: "#F5A623",
      icone: Eye,
    },
    {
      label: "Conversion",
      valeur: `${tauxConversion}%`,
      delta: null as number | null,
      accent: "#7C3AED",
      icone: BarChart3,
    },
  ];

  return (
    <div className="space-y-6">
      <AnalyticsTutorial />
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#111111] font-poppins inline-flex items-center gap-2">Analytics <AgentActiveIndicator label="Agent Analytics actif" /> <BoutonRevoirTutoriel moduleKey="analytics" /></h1>
          <p className="text-[#717171] text-sm mt-1">Activité réelle de votre boutique</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-[#E8E8E8] rounded-xl px-4 py-2">
            <Calendar size={14} className="text-[#717171]" />
            <span className="text-[#111111] text-sm font-medium">{fenetre} derniers jours</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
              vs J-{fenetre}
            </span>
          </div>
          {tempsReel && <LiveRefreshBadge intervalMs={30000} />}
        </div>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => {
          const Icon = k.icone;
          const d = k.delta;
          return (
            <div key={i} className="bg-white border border-[#E8E8E8] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#F4F4F4]">
                  <Icon size={16} style={{ color: k.accent }} />
                </div>
                {d !== null && (
                  <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${
                    d > 0 ? "bg-[#ECFDF5] text-[#16A34A] border border-[#BBF7D0]"
                    : d < 0 ? "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]"
                    : "bg-[#F4F4F4] text-[#717171] border border-[#E8E8E8]"
                  }`}>
                    {d > 0 ? <ArrowUpRight size={12} /> : d < 0 ? <ArrowDownRight size={12} /> : <Minus size={12} />}
                    {Math.abs(d)}%
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold text-[#111111] font-poppins leading-tight">{k.valeur}</p>
              <p className="text-[#717171] text-xs mt-1">{k.label}</p>
              {d !== null && (
                <p className="text-[#717171] text-[10px] mt-2 border-t border-[#F3F3F3] pt-2">vs. {fenetre} jours précédents</p>
              )}
            </div>
          );
        })}
      </div>

      {avance ? (
      <>
      {/* Graphique des ventes */}
      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-[#111111] mb-1">Évolution du chiffre d'affaires</h2>
        <p className="text-[#717171] text-xs mb-5">Revenus journaliers des {fenetre} derniers jours (commandes complétées)</p>
        <SalesChart donnees={donnees30Jours} devise={tenant?.devise || "XOF"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top produits */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F4F4F4]">
              <TrendingUp size={15} className="text-[#F5A623]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#111111]">Top produits</h3>
              <p className="text-[#717171] text-xs">Classés par nombre de ventes</p>
            </div>
          </div>
          {topProduits.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F4F4F4] border border-[#E8E8E8] flex items-center justify-center">
                <Package size={20} className="text-[#717171]" />
              </div>
              <p className="text-[#717171] text-sm">Aucune vente pour le moment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topProduits.map((p, i) => {
                const maxVentes = topProduits[0].ventes || 1;
                const pct = Math.round((p.ventes / maxVentes) * 100);
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                      style={
                        i === 0 ? { backgroundColor: "#FFFBEB", color: "#D97706" }
                        : i === 1 ? { backgroundColor: "#F4F4F4", color: "#717171" }
                        : i === 2 ? { backgroundColor: "#FEF2F2", color: "#DC2626" }
                        : { backgroundColor: "#F4F4F4", color: "#717171" }
                      }
                    >
                      {i + 1}
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-[#F4F4F4] overflow-hidden flex-shrink-0 border border-[#E8E8E8]">
                      {p.images[0] ? (
                        <img src={p.images[0]} alt={p.nom} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package size={14} className="text-[#717171]" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#111111] text-sm font-medium truncate">{p.nom}</p>
                      <div className="w-full bg-[#F4F4F4] rounded-full h-1.5 mt-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: "#F5A623" }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[#111111] text-sm font-bold font-poppins">{p.ventes}</p>
                      <p className="text-[#717171] text-[10px]">ventes</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Distribution statuts */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F4F4F4]">
              <BarChart3 size={15} className="text-[#2563EB]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#111111]">Statuts des commandes</h3>
              <p className="text-[#717171] text-xs">{totalCommandes} commandes au total</p>
            </div>
          </div>
          {totalCommandes === 0 ? (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F4F4F4] border border-[#E8E8E8] flex items-center justify-center">
                <BarChart3 size={20} className="text-[#717171]" />
              </div>
              <p className="text-[#717171] text-sm">Aucune commande pour le moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              {statutDistribution
                .sort((a, b) => b._count - a._count)
                .map((s) => {
                  const info = statutStyles[s.statut] ?? { label: s.statut, badgeClass: "bg-[#F4F4F4] text-[#717171] border border-[#E8E8E8]" };
                  const pct = Math.round((s._count / totalCommandes) * 100);
                  const barColor = s.statut === "livree" ? "#16A34A"
                    : s.statut === "annulee" ? "#DC2626"
                    : s.statut === "en_attente" ? "#D97706"
                    : s.statut === "confirmee" ? "#2563EB"
                    : "#717171";
                  return (
                    <div key={s.statut}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${info.badgeClass}`}>
                          {info.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#111111] text-sm font-bold font-poppins">{s._count}</span>
                          <span className="text-[#717171] text-xs">({pct}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-[#F4F4F4] rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Entonnoir de conversion */}
      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#111111]">Entonnoir de conversion</h3>
            <p className="text-[#717171] text-xs mt-0.5">30 derniers jours</p>
          </div>
          <div className="flex items-center gap-2 bg-[#F4F4F4] border border-[#E8E8E8] rounded-xl px-4 py-2">
            <span className="text-[#717171] text-sm">Taux global</span>
            <span className="font-bold text-[#111111] font-poppins text-lg">{tauxConversion}%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Visites",       val: Math.round(pageViews),    color: "#F5A623" },
            { label: "Vues produits", val: Math.round(productViews), color: "#7C3AED" },
            { label: "Ajouts panier", val: Math.round(addToCart),    color: "#2563EB" },
            { label: "Achats",        val: commandesActuel,          color: "#16A34A" },
          ].map((step, i) => {
            const heightPct = pageViews > 0 ? Math.max(8, (step.val / Math.max(pageViews, 1)) * 100) : 8;
            const ratio = i > 0 && pageViews > 0 ? ((step.val / pageViews) * 100).toFixed(1) : null;
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-xl flex items-end justify-center overflow-hidden border border-[#E8E8E8]"
                  style={{ height: "72px", backgroundColor: "#F4F4F4" }}
                >
                  <div
                    className="w-full rounded-b-xl"
                    style={{ height: `${heightPct}%`, backgroundColor: step.color, opacity: 0.4 }}
                  />
                </div>
                <p className="text-[#111111] font-bold font-poppins text-lg leading-tight">
                  {step.val.toLocaleString("fr-FR")}
                </p>
                <p className="text-[#717171] text-xs text-center">{step.label}</p>
                {ratio !== null && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F4F4F4] text-[#717171] border border-[#E8E8E8]">
                    {ratio}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Derniers avis */}
      {derniersAvis.length > 0 && (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#F4F4F4]">
              <Star size={15} className="text-[#F5A623]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#111111]">Derniers avis clients</h3>
              <p className="text-[#717171] text-xs">Les 5 plus récents</p>
            </div>
          </div>
          <div className="space-y-2">
            {derniersAvis.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-[#F4F4F4] border border-[#E8E8E8]">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#E8E8E8] overflow-hidden flex-shrink-0">
                  {a.produit.images[0] ? (
                    <img src={a.produit.images[0]} alt={a.produit.nom} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={12} className="text-[#717171]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#717171] text-xs truncate mb-1">{a.produit.nom}</p>
                  <div className="flex items-center gap-0.5 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={11}
                        className={i < a.note ? "text-[#F5A623] fill-[#F5A623]" : "text-[#E8E8E8] fill-[#E8E8E8]"}
                      />
                    ))}
                  </div>
                  {a.commentaire && (
                    <p className="text-[#717171] text-xs line-clamp-2">{a.commentaire}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      ) : (
        <UpgradeGate
          titre="Analytics avancés — Palier 1"
          description="Historique complet, entonnoir de conversion, top produits et avis clients sont réservés aux paliers Pro et Illimité. Le Palier 0 affiche un résumé 7 jours."
          palierRequis="palier1"
        />
      )}
    </div>
  );
}
