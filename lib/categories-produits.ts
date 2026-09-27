// Catégories de produits d'une boutique et leurs options de variantes
// (Catalogue → Catégories). Produit.categorie garde le NOM de la catégorie.
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export type OptionCategorie = { nom: string; valeurs: string[] };

/** Options propres : noms et valeurs nettoyés, sans doublons ni vides. */
export function nettoyerOptions(brut: unknown): OptionCategorie[] {
  if (!Array.isArray(brut)) return [];
  const vus = new Set<string>();
  return brut.flatMap((o: any) => {
    const nom = String(o?.nom ?? "").trim().slice(0, 40);
    if (!nom || vus.has(nom.toLowerCase())) return [];
    vus.add(nom.toLowerCase());
    const valeurs = [...new Set((Array.isArray(o?.valeurs) ? o.valeurs : []).map((v: any) => String(v).trim().slice(0, 40)).filter(Boolean))].slice(0, 50) as string[];
    return [{ nom, valeurs }];
  }).slice(0, 10);
}

/** Catégories de la boutique ; la première fois, reprend celles déjà utilisées par ses produits. */
export async function categoriesDeLaBoutique(tenantId: string) {
  const existantes = await prisma.categorieProduit.findMany({ where: { tenantId }, orderBy: [{ ordre: "asc" }, { createdAt: "asc" }] });
  if (existantes.length) return existantes;
  const utilisees = await prisma.produit.findMany({ where: { tenantId, categorie: { not: null } }, select: { categorie: true }, distinct: ["categorie"] });
  const noms = [...new Set(utilisees.map((p) => p.categorie!.trim()).filter(Boolean))];
  if (!noms.length) return [];
  await prisma.categorieProduit.createMany({
    data: noms.map((nom, ordre) => ({ tenantId, nom, slug: slugify(nom) || `categorie-${ordre + 1}`, ordre })),
    skipDuplicates: true,
  });
  return prisma.categorieProduit.findMany({ where: { tenantId }, orderBy: [{ ordre: "asc" }, { createdAt: "asc" }] });
}
