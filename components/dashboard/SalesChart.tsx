"use client";
import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { BarChart3 } from "lucide-react";
import { useT } from "@/components/I18nProvider";

interface DonneeVente { date: string; montant: number; commandes: number; }
interface SalesChartProps { donnees: DonneeVente[]; devise?: string; }

const PERIODS = [
  { key: 7,  label: "7 j" },
  { key: 14, label: "14 j" },
  { key: 30, label: "30 j" },
] as const;

function TooltipCustom({ active, payload, label, devise }: any) {
  const t = useT();
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #EBEBEB",
      borderRadius: "16px",
      padding: "12px 16px",
      boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
      fontFamily: "'Poppins',system-ui,sans-serif",
      minWidth: "150px",
    }}>
      <p style={{ fontSize: "11px", color: "#AAA", marginBottom: "8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t(label)}</p>
      {payload[0]?.value > 0 && (
        <p style={{ fontSize: "17px", fontWeight: 800, color: "#111", marginBottom: "3px", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {payload[0].value.toLocaleString(t.loc)}
          <span style={{ fontSize: "11px", color: "#AAA", fontWeight: 500, marginLeft: "3px" }}>{t(devise)}</span>
        </p>
      )}
      {payload[1]?.value > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "5px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#111111" }} />
          <p style={{ fontSize: "12px", color: "#888", fontWeight: 500, margin: 0 }}>
            {t(payload[1].value)} commande{payload[1].value > 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

export function SalesChart({ donnees, devise = "XOF" }: SalesChartProps) {
  const t = useT();
  const [period, setPeriod] = useState<7 | 14 | 30>(30);

  const data    = donnees.slice(-period);
  const total   = data.reduce((s, d) => s + d.montant, 0);
  const avgLine = total / Math.max(data.length, 1);
  const bestDay = data.reduce((best, d) => d.montant > best.montant ? d : best, data[0] ?? { date: "", montant: 0, commandes: 0 });
  const totalCmds = data.reduce((s, d) => s + d.commandes, 0);

  if (!donnees?.length) {
    return (
      <div className="ax-card p-6 h-72 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] flex items-center justify-center">
          <BarChart3 size={22} className="text-[#AAAAAA]" />
        </div>
        <p className="text-[13px] text-[#AAAAAA] font-medium">{t("Aucune donnée disponible")}</p>
        <p className="text-[11.5px] text-[#CCCCCC]">{t("Les ventes apparaîtront ici")}</p>
      </div>
    );
  }

  return (
    <div className="ax-card p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h3 className="text-[14px] font-bold text-[#111111] tracking-tight">{t("Évolution des ventes")}</h3>
          <p className="text-[11.5px] text-[#AAAAAA] mt-0.5">{t("Chiffre d'affaires journalier")}</p>
        </div>
        {/* Period tabs */}
        <div className="flex items-center gap-1 bg-[#F5F5F7] rounded-xl p-1 flex-shrink-0">
          {PERIODS.map(p => (
            <button key={p.key}
              onClick={() => setPeriod(p.key as 7 | 14 | 30)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
              style={{
                background: period === p.key ? "#fff" : "transparent",
                color: period === p.key ? "#111111" : "#AAAAAA",
                boxShadow: period === p.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}>
              {t(p.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-5 mb-5 pb-4 border-b border-[#F5F5F7]">
        <div>
          <p className="text-[11px] text-[#AAAAAA] font-medium uppercase tracking-wide">{t("Total période")}</p>
          <p className="text-[20px] font-bold text-[#111111] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
            {total.toLocaleString(t.loc)}
            <span className="text-[13px] text-[#AAAAAA] font-normal ml-1">{t(devise)}</span>
          </p>
        </div>
        <div className="w-px h-8 bg-[#F0F0F0]" />
        <div>
          <p className="text-[11px] text-[#AAAAAA] font-medium uppercase tracking-wide">{t("Commandes")}</p>
          <p className="text-[20px] font-bold text-[#111111] tabular-nums">{t(totalCmds)}</p>
        </div>
        {bestDay.montant > 0 && (
          <>
            <div className="w-px h-8 bg-[#F0F0F0]" />
            <div>
              <p className="text-[11px] text-[#AAAAAA] font-medium uppercase tracking-wide">{t("Meilleur jour")}</p>
              <p className="text-[13px] font-bold text-[#F5A623]">
                {bestDay.date}
                <span className="text-[11px] text-[#AAAAAA] font-normal ml-1.5">
                  {bestDay.montant.toLocaleString(t.loc)} {t(devise)}
                </span>
              </p>
            </div>
          </>
        )}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#F5A623" stopOpacity={0.22} />
              <stop offset="80%"  stopColor="#F5A623" stopOpacity={0.04} />
              <stop offset="100%" stopColor="#F5A623" stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="gradCmd" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#111111" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#111111" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="#F3F3F3" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="transparent"
            tick={{ fill: "#C8C8C8", fontSize: 10.5, fontFamily: "'Poppins',sans-serif", fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            interval={period === 7 ? 0 : period === 14 ? 1 : 4}
          />
          <YAxis
            stroke="transparent"
            tick={{ fill: "#C8C8C8", fontSize: 10.5, fontFamily: "'Poppins',sans-serif" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
          />
          <Tooltip content={<TooltipCustom devise={devise} />}
            cursor={{ stroke: "#F5A623", strokeWidth: 1, strokeDasharray: "4 3", strokeOpacity: 0.5 }} />
          <ReferenceLine y={avgLine} stroke="#EBEBEB" strokeDasharray="4 3" />
          <Area
            type="monotone"
            dataKey="montant"
            stroke="#F5A623"
            strokeWidth={2.5}
            fill="url(#gradCA)"
            dot={false}
            activeDot={{ r: 5, fill: "#F5A623", stroke: "#fff", strokeWidth: 2.5 }}
          />
          <Area
            type="monotone"
            dataKey="commandes"
            stroke="#111111"
            strokeWidth={1.5}
            fill="url(#gradCmd)"
            dot={false}
            activeDot={{ r: 4, fill: "#111111", stroke: "#fff", strokeWidth: 2 }}
            strokeOpacity={0.6}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-3 pt-3 border-t border-[#F5F5F7]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full" style={{ background: "#F5A623" }} />
          <span className="text-[11px] text-[#AAAAAA] font-medium">{t("CA (")}{t(devise)})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full" style={{ background: "#111111", opacity: 0.6 }} />
          <span className="text-[11px] text-[#AAAAAA] font-medium">{t("Commandes")}</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-3 h-px" style={{ borderTop: "1.5px dashed #EBEBEB" }} />
          <span className="text-[11px] text-[#CCCCCC]">{t("Moyenne")}</span>
        </div>
      </div>
    </div>
  );
}
