"use client";

import { useState } from "react";
import { Lock, Download, Loader2 } from "lucide-react";

interface Fichier { id: string; nom: string }

export function LockedDownloads({ token, nom, accent, fond }: { token: string; nom: string; accent: string; fond: string }) {
  const [password, setPassword] = useState("");
  const [fichiers, setFichiers] = useState<Fichier[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErreur("");
    try {
      const res = await fetch(`/api/telechargements/${token}/verifier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Mot de passe incorrect");
      setFichiers(data.fichiers);
    } catch (e: any) {
      setErreur(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }

  const inp = "flex-1 px-3 py-2 text-sm rounded-lg border outline-none";

  if (!fichiers) {
    return (
      <form onSubmit={verifier} className="p-3 rounded-xl" style={{ backgroundColor: `${accent}08`, border: `1px solid ${accent}20` }}>
        <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Lock size={12} style={{ color: accent }} /> {nom} — protégé par mot de passe
        </p>
        <div className="flex gap-2">
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe fourni par le vendeur"
            className={inp} style={{ borderColor: `${accent}25`, background: fond }}
          />
          <button type="submit" disabled={loading}
            className="px-4 py-2 rounded-lg text-xs font-bold flex-shrink-0 flex items-center gap-1.5"
            style={{ backgroundColor: accent, color: fond }}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : "Déverrouiller"}
          </button>
        </div>
        {erreur && <p className="text-xs text-red-500 mt-1.5">{erreur}</p>}
      </form>
    );
  }

  return (
    <div className="p-3 rounded-xl" style={{ backgroundColor: `${accent}08`, border: `1px solid ${accent}20` }}>
      <p className="text-sm font-semibold mb-2">{nom}</p>
      <div className="space-y-2">
        {fichiers.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-3">
            <span className="text-xs opacity-60 truncate">{f.nom}</span>
            <a href={`/api/telechargements/${token}?fichier=${f.id}&pw=${encodeURIComponent(password)}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 transition-all hover:opacity-90"
              style={{ backgroundColor: accent, color: fond }}>
              <Download size={12} /> Télécharger
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
