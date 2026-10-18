"use client";
import { useState } from "react";
import { Loader2, Send, Copy } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useT } from "@/components/I18nProvider";

// Bouton « Renvoyer le lien » d'une commande numérique : reprend la livraison et renvoie
// l'e-mail. « E-mail envoyé » n'est affiché que si Resend a confirmé l'envoi.
export function RenvoyerLienDigital({ commandeId, lienAcces }: { commandeId: string; lienAcces: string }) {
  const t = useT();
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);

  async function renvoyer() {
    setEnvoi(true);
    try {
      const res = await fetch(`/api/commandes/${commandeId}/livraison-digitale`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(t(data.error ?? "Échec du renvoi"));
      else if (data.emailStatut === "envoye") toast.success(t("Lien d'accès renvoyé par e-mail"));
      else if (data.emailStatut === "sans_email") toast.warning(t("Pas d'e-mail client : copie le lien et envoie-le-lui (WhatsApp, SMS)."));
      else toast.error(t("Accès à jour, mais l'e-mail n'est pas parti. Copie le lien et envoie-le au client."));
      router.refresh();
    } finally {
      setEnvoi(false);
    }
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(lienAcces);
      toast.success(t("Lien d'accès copié"));
    } catch {
      toast.error(t("Copie impossible"));
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={renvoyer} disabled={envoi}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#111111] text-white disabled:opacity-50">
        {envoi ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        {t("Renvoyer le lien")}
      </button>
      <button onClick={copier}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-[#111111]">
        <Copy size={12} />{t("Copier le lien d'accès")}
      </button>
    </div>
  );
}
