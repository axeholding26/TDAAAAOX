import Link from "next/link";
import { Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { prixClient } from "@/lib/pricing";
import { formatMontant } from "@/lib/utils";
import { WishlistHeartButton } from "@/components/storefront/WishlistHeartButton";
import type { BlockRenderProps } from "../types";

const COLONNES_MAP: Record<number, string> = {
  2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
};

// Widget "Produits" (atome, vague 2) — seul widget de la bibliothèque à
// interroger Prisma directement : rendu uniquement côté SSR storefront (via
// BlockTreeRenderer, `tenantId` fourni par app/(storefront)/[slug]/page.tsx).
// Le canevas du constructeur (client, sans Prisma) affiche un aperçu
// statique à la place — voir BuilderCanvas/CanvasNode.
export async function ProductsBlock({ config, colors, slug, tenantId }: BlockRenderProps) {
  if (!tenantId) return null;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { commissionRate: true, devise: true } });
  if (!tenant) return null;

  const nombre = Math.min(Math.max(Number(config.nombre) || 8, 1), 24);
  const colonnes = COLONNES_MAP[Number(config.colonnes) || 4] || COLONNES_MAP[4];
  const orderBy =
    config.tri === "ventes" ? { ventes: "desc" as const } :
    config.tri === "featured" ? { featured: "desc" as const } :
    { createdAt: "desc" as const };

  const produits = await prisma.produit.findMany({
    where: { tenantId, actif: true },
    orderBy,
    take: nombre,
  });

  if (produits.length === 0) return null;

  return (
    <div className="py-2">
      {config.titre && <h2 className="text-2xl sm:text-3xl font-bold font-playfair mb-6" style={{ color: colors.texte }}>{config.titre}</h2>}
      <div className={`grid ${colonnes} gap-4 sm:gap-6`}>
        {produits.map((p) => {
          const prixAffiche = prixClient(p.prix, tenant.commissionRate ?? 0.06);
          return (
            <Link key={p.id} href={`/${slug}/produits/${p.id}`} className="group">
              <div className="rounded-2xl overflow-hidden border transition-all duration-300 group-hover:shadow-lg" style={{ backgroundColor: colors.fond, borderColor: `${colors.accent}20` }}>
                <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: colors.fond }}>
                  {p.images[0] ? (
                    <img src={p.images[0]} alt={p.nom} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Package size={40} className="opacity-20" /></div>
                  )}
                  <WishlistHeartButton produitId={p.id} accent={colors.accent} fond={colors.fond} className="absolute top-3 right-3 w-8 h-8 rounded-full" />
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-sm mb-2 line-clamp-2 leading-snug" style={{ color: colors.texte }}>{p.nom}</h3>
                  <span className="font-bold text-sm" style={{ color: colors.accent }}>{formatMontant(prixAffiche, tenant.devise)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
