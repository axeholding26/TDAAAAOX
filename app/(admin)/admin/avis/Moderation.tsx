"use client";
// Boutons de modération d'un avis plateforme.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Undo2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/I18nProvider";

export function Moderation({ id, statut, consentement }: { id: string; statut: string; consentement: boolean }) {
  const t = useT();
  const router = useRouter();
  const [charge, setCharge] = useState(false);
  const [refus, setRefus] = useState(false);
  const [motif, setMotif] = useState("");

  const decider = async (corps: Record<string, string>) => {
    setCharge(true);
    const r = await fetch(`/api/admin/avis/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    setCharge(false);
    if (!r?.ok) return toast.error(t(d?.erreur ?? "Action impossible"));
    toast.success(t(d.message));
    setRefus(false);
    router.refresh();
  };

  if (refus) return (
    <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); decider({ statut: "refuse", motif }); }}>
      <input className="cc-input flex-1 min-w-[200px]" autoFocus required minLength={5} maxLength={300} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder={t("Motif communiqué au marchand")} aria-label={t("Motif du refus")} />
      <button className="cc-btn cc-btn-sm" disabled={charge}>{charge ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}{t("Refuser")}</button>
      <button type="button" className="cc-btn cc-btn-ghost cc-btn-sm" onClick={() => setRefus(false)}>{t("Annuler")}</button>
    </form>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {statut !== "approuve" && <button className="cc-btn cc-btn-primary cc-btn-sm" disabled={charge || !consentement} title={consentement ? undefined : t("Le marchand n'a pas donné son accord")} onClick={() => decider({ statut: "approuve" })}>{charge ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}{t("Publier")}</button>}
      {statut !== "refuse" && <button className="cc-btn cc-btn-sm" disabled={charge} onClick={() => setRefus(true)}><X size={12} />{t(statut === "approuve" ? "Retirer" : "Refuser")}</button>}
      {statut !== "en_attente" && <button className="cc-btn cc-btn-ghost cc-btn-sm" disabled={charge} onClick={() => decider({ statut: "en_attente" })}><Undo2 size={12} />{t("Remettre en attente")}</button>}
    </div>
  );
}
