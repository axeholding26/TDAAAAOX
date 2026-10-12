"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { useT } from "@/components/I18nProvider";

interface RetraitManuel {
  id: string; nomBoutique: string; montant: number; devise: string; methode: string;
  destinataire: string; operateur?: string; notes?: string; createdAt: string;
}

// Retraits que NotchPay ne peut pas envoyer seul : l'admin fait le virement à
// la main puis le marque payé, ou le refuse (le marchand est alors recrédité).
export function AdminRetraitsManuels({ peutTraiter }: { peutTraiter: boolean }) {
  const t = useT();
  const [retraits, setRetraits] = useState<RetraitManuel[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null);

  async function charger() {
    const res = await fetch("/api/admin/wallet/retraits");
    if (res.ok) setRetraits((await res.json()).retraits ?? []);
  }
  useEffect(() => { charger(); }, []);

  async function traiter(r: RetraitManuel, action: "payer" | "refuser") {
    const montant = `${r.montant.toLocaleString("fr-FR")} ${r.devise}`;
    const question = action === "payer"
      ? t("Confirmer que {0} ont bien été envoyés à {1} ?", montant, r.destinataire)
      : t("Refuser ce retrait et recréditer {0} au marchand ?", montant);
    if (!window.confirm(question)) return;
    setEnCours(r.id);
    try {
      const res = await fetch("/api/admin/wallet/retraits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, action }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(t(data.error ?? "Erreur")); return; }
      toast.success(action === "payer" ? t("Retrait marqué payé") : t("Retrait refusé — marchand recrédité"));
      charger();
    } finally { setEnCours(null); }
  }

  if (retraits.length === 0) return null;

  return (
    <div className="rounded-2xl p-6 border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
      <h2 className="font-semibold mb-1 flex items-center gap-2" style={{ color: "#ffffff" }}>
        <Clock size={16} style={{ color: "#F5A623" }} />{" "}{t("Retraits à traiter à la main")} ({retraits.length})
      </h2>
      <p className="text-xs mb-4" style={{ color: "#AAAAAA" }}>
        {t("Le solde du marchand est déjà débité. Envoyez l'argent, puis marquez le retrait payé — ou refusez-le pour le recréditer.")}
      </p>
      <div className="space-y-2">
        {retraits.map(r => (
          <div key={r.id} className="flex items-center justify-between flex-wrap gap-3 px-3 py-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: "#ffffff" }}>
                {r.montant.toLocaleString("fr-FR")} {r.devise} — {r.nomBoutique}
              </p>
              <p className="text-xs" style={{ color: "#AAAAAA" }}>
                {r.methode === "mobile_money" ? `Mobile Money ${r.operateur ?? ""}` : t("Virement bancaire")} → {r.destinataire} · {new Date(r.createdAt).toLocaleDateString("fr-FR")}
              </p>
              {r.notes && <p className="text-xs mt-0.5" style={{ color: "#D97706" }}>{r.notes}</p>}
            </div>
            {peutTraiter && (
              <div className="flex gap-2">
                <button onClick={() => traiter(r, "payer")} disabled={enCours === r.id}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: "#16A34A", color: "#ffffff" }}>
                  {t("Marquer payé")}
                </button>
                <button onClick={() => traiter(r, "refuser")} disabled={enCours === r.id}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50" style={{ borderColor: "rgba(220,38,38,0.5)", color: "#DC2626" }}>
                  {t("Refuser")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
