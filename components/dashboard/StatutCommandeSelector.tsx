"use client";
import { useState } from "react";
import { Loader2, MessageCircle, CheckCircle2, Truck, Check, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// ── Pipeline linéaire simplifié ──────────────────────────────────────────────
// en_attente → confirmee → expediee → livree  (avec annulee comme sortie à tout moment)
// En interne on mappe "en_preparation" sur "expediee" pour ne pas casser les données.

const STATUT_LABEL: Record<string, string> = {
  en_attente:     "En attente",
  confirmee:      "Confirmée",
  en_preparation: "En préparation",
  expediee:       "En livraison",
  livree:         "Livrée",
  annulee:        "Annulée",
};

const STATUT_COLOR: Record<string, { dot: string; text: string; bg: string }> = {
  en_attente:     { dot: "#F5A623", text: "#111111", bg: "rgba(245,166,35,0.12)" },
  confirmee:      { dot: "#D4911A", text: "#111111", bg: "rgba(212,145,26,0.12)" },
  en_preparation: { dot: "#999999", text: "#111111", bg: "rgba(153,153,153,0.12)" },
  expediee:       { dot: "#666666", text: "#111111", bg: "rgba(102,102,102,0.10)" },
  livree:         { dot: "#34d399", text: "#064e3b", bg: "rgba(52,211,153,0.1)" },
  annulee:        { dot: "#f87171", text: "#7f1d1d", bg: "rgba(248,113,113,0.1)" },
};

// Prochaine action principale pour chaque statut
const NEXT_ACTION: Record<string, { label: string; nextStatut: string; icon: any }> = {
  en_attente:     { label: "Confirmer",      nextStatut: "confirmee", icon: Check },
  confirmee:      { label: "En livraison",   nextStatut: "expediee",  icon: Truck },
  en_preparation: { label: "En livraison",   nextStatut: "expediee",  icon: Truck },
  expediee:       { label: "Marquer livré",  nextStatut: "livree",    icon: CheckCircle2 },
};

const TERMINAL = new Set(["livree", "annulee"]);
const ANNULABLE = new Set(["en_attente", "confirmee", "en_preparation", "expediee"]);

interface Props {
  commandeId: string;
  statutActuel: string;
}

export function StatutCommandeSelector({ commandeId, statutActuel }: Props) {
  const router = useRouter();
  const [statut, setStatut] = useState(statutActuel);
  const [loading, setLoading] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [notifEnvoyee, setNotifEnvoyee] = useState(false);

  const colors = STATUT_COLOR[statut] ?? STATUT_COLOR.en_attente;
  const nextAction = NEXT_ACTION[statut];

  async function changerStatut(nouveau: string) {
    if (nouveau === statut) return;
    setLoading(true);
    setWhatsappUrl(null);
    setNotifEnvoyee(false);
    try {
      const res = await fetch(`/api/commandes/${commandeId}/statut`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: nouveau }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setStatut(nouveau);
      if (data.envoyeAuto) {
        setNotifEnvoyee(true);
        toast.success(`${STATUT_LABEL[nouveau]} · Client notifié WhatsApp ✅`);
      } else if (data.whatsappUrl) {
        setWhatsappUrl(data.whatsappUrl);
        toast.success(`Statut → ${STATUT_LABEL[nouveau]}`);
      } else {
        toast.success(`Statut → ${STATUT_LABEL[nouveau]}`);
      }
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Badge statut actuel */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
        style={{ color: colors.text, backgroundColor: colors.bg, border: `1px solid ${colors.dot}30` }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.dot }} />
        {STATUT_LABEL[statut] ?? statut}
      </div>

      {/* Bouton action principale (prochaine étape) */}
      {!TERMINAL.has(statut) && nextAction && (
        <button
          onClick={() => changerStatut(nextAction.nextStatut)}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 shadow-sm"
          style={{ background: "linear-gradient(135deg, #F5A623, #d4880d)", color: "#080808" }}
        >
          {loading
            ? <Loader2 size={13} className="animate-spin" />
            : <nextAction.icon size={13} />}
          {nextAction.label}
        </button>
      )}

      {/* Bouton annuler */}
      {ANNULABLE.has(statut) && (
        <button
          onClick={() => changerStatut("annulee")}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:bg-red-50 disabled:opacity-40"
          style={{ border: "1px solid rgba(248,113,113,0.35)", color: "#f87171" }}
        >
          <XCircle size={12} /> Annuler
        </button>
      )}

      {/* Notification WhatsApp fallback */}
      {notifEnvoyee && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 px-3 py-2 rounded-xl">
          <CheckCircle2 size={13} /> Client notifié WhatsApp
        </div>
      )}
      {whatsappUrl && !notifEnvoyee && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 shadow-sm"
          style={{ background: "#25D366", boxShadow: "0 2px 10px rgba(37,211,102,0.35)" }}
          onClick={() => setWhatsappUrl(null)}
        >
          <MessageCircle size={14} />
          Notifier le client
        </a>
      )}
    </div>
  );
}
