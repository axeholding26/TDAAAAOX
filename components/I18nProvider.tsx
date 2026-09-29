"use client";
import { createContext, useContext, useMemo } from "react";
import { creerT, type Dico, type Langue } from "@/lib/i18n";

const Ctx = createContext<{ langue: Langue; dico: Dico }>({ langue: "fr", dico: {} });

/** Chaque zone (racine, dashboard, admin…) ajoute son dictionnaire à celui du parent. */
export function I18nProvider({ langue, dico, children }: { langue: Langue; dico: Dico; children: React.ReactNode }) {
  const parent = useContext(Ctx);
  const valeur = useMemo(() => ({ langue, dico: { ...parent.dico, ...dico } }), [langue, dico, parent.dico]);
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

/** Fonction de traduction pour les composants client : `const t = useT();` */
export function useT() {
  const { langue, dico } = useContext(Ctx);
  return useMemo(() => creerT(langue, dico), [langue, dico]);
}
