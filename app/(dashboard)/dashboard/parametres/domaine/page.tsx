"use client";
// Domaine personnalisé — état réel lu chez Vercel via /api/domaine (voir lib/domaines.ts).
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Globe, AlertCircle, CheckCircle2, Clock, Copy, Loader2, RefreshCw, Trash2, ExternalLink } from "lucide-react";

type Enregistrement = { type: string; nom: string; valeur: string; raison: string };
type Etat = { actif: boolean; verifie: boolean; dnsOk: boolean; enregistrements: Enregistrement[]; message?: string };
type Donnees = { slug?: string; publiee?: boolean; configure: boolean; domaine: string | null; etat?: Etat | null };

function copier(texte: string) {
  navigator.clipboard?.writeText(texte).then(() => toast.success("Copié")).catch(() => {});
}

export default function DomainePage() {
  const [d, setD] = useState<Donnees | null>(null);
  const [saisie, setSaisie] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [verif, setVerif] = useState(false);
  const [origine, setOrigine] = useState("");

  const charger = useCallback(async (verifier = false) => {
    const r = await fetch(`/api/domaine${verifier ? "?verifier=1" : ""}`);
    const j = await r.json();
    if (!r.ok) { toast.error(j.error ?? "Chargement impossible"); return null; }
    setD(j); return j as Donnees;
  }, []);

  useEffect(() => { setOrigine(window.location.origin); charger(); }, [charger]);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!saisie.trim()) return;
    setEnvoi(true);
    try {
      const r = await fetch("/api/domaine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domaine: saisie }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      toast.success("Domaine ajouté — créez maintenant les enregistrements DNS ci-dessous");
      setSaisie(""); await charger();
    } catch (err) { toast.error(err instanceof Error && err.message ? err.message : "Enregistrement impossible"); } finally { setEnvoi(false); }
  }

  async function verifier() {
    setVerif(true);
    const j = await charger(true);
    setVerif(false);
    if (j?.etat?.actif) toast.success("Domaine actif !");
    else if (j?.etat) toast.message("Pas encore prêt", { description: "Le DNS peut mettre de quelques minutes à 48 h à se propager." });
  }

  async function retirer() {
    if (!confirm(`Retirer ${d?.domaine} ? La boutique restera accessible sur son adresse AXSO.`)) return;
    const r = await fetch("/api/domaine", { method: "DELETE" });
    if (r.ok) { toast.success("Domaine retiré"); charger(); } else toast.error("Suppression impossible");
  }

  const adresseAxso = d?.slug ? `${origine}/${d.slug}` : "…";
  const etat = d?.etat;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-poppins">Domaine personnalisé</h1>
        <p className="text-gray-400 text-sm mt-1">Servez votre boutique sur votre propre nom de domaine (ex : boutique.mondomaine.com)</p>
      </div>

      <div className="bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-2xl p-4 sm:p-5 min-w-0">
        <p className="text-[#B45309] font-semibold text-sm mb-1">Adresse AXSO de la boutique</p>
        <p className="text-gray-700 font-mono text-sm break-all">{adresseAxso}</p>
      </div>

      {!d ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : !d.configure ? (
        <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-5">
          <AlertCircle size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-600">Les domaines personnalisés ne sont pas encore activés sur ce serveur. L'administrateur doit renseigner <code className="text-xs bg-white px-1 rounded">VERCEL_API_TOKEN</code> et <code className="text-xs bg-white px-1 rounded">VERCEL_PROJECT_ID</code>.</p>
        </div>
      ) : !d.domaine ? (
        <form onSubmit={enregistrer} className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 space-y-4">
          <h2 className="text-gray-800 font-semibold">Connecter un domaine</h2>
          <div>
            <label className="text-gray-500 text-xs block mb-2">Votre domaine</label>
            <input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="boutique.mondomaine.com" inputMode="url" autoCapitalize="none"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/60" />
            <p className="text-gray-500 text-xs mt-2">Conseil : un sous-domaine (boutique.…, shop.…) est le plus simple. Vous devez déjà posséder ce domaine chez un registraire (OVH, Namecheap, GoDaddy…).</p>
          </div>
          {!d.publiee && <p className="text-xs text-[#B45309]">Votre boutique est en brouillon : le domaine l'affichera une fois la boutique publiée.</p>}
          <button type="submit" disabled={!saisie.trim() || envoi} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-[#F5A623] text-white hover:opacity-90 disabled:opacity-50">
            {envoi ? <Loader2 size={15} className="animate-spin" /> : <Globe size={15} />} Connecter ce domaine
          </button>
        </form>
      ) : (
        <>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Globe size={18} className="text-gray-400 flex-shrink-0" />
              <a href={`https://${d.domaine}`} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-gray-900 break-all hover:underline inline-flex items-center gap-1 min-w-0">{d.domaine} <ExternalLink size={12} /></a>
              <span className={`ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${etat?.actif ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                {etat?.actif ? <><CheckCircle2 size={13} /> Actif</> : <><Clock size={13} /> En attente du DNS</>}
              </span>
            </div>
            {etat?.message && <p className="text-xs text-red-600">{etat.message}</p>}
            {etat && !etat.actif && (
              <ul className="text-xs text-gray-500 space-y-1">
                <li>{etat.dnsOk ? "✓" : "○"} Enregistrement de routage (A / CNAME) détecté</li>
                <li>{etat.verifie ? "✓" : "○"} Propriété du domaine vérifiée</li>
              </ul>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={verifier} disabled={verif} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:border-[#F5A623]/50 disabled:opacity-50">
                {verif ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Vérifier maintenant
              </button>
              <button onClick={retirer} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50">
                <Trash2 size={14} /> Retirer le domaine
              </button>
            </div>
          </div>

          {etat && !etat.actif && etat.enregistrements.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 space-y-4">
              <h2 className="text-gray-800 font-semibold">À créer chez votre registraire</h2>
              <p className="text-gray-500 text-sm">Dans la zone DNS de votre domaine, ajoutez exactement ces enregistrements :</p>
              <div className="space-y-3">
                {etat.enregistrements.map((e, i) => (
                  <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                    <p className="text-xs text-gray-500">{e.raison}</p>
                    <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[70px_minmax(0,1fr)_minmax(0,2fr)] gap-x-3 gap-y-1 text-sm items-start">
                      <span className="text-gray-500 text-xs sm:hidden">Type</span><span className="font-mono font-bold text-[#B45309]">{e.type}</span>
                      <span className="text-gray-500 text-xs sm:hidden">Nom</span>
                      <button onClick={() => copier(e.nom)} className="font-mono text-gray-700 text-left break-all inline-flex items-center gap-1.5 min-w-0">{e.nom} <Copy size={11} className="text-gray-400 flex-shrink-0" /></button>
                      <span className="text-gray-500 text-xs sm:hidden">Valeur</span>
                      <button onClick={() => copier(e.valeur)} className="font-mono text-gray-700 text-xs text-left break-all inline-flex items-center gap-1.5 min-w-0">{e.valeur} <Copy size={11} className="text-gray-400 flex-shrink-0" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-3 bg-[#F5A623]/10 border border-[#F5A623]/30 rounded-xl p-4">
                <AlertCircle size={16} className="text-[#D4911A] mt-0.5 flex-shrink-0" />
                <p className="text-[#666666] text-sm">La propagation prend de quelques minutes à 48 h. Le certificat HTTPS est ensuite créé automatiquement. Cliquez sur « Vérifier maintenant » pour suivre l'avancement.</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
