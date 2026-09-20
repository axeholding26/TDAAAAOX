import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDate, formatMontant } from "@/lib/utils";
import {
  Users, TrendingUp, ShoppingBag, Star, ChevronRight, ArrowUpRight,
} from "lucide-react";
import { AgentActiveIndicator } from "@/components/dashboard/AgentActiveIndicator";
import { BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { ClientsTutorial } from "@/components/dashboard/tutorials/ClientsTutorial";

const AVATAR_COLORS = [
  ["#FFF8EC","#F5A623"],["#EFF6FF","#3B82F6"],["#F0FDF4","#16A34A"],
  ["#FAF5FF","#7C3AED"],["#FFF1F2","#E11D48"],["#ECFEFF","#0891B2"],
];

function Avatar({ nom, idx }: { nom: string; idx: number }) {
  const [bg, text] = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  const initiales = nom.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0"
      style={{ background: bg, color: text, border: `1px solid ${text}20` }}>
      {initiales}
    </div>
  );
}

function SegmentBadge({ nbCommandes, total }: { nbCommandes: number; total: number }) {
  if (nbCommandes >= 5 || total >= 100000)
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
        <Star size={9} fill="currentColor" /> VIP
      </span>
    );
  if (nbCommandes >= 2)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">
        <span className="w-[5px] h-[5px] rounded-full bg-current" /> Régulier
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#F5F5F7] text-[#888888] border border-[#EBEBEB]">
      <span className="w-[5px] h-[5px] rounded-full bg-current" /> Nouveau
    </span>
  );
}

export default async function ClientsPage() {
  const session = await auth();
  if (!session) redirect("/connexion");

  const tenantId = (session.user as any)?.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) redirect("/inscription");

  const clients = await prisma.client.findMany({
    where: { tenantId },
    include: {
      commandes: {
        where: { statut: { notIn: ["annulee", "remboursee"] }, paiementStatut: "completed" },
        select: { montantTotal: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const sorted = [...clients].sort((a, b) => {
    const ta = a.commandes.reduce((s, c) => s + c.montantTotal, 0);
    const tb = b.commandes.reduce((s, c) => s + c.montantTotal, 0);
    return tb - ta;
  });

  const totalClients  = clients.length;
  const clientsActifs = clients.filter(c => c.commandes.length > 0).length;
  const totalRevenu   = clients.reduce((s, c) => s + c.commandes.reduce((sc, cmd) => sc + cmd.montantTotal, 0), 0);
  const panierMoyen   = clientsActifs > 0 ? totalRevenu / clientsActifs : 0;
  const vipCount      = clients.filter(c => {
    const t = c.commandes.reduce((s, cmd) => s + cmd.montantTotal, 0);
    return c.commandes.length >= 5 || t >= 100000;
  }).length;
  const tauxActifs = totalClients > 0 ? Math.round((clientsActifs / totalClients) * 100) : 0;

  const statCards = [
    {
      label: "Total clients",  value: totalClients,
      Icon: Users, iconBg: "#FFF8EC", iconColor: "#F5A623", accent: true,
    },
    {
      label: "Clients actifs", value: `${clientsActifs} (${tauxActifs}%)`,
      Icon: ShoppingBag, iconBg: "#F0FDF4", iconColor: "#16A34A",
    },
    {
      label: "Revenu généré",  value: formatMontant(totalRevenu, tenant.devise),
      Icon: TrendingUp, iconBg: "#FAF5FF", iconColor: "#7C3AED",
    },
    {
      label: "Panier moyen",   value: formatMontant(panierMoyen, tenant.devise),
      Icon: Star, iconBg: "#EFF6FF", iconColor: "#3B82F6",
    },
  ];

  return (
    <div className="space-y-5"
      style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <ClientsTutorial />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap pt-1">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-[20px] font-bold text-[#111111] tracking-tight inline-flex items-center gap-2">Clients <AgentActiveIndicator label="Agent Clients actif" /></h1>
            <BoutonRevoirTutoriel moduleKey="clients" />
            <span className="text-[11px] font-bold bg-[#F5F5F7] text-[#888888] border border-[#E8E8E8] px-2.5 py-0.5 rounded-full">
              {totalClients}
            </span>
            {vipCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] px-2.5 py-0.5 rounded-full">
                <Star size={9} fill="currentColor" /> {vipCount} VIP
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-[#AAAAAA]">Analysez et fidélisez votre base clients</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-[12px] bg-white border border-[#E8E8E8] rounded-2xl px-3.5 py-2">
            <span className="text-[#AAAAAA]">Taux actifs</span>
            <span className="font-bold text-[#111111]">{tauxActifs}%</span>
          </div>
        </div>
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
              <p className="text-[22px] font-bold text-[#111111] leading-none tabular-nums tracking-tight">
                {s.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Table ── */}
      <div className="ax-card overflow-hidden">
        {/* Table header */}
        <div className="px-6 py-4 border-b border-[#F3F3F3] flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-[13px] font-semibold text-[#111111]">Liste des clients</h2>
            <p className="text-[11.5px] text-[#AAAAAA] mt-0.5">Triés par dépenses décroissantes</p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { label: "VIP",      bg: "#FFFBEB", text: "#B45309", dot: "#F59E0B", border: "#FDE68A"  },
              { label: "Régulier", bg: "#F0FDF4", text: "#15803D", dot: "#22C55E", border: "#BBF7D0"  },
              { label: "Nouveau",  bg: "#F5F5F7", text: "#888888", dot: "#BBBBBB", border: "#EBEBEB"  },
            ].map(s => (
              <span key={s.label} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                <span className="w-[5px] h-[5px] rounded-full" style={{ background: s.dot }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {clients.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mx-auto mb-4">
              <Users size={24} className="text-[#CCCCCC]" />
            </div>
            <p className="text-[14px] font-semibold text-[#111111] mb-1">Aucun client encore</p>
            <p className="text-[12px] text-[#AAAAAA] mb-6">Vos clients apparaîtront ici dès leur première commande.</p>
            <a href="/dashboard/boutique"
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-4 py-2 rounded-2xl bg-[#111111] text-white hover:bg-[#2a2a2a] transition-colors">
              Voir ma boutique <ArrowUpRight size={13} />
            </a>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F3F3F3]">
                    {[
                      { label: "Client",             w: ""          },
                      { label: "Contact",            w: "w-[150px]" },
                      { label: "Commandes",          w: "w-[110px]" },
                      { label: "Dépenses totales",   w: "w-[140px]" },
                      { label: "Segment",            w: "w-[120px]" },
                      { label: "Dernière commande",  w: "w-[140px]" },
                      { label: "",                   w: "w-[44px]"  },
                    ].map(({ label, w }) => (
                      <th key={label} className={`px-5 py-3 text-left ax-label ${w}`}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((client, idx) => {
                    const totalAchats = client.commandes.reduce((s, c) => s + c.montantTotal, 0);
                    const derniereCommande = client.commandes[0]?.createdAt;
                    return (
                      <tr key={client.id}
                        className="border-b border-[#F9F9F9] hover:bg-[#FAFAFA] transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar nom={client.nom} idx={idx} />
                            <div>
                              <p className="text-[13px] font-semibold text-[#222] leading-tight">{client.nom}</p>
                              {client.email && (
                                <p className="text-[11px] text-[#AAAAAA] mt-0.5 max-w-[200px] truncate">{client.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[12px] text-[#888888]">{client.telephone || "—"}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[13px] font-bold text-[#111]">{client.commandes.length}</span>
                          <span className="text-[11px] text-[#AAAAAA] ml-1">cmd</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[13.5px] font-bold"
                            style={{ color: totalAchats > 0 ? "#F5A623" : "#CCCCCC", fontVariantNumeric: "tabular-nums" }}>
                            {formatMontant(totalAchats, tenant.devise)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <SegmentBadge nbCommandes={client.commandes.length} total={totalAchats} />
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-[11.5px] text-[#AAAAAA]">
                            {derniereCommande ? formatDate(derniereCommande) : "—"}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <div className="w-7 h-7 rounded-lg border border-[#EBEBEB] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:border-[#CCC] hover:bg-[#F5F5F5] transition-all cursor-pointer">
                            <ChevronRight size={13} className="text-[#888]" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-[#F5F5F5]">
              {sorted.map((client, idx) => {
                const totalAchats = client.commandes.reduce((s, c) => s + c.montantTotal, 0);
                return (
                  <div key={client.id} className="flex items-center gap-3 px-4 py-3.5">
                    <Avatar nom={client.nom} idx={idx} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#222] truncate">{client.nom}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-[#AAAAAA]">{client.commandes.length} cmd</span>
                        <SegmentBadge nbCommandes={client.commandes.length} total={totalAchats} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[13.5px] font-bold"
                        style={{ color: totalAchats > 0 ? "#F5A623" : "#CCCCCC", fontVariantNumeric: "tabular-nums" }}>
                        {formatMontant(totalAchats, tenant.devise)}
                      </p>
                      <ChevronRight size={14} className="text-[#DDD] ml-auto mt-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
