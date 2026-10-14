import Link from "next/link";
import { Package } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { prixClient } from "@/lib/pricing";
import { Prix } from "@/components/storefront/DeviseVitrine";
import { WishlistHeartButton } from "@/components/storefront/WishlistHeartButton";
import type { BlockRenderProps } from "../types";
import { getT } from "@/lib/i18n/serveur";
import { requeteLiaison, selectionner } from "@/lib/builder/liaisons";

// Classes écrites en entier (Tailwind ne génère que ce qu'il lit dans le code).
const MOBILE: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2" };
const TABLETTE: Record<number, string> = { 2: "@min-[640px]:grid-cols-2", 3: "@min-[640px]:grid-cols-3", 4: "@min-[640px]:grid-cols-4" };
const BUREAU: Record<number, string> = { 2: "@min-[1024px]:grid-cols-2", 3: "@min-[1024px]:grid-cols-3", 4: "@min-[1024px]:grid-cols-4" };

/** Sans colonnes tablette/mobile choisies : 2 colonnes sur mobile, 3 au plus sur tablette (comme avant). */
function classesColonnes(config: Record<string, any>) {
  const d = BUREAU[Number(config.colonnes)] ? Number(config.colonnes) : 4;
  const t = TABLETTE[Number(config.colonnesTablette)] ? Number(config.colonnesTablette) : Math.min(d, 3);
  const m = MOBILE[Number(config.colonnesMobile)] ? Number(config.colonnesMobile) : 2;
  return `${MOBILE[m]} ${TABLETTE[t]} ${BUREAU[d]}`;
}

// Widget "Produits" (atome, vague 2) — seul widget de la bibliothèque à
// interroger Prisma directement : rendu uniquement côté SSR storefront (via
// BlockTreeRenderer, `tenantId` fourni par app/(storefront)/[slug]/page.tsx).
// Le canevas du constructeur (client, sans Prisma) affiche un aperçu
// statique à la place — voir BuilderCanvas/CanvasNode.
export async function ProductsBlock({ config, colors, slug, container, tenantId }: BlockRenderProps) {
  const t = await getT();
  if (!tenantId) return null;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { commissionRate: true, devise: true } });
  if (!tenant) return null;

  const colonnes = classesColonnes(config);
  // Règle de liaison (meilleures ventes, collection, forte marge, dormants…) : lib/builder/liaisons.ts.
  const r = requeteLiaison(config, tenantId);
  const lignes = await prisma.produit.findMany({
    where: r.where as any,
    orderBy: r.orderBy as any,
    take: r.take,
    ...(r.ventesDepuis ? { include: { _count: { select: { lignesCommande: { where: { commande: { createdAt: { gte: r.ventesDepuis }, statut: { not: "annulee" } } } } } } } } : {}),
  });
  const produits = selectionner(lignes, r);

  if (produits.length === 0) return null;

  return (
    <div className={`py-2 ${container} mx-auto px-4 @min-[640px]:px-6 @min-[1024px]:px-8`}>
      {config.titre && <h2 className="text-2xl @min-[640px]:text-3xl font-bold font-playfair mb-6" style={{ color: colors.texte }}>{t(config.titre)}</h2>}
      <div className={`grid ${colonnes} gap-4 @min-[640px]:gap-6`}>
        {produits.map((p) => {
          const prixAffiche = prixClient(p.prix, tenant.commissionRate ?? 0.1, p.type);
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
                  <h3 className="font-medium text-sm mb-2 line-clamp-2 leading-snug" style={{ color: colors.texte }}>{t(p.nom)}</h3>
                  <span className="font-bold text-sm" style={{ color: colors.accent }}><Prix montant={prixAffiche} devise={tenant.devise} /></span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
