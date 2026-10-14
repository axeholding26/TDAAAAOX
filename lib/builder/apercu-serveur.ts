// Lien d'aperçu du brouillon pour le marchand (page Contrôle IA) — même lien signé que pour les IA.
import { origineAxso } from "@/lib/origine-site";
import { jetonApercu } from "./apercu";

export async function lienApercuMarchand(tenantId: string): Promise<string | null> {
  const j = jetonApercu(tenantId);
  return j ? `${await origineAxso()}/api/builder/apercu?j=${encodeURIComponent(j)}` : null;
}
