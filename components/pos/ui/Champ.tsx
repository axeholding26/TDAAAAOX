"use client";
// Champs de saisie de la caisse : libellé relié au champ, aide et erreur
// annoncées aux lecteurs d'écran, hauteur tactile de 44 px.
import { useId } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/I18nProvider";

/** Classe d'un <input>, <select> ou <textarea> du kit (à poser sur un champ natif). */
export const CLASSE_SAISIE =
  "w-full min-h-11 rounded-xl border border-[#E8E8E8] bg-white px-3 py-2 text-[14px] text-[#111111] placeholder:text-[#AAAAAA] outline-none transition-colors focus:border-[#F5A623] focus-visible:ring-2 focus-visible:ring-[#F5A623]/40 disabled:bg-[#F5F5F5] disabled:text-[#AAAAAA] aria-[invalid=true]:border-[#B91C1C]";

export type ChampProps = {
  label: string;
  aide?: string;
  /** Message d'erreur (phrase complète) : colore le champ et est annoncé. */
  erreur?: string | null;
  /** Masque visuellement le libellé (il reste lu par les lecteurs d'écran). */
  labelMasque?: boolean;
  /**
   * Le champ lui-même. Fonction : reçoit les attributs à poser sur l'élément
   * natif (id, aria-describedby, aria-invalid) pour le relier au libellé.
   */
  children: React.ReactNode | ((attributs: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => React.ReactNode);
  className?: string;
};

export function Champ({ label, aide, erreur, labelMasque, children, className }: ChampProps) {
  const t = useT();
  const id = useId();
  const decrit = erreur ? `${id}-erreur` : aide ? `${id}-aide` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className={labelMasque ? "sr-only" : "block text-[11px] font-semibold uppercase tracking-wide text-[#666666]"}>{t(label)}</label>
      <div className={labelMasque ? undefined : "mt-1"}>
        {typeof children === "function" ? children({ id, "aria-describedby": decrit, "aria-invalid": erreur ? true : undefined }) : children}
      </div>
      {erreur
        ? <p id={`${id}-erreur`} role="alert" className="mt-1 text-[12px] leading-snug text-[#B91C1C]">{t(erreur)}</p>
        : aide && <p id={`${id}-aide`} className="mt-1 text-[11px] leading-snug text-[#888888]">{t(aide)}</p>}
    </div>
  );
}

export type SaisieProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & Pick<ChampProps, "label" | "aide" | "erreur" | "labelMasque"> & {
  /** Texte ou icône à droite du champ (devise, unité, « kg »). */
  suffixe?: React.ReactNode;
  className?: string;
  ref?: React.Ref<HTMLInputElement>;
};

/** Champ texte ou numérique complet : libellé + <input> + aide / erreur. */
export function Saisie({ label, aide, erreur, labelMasque, suffixe, className, ref, ...input }: SaisieProps) {
  return (
    <Champ label={label} aide={aide} erreur={erreur} labelMasque={labelMasque} className={className}>
      {(attributs) => (
        <div className="relative">
          <input ref={ref} {...input} {...attributs} className={cn(CLASSE_SAISIE, suffixe ? "pr-14" : undefined)} />
          {suffixe && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] font-semibold text-[#888888]">{suffixe}</span>}
        </div>
      )}
    </Champ>
  );
}
