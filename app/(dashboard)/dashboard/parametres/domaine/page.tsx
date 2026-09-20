"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Globe, AlertCircle } from "lucide-react";

export default function DomainePage() {
  const [domaine, setDomaine] = useState("");
  const [slug, setSlug] = useState("votre-slug");

  useEffect(() => {
    fetch("/api/tenants/moi").then(r => r.json()).then(d => { if (d.slug) setSlug(d.slug); }).catch(() => {});
  }, []);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  async function sauvegarder() {
    if (!domaine) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainePropre: domaine }),
      });
      if (!res.ok) throw new Error();
      toast.success("Domaine sauvegardé !");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function verifier() {
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 2000));
    setVerified(false);
    setVerifying(false);
    toast.error("DNS non configuré  suivez les instructions ci-dessous");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-poppins">Domaine personnalisé</h1>
        <p className="text-gray-400 text-sm mt-1">Connectez votre propre nom de domaine à votre boutique</p>
      </div>

      <div className="bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-2xl p-5">
        <p className="text-[#F5A623] font-semibold text-sm mb-1">Votre URL actuelle</p>
        <p className="text-gray-700 font-mono text-sm">{slug}.axso.com</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <h2 className="text-gray-800 font-semibold">Configurer un domaine personnalisé</h2>

        <div>
          <label className="text-gray-400 text-xs block mb-2">Votre domaine</label>
          <input
            value={domaine}
            onChange={(e) => setDomaine(e.target.value)}
            placeholder="boutique.mondomaine.com"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50"
          />
          <p className="text-gray-500 text-xs mt-2">Ex: boutique.aminata.sn ou shop.maboutique.com</p>
        </div>

        <div className="flex gap-3">
          <button onClick={sauvegarder} disabled={!domaine || saving} className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#F5A623", color: "#0a0a0a" }}>
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
          <button onClick={verifier} disabled={!domaine || verifying} className="px-6 py-3 rounded-xl text-sm text-gray-400 border border-gray-200 hover:border-[#F5A623]/30 transition-all disabled:opacity-50">
            {verifying ? "Vérification..." : "Vérifier DNS"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
        <h2 className="text-gray-800 font-semibold">Instructions DNS</h2>
        <p className="text-gray-400 text-sm">Ajoutez ces enregistrements DNS chez votre registrar (ex: Gandi, OVH, Namecheap) :</p>

        <div className="space-y-3">
          {[
            { type: "CNAME", nom: "boutique", valeur: "cname.axso.com", ttl: "3600" },
            { type: "TXT", nom: "_axso-verify", valeur: "axso-verify=votre-token-ici", ttl: "3600" },
          ].map((record) => (
            <div key={record.type} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs mb-1">Type</p>
                  <p className="text-[#F5A623] font-mono font-bold">{record.type}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs mb-1">Nom</p>
                  <p className="text-gray-700 font-mono">{record.nom}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500 text-xs mb-1">Valeur</p>
                  <p className="text-gray-700 font-mono text-xs break-all">{record.valeur}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-3 bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-xl p-4">
          <AlertCircle size={16} className="text-[#D4911A] mt-0.5 flex-shrink-0" />
          <p className="text-[#666666] text-sm">La propagation DNS peut prendre 24-48h. Cliquez sur "Vérifier DNS" pour contrôler l'état.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <Globe size={16} className="text-[#F5A623]" />
          <h3 className="text-gray-800 font-semibold">SSL automatique</h3>
        </div>
        <p className="text-gray-400 text-sm">Un certificat SSL Let's Encrypt est généré automatiquement une fois votre domaine vérifié. Votre boutique sera accessible en HTTPS.</p>
      </div>
    </div>
  );
}

