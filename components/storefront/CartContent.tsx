// Contenu panier — client component
"use client";
import { useCartStore } from "@/store/cartStore";
import { formatMontant } from "@/lib/utils";
import Link from "next/link";
import { Trash2, Plus, Minus, ShoppingBag, Package } from "lucide-react";

interface Props {
  theme: { fond: string; accent: string; texte: string; surface: string };
  slug: string;
  devise: string;
}

export function CartContent({ theme, slug, devise }: Props) {
  const { items, modifierQuantite, retirerItem, sousTotal, totalAvecReduction, reductionMontant, codePromo, totalItems } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
        <p className="text-xl font-playfair opacity-60 mb-4">Votre panier est vide</p>
        <Link href={`/${slug}/produits`} className="inline-block px-8 py-3 rounded-xl font-semibold transition-all hover:opacity-90" style={{ backgroundColor: theme.accent, color: theme.fond }}>
          Découvrir nos produits
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Articles */}
      <div className="lg:col-span-2 space-y-4">
        {items.map((item) => (
          <div key={`${item.produitId}-${item.variante}`} className="flex gap-4 p-4 rounded-2xl border" style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}20` }}>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.nom} className="w-20 h-20 object-cover rounded-xl flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: theme.fond }}><Package size={28} className="opacity-30" /></div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1 truncate">{item.nom}</h3>
              {item.variante && <p className="text-xs opacity-50 mb-2">{item.variante}</p>}
              <p className="font-bold" style={{ color: theme.accent }}>{formatMontant(item.prix, devise)}</p>
            </div>
            <div className="flex flex-col items-end justify-between">
              <button onClick={() => retirerItem(item.produitId, item.variante)} className="text-red-400 hover:opacity-80 transition-opacity p-1">
                <Trash2 size={14} />
              </button>
              <div className="flex items-center gap-2 rounded-xl overflow-hidden border" style={{ borderColor: `${theme.accent}30` }}>
                <button onClick={() => modifierQuantite(item.produitId, item.quantite - 1, item.variante)} className="w-8 h-8 flex items-center justify-center hover:opacity-80">
                  <Minus size={12} />
                </button>
                <span className="w-6 text-center text-sm font-semibold">{item.quantite}</span>
                <button onClick={() => modifierQuantite(item.produitId, item.quantite + 1, item.variante)} className="w-8 h-8 flex items-center justify-center hover:opacity-80" disabled={item.quantite >= item.stock}>
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Résumé commande */}
      <div className="space-y-4">
        <div className="rounded-2xl border p-6 space-y-4" style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}20` }}>
          <h2 className="font-bold font-playfair">Résumé</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="opacity-60">Sous-total ({totalItems()} article{totalItems() > 1 ? "s" : ""})</span>
              <span>{formatMontant(sousTotal(), devise)}</span>
            </div>
            {reductionMontant > 0 && (
              <div className="flex justify-between text-green-500">
                <span>Code promo ({codePromo})</span>
                <span>-{formatMontant(reductionMontant, devise)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="opacity-60">Livraison</span>
              <span className="text-green-500">Calculée au checkout</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-base" style={{ borderColor: `${theme.accent}20` }}>
              <span>Total</span>
              <span style={{ color: theme.accent }}>{formatMontant(totalAvecReduction(), devise)}</span>
            </div>
          </div>

          <Link href={`/${slug}/checkout`} className="block w-full text-center py-4 rounded-xl font-semibold text-sm transition-all hover:opacity-90" style={{ backgroundColor: theme.accent, color: theme.fond }}>
            Passer la commande
          </Link>
        </div>

        {/* Code promo */}
        <CodePromoInput theme={theme} slug={slug} devise={devise} />
      </div>
    </div>
  );
}

function CodePromoInput({ theme, slug, devise }: Props) {
  const { appliquerCodePromo, supprimerCodePromo, codePromo } = useCartStore();

  async function appliquer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const code = (form.elements.namedItem("code") as HTMLInputElement).value.trim();
    if (!code) return;
    try {
      const res = await fetch(`/api/codes-promo/verifier?code=${code}&slug=${slug}`);
      if (!res.ok) throw new Error();
      const { reduction, type, valeur } = await res.json();
      appliquerCodePromo(code, reduction);
    } catch {
      alert("Code promo invalide ou expiré");
    }
  }

  if (codePromo) {
    return (
      <div className="rounded-2xl border p-4 flex items-center justify-between" style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}20` }}>
        <div>
          <p className="text-sm font-semibold">Code : <span style={{ color: theme.accent }}>{codePromo}</span></p>
          <p className="text-xs opacity-50">Réduction appliquée</p>
        </div>
        <button onClick={supprimerCodePromo} className="text-xs text-red-400 hover:opacity-80">Retirer</button>
      </div>
    );
  }

  return (
    <form onSubmit={appliquer} className="flex gap-2">
      <input name="code" placeholder="Code promo" className="flex-1 px-4 py-3 rounded-xl text-sm border focus:outline-none" style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}30`, color: theme.texte }} />
      <button type="submit" className="px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90" style={{ backgroundColor: `${theme.accent}20`, color: theme.accent, border: `1px solid ${theme.accent}40` }}>
        OK
      </button>
    </form>
  );
}
