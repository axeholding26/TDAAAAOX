"use client";
// Modale et tiroir de la caisse, bâtis sur <dialog> natif : piège à focus,
// touche Échap, fond inerte et retour du focus à l'élément d'origine sont
// fournis par le navigateur — rien à réimplémenter.
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/I18nProvider";
import { BoutonIcone } from "./Bouton";
import { POLICE } from "./tokens";

type SurfaceProps = {
  ouverte: boolean;
  /** Demande de fermeture : croix, Échap, clic sur le fond. */
  onFermer: () => void;
  titre: string;
  description?: string;
  children: React.ReactNode;
  /** Pied fixe : boutons d'action (Annuler / Valider). */
  actions?: React.ReactNode;
  /** Interdit la fermeture par Échap ou clic extérieur (opération en cours, choix obligatoire). */
  verrouillee?: boolean;
};

function Dialogue({ ouverte, onFermer, titre, description, children, actions, verrouillee, className }: SurfaceProps & { className: string }) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouverte && !d.open) d.showModal();
    else if (!ouverte && d.open) d.close();
  }, [ouverte]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-titre`}
      aria-describedby={description ? `${id}-description` : undefined}
      // Échap : le navigateur fermerait seul ; on passe par onFermer pour que l'état React reste la vérité.
      onCancel={(e) => { e.preventDefault(); if (!verrouillee) onFermer(); }}
      // Clic sur le fond (la cible est alors le <dialog> lui-même, pas son contenu).
      onClick={(e) => { if (e.target === ref.current && !verrouillee) onFermer(); }}
      className={cn("bg-transparent p-0 text-[#111111] backdrop:bg-black/50 backdrop:backdrop-blur-[1px] open:flex", className)}
      style={POLICE}
    >
      {ouverte && (
        <div className="flex max-h-full w-full flex-col overflow-hidden bg-white shadow-2xl">
          <header className="flex items-start gap-3 border-b border-[#F0F0F0] px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id={`${id}-titre`} className="text-[16px] font-bold leading-tight">{t(titre)}</h2>
              {description && <p id={`${id}-description`} className="mt-1 text-[12.5px] leading-relaxed text-[#666666]">{t(description)}</p>}
            </div>
            {!verrouillee && <BoutonIcone label={t("Fermer")} onClick={onFermer} variante="secondaire" className="-mr-1 -mt-1 border-transparent"><X size={18} aria-hidden /></BoutonIcone>}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {actions && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[#F0F0F0] bg-[#FAFAFA] px-5 py-3">{actions}</footer>}
        </div>
      )}
    </dialog>
  );
}

const LARGEURS = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" } as const;

/** Fenêtre centrée (plein écran bas sur mobile). Pour une décision ou une saisie courte : paiement, remise, confirmation. */
export function Modale({ taille = "md", ...props }: SurfaceProps & { taille?: keyof typeof LARGEURS }) {
  return (
    <Dialogue {...props} className={cn(
      "m-0 mt-auto max-h-[92dvh] w-full max-w-full [&>div]:rounded-t-2xl",
      "sm:m-auto sm:max-h-[86dvh] sm:[&>div]:rounded-2xl", LARGEURS[taille],
    )} />
  );
}

/** Panneau latéral droit, sur toute la hauteur. Pour un détail qui garde l'écran derrière lui : fiche article, client, panier suspendu. */
export function Tiroir({ largeur = "md", ...props }: SurfaceProps & { largeur?: "md" | "lg" }) {
  return (
    <Dialogue {...props} className={cn(
      "m-0 ml-auto h-dvh max-h-dvh w-full max-w-full",
      largeur === "lg" ? "sm:max-w-2xl" : "sm:max-w-md",
    )} />
  );
}
