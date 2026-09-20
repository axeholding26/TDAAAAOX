"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Package } from "lucide-react";
import { useWishlistStore } from "@/store/wishlistStore";
import { WishlistHeartButton } from "./WishlistHeartButton";
import { formatMontant } from "@/lib/utils";

interface Produit {
  id: string; nom: string; images: string[]; categorie: string | null;
  stock: number; ventes: number; prixAffiche: number; prixCompareAffiche: number | null;
}

export function WishlistGrid({
  slug, devise, accent, fond, texte, surface, radius,
  container, gridProduits, carteClass, btnPrimaryStyle, btnPrimaryClass,
}: {
  slug: string; devise: string; accent: string; fond: string; texte: string; surface: string; radius: string;
  container: string; gridProduits: string; carteClass: string; btnPrimaryStyle: React.CSSProperties; btnPrimaryClass: string;
}) {
  const produitIds = useWishlistStore((s) => s.produitIds);
  const [produits, setProduits] = useState<Produit[] | null>(null);

  useEffect(() => {
    if (produitIds.length === 0) { setProduits([]); return; }
    fetch(`/api/storefront/wishlist?slug=${encodeURIComponent(slug)}&ids=${produitIds.join(",")}`)
      .then((r) => r.json())
      .then((d) => setProduits(d.produits ?? []))
      .catch(() => setProduits([]));
  }, [slug, produitIds.join(",")]);

  return (
    <div className={`${container} mx-auto px-4 sm:px-6 lg:px-8 py-10`}>
      <div className="mb-8">
        <span className="text-xs font-semibold uppercase tracking-widest mb-1 flex items-center gap-2" style={{ color: accent }}>
          <Heart size={13} /> Liste de souhaits
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold font-playfair">Mes favoris</h1>
      </div>

      {produits === null ? (
        <div className="text-center py-24" style={{ opacity: 0.4 }}>Chargement…</div>
      ) : produits.length === 0 ? (
        <div className="text-center py-24">
          <Heart size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-semibold mb-2">Aucun favori pour le moment</p>
          <p className="text-sm mb-6" style={{ opacity: 0.5 }}>Cliquez sur le cœur d'un produit pour l'ajouter ici.</p>
          <Link href={`/${slug}/produits`} className={`text-sm ${btnPrimaryClass}`} style={btnPrimaryStyle}>
            Découvrir les produits
          </Link>
        </div>
      ) : (
        <div className={`grid ${gridProduits} gap-4 sm:gap-5`}>
          {produits.map((p) => {
            const remise = p.prixCompareAffiche && p.prixCompareAffiche > p.prixAffiche
              ? Math.round(((p.prixCompareAffiche - p.prixAffiche) / p.prixCompareAffiche) * 100)
              : 0;
            return (
              <Link key={p.id} href={`/${slug}/produits/${p.id}`} className="group">
                <div className={`rounded-2xl overflow-hidden ${carteClass}`} style={{ backgroundColor: surface, borderColor: `${accent}12`, borderRadius: radius }}>
                  <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: fond }}>
                    {p.images[0] ? (
                      <img src={p.images[0]} alt={p.nom} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package size={40} className="opacity-20" /></div>
                    )}
                    <WishlistHeartButton produitId={p.id} accent={accent} fond={fond} className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full" />
                    {remise > 0 && (
                      <span className="absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-red-500 text-white">-{remise}%</span>
                    )}
                    {p.stock === 0 && (
                      <span className="absolute bottom-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-black/60 text-white">Épuisé</span>
                    )}
                  </div>
                  <div className="p-3.5">
                    <p className="font-medium text-sm leading-snug line-clamp-2 mb-2">{p.nom}</p>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: accent }}>{formatMontant(p.prixAffiche, devise)}</span>
                      {remise > 0 && <span className="text-xs line-through" style={{ opacity: 0.35 }}>{formatMontant(p.prixCompareAffiche!, devise)}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
