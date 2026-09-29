import { prisma } from "@/lib/prisma";
import { commissionsParBoutiqueXAF, totalCommissionsXAF } from "@/lib/finances-admin";
import { redirect } from "next/navigation";
import { formatMontant, formatDate } from "@/lib/utils";
import { DollarSign, TrendingUp, AlertCircle, Receipt } from "lucide-react";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { AdminWalletPanel } from "@/components/admin/AdminWalletPanel";
import { getPlatformTenantId } from "@/lib/wallet";
import { getT } from "@/lib/i18n/serveur";

export default async function AdminFinancesPage() {
  const tx = await getT();
  const session = await getAdminSession();
  if (!session) redirect("/dashboard");

  const platformTenantId = await getPlatformTenantId();
  const platformWallet = await prisma.wallet.findUnique({ where: { tenantId: platformTenantId } });

  // Montants de toutes les boutiques convertis en XAF (devise du portefeuille AXSO) — voir lib/finances-admin.ts
  const [parBoutique, revenuPending, fraisNotchPay] = await Promise.all([
    commissionsParBoutiqueXAF({ statut: "captured" }),
    totalCommissionsXAF({ statut: "pending" }),
    prisma.walletTransaction.aggregate({
      _sum: { montant: true },
      where: { walletId: platformWallet?.id, type: "FRAIS" },
    }),
  ]);

  const topBoutiques = parBoutique.slice(0, 10);
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

  const revenuCapture = Math.round(parBoutique.reduce((s, g) => s + g.commissionXAF, 0));
  const fraisTotal = Math.abs(fraisNotchPay._sum.montant || 0);
  const revenuNetReel = Math.max(0, revenuCapture - fraisTotal);

  const kpiCard = "rounded-2xl p-5 border";
  const kpiStyle = { background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#ffffff" }}>{tx("Finances Axso")}</h1>
        <p className="text-sm mt-1" style={{ color: "#AAAAAA" }}>{tx("Revenus de commission, abonnements et frais de paiement")}</p>
      </div>

      {/* Wallet plateforme + retrait */}
      <AdminWalletPanel peutRetirer={estAdminComplet(session)} />

      {/* Commission brute vs frais NotchPay vs net réel */}
      <div className="rounded-2xl p-6 border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
        <h2 className="font-semibold mb-1 flex items-center gap-2" style={{ color: "#ffffff" }}>
          <Receipt size={15} style={{ color: "#F5A623" }} />
          {tx("Ce qu'Axso garde réellement")}
        </h2>
        <p className="text-xs mb-5" style={{ color: "#AAAAAA" }}>{tx("NotchPay prélève son propre frais de traitement sur chaque paiement — jamais sur le vendeur, toujours sur la commission Axso.")}</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <p className="text-lg font-bold" style={{ color: "#ffffff" }}>{formatMontant(revenuCapture, "XAF")}</p>
            <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>{tx("Commission brute (6%)")}</p>
          </div>
          <div>
            <p className="text-lg font-bold" style={{ color: "#DC2626" }}>−{formatMontant(fraisTotal, "XAF")}</p>
            <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>{tx("Frais NotchPay prélevés")}</p>
          </div>
          <div>
            <p className="text-lg font-bold" style={{ color: "#16A34A" }}>{formatMontant(revenuNetReel, "XAF")}</p>
            <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>{tx("Commission nette réelle (dans le wallet)")}</p>
          </div>
        </div>
      </div>

      {/* KPIs financiers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Revenus capturés", value: formatMontant(revenuCapture, "XAF"), icon: TrendingUp, color: "#16A34A", desc: "Commissions libérées" },
          { label: "En attente", value: formatMontant(revenuPending, "XAF"), icon: AlertCircle, color: "#D97706", desc: "Après livraison" },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className={kpiCard} style={kpiStyle}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${k.color}15`, border: `1px solid ${k.color}25` }}>
                  <Icon size={16} style={{ color: k.color }} />
                </div>
                <span className="text-xs" style={{ color: "#AAAAAA" }}>{tx(k.label)}</span>
              </div>
              <p className="text-xl font-bold" style={{ color: "#ffffff" }}>{tx(k.value)}</p>
              <p className="text-xs mt-1" style={{ color: "#666666" }}>{tx(k.desc)}</p>
            </div>
          );
        })}
      </div>

      {/* Top boutiques par commission */}
      <div className="rounded-2xl p-6 border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
        <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "#ffffff" }}>
          <DollarSign size={15} style={{ color: "#F5A623" }} />
          {tx("Top boutiques par revenus générés")}
        </h2>
        <div className="space-y-3">
          {topBoutiques.map((t, i) => {
            const tenant = tenantMap[t.tenantId];
            const comm = t.commission;
            const marchand = t.marchand;
            const maxComm = topBoutiques[0].commissionXAF || 1;
            return (
              <div key={t.tenantId} className="flex items-center gap-4">
                <span className="text-sm w-5 text-right" style={{ color: "#666666" }}>{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm" style={{ color: "#ffffff" }}>{tx(tenant?.nomBoutique) || tx(t.tenantId)}</span>
                    <span className="text-sm font-bold" style={{ color: "#16A34A" }}>{formatMontant(comm, t.devise)}</span>
                  </div>
                  <div className="w-full rounded-full h-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full" style={{ width: `${(t.commissionXAF / maxComm) * 100}%`, background: "linear-gradient(90deg,#F5A623,#D4911A)" }} />
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: "#666666" }}>{tx("Versé au marchand :")}{" "}{formatMontant(marchand, t.devise)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historique commissions */}
      <div className="rounded-2xl overflow-hidden border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <h2 className="font-semibold" style={{ color: "#ffffff" }}>{tx("Historique des commissions")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                {["Commande", "Boutique", "Client", "Montant commande", "Commission", "Marchand", "Statut", "Date"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium" style={{ color: "#AAAAAA" }}>{tx(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              {dernieresCommissions.map(c => (
                <tr key={c.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-mono text-xs" style={{ color: "#F5A623" }}>{c.commande.numero}</td>
                  <td className="px-5 py-3 text-xs" style={{ color: "#ffffff" }}>{tx(c.tenant.nomBoutique)}</td>
                  <td className="px-5 py-3 text-xs" style={{ color: "#AAAAAA" }}>{tx(c.commande.clientNom)}</td>
                  <td className="px-5 py-3" style={{ color: "#ffffff" }}>{formatMontant(c.montantCommande, c.devise)}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: "#16A34A" }}>+{formatMontant(c.montantCommission, c.devise)}</td>
                  <td className="px-5 py-3" style={{ color: "#AAAAAA" }}>{formatMontant(c.montantMarchand, c.devise)}</td>
                  <td className="px-5 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={c.statut === "captured" ? { background: "rgba(22,163,74,0.15)", color: "#16A34A" } : { background: "rgba(245,166,35,0.15)", color: "#F5A623" }}>
                      {c.statut === "captured" ? tx("Capturée") : tx("En attente")}
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
