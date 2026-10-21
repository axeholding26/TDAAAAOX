"use client";

import { useEffect, useRef, useState } from "react";
import { pageDepuisChemin, type PageEditee } from "./pages";
import { useElementsApercu } from "./useElementsApercu";
import type { ElementsPage } from "@/lib/elements-pages";
import { useT } from "@/components/I18nProvider";

type Device = "desktop" | "tablet" | "mobile";
const LARGEUR: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };

// Aperçu d'une page de la vitrine (catalogue, panier, commande, À propos,
// Contact) : la vraie page, dans un cadre à la largeur de l'appareil choisi
// (le rendu responsive est donc exact). Rechargé à chaque enregistrement
// (`version`), à la même hauteur de défilement. Chaque élément (lien compris)
// se sélectionne d'un clic pour être réglé dans le panneau de droite ; la page
// liée s'ouvre depuis ce panneau.
export function ApercuPage({ slug, chemin, device, version, onNaviguer, reglages, selection, onChoisir }: {
  slug: string; chemin: string; device: Device; version: number;
  onNaviguer: (page: PageEditee) => void;
  reglages?: ElementsPage; selection: string | null; onChoisir: (el: Element) => void;
}) {
  const t = useT();
  const cadre = useRef<HTMLIFrameElement>(null);
  const actuelle = pageDepuisChemin(slug, `/${slug}${chemin}`);

  const [corps, setCorps] = useState<HTMLElement | null>(null);
  useElementsApercu(corps, reglages, selection, onChoisir);

  const premiere = useRef(version);
  const defilement = useRef(0);
  useEffect(() => {
    if (version === premiere.current) return; // premier affichage : déjà chargé par src
    const win = cadre.current?.contentWindow;
    defilement.current = win?.scrollY ?? 0;
    win?.location.reload();
  }, [version]);

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[#F1F2F4] p-4 lg:p-5">
      <iframe
        ref={cadre}
        key={chemin}
        src={`/${slug}${chemin}`}
        title={t("Aperçu de la page")}
        className="mx-auto flex-1 w-full bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-[width] duration-300 border-0"
        style={{ width: LARGEUR[device], maxWidth: "100%" }}
        onLoad={() => {
          try {
            const win = cadre.current?.contentWindow;
            if (!win) return;
            const page = pageDepuisChemin(slug, win.location.pathname);
            if (page && page !== actuelle) onNaviguer(page);
            neutraliser(win);
            if (defilement.current) { win.scrollTo(0, defilement.current); defilement.current = 0; }
            setCorps(win.document.body);
          } catch { /* autre origine : ignoré */ }
        }}
      />
    </div>
  );
}

// Rien dans l'aperçu ne quitte le Constructeur : liens et formulaires bloqués
// (en capture, avant les <Link> de Next qui respectent defaultPrevented).
// Accordéons, onglets, variantes… (simples clics sans navigation) restent actifs.
function neutraliser(win: Window) {
  const doc = win.document;
  win.open = () => null;
  const surLien = (e: MouseEvent) => {
    const lien = (e.target as Element | null)?.closest?.("a[href]");
    const href = lien?.getAttribute("href");
    if (!href || href.startsWith("#")) return; // ancre interne : reste sur la page
    e.preventDefault();
  };
  doc.addEventListener("click", surLien, true);
  doc.addEventListener("auxclick", surLien, true); // clic molette : nouvel onglet
  doc.addEventListener("submit", (e) => e.preventDefault(), true);
}
