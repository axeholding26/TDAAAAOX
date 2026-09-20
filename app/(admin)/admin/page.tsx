import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Store, DollarSign, ShoppingCart, Users, Truck, ArrowUpRight, CheckCircle, Clock } from "lucide-react";
import { formatMontant } from "@/lib/utils";
import { getAdminSession } from "@/lib/admin-auth";
import { PLATFORM_TENANT_SLUG } from "@/lib/wallet";

export default async function AdminDashboard() {
  const session = await getAdminSession();
  if (!session) redirect("/dashboard");

  const now = new Date();
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

  const filtreBoutiques = { slug: { not: PLATFORM_TENANT_SLUG } };

  const [
    totalBoutiques,
    boutiquesActives,
    totalCommandes,
    commandesMois,
    commissionsTotal,
    commissionsMois,
    totalClients,
    totalLivreurs,
    dernieresBoutiques,
    dernieresCommandes,
    commissionsPending,
  ] = await Promise.all([
    prisma.tenant.count({ where: filtreBoutiques }),
    prisma.tenant.count({ where: { statut: "active", ...filtreBoutiques } }),
    prisma.commande.count({ where: { paiementStatut: "completed" } }),
    prisma.commande.count({ where: { paiementStatut: "completed", createdAt: { gte: debutMois } } }),
    prisma.commission.aggregate({ _sum: { montantCommission: true }, where: { statut: "captured" } }),
    prisma.commission.aggregate({ _sum: { montantCommission: true }, where: { statut: "captured", createdAt: { gte: debutMois } } }),
    prisma.client.count(),
    prisma.livreur.count({ where: { actif: true } }),
    prisma.tenant.findMany({ where: filtreBoutiques, orderBy: { createdAt: "desc" }, take: 5, include: { _count: { select: { commandes: true, produits: true } } } }),
    prisma.commande.findMany({
      where: { paiementStatut: "completed" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { tenant: { select: { nomBoutique: true, slug: true } }, commission: { select: { montantCommission: true } } },
    }),
    prisma.commission.aggregate({ _sum: { montantCommission: true }, where: { statut: "pending" } }),
  ]);

  const revenuTotal = commissionsTotal._sum.montantCommission || 0;
  const revenuMois = commissionsMois._sum.montantCommission || 0;
  const revenuPending = commissionsPending._sum.montantCommission || 0;

  const kpis = [
    { label: "Boutiques actives", value: boutiquesActives, total: totalBoutiques, icon: Store, color: "#F5A623", href: "/admin/boutiques" },
    { label: "Revenus capturés", value: formatMontant(revenuTotal, "XOF"), sub: `+${formatMontant(revenuMois, "XOF")} ce mois`, icon: DollarSign, color: "#16A34A", href: "/admin/finances" },
    { label: "Commandes payées", value: totalCommandes, sub: `${commandesMois} ce mois`, icon: ShoppingCart, color: "#AAAAAA", href: null },
    { label: "Clients totaux", value: totalClients.toLocaleString("fr-FR"), icon: Users, color: "#AAAAAA", href: null },
    { label: "En attente capture", value: formatMontant(revenuPending, "XOF"), sub: "Commandes non finalisées", icon: Clock, color: "#D97706", href: "/admin/finances" },
    { label: "Livreurs actifs", value: totalLivreurs, icon: Truck, color: "#AAAAAA", href: "/admin/livreurs" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#ffffff" }}>Axso HQ</h1>
        <p className="text-sm mt-1" style={{ color: "#AAAAAA" }}>
          Vue globale de la plateforme — {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          const content = (
            <div className="rounded-2xl p-5 border transition-all hover:scale-[1.01]"
              style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${k.color}15`, border: `1px solid ${k.color}25` }}>
                  <Icon size={18} style={{ color: k.color }} />
                </div>
                {k.href && <ArrowUpRight size={14} style={{ color: "#666666" }} />}
              </div>
              <p className="text-2xl font-bold" style={{ color: "#ffffff" }}>{k.value}</p>
              <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>{k.label}</p>
              {k.sub && <p className="text-xs mt-1" style={{ color: k.color }}>{k.sub}</p>}
              {k.total !== undefined && <p className="text-xs mt-0.5" style={{ color: "#666666" }}>sur {k.total} total</p>}
            </div>
          );
          return k.href ? <Link key={i} href={k.href}>{content}</Link> : <div key={i}>{content}</div>;
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Dernières boutiques */}
        <div className="rounded-2xl overflow-hidden border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <h2 className="font-semibold" style={{ color: "#ffffff" }}>Dernières boutiques</h2>
            <Link href="/admin/boutiques" className="text-xs hover:underline" style={{ color: "#F5A623" }}>Voir toutes →</Link>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {dernieresBoutiques.map(b => (
              <div key={b.id} className="flex items-center gap-4 px-6 py-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)", color: "#F5A623" }}>
                  {b.nomBoutique.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: "#ffffff" }}>{b.nomBoutique}</p>
                  <p className="text-xs" style={{ color: "#AAAAAA" }}>{b.pays} · {b._count.produits} produits · {b._count.commandes} commandes</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={b.statut === "active"
                      ? { background: "rgba(22,163,74,0.15)", color: "#16A34A" }
                      : { background: "rgba(220,38,38,0.15)", color: "#DC2626" }}>
                    {b.statut === "active" ? "Active" : b.statut === "systeme" ? "Système" : "Inactive"}
                  </span>
                  <span className="text-[10px]" style={{ color: "#666666" }}>{b.planType}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dernières transactions */}
        <div className="rounded-2xl overflow-hidden border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <h2 className="font-semibold" style={{ color: "#ffffff" }}>Dernières transactions</h2>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {dernieresCommandes.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-6 py-3">
                <CheckCircle size={14} style={{ color: "#16A34A" }} className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono truncate" style={{ color: "#ffffff" }}>{c.numero}</p>
                  <p className="text-[10px]" style={{ color: "#AAAAAA" }}>{c.tenant.nomBoutique} · {c.clientNom}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: "#F5A623" }}>{formatMontant(c.montantTotal, c.devise)}</p>
                  {c.commission && (
                    <p className="text-[10px]" style={{ color: "#16A34A" }}>+{formatMontant(c.commission.montantCommission, c.devise)} comm.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
