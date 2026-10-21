// « Signaler un problème » : règles pures (validation, limite, libellés). Testé dans tests/signalements.test.ts.
import { z } from "zod";

export const STATUTS_SIGNALEMENT = ["ouvert", "en_cours", "resolu"] as const;
export type StatutSignalement = (typeof STATUTS_SIGNALEMENT)[number];
export const NOM_STATUT: Record<StatutSignalement, string> = { ouvert: "Ouvert", en_cours: "En cours", resolu: "Résolu" };

/** Signalements autorisés par utilisateur sur une heure glissante. */
export const LIMITE_PAR_HEURE = 10;
export const limiteAtteinte = (nbDerniereHeure: number) => nbDerniereHeure >= LIMITE_PAR_HEURE;

const MAX_DATA_URL = 3_000_000; // ≈ 2 Mo d'image : repli d'importerMedia quand le stockage est indisponible

/** Capture : fichier du stockage Blob d'Axso, ou petite image en ligne. Jamais une URL quelconque (pixel espion). */
export function captureValide(u: string): boolean {
  if (/^data:image\/(png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/.test(u)) return u.length <= MAX_DATA_URL;
  try {
    const x = new URL(u);
    return x.protocol === "https:" && x.hostname.endsWith(".blob.vercel-storage.com");
  } catch { return false; }
}

/** Ne garde que le chemin du tableau de bord (jamais une URL externe ni un domaine). */
export function pageNormalisee(p: string): string {
  try {
    const u = new URL(p, "https://x.invalid");
    return u.pathname.startsWith("/dashboard") ? (u.pathname + u.search).slice(0, 500) : "";
  } catch { return ""; }
}

/** Sujet affiché dans le Command Center : le module du tableau de bord (/dashboard/builder → builder). */
export const sujetDe = (page: string) => page.split(/[?#]/)[0].split("/")[2] || "accueil";

export const schemaSignalement = z.object({
  description: z.string().trim().min(10, "Décrivez le problème (10 caractères minimum)").max(4000, "Description trop longue (4 000 caractères maximum)"),
  capture: z.string().refine(captureValide, "Capture d'écran invalide").nullish(),
  page: z.string().max(2000).default("").transform(pageNormalisee),
  ecran: z.string().max(60).optional(),
  erreur: z.string().trim().max(2000).nullish().transform((e) => e || null),
});

export const schemaTraitement = z.object({
  statut: z.enum(STATUTS_SIGNALEMENT),
  reponse: z.string().trim().max(4000).optional(),
});

/** Lien vers le formulaire, avec la page où était le marchand. */
export const lienSignalement = (depuis: string) => `/dashboard/support?depuis=${encodeURIComponent(depuis)}`;
/** Dernière erreur affichée (dashboard/error.tsx), jointe au signalement si elle date de moins d'une heure. */
export const CLE_DERNIERE_ERREUR = "axso:derniere-erreur";
