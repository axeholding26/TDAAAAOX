"use client";
// Badges de la caisse : statut court, jamais porté par la couleur seule
// (un texte ou une icône l'accompagne toujours).
import { AlertTriangle, CheckCircle2, Clock, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/I18nProvider";
import { TONS, type Ton } from "./tokens";

export function Badge({ ton = "neutre", children, icone, className }: { ton?: Ton; children: React.ReactNode; icone?: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", className)} style={TONS[ton]}>
      {icone}{children}
    </span>
  );
}

/**
 * État réel d'un moyen de paiement (lib/pos/paiements.ts → MODES_PAIEMENT[mode].statut).
 * Un paiement déclaratif s'affiche TOUJOURS « Non vérifié » : il a été confirmé
 * par le caissier, jamais par un prestataire.
 */
export function BadgePaiement({ statut }: { statut: "actif" | "declaratif" | "a_connecter" }) {
  const t = useT();
  if (statut === "actif") return <Badge ton="positif" icone={<CheckCircle2 size={11} aria-hidden />}>{t("Suivi par AXSO")}</Badge>;
  if (statut === "declaratif") return <Badge ton="attention" icone={<AlertTriangle size={11} aria-hidden />}>{t("Non vérifié")}</Badge>;
  return <Badge ton="neutre" icone={<Clock size={11} aria-hidden />}>{t("Intégration en attente")}</Badge>;
}

/** Pastille de connexion de la barre de caisse : en ligne / hors ligne / synchronisation. */
export function BadgeConnexion({ etat, enAttente }: { etat: "en_ligne" | "hors_ligne" | "synchronisation"; /** Opérations en attente d'envoi. */ enAttente?: number }) {
  const t = useT();
  if (etat === "en_ligne") {
    return <Badge ton="positif" icone={<span className="h-1.5 w-1.5 rounded-full bg-[#15803D]" aria-hidden />}><span role="status">{t("En ligne")}</span></Badge>;
  }
  if (etat === "synchronisation") {
    return <Badge ton="info" icone={<Clock size={11} aria-hidden />}><span role="status">{t("Synchronisation…")}{enAttente ? ` (${enAttente})` : ""}</span></Badge>;
  }
  return <Badge ton="attention" icone={<WifiOff size={11} aria-hidden />}><span role="status">{t("Mode hors ligne")}{enAttente ? ` · ${enAttente}` : ""}</span></Badge>;
}
