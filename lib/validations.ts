// Schémas de validation Zod pour Axso
import { z } from "zod";

// Création de boutique (onboarding)
export const schemaBoutique = z.object({
  nomBoutique: z.string().min(2, "Minimum 2 caractères").max(50),
  slug: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/, "Uniquement lettres, chiffres et tirets"),
  email: z.string().email("Email invalide"),
  whatsapp: z.string().min(8, "Numéro WhatsApp requis"),
  categorie: z.string().min(1, "Sélectionnez une catégorie"),
  pays: z.string().min(1, "Sélectionnez un pays"),
  description: z.string().max(500).optional(),
});

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

// Création de commande (checkout)
export const schemaCheckout = z.object({
  clientNom: z.string().min(2),
  clientEmail: z.string().email(),
  clientTelephone: z.string().min(8),
  adresseLivraison: z.string().min(5),
  ville: z.string().min(2),
  pays: z.string().min(2),
  methodePaiement: z.string().min(1),
  codePromo: z.string().optional(),
  noteClient: z.string().max(300).optional(),
});

// Code promo
export const schemaCodePromo = z.object({
  code: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Z0-9-]+$/, "Lettres majuscules, chiffres et tirets uniquement"),
  type: z.enum(["pourcentage", "montant_fixe"]),
  valeur: z.number().positive(),
  minCommande: z.number().positive().optional(),
  maxUtilisations: z.number().int().positive().optional(),
  dateExpiration: z.string().datetime().optional(),
  actif: z.boolean().default(true),
});

// Avis client
export const schemaAvis = z.object({
  note: z.number().int().min(1).max(5),
  titre: z.string().max(100).optional(),
  commentaire: z.string().max(1000).optional(),
});

// Connexion
export const schemaConnexion = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Minimum 6 caractères"),
});

// Inscription
export const schemaInscription = z.object({
  name: z.string().min(2, "Minimum 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Minimum 6 caractères"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});
