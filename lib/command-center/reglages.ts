// Réglages du Command Center (seuils, objectifs, pondérations…) : types + valeurs
// par défaut. Stockés en base dans ReglageAdmin (une ligne par clé), lus par
// lib/command-center/serveur.ts. Module pur.
import { z } from "zod";

export const schemaSeuil = z.object({
  id: z.string().min(1).max(40),
  metrique: z.string().min(1).max(40),
  condition: z.enum(["variation_inf", "variation_sup", "valeur_inf", "valeur_sup"]),
  valeur: z.number().finite(),
  gravite: z.enum(["critique", "alerte"]),
  canal: z.enum(["tableau", "email"]),
  actif: z.boolean(),
});
export type Seuil = z.infer<typeof schemaSeuil>;

export const schemaObjectif = z.object({ metrique: z.string().min(1).max(40), cible: z.number().positive(), echeance: z.string().max(10).optional() });
export type Objectif = z.infer<typeof schemaObjectif>;

export const CRITERES_SANTE = ["activite", "commandes", "gmv", "usage", "ia", "paiements", "support", "croissance"] as const;
export const NOM_CRITERE: Record<(typeof CRITERES_SANTE)[number], string> = {
  activite: "Fréquence d'activité", commandes: "Commandes", gmv: "GMV", usage: "Utilisation produit",
  ia: "Utilisation IA", paiements: "Paiements (abonnement, échecs)", support: "Support", croissance: "Évolution du business",
};
export const schemaPoids = z.object(Object.fromEntries(CRITERES_SANTE.map((c) => [c, z.number().min(0).max(100)])) as Record<(typeof CRITERES_SANTE)[number], z.ZodNumber>);
export type PoidsSante = z.infer<typeof schemaPoids>;

export const schemaRapport = z.object({
  type: z.enum(["quotidien", "croissance", "revenus", "sante_marchands", "ia", "marketing", "operations"]),
  frequence: z.enum(["quotidien", "hebdomadaire", "mensuel"]),
  destinataires: z.array(z.string().email()).max(20),
  actif: z.boolean(),
});
export type RapportPlanifie = z.infer<typeof schemaRapport>;

export const schemaTache = z.object({
  id: z.string().max(60),
  titre: z.string().min(1).max(200),
  assigneA: z.string().max(80),
  creePar: z.string().max(120),
  creeLe: z.number(),
  statut: z.enum(["a_faire", "fait"]),
  lien: z.string().max(400).optional(),
});
export type Tache = z.infer<typeof schemaTache>;

export const SCHEMAS = {
  seuils: z.array(schemaSeuil).max(50),
  objectifs: z.array(schemaObjectif).max(20),
  poids_sante: schemaPoids,
  activation: z.enum(["boutique", "produit", "commande", "paiement"]),
  rapports: z.array(schemaRapport).max(20),
  taches: z.array(schemaTache).max(200),
  ignores: z.array(z.string().max(120)).max(500),
};
export type CleReglage = keyof typeof SCHEMAS;
export type Reglages = { [K in CleReglage]: z.infer<(typeof SCHEMAS)[K]> };

export const REGLAGES_DEFAUT: Reglages = {
  seuils: [
    { id: "s1", metrique: "mrr", condition: "variation_inf", valeur: -0.1, gravite: "critique", canal: "email", actif: true },
    { id: "s2", metrique: "activation", condition: "valeur_inf", valeur: 0.5, gravite: "alerte", canal: "tableau", actif: true },
    { id: "s3", metrique: "succes_paiement", condition: "valeur_inf", valeur: 0.95, gravite: "critique", canal: "email", actif: true },
    { id: "s4", metrique: "churn", condition: "valeur_sup", valeur: 0.05, gravite: "alerte", canal: "tableau", actif: true },
    { id: "s5", metrique: "echecs_paiement", condition: "variation_sup", valeur: 0.15, gravite: "alerte", canal: "tableau", actif: true },
    { id: "s6", metrique: "livraison", condition: "valeur_inf", valeur: 0.9, gravite: "alerte", canal: "tableau", actif: true },
  ],
  objectifs: [
    { metrique: "mrr", cible: 2_000_000 },
    { metrique: "marchands_actifs", cible: 1500 },
    { metrique: "gmv", cible: 150_000_000 },
    { metrique: "revenu", cible: 5_000_000 },
    { metrique: "pays", cible: 12 },
    { metrique: "nrr", cible: 1.05 },
  ],
  poids_sante: { activite: 20, commandes: 15, gmv: 15, usage: 15, ia: 10, paiements: 10, support: 5, croissance: 10 },
  activation: "commande",
  rapports: [],
  taches: [],
  ignores: [],
};

export const NOM_ETAPE: Record<Reglages["activation"], string> = {
  boutique: "Boutique créée", produit: "Premier produit", commande: "Première commande", paiement: "Premier paiement en ligne reçu",
};

export const NOM_RAPPORT: Record<RapportPlanifie["type"], string> = {
  quotidien: "Daily Executive Report", croissance: "Weekly Growth Report", revenus: "Monthly Revenue Report",
  sante_marchands: "Merchant Health Report", ia: "AI Report", marketing: "Marketing Report", operations: "Operations Report",
};
