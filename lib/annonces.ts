// Annonces de la bannière « Ma boutique » : validation (Command Center) et sélection
// des annonces à montrer à une boutique. Module pur (testé dans tests/annonces.test.ts).
import { z } from "zod";

export const PLANS_ANNONCE = ["palier0", "palier1", "palier2"] as const;

export interface AnnonceAffichee { id: string; marque: string; titre: string; texte: string; cta: string; lien: string; logo: string | null; fond: string; accent: string }
interface AnnonceCiblee { active: boolean; debut: Date | null; fin: Date | null; pays: string[]; plans: string[] }

/** Palier d'une boutique (valeurs héritées « gratuit », « premium »… → palier0, comme lib/plans.ts). */
export const palierBoutique = (planType: string) => ((PLANS_ANNONCE as readonly string[]).includes(planType) ? planType : "palier0");

/** Annonces actives, dans leurs dates, ciblant ce pays et ce palier (liste vide = tout le monde). */
export function annoncesVisibles<A extends AnnonceCiblee>(annonces: A[], boutique: { pays: string; planType: string }, maintenant = new Date()): A[] {
  const palier = palierBoutique(boutique.planType);
  return annonces.filter((a) =>
    a.active
    && (!a.debut || a.debut <= maintenant)
    && (!a.fin || a.fin > maintenant)
    && (!a.pays.length || a.pays.includes(boutique.pays))
    && (!a.plans.length || a.plans.includes(palier)));
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;
// Dégradé simple : linear-gradient(120deg,#111 0%,#222 100%) — 2 à 5 couleurs hex, rien d'autre (pas d'url()).
const DEGRADE = /^linear-gradient\(\s*\d{1,3}deg\s*(,\s*#[0-9a-fA-F]{3,8}(\s+\d{1,3}%)?\s*){2,5}\)$/;
// https:// ou chemin interne « /… » (pas « // », qui sortirait du site).
const LIEN = /^(https:\/\/[^\s"'<>]+|\/(?!\/)[^\s"'<>]*)$/;

const texte = (max: number) => z.string().trim().min(1, "Champ obligatoire").max(max, `${max} caractères maximum`);
// Date ISO (le formulaire convertit son heure locale en ISO), vide = sans limite.
const date = z.union([z.literal(""), z.null(), z.string().datetime({ offset: true })]).transform((v) => (v ? new Date(v) : null));

export const schemaAnnonce = z.object({
  marque: texte(60),
  titre: texte(90),
  texte: texte(220),
  cta: texte(30),
  lien: z.string().trim().max(500).regex(LIEN, "Lien : https://… ou /chemin"),
  logo: z.union([z.literal(""), z.null(), z.string().trim().max(500).regex(LIEN, "Logo : https://… ou /chemin")]).transform((v) => v || null),
  fond: z.string().trim().max(200).refine((v) => HEX.test(v) || DEGRADE.test(v), "Fond : #hex ou linear-gradient(120deg,#… 0%,#… 100%)"),
  accent: z.string().trim().regex(HEX, "Accent : couleur #hex"),
  ordre: z.number().int().min(0).max(999),
  active: z.boolean(),
  debut: date,
  fin: date,
  pays: z.array(z.string().regex(/^[A-Z]{2}$/)).max(60),
  plans: z.array(z.enum(PLANS_ANNONCE)),
}).refine((a) => !a.debut || !a.fin || a.debut < a.fin, { message: "La fin doit suivre le début", path: ["fin"] });
