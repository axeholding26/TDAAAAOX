"use client";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import type { Langue } from "@/lib/i18n";

export function choisirLangue(langue: Langue) {
  document.cookie = `langue=${langue}; path=/; max-age=31536000; samesite=lax`;
  location.reload();
}

/** Menu de langue. `flottant` : pastille fixe en bas à gauche, masquée dans le dashboard (qui l'a dans son header). */
export function LangueSelecteur({ flottant = false }: { flottant?: boolean }) {
  const { langue } = useT();
  const pathname = usePathname();
  if (flottant && pathname?.startsWith("/dashboard")) return null;

  return (
    <label
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
        background: "rgba(255,255,255,.97)", border: "1px solid rgba(0,0,0,.1)", color: "#111",
        cursor: "pointer", flexShrink: 0,
        ...(flottant && { position: "fixed", left: 16, bottom: 16, zIndex: 60, boxShadow: "0 4px 16px rgba(0,0,0,.12)" }),
      }}
    >
      <Globe size={14} aria-hidden />
      <select
        aria-label="Langue / Language"
        value={langue}
        onChange={e => choisirLangue(e.target.value as Langue)}
        style={{ background: "transparent", border: "none", outline: "none", font: "inherit", color: "inherit", cursor: "pointer" }}
      >
        <option value="fr">Français</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
