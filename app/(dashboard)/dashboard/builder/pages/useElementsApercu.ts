"use client";

import { useEffect, useRef } from "react";
import { appliquerContenus, cssElementsPage, selecteurDe, type ElementsPage } from "@/lib/elements-pages";

const ATTR_SURVOL = "data-axs-survol";
const ID_STYLE = "axs-elements-apercu";
const CSS_SURVOL = `[${ATTR_SURVOL}]{outline:1.5px dashed #F5A623 !important;outline-offset:1px !important;cursor:pointer}`;

/**
 * Aperçu d'une page sans sections (cadre du catalogue, de la commande… ou fiche
 * produit) : chaque élément s'encadre au survol et se sélectionne au clic, et
 * les réglages en cours s'y voient tout de suite, avant même l'enregistrement.
 * `zone` : où écouter (corps du cadre, ou conteneur de la fiche).
 */
export function useElementsApercu(zone: HTMLElement | null, reglages: ElementsPage | undefined, selection: string | null, onChoisir: (el: Element) => void) {
  const choisir = useRef(onChoisir);
  choisir.current = onChoisir;
  const contenus = useRef(reglages?.contenus);
  contenus.current = reglages?.contenus;

  useEffect(() => {
    if (!zone) return;
    let survole: Element | null = null;
    // Élément de la page sous la souris (un <svg> entier plutôt qu'un de ses tracés).
    const cible = (t: EventTarget | null): Element | null => {
      const n = t as Element | null;
      if (!n || n.nodeType !== 1) return null;
      const el = n.closest("svg") ?? n;
      return selecteurDe(el) ? el : null;
    };
    const quitter = () => { survole?.removeAttribute(ATTR_SURVOL); survole = null; };
    const survoler = (e: Event) => { quitter(); survole = cible(e.target); survole?.setAttribute(ATTR_SURVOL, ""); };
    // Pas de preventDefault : accordéons, onglets, variantes restent utilisables (liens et formulaires sont déjà bloqués).
    const cliquer = (e: Event) => { const el = cible(e.target); if (el) choisir.current(el); };
    // Textes remis par la page (React re-rend un panier, un formulaire…) : réglages réappliqués.
    const obs = new MutationObserver(() => appliquerContenus(zone.ownerDocument, contenus.current));
    obs.observe(zone, { childList: true, subtree: true });
    zone.addEventListener("mouseover", survoler);
    zone.addEventListener("mouseleave", quitter);
    zone.addEventListener("click", cliquer, true);
    return () => {
      obs.disconnect();
      zone.removeEventListener("mouseover", survoler);
      zone.removeEventListener("mouseleave", quitter);
      zone.removeEventListener("click", cliquer, true);
      quitter();
      zone.ownerDocument.getElementById(ID_STYLE)?.remove();
    };
  }, [zone]);

  useEffect(() => {
    if (!zone) return;
    const doc = zone.ownerDocument;
    let style = doc.getElementById(ID_STYLE);
    // En fin de <body> : passe devant la feuille enregistrée de la page (même priorité, plus loin).
    if (!style) { style = doc.createElement("style"); style.id = ID_STYLE; doc.body.appendChild(style); }
    style.textContent = CSS_SURVOL + cssElementsPage(reglages)
      + (selection ? `${selection}{outline:2px solid #F5A623 !important;outline-offset:2px !important}` : "");
    appliquerContenus(doc, reglages?.contenus);
  }, [zone, reglages, selection]);
}
