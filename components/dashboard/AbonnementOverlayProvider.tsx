"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AbonnementOverlay } from "@/components/dashboard/AbonnementOverlay";
import type { Palier } from "@/lib/plans";

interface AbonnementOverlayCtx {
  // `message` : pourquoi l'overlay s'ouvre (ex. « AXIA est disponible à partir du Palier Pro »).
  openAbonnement: (palierRequis?: Palier, message?: string) => void;
  closeAbonnement: () => void;
  palier: Palier; // palier actif de la boutique
}

const Ctx = createContext<AbonnementOverlayCtx | null>(null);

export function useAbonnementOverlay(): AbonnementOverlayCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Hors provider (ex: pages hors dashboard) — no-op silencieux plutôt que
    // de planter un composant partagé qui peut être rendu ailleurs.
    return { openAbonnement: () => {}, closeAbonnement: () => {}, palier: "palier0" };
  }
  return ctx;
}

export function AbonnementOverlayProvider({ children, palier = "palier0" }: { children: React.ReactNode; palier?: Palier }) {
  const [open, setOpen] = useState(false);
  const [palierRequis, setPalierRequis] = useState<Palier | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);

  const openAbonnement = useCallback((p?: Palier, m?: string) => {
    setPalierRequis(p);
    setMessage(m);
    setOpen(true);
  }, []);
  const closeAbonnement = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={{ openAbonnement, closeAbonnement, palier }}>
      {children}
      {open && <AbonnementOverlay palierRequis={palierRequis} message={message} onClose={closeAbonnement} />}
    </Ctx.Provider>
  );
}
