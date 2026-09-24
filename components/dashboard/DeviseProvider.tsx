"use client";
// Devise de la boutique active, fournie une fois par le layout du dashboard
// (tenant.devise, elle-même dérivée du pays) — aucune page ne code sa devise en dur.
import { createContext, useContext } from "react";
import { formatMontant } from "@/lib/utils";

const DeviseContext = createContext("XAF");

export function DeviseProvider({ devise, children }: { devise: string; children: React.ReactNode }) {
  return <DeviseContext.Provider value={devise}>{children}</DeviseContext.Provider>;
}

export function useDevise() {
  const devise = useContext(DeviseContext);
  return { devise, fmt: (montant: number) => formatMontant(montant, devise) };
}
