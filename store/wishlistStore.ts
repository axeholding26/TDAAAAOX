// Store Zustand — Wishlist (liste de souhaits)
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistStore {
  produitIds: string[];
  ajouter: (produitId: string) => void;
  supprimer: (produitId: string) => void;
  toggle: (produitId: string) => void;
  estDansWishlist: (produitId: string) => boolean;
  vider: () => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      produitIds: [],

      ajouter: (produitId) =>
        set((state) =>
          state.produitIds.includes(produitId)
            ? state
            : { produitIds: [...state.produitIds, produitId] }
        ),

      supprimer: (produitId) =>
        set((state) => ({
          produitIds: state.produitIds.filter((id) => id !== produitId),
        })),

      toggle: (produitId) => {
        if (get().estDansWishlist(produitId)) {
          get().supprimer(produitId);
        } else {
          get().ajouter(produitId);
        }
      },

      estDansWishlist: (produitId) => get().produitIds.includes(produitId),

      vider: () => set({ produitIds: [] }),
    }),
    {
      name: "axso-wishlist",
    }
  )
);
