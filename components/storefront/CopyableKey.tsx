"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useT } from "@/components/I18nProvider";

export function CopyableKey({ value, accent, fond }: { value: string; accent: string; fond: string }) {
  const t = useT();
  const [copie, setCopie] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopie(true); setTimeout(() => setCopie(false), 2000); }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-bold transition-all hover:opacity-90 flex-shrink-0"
      style={{ background: accent, color: fond }}
    >
      {copie ? <Check size={13} /> : <Copy size={13} />} {t(value)}
    </button>
  );
}
