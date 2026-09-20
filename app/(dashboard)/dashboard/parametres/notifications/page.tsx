"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, MessageSquare, Mail, Save } from "lucide-react";

const DEFAUT = {
  whatsappNumero: "",
  emailNotif: "",
  notifNouvelleCommande: true,
  notifPaiementRecu: true,
  notifNouvelAvis: false,
  notifStockFaible: true,
  notifStockSeuil: 5,
  whatsappActif: false,
  emailActif: true,
};

export default function NotificationsPage() {
  const [config, setConfig] = useState(DEFAUT);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/tenants/moi-complet").then(r => r.json()).then(tenant => {
      if (tenant?.parametresPaiement) {
        const saved = (tenant.parametresPaiement as any).notifications;
        if (saved) setConfig({ ...DEFAUT, ...saved });
      }
      if (!config.whatsappNumero && tenant?.whatsapp) {
        setConfig(prev => ({ ...prev, whatsappNumero: tenant.whatsapp }));
      }
      if (!config.emailNotif && tenant?.email) {
        setConfig(prev => ({ ...prev, emailNotif: tenant.email }));
      }
      setLoaded(true);
    });
  }, []);

  function toggle(key: keyof typeof config) {
    setConfig(prev => ({ ...prev, [key]: !prev[key as keyof typeof config] }));
  }

  async function sauvegarder() {
    setSaving(true);
    try {
      const res = await fetch("/api/tenants/moi-complet").then(r => r.json());
      const paiementActuel = (res?.parametresPaiement as any) || {};
      await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parametresPaiement: { ...paiementActuel, notifications: config },
          whatsapp: config.whatsappNumero || res?.whatsapp,
        }),
      });
      toast.success("Notifications configurées !");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button type="button" onClick={onChange} className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0" style={{ backgroundColor: checked ? "#F5A623" : "#1a1a2e" }}>
      <span className="absolute top-1 transition-transform rounded-full w-4 h-4 bg-white shadow" style={{ left: checked ? "calc(100% - 20px)" : "4px" }} />
    </button>
  );

  if (!loaded) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-8 bg-white/5 rounded-xl w-40 animate-pulse" />
        <div className="h-32 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-poppins">Notifications</h1>
        <p className="text-gray-400 text-sm mt-1">Configurez vos alertes en temps réel</p>
      </div>

      {/* WhatsApp */}
      <div className="bg-white border border-white/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/30 flex items-center justify-center">
              <MessageSquare size={18} className="text-green-400" />
            </div>
            <div>
              <p className="text-gray-800 font-semibold">WhatsApp Business</p>
              <p className="text-gray-500 text-xs">Notifications instantanées via WhatsApp</p>
            </div>
          </div>
          <ToggleSwitch checked={config.whatsappActif} onChange={() => toggle("whatsappActif")} />
        </div>
        {config.whatsappActif && (
          <div>
            <label className="text-gray-400 text-xs block mb-2">Numéro WhatsApp (avec indicatif pays)</label>
            <input
              value={config.whatsappNumero}
              onChange={e => setConfig({ ...config, whatsappNumero: e.target.value })}
              placeholder="+221 77 000 00 00"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50"
            />
            <p className="text-gray-600 text-xs mt-1.5">Les notifications seront envoyées sur ce numéro via l'API WhatsApp Business.</p>
          </div>
        )}
      </div>

      {/* Email */}
      <div className="bg-white border border-white/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5A623]/15 border border-[#F5A623]/30 flex items-center justify-center">
              <Mail size={18} className="text-[#D4911A]" />
            </div>
            <div>
              <p className="text-gray-800 font-semibold">Email</p>
              <p className="text-gray-500 text-xs">Notifications par email</p>
            </div>
          </div>
          <ToggleSwitch checked={config.emailActif} onChange={() => toggle("emailActif")} />
        </div>
        {config.emailActif && (
          <div>
            <label className="text-gray-400 text-xs block mb-2">Email de notification</label>
            <input
              type="email"
              value={config.emailNotif}
              onChange={e => setConfig({ ...config, emailNotif: e.target.value })}
              placeholder="moi@maboutique.com"
              className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50"
            />
          </div>
        )}
      </div>

      {/* Types de notifications */}
      <div className="bg-white border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={15} className="text-[#F5A623]" />
          <h2 className="text-gray-800 font-semibold">Alertes activées</h2>
        </div>
        <div className="space-y-0 divide-y divide-white/5">
          {[
            { key: "notifNouvelleCommande", label: "Nouvelle commande", desc: "Alerte dès qu'un client passe une commande" },
            { key: "notifPaiementRecu", label: "Paiement reçu", desc: "Confirmation quand un paiement est validé" },
            { key: "notifNouvelAvis", label: "Nouvel avis client", desc: "Quand un client laisse un avis" },
            { key: "notifStockFaible", label: "Stock faible", desc: `Alerte quand un produit passe sous le seuil défini` },
          ].map(notif => (
            <div key={notif.key} className="flex items-center justify-between py-4">
              <div className="flex-1 pr-4">
                <p className="text-gray-800 text-sm font-medium">{notif.label}</p>
                <p className="text-gray-500 text-xs">{notif.desc}</p>
              </div>
              <ToggleSwitch
                checked={config[notif.key as keyof typeof config] as boolean}
                onChange={() => toggle(notif.key as keyof typeof config)}
              />
            </div>
          ))}
        </div>
        {config.notifStockFaible && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <label className="text-gray-400 text-xs block mb-2">Seuil de stock faible (en unités)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={config.notifStockSeuil}
              onChange={e => setConfig({ ...config, notifStockSeuil: Number(e.target.value) })}
              className="w-28 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50"
            />
          </div>
        )}
      </div>

      <button onClick={sauvegarder} disabled={saving} className="flex items-center gap-2 px-6 py-4 rounded-xl font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#F5A623", color: "#0a0a0a" }}>
        <Save size={15} />
        {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
      </button>
    </div>
  );
}

