"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { envoyerAction } from "@/components/command-center/client";
import { useT } from "@/components/I18nProvider";

export function Retablir({ insightId }: { insightId: string }) {
  const t = useT();
  const router = useRouter();
  const [charge, setCharge] = useState(false);
  return (
    <button className="cc-btn cc-btn-ghost cc-btn-sm" disabled={charge} onClick={async () => { setCharge(true); if (await envoyerAction({ type: "retablir", insightId })) router.refresh(); setCharge(false); }}>
      {charge ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}{t("Rétablir")}
    </button>
  );
}
