"use client";
// Carte de l'Afrique (Leaflet, chargé à la demande côté client) : un cercle par pays,
// rayon proportionnel à la métrique choisie (aire ∝ valeur), clic = filtre pays.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formats } from "@/lib/command-center/format";
import { useT } from "@/components/I18nProvider";

export interface PointPays { iso: string; nom: string; lat: number; lng: number; marchands: number; gmv: number; commandes: number; croissance: number | null; href: string }

const METRIQUES = [
  { id: "marchands", nom: "Marchands" }, { id: "gmv", nom: "GMV" }, { id: "commandes", nom: "Commandes" }, { id: "croissance", nom: "Croissance" },
] as const;
type Id = (typeof METRIQUES)[number]["id"];

const echapper = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

export function CarteAfrique({ points, actif }: { points: PointPays[]; actif?: string }) {
  const router = useRouter();
  const t = useT();
  const div = useRef<HTMLDivElement>(null);
  const carte = useRef<any>(null);
  const couche = useRef<any>(null);
  const [metrique, setMetrique] = useState<Id>("gmv");
  const [pret, setPret] = useState(false);

  useEffect(() => {
    let annule = false;
    import("leaflet").then((L) => {
      if (annule || !div.current || carte.current) return;
      const clair = div.current.closest("[data-cc-theme]")?.getAttribute("data-cc-theme") === "light";
      const centre = actif && points.find((p) => p.iso === actif);
      carte.current = L.map(div.current, { center: centre ? [centre.lat, centre.lng] : [4, 15], zoom: centre ? 5 : 3, minZoom: 2, scrollWheelZoom: false, dragging: !L.Browser.mobile, attributionControl: true });
      // Tuiles OSM ; en thème sombre, assombries par filtre CSS (aucun fournisseur à clé API).
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 10, className: clair ? "" : "cc-tuiles-sombres",
      }).addTo(carte.current);
      const afrique = points.filter((p) => p.lat < 38); // cadrage sur l'Afrique (la France reste visible en dézoomant)
      if (!centre && afrique.length > 1) carte.current.fitBounds(afrique.map((p) => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 5 });
      couche.current = L.layerGroup().addTo(carte.current);
      setPret(true);
    });
    return () => { annule = true; carte.current?.remove(); carte.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pret || !div.current) return;
    let annule = false;
    import("leaflet").then((L) => {
      if (annule || !couche.current) return;
      couche.current.clearLayers();
      const { formatValeur, formatVariation } = formats(t);
      const css = getComputedStyle(div.current!);
      const c = (v: string) => css.getPropertyValue(v).trim() || "#3987e5";
      const val = (p: PointPays) => (metrique === "croissance" ? Math.abs(p.croissance ?? 0) : p[metrique]);
      const max = Math.max(1e-9, ...points.map(val));
      for (const p of points) {
        const x = val(p);
        const couleur = metrique === "croissance" ? (p.croissance == null ? c("--cc-text-3") : p.croissance >= 0 ? c("--cc-good") : c("--cc-bad")) : c("--cc-s1");
        const cercle = L.circleMarker([p.lat, p.lng], {
          radius: 4 + 24 * Math.sqrt(x / max), color: p.iso === actif ? c("--cc-accent") : couleur, weight: p.iso === actif ? 3 : 1.5, fillColor: couleur, fillOpacity: 0.35,
        });
        cercle.bindTooltip(
          `<strong>${echapper(p.nom)}</strong><br/>${echapper(t(p.marchands > 1 ? "{0} marchands · {1}" : "{0} marchand · {1}", p.marchands, formatValeur(p.gmv, "xaf")))}<br/>${echapper(t("{0} commandes · croissance {1}", formatValeur(p.commandes, "nombre"), formatVariation(p.croissance, "nombre")))}`,
          { direction: "top", sticky: true },
        );
        cercle.on("click", () => router.push(p.href));
        cercle.addTo(couche.current);
      }
    });
    return () => { annule = true; };
  }, [pret, metrique, points, actif, router, t]);

  return (
    <div>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>{`.cc-tuiles-sombres{filter:invert(1) hue-rotate(180deg) brightness(.85) contrast(.9) saturate(.4)}`}</style>
      <div className="flex flex-wrap items-center gap-1 mb-2 cc-no-print" role="group" aria-label={t("Taille des cercles")}>
        <span className="cc-faint text-[12px] mr-1">{t("Taille des cercles :")}</span>
        {METRIQUES.map((m) => (
          <button key={m.id} type="button" className={`cc-btn cc-btn-sm ${metrique === m.id ? "" : "cc-btn-ghost"}`} aria-pressed={metrique === m.id} onClick={() => setMetrique(m.id)}>{t(m.nom)}</button>
        ))}
      </div>
      <div ref={div} role="region" aria-label={t("Carte de l'Afrique : un cercle par pays, cliquer pour filtrer")} className="w-full rounded-lg overflow-hidden border cc-sep" style={{ height: 420, background: "var(--cc-surface-2)" }} />
      {!points.length && <p className="cc-faint text-[12px] mt-2">{t("Aucun pays à afficher sur ce périmètre.")}</p>}
    </div>
  );
}
