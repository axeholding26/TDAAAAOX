"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useCartStore } from "@/store/cartStore";
import { ATTR_AJOUTER_PANIER } from "@/lib/theme-import-clone";

// Fiche produit (PDP) d'un thème importé/généré tel quel — seul cas parmi
// les 6 pages qui a besoin d'une vraie interactivité : le bouton d'achat,
// retrouvé et marqué ATTR_AJOUTER_PANIER par lib/theme-import-clone.ts
// ::lierProduitAuGabarit (appelée côté serveur, à chaque requête, avec le
// vrai produit demandé — contrairement à l'accueil/la liste boutique, une
// fiche produit ne peut pas être figée au moment de l'import puisque
// chaque URL affiche un produit différent), reçoit ici son vrai onClick
// React — jamais le JS du fichier d'origine, qui n'est ni conservé ni
// exécuté. Un seul exemplaire du produit est cloné (pas de grille), donc
// pas de sélecteur de variante/quantité ici — ajout au panier en quantité 1.
export interface ProduitPourAjoutPanier {
  id: string;
  nom: string;
  prix: number; // prix client déjà calculé (prixClient), pas formaté
  images: string[];
  stock: number;
  type: string;
  fichierUrl?: string | null;
  fichierNom?: string | null;
}

interface Props {
  css: string;
  htmlLie: string; // déjà lié au produit courant (lierProduitAuGabarit), calculé côté serveur
  slug: string;
  produit: ProduitPourAjoutPanier;
}

export function ImportedLiteralProductPage({ css, htmlLie, slug, produit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ajouterItem, setTenant } = useCartStore();

  useEffect(() => {
    const bouton = containerRef.current?.querySelector(`[${ATTR_AJOUTER_PANIER}]`);
    if (!bouton) return;
    const onClick = (e: Event) => {
      e.preventDefault();
      if (produit.type !== "digital" && produit.stock <= 0) return;
      setTenant(slug);
      ajouterItem({
        produitId: produit.id,
        nom: produit.nom,
        prix: produit.prix,
        imageUrl: produit.images[0] ?? undefined,
        stock: produit.type === "digital" ? 9999 : produit.stock,
        quantite: 1,
        type: produit.type as any,
        fichierUrl: produit.fichierUrl ?? undefined,
        fichierNom: produit.fichierNom ?? undefined,
      });
      toast.success(`${produit.nom} ajouté au panier`);
    };
    bouton.addEventListener("click", onClick);
    return () => bouton.removeEventListener("click", onClick);
  }, [produit, slug, ajouterItem, setTenant]);

  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {htmlLie && <div ref={containerRef} dangerouslySetInnerHTML={{ __html: htmlLie }} />}
    </>
  );
}
