"use client";
import { useEffect, useState } from "react";
import { Truck, ToggleRight, KeyRound, Settings } from "lucide-react";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

const TRANSPORTEURS_TUTORIAL_STEPS = [
  { Icon: Truck,        titre: "Tes partenaires de livraison", description: "Chaque transporteur est listé avec ses zones de couverture et son logo." },
  { Icon: ToggleRight,  titre: "Active un transporteur",       description: "Bascule l'interrupteur pour le rendre disponible lors de la création d'une livraison." },
  { Icon: KeyRound,     titre: "Configure la clé API",         description: "Ajoute la clé API du transporteur pour synchroniser le suivi des colis automatiquement." },
  { Icon: Settings,     titre: "Fixe un tarif",                description: "Renseigne un tarif fixe optionnel pour standardiser le coût de livraison de ce partenaire." },
];

type Transporteur = {
  code: string; nom: string; zones: string[]; logo: string;
  actif: boolean; apiKey: string; tarif: number | null;
};

export default function TransporteursPage() {
  const [liste, setListe] = useState<Transporteur[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [tarif, setTarif] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/transporteurs").then(r => r.json()).then(d => { setListe(d.transporteurs ?? []); setLoading(false); });
  }, []);

  async function toggle(code: string, current: boolean) {
    setSaving(true);
    await fetch("/api/transporteurs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, actif: !current }) });
    setListe(l => l.map(t => t.code === code ? { ...t, actif: !current } : t));
    setSaving(false);
  }

  async function saveConfig(code: string) {
    setSaving(true);
    await fetch("/api/transporteurs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, apiKey, tarif: tarif ? parseFloat(tarif) : null }) });
    setEditing(null); setApiKey(""); setTarif(""); setSaving(false);
    const d = await fetch("/api/transporteurs").then(r => r.json());
    setListe(d.transporteurs ?? []);
  }

  if (loading) return <div className="p-8 text-center text-sm text-gray-400">Chargement…</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <ModuleTutorial moduleKey="transporteurs" titre="Transporteurs" sousTitre="Partenaires de livraison" steps={TRANSPORTEURS_TUTORIAL_STEPS} />
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-[18px] font-bold text-[#111]">Transporteurs</h1>
          <BoutonRevoirTutoriel moduleKey="transporteurs" />
        </div>
        <p className="text-[12px] text-gray-500">Activez et configurez vos partenaires de livraison</p>
      </div>

      <div className="space-y-3">
        {liste.map(t => (
          <div key={t.code} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{t.logo}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[#111]">{t.nom}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t.zones.join(", ")}</span>
                </div>
                {t.tarif && <p className="text-[11px] text-gray-400">Tarif fixe: {t.tarif} XAF</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditing(t.code); setApiKey(""); setTarif(t.tarif?.toString() ?? ""); }}
                  className="text-[11px] text-gray-400 hover:text-[#F5A623] px-2 py-1 rounded-lg border border-gray-100 hover:border-[#F5A623]/30 transition-all">
                  Config
                </button>
                <button onClick={() => toggle(t.code, t.actif)} disabled={saving}
                  className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${t.actif ? "bg-[#F5A623]" : "bg-gray-200"}`}>
                  <span className={`inline-block h-4 w-4 m-0.5 rounded-full bg-white shadow transition-transform ${t.actif ? "translate-x-4" : ""}`} />
                </button>
              </div>
            </div>

            {editing === t.code && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#F5A623]/50"
                  placeholder="Clé API (laisser vide pour ne pas changer)"
                  value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" />
                <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#F5A623]/50"
                  placeholder="Tarif fixe XAF (optionnel)" type="number"
                  value={tarif} onChange={e => setTarif(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={() => saveConfig(t.code)} disabled={saving}
                    className="flex-1 py-2 bg-[#F5A623] text-white rounded-xl text-[12px] font-semibold hover:bg-[#e09520] transition-all disabled:opacity-50">
                    Enregistrer
                  </button>
                  <button onClick={() => setEditing(null)}
                    className="px-4 py-2 border border-gray-200 rounded-xl text-[12px] text-gray-500 hover:bg-gray-50">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
