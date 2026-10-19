"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@/components/I18nProvider";

// « Renvoyer le code » sous un champ de code reçu par email. Attente de 60 s
// entre deux envois (le code vient d'être envoyé à l'affichage) ; le serveur
// limite aussi les demandes (authLimiter).
const ATTENTE_S = 60;

export function BoutonRenvoyerCode({ onRenvoyer }: { onRenvoyer: () => Promise<void> }) {
  const t = useT();
  const [reste, setReste] = useState(ATTENTE_S);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  useEffect(() => {
    if (reste <= 0) return;
    const id = setTimeout(() => setReste((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [reste]);

  async function renvoyer() {
    setEnvoi(true);
    setMessage(null);
    try {
      await onRenvoyer();
      setMessage({ ok: true, texte: t("Nouveau code envoyé ✓") });
      setReste(ATTENTE_S);
    } catch (e: any) {
      setMessage({ ok: false, texte: t(e?.message || "Envoi impossible, réessaie dans un instant") });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="text-center text-sm">
      <span className="text-[#808080]">{t("Pas reçu ?")}</span>{" "}
      <button type="button" onClick={renvoyer} disabled={envoi || reste > 0}
        className="font-semibold text-[#F5A623] hover:opacity-80 disabled:text-[#B3B3B3] disabled:cursor-not-allowed inline-flex items-center gap-1">
        {envoi && <Loader2 size={13} className="animate-spin" />}
        {reste > 0 ? `${t("Renvoyer le code")} (${reste} s)` : t("Renvoyer le code")}
      </button>
      {message && <p className={`text-xs mt-2 ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.texte}</p>}
    </div>
  );
}

// Demande (ou redemande) le code de connexion. Renvoie true si le code est inutile
// (emails non configurés : connexion par mot de passe seul).
export async function demanderCodeConnexion(email: string, password: string): Promise<boolean> {
  const res = await fetch("/api/auth/2fa/demander", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? data.message ?? "Email ou mot de passe incorrect");
  return !!data.skip2fa;
}
