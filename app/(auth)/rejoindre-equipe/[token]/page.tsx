"use client";
import { useEffect, useState } from "react";
import { use as usePromise } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, UserPlus, CheckCircle2, XCircle } from "lucide-react";

const ACCENT = "#F5A623";
const ACCENT_DARK = "#d4880d";
const ROLE_LABELS: Record<string, string> = {
  gerant: "Gérant", caissier: "Caissier", comptable: "Comptable",
  lecture: "Lecture seule", personnalise: "Personnalisé",
};

export default function RejoindreEquipePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params);
  const router = useRouter();

  const [statut, setStatut] = useState<"chargement" | "valide" | "invalide">("chargement");
  const [erreur, setErreur] = useState("");
  const [invitation, setInvitation] = useState<{ nom: string; role: string; boutique: string } | null>(null);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [termine, setTermine] = useState(false);

  useEffect(() => {
    fetch(`/api/equipe/accepter?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setErreur(d.error || "Invitation invalide"); setStatut("invalide"); return; }
        setInvitation(d);
        setStatut("valide");
      })
      .catch(() => { setErreur("Erreur de connexion"); setStatut("invalide"); });
  }, [token]);

  async function accepter(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setErreur("Mot de passe : 6 caractères minimum"); return; }
    setEnvoi(true);
    setErreur("");
    try {
      const res = await fetch("/api/equipe/accepter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setTermine(true);
      setTimeout(() => router.push("/connexion"), 2000);
    } catch (err: any) {
      setErreur(err.message || "Erreur lors de la création du compte");
    } finally {
      setEnvoi(false);
    }
  }

  const inputCls =
    "w-full bg-white border border-[#E5E5E5] rounded-xl px-4 py-3.5 text-[#111111] text-sm " +
    "placeholder:text-[#999999] focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/15 focus:outline-none transition-all";

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: "#ffffff", fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <div className="absolute top-8 left-1/2 -translate-x-1/2">
        <Link href="/"><img src="/logo.png" alt="axso" style={{ height: "30px", width: "auto", objectFit: "contain" }} /></Link>
      </div>

      <div className="w-full max-w-md pt-16">
        <div className="rounded-3xl p-8 border" style={{ background: "#ffffff", borderColor: "rgba(245,166,35,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(245,166,35,0.06)" }}>

          {statut === "chargement" && (
            <div className="py-10 text-center text-[#808080] text-sm flex flex-col items-center gap-3">
              <Loader2 size={20} className="animate-spin" style={{ color: ACCENT }} />
              Vérification de l'invitation...
            </div>
          )}

          {statut === "invalide" && (
            <div className="py-6 text-center">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4 mx-auto" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <XCircle size={18} className="text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-[#111111] mb-1.5">Invitation invalide</h2>
              <p className="text-[#808080] text-sm">{erreur}</p>
            </div>
          )}

          {statut === "valide" && invitation && !termine && (
            <>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)" }}>
                <UserPlus size={18} style={{ color: ACCENT }} />
              </div>
              <h2 className="text-2xl font-bold text-[#111111] mb-1">Rejoindre {invitation.boutique}</h2>
              <p className="text-[#808080] text-sm mb-7">
                Bonjour {invitation.nom}, tu es invité·e avec le rôle <strong>{ROLE_LABELS[invitation.role] ?? invitation.role}</strong>.
                Choisis un mot de passe pour créer ton compte.
              </p>

              {erreur && (
                <div className="rounded-xl p-3 text-sm text-center mb-5" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                  {erreur}
                </div>
              )}

              <form onSubmit={accepter} className="space-y-4">
                <div>
                  <label className="block text-[#595959] text-sm font-medium mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" className={inputCls + " pr-10"} minLength={6} required />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#444444] transition-colors">
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={envoi}
                  className="w-full font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, color: "#080808", boxShadow: "0 8px 30px rgba(245,166,35,0.35)" }}>
                  {envoi ? <><Loader2 size={16} className="animate-spin" /> Création du compte...</> : "Créer mon compte →"}
                </button>
              </form>
            </>
          )}

          {termine && (
            <div className="py-6 text-center">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4 mx-auto" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <CheckCircle2 size={18} className="text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-[#111111] mb-1.5">Compte créé !</h2>
              <p className="text-[#808080] text-sm">Redirection vers la connexion...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
