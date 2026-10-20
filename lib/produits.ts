// Modification et suppression d'un produit : même logique pour le formulaire
// du dashboard (app/api/produits/[id]) et pour AXIA (modifier_produit, supprimer_produit).
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export const schemaProduitMaj = z.object({
  nom: z.string().min(2).optional(),
  slug: z.string().optional(),
  description: z.string().optional().nullable(),
  prix: z.number().positive().optional(),
  prixCompare: z.number().positive().optional().nullable(),
  cout: z.number().min(0).optional().nullable(),
  stock: z.number().int().min(0).optional(),
  sku: z.string().optional().nullable(),
  codeBarres: z.string().optional().nullable(),
  images: z.array(z.string()).optional(),
  videos: z.array(z.string()).optional(),
  categorie: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  actif: z.boolean().optional(),
  featured: z.boolean().optional(),
  poids: z.number().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDesc: z.string().optional().nullable(),
  type: z.enum(["physique", "digital", "dropshipping", "fichier", "licence", "bundle", "formation"]).optional(),
  fichierUrl: z.string().optional().nullable(),
  fichierNom: z.string().optional().nullable(),
  fichierTaille: z.number().optional().nullable(),
  instructionsTelechargement: z.string().optional().nullable(),
  prixFournisseur: z.number().optional().nullable(),
  urlFournisseur: z.string().optional().nullable(),
  nomFournisseur: z.string().optional().nullable(),
  affiliationActive: z.boolean().optional(),
  tauxCommissionAff: z.number().min(0).max(1).optional().nullable(),
  ogImage: z.string().optional().nullable(),
  masquerVentes: z.boolean().optional(),
  visibleListage: z.boolean().optional(),
  texteBoutonAchat: z.string().optional().nullable(),
  faq: z.array(z.object({ question: z.string(), reponse: z.string(), image: z.string().optional() })).optional().nullable(),
  champsCommande: z.array(z.object({
    label: z.string(), type: z.string(), requis: z.boolean(),
    options: z.array(z.string()).optional(),
  })).optional().nullable(),
});

/**
 * Met à jour un produit de la boutique. Lève ZodError (données invalides) ou
 * l'erreur Prisma P2002 (code-barres déjà pris) ; renvoie null si le produit est introuvable.
 */
export async function modifierProduit(tenantId: string, id: string, body: Record<string, any>) {
  const data = schemaProduitMaj.parse(body);

  const produit = await prisma.produit.findFirst({ where: { id, tenantId } });
  if (!produit) return null;

  const updateData: any = { ...data };

  // Champs non couverts par le spread Zod — appliqués directement depuis le body
  const CHAMPS_DIRECTS = [
    "type", "slug", "videos", "fichierUrl", "fichierNom", "fichierTaille",
    "instructionsTelechargement", "prixFournisseur", "urlFournisseur", "nomFournisseur",
    "ogImage", "masquerVentes", "visibleListage", "texteBoutonAchat", "faq", "champsCommande",
  ] as const;
  for (const champ of CHAMPS_DIRECTS) {
    if (champ in body) updateData[champ] = body[champ];
  }

  // Régénérer slug si le nom change (sans écraser le slug envoyé explicitement)
  if (data.nom && data.nom !== produit.nom && !("slug" in body)) {
    const newSlug = slugify(data.nom);
    const slugExiste = await prisma.produit.findFirst({
      where: { tenantId, slug: newSlug, id: { not: id } },
    });
    if (!slugExiste) updateData.slug = newSlug;
  }

  return prisma.produit.update({ where: { id }, data: updateData });
}

/**
 * Supprime définitivement un produit. Refusé s'il a déjà été commandé ou
 * mouvementé en stock (factures, commandes et journal y renvoient) : il faut
 * alors le désactiver. Ses variantes et sa ventilation par entrepôt partent avec lui.
 */
export async function supprimerProduit(tenantId: string, id: string): Promise<{ ok: true; nom: string } | { ok: false; status: number; error: string }> {
  const p = await prisma.produit.findFirst({ where: { id, tenantId }, select: { nom: true, _count: { select: { lignesCommande: true, stockMouvements: true } } } });
  if (!p) return { ok: false, status: 404, error: "Produit introuvable" };
  if (p._count.lignesCommande || p._count.stockMouvements) {
    return { ok: false, status: 409, error: `« ${p.nom} » a déjà été commandé ou mouvementé en stock : il ne peut pas être supprimé. Désactive-le pour le retirer de la boutique.` };
  }
  try {
    await prisma.$transaction([
      prisma.stockEntrepot.deleteMany({ where: { produitId: id } }),
      prisma.variante.deleteMany({ where: { produitId: id } }),
      prisma.produit.delete({ where: { id } }),
      // Import IA qui avait créé ce produit : il ne se dit plus « prêt » ni « publié » (ses fichiers
      // stockés restent ; le rappeler avec le même import_key recrée le produit).
      prisma.importCreation.updateMany({ where: { tenantId, produitId: id }, data: { produitId: null, statut: "failed", prochaineTentative: null, derniereErreur: "Produit supprimé par le marchand." } }),
    ]);
  } catch (err) {
    // Encore lié à autre chose (avis, accès clients, liens d'affiliation…) : on garde tout.
    if ((err as any)?.code === "P2003") return { ok: false, status: 409, error: `« ${p.nom} » est encore lié à d'autres éléments (avis, accès clients, affiliation…) : désactive-le plutôt.` };
    throw err;
  }
  return { ok: true, nom: p.nom };
}

/**
 * Nouvelle version PAYANTE d'un produit à télécharger : copie en brouillon (textes, prix, images,
 * réglages), SANS les fichiers — le marchand y dépose la nouvelle version. L'ancien produit et
 * l'accès de ses acheteurs ne changent pas. Les fichiers ne sont jamais partagés entre les deux :
 * remplacer l'un effacerait le fichier de l'autre.
 */
export async function creerNouvelleVersion(tenantId: string, id: string): Promise<{ ok: true; id: string } | { ok: false; status: number; error: string }> {
  const p = await prisma.produit.findFirst({ where: { id, tenantId, type: { in: ["digital", "fichier"] } }, include: { produitFichier: true } });
  if (!p) return { ok: false, status: 404, error: "Produit à télécharger introuvable" };
  let slug = `${p.slug}-nouvelle-version`;
  for (let n = 2; await prisma.produit.findFirst({ where: { tenantId, slug }, select: { id: true } }); n++) slug = `${p.slug}-nouvelle-version-${n}`;
  const v2 = await prisma.produit.create({
    data: {
      tenantId, slug, versionPrecedenteId: p.id, actif: false, type: p.type,
      nom: `${p.nom} (nouvelle version)`.slice(0, 200), description: p.description, descriptionIA: p.descriptionIA,
      prix: p.prix, prixCompare: p.prixCompare, images: p.images, videos: p.videos, categorie: p.categorie, tags: p.tags,
      metaTitle: p.metaTitle, metaDesc: p.metaDesc, ogImage: p.ogImage, masquerVentes: p.masquerVentes, visibleListage: p.visibleListage,
      texteBoutonAchat: p.texteBoutonAchat, faq: p.faq ?? undefined, champsCommande: p.champsCommande ?? undefined,
      instructionsTelechargement: p.instructionsTelechargement, affiliationActive: p.affiliationActive, tauxCommissionAff: p.tauxCommissionAff,
      ...(p.produitFichier ? { produitFichier: { create: { limitAchats: p.produitFichier.limitAchats, motDePasse: p.produitFichier.motDePasse, filigrane: p.produitFichier.filigrane, instructionsAchat: p.produitFichier.instructionsAchat } } } : {}),
    },
    select: { id: true },
  });
  return { ok: true, id: v2.id };
}
