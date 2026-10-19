"use client";
import { useState } from "react";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { BoutonRenvoyerCode } from "@/components/auth/BoutonRenvoyerCode";

const ACCENT = "#F5A623";
const ACCENT_DARK = "#d4880d";

// Carte « Vérifie ton email » : saisie du code à 6 chiffres reçu par email.
// Utilisée après la connexion et après l'inscription. onValider renvoie un
// message d'erreur, ou null si le code est bon.
export function EcranCode({ email, titre, onValider, onRenvoyer, onRetour, erreurInitiale = "" }: {
  email: string;
  titre?: string;
  onValider: (code: string) => Promise<string | null>;
  onRenvoyer: () => Promise<void>;
  onRetour?: () => void;
  erreurInitiale?: string;
}) {
  const t = useT();
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState(erreurInitiale);
  const [verif, setVerif] = useState(false);

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 6) return;
    setErreur("");
    setVerif(true);
    try {
      const err = await onValider(code);
      if (err) setErreur(err);
    } finally {
      setVerif(false);
    }
  }

  return (
    <div className="rounded-3xl p-8 border"
      style={{ background: "#ffffff", borderColor: "rgba(245,166,35,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(245,166,35,0.06)" }}>
      {onRetour && (
        <button onClick={onRetour}
          className="flex items-center gap-1.5 text-xs mb-4 hover:opacity-80 transition-opacity" style={{ color: "#808080" }}>
          <ArrowLeft size={13} />{" "}{t("Retour")}
        </button>
      )}

      <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)" }}>
        <Mail size={18} style={{ color: ACCENT }} />
      </div>
      <h2 className="text-2xl font-bold text-[#111111] mb-1">{t(titre || "Vérifie ton email")}</h2>
      <p className="text-[#808080] text-sm mb-7 [overflow-wrap:anywhere]">{t("Code envoyé à")}{" "}<strong>{email}</strong>{" "}{t("— valable 10 minutes.")}</p>

      {erreur && (
        <div className="rounded-xl p-3 text-sm text-center mb-5"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
          {t(erreur)}
        </div>
      )}

      <form onSubmit={valider} className="space-y-4">
        <input
          type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
          aria-label={t("Code de vérification à 6 chiffres")}
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          className="w-full bg-white border border-[#E5E5E5] rounded-xl px-4 py-3.5 text-[#111111] placeholder:text-[#999999] focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/15 focus:outline-none transition-all text-center text-2xl tracking-[0.5em] font-bold"
        />
        <button type="submit" disabled={verif || code.length < 6}
          className="w-full font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, color: "#080808", boxShadow: `0 8px 30px rgba(245,166,35,0.35)` }}>
          {verif ? <><Loader2 size={16} className="animate-spin" />{" "}{t("Vérification...")}</> : t("Confirmer →")}
        </button>
        <BoutonRenvoyerCode onRenvoyer={async () => { await onRenvoyer(); setCode(""); setErreur(""); }} />
      </form>
    </div>
  );
}
