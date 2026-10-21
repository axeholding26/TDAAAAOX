"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pageDepuisChemin } from "@/lib/pages-boutique";
import { appliquerContenus, cssElementsPage, type ElementsPages } from "@/lib/elements-pages";
import { StyleCss } from "./StyleCss";

// Réglages par élément de la page affichée (catalogue, commande, À propos,
// contact, fiche produit) faits dans le Constructeur : styles dès le serveur,
// textes/liens/images réappliqués après chaque rendu de la page.
export function ElementsPagesVitrine({ slug, elementsPages }: { slug: string; elementsPages?: ElementsPages }) {
  const page = pageDepuisChemin(slug, usePathname() ?? "");
  const reglages = page ? elementsPages?.[page] : undefined;
  const contenus = reglages?.contenus;

  useEffect(() => {
    // Dans le cadre d'aperçu du Constructeur, c'est lui qui applique les réglages en cours (pas encore enregistrés).
    if (!contenus || !Object.keys(contenus).length || window.frameElement) return;
    const appliquer = () => appliquerContenus(document, contenus);
    appliquer();
    const obs = new MutationObserver(appliquer);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [contenus]);

  const css = cssElementsPage(reglages);
  return css ? <StyleCss css={css} /> : null;
}
