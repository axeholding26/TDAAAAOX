"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, ArrowRight, ArrowLeft, Check, Crown, LayoutDashboard } from "lucide-react";

export interface TutorialStep {
  Icon: any;
  titre: string;
  description: string;
}

interface Props {
  /** Identifiant unique et stable du module — nom d'événement pour la réouverture manuelle (bouton "?"). */
  moduleKey: string;
  titre: string;
  sousTitre?: string;
  steps: TutorialStep[];
  /**
   * Étape spéciale "palier" — affichée en dernière position quand le
   * marchand n'a pas le palier requis, avec un CTA dédié (ex: renvoyer vers
   * "Tableau de bord" pour AXIA en palier Essentiel). N'affecte que le
   * contenu du tutoriel, ne bloque jamais l'accès au module lui-même.
   */
  offrePalier?: { label: string; href: string };
  /**
   * true UNIQUEMENT pour le tutoriel d'accueil combiné (un seul par
   * boutique, à la première connexion) — tous les tutoriels par module
   * restent purement à la demande (bouton "?"), jamais auto-affichés, pour
   * éviter la fenêtre récurrente à chaque nouveau module visité.
   */
  autoOpen?: boolean;
  /** Clé de persistance localStorage — par défaut moduleKey, mais peut être surchargée (ex: scoper par tenantId pour le tutoriel d'accueil). */
  storageKey?: string;
}

function cleVue(key: string) { return `axso-tutoriel-vu:${key}`; }

// Fenêtre tutoriel "gaming" — rendue via portail (document.body) pour ne
// jamais dépendre du positionnement d'un ancêtre : une page dont le wrapper
// a une animation CSS avec transform (.ax-page-enter, présent sur TOUTES les
// pages du dashboard) devient le containing block d'un position:fixed et
// pousse la fenêtre bien en dessous du pli visible sur une page longue —
// même bug déjà corrigé une fois pour PCOnlyGate.
// Auto-affichage réservé au tutoriel d'accueil combiné (autoOpen=true, un
// seul par boutique) ; tous les autres restent silencieux et ne s'ouvrent
// que via le bouton "?" (BoutonRevoirTutoriel) — voir les props ci-dessus.
export function ModuleTutorial({ moduleKey, titre, sousTitre, steps, offrePalier, autoOpen, storageKey }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [step, setStep] = useState(0);
  const [monte, setMonte] = useState(false);
  const totalSteps = steps.length + (offrePalier ? 1 : 0);
  const surEtapePalier = offrePalier && step === steps.length;
  const key = storageKey ?? moduleKey;

  useEffect(() => { setMonte(true); }, []);

  useEffect(() => {
    if (!autoOpen) return;
    try {
      if (!window.localStorage.getItem(cleVue(key))) {
        const t = setTimeout(() => setOuvert(true), 450);
        return () => clearTimeout(t);
      }
    } catch { /* localStorage indisponible — pas de tutoriel plutôt que planter */ }
  }, [autoOpen, key]);

  useEffect(() => {
    const handler = (e: Event) => { if ((e as CustomEvent).detail === moduleKey) { setStep(0); setOuvert(true); } };
    window.addEventListener("axso:ouvrir-tutoriel", handler as EventListener);
    return () => window.removeEventListener("axso:ouvrir-tutoriel", handler as EventListener);
  }, [moduleKey]);

  function fermer() {
    setOuvert(false);
    try { window.localStorage.setItem(cleVue(key), "1"); } catch {}
  }

  if (!ouvert || !monte) return null;

  const s = !surEtapePalier ? steps[step] : null;

  return createPortal((
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(6,10,20,0.72)", backdropFilter: "blur(6px)", animation: "axtFadeIn 0.3s ease" }}>
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg,#1a1a1a 0%,#111111 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,166,35,0.08)",
          animation: "axtPopIn 0.45s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
        <button onClick={fermer} className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors hover:bg-white/10">
          <X size={14} className="text-white/50" />
        </button>

        <div className="px-7 pt-8 pb-2 text-center">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: "#F5A623" }}>{titre}</p>
          {sousTitre && <p className="text-white/35 text-[11.5px]">{sousTitre}</p>}
        </div>

        <div className="px-7 py-6 min-h-[220px] flex flex-col items-center justify-center text-center">
          {surEtapePalier ? (
            <>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "linear-gradient(135deg,#F5A623,#D4911A)", boxShadow: "0 8px 30px rgba(245,166,35,0.4)" }}>
                <Crown size={26} className="text-white" />
              </div>
              <h3 className="text-white font-bold text-[16px] mb-2">Fonctionnalité Pro</h3>
              <p className="text-white/55 text-[13px] leading-relaxed mb-5">
                L'interface AXIA en plein écran, dès la connexion, fait partie du palier <strong className="text-[#F5A623]">Pro</strong>.
                En attendant, retrouve toutes tes ventes, produits et statistiques depuis le tableau de bord classique.
              </p>
              <Link href={offrePalier!.href} onClick={fermer}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-[13px] transition-all hover:scale-105"
                style={{ background: "#F5A623", color: "#111111" }}>
                <LayoutDashboard size={14} /> {offrePalier!.label}
              </Link>
            </>
          ) : s && (
            <>
              <div key={step} className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)", animation: "axtStepIn 0.35s cubic-bezier(0.34,1.56,0.64,1)" }}>
                <s.Icon size={24} style={{ color: "#F5A623" }} />
              </div>
              <h3 className="text-white font-bold text-[16px] mb-2">{s.titre}</h3>
              <p className="text-white/55 text-[13px] leading-relaxed">{s.description}</p>
            </>
          )}
        </div>

        {/* Progression */}
        <div className="flex items-center justify-center gap-1.5 pb-5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === step ? 20 : 6, background: i <= step ? "#F5A623" : "rgba(255,255,255,0.15)" }} />
          ))}
        </div>

        <div className="flex items-center justify-between px-7 pb-7 gap-3">
          <button onClick={fermer} className="text-[12px] font-semibold text-white/35 hover:text-white/60 transition-colors">
            Passer
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
                <ArrowLeft size={14} className="text-white/60" />
              </button>
            )}
            {step < totalSteps - 1 ? (
              <button onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-[12.5px] transition-all hover:opacity-90"
                style={{ background: "#F5A623", color: "#111111" }}>
                Suivant <ArrowRight size={13} />
              </button>
            ) : (
              <button onClick={fermer}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-[12.5px] transition-all hover:opacity-90"
                style={{ background: "#F5A623", color: "#111111" }}>
                <Check size={13} /> Compris
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes axtFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes axtPopIn { from { opacity:0; transform:scale(0.92) translateY(12px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes axtStepIn { from { opacity:0; transform:scale(0.7) rotate(-8deg) } to { opacity:1; transform:scale(1) rotate(0) } }
      `}</style>
    </div>
  ), document.body);
}

/** Bouton "?" compact à poser à côté du titre d'une page pour rouvrir son tutoriel à la demande. */
export function BoutonRevoirTutoriel({ moduleKey, dark }: { moduleKey: string; dark?: boolean }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("axso:ouvrir-tutoriel", { detail: moduleKey }))}
      title="Revoir le tutoriel"
      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors flex-shrink-0"
      style={dark
        ? { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.12)" }
        : { background: "rgba(245,166,35,0.1)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.2)" }}
    >
      ?
    </button>
  );
}
