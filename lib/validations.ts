// Schémas de validation Zod pour Axso
import { z } from "zod";

// Création de produit
export const schemaProduit = z.object({
  nom: z.string().min(2, "Minimum 2 caractères"),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  prix: z.number().positive("Le prix doit être positif"),
  prixCompare: z.number().positive().optional(),
  stock: z.number().int().min(0),
  sku: z.string().optional(),
  codeBarres: z.string().optional(),
  categorie: z.string().optional(),
  tags: z.array(z.string()).default([]),
  images: z.array(z.string()).default([]),
  videos: z.array(z.string()).default([]),
  actif: z.boolean().default(true),
  featured: z.boolean().default(false),
  poids: z.number().positive().optional(),
  cout: z.number().min(0).optional(), // prix d'achat — sert au calcul de rentabilité (POS)
  metaTitle: z.string().max(60).optional(),
  metaDesc: z.string().max(155).optional(),
  // Type de produit
  type: z.enum(["physique", "digital", "dropshipping"]).default("physique"),
  // Produit digital
  fichierUrl: z.string().url().optional(),
  fichierNom: z.string().optional(),
  fichierTaille: z.number().int().positive().optional(),
  instructionsTelechargement: z.string().optional(),
  // Dropshipping
  prixFournisseur: z.number().positive().optional(),
  urlFournisseur: z.string().url().optional(),
  nomFournisseur: z.string().optional(),
});

// Connexion
export const schemaConnexion = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Minimum 6 caractères"),
});
