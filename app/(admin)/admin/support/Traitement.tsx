"use client";
// Réponse au marchand et changement de statut d'un signalement.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/I18nProvider";
import { STATUTS_SIGNALEMENT, NOM_STATUT } from "@/lib/signalements";

export function Traitement({ id, statut: initial, reponse: rep }: { id: string; statut: string; reponse: string }) {
  const t = useT();
  const router = useRouter();
  const [statut, setStatut] = useState(initial);
  const [reponse, setReponse] = useState(rep);
  const [charge, setCharge] = useState(false);

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCharge(true);
    const r = await fetch(`/api/admin/support/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut, reponse }) }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    setCharge(false);
    if (!r?.ok) return void toast.error(t(d?.erreur ?? "Action impossible"));
    toast.success(t(d.message));
    router.refresh();
  };

  return (
    <form onSubmit={envoyer} className="space-y-2">
      <textarea className="cc-input w-full !h-auto py-2" rows={3} maxLength={4000} value={reponse} onChange={(e) => setReponse(e.target.value)}
        placeholder={t("Réponse au marchand (il la verra dans son tableau de bord)")} aria-label={t("Réponse au marchand")} />
      <div className="flex flex-wrap gap-2">
        <select className="cc-select" value={statut} onChange={(e) => setStatut(e.target.value)} aria-label={t("Statut")}>
          {STATUTS_SIGNALEMENT.map((s) => <option key={s} value={s}>{t(NOM_STATUT[s])}</option>)}
        </select>
        <button className="cc-btn cc-btn-primary cc-btn-sm" disabled={charge}>{charge ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}{t("Enregistrer")}</button>
      </div>
    </form>
  );
}
