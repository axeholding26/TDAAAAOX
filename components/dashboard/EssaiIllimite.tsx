"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Gift, Loader2, Check, Clock } from "lucide-react";
import { AbonnementOverlay } from "@/components/dashboard/AbonnementOverlay";
import { DUREE_ESSAI_JOURS, tempsRestant } from "@/lib/essai-regles";
import { useT } from "@/components/I18nProvider";

// Essai de 7 jours du plan Illimité (lib/essai.ts), sur toute la plateforme :
// proposition à l'arrivée, compte à rebours pendant l'essai, choix d'un plan à la fin.
// Au-dessus du Constructeur (z-index 9999) : visible partout.

export interface EssaiProps { phase: "disponible" | "en_cours" | "termine"; finLe: string | null; proposer: boolean; montrerFin: boolean }

const AVANTAGES = ["Commandes illimitées (au lieu de 60 par mois)", "Sourcing mondial de produits", "Statistiques avancées et en temps réel", "Plusieurs boutiques sur ton compte"];

async function envoyer(action: "demarrer" | "refuser" | "fin_vue") {
  const res = await fetch("/api/abonnement/essai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Erreur");
}

/** Bouton « Démarrer mon essai » : démarre puis recharge la page (tous les cadenas s'ouvrent). */
export function BoutonEssai({ libelle, onFait }: { libelle?: string; onFait?: () => void }) {
  const t = useT();
  const router = useRouter();
  const [etat, setEtat] = useState<"" | "envoi" | "erreur">("");
  return (
    <button disabled={etat === "envoi"} onClick={async () => {
      setEtat("envoi");
      try { await envoyer("demarrer"); onFait?.(); router.refresh(); } catch { setEtat("erreur"); }
    }} className="h-11 px-5 rounded-xl text-[14px] font-semibold bg-[#F5A623] text-[#111111] hover:bg-[#E8990F] disabled:opacity-60 inline-flex items-center justify-center gap-2">
      {etat === "envoi" ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />}
      {etat === "erreur" ? t("Réessayer") : t(libelle ?? "Démarrer mon essai")}
    </button>
  );
}

/** Temps restant, mis à jour chaque minute ; la page se recharge à la fin (l'essai s'arrête). */
export function useTempsRestant(finLe: string | null) {
  const router = useRouter();
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    if (!finLe) return;
    const id = setInterval(() => {
      const n = new Date();
      setMaintenant(n);
      if (n >= new Date(finLe)) { clearInterval(id); router.refresh(); }
    }, 60_000);
    return () => clearInterval(id);
  }, [finLe, router]);
  if (!finLe) return null;
  const fin = new Date(finLe);
  return { texte: tempsRestant(fin, maintenant), urgent: fin.getTime() - maintenant.getTime() < 48 * 3600 * 1000 };
}

export function EssaiIllimite({ phase, finLe, proposer, montrerFin }: EssaiProps) {
  const t = useT();
  const [proposition, setProposition] = useState(proposer);
  const [fin, setFin] = useState(montrerFin);
  const [plans, setPlans] = useState(false);
  const reste = useTempsRestant(phase === "en_cours" ? finLe : null);
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);
  if (!monte) return null;

  return createPortal(
    <>
      {/* ── Compte à rebours pendant l'essai ── */}
      {reste && !plans && (
        <button onClick={() => setPlans(true)} title={t("Voir les plans")}
          className={`fixed z-[10000] left-1/2 -translate-x-1/2 bottom-24 md:bottom-4 flex items-center gap-2 h-9 pl-3 pr-4 rounded-full text-[13px] font-semibold shadow-lg border ${reste.urgent ? "bg-[#FFF4E5] border-[#F59E0B] text-[#B45309]" : "bg-[#111111] border-[#111111] text-white"}`}>
          <Clock size={15} className={reste.urgent ? "" : "text-[#F5A623]"} />
          {t("Essai Illimité")} · {t("{0} restants", reste.texte)}
        </button>
      )}

      {/* ── Proposition (première arrivée, ou tant qu'il n'a pas répondu) ── */}
      {proposition && (
        <div className="fixed inset-0 z-[10001] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 text-[#111111]" style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
            <div className="w-12 h-12 rounded-xl bg-[#FFF1D6] flex items-center justify-center mb-4"><Gift size={24} className="text-[#C77C0A]" /></div>
            <h2 className="text-[20px] font-bold">{t("{0} jours d'Illimité offerts", String(DUREE_ESSAI_JOURS))}</h2>
            <p className="mt-1.5 text-[14px] text-[#555555]">{t("Essaie gratuitement tout ce qu'offre le plan Illimité. Sans carte, sans engagement : à la fin, tu choisis un plan ou tu continues en Essentiel (gratuit).")}</p>
            <ul className="mt-4 space-y-2">
              {AVANTAGES.map((a) => <li key={a} className="flex items-start gap-2 text-[14px]"><Check size={16} className="mt-0.5 text-[#16A34A] flex-shrink-0" />{t(a)}</li>)}
            </ul>
            <p className="mt-4 text-[12.5px] text-[#888888]">{t("Un seul essai par compte : il démarre dès que tu cliques.")}</p>
            <div className="mt-5 flex flex-col gap-2">
              <BoutonEssai onFait={() => setProposition(false)} />
              <button onClick={() => { setProposition(false); envoyer("refuser").catch(() => {}); }}
                className="h-11 rounded-xl text-[14px] font-medium text-[#555555] hover:bg-[#F5F5F5]">
                {t("Non merci, rester en Essentiel")}
              </button>
            </div>
            <p className="mt-3 text-[12px] text-center text-[#999999]">{t("Tu pourras encore le démarrer plus tard depuis Abonnement.")}</p>
          </div>
        </div>
      )}

      {/* ── Fin de l'essai : choisir un plan, ou rester en Essentiel ── */}
      {(fin || plans) && (
        <AbonnementOverlay
          message={fin ? "Ton essai Illimité est terminé — continue avec Pro ou Illimité" : undefined}
          actionSecondaire={fin ? "Continuer en Essentiel" : undefined}
          onClose={() => { if (fin) envoyer("fin_vue").catch(() => {}); setFin(false); setPlans(false); }}
        />
      )}
    </>,
    document.body,
  );
}
