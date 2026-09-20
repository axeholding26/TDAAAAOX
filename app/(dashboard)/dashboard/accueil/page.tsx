import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { AffiliationIncitationBanner } from "@/components/dashboard/AffiliationIncitationBanner";
import { AxiaProNotice } from "@/components/dashboard/AxiaProNotice";
import { OrdersTable } from "@/components/dashboard/OrdersTable";
import { BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { AccueilTutorial } from "@/components/dashboard/tutorials/AccueilTutorial";
import { formatMontant } from "@/lib/utils";
import {
  TrendingUp, ShoppingBag, Users, Eye, Package, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Globe, Plus, MapPin, Zap,
  ChevronRight, Truck, Target, Wallet, BarChart3, Sparkles, CheckCircle,
} from "lucide-react";

const STATUT_CFG: Record<string, { label: string; color: string }> = {
  en_attente:     { label: "En attente",     color: "#6B7280" },
  confirmee:      { label: "Confirmée",      color: "#F59E0B" },
  en_preparation: { label: "En préparation", color: "#7C3AED" },
  expediee:       { label: "Expédiée",       color: "#3B82F6" },
  livree:         { label: "Livrée",         color: "#16A34A" },
  annulee:        { label: "Annulée",        color: "#DC2626" },
};

async function getData(tenantId: string) {
  const now              = new Date();
  const startOfDay       = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYest      = new Date(startOfDay.getTime() - 86400000);
  const endOfYest        = new Date(startOfDay.getTime() - 1);
  const startOfWeek      = new Date(now.getTime() - 7 * 86400000);
  const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const last30           = new Date(now.getTime() - 30 * 86400000);

  const [
    today, yesterday, month, prevMonth, pending, visitors,
    recentOrders, lowStock, chartData, tenant, totalClients,
    commandesMois, statutsDist, topVilles, newClients, newClientsPrev,
    weekRevenu, todayOrders, programmeAffiliation,
  ] = await Promise.all([
    prisma.commande.aggregate({ where: { tenantId, paiementStatut: "completed", createdAt: { gte: startOfDay } }, _sum: { montantTotal: true }, _count: true }),
    prisma.commande.aggregate({ where: { tenantId, paiementStatut: "completed", createdAt: { gte: startOfYest, lte: endOfYest } }, _sum: { montantTotal: true }, _count: true }),
    prisma.commande.aggregate({ where: { tenantId, paiementStatut: "completed", createdAt: { gte: startOfMonth } }, _sum: { montantTotal: true }, _count: true }),
    prisma.commande.aggregate({ where: { tenantId, paiementStatut: "completed", createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } }, _sum: { montantTotal: true }, _count: true }),
    prisma.commande.count({ where: { tenantId, statut: "en_attente" } }),
    prisma.analytics.aggregate({ where: { tenantId, type: "page_view", date: { gte: startOfMonth } }, _sum: { valeur: true } }),
    prisma.commande.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 8, include: { lignes: true, client: true } }),
    prisma.produit.findMany({ where: { tenantId, actif: true, stock: { lte: 5, gt: 0 } }, take: 5, orderBy: { stock: "asc" } }),
    prisma.analytics.findMany({ where: { tenantId, type: "purchase", date: { gte: last30 } }, orderBy: { date: "asc" } }),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.client.count({ where: { tenantId } }),
    prisma.commande.findMany({
      where: { tenantId, paiementStatut: "completed", createdAt: { gte: startOfMonth } },
      select: { lignes: { select: { nom: true, prix: true, quantite: true, produitId: true, imageUrl: true } } },
    }),
    prisma.commande.groupBy({ by: ["statut"], where: { tenantId, createdAt: { gte: startOfMonth } }, _count: { id: true } }),
    prisma.commande.groupBy({ by: ["ville"], where: { tenantId, createdAt: { gte: startOfMonth } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 5 }),
    prisma.client.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
    prisma.client.count({ where: { tenantId, createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } } }),
    prisma.commande.aggregate({ where: { tenantId, paiementStatut: "completed", createdAt: { gte: startOfWeek } }, _sum: { montantTotal: true } }),
    prisma.commande.count({ where: { tenantId, createdAt: { gte: startOfDay } } }),
    prisma.programmeAffiliation.findUnique({ where: { tenantId }, select: { actif: true } }),
  ]);

  const prodMap: Record<string, { nom: string; revenue: number; qte: number; img: string | null }> = {};
  (commandesMois as any[]).forEach(cmd => {
    cmd.lignes.forEach((l: any) => {
      if (!prodMap[l.produitId]) prodMap[l.produitId] = { nom: l.nom, revenue: 0, qte: 0, img: l.imageUrl ?? null };
      prodMap[l.produitId].revenue += l.prix * l.quantite;
      prodMap[l.produitId].qte += l.quantite;
    });
  });
  const topProduits = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const chart = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(last30.getTime() + i * 86400000);
    const label = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    const rows = chartData.filter(a => new Date(a.date).toDateString() === d.toDateString());
    return { date: label, montant: rows.reduce((s, a) => s + a.valeur, 0) * 10000, commandes: rows.length };
  });

  const prevCA  = prevMonth._sum.montantTotal || 0;
  const currCA  = month._sum.montantTotal || 0;
  const evol    = prevCA > 0 ? Math.round(((currCA - prevCA) / prevCA) * 100) : null;
  const evolClients = newClientsPrev > 0 ? Math.round(((newClients - newClientsPrev) / newClientsPrev) * 100) : null;
  const spark7  = chart.slice(-7).map(c => c.montant);
  const goalPct = prevCA > 0 ? Math.min(Math.round((currCA / prevCA) * 100), 120) : (currCA > 0 ? 100 : 0);

  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth   = now.getDate();
  const dailyAvgCA   = currCA / Math.max(dayOfMonth, 1);
  const projection   = Math.round(dailyAvgCA * daysInMonth);

  return {
    today:         today._sum.montantTotal || 0,
    todayCount:    today._count,
    todayOrders,
    yesterday:     yesterday._sum.montantTotal || 0,
    yesterdayCount: yesterday._count,
    month:         currCA,
    monthCount:    month._count,
    prevCA,
    evol,
    goalPct,
    projection,
    daysInMonth,
    dayOfMonth,
    pending,
    visitors:      visitors._sum.valeur || 0,
    totalClients,
    newClients,
    evolClients,
    recentOrders,
    lowStock,
    chart,
    spark7,
    topProduits,
    statutsDist:   statutsDist as { statut: string; _count: { id: number } }[],
    topVilles:     topVilles   as { ville: string; _count: { id: number } }[],
    devise:        tenant?.devise || "XOF",
    slug:          tenant?.slug || "",
    semaine:       weekRevenu._sum.montantTotal || 0,
    programmeAffiliationActif: programmeAffiliation?.actif ?? false,
  };
}

/* ── Sparkline SVG lisse ───────────────────────────────────────────────── */
function Spark({ data, color = "#F5A623" }: { data: number[]; color?: string }) {
  if (!data.length || data.every(v => v === 0)) return null;
  const max = Math.max(...data, 1);
  const W = 70, H = 34;
  const pts = data.map((v, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * W,
    y: H - (v / max) * H * 0.82,
  }));
  let pathD = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const cp = (pts[i - 1].x + pts[i].x) / 2;
    pathD += ` C ${cp.toFixed(2)},${pts[i-1].y.toFixed(2)} ${cp.toFixed(2)},${pts[i].y.toFixed(2)} ${pts[i].x.toFixed(2)},${pts[i].y.toFixed(2)}`;
  }
  const areaD = `${pathD} L ${W},${H} L 0,${H} Z`;
  const gId = `spk${color.replace("#", "")}`;
  const last = pts[pts.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="2.8" fill={color} stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

/* ── Progress ring SVG ─────────────────────────────────────────────────── */
function ProgressRing({ pct, size = 68, color = "#F5A623" }: { pct: number; size?: number; color?: string }) {
  const stroke = 5.5, r = (size - stroke * 2) / 2;
  const circ   = 2 * Math.PI * r;
  const offset = circ - Math.min(Math.max(pct, 0), 100) / 100 * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F5F5F7" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/connexion");
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) redirect("/inscription");

  const d = await getData(tenantId);
  const prenom     = session.user?.name?.split(" ")[0] ?? "Marchand";
  const conversion = d.visitors > 0 ? ((d.monthCount / d.visitors) * 100).toFixed(1) : "0";
  const panier     = d.monthCount > 0 ? d.month / d.monthCount : 0;

  const totalCmdsMonth = d.statutsDist.reduce((s, x) => s + x._count.id, 0);
  const maxVille       = d.topVilles[0]?._count.id ?? 1;
  const maxProd        = d.topProduits[0]?.revenue ?? 1;
  const livrees        = d.statutsDist.find(s => s.statut === "livree")?._count.id ?? 0;
  const annulees       = d.statutsDist.find(s => s.statut === "annulee")?._count.id ?? 0;

  const livraisonRate  = totalCmdsMonth > 0 ? Math.round((livrees / totalCmdsMonth) * 100) : 0;
  const topVilleShare  = d.topVilles[0] ? Math.round((d.topVilles[0]._count.id / Math.max(totalCmdsMonth, 1)) * 100) : 0;
  const vsHierPct      = d.yesterday > 0 ? Math.round(((d.today - d.yesterday) / d.yesterday) * 100) : null;
  const remainingDays  = d.daysInMonth - d.dayOfMonth;
  const onTrack        = d.projection >= d.prevCA;

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bonne journée" : "Bonsoir";

  // Insights automatiques
  const insights: { Icon: any; color: string; bg: string; title: string; value: string; sub: string }[] = [];

  if (d.projection > 0) insights.push({
    Icon: Target,
    color: onTrack ? "#16A34A" : "#F5A623",
    bg:    onTrack ? "#ECFDF5" : "#FFF8EC",
    title: "Projection fin de mois",
    value: formatMontant(d.projection, d.devise),
    sub:   onTrack ? `En avance sur l'objectif` : `${remainingDays}j restants pour rattraper`,
  });

  if (livraisonRate > 0) insights.push({
    Icon: Truck,
    color: livraisonRate >= 70 ? "#16A34A" : livraisonRate >= 40 ? "#F59E0B" : "#DC2626",
    bg:    livraisonRate >= 70 ? "#ECFDF5" : livraisonRate >= 40 ? "#FFFBEB" : "#FEF2F2",
    title: "Taux de livraison",
    value: `${livraisonRate}%`,
    sub:   `${livrees} livrée${livrees > 1 ? "s" : ""} sur ${totalCmdsMonth} commande${totalCmdsMonth > 1 ? "s" : ""}`,
  });

  if (d.topVilles.length > 0 && topVilleShare > 0) insights.push({
    Icon: MapPin,
    color: "#7C3AED",
    bg:    "#EEF1F6",
    title: "Ville principale",
    value: d.topVilles[0]!.ville || "Inconnue",
    sub:   `${topVilleShare}% des commandes ce mois`,
  });

  if (panier > 0) insights.push({
    Icon: Wallet,
    color: "#0891B2",
    bg:    "#ECFEFF",
    title: "Panier moyen",
    value: formatMontant(panier, d.devise),
    sub:   `Sur ${d.monthCount} commande${d.monthCount > 1 ? "s" : ""} ce mois`,
  });

  // Etapes de l'entonnoir
  const funnelSteps = [
    { label: "Visiteurs",  value: Math.round(d.visitors), color: "#7C3AED", bg: "#EEF1F6",  Icon: Eye },
    { label: "Commandes",  value: d.monthCount,            color: "#F5A623", bg: "#FFF8EC",  Icon: ShoppingBag },
    { label: "Livrées",    value: livrees,                  color: "#16A34A", bg: "#F0FDF4",  Icon: CheckCircle },
  ];

  return (
    <div className="space-y-5">
      <AccueilTutorial />

      {/* ── Bannière d'accueil ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[28px] px-6 py-8 sm:px-9 sm:py-10">
        <img
          src="/hero-bg.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "center 30%" }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(100deg, rgba(8,8,8,.92) 0%, rgba(8,8,8,.82) 38%, rgba(8,8,8,.55) 70%, rgba(8,8,8,.32) 100%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 90% at 15% 30%, rgba(237,169,0,.16) 0%, transparent 70%)" }} />

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#F5C55E] bg-[#EDA900]/15 border border-[#EDA900]/30 rounded-full px-2.5 py-1 mb-3">
              <Sparkles size={11} /> Axso
            </span>
            <div className="flex items-center gap-2">
              <h1 className="text-[26px] sm:text-[30px] font-extrabold text-white tracking-tight leading-tight">
                {greeting}, {prenom}
              </h1>
              <BoutonRevoirTutoriel moduleKey="accueil" dark />
            </div>
            <p className="text-[13px] text-white/60 mt-1 capitalize">
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {d.slug && (
              <a href={`/${d.slug}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[12px] font-medium border border-white/20 rounded-2xl px-3.5 py-2 bg-white/10 backdrop-blur-sm text-white hover:bg-white/15 hover:border-white/30 transition-all">
                <Globe size={13} /> Boutique <ArrowUpRight size={11} />
              </a>
            )}
            <a href="/dashboard/produits/nouveau"
              className="flex items-center gap-1.5 text-[12px] font-semibold rounded-2xl px-4 py-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm"
              style={{ background: "linear-gradient(135deg,#EDA900,#FFD75E)", color: "#111111" }}>
              <Plus size={13} /> Nouveau produit
            </a>
          </div>
        </div>
      </div>

      <AxiaProNotice />
      {!d.programmeAffiliationActif && <AffiliationIncitationBanner />}

      {/* ── Pulse du jour ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-[#F0F0F0] bg-white flex-wrap">
        <div className="flex items-center gap-1.5 text-[11.5px]">
          <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse flex-shrink-0" />
          <span className="font-semibold text-[#111]">Aujourd'hui :</span>
          <span className="font-bold text-[#F5A623]">{formatMontant(d.today, d.devise)}</span>
        </div>
        {vsHierPct !== null && (
          <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-0.5 ${
            vsHierPct >= 0
              ? "bg-[#ECFDF5] text-[#16A34A] border-[#BBF7D0]"
              : "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
          }`}>
            {vsHierPct >= 0 ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}
            {vsHierPct > 0 ? "+" : ""}{vsHierPct}% vs hier
          </span>
        )}
        <span className="text-[#E8E8E8] hidden sm:inline">·</span>
        <span className="text-[11.5px] text-[#AAAAAA]">{d.todayOrders} commande{d.todayOrders !== 1 ? "s" : ""}</span>
        <span className="text-[#E8E8E8] hidden sm:inline">·</span>
        <span className="text-[11.5px] text-[#AAAAAA]">{d.newClients} nouveau{d.newClients !== 1 ? "x" : ""} client{d.newClients !== 1 ? "s" : ""} ce mois</span>
        {d.pending > 0 && (
          <>
            <span className="text-[#E8E8E8] hidden sm:inline">·</span>
            <a href="/dashboard/commandes?statut=en_attente"
              className="flex items-center gap-1 text-[11.5px] font-semibold text-[#D97706] hover:underline">
              <Zap size={11} /> {d.pending} en attente
            </a>
          </>
        )}
      </div>

      {/* ── KPI Grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="CA ce mois"
          value={formatMontant(d.month, d.devise)}
          sub={d.evol !== null ? `${d.evol > 0 ? "+" : ""}${d.evol}% vs mois dernier` : `${d.monthCount} commandes`}
          trend={d.evol}
          Icon={TrendingUp}
          accent
          spark={d.spark7}
        />
        <KpiCard
          label="Cette semaine"
          value={formatMontant(d.semaine, d.devise)}
          sub={`${d.todayCount} commande${d.todayCount !== 1 ? "s" : ""} aujourd'hui`}
          Icon={ShoppingBag}
          spark={d.spark7.slice(-5)}
          sparkColor="#7C3AED"
        />
        <KpiCard
          label="Clients"
          value={d.totalClients.toLocaleString("fr-FR")}
          sub={d.evolClients !== null
            ? `+${d.newClients} ce mois (${d.evolClients > 0 ? "+" : ""}${d.evolClients}%)`
            : `+${d.newClients} nouveaux ce mois`}
          trend={d.evolClients}
          Icon={Users}
          spark={[d.totalClients - d.newClients*4, d.totalClients - d.newClients*3, d.totalClients - d.newClients*2, d.totalClients - d.newClients, d.totalClients]}
          sparkColor="#0891B2"
        />
        <KpiCard
          label="Conversion"
          value={`${conversion}%`}
          sub={`Panier moy. ${formatMontant(panier, d.devise)}`}
          Icon={Eye}
          spark={d.spark7.map((v, i) => v > 0 ? parseFloat(conversion) + i * 0.1 : 0)}
          sparkColor="#16A34A"
        />
      </div>

      {/* ── Insights automatiques ──────────────────────────────────── */}
      {insights.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {insights.map((ins, i) => (
            <div key={i} className="bg-white rounded-[16px] border border-[#EBEBEB] p-4 flex items-start gap-3 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all cursor-default"
              style={{ borderLeftWidth: "3px", borderLeftColor: ins.color }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: ins.bg }}>
                <ins.Icon size={14} style={{ color: ins.color }} strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#AAAAAA] mb-0.5">{ins.title}</p>
                <p className="text-[15px] font-bold text-[#111111] leading-tight truncate">{ins.value}</p>
                <p className="text-[11px] text-[#AAAAAA] mt-0.5 leading-tight">{ins.sub}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Chart + Sidebar ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SalesChart donnees={d.chart} devise={d.devise} />
        </div>

        <div className="flex flex-col gap-4">

          {/* Objectif mensuel + projection */}
          <div className="ax-card p-5">
            <p className="ax-label mb-3">Objectif mensuel</p>
            <div className="flex items-center gap-4 mb-4">
              <div className="relative flex-shrink-0">
                <ProgressRing pct={d.goalPct} color={d.goalPct >= 100 ? "#16A34A" : "#F5A623"} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[13px] font-bold text-[#111111]">{Math.min(d.goalPct, 100)}%</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[#111111]">
                  {d.goalPct >= 100 ? <span className="flex items-center gap-1"><Sparkles size={13} />Objectif atteint !</span> : "En progression"}
                </p>
                <p className="text-[11.5px] text-[#AAAAAA] mt-0.5">{formatMontant(d.month, d.devise)}</p>
                {d.prevCA > 0 && (
                  <p className="text-[11px] text-[#CCCCCC] mt-0.5">Objectif : {formatMontant(d.prevCA, d.devise)}</p>
                )}
              </div>
            </div>
            {d.projection > 0 && (
              <div className="pt-3 border-t border-[#F5F5F7] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 size={12} className="text-[#CCCCCC]" />
                  <span className="text-[11px] text-[#AAAAAA]">Projection fin de mois</span>
                </div>
                <span className={`text-[12px] font-bold ${onTrack ? "text-[#16A34A]" : "text-[#F5A623]"}`}>
                  {formatMontant(d.projection, d.devise)}
                </span>
              </div>
            )}
          </div>

          {d.pending > 0 && (
            <div className="ax-card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A]/60 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag size={16} className="text-[#D97706]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#111111]">{d.pending} commande{d.pending > 1 ? "s" : ""} en attente</p>
                  <p className="text-[11.5px] text-[#AAAAAA]">À traiter en priorité</p>
                </div>
              </div>
              <a href="/dashboard/commandes?statut=en_attente"
                className="flex-shrink-0 text-[11.5px] font-semibold text-[#111111] border border-[#E8E8E8] rounded-2xl px-3 py-1.5 hover:bg-[#F5F5F5] transition-all whitespace-nowrap">
                Traiter →
              </a>
            </div>
          )}

          {d.lowStock.length > 0 && (
            <div className="ax-card p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-xl bg-[#FEF2F2] border border-[#FECACA]/60 flex items-center justify-center">
                  <AlertTriangle size={13} className="text-[#DC2626]" />
                </div>
                <p className="text-[13px] font-semibold text-[#111111]">Stock critique</p>
                <span className="ml-auto text-[10.5px] font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] px-2 py-0.5 rounded-full">
                  {d.lowStock.length}
                </span>
              </div>
              <div className="space-y-2">
                {d.lowStock.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-[#444] truncate">{p.nom}</span>
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${
                      p.stock <= 2 ? "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]" : "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]"
                    }`}>{p.stock} restant{p.stock > 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
              <a href="/dashboard/produits?stock=critique"
                className="flex items-center gap-1 text-[12px] text-[#666] mt-3 hover:text-[#111] transition-colors group">
                Gérer les stocks <ArrowUpRight size={11} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            </div>
          )}

          <div className="ax-card p-4">
            <p className="ax-label mb-3">Accès rapides</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: "/dashboard/produits/nouveau", label: "Nouveau produit", Icon: Package,     color: "#7C3AED", bg: "#EEF1F6" },
                { href: "/dashboard/commandes",        label: "Commandes",       Icon: ShoppingBag, color: "#D97706", bg: "#FFFBEB" },
                { href: "/dashboard/clients",          label: "Clients",         Icon: Users,       color: "#0891B2", bg: "#ECFEFF" },
                { href: "/dashboard/analytics",        label: "Analytics",       Icon: TrendingUp,  color: "#16A34A", bg: "#ECFDF5" },
              ].map(({ href, label, Icon, color, bg }) => (
                <a key={href} href={href}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-[#EBEBEB] bg-white hover:border-[#CCC] hover:-translate-y-0.5 hover:shadow-md transition-all group">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ background: bg, border: `1px solid ${color}20` }}>
                    <Icon size={14} style={{ color }} strokeWidth={1.8} />
                  </div>
                  <span className="text-[11px] font-semibold text-[#666] group-hover:text-[#111] transition-colors text-center leading-tight">{label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Performance: Top Produits | Statuts | Villes ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 ax-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-[14px] font-bold text-[#111111] tracking-tight">Top produits</h3>
              <p className="text-[11.5px] text-[#AAAAAA] mt-0.5">Par chiffre d'affaires ce mois</p>
            </div>
            <a href="/dashboard/produits"
              className="text-[11.5px] font-semibold text-[#666] hover:text-[#111] transition-colors flex items-center gap-1">
              Voir tout <ArrowUpRight size={11} />
            </a>
          </div>
          {d.topProduits.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] flex items-center justify-center"><Package size={22} className="text-gray-400" /></div>
              <p className="text-[13px] text-[#AAAAAA]">Aucune vente ce mois</p>
            </div>
          ) : (
            <div className="space-y-4">
              {d.topProduits.map((p, i) => {
                const pct = Math.round((p.revenue / maxProd) * 100);
                const rankColors = ["#F5A623", "#7C3AED", "#3B82F6", "#16A34A", "#6B7280"];
                const color = rankColors[i] ?? "#AAAAAA";
                return (
                  <div key={p.nom}>
                    <div className="flex items-center gap-3 mb-2">
                      {p.img ? (
                        <img src={p.img} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0 border border-[#F0F0F0]" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[13px] font-bold"
                          style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
                          {i + 1}
                        </div>
                      )}
                      <span className="text-[13px] font-medium text-[#222] truncate flex-1">{p.nom}</span>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[13px] font-bold text-[#111111]" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatMontant(p.revenue, d.devise)}
                        </p>
                        <p className="text-[10.5px] text-[#AAAAAA]">{p.qte} vente{p.qte > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: i === 0 ? "linear-gradient(90deg,#F5A623,#FFD280)" : color }} />
                      </div>
                      <span className="text-[10.5px] text-[#CCCCCC] w-8 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="ax-card p-5 flex-1">
            <h3 className="text-[13px] font-semibold text-[#111111] mb-1">Statuts ce mois</h3>
            <p className="text-[11.5px] text-[#AAAAAA] mb-4">{totalCmdsMonth} commandes</p>
            {totalCmdsMonth === 0 ? (
              <div className="py-6 text-center text-[12px] text-[#AAAAAA]">Aucune commande</div>
            ) : (
              <>
                <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mb-4">
                  {Object.entries(STATUT_CFG).map(([key, cfg]) => {
                    const n = d.statutsDist.find(s => s.statut === key)?._count.id ?? 0;
                    if (!n) return null;
                    return <div key={key} className="h-full rounded-full flex-shrink-0"
                      style={{ width: `${(n / totalCmdsMonth) * 100}%`, background: cfg.color }} />;
                  })}
                </div>
                <div className="space-y-2.5">
                  {Object.entries(STATUT_CFG).map(([key, cfg]) => {
                    const n = d.statutsDist.find(s => s.statut === key)?._count.id ?? 0;
                    if (!n) return null;
                    const pct = Math.round((n / totalCmdsMonth) * 100);
                    return (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                          <span className="text-[11.5px] text-[#555] truncate">{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10.5px] text-[#CCCCCC]">{pct}%</span>
                          <span className="text-[12px] font-bold text-[#111] w-6 text-right">{n}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {d.topVilles.length > 0 && (
            <div className="ax-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={13} className="text-[#AAAAAA]" />
                <h3 className="text-[13px] font-semibold text-[#111111]">Top villes</h3>
              </div>
              <div className="space-y-3">
                {d.topVilles.map((v, i) => {
                  const pct = Math.round((v._count.id / maxVille) * 100);
                  return (
                    <div key={v.ville}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] font-medium text-[#333] truncate">{v.ville || "Inconnue"}</span>
                        <span className="text-[12px] font-bold text-[#111]" style={{ fontVariantNumeric: "tabular-nums" }}>{v._count.id}</span>
                      </div>
                      <div className="h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: i === 0 ? "#F5A623" : "#D0D0D8" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Entonnoir de conversion ─────────────────────────────────── */}
      {d.visitors > 0 && (
        <div className="ax-card p-5 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-[14px] font-bold text-[#111111] tracking-tight">Entonnoir de conversion</h3>
              <p className="text-[11.5px] text-[#AAAAAA] mt-0.5">Ce mois · de la visite à la livraison</p>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#ECFDF5] text-[#16A34A] border border-[#BBF7D0]">
              {conversion}% global
            </span>
          </div>

          <div className="flex items-stretch gap-2">
            {funnelSteps.map((step, i) => {
              const isLast = i === funnelSteps.length - 1;
              const nextStep = funnelSteps[i + 1];
              const continueRate = nextStep && step.value > 0
                ? Math.round((nextStep.value / step.value) * 100) : null;
              const dropout = nextStep ? step.value - nextStep.value : 0;
              const good = continueRate !== null && continueRate >= 50;

              return (
                <div key={step.label} className="flex items-center gap-2 flex-1">
                  {/* Step */}
                  <div className="flex-1 rounded-2xl border p-4 text-center"
                    style={{ background: step.bg, borderColor: `${step.color}20` }}>
                    <div className="flex justify-center mb-1"><step.Icon size={20} style={{ color: step.color }} /></div>
                    <p className="text-[24px] font-black text-[#111111] leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {step.value.toLocaleString("fr-FR")}
                    </p>
                    <p className="text-[11px] font-semibold mt-1.5" style={{ color: step.color }}>{step.label}</p>
                    {/* fill bar */}
                    <div className="mt-3 h-1 bg-white/60 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: i === 0 ? "100%" : `${continueRate ?? 0}%`,
                        background: step.color,
                        transition: "width 0.6s ease",
                      }} />
                    </div>
                  </div>

                  {/* Connector */}
                  {!isLast && (
                    <div className="flex flex-col items-center gap-1 flex-shrink-0 w-10">
                      <span className={`text-[10px] font-bold leading-none ${good ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                        {continueRate}%
                      </span>
                      <ChevronRight size={16} className="text-[#CCCCCC]" />
                      {dropout > 0 && (
                        <span className="text-[9.5px] text-[#CCCCCC] leading-none">
                          -{dropout.toLocaleString("fr-FR")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom note */}
          {annulees > 0 && (
            <div className="mt-4 pt-3 border-t border-[#F5F5F7] flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#DC2626] flex-shrink-0" />
              <p className="text-[11.5px] text-[#AAAAAA]">
                <span className="font-semibold text-[#DC2626]">{annulees} annulation{annulees > 1 ? "s" : ""}</span> ce mois
                {totalCmdsMonth > 0 && ` · ${Math.round((annulees / totalCmdsMonth) * 100)}% du total`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Commandes récentes ─────────────────────────────────────── */}
      <OrdersTable commandes={d.recentOrders as any} />
    </div>
  );
}

/* ── KPI Card ─────────────────────────────────────────────────────────── */
function KpiCard({
  label, value, sub, trend, Icon, accent, spark, sparkColor = "#F5A623",
}: {
  label: string; value: string; sub: string;
  trend?: number | null; Icon: any; accent?: boolean;
  spark?: number[]; sparkColor?: string;
}) {
  const up = trend !== null && trend !== undefined && trend > 0;
  const dn = trend !== null && trend !== undefined && trend < 0;
  return (
    <div className={`ax-card p-5 relative overflow-hidden group cursor-default ${accent ? "border-[#F5A623]/20" : ""}`}>
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[20px]"
          style={{ background: "linear-gradient(90deg,#F5A623,#FFD280,#F5A623)" }} />
      )}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="ax-label">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110 ${
          accent ? "bg-[#FFF8EC] border border-[#F5A623]/20" : "bg-[#F5F5F7] border border-[#EBEBEB]"
        }`}>
          <Icon size={14} className={accent ? "text-[#F5A623]" : "text-[#888]"} strokeWidth={1.8} />
        </div>
      </div>
      <p className="text-[27px] font-extrabold text-[#111111] leading-none tabular-nums tracking-tight mb-2.5">{value}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          {up && (
            <span className="flex items-center gap-0.5 text-[11px] font-semibold text-[#16A34A] bg-[#ECFDF5] border border-[#BBF7D0] px-2 py-0.5 rounded-full">
              <ArrowUpRight size={10} /> {sub}
            </span>
          )}
          {dn && (
            <span className="flex items-center gap-0.5 text-[11px] font-semibold text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] px-2 py-0.5 rounded-full">
              <ArrowDownRight size={10} /> {sub}
            </span>
          )}
          {!up && !dn && <span className="text-[11.5px] text-[#AAAAAA] leading-tight block">{sub}</span>}
        </div>
        {spark && spark.filter(v => v > 0).length > 1 && (
          <div className="flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
            <Spark data={spark} color={sparkColor} />
          </div>
        )}
      </div>
    </div>
  );
}
