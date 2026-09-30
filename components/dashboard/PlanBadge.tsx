import { cn } from "@/lib/utils";
import { NOMS_PALIERS, type Palier } from "@/lib/plans";
import { useT } from "@/components/I18nProvider";

const PLAN_CONFIG: Record<Palier, { label: string; couleur: string; bg: string; border: string }> = {
  palier0: { label: NOMS_PALIERS.palier0, couleur: "#6b7280", bg: "#6b728015", border: "#6b728030" },
  palier1: { label: NOMS_PALIERS.palier1, couleur: "#F5A623", bg: "#F5A62315", border: "#F5A62330" },
  palier2: { label: NOMS_PALIERS.palier2, couleur: "#5E6063", bg: "#11111115", border: "#11111130" },
};

interface PlanBadgeProps {
  plan: string;
  className?: string;
  size?: "sm" | "md";
}

export function PlanBadge({ plan, className, size = "md" }: PlanBadgeProps) {
  const t = useT();
  const key = (plan?.toLowerCase() ?? "palier0") as Palier;
  const config = PLAN_CONFIG[key] ?? PLAN_CONFIG.palier0;

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-full",
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-3 py-1",
        className
      )}
      style={{
        color: config.couleur,
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      {t(config.label)}
    </span>
  );
}
