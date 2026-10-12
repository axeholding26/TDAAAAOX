"use client";
// Scanner USB ou Bluetooth en « émulation clavier » (HID) : la douchette tape
// le code très vite puis Entrée. Ce composant invisible reconnaît cette rafale
// et l'émet sur le bus de scans (surScan), source « clavier ».
//
//   <CapteurClavier contexte="vente" />
//
// Props :
// - contexte      : contexte donné au scan (défaut "vente").
// - actif         : false = n'écoute pas (défaut true). À couper quand une modale de saisie est ouverte.
// - longueurMin   : nombre de caractères minimal d'un code (défaut 4).
// - delaiMaxMs    : écart maximal entre deux touches d'une douchette (défaut 50 ms). Une personne tape
//                   plus lentement ; à augmenter pour une douchette Bluetooth lente.
// - dansLesChamps : true = capter aussi quand le curseur est dans un champ de saisie (défaut false :
//                   le champ garde sa frappe et gère lui-même Entrée, comme la barre de recherche de la caisse).
// - tracer        : false = ne pas tracer le scan côté serveur (défaut true).
// - caisseId      : caisse de travail, pour la trace.
// - onScan(scan)  : appelé après l'émission.
//
// Une douchette n'a pas d'identité propre : l'appareil du scan est le poste.
import { useEffect, useRef } from "react";
import type { ScanEmis } from "@/lib/pos/client/bus";
import type { ContexteScan } from "@/lib/pos/types";
import { emettreLocal } from "./source";

export default function CapteurClavier({ contexte = "vente", actif = true, longueurMin = 4, delaiMaxMs = 50, dansLesChamps = false, tracer, caisseId, onScan }: {
  contexte?: ContexteScan; actif?: boolean; longueurMin?: number; delaiMaxMs?: number; dansLesChamps?: boolean;
  tracer?: boolean; caisseId?: string | null; onScan?: (scan: ScanEmis) => void;
}) {
  const reglages = useRef({ contexte, longueurMin, delaiMaxMs, dansLesChamps, tracer, caisseId, onScan });
  useEffect(() => { reglages.current = { contexte, longueurMin, delaiMaxMs, dansLesChamps, tracer, caisseId, onScan }; });

  useEffect(() => {
    if (!actif) return;
    let tampon = "";
    let derniere = 0;
    const surTouche = (e: KeyboardEvent) => {
      const r = reglages.current;
      if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
      const cible = e.target as HTMLElement | null;
      if (!r.dansLesChamps && cible?.closest?.("input, textarea, select, [contenteditable='true']")) { tampon = ""; return; }
      const maintenant = performance.now();
      // Une pause trop longue : ce n'était pas une douchette, on repart de zéro.
      if (tampon && maintenant - derniere > r.delaiMaxMs) tampon = "";
      derniere = maintenant;
      if (e.key === "Enter") {
        const code = tampon;
        tampon = "";
        if (code.length < r.longueurMin) return;
        // La rafale était un scan : Entrée ne doit pas valider le bouton qui a le focus.
        e.preventDefault();
        e.stopPropagation();
        r.onScan?.(emettreLocal(code, "clavier", { contexte: r.contexte, tracer: r.tracer, caisseId: r.caisseId }));
      } else if (e.key.length === 1) {
        tampon += e.key;
      }
    };
    window.addEventListener("keydown", surTouche, true);
    return () => window.removeEventListener("keydown", surTouche, true);
  }, [actif]);

  return null;
}
