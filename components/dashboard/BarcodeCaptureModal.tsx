"use client";
import { useEffect, useRef, useState } from "react";
import { X, Loader2, Camera } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Appelé une seule fois avec la valeur décodée — le modal se ferme immédiatement après (contrairement au scanner de caisse qui reste ouvert pour un scan continu). */
  onDetect: (code: string) => void;
}

/** Bip court ~880Hz via Web Audio API — pas de fichier audio nécessaire. */
function jouerBip() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, 120);
  } catch { /* Web Audio indisponible — pas de bip plutôt que planter le scan */ }
}

/**
 * Capture caméra en un seul coup — utilisé pour remplir un champ (ex: le
 * code-barres d'une fiche produit) plutôt que pour ajouter au panier. Même
 * moteur de décodage que components/dashboard/logistique/BarcodeScanner.tsx
 * (@zxing/browser, formats restreints, résolution bridée pour la vitesse),
 * mais se referme dès la première détection au lieu de rester ouvert en boucle.
 */
export function BarcodeCaptureModal({ open, onClose, onDetect }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const detecte = useRef(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    if (!open) return;
    let annule = false;
    detecte.current = false;

    async function demarrer() {
      setErreur(null);
      setPret(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // Résolution bridée : décode plus vite en JS pur sans perdre en
          // netteté utile pour un code-barres (voir BarcodeScanner.tsx).
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (annule) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});
        setPret(true);

        // @zxing/browser toujours — voir le commentaire équivalent dans
        // components/dashboard/logistique/BarcodeScanner.tsx : le
        // BarcodeDetector natif dépend d'un modèle ML Kit téléchargé en
        // arrière-plan par Google Play Services sur Android, silencieusement
        // non fonctionnel tant qu'il n'est pas prêt (caméra visible, aucune
        // détection). zxing décode lui-même chaque frame, sans dépendance.
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        // Restreindre les formats testés = décodage nettement plus rapide
        // (zxing essaie sinon toutes les symbologies sur chaque image).
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.QR_CODE,
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        if (annule || !videoRef.current) return;
        const controls = await reader.decodeFromVideoElement(videoRef.current, (result) => {
          if (result && !detecte.current) traiterCode(result.getText());
        });
        zxingControlsRef.current = controls;
      } catch (e: any) {
        setErreur(
          e?.name === "NotAllowedError"
            ? "Accès à la caméra refusé — autorisez la caméra dans les réglages du navigateur."
            : "Impossible d'accéder à la caméra."
        );
      }
    }

    function traiterCode(code: string) {
      const propre = code?.trim();
      if (!propre || detecte.current) return;
      detecte.current = true;
      navigator.vibrate?.(60);
      jouerBip();
      onDetect(propre);
      onClose();
    }

    demarrer();

    return () => {
      annule = true;
      zxingControlsRef.current?.stop();
      zxingControlsRef.current = null;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(6,10,20,0.85)", backdropFilter: "blur(6px)", animation: "axsFadeIn 0.25s ease" }}
    >
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg,#1a1a1a 0%,#111111 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,166,35,0.08)",
          fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif",
          animation: "axsPopIn 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <span className="text-white font-bold text-[14px]">Scanner le code-barres</span>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10">
            <X size={14} className="text-white/60" />
          </button>
        </div>

        <div className="relative mx-5 rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: "3/4" }}>
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />

          {!pret && !erreur && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Loader2 size={26} className="animate-spin" style={{ color: "#F5A623" }} />
              <p className="text-white/50 text-[12px]">Ouverture de la caméra…</p>
            </div>
          )}

          {erreur && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <Camera size={26} className="text-white/30" />
              <p className="text-white/60 text-[12px]">{erreur}</p>
            </div>
          )}

          {pret && !erreur && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-[80%] h-[36%]" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)" }}>
                {/* Coins viseur — style scanner premium */}
                {[
                  { top: -2, left: -2, borderWidth: "3px 0 0 3px", borderRadius: "14px 0 0 0" },
                  { top: -2, right: -2, borderWidth: "3px 3px 0 0", borderRadius: "0 14px 0 0" },
                  { bottom: -2, left: -2, borderWidth: "0 0 3px 3px", borderRadius: "0 0 0 14px" },
                  { bottom: -2, right: -2, borderWidth: "0 3px 3px 0", borderRadius: "0 0 14px 0" },
                ].map((c, i) => (
                  <div key={i} className="absolute w-7 h-7" style={{ ...c, borderStyle: "solid", borderColor: "#F5A623" }} />
                ))}
                {/* Ligne de scan animée */}
                <div className="absolute left-0 right-0 h-[2px] rounded-full" style={{
                  background: "linear-gradient(90deg, transparent, #F5A623 25%, #F5A623 75%, transparent)",
                  boxShadow: "0 0 10px 1px rgba(245,166,35,0.7)",
                  animation: "axsScanLine 1.8s ease-in-out infinite",
                }} />
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-white/40 text-[11.5px] px-6 pt-3 pb-5 leading-relaxed">
          Placez le code-barres du produit dans le cadre — le champ se remplit automatiquement dès qu'il est reconnu.
        </p>
      </div>

      <style>{`
        @keyframes axsFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes axsPopIn { from { opacity:0; transform:scale(0.94) translateY(10px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes axsScanLine { 0% { top: 4%; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { top: 92%; opacity: 0; } }
      `}</style>
    </div>
  );
}
