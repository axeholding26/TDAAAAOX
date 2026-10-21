"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { useT } from "@/components/I18nProvider";

interface RetraitManuel {
  id: string; nomBoutique: string; montant: number; devise: string; methode: string;
  destinataire: string; operateur?: string; notes?: string; createdAt: string;
}

// Retraits des marchands (tous, depuis le 20/10/2026) : l'admin fait le transfert dans
// NotchPay (détails dans l'e-mail « Retrait à valider ») puis le marque payé, ou le refuse
// (le marchand est alors recrédité). Le marchand est prévenu dans les deux cas.
// `commissions` : même écran pour les commissions d'affiliés (Admin › Affiliés, /api/admin/affilies).
// `livreurs` : retraits des livreurs (lib/gains-livreur.ts) ; refusé → le livreur est recrédité.
export function AdminRetraitsManuels({ peutTraiter, commissions = false, livreurs = false }: { peutTraiter: boolean; commissions?: boolean; livreurs?: boolean }) {
  const source = commissions ? "/api/admin/affilies" : livreurs ? "/api/admin/livreurs/retraits" : "/api/admin/wallet/retraits";
  const t = useT();
  const [retraits, setRetraits] = useState<RetraitManuel[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null);

  async function charger() {
    const res = await fetch(source);
    if (res.ok) setRetraits((await res.json().catch(() => ({}))).retraits ?? []);
  }
  useEffect(() => { charger(); }, []);

  async function traiter(r: RetraitManuel, action: "payer" | "refuser") {
    const montant = `${r.montant.toLocaleString("fr-FR")} ${r.devise}`;
    const question = action === "payer"
      ? t("Confirmer que {0} ont bien été envoyés à {1} ?", montant, r.destinataire)
      : livreurs ? t("Refuser ce retrait et recréditer {0} au livreur ?", montant) : t("Refuser ce retrait et recréditer {0} au marchand ?", montant);
    if (!window.confirm(question)) return;
    setEnCours(r.id);
    try {
      const res = await fetch(source, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(t(data.error ?? "Erreur")); return; }
      toast.success(livreurs
        ? (action === "payer" ? t("Marqué payé — le livreur est prévenu") : t("Refusé — livreur recrédité"))
        : (action === "payer" ? t("Marqué payé — le marchand est prévenu") : t("Refusé — marchand recrédité")));
      charger();
    } catch { toast.error(t("Erreur réseau")); } finally { setEnCours(null); }
  }

  if (retraits.length === 0) return null;

  return (
    <div className="rounded-2xl p-6 border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
      <h2 className="font-semibold mb-1 flex items-center gap-2" style={{ color: "#ffffff" }}>
        <Clock size={16} style={{ color: "#F5A623" }} />{" "}{commissions ? t("Commissions d'affiliés à verser") : livreurs ? t("Retraits des livreurs à payer") : t("Retraits à traiter à la main")} ({retraits.length})
      </h2>
      <p className="text-xs mb-4" style={{ color: "#AAAAAA" }}>
        {livreurs
          ? t("Le solde du livreur est déjà débité. Faites le transfert dans NotchPay (détails dans l'e-mail reçu), puis marquez-le payé — ou refusez-le pour recréditer le livreur.")
          : t("Le solde du marchand est déjà débité. Faites le transfert dans NotchPay (détails dans l'e-mail reçu), puis marquez-le payé — ou refusez-le pour recréditer le marchand.")}
      </p>
      <div className="space-y-2">
        {retraits.map(r => (
          <div key={r.id} className="flex items-center justify-between flex-wrap gap-3 px-3 py-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: "#ffffff" }}>
                {r.montant.toLocaleString("fr-FR")} {r.devise} — {r.nomBoutique}
              </p>
              <p className="text-xs [overflow-wrap:anywhere]" style={{ color: "#AAAAAA" }}>
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
