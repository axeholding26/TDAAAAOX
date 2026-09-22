// Rendu de la vitrine pour une boutique 100% digitale (modeBoutique === "digital")
// — chemin de rendu entièrement séparé du catalogue physique (BlockTreeRenderer)
// et de la page de vente unique (landing). Server component : interroge Prisma
// puis délègue l'affichage au squelette partagé components/storefront/digital/DigitalStoreShell.tsx,
// identique à celui utilisé par l'aperçu live du Constructeur digital.
import { prisma } from "@/lib/prisma";
import { prixClient } from "@/lib/pricing";
import { DEFAULT_DIGITAL_CONFIG, type ThemeConfig } from "@/lib/theme-config";
import { DigitalStoreShell, type DigitalProductVM } from "./DigitalStoreShell";

interface Props {
  tenant: {
    id: string;
    slug: string;
    nomBoutique: string;
    logoUrl: string | null;
    description: string | null;
    pays: string;
    devise: string;
    commissionRate: number;
  };
  cfg: ThemeConfig;
}

const ORDER_BY: Record<string, any> = {
  alphabetique: { nom: "asc" },
  populaires: { ventes: "desc" },
  recents: { createdAt: "desc" },
  "prix-desc": { prix: "desc" },
  "prix-asc": { prix: "asc" },
};

export async function DigitalCatalogPage({ tenant, cfg }: Props) {
  const dc = { ...DEFAULT_DIGITAL_CONFIG, ...(cfg.digitalConfig || {}) };

  const produits = await prisma.produit.findMany({
    where: { tenantId: tenant.id, actif: true, visibleListage: true },
    orderBy: ORDER_BY[dc.tri] || ORDER_BY.recents,
    take: 60,
  });

  const products: DigitalProductVM[] = produits.map((p) => ({
    id: p.id,
    nom: p.nom,
    images: p.images,
    prixAffiche: prixClient(p.prix, tenant.commissionRate ?? 0.06),
    categorie: p.categorie,
    tags: p.tags,
    featured: p.featured,
    ventes: p.ventes,
  }));

  return (
    <DigitalStoreShell
      slug={tenant.slug}
      nomBoutique={tenant.nomBoutique}
      logoUrl={tenant.logoUrl}
      description={tenant.description}
      pays={tenant.pays}
      devise={tenant.devise}
      colors={cfg.colors}
      radius={cfg.radius}
      templateId={dc.templateId}
      digitalConfig={dc}
      products={products}
    />
  );
}
