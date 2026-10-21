"use client";
// Rémunération d'un livreur choisie par le marchand (lib/gains-livreur.ts), chargée à l'ouverture.
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { formatMontant } from "@/lib/utils";

type Resume = { mode: string; montantFixe: number; devise: string; totaux: { paiement: string; devise: string; montant: number; courses: number }[] };

const MODES = [
  { v: "frais_livraison", label: "Frais de livraison", aide: "Il touche les frais de livraison payés par le client sur chaque course livrée." },
  { v: "fixe", label: "Montant fixe par course", aide: "Il touche le montant que tu fixes, sur chaque course livrée." },
  { v: "hors_axso", label: "Payé hors Axso", aide: "Salarié ou payé à part : Axso ne calcule rien." },
];

export function RemunerationLivreur({ livreurId }: { livreurId: string }) {
  const t = useT();
  const [ouvert, setOuvert] = useState(false);
  const [r, setR] = useState<Resume | null>(null);
  const [mode, setMode] = useState("frais_livraison");
  const [fixe, setFixe] = useState("");
  const [saving, setSaving] = useState(false);

  async function ouvrir() {
    setOuvert(!ouvert);
    if (r || ouvert) return;
    const res = await fetch(`/api/livreurs/${livreurId}/remuneration`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(t(d.error || "Erreur")); return; }
    setR(d); setMode(d.mode); setFixe(d.montantFixe ? String(d.montantFixe) : "");
  }

  async function enregistrer() {
    setSaving(true);
    try {
      const res = await fetch(`/api/livreurs/${livreurId}/remuneration`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, montantFixe: Number(fixe) || 0 }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Erreur");
      toast.success(t("Rémunération enregistrée — elle s'applique aux prochaines courses livrées"));
    } catch (e: any) { toast.error(t(e.message)); } finally { setSaving(false); }
  }

  return (
    <div className="border-t border-gray-100 pt-3">
      <button type="button" onClick={ouvrir} className="text-xs font-semibold text-[#F5A623] flex items-center gap-1.5">
        <Wallet size={12} />{" "}{t("Rémunération")}
      </button>
      {ouvert && !r && <Loader2 size={14} className="animate-spin text-[#F5A623] mt-2" />}
      {ouvert && r && (
        <div className="mt-3 space-y-3">
          <div className="grid sm:grid-cols-3 gap-2">
            {MODES.map(m => (
              <label key={m.v} className={`rounded-xl border p-3 cursor-pointer text-xs ${mode === m.v ? "border-[#F5A623] bg-[#F5A623]/5" : "border-gray-200"}`}>
                <input type="radio" className="sr-only" checked={mode === m.v} onChange={() => setMode(m.v)} />
                <span className="font-semibold text-gray-900 block">{t(m.label)}</span>
                <span className="text-gray-500">{t(m.aide)}</span>
              </label>
            ))}
          </div>
          {mode === "fixe" && (
            <label className="block text-xs text-gray-500">
              {t("Montant par course")} ({r.devise})
              <input type="number" min={0} inputMode="decimal" value={fixe} onChange={e => setFixe(e.target.value)}
                className="mt-1 w-full sm:w-48 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-[#F5A623]/50" />
            </label>
          )}
          <p className="text-[11px] text-gray-500">
            {t("Paiement en ligne : sa part est prise sur ton wallet Axso et créditée à son solde. Paiement à la livraison : il garde sa part sur l'argent encaissé et te remet le reste.")}
          </p>
          <button type="button" onClick={enregistrer} disabled={saving}
            className="flex items-center gap-2 bg-[#F5A623] text-black font-semibold px-4 py-2 rounded-xl text-xs disabled:opacity-50">
            {saving && <Loader2 size={12} className="animate-spin" />}{t("Enregistrer")}
          </button>
          {r.totaux.length > 0 && (
            <div className="text-xs text-gray-600 space-y-1">
              {r.totaux.map(x => (
                <p key={`${x.paiement}|${x.devise}`}>
                  {x.paiement === "en_ligne" ? t("Payé depuis ton wallet") : t("Gardé sur les espèces encaissées")}
                  {" : "}<strong>{formatMontant(x.montant, x.devise)}</strong>{" "}· {t("{0} course(s)", x.courses)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
