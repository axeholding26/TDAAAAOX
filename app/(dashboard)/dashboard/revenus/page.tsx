// Dashboard Revenus et analytics financières
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatMontant } from "@/lib/utils";
import Link from "next/link";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowRight, Wallet } from "lucide-react";
import { AgentActiveIndicator } from "@/components/dashboard/AgentActiveIndicator";
import { BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { RevenusTutorial } from "@/components/dashboard/tutorials/RevenusTutorial";

export default async function RevenusPage() {
  const session = await auth();
  if (!session) redirect("/connexion");

  const tenantId = (session.user as any)?.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) redirect("/inscription");

  const debut30j = new Date();
  debut30j.setDate(debut30j.getDate() - 30);
  const debut7j = new Date();
  debut7j.setDate(debut7j.getDate() - 7);

  const [commandes30j, commandes7j, commissions] = await Promise.all([
    prisma.commande.findMany({
      where: { tenantId, createdAt: { gte: debut30j }, paiementStatut: "completed" },
      select: { montantTotal: true, createdAt: true },
    }),
    prisma.commande.findMany({
      where: { tenantId, createdAt: { gte: debut7j }, paiementStatut: "completed" },
      select: { montantTotal: true },
    }),
    prisma.commission.findMany({
      where: { tenantId },
      select: { montantCommission: true, createdAt: true },
    }),
  ]);

  const revenu30j       = commandes30j.reduce((s, c) => s + c.montantTotal, 0);
  const revenu7j        = commandes7j.reduce((s, c) => s + c.montantTotal, 0);
  const totalCommissions = commissions.reduce((s, c) => s + c.montantCommission, 0);
  const revenuNet       = revenu30j - totalCommissions;

  // Regrouper par jour (14 derniers jours)
  const parJour: Record<string, number> = {};
  commandes30j.forEach((c) => {
    const jour = c.createdAt.toISOString().slice(0, 10);
    parJour[jour] = (parJour[jour] || 0) + c.montantTotal;
  });
  const jours = Object.entries(parJour).slice(-14);
  const maxRevenu = Math.max(...jours.map(([, v]) => v), 1);

  const metriques = [
    {
      label: "Revenu 30 jours",
      value: formatMontant(revenu30j, tenant.devise),
      icon: DollarSign,
      accent: "#F5A623",
      description: "Commandes complétées",
    },
    {
      label: "Revenu 7 jours",
      value: formatMontant(revenu7j, tenant.devise),
      icon: TrendingUp,
      accent: "#16A34A",
      description: "Cette semaine",
    },
    {
      label: "Commissions Axso",
      value: formatMontant(totalCommissions, tenant.devise),
      icon: TrendingDown,
      accent: "#DC2626",
      description: "Frais de plateforme",
    },
    {
      label: "Revenu net",
      value: formatMontant(Math.max(0, revenuNet), tenant.devise),
      icon: Wallet,
      accent: "#7C3AED",
      description: "Après commissions",
    },
  ];

  return (
    <div className="space-y-6">
      <RevenusTutorial />
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-[#111111] font-poppins inline-flex items-center gap-2">Revenus <AgentActiveIndicator label="Agent Revenue actif" /></h1>
          <BoutonRevoirTutoriel moduleKey="revenus" />
        </div>
        <p className="text-[#717171] text-sm mt-1">Analyse financière de votre boutique</p>
      </div>

      {/* Hero card */}
      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#F4F4F4]">
            <DollarSign size={20} className="text-[#F5A623]" />
          </div>
          <p className="text-[#717171] text-xs uppercase tracking-wider font-semibold">
            Chiffre d'affaires · 30 jours
          </p>
        </div>
        <p className="text-5xl font-bold text-[#111111] font-poppins mb-2">
          {formatMontant(revenu30j, tenant.devise)}
        </p>
        <p className="text-[#717171] text-sm">
          Revenu net après commissions :{" "}
          <span className="font-semibold text-[#16A34A]">
            {formatMontant(Math.max(0, revenuNet), tenant.devise)}
          </span>
        </p>
      </div>

      {/* 4 metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metriques.map((m, i) => {
          const Icone = m.icon;
          return (
            <div key={i} className="bg-white border border-[#E8E8E8] rounded-2xl p-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#F4F4F4] mb-4">
                <Icone size={16} style={{ color: m.accent }} />
              </div>
              <p className="text-[#111111] text-xl font-bold font-poppins">{m.value}</p>
              <p className="text-[#717171] text-xs mt-1">{m.label}</p>
              <p className="text-[#717171] text-[10px] mt-0.5">{m.description}</p>
            </div>
          );
        })}
      </div>

      {/* Graphique barres 14j */}
      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#111111]">Revenus journaliers</h2>
            <p className="text-[#717171] text-xs mt-0.5">14 derniers jours</p>
          </div>
          {jours.length > 0 && (
            <div className="text-right">
              <p className="text-[#111111] font-bold font-poppins text-lg">
                {formatMontant(jours.reduce((s, [, v]) => s + v, 0), tenant.devise)}
              </p>
              <p className="text-[#717171] text-xs">sur la période</p>
            </div>
          )}
        </div>
        {jours.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F4F4F4] border border-[#E8E8E8] flex items-center justify-center">
              <BarChart3 size={20} className="text-[#717171]" />
            </div>
            <p className="text-[#717171] text-sm">Pas encore de données</p>
          </div>
        ) : (
          <div className="flex items-end gap-2 h-48">
            {jours.map(([date, revenu]) => {
              const hauteur = Math.max((revenu / maxRevenu) * 100, 3);
              const jour = new Date(date).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              });
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-2 group">
                  <div
                    className="relative w-full rounded-t-lg cursor-default"
                    style={{ height: `${hauteur}%`, backgroundColor: "#F5A623", minHeight: "4px", opacity: 0.85 }}
                    title={formatMontant(revenu, tenant.devise)}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#111111] text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                      {formatMontant(revenu, tenant.devise)}
                    </div>
                  </div>
                  <span className="text-[#717171] text-[10px] text-center leading-tight">{jour}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Répartition des revenus */}
      <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-[#111111] mb-5">Répartition des revenus</h2>
        <div className="space-y-1">
          {[
            {
              label: "Revenu brut (30j)",
              montant: revenu30j,
              sign: "+",
              signClass: "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]",
              amountClass: "#F5A623",
              description: "Total des commandes complétées",
            },
            {
              label: "Commission Axso (6%)",
              montant: totalCommissions,
              sign: "−",
              signClass: "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]",
              amountClass: "#DC2626",
              description: "Frais de plateforme prélevés",
            },
            {
              label: "Revenu net",
              montant: Math.max(0, revenuNet),
              sign: "=",
              signClass: "bg-[#ECFDF5] text-[#16A34A] border border-[#BBF7D0]",
              amountClass: "#16A34A",
              description: "Ce que vous empochez",
              highlight: true,
            },
          ].map((ligne) => (
            <div
              key={ligne.label}
              className={`flex items-center justify-between p-4 rounded-xl ${
                ligne.highlight ? "bg-[#F4F4F4] border border-[#E8E8E8]" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm border ${ligne.signClass}`}>
                  {ligne.sign}
                </div>
                <div>
                  <p className="text-[#111111] text-sm font-medium">{ligne.label}</p>
                  <p className="text-[#717171] text-xs">{ligne.description}</p>
                </div>
              </div>
              <span className="font-bold text-base font-poppins" style={{ color: ligne.amountClass }}>
                {formatMontant(ligne.montant, tenant.devise)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation sous-modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/dashboard/revenus/commissions">
          <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 hover:border-[#D0D0D0] transition-colors group cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#F4F4F4]">
                  <BarChart3 size={18} className="text-[#7C3AED]" />
                </div>
                <div>
                  <p className="text-[#111111] font-semibold text-sm">Commissions</p>
                  <p className="text-[#717171] text-sm mt-0.5">Détail des frais Axso prélevés</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-[#717171] group-hover:text-[#111111] group-hover:translate-x-0.5 transition-all duration-200" />
            </div>
            <div className="mt-4 pt-4 border-t border-[#E8E8E8] flex items-center justify-between">
              <span className="text-[#717171] text-xs">Total prélevé</span>
              <span className="font-bold text-sm font-poppins text-[#7C3AED]">
                {formatMontant(totalCommissions, tenant.devise)}
              </span>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/analytics">
          <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 hover:border-[#D0D0D0] transition-colors group cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#F4F4F4]">
                  <TrendingUp size={18} className="text-[#F5A623]" />
                </div>
                <div>
                  <p className="text-[#111111] font-semibold text-sm">Analytics complètes</p>
                  <p className="text-[#717171] text-sm mt-0.5">Visites, conversions, entonnoir</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-[#717171] group-hover:text-[#111111] group-hover:translate-x-0.5 transition-all duration-200" />
            </div>
            <div className="mt-4 pt-4 border-t border-[#E8E8E8] flex items-center justify-between">
              <span className="text-[#717171] text-xs">Période analysée</span>
              <span className="font-bold text-sm font-poppins text-[#111111]">30 jours</span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
