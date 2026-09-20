"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AbonnementOverlay } from "@/components/dashboard/AbonnementOverlay";
import type { Palier } from "@/lib/plans";

interface AbonnementOverlayCtx {
  openAbonnement: (palierRequis?: Palier) => void;
  closeAbonnement: () => void;
}

const Ctx = createContext<AbonnementOverlayCtx | null>(null);

export function useAbonnementOverlay(): AbonnementOverlayCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Hors provider (ex: pages hors dashboard) — no-op silencieux plutôt que
    // de planter un composant partagé qui peut être rendu ailleurs.
    return { openAbonnement: () => {}, closeAbonnement: () => {} };
  }
  return ctx;
}

export function AbonnementOverlayProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [palierRequis, setPalierRequis] = useState<Palier | undefined>(undefined);

  const openAbonnement = useCallback((p?: Palier) => {
    setPalierRequis(p);
    setOpen(true);
  }, []);
  const closeAbonnement = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={{ openAbonnement, closeAbonnement }}>
      {children}
      {open && <AbonnementOverlay palierRequis={palierRequis} onClose={closeAbonnement} />}
    </Ctx.Provider>
  );
}
