// Réglages et drapeaux de fonctionnalité de la caisse, par boutique
// (table ReglagesPos). SERVEUR uniquement — les constantes et les types sont
// dans types.ts pour l'écran.
//
// Une boutique sans ligne ReglagesPos fonctionne avec les valeurs par défaut :
// mode « simple », tous les drapeaux éteints, REGLAGES_DEFAUT.
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { ErreurPos } from "./erreurs";
import {
  FLAGS_POS, REGLAGES_DEFAUT, TYPES_COMMERCE,
  type FlagPos, type ModePos, type ReglagesPosComplets, type ReglagesPosValeurs, type TypeCommerce,
} from "./types";

export { FLAGS_POS };
export type { FlagPos };

/** Fusionne les réglages enregistrés dans les valeurs par défaut, section par section (une clé inconnue est ignorée). */
export function fusionnerReglages(enregistres: unknown): ReglagesPosValeurs {
  const src = (enregistres && typeof enregistres === "object" ? enregistres : {}) as Record<string, unknown>;
  const r = {} as Record<string, unknown>;
  for (const [section, defaut] of Object.entries(REGLAGES_DEFAUT)) {
    const v = src[section];
    r[section] = v && typeof v === "object" && !Array.isArray(v) ? { ...defaut, ...(v as object) } : defaut;
  }
  // Un avoir émis (retour, points de fidélité) doit toujours pouvoir être dépensé : ce moyen ne se désactive pas.
  const valeurs = r as ReglagesPosValeurs;
  if (!valeurs.paiements.modes.includes("avoir")) valeurs.paiements = { ...valeurs.paiements, modes: [...valeurs.paiements.modes, "avoir"] };
  return valeurs;
}

function lireFlags(brut: unknown): Record<FlagPos, boolean> {
  const src = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  return Object.fromEntries(FLAGS_POS.map((f) => [f, src[f] === true])) as Record<FlagPos, boolean>;
}

export async function lireReglagesPos(tenantId: string): Promise<ReglagesPosComplets> {
  const ligne = await prisma.reglagesPos.findUnique({ where: { tenantId } });
  return {
    typeCommerce: (TYPES_COMMERCE as readonly string[]).includes(ligne?.typeCommerce ?? "") ? (ligne!.typeCommerce as TypeCommerce) : "RETAIL",
    mode: ligne?.mode === "pro" ? "pro" : "simple",
    flags: lireFlags(ligne?.flags),
    reglages: fusionnerReglages(ligne?.reglages),
    onboarding: ((ligne?.onboarding as Record<string, boolean> | null) ?? {}),
  };
}

export async function flagActif(tenantId: string, flag: FlagPos): Promise<boolean> {
  return (await lireReglagesPos(tenantId)).flags[flag];
}

/**
 * « Stock avancé » (drapeau advanced_inventory) : exigé pour DÉMARRER un inventaire ou CRÉER un
 * transfert. Ce qui est en cours se termine même drapeau éteint ; lots, numéros de série et
 * corrections de stock ne dépendent pas de lui.
 */
export async function exigerStockAvance(tenantId: string): Promise<void> {
  if (!(await flagActif(tenantId, "advanced_inventory"))) {
    throw new ErreurPos("fonction_desactivee", 403, "Les inventaires et les transferts de stock ne sont pas encore activés pour cette boutique. Activez « Stock avancé » dans les réglages de la caisse.", { flag: "advanced_inventory", lien: "/dashboard/pos/reglages" });
  }
}

/** La session de caisse est-elle exigée pour vendre ? (null dans les réglages = oui en mode pro seulement) */
export function sessionObligatoire(r: Pick<ReglagesPosComplets, "mode" | "reglages">): boolean {
  return r.reglages.caisse.sessionObligatoire ?? r.mode === "pro";
}

export type ModifReglagesPos = {
  typeCommerce?: TypeCommerce;
  mode?: ModePos;
  flags?: Partial<Record<FlagPos, boolean>>;
  /** Sections partielles : seules les clés fournies changent. */
  reglages?: { [S in keyof ReglagesPosValeurs]?: Partial<ReglagesPosValeurs[S]> };
  onboarding?: Record<string, boolean>;
};

/** Enregistre une modification partielle et renvoie les réglages complets, plus l'état d'avant (pour l'audit). */
export async function enregistrerReglagesPos(tenantId: string, modif: ModifReglagesPos, db: Prisma.TransactionClient = prisma): Promise<{ avant: ReglagesPosComplets; apres: ReglagesPosComplets }> {
  const avant = await lireReglagesPos(tenantId);
  const reglages = { ...avant.reglages } as Record<string, unknown>;
  for (const [section, valeurs] of Object.entries(modif.reglages ?? {})) {
    if (section in REGLAGES_DEFAUT && valeurs) reglages[section] = { ...(reglages[section] as object), ...valeurs };
  }
  const apres: ReglagesPosComplets = {
    typeCommerce: modif.typeCommerce ?? avant.typeCommerce,
    mode: modif.mode ?? avant.mode,
    flags: { ...avant.flags, ...modif.flags },
    reglages: reglages as ReglagesPosValeurs,
    onboarding: { ...avant.onboarding, ...modif.onboarding },
  };
  const data = {
    typeCommerce: apres.typeCommerce, mode: apres.mode,
    flags: apres.flags as Prisma.InputJsonValue, reglages: apres.reglages as unknown as Prisma.InputJsonValue, onboarding: apres.onboarding as Prisma.InputJsonValue,
  };
  await db.reglagesPos.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
  return { avant, apres };
}
