"use client";
// Lecteur de codes-barres par la caméra, en CONTINU — décodeur commun au poste
// de caisse (BoutonScanner) et au téléphone (app/scanner).
//
// Props :
// - actif        : la caméra tourne tant que c'est vrai ; elle est libérée dès que ça ne l'est plus.
// - onCode(code) : appelé à chaque lecture retenue (après anti-rebond).
// - antiRebondMs : un même code resté devant l'objectif n'est relu qu'après ce délai (1 500 ms).
//                  Deux codes différents passent sans attendre.
// - muet         : coupe le bip et la vibration (l'appelant fait son propre retour).
// - className    : classes du cadre (hauteur, arrondi).
//
// Décodage par @zxing/browser (JS pur) plutôt que BarcodeDetector : même
// comportement sur tous les téléphones, sans modèle à télécharger.
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/I18nProvider";

/** Bip court (Web Audio, aucun fichier) et vibration. `echec` : deux notes graves et une vibration double. */
export function retourScan(echec = false) {
  try {
    navigator.vibrate?.(echec ? [80, 60, 80] : 60);
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = echec ? 300 : 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); void ctx.close(); }, echec ? 260 : 120);
  } catch {
    /* pas de son plutôt qu'un scan planté */
  }
}

export function LecteurCamera({ actif, onCode, antiRebondMs = 1500, muet, className }: {
  actif: boolean; onCode: (code: string) => void; antiRebondMs?: number; muet?: boolean; className?: string;
}) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [etat, setEtat] = useState<"ouverture" | "pret" | "erreur">("ouverture");
  const [erreur, setErreur] = useState("");
  // Dernières valeurs des props lues par le décodeur, sans relancer la caméra à chaque rendu.
  const reglages = useRef({ onCode, antiRebondMs, muet });
  useEffect(() => { reglages.current = { onCode, antiRebondMs, muet }; });

  useEffect(() => {
    if (!actif) return;
    let annule = false;
    let flux: MediaStream | null = null;
    let controles: { stop: () => void } | null = null;
    let dernier: { code: string; ts: number } | null = null;
    setEtat("ouverture");

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw Object.assign(new Error(), { name: window.isSecureContext ? "NotFoundError" : "InsecureContext" });
        }
        // Résolution bridée : zxing décode chaque image en JavaScript, 1280×720 suffit et va bien plus vite.
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        const video = videoRef.current;
        if (annule || !video) { flux.getTracks().forEach((p) => p.stop()); return; }
        video.srcObject = flux;
        await video.play().catch(() => {});
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        // Seuls les formats du commerce : tester toutes les symbologies ralentit chaque image.
        const indices = new Map();
        indices.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.QR_CODE,
        ]);
        if (annule) return;
        const c = await new BrowserMultiFormatReader(indices).decodeFromVideoElement(video, (resultat) => {
          const code = resultat?.getText()?.trim();
          if (!code) return;
          const maintenant = Date.now();
          if (dernier && dernier.code === code && maintenant - dernier.ts < reglages.current.antiRebondMs) return;
          dernier = { code, ts: maintenant };
          if (!reglages.current.muet) retourScan();
          reglages.current.onCode(code);
        });
        if (annule) c.stop(); else { controles = c; setEtat("pret"); }
      } catch (e) {
        if (annule) return;
        const nom = (e as { name?: string })?.name;
        setErreur(
          nom === "NotAllowedError" ? "Accès à la caméra refusé. Autorisez la caméra pour ce site dans les réglages du navigateur, puis réessayez."
          : nom === "InsecureContext" ? "La caméra n'est disponible que sur une adresse sécurisée (https)."
          : nom === "NotFoundError" || nom === "OverconstrainedError" ? "Aucune caméra n'a été trouvée sur cet appareil."
          : nom === "NotReadableError" ? "La caméra est déjà utilisée par une autre application. Fermez-la, puis réessayez."
          : "Impossible d'ouvrir la caméra.");
        setEtat("erreur");
      }
    })();

    return () => {
      annule = true;
      controles?.stop();
      flux?.getTracks().forEach((p) => p.stop());
    };
  }, [actif]);

  if (!actif) return null;
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-black", className)}>
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay aria-label={t("Image de la caméra")} />
      {etat === "ouverture" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" role="status">
          <Loader2 size={26} className="animate-spin text-[#F5A623] motion-reduce:animate-none" aria-hidden />
          <p className="text-[12px] text-white/60">{t("Ouverture de la caméra…")}</p>
        </div>
      )}
      {etat === "erreur" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
          <Camera size={26} className="text-white/40" aria-hidden />
          <p className="text-[13px] leading-relaxed text-white/80">{t(erreur)}</p>
        </div>
      )}
      {etat === "pret" && (
        // Viseur : un simple cadre, le reste de l'image est assombri.
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <div className="h-[38%] w-[82%] rounded-xl border-2 border-[#F5A623]" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }} />
        </div>
      )}
    </div>
  );
}
