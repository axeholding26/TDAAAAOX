"use client";
import { useEffect, useRef } from "react";

interface LivreurPosition {
  id: string;
  nom: string;
  vehicule: string;
  disponible: boolean;
  latitude: number | null;
  longitude: number | null;
  positionAt: string | null;
}

export function LiveFleetMapInner({ livreurs }: { livreurs: LivreurPosition[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const premierFit = useRef(false);

  // Créer la carte une seule fois au montage
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    let annule = false;

    import("leaflet").then((L) => {
      if (annule || !mapRef.current) return;
      (L.Icon.Default.prototype as any)._getIconUrl = undefined;

      // Sur mobile, le drag capture le geste de scroll de la page — on le
      // désactive tactile, le zoom +/- reste utilisable (voir MapLivraison.tsx).
      mapInstance.current = L.map(mapRef.current, {
        center: [4.0511, 9.7679], zoom: 12, zoomControl: true, // Douala par défaut
        dragging: !L.Browser.mobile,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapInstance.current);
    });

    return () => {
      annule = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Mettre à jour uniquement les marqueurs quand les positions changent
  useEffect(() => {
    if (!mapInstance.current) return;
    let annule = false;

    import("leaflet").then((L) => {
      if (annule || !mapInstance.current) return;
      const map = mapInstance.current;

      markersRef.current.forEach((m) => map.removeLayer(m));
      markersRef.current = [];

      const positionnes = livreurs.filter((l) => l.latitude && l.longitude);

      positionnes.forEach((l) => {
        const couleur = l.disponible ? "#22c55e" : "#6b7280";
        const icon = L.divIcon({
          className: "",
          html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;background:${couleur};border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35);font-size:14px">🏍️</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        const marker = L.marker([l.latitude!, l.longitude!], { icon })
          .addTo(map)
          .bindPopup(`<b>${l.nom}</b><br/>${l.disponible ? "Disponible" : "Hors service"}${l.positionAt ? `<br/><small>Mis à jour ${new Date(l.positionAt).toLocaleTimeString("fr")}</small>` : ""}`);
        markersRef.current.push(marker);
      });

      // Ne recadrer qu'au tout premier chargement de positions, pas à chaque poll
      // (sinon la carte "saute" sous les yeux du marchand toutes les 20s)
      if (!premierFit.current && positionnes.length > 0) {
        premierFit.current = true;
        if (positionnes.length > 1) {
          map.fitBounds(positionnes.map((l) => [l.latitude!, l.longitude!]), { padding: [50, 50] });
        } else {
          map.setView([positionnes[0].latitude!, positionnes[0].longitude!], 14);
        }
      }
    });

    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(livreurs.map((l) => [l.id, l.latitude, l.longitude, l.disponible]))]);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} className="w-full rounded-2xl overflow-hidden border border-gray-100" style={{ height: "360px", background: "#f5f5f5" }} />
    </>
  );
}
