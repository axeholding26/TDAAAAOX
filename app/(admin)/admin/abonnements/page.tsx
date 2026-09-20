import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatMontant, formatDate } from "@/lib/utils";
import { CreditCard, Zap, Crown, AlertTriangle } from "lucide-react";
import { getAdminSession } from "@/lib/admin-auth";
import { PLATFORM_TENANT_SLUG, getPlatformTenantId } from "@/lib/wallet";

const PALIERS = [
  { id: "palier0", nom: "Essentiel", prix: 0, icon: CreditCard, color: "#AAAAAA" },
  { id: "palier1", nom: "Pro", prix: 6000, icon: Zap, color: "#F5A623" },
  { id: "palier2", nom: "Illimité", prix: 20000, icon: Crown, color: "#F5A623" },
];

export default async function AdminAbonnementsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/dashboard");

  const filtreBoutiques = { slug: { not: PLATFORM_TENANT_SLUG } };
  const now = new Date();

  const [repartition, platformTenantId] = await Promise.all([
    prisma.tenant.groupBy({ by: ["planType"], _count: true, where: filtreBoutiques }),
    getPlatformTenantId(),
  ]);

  const platformWallet = await prisma.wallet.findUnique({ where: { tenantId: platformTenantId } });

  const [revenuAbonnementsTotal, revenuAbonnementsMois, abonnesPayants, abonnesExpires] = await Promise.all([
    prisma.walletTransaction.aggregate({
      _sum: { montant: true },
      where: { walletId: platformWallet?.id, description: { startsWith: "Abonnement" } },
    }),
    prisma.walletTransaction.aggregate({
      _sum: { montant: true },
      where: {
        walletId: platformWallet?.id,
        description: { startsWith: "Abonnement" },
        createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
      },
    }),
    prisma.tenant.findMany({
      where: { ...filtreBoutiques, planType: { in: ["palier1", "palier2"] } },
      select: { id: true, nomBoutique: true, slug: true, planType: true, planExpiresAt: true, devise: true },
      orderBy: { planExpiresAt: "asc" },
    }),
    prisma.tenant.count({
      where: { ...filtreBoutiques, planType: { in: ["palier1", "palier2"] }, planExpiresAt: { lt: now } },
    }),
  ]);

  const compteParPalier = Object.fromEntries(repartition.map(r => [r.planType, r._count]));
  const totalBoutiques = repartition.reduce((s, r) => s + r._count, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#ffffff" }}>Abonnements</h1>
        <p className="text-sm mt-1" style={{ color: "#AAAAAA" }}>Répartition des paliers et revenus récurrents Axso</p>
      </div>

      {/* Revenu abonnements */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl p-5 border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-2xl font-bold" style={{ color: "#16A34A" }}>{formatMontant(revenuAbonnementsTotal._sum.montant || 0, "XAF")}</p>
          <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>Revenu abonnements total</p>
        </div>
        <div className="rounded-2xl p-5 border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-2xl font-bold" style={{ color: "#F5A623" }}>{formatMontant(revenuAbonnementsMois._sum.montant || 0, "XAF")}</p>
          <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>Ce mois-ci</p>
        </div>
        <div className="rounded-2xl p-5 border" style={{ background: "#1A1A1A", borderColor: "rgba(220,38,38,0.2)" }}>
          <p className="text-2xl font-bold" style={{ color: "#DC2626" }}>{abonnesExpires}</p>
          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#AAAAAA" }}>
            <AlertTriangle size={11} /> Abonnements payants expirés
          </p>
        </div>
      </div>

      {/* Répartition par palier */}
      <div className="grid sm:grid-cols-3 gap-4">
        {PALIERS.map(p => {
          const Icon = p.icon;
          const count = compteParPalier[p.id] ?? (p.id === "palier0" ? (compteParPalier["gratuit"] ?? 0) : 0);
          const pct = totalBoutiques > 0 ? Math.round((count / totalBoutiques) * 100) : 0;
          return (
            <div key={p.id} className="rounded-2xl p-5 border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${p.color}18`, border: `1px solid ${p.color}30` }}>
                  <Icon size={14} style={{ color: p.color }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: "#ffffff" }}>{p.nom}</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: p.color }}>{count}</p>
              <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>{pct}% des boutiques · {p.prix > 0 ? `${p.prix.toLocaleString("fr-FR")} FCFA/mois` : "Gratuit"}</p>
            </div>
          );
        })}
      </div>

      {/* Abonnés payants */}
      <div className="rounded-2xl overflow-hidden border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <h2 className="font-semibold" style={{ color: "#ffffff" }}>Abonnés payants (Pro & Illimité)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                {["Boutique", "Palier", "Expire le", "Statut"].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium" style={{ color: "#AAAAAA" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {abonnesPayants.map(t => {
                const expire = t.planExpiresAt ? new Date(t.planExpiresAt) < now : false;
                const palier = PALIERS.find(p => p.id === t.planType);
                return (
                  <tr key={t.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3" style={{ color: "#ffffff" }}>{t.nomBoutique}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${palier?.color ?? "#AAAAAA"}18`, color: palier?.color ?? "#AAAAAA" }}>
                        {palier?.nom ?? t.planType}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "#AAAAAA" }}>{t.planExpiresAt ? formatDate(t.planExpiresAt) : "—"}</td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={expire ? { background: "rgba(220,38,38,0.15)", color: "#DC2626" } : { background: "rgba(22,163,74,0.15)", color: "#16A34A" }}>
                        {expire ? "Expiré" : "Actif"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {abonnesPayants.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-xs" style={{ color: "#666666" }}>Aucun abonné payant pour l'instant</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
