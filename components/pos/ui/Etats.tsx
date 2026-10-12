"use client";
// États d'écran de la caisse. Chaque fonction du POS doit savoir montrer :
// chargement, vide, erreur, hors ligne, non autorisé, conflit (et en attente).
// Un seul gabarit, pour que ces moments se ressemblent partout — et `EtatPos`
// pour passer directement du `code` d'une erreur de l'API au bon état.
import { AlertTriangle, Ban, Clock, GitMerge, Inbox, Loader2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/I18nProvider";
import { Bouton } from "./Bouton";
import { TONS, type Ton } from "./tokens";

type EtatProps = {
  titre?: string;
  /** Phrase d'explication — pour une erreur de l'API, son message tel quel. */
  texte?: string;
  /** Actions proposées (boutons). */
  children?: React.ReactNode;
  /** Version resserrée, à poser dans une carte ou une colonne. */
  compact?: boolean;
  className?: string;
};

function Gabarit({ icone, ton, titre, texte, children, compact, className, role = "status" }: EtatProps & { icone: React.ReactNode; ton: Ton; role?: "status" | "alert" }) {
  const t = useT();
  return (
    <div role={role} className={cn("flex flex-col items-center rounded-2xl border border-dashed border-[#E8E8E8] bg-white text-center", compact ? "px-4 py-6" : "px-6 py-10 sm:py-12", className)}>
      <span className={cn("flex items-center justify-center rounded-full", compact ? "h-10 w-10" : "h-12 w-12")} style={TONS[ton]} aria-hidden>{icone}</span>
      {titre && <p className="mt-3 text-[14px] font-bold text-[#111111]">{t(titre)}</p>}
      {texte && <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-[#666666]">{t(texte)}</p>}
      {children && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

/** Rien à afficher (liste vide, aucune vente, aucun résultat). */
export function EtatVide({ titre = "Rien à afficher pour l'instant", ...p }: EtatProps) {
  return <Gabarit icone={<Inbox size={20} />} ton="neutre" titre={titre} {...p} />;
}

/** Chargement en cours. `texte` précise ce qui se charge, pour les lecteurs d'écran aussi. */
export function EtatChargement({ texte = "Chargement…", compact, className }: Pick<EtatProps, "texte" | "compact" | "className">) {
  const t = useT();
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center justify-center gap-2 text-[#666666]", compact ? "py-6" : "py-16", className)}>
      <Loader2 size={22} className="animate-spin text-[#F5A623]" aria-hidden />
      <span className="text-[12.5px]">{t(texte)}</span>
    </div>
  );
}

/** Quelque chose a échoué. `onReessayer` ajoute le bouton de relance. */
export function EtatErreur({ titre = "Un problème est survenu", onReessayer, children, ...p }: EtatProps & { onReessayer?: () => void }) {
  const t = useT();
  return (
    <Gabarit icone={<AlertTriangle size={20} />} ton="danger" role="alert" titre={titre} {...p}>
      {onReessayer && <Bouton variante="secondaire" onClick={onReessayer}>{t("Réessayer")}</Bouton>}
      {children}
    </Gabarit>
  );
}

/** Pas de réseau. Dire ce qui reste possible ; ne jamais laisser croire qu'un paiement distant est confirmé. */
export function EtatHorsLigne({ titre = "Mode hors ligne", texte = "La connexion est interrompue. Cette partie de la caisse a besoin du réseau : elle reviendra dès qu'il sera rétabli.", onReessayer, children, ...p }: EtatProps & { onReessayer?: () => void }) {
  const t = useT();
  return (
    <Gabarit icone={<WifiOff size={20} />} ton="attention" titre={titre} texte={texte} {...p}>
      {onReessayer && <Bouton variante="secondaire" onClick={onReessayer}>{t("Réessayer")}</Bouton>}
      {children}
    </Gabarit>
  );
}

/** La personne n'a pas le droit de voir ou de faire cela. */
export function EtatNonAutorise({ titre = "Accès non autorisé", texte = "Votre compte n'a pas le droit d'utiliser cette partie de la caisse. Demandez à un responsable.", ...p }: EtatProps) {
  return <Gabarit icone={<Ban size={20} />} ton="neutre" titre={titre} texte={texte} {...p} />;
}

/** L'opération se heurte à un état qui a changé ailleurs (déjà enregistrée, caisse fermée entre-temps, stock pris par une autre caisse). */
export function EtatConflit({ titre = "Cette opération ne peut pas être appliquée telle quelle", texte = "Les données ont changé depuis votre dernière action. Rechargez pour voir l'état actuel.", onRecharger, children, ...p }: EtatProps & { onRecharger?: () => void }) {
  const t = useT();
  return (
    <Gabarit icone={<GitMerge size={20} />} ton="info" role="alert" titre={titre} texte={texte} {...p}>
      {onRecharger && <Bouton variante="secondaire" onClick={onRecharger}>{t("Recharger")}</Bouton>}
      {children}
    </Gabarit>
  );
}

/** Opération enregistrée localement, pas encore confirmée par le serveur. */
export function EtatEnAttente({ titre = "En attente d'envoi", texte = "Cette opération est enregistrée sur cet appareil. Elle sera envoyée dès que la connexion reviendra.", ...p }: EtatProps) {
  return <Gabarit icone={<Clock size={20} />} ton="info" titre={titre} texte={texte} {...p} />;
}

/**
 * Du `code` d'une erreur de l'API (ErreurPos.code, ou Reponse.code de
 * envoyerMutation) au bon état. `message` est la phrase renvoyée par le serveur.
 */
export function EtatPos({ code, message, onReessayer, compact }: { code: string; message?: string; onReessayer?: () => void; compact?: boolean }) {
  if (code === "hors_ligne") return <EtatHorsLigne texte={message} onReessayer={onReessayer} compact={compact} />;
  if (code === "non_autorise" || code === "non_connecte" || code === "appareil_refuse") return <EtatNonAutorise texte={message} compact={compact} />;
  if (code === "conflit" || code === "caisse_fermee" || code === "caisse_deja_ouverte" || code === "deja_annulee" || code === "stock_insuffisant") {
    return <EtatConflit titre="Action impossible pour le moment" texte={message} onRecharger={onReessayer} compact={compact} />;
  }
  return <EtatErreur texte={message} onReessayer={onReessayer} compact={compact} />;
}
