// Source unique de vérité pour les paliers d'abonnement Axso — limites et
// fonctionnalités par palier. La page /dashboard/abonnement affiche sa copie
// marketing à partir de ce fichier pour qu'elle ne puisse jamais promettre
// une fonctionnalité que le backend n'applique pas réellement.

export type Palier = "palier0" | "palier1" | "palier2";

const ORDRE: Record<Palier, number> = { palier0: 0, palier1: 1, palier2: 2 };

// Défensif face aux valeurs héritées ("gratuit", "premium"...) qui existent
// encore en base pour des tenants créés avant l'introduction des paliers —
// tout ce qui n'est pas palier0/1/2 reconnu est traité comme palier0 plutôt
// que de planter (ex: FEATURES[palier] undefined).
export function palierAuMoins(palier: Palier, requis: Palier): boolean {
  return (ORDRE[palier] ?? 0) >= ORDRE[requis];
}

export const LIMITES: Record<Palier, { commandesParMois: number | null }> = {
  palier0: { commandesParMois: 30 },
  palier1: { commandesParMois: null },
  palier2: { commandesParMois: null },
};

// Fonctionnalités binaires (hors WhatsApp, qui suit sa propre règle de
// verrouillage par quota — voir lib/abonnement.ts::quotaCommandesAtteint).
export type FeatureKey =
  | "sourcing_mondial"
  | "analytics_avance"
  | "analytics_temps_reel"
  | "multi_boutique";

export const FEATURES: Record<Palier, FeatureKey[]> = {
  palier0: [],
  palier1: ["analytics_avance"],
  palier2: ["sourcing_mondial", "analytics_avance", "analytics_temps_reel", "multi_boutique"],
};

export function aAcces(palier: Palier, feature: FeatureKey): boolean {
  return FEATURES[palier]?.includes(feature) ?? false;
}

// Filtre générique d'outils IA par palier — utilisé par lib/axia/tools.ts,
// générique pour éviter toute dépendance circulaire avec ce module.
export function filtrerOutilsParPalier<T extends { tier?: Palier }>(outils: T[], palier: Palier): T[] {
  return outils.filter(o => !o.tier || palierAuMoins(palier, o.tier));
}

export const NOMS_PALIERS: Record<Palier, string> = {
  palier0: "Essentiel",
  palier1: "Pro",
  palier2: "Illimité",
};
