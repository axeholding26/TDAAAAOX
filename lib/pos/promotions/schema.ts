// Validation (zod) d'une promotion à l'enregistrement. Le format de `regles`
// est décrit en tête de ./moteur.ts ; ici on refuse, avec une phrase claire,
// une promotion que le moteur ne saurait pas appliquer (règle incomplète).
import { z } from "zod";
import { TYPES_PROMOTION } from "./moteur";
import { SEGMENTS } from "./segments";

const id = z.string().trim().min(1).max(64);
const ids = z.array(id).max(500);
const montant = z.number().finite().min(0).max(1e12);
const pct = z.number().finite().min(0).max(100);
const entier = z.number().int().min(1).max(100_000);
const cible = { produitIds: ids.optional(), varianteIds: ids.optional(), categories: z.array(z.string().trim().min(1).max(80)).max(100).optional() };
const groupe = z.object({ ...cible, quantite: entier });

export const schemaRegles = z.object({
  ...cible,
  segments: z.array(z.enum(SEGMENTS)).optional(),
  clientIds: ids.optional(),
  minPanier: montant.optional(),
  par: z.enum(["unite", "panier"]).optional(),
  mode: z.enum(["pourcentage", "montant"]).optional(),
  x: entier.optional(), y: entier.optional(), memeArticle: z.boolean().optional(),
  composants: z.array(z.object({ produitId: id, varianteId: id.nullish(), quantite: entier })).max(20).optional(),
  acheter: groupe.optional(), obtenir: groupe.optional(),
  quantite: entier.optional(), declencheur: groupe.optional(),
  niveaux: z.object({ bronze: pct, silver: pct, gold: pct, vip: pct }).partial().optional(),
  /** Noms des articles cités (id → nom), pour l'affichage seulement : le moteur ne les lit pas. */
  libelles: z.record(z.string().max(64), z.string().max(160)).optional(),
  paliers: z.array(z.object({ minQuantite: z.number().finite().positive().max(1e9), prix: montant.optional(), pct: pct.optional() })).max(10).optional(),
});
export type ReglesPromotion = z.infer<typeof schemaRegles>;

const date = z.coerce.date().nullish();

export const schemaPromotion = z.object({
  nom: z.string().trim().min(2).max(80),
  type: z.enum(TYPES_PROMOTION),
  valeur: montant.nullish(),
  regles: schemaRegles.default({}),
  cumulable: z.boolean().default(false),
  priorite: z.number().int().min(-1000).max(1000).default(0),
  dateDebut: date, dateFin: date,
  magasinIds: ids.default([]),
  codePromoId: id.nullish(),
  actif: z.boolean().default(true),
}).superRefine((p, ctx) => {
  const r = p.regles, v = p.valeur ?? null;
  const refuser = (message: string, path: string[] = ["regles"]) => ctx.addIssue({ code: "custom", message, path });
  const cibleVide = (c: { produitIds?: string[]; varianteIds?: string[]; categories?: string[] }) => !c.produitIds?.length && !c.varianteIds?.length && !c.categories?.length;
  if (p.dateDebut && p.dateFin && p.dateFin < p.dateDebut) refuser("La date de fin précède la date de début.", ["dateFin"]);
  switch (p.type) {
    case "pourcentage": if (!(v && v > 0 && v <= 100)) refuser("Indiquez un pourcentage entre 1 et 100.", ["valeur"]); break;
    case "montant_fixe": if (!(v && v > 0)) refuser("Indiquez le montant de la remise.", ["valeur"]); break;
    case "seuil_panier":
      if (!(r.minPanier && r.minPanier > 0)) refuser("Indiquez le montant de panier à atteindre.");
      if (!(v && v > 0) || (r.mode !== "montant" && v > 100)) refuser("Indiquez la remise accordée (un pourcentage entre 1 et 100, ou un montant).", ["valeur"]);
      break;
    case "x_pour_y": if (!(r.x && r.y && r.x > r.y)) refuser("Indiquez le nombre d'articles pris et le nombre d'articles payés (ex. 3 pour le prix de 2)."); break;
    case "lot":
      if (!r.composants?.length) refuser("Ajoutez les articles qui composent le lot.");
      if (v === null) refuser("Indiquez le prix du lot.", ["valeur"]);
      break;
    case "achete_x_obtiens_y":
      if (!r.acheter || cibleVide(r.acheter)) refuser("Indiquez les articles à acheter et leur quantité.");
      if (v !== null && !(v > 0 && v <= 100)) refuser("La remise sur l'article obtenu est un pourcentage entre 1 et 100.", ["valeur"]);
      break;
    case "produit_offert": if (cibleVide(r)) refuser("Indiquez l'article offert."); break;
    case "prix_membre": if (!Object.values(r.niveaux ?? {}).some((x) => (x ?? 0) > 0)) refuser("Indiquez la remise d'au moins un niveau de fidélité."); break;
    case "prix_grossiste":
      if (!r.paliers?.length || r.paliers.some((x) => x.prix === undefined && !(x.pct && x.pct > 0))) refuser("Chaque palier a besoin d'une quantité minimale et d'un prix (ou d'un pourcentage).");
      break;
  }
});
export type DonneesPromotion = z.infer<typeof schemaPromotion>;
