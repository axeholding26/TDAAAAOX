"use client";
import Link from "next/link";
import { formatMontant, dateRelative } from "@/lib/utils";
import { ArrowUpRight, ChevronRight, Package } from "lucide-react";
import type { CommandeAvecLignes } from "@/types";

interface OrdersTableProps { commandes: CommandeAvecLignes[] }

const STATUTS: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
  en_attente:     { label: "En attente",     bg: "#FFF8EC", text: "#111111", dot: "#F5A623", border: "#FDE68A" },
  confirmee:      { label: "Confirmée",       bg: "#FFF3DC", text: "#111111", dot: "#D4911A", border: "#F3D9A5" },
  en_preparation: { label: "En prépa.",       bg: "#F5F5F5", text: "#111111", dot: "#999999", border: "#E8E8E8" },
  expediee:       { label: "Expédiée",        bg: "#EFEFEF", text: "#111111", dot: "#666666", border: "#E0E0E0" },
  livree:         { label: "Livrée",          bg: "#F0FDF4", text: "#15803D", dot: "#22C55E", border: "#BBF7D0" },
  annulee:        { label: "Annulée",         bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444", border: "#FECACA" },
};

const AVATAR_COLORS = [
  ["#FFF8EC","#F5A623"],["#F5F5F5","#111111"],["#F0FDF4","#16A34A"],
  ["#FFF3DC","#D4911A"],["#FFF1F2","#E11D48"],["#EFEFEF","#666666"],
];

function StatutBadge({ statut }: { statut: string }) {
  const s = STATUTS[statut] ?? { label: statut, bg: "#F9FAFB", text: "#6B7280", dot: "#D1D5DB", border: "#E5E7EB" };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

function Avatar({ nom }: { nom: string }) {
  const hash = nom.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const [bg, text] = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const initiales = nom.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold flex-shrink-0"
      style={{ background: bg, color: text, border: `1px solid ${text}20` }}>
      {initiales}
    </div>
  );
}

export function OrdersTable({ commandes }: OrdersTableProps) {
  if (!commandes?.length) {
    return (
      <div className="ax-card p-14 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mx-auto mb-4">
          <Package size={24} className="text-[#AAAAAA]" />
        </div>
        <p className="text-[14px] font-semibold text-[#111111] mb-1">Aucune commande encore</p>
        <p className="text-[12px] text-[#AAAAAA]">Partagez votre boutique pour recevoir vos premières commandes</p>
      </div>
    );
  }

  return (
    <div className="ax-card overflow-hidden"
      style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F3F3]">
        <div>
          <h3 className="text-[14px] font-bold text-[#111111] tracking-tight">Commandes récentes</h3>
          <p className="text-[11.5px] text-[#AAAAAA] mt-0.5">{commandes.length} dernières transactions</p>
        </div>
        <Link href="/dashboard/commandes"
          className="flex items-center gap-1.5 text-[12px] font-semibold text-[#111111] border border-[#E8E8E8] rounded-2xl px-3 py-1.5 hover:border-[#CCC] hover:bg-[#F9F9F9] transition-all group">
          Voir tout <ArrowUpRight size={11} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>

      {/* ── Table desktop ── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F3F3F3]">
              {[
                { label: "N°",        w: "w-[90px]"  },
                { label: "Client",    w: ""          },
                { label: "Articles",  w: "w-[90px]"  },
                { label: "Montant",   w: "w-[110px]" },
                { label: "Statut",    w: "w-[130px]" },
                { label: "Date",      w: "w-[110px]" },
                { label: "",          w: "w-[40px]"  },
              ].map(({ label, w }) => (
                <th key={label} className={`px-5 py-3 text-left ax-label ${w}`}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {commandes.map((c, i) => (
              <tr key={c.id}
                className="border-b border-[#F9F9F9] hover:bg-[#FAFAFA] transition-colors group relative"
                style={{ borderLeft: i < 3 ? "3px solid transparent" : undefined }}
              >
                <td className="px-5 py-3.5">
                  <Link href={`/dashboard/commandes/${c.id}`}
                    className="text-[12.5px] font-mono font-bold text-[#F5A623] hover:underline">
                    #{c.numero}
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar nom={c.clientNom || "?"} />
                    <div>
                      <p className="text-[13px] font-semibold text-[#222] leading-tight">{c.clientNom}</p>
                      {c.clientEmail && (
                        <p className="text-[11px] text-[#AAAAAA] mt-0.5 truncate max-w-[180px]">{c.clientEmail}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-[12.5px] text-[#888] font-medium">
                    {c.lignes?.length ?? 0} art.
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-[13.5px] font-bold text-[#111]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatMontant(c.montantTotal, c.devise)}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <StatutBadge statut={c.statut} />
                </td>
                <td className="px-5 py-3.5 text-[11.5px] text-[#AAAAAA]">
                  {dateRelative(c.createdAt)}
                </td>
                <td className="px-3 py-3.5">
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

      {/* ── Mobile cards ── */}
      <div className="sm:hidden divide-y divide-[#F5F5F5]">
        {commandes.map(c => (
          <Link key={c.id} href={`/dashboard/commandes/${c.id}`}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#FAFAFA] transition-colors active:bg-[#F5F5F5]">
            <Avatar nom={c.clientNom || "?"} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11.5px] font-mono font-bold text-[#F5A623]">#{c.numero}</span>
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
  );
}
