// Store Zustand — vente en cours à l'écran de caisse (AXSO POS 2.0).
// Une seule vente à la fois : lignes, remise globale, code promo, client, note,
// et la CLÉ D'IDEMPOTENCE de cette vente — générée une fois, réutilisée à
// chaque nouvel essai d'encaissement, renouvelée seulement quand la vente est
// terminée ou vidée. Les totaux ne vivent pas ici : ils sont calculés
// (lib/pos/tarification.ts) puis confirmés par le serveur.
// En mémoire par défaut. Avec le mode hors ligne (drapeau offline_pos), le
// panier ET sa clé de vente sont gardés dans IndexedDB et restaurés après un
// rechargement : components/pos/hors-ligne/useHorsLigne.ts s'abonne à ce store
// (subscribe / setState), rien à changer ici.
import { create } from "zustand";
import { nouvelleCle } from "@/lib/pos/client/transport";
import { ajouterLigne, type ContenuPanier, type LigneCaisse } from "@/components/pos/caisse/logique";

const VIDE: ContenuPanier = { lignes: [], remise: null, codePromo: "", client: null, note: "" };

type PosStore = ContenuPanier & {
  cleVente: string;
  ajouter: (ligne: LigneCaisse) => void;
  modifier: (id: string, modif: Partial<LigneCaisse>) => void;
  retirer: (id: string) => void;
  definir: (modif: Partial<Omit<ContenuPanier, "lignes">>) => void;
  /** Remplace la vente en cours (reprise d'un panier suspendu). */
  charger: (contenu: Partial<ContenuPanier>) => void;
  /** Vente terminée, suspendue ou annulée : panier vide et nouvelle clé. */
  vider: () => void;
};

export const usePosStore = create<PosStore>()((set) => ({
  ...VIDE,
  cleVente: nouvelleCle(),
  ajouter: (ligne) => set((s) => ({ lignes: ajouterLigne(s.lignes, ligne) })),
  modifier: (id, modif) => set((s) => ({ lignes: s.lignes.map((l) => (l.id === id ? { ...l, ...modif } : l)) })),
  retirer: (id) => set((s) => ({ lignes: s.lignes.filter((l) => l.id !== id) })),
  definir: (modif) => set(modif),
  charger: (contenu) => set({ ...VIDE, ...contenu, cleVente: nouvelleCle() }),
  vider: () => set({ ...VIDE, cleVente: nouvelleCle() }),
}));
