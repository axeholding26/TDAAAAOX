import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  titre: string;
  valeur: string;
  tendance?: number;
  icone: LucideIcon;
  couleur?: string;
  description?: string;
  suffix?: string;
}

export function MetricCard({
  titre,
  valeur,
  tendance,
  icone: Icone,
  couleur = "#F5A623",
  description,
  suffix,
}: MetricCardProps) {
  const hausse = tendance !== undefined && tendance >= 0;

  return (
    <div
      className="relative bg-white rounded-2xl p-5 shadow-sm border border-gray-100 overflow-hidden group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}
    >
      {/* Accent glow top-right */}
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"
        style={{ background: couleur }}
      />

      <div className="relative flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm transition-transform duration-200 group-hover:scale-110"
          style={{
            background: `linear-gradient(135deg, ${couleur}20, ${couleur}08)`,
            border: `1.5px solid ${couleur}30`,
          }}
        >
          <Icone size={19} style={{ color: couleur }} />
        </div>

        {tendance !== undefined && (
          <div
            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
            style={
              hausse
                ? { background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0" }
                : { background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" }
            }
          >
            {hausse ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(tendance)}%
          </div>
        )}
      </div>

      <div className="relative">
        <p className="text-gray-400 text-xs font-medium mb-1.5 tracking-wide uppercase">
          {titre}
        </p>
        <p
          className="text-gray-900 text-2xl font-bold leading-none"
          style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}
        >
          {valeur}
          {suffix && <span className="text-sm text-gray-400 font-medium ml-1">{suffix}</span>}
        </p>
        {description && (
          <p className="text-gray-400 text-xs mt-1.5">{description}</p>
        )}
      </div>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${couleur}, transparent)` }}
      />
    </div>
  );
}
