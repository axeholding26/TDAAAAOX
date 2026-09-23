"use client";

import { useEffect, useState } from "react";

interface BoutiqueCompte {
  id: string; nomBoutique: string; active: boolean; nonLues: number;
}

/**
 * Change la boutique active puis recharge le dashboard. `destination` : page
 * à ouvrir ensuite (ex: lien d'une notification) — par défaut la section en
 * cours, sans l'id éventuel d'un élément qui n'existe pas dans l'autre boutique.
 */
export async function basculerBoutique(tenantId: string, destination?: string | null) {
  const res = await fetch("/api/boutiques/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId }),
  });
  if (!res.ok) return false;
  const section = window.location.pathname.split("/").slice(0, 3).join("/") || "/dashboard";
  window.location.assign(destination || section);
  return true;
}

// Sélecteur de boutique active — visible seulement avec 2 boutiques ou plus.
// Le compteur entre parenthèses = notifications non lues de chaque boutique.
export function BoutiqueSwitcher({ sombre = false }: { sombre?: boolean }) {
  const [boutiques, setBoutiques] = useState<BoutiqueCompte[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/boutiques").then(r => r.ok ? r.json() : null).then(d => setBoutiques(d?.boutiques ?? [])).catch(() => {});
  }, []);

  if (boutiques.length < 2) return null;
  const active = boutiques.find(b => b.active);
  const nonLuesAilleurs = boutiques.filter(b => !b.active).reduce((s, b) => s + b.nonLues, 0);

  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide mb-1"
        style={{ color: sombre ? "rgba(255,255,255,0.5)" : "#999999" }}>
        Boutique active
        {nonLuesAilleurs > 0 && (
          <span className="rounded-full px-1.5 text-[10px] text-white normal-case" style={{ background: "#DC2626" }}>
            {nonLuesAilleurs} ailleurs
          </span>
        )}
      </span>
      <select
        value={active?.id ?? ""}
        disabled={busy}
        onChange={async e => {
          setBusy(true);
          if (!(await basculerBoutique(e.target.value))) setBusy(false);
        }}
        className="w-full rounded-xl px-3 py-2 text-[12.5px] font-semibold border outline-none cursor-pointer disabled:opacity-60"
        style={sombre
          ? { background: "rgba(255,255,255,0.08)", color: "#FFFFFF", borderColor: "rgba(255,255,255,0.15)" }
          : { background: "#FAFAFA", color: "#111111", borderColor: "#E8E8E8" }}
      >
        {boutiques.map(b => (
          <option key={b.id} value={b.id} style={{ color: "#111111" }}>
            {b.nomBoutique}{!b.active && b.nonLues > 0 ? ` (${b.nonLues})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
