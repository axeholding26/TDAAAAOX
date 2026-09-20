// Store Zustand — Panier d'achat
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ItemPanier } from "@/types";
import { trackPixelEvent } from "@/components/storefront/MetaPixel";

interface CartStore {
  items: ItemPanier[];
  tenantSlug: string | null;
  codePromo: string | null;
  reductionMontant: number;

  // Actions
  ajouterItem: (item: Omit<ItemPanier, "quantite"> & { quantite?: number }) => void;
  retirerItem: (produitId: string, variante?: string) => void;
  modifierQuantite: (produitId: string, quantite: number, variante?: string) => void;
  viderPanier: () => void;
  setTenant: (slug: string) => void;
  appliquerCodePromo: (code: string, reduction: number) => void;
  supprimerCodePromo: () => void;

  // Calculs
  totalItems: () => number;
  sousTotal: () => number;
  totalAvecReduction: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      tenantSlug: null,
      codePromo: null,
      reductionMontant: 0,

      ajouterItem: (nouvelItem) => {
        const quantite = nouvelItem.quantite ?? 1;
        trackPixelEvent("AddToCart", {
          content_ids: [nouvelItem.produitId],
          content_name: nouvelItem.nom,
          content_type: "product",
          value: nouvelItem.prix * quantite,
        });
        set((state) => {
          const existant = state.items.findIndex(
            (i) => i.produitId === nouvelItem.produitId && i.variante === nouvelItem.variante
          );
          if (existant >= 0) {
            const nouveauxItems = [...state.items];
            const nouvelleQte = Math.min(
              nouveauxItems[existant].quantite + quantite,
              nouvelItem.stock
            );
            nouveauxItems[existant] = { ...nouveauxItems[existant], quantite: nouvelleQte };
            return { items: nouveauxItems };
          }
          return {
            items: [...state.items, { ...nouvelItem, quantite: Math.min(quantite, nouvelItem.stock) }],
          };
        });
      },

      retirerItem: (produitId, variante) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.produitId === produitId && i.variante === variante)
          ),
        }));
      },

      modifierQuantite: (produitId, quantite, variante) => {
        if (quantite <= 0) {
          get().retirerItem(produitId, variante);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.produitId === produitId && i.variante === variante
              ? { ...i, quantite: Math.min(quantite, i.stock) }
              : i
          ),
        }));
      },

      viderPanier: () => set({ items: [], codePromo: null, reductionMontant: 0 }),

      setTenant: (slug) => set({ tenantSlug: slug }),

      appliquerCodePromo: (code, reduction) =>
        set({ codePromo: code, reductionMontant: reduction }),

      supprimerCodePromo: () => set({ codePromo: null, reductionMontant: 0 }),

      totalItems: () => get().items.reduce((s, i) => s + i.quantite, 0),

      sousTotal: () =>
        get().items.reduce((s, i) => s + i.prix * i.quantite, 0),

      totalAvecReduction: () => {
        const sous = get().sousTotal();
        return Math.max(0, sous - get().reductionMontant);
      },
    }),
    {
      name: "axso-panier",
      partialize: (state) => ({
        items: state.items,
        tenantSlug: state.tenantSlug,
        codePromo: state.codePromo,
        reductionMontant: state.reductionMontant,
      }),
    }
  )
);
