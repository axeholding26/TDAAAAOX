// AXSO CONTROL — contrat d'un module d'outils spécialisé (marché, sourcing, créatif…).
// Un module ne parle ni HTTP ni OAuth : il déclare ses outils et les exécute pour une
// boutique donnée. Droits, politique, accord, idempotence et journal sont appliqués
// AVANT lui, dans lib/controle-ia/serveur.ts.
import type { GrillePermissions, ModuleKey } from "@/lib/permissions";
import type { Palier } from "@/lib/plans";
import type { Mode, Risque } from "./regles";

/** risqueBuilderMax : en autopilote, plus haut niveau de risque qu'une modification de boutique peut publier sans accord. */
export interface Limites { variationPrixMax: number; budgetPubMax: number; transactionMax: number; risqueBuilderMax: "faible" | "moyen" }

/** Codes d'erreur renvoyés aux IA (jamais d'erreur interne). */
export type CodeErreur =
  | "INSUFFICIENT_PERMISSION" | "PLAN_REQUIRED" | "APPROVAL_REQUIRED" | "NOT_FOUND" | "INVALID_INPUT"
  | "CONFLICT" | "RATE_LIMITED" | "UNAVAILABLE" | "INTERNAL"
  | "POLICY_BLOCKED" | "VALIDATION_FAILED" | "ASSET_INVALID";

export interface ResultatIA {
  succes: boolean;
  /** Texte lu par le modèle. */
  resultat: string;
  /** Données structurées (renvoyées en `structuredContent`). */
  donnees?: Record<string, unknown>;
  code?: CodeErreur;
  /** Ligne du journal ActionIA (posée par le serveur, pas par le module). */
  actionId?: string;
}

export interface CtxOutil {
  tenantId: string;
  userId: string;
  connexionId: string;
  client: string;
  plan: Palier;
  grille: GrillePermissions;
  mode: Mode;
  limites: Limites;
  /**
   * Appelle un autre outil (AXIA ou module) par le MÊME circuit que l'IA : droits, politique,
   * accord du marchand, journal. Les orchestrations (objectifs, automatisations) n'ont pas
   * d'autre moyen d'agir : un contenu piégé ne peut donc pas leur faire dépasser les droits.
   */
  appeler: (nom: string, args: Record<string, any>) => Promise<ResultatIA>;
}

export interface OutilIA {
  name: string;
  /** Dit clairement QUAND utiliser l'outil : c'est ce que lit le modèle. */
  description: string;
  parameters: { type: "object"; properties: Record<string, any>; required?: string[] };
  /** Module de lib/permissions.ts dont dépend l'outil, et niveau exigé. */
  module: ModuleKey;
  niveau: "lecture" | "ecriture";
  /** Écriture seulement. faible : brouillon, génération. moyen : prix, publication, envoi. eleve : argent, masse, suppression. */
  risque?: Risque;
  /** Droit fin exigé en plus : voir SCOPES_FINS (regles.ts) ; sinon pris dans SCOPES_OUTILS. */
  scope?: string;
  tier?: Palier;
  /** Capacité annoncée par axso_capacites (ex. « etude_marche », « sourcing », « creation »). */
  capacite: string;
  /** Autopilote : montant engagé, comparé aux limites du marchand ; au-delà (ou sans montant), accord. */
  montant?: (args: Record<string, any>) => { type: "pub" | "transaction"; valeur: number } | null;
  /**
   * Outil avancé : absent de la liste envoyée au modèle (économie d'outils), découvert par
   * axso_decouvrir et appelé par axso_outil — avec exactement les mêmes contrôles.
   */
  cache?: boolean;
  /** Risque calculé selon l'effet réel (ex. taille d'une refonte avant publication), à la place de `risque`. */
  evaluerRisque?: (args: Record<string, any>, ctx: CtxOutil) => Promise<{ risque: Risque; resume?: string; apercu?: string } | null>;
  /** Vrai si cet appel change la boutique EN LIGNE (publication, restauration) : en copilote, toujours avec accord. */
  enLigne?: (args: Record<string, any>) => boolean;
  /** Description courte de ce que renvoie l'outil. */
  sortie?: string;
  exemple?: Record<string, any>;
}

export interface ModuleIA {
  id: string;
  nom: string;
  outils: OutilIA[];
  executer: (nom: string, args: Record<string, any>, ctx: CtxOutil) => Promise<ResultatIA>;
  /** Raison (lisible) pour laquelle le module ne peut pas servir cette boutique — service non relié, clé absente… — sinon null. */
  indisponible?: (tenantId: string, capacite: string) => Promise<string | null>;
}

export const INCONNU: ResultatIA = { succes: false, code: "NOT_FOUND", resultat: "Outil inconnu." };
