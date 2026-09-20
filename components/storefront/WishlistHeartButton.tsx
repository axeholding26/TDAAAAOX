"use client";

import { Heart } from "lucide-react";
import { useWishlistStore } from "@/store/wishlistStore";

export function WishlistHeartButton({
  produitId, accent, fond, size = 15, className = "",
}: {
  produitId: string; accent: string; fond?: string; size?: number; className?: string;
}) {
  const dans = useWishlistStore((s) => s.estDansWishlist(produitId));
  const toggle = useWishlistStore((s) => s.toggle);

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(produitId); }}
      className={`flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${className}`}
      style={{ backgroundColor: fond ? `${fond}e0` : "rgba(255,255,255,0.85)" }}
      aria-label={dans ? "Retirer de la liste de souhaits" : "Ajouter à la liste de souhaits"}
      aria-pressed={dans}
    >
      <Heart size={size} style={{ color: accent }} fill={dans ? accent : "none"} strokeWidth={dans ? 0 : 2} />
    </button>
  );
}
