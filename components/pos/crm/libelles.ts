// Libellés partagés des écrans clients / promotions / fidélité / crédit.
// Textes en français : les composants les passent à t().
import type { Ton } from "@/components/pos/ui";
import type { TypePromotion } from "@/lib/pos/promotions";
import { LIBELLES_SEGMENT, type Segment } from "@/lib/pos/promotions/segments";

export { LIBELLES_SEGMENT };

export const TON_SEGMENT: Record<Segment, Ton> = { nouveau: "info", regulier: "neutre", fidele: "positif", inactif: "attention", grossiste: "accent" };

export const NIVEAUX = ["bronze", "silver", "gold", "vip"] as const;
export type Niveau = (typeof NIVEAUX)[number];
export const LIBELLES_NIVEAU: Record<string, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", vip: "VIP" };
export const TON_NIVEAU: Record<string, Ton> = { bronze: "neutre", silver: "info", gold: "accent", vip: "positif" };

export const TYPES_PROMO: Record<TypePromotion, { libelle: string; description: string }> = {
  pourcentage: { libelle: "Pourcentage", description: "−10 % sur des articles, une catégorie ou tout le magasin." },
  montant_fixe: { libelle: "Montant fixe", description: "Un montant retiré par article, ou une fois sur le panier." },
  x_pour_y: { libelle: "X pour le prix de Y", description: "Le 2+1 : trois articles pris, deux payés. Le moins cher est offert." },
  lot: { libelle: "Lot", description: "Plusieurs articles vendus ensemble à un prix spécial." },
  achete_x_obtiens_y: { libelle: "Achetez X, obtenez Y", description: "Deux savons achetés, une éponge à moitié prix ou offerte." },
  seuil_panier: { libelle: "Seuil de panier", description: "Une remise dès que le panier atteint un montant." },
  produit_offert: { libelle: "Produit offert", description: "Un article cadeau, selon le panier ou d'autres achats." },
  prix_membre: { libelle: "Prix membre", description: "Une remise selon le niveau de fidélité du client." },
  prix_grossiste: { libelle: "Prix de gros", description: "Un prix dégressif à partir d'une quantité, pour les grossistes." },
};

type PromotionLue = { type: string; valeur: number | null; regles: Record<string, any> };

/** Une promotion dite en une phrase. `fmt` formate un montant dans la devise de la boutique. */
export function resumePromotion(p: PromotionLue, fmt: (m: number) => string): string {
  const r = p.regles ?? {}, v = p.valeur ?? 0;
  const noms = (ids?: string[]) => (ids?.length ? ids.map((id) => r.libelles?.[id] ?? "article").slice(0, 3).join(", ") + (ids.length > 3 ? "…" : "") : "");
  const cible = [noms(r.produitIds), r.categories?.length ? `catégorie ${r.categories.join(", ")}` : ""].filter(Boolean).join(" · ") || "tous les articles";
  switch (p.type) {
    case "pourcentage": return `−${v} % sur ${cible}`;
    case "montant_fixe": return r.par === "panier" ? `−${fmt(v)} sur le panier (${cible})` : `−${fmt(v)} par unité sur ${cible}`;
    case "seuil_panier": return `${r.mode === "montant" ? `−${fmt(v)}` : `−${v} %`} dès ${fmt(r.minPanier ?? 0)} d'achat`;
    case "x_pour_y": return `${r.x} pour le prix de ${r.y} sur ${cible}`;
    case "lot": return `Lot à ${fmt(v)} : ${(r.composants ?? []).map((c: any) => `${c.quantite} × ${r.libelles?.[c.produitId] ?? "article"}`).join(" + ")}`;
    case "achete_x_obtiens_y": {
      const y = r.obtenir ?? r.acheter;
      return `${r.acheter?.quantite ?? "?"} × ${noms(r.acheter?.produitIds) || "article"} achetés → ${y?.quantite ?? 1} × ${noms(y?.produitIds) || "article"} ${p.valeur === null || v >= 100 ? "offert(s)" : `à −${v} %`}`;
    }
    case "produit_offert": return `${r.quantite ?? 1} × ${noms(r.produitIds) || cible} offert(s)${r.minPanier ? ` dès ${fmt(r.minPanier)} d'achat` : ""}`;
    case "prix_membre": return "Prix membre : " + NIVEAUX.filter((n) => r.niveaux?.[n] > 0).map((n) => `${LIBELLES_NIVEAU[n]} −${r.niveaux[n]} %`).join(", ");
    case "prix_grossiste": return "Prix de gros : " + (r.paliers ?? []).map((x: any) => `dès ${x.minQuantite} → ${x.prix !== undefined ? fmt(x.prix) : `−${x.pct} %`}`).join(", ");
    default: return p.type;
  }
}

export const dateCourte = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
