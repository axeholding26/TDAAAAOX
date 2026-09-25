"use client";
import { useEffect } from "react";
import { useCartStore } from "@/store/cartStore";

// Monté une fois par le layout de la vitrine :
//  - recharge le panier sauvegardé APRÈS le premier rendu (store en
//    skipHydration) — serveur et navigateur rendent d'abord la même chose,
//    plus d'erreur d'hydratation sur le panier et la commande ;
//  - affiche le vrai nombre d'articles dans le compteur de l'en-tête des
//    designs AXSO (#cartCount, HTML statique qui affichait toujours 0).
//    Par CSS (::after) et jamais en modifiant ce HTML : React compare ce
//    HTML à celui du serveur pendant l'hydratation.
export function PanierVitrine() {
  const nb = useCartStore((s) => s.items.reduce((n, i) => n + i.quantite, 0));
  useEffect(() => { useCartStore.persist.rehydrate(); }, []);
  if (!nb) return null;
  const css = `[data-axs-embed-html] #cartCount{visibility:hidden;position:relative}`
    + `[data-axs-embed-html] #cartCount::after{content:"${nb}";visibility:visible;position:absolute;inset:0;display:flex;align-items:center;justify-content:center}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
