"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, ShieldCheck, ArrowLeft, Mail, KeyRound } from "lucide-react";

const ACCENT = "#F5A623";
const ACCENT_DARK = "#d4880d";

export default function MotDePasseOubliePage() {
  const router = useRouter();
  const [etape, setEtape] = useState<"email" | "code" | "succes">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");

  const inputCls =
    "w-full bg-white border border-[#E5E5E5] rounded-xl px-4 py-3.5 text-[#111111] text-sm " +
    "placeholder:text-[#999999] focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/15 focus:outline-none transition-all";

  async function demanderCode(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mot-de-passe-oublie/demander", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setEtape("code");
    } catch (e: any) {
      setErreur(e.message ?? "Erreur, réessaie");
    } finally {
      setLoading(false);
    }
  }

  async function reinitialiser(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 6 || nouveauMotDePasse.length < 6) return;
    setErreur("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mot-de-passe-oublie/reinitialiser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, nouveauMotDePasse }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setEtape("succes");
      setTimeout(() => router.push("/connexion"), 2500);
    } catch (e: any) {
      setErreur(e.message ?? "Erreur, réessaie");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: "#ffffff", fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.08) 0%, transparent 70%)" }} />
      </div>

      <div className="w-full max-w-md relative">
        <Link href="/" className="flex justify-center mb-8">
          <img src="/logo.png" alt="axso" style={{ height: "30px", width: "auto", objectFit: "contain" }} />
        </Link>

        <div
          className="rounded-3xl p-8 border"
          style={{ background: "#ffffff", borderColor: "rgba(245,166,35,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(245,166,35,0.06)" }}
        >
          <Link href="/connexion" className="flex items-center gap-1.5 text-xs mb-4 hover:opacity-80 transition-opacity" style={{ color: "#808080" }}>
            <ArrowLeft size={13} /> Retour à la connexion
          </Link>

          {erreur && (
            <div className="rounded-xl p-3 text-sm text-center mb-5"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
              {erreur}
            </div>
          )}

          {etape === "email" && (
            <>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)" }}>
                <Mail size={18} style={{ color: ACCENT }} />
              </div>
              <h2 className="text-2xl font-bold text-[#111111] mb-1">Mot de passe oublié</h2>
              <p className="text-[#808080] text-sm mb-7">On t'envoie un code de vérification par email.</p>
              <form onSubmit={demanderCode} className="space-y-4">
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="aminata@example.com" className={inputCls} />
                <button type="submit" disabled={loading}
                  className="w-full font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, color: "#080808", boxShadow: `0 8px 30px rgba(245,166,35,0.35)` }}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Envoi...</> : "Envoyer le code →"}
                </button>
              </form>
            </>
          )}

          {etape === "code" && (
            <>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)" }}>
                <KeyRound size={18} style={{ color: ACCENT }} />
              </div>
              <h2 className="text-2xl font-bold text-[#111111] mb-1">Nouveau mot de passe</h2>
              <p className="text-[#808080] text-sm mb-7">Code envoyé à <strong>{email}</strong> — valable 10 minutes.</p>
              <form onSubmit={reinitialiser} className="space-y-4">
                <input
                  type="text" inputMode="numeric" maxLength={6} autoFocus
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className={inputCls + " text-center text-2xl tracking-[0.5em] font-bold"}
                />
                <div className="relative">
                  <input type={showPass ? "text" : "password"} required value={nouveauMotDePasse}
                    onChange={e => setNouveauMotDePasse(e.target.value)}
                    placeholder="Nouveau mot de passe" className={inputCls + " pr-10"} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#444444] transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button type="submit" disabled={loading || code.length < 6 || nouveauMotDePasse.length < 6}
                  className="w-full font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, color: "#080808", boxShadow: `0 8px 30px rgba(245,166,35,0.35)` }}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Réinitialisation...</> : "Réinitialiser →"}
                </button>
              </form>
            </>
          )}

          {etape === "succes" && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <ShieldCheck size={24} style={{ color: "#22c55e" }} />
              </div>
              <h2 className="text-xl font-bold text-[#111111] mb-1">Mot de passe mis à jour</h2>
              <p className="text-[#808080] text-sm">Redirection vers la connexion...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
