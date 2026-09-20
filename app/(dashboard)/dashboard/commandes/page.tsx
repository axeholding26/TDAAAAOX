import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Clock, CheckCircle, Truck, TrendingUp, Package, ChevronRight, ArrowUpRight,
} from "lucide-react";
import { CommandesExport } from "@/components/dashboard/CommandesExport";
import { BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { CommandesTutorial } from "@/components/dashboard/tutorials/CommandesTutorial";
import { formatMontant, dateRelative } from "@/lib/utils";

const STATUTS: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
  en_attente:     { label: "En attente",     bg: "#FFFBEB", text: "#B45309", dot: "#F59E0B", border: "#FDE68A" },
  confirmee:      { label: "Confirmée",       bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6", border: "#BFDBFE" },
  en_preparation: { label: "En préparation", bg: "#FAF5FF", text: "#6D28D9", dot: "#8B5CF6", border: "#DDD6FE" },
  expediee:       { label: "Expédiée",        bg: "#EEF2FF", text: "#4338CA", dot: "#6366F1", border: "#C7D2FE" },
  livree:         { label: "Livrée",          bg: "#F0FDF4", text: "#15803D", dot: "#22C55E", border: "#BBF7D0" },
  annulee:        { label: "Annulée",         bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444", border: "#FECACA" },
};

const AVATAR_COLORS = [
  ["#FFF8EC","#F5A623"],["#EFF6FF","#3B82F6"],["#F0FDF4","#16A34A"],
  ["#FAF5FF","#7C3AED"],["#FFF1F2","#E11D48"],["#ECFEFF","#0891B2"],
];

function StatutBadge({ statut }: { statut: string }) {
  const s = STATUTS[statut] ?? { label: statut, bg: "#F9FAFB", text: "#6B7280", dot: "#D1D5DB", border: "#E5E7EB" };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

function Avatar({ nom }: { nom: string }) {
  const hash = (nom ?? "?").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const [bg, text] = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const initiales = (nom ?? "?").split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0"
      style={{ background: bg, color: text, border: `1px solid ${text}20` }}>
      {initiales}
    </div>
  );
}

const FILTER_TABS = [
  { key: "all",            label: "Toutes"        },
  { key: "en_attente",     label: "En attente"    },
  { key: "confirmee",      label: "Confirmées"    },
  { key: "en_preparation", label: "En préparation"},
  { key: "expediee",       label: "Expédiées"     },
  { key: "livree",         label: "Livrées"       },
  { key: "annulee",        label: "Annulées"      },
];

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/connexion");
  const { statut: filtreStatut } = await searchParams;

  const tenantId = (session.user as any)?.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  const toutes = await prisma.commande.findMany({
    where: { tenantId },
    include: { lignes: true, client: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const now = new Date();
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
  const devise = tenant?.devise || "XOF";

  const stats = {
    enAttente: toutes.filter(c => c.statut === "en_attente").length,
    livrees:   toutes.filter(c => c.statut === "livree").length,
    expediees: toutes.filter(c => c.statut === "expediee").length,
    totalCeMois: toutes
      .filter(c => c.paiementStatut === "completed" && new Date(c.createdAt) >= debutMois)
      .reduce((s, c) => s + c.montantTotal, 0),
  };

  const commandes = filtreStatut && filtreStatut !== "all"
    ? toutes.filter(c => c.statut === filtreStatut)
    : toutes;

  const statCards = [
    {
      label: "CA ce mois",
      value: formatMontant(stats.totalCeMois, devise),
      Icon: TrendingUp,
      iconBg: "#FFF8EC", iconColor: "#F5A623",
      accent: true,
    },
    {
      label: "En attente",
      value: stats.enAttente,
      Icon: Clock,
      iconBg: "#FFFBEB", iconColor: "#D97706",
    },
    {
      label: "Expédiées",
      value: stats.expediees,
      Icon: Truck,
      iconBg: "#EEF2FF", iconColor: "#4338CA",
    },
    {
      label: "Livrées",
      value: stats.livrees,
      Icon: CheckCircle,
      iconBg: "#F0FDF4", iconColor: "#16A34A",
    },
  ];

  return (
    <div className="space-y-5"
      style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <CommandesTutorial />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap pt-1">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-[20px] font-bold text-[#111111] tracking-tight">Commandes</h1>
            <BoutonRevoirTutoriel moduleKey="commandes" />
            <span className="text-[11px] font-bold bg-[#F5F5F7] text-[#888888] border border-[#E8E8E8] px-2.5 py-0.5 rounded-full">
              {toutes.length}
            </span>
            {stats.enAttente > 0 && (
              <span className="text-[11px] font-bold bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] px-2.5 py-0.5 rounded-full">
                {stats.enAttente} en attente
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-[#AAAAAA]">Gérez et suivez toutes les commandes de votre boutique</p>
        </div>
        <CommandesExport total={toutes.length} />
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s, i) => {
          const Icon = s.Icon;
          return (
            <div key={i} className={`ax-card p-5 relative overflow-hidden group cursor-default ${s.accent ? "border-[#F5A623]/20" : ""}`}>
              {s.accent && (
                <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[20px]"
                  style={{ background: "linear-gradient(90deg, #F5A623, #FFD280, #F5A623)" }} />
              )}
              <div className="flex items-start justify-between gap-2 mb-4">
                <span className="ax-label">{s.label}</span>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                  style={{ background: s.iconBg, border: `1px solid ${s.iconColor}20` }}>
                  <Icon size={14} style={{ color: s.iconColor }} strokeWidth={1.8} />
                </div>
              </div>
              <p className="text-[24px] font-bold text-[#111111] leading-none tabular-nums tracking-tight">
                {s.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        {FILTER_TABS.map(tab => {
          const isActive = (filtreStatut ?? "all") === tab.key;
          const count = tab.key === "all"
            ? toutes.length
            : toutes.filter(c => c.statut === tab.key).length;
          return (
            <Link
              key={tab.key}
              href={tab.key === "all" ? "/dashboard/commandes" : `/dashboard/commandes?statut=${tab.key}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all flex-shrink-0"
              style={isActive ? {
                background: "#111111",
                color: "#FFFFFF",
                border: "1px solid #111111",
              } : {
                background: "#FFFFFF",
                color: "#888888",
                border: "1px solid #E8E8E8",
              }}
            >
              {tab.label}
              {count > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={isActive
                    ? { background: "rgba(255,255,255,0.15)", color: "#FFFFFF" }
                    : { background: "#F5F5F7", color: "#AAAAAA" }}>
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* ── Table / Empty state ── */}
      {commandes.length === 0 ? (
        <div className="ax-card p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mx-auto mb-4">
            <Package size={24} className="text-[#CCCCCC]" />
          </div>
          <p className="text-[14px] font-semibold text-[#111111] mb-1">Aucune commande{filtreStatut ? " dans ce statut" : ""}</p>
          <p className="text-[12px] text-[#AAAAAA] mb-6">
            {filtreStatut
              ? "Essayez un autre filtre ou attendez de nouvelles commandes"
              : "Les commandes passées par vos clients apparaîtront ici en temps réel"}
          </p>
          <Link href="/dashboard/boutique"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-4 py-2 rounded-2xl bg-[#111111] text-white hover:bg-[#2a2a2a] transition-colors">
            Voir ma boutique <ArrowUpRight size={13} />
          </Link>
        </div>
      ) : (
        <div className="ax-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F3F3F3] flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[#111111]">
              {commandes.length} commande{commandes.length > 1 ? "s" : ""}
              {filtreStatut && filtreStatut !== "all" && (
                <span className="ml-2 text-[#AAAAAA] font-normal">— filtrées</span>
              )}
            </p>
            <p className="text-[11.5px] text-[#AAAAAA]">Triées par date décroissante</p>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F3F3F3]">
                  {[
                    { label: "N°",          w: "w-[100px]" },
                    { label: "Client",      w: ""          },
                    { label: "Articles",    w: "w-[100px]" },
                    { label: "Montant",     w: "w-[120px]" },
                    { label: "Statut",      w: "w-[150px]" },
                    { label: "Date",        w: "w-[120px]" },
                    { label: "",            w: "w-[50px]"  },
                  ].map(({ label, w }) => (
                    <th key={label} className={`px-5 py-3 text-left ax-label ${w}`}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commandes.map(c => (
                  <tr key={c.id}
                    className="border-b border-[#F9F9F9] hover:bg-[#FAFAFA] transition-colors group">
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/commandes/${c.id}`}
                        className="text-[12.5px] font-mono font-bold text-[#F5A623] hover:underline">
                        #{c.numero?.slice(-6) ?? c.id.slice(-6).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar nom={c.clientNom ?? "?"} />
                        <div>
                          <p className="text-[13px] font-semibold text-[#222] leading-tight">{c.clientNom}</p>
                          {(c.ville || c.pays) && (
                            <p className="text-[11px] text-[#AAAAAA] mt-0.5">
                              {[c.ville, c.pays].filter(Boolean).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 text-[12px] text-[#888] font-medium bg-[#F5F5F7] border border-[#EBEBEB] px-2.5 py-1 rounded-lg">
                        <Package size={11} className="text-[#CCC]" />
                        {c.lignes.length} art.
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[13.5px] font-bold text-[#111]" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatMontant(c.montantTotal, c.devise)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatutBadge statut={c.statut} />
                    </td>
                    <td className="px-5 py-4 text-[11.5px] text-[#AAAAAA] whitespace-nowrap">
                      {dateRelative(c.createdAt)}
                    </td>
                    <td className="px-3 py-4">
                      <Link href={`/dashboard/commandes/${c.id}`}
                        className="w-7 h-7 rounded-lg border border-[#EBEBEB] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:border-[#CCC] hover:bg-[#F5F5F5] transition-all">
                        <ChevronRight size={13} className="text-[#888]" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-[#F5F5F5]">
            {commandes.map(c => (
              <Link key={c.id} href={`/dashboard/commandes/${c.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#FAFAFA] transition-colors active:bg-[#F5F5F5]">
                <Avatar nom={c.clientNom ?? "?"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11.5px] font-mono font-bold text-[#F5A623]">
                      #{c.numero?.slice(-6) ?? c.id.slice(-6).toUpperCase()}
                    </span>
                    <StatutBadge statut={c.statut} />
                  </div>
                  <p className="text-[13px] font-semibold text-[#222] truncate">{c.clientNom}</p>
                  <p className="text-[11px] text-[#BBBBBB] mt-0.5">{dateRelative(c.createdAt)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[13.5px] font-bold text-[#111]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatMontant(c.montantTotal, c.devise)}
                  </p>
                  <ChevronRight size={14} className="text-[#DDD] ml-auto mt-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
