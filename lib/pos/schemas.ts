// Validation (zod) des corps de requête de la caisse — partagée par les routes
// /api/pos et par la synchronisation hors ligne, qui rejoue les mêmes demandes.
// Ne décrit QUE ce que l'appareil a le droit de dire : ni tenantId, ni prix
// catalogue, ni total — le serveur les relit (lib/pos/vente.ts).
import { z } from "zod";
import { MODES_PAIEMENT_IDS, FLAGS_POS, TYPES_COMMERCE } from "./types";

const texte = (max: number) => z.string().trim().max(max);
const id = z.string().trim().min(1).max(64);
const montant = z.number().finite().min(0).max(1e12);

export const schemaRemise = z.object({ type: z.enum(["pourcentage", "montant"]), valeur: montant });

export const schemaLigne = z.object({
  produitId: id,
  varianteId: id.nullish(),
  /** Pièces, ou grammes pour un produit au poids. */
  quantite: z.number().int().min(1).max(10_000_000),
  prixPersonnalise: montant.nullish(),
  remise: schemaRemise.nullish(),
  offert: z.boolean().optional(),
  commentaire: texte(300).nullish(),
  numeroSerie: texte(100).nullish(),
  numeroSerieId: id.nullish(),
});

export const schemaPaiement = z.object({
  mode: z.enum(MODES_PAIEMENT_IDS),
  montant: z.number().finite().positive().max(1e12),
  prestataire: texte(60).nullish(),
  reference: texte(120).nullish(),
});

export const schemaPanier = z.object({
  lignes: z.array(schemaLigne).min(1).max(500),
  clientId: id.nullish(),
  remise: schemaRemise.nullish(),
  codePromo: texte(60).nullish(),
});

export const schemaVente = schemaPanier.extend({
  cle: z.string().trim().min(8).max(200),
  paiements: z.array(schemaPaiement).max(10),
  note: texte(500).nullish(),
  creeLocalAt: z.string().datetime({ offset: true }).nullish(),
});

export const schemaAnnulation = z.object({ motif: texte(300).min(3) });

export const schemaOuverture = z.object({ fondsInitial: montant, cle: z.string().trim().min(8).max(200).optional() });

export const schemaFermeture = z.object({
  compte: montant,
  justification: texte(500).nullish(),
  /** Billets et pièces comptés : { "10000": 12, "5000": 3 }. */
  detailComptage: z.record(z.string().max(20), z.number().int().min(0).max(1_000_000)).nullish(),
  cle: z.string().trim().min(8).max(200).optional(),
});

export const schemaSuspension = z.object({
  libelle: texte(80).nullish(),
  clientId: id.nullish(),
  /** Panier tel que saisi (lignes, remise, code promo) : les prix sont recalculés à la reprise. */
  contenu: schemaPanier.partial({ clientId: true }).passthrough(),
  cle: z.string().trim().min(8).max(200).optional(),
});

export const schemaMagasin = z.object({
  nom: texte(80).min(2),
  code: texte(20).nullish(),
  adresse: texte(200).nullish(),
  ville: texte(80).nullish(),
  pays: texte(60).nullish(),
  telephone: texte(30).nullish(),
  /** Entrepôt existant de la boutique ; absent : un entrepôt du même nom est créé. */
  entrepotId: id.nullish(),
  typeCommerce: z.enum(TYPES_COMMERCE).nullish(),
});
export const schemaMagasinModif = schemaMagasin.omit({ entrepotId: true }).partial().extend({ actif: z.boolean().optional() });

export const schemaCaisse = z.object({ magasinId: id, nom: texte(60).min(1) });
export const schemaCaisseModif = z.object({ nom: texte(60).min(1).optional(), actif: z.boolean().optional() });

const pct = z.number().finite().min(0).max(100);
export const schemaReglages = z.object({
  typeCommerce: z.enum(TYPES_COMMERCE).optional(),
  mode: z.enum(["simple", "pro"]).optional(),
  flags: z.partialRecord(z.enum(FLAGS_POS), z.boolean()).optional(),
  reglages: z.object({
    taxes: z.object({ prixTTC: z.boolean() }).partial(),
    remises: z.object({ plafondPct: pct }).partial(),
    caisse: z.object({ sessionObligatoire: z.boolean().nullable(), fondsInitialDefaut: montant }).partial(),
    paiements: z.object({ modes: z.array(z.enum(MODES_PAIEMENT_IDS)).min(1) }).partial(),
    fidelite: z.object({
      active: z.boolean(), montantParPoint: z.number().finite().positive(), valeurPoint: montant,
      seuils: z.object({ silver: z.number().int().min(0), gold: z.number().int().min(0), vip: z.number().int().min(0) }),
    }).partial(),
    credit: z.object({ actif: z.boolean(), plafondDefaut: montant, echeanceJours: z.number().int().min(1).max(365), graceJours: z.number().int().min(0).max(90) }).partial(),
    recu: z.object({ entete: texte(300), piedDePage: texte(300), afficherTVA: z.boolean(), format: z.enum(["80mm", "58mm", "A4"]) }).partial(),
    retours: z.object({ delaiJours: z.number().int().min(0).max(365), sansRecu: z.boolean() }).partial(),
    stock: z.object({ venteSansStock: z.boolean(), seuilExpirationJours: z.number().int().min(1).max(365) }).partial(),
    series: z.object({ enregistresUniquement: z.boolean() }).partial(),
    alertes: z.object({ dormantJours: z.number().int().min(7).max(365), margeFaiblePct: pct, remboursementsPct: pct }).partial(),
    balance: z.object({ prefixesPoids: z.array(z.string().regex(/^2[1-9]$/)).max(9) }).partial(),
  }).partial().optional(),
  onboarding: z.record(z.string().max(40), z.boolean()).optional(),
});
