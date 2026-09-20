"use client";
import { useEffect, useRef } from "react";

interface MapLivraisonProps {
  adresse: string;
  ville: string;
  latitude?: number | null;
  longitude?: number | null;
  livreurLat?: number | null;
  livreurLng?: number | null;
}

export function MapLivraison({ adresse, ville, latitude, longitude, livreurLat, livreurLng }: MapLivraisonProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Charger Leaflet dynamiquement (SSR safe)
    import("leaflet").then((L) => {
      // Fix icônes Leaflet avec Next.js
      (L.Icon.Default.prototype as any)._getIconUrl = undefined;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Coordonnées par défaut (Dakar si pas de géocode)
      const destLat = latitude || 14.7167;
      const destLng = longitude || -17.4677;

      // Sur mobile, le drag capture le geste de scroll de la page (le doigt
      // pose sur la carte pour scroller finit par la faire glisser à la
      // place) — on désactive le drag tactile, le zoom +/- reste utilisable.
      const map = L.map(mapRef.current!, {
        center: [destLat, destLng],
        zoom: 14,
        zoomControl: true,
        dragging: !L.Browser.mobile,
      });

      mapInstance.current = map;

      // Tuiles OpenStreetMap (gratuit, sans clé API)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Marqueur destination
      const iconDest = L.divIcon({
        className: "",
        html: `<div style="background:#F5A623;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      L.marker([destLat, destLng], { icon: iconDest })
        .addTo(map)
        .bindPopup(`<b>Livraison</b><br/>${adresse}<br/>${ville}`)
        .openPopup();

      // Marqueur livreur (position actuelle)
      if (livreurLat && livreurLng) {
        const iconLivreur = L.divIcon({
          className: "",
          html: `<div style="background:#111111;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:14px">●</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        L.marker([livreurLat, livreurLng], { icon: iconLivreur })
          .addTo(map)
          .bindPopup("<b>Vous êtes ici</b>");

        // Tracer la ligne entre les deux points
        L.polyline([[livreurLat, livreurLng], [destLat, destLng]], {
          color: "#F5A623",
          weight: 3,
          opacity: 0.7,
          dashArray: "8, 8",
        }).addTo(map);

        // Centrer sur les deux points
        map.fitBounds([[livreurLat, livreurLng], [destLat, destLng]], { padding: [40, 40] });
      }
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [adresse, ville, latitude, longitude, livreurLat, livreurLng]);

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div
        ref={mapRef}
        className="w-full rounded-2xl overflow-hidden border border-[#1a1a1a]"
        style={{ height: "280px", background: "#111" }}
      />
    </>
  );
}
