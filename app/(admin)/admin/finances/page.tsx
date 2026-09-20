import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatMontant, formatDate } from "@/lib/utils";
import { DollarSign, Lock, Unlock, TrendingUp, AlertCircle, Receipt } from "lucide-react";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { AdminWalletPanel } from "@/components/admin/AdminWalletPanel";
import { getPlatformTenantId } from "@/lib/wallet";

export default async function AdminFinancesPage() {
  const session = await getAdminSession();
  if (!session) redirect("/dashboard");

  const platformTenantId = await getPlatformTenantId();
  const platformWallet = await prisma.wallet.findUnique({ where: { tenantId: platformTenantId } });

  const [commissionsCapturees, commissionsPending, escrowsHeld, escrowsReleased, topBoutiques, fraisNotchPay] = await Promise.all([
    prisma.commission.aggregate({ _sum: { montantCommission: true }, where: { statut: "captured" } }),
    prisma.commission.aggregate({ _sum: { montantCommission: true }, where: { statut: "pending" } }),
    prisma.escrow.aggregate({ _sum: { montant: true }, where: { statut: "held" } }),
    prisma.escrow.aggregate({ _sum: { montant: true }, where: { statut: "released" } }),
    prisma.commission.groupBy({
      by: ["tenantId"],
      _sum: { montantCommission: true, montantMarchand: true },
      where: { statut: "captured" },
      orderBy: { _sum: { montantCommission: "desc" } },
      take: 10,
    }),
    prisma.walletTransaction.aggregate({
      _sum: { montant: true },
      where: { walletId: platformWallet?.id, type: "FRAIS" },
    }),
  ]);

  const tenantIds = topBoutiques.map(t => t.tenantId);
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, nomBoutique: true, slug: true, devise: true },
  });
  const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t]));

  const dernieresCommissions = await prisma.commission.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { tenant: { select: { nomBoutique: true } }, commande: { select: { numero: true, clientNom: true } } },
  });

  const revenuCapture = commissionsCapturees._sum.montantCommission || 0;
  const revenuPending = commissionsPending._sum.montantCommission || 0;
  const escrowHeld = escrowsHeld._sum.montant || 0;
  const escrowReleased = escrowsReleased._sum.montant || 0;
  const fraisTotal = Math.abs(fraisNotchPay._sum.montant || 0);
  const revenuNetReel = Math.max(0, revenuCapture - fraisTotal);

  const kpiCard = "rounded-2xl p-5 border";
  const kpiStyle = { background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#ffffff" }}>Finances Axso</h1>
        <p className="text-sm mt-1" style={{ color: "#AAAAAA" }}>Revenus de commission (6%), abonnements et flux escrow</p>
      </div>

      {/* Wallet plateforme + retrait */}
      <AdminWalletPanel peutRetirer={estAdminComplet(session)} />

      {/* Commission brute vs frais NotchPay vs net réel */}
      <div className="rounded-2xl p-6 border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
        <h2 className="font-semibold mb-1 flex items-center gap-2" style={{ color: "#ffffff" }}>
          <Receipt size={15} style={{ color: "#F5A623" }} />
          Ce qu'Axso garde réellement
        </h2>
        <p className="text-xs mb-5" style={{ color: "#AAAAAA" }}>NotchPay prélève son propre frais de traitement sur chaque paiement — jamais sur le vendeur, toujours sur la commission Axso.</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <p className="text-lg font-bold" style={{ color: "#ffffff" }}>{formatMontant(revenuCapture, "XOF")}</p>
            <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>Commission brute (6%)</p>
          </div>
          <div>
            <p className="text-lg font-bold" style={{ color: "#DC2626" }}>−{formatMontant(fraisTotal, "XOF")}</p>
            <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>Frais NotchPay prélevés</p>
          </div>
          <div>
            <p className="text-lg font-bold" style={{ color: "#16A34A" }}>{formatMontant(revenuNetReel, "XOF")}</p>
            <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>Commission nette réelle (dans le wallet)</p>
          </div>
        </div>
      </div>

      {/* KPIs financiers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Revenus capturés", value: formatMontant(revenuCapture, "XOF"), icon: TrendingUp, color: "#16A34A", desc: "Commissions libérées" },
          { label: "En attente", value: formatMontant(revenuPending, "XOF"), icon: AlertCircle, color: "#D97706", desc: "Après livraison" },
          { label: "Escrow bloqué", value: formatMontant(escrowHeld, "XOF"), icon: Lock, color: "#AAAAAA", desc: "Fonds en séquestre" },
          { label: "Escrow libéré", value: formatMontant(escrowReleased, "XOF"), icon: Unlock, color: "#F5A623", desc: "Versé aux marchands" },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className={kpiCard} style={kpiStyle}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${k.color}15`, border: `1px solid ${k.color}25` }}>
                  <Icon size={16} style={{ color: k.color }} />
                </div>
                <span className="text-xs" style={{ color: "#AAAAAA" }}>{k.label}</span>
              </div>
              <p className="text-xl font-bold" style={{ color: "#ffffff" }}>{k.value}</p>
              <p className="text-xs mt-1" style={{ color: "#666666" }}>{k.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Top boutiques par commission */}
      <div className="rounded-2xl p-6 border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
        <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "#ffffff" }}>
          <DollarSign size={15} style={{ color: "#F5A623" }} />
          Top boutiques par revenus générés
        </h2>
        <div className="space-y-3">
          {topBoutiques.map((t, i) => {
            const tenant = tenantMap[t.tenantId];
            const comm = t._sum.montantCommission || 0;
            const marchand = t._sum.montantMarchand || 0;
            const maxComm = topBoutiques[0]._sum.montantCommission || 1;
            return (
              <div key={t.tenantId} className="flex items-center gap-4">
                <span className="text-sm w-5 text-right" style={{ color: "#666666" }}>{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm" style={{ color: "#ffffff" }}>{tenant?.nomBoutique || t.tenantId}</span>
                    <span className="text-sm font-bold" style={{ color: "#16A34A" }}>{formatMontant(comm, tenant?.devise || "XOF")}</span>
                  </div>
                  <div className="w-full rounded-full h-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(comm / maxComm) * 100}%`, background: "linear-gradient(90deg,#F5A623,#D4911A)" }} />
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: "#666666" }}>Versé au marchand : {formatMontant(marchand, tenant?.devise || "XOF")}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historique commissions */}
      <div className="rounded-2xl overflow-hidden border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <h2 className="font-semibold" style={{ color: "#ffffff" }}>Historique des commissions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                {["Commande", "Boutique", "Client", "Montant commande", "Commission", "Marchand", "Statut", "Date"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium" style={{ color: "#AAAAAA" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              {dernieresCommissions.map(c => (
                <tr key={c.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-mono text-xs" style={{ color: "#F5A623" }}>{c.commande.numero}</td>
                  <td className="px-5 py-3 text-xs" style={{ color: "#ffffff" }}>{c.tenant.nomBoutique}</td>
                  <td className="px-5 py-3 text-xs" style={{ color: "#AAAAAA" }}>{c.commande.clientNom}</td>
                  <td className="px-5 py-3" style={{ color: "#ffffff" }}>{formatMontant(c.montantCommande, c.devise)}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: "#16A34A" }}>+{formatMontant(c.montantCommission, c.devise)}</td>
                  <td className="px-5 py-3" style={{ color: "#AAAAAA" }}>{formatMontant(c.montantMarchand, c.devise)}</td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={c.statut === "captured" ? { background: "rgba(22,163,74,0.15)", color: "#16A34A" } : { background: "rgba(245,166,35,0.15)", color: "#F5A623" }}>
                      {c.statut === "captured" ? "Capturée" : "En attente"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: "#666666" }}>{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
