import { convertirDepuisXAF } from "@/lib/devise-convert";

// Seuil VIP unique (page Clients, segments email) : 5 commandes payées ou
// 100 000 XAF de dépenses cumulées, converti dans la devise de la boutique.
export const VIP_COMMANDES = 5;
export const VIP_DEPENSE_XAF = 100_000;

export function seuilDepenseVip(devise: string | null | undefined): number {
  return convertirDepuisXAF(VIP_DEPENSE_XAF, devise || "XAF");
}

export function estVip(nbCommandes: number, totalDepense: number, devise: string | null | undefined): boolean {
  return nbCommandes >= VIP_COMMANDES || totalDepense >= seuilDepenseVip(devise);
}
