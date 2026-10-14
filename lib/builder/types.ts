// AXSO BUILDER MCP — contrat d'une opération de construction. Une opération est une
// fonction PURE sur la configuration de la boutique (themeConfig) : elle ne touche ni la
// base ni la vitrine en ligne. Le moteur (lib/builder/moteur.ts) les applique au brouillon,
// en une transaction logique : toutes passent, ou rien n'est enregistré.
import type { ThemeConfig } from "@/lib/theme-config";

export class ErreurBuilder extends Error {
  constructor(public code: "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_FAILED" | "POLICY_BLOCKED" | "ASSET_INVALID", message: string) { super(message); }
}

/** Contexte métier lu par les opérations qui en ont besoin (liaisons produits, liens…). Jamais de secret. */
export interface DonneesBoutique { slug: string; nom: string; devise: string; whatsapp?: string; collections: { slug: string; nom: string }[]; produits: { id: string; nom: string }[] }

export interface OperationBuilder {
  /** Nom de l'outil MCP bas niveau qui l'expose (ex. axso_builder_update_section). */
  nom: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, any>; required?: string[] };
  /** Capacité annoncée (builder_structure, builder_design, builder_navigation, builder_contenu…). */
  capacite: string;
  /** Risque d'appliquer l'opération AU BROUILLON (la publication a son propre risque). Défaut : faible. */
  risque?: "faible" | "moyen";
  appliquer: (cfg: ThemeConfig, args: Record<string, any>, donnees: DonneesBoutique) => ThemeConfig;
}

/** Une étape d'un plan ou d'une transaction : le nom d'une opération et ses paramètres. */
export interface EtapeOperation { op: string; args: Record<string, any> }
