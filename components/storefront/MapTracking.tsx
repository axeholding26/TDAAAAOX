"use client";
import { useEffect, useRef } from "react";

interface Props {
  livreurLat?: number | null;
  livreurLng?: number | null;
  clientLat?: number | null;
  clientLng?: number | null;
  livreurNom?: string | null;
  // Distance restante + ETA recalculés à chaque nouvelle position — le
  // composant fait le calcul (il a les deux points), le parent affiche.
  onLiveInfo?: (info: { distanceKm: number | null; etaMin: number | null; speedKmh: number | null }) => void;
}

const VITESSE_DEFAUT_KMH = 18; // moto en ville, estimation avant d'avoir 2 fixes GPS pour mesurer la vitesse réelle
const VITESSE_MIN_KMH = 3;
const VITESSE_MAX_KMH = 70;

function bearingDeg(from: [number, number], to: [number, number]): number {
  const lat1 = (from[0] * Math.PI) / 180, lat2 = (to[0] * Math.PI) / 180;
  const dLon = ((to[1] - from[1]) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180, lat2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function MapTracking({ livreurLat, livreurLng, clientLat, clientLng, livreurNom, onLiveInfo }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapInstance   = useRef<any>(null);
  const livreurMarker = useRef<any>(null);
  const clientMarker  = useRef<any>(null);
  const trailLine     = useRef<any>(null);  // green solid: path history
  const destLine      = useRef<any>(null);  // orange dashed: remaining distance
  const trailPoints   = useRef<[number, number][]>([]);
  const animFrame     = useRef<number | null>(null);
  const dernierFix    = useRef<{ pos: [number, number]; at: number } | null>(null);
  const vitesseLissee = useRef<number>(VITESSE_DEFAUT_KMH);

  function animateTo(marker: any, from: [number, number], to: [number, number], ms = 1800) {
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    const start = performance.now();
    function step(now: number) {
      const raw  = Math.min((now - start) / ms, 1);
      const ease = raw < 0.5 ? 2 * raw * raw : -1 + (4 - 2 * raw) * raw;
      marker.setLatLng([
        from[0] + (to[0] - from[0]) * ease,
        from[1] + (to[1] - from[1]) * ease,
      ]);
      if (raw < 1) animFrame.current = requestAnimationFrame(step);
    }
    animFrame.current = requestAnimationFrame(step);
  }

  function appliquerCap(marker: any, deg: number) {
    const el = marker?.getElement?.();
    const heading = el?.querySelector?.(".axs-heading") as HTMLElement | null;
    if (heading) heading.style.transform = `rotate(${deg}deg)`;
  }

  function livreurIcon(L: any) {
    return L.divIcon({
      className: "",
      html: `<div style="position:relative;width:44px;height:44px">
        <div style="position:absolute;inset:2px;border-radius:50%;background:rgba(34,197,94,0.25);animation:pingMap 1.8s cubic-bezier(0,0,0.2,1) infinite"></div>
        <div class="axs-heading" style="position:absolute;inset:0;transition:transform 0.6s cubic-bezier(0.34,1.56,0.64,1);transform:rotate(0deg)">
          <div style="position:absolute;top:-2px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid #22c55e;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45))"></div>
        </div>
        <div style="position:absolute;inset:6px;background:#22c55e;border-radius:50%;border:2.5px solid white;box-shadow:0 3px 14px rgba(34,197,94,0.6);display:flex;align-items:center;justify-content:center;font-size:16px">🚴</div>
      </div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapInstance.current) return;

    const cLat = livreurLat ?? clientLat ?? 14.7167;
    const cLng = livreurLng ?? clientLng ?? -17.4677;

    import("leaflet").then((L) => {
      if (!containerRef.current || mapInstance.current) return;

      (L.Icon.Default.prototype as any)._getIconUrl = undefined;

      const map = L.map(containerRef.current, {
        center: [cLat, cLng],
        zoom: 15,
        zoomControl: true,
        dragging: !L.Browser.mobile,
        scrollWheelZoom: false,
      });
      mapInstance.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      // Client/destination marker
      if (clientLat && clientLng) {
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:#F5A623;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.5)"></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });
        clientMarker.current = L.marker([clientLat, clientLng], { icon })
          .addTo(map)
          .bindPopup("📍 Adresse de livraison");
      }

      // Livreur marker + trail seed
      if (livreurLat && livreurLng) {
        const pos: [number, number] = [livreurLat, livreurLng];
        trailPoints.current = [pos];
        dernierFix.current = { pos, at: Date.now() };

        livreurMarker.current = L.marker(pos, { icon: livreurIcon(L) })
          .addTo(map)
          .bindPopup(livreurNom ? `🚴 ${livreurNom}` : "🚴 Livreur en route");

        // Trail: grows as livreur moves
        trailLine.current = L.polyline([pos], {
          color: "#22c55e", weight: 4, opacity: 0.85,
        }).addTo(map);
      }

      // Dashed line livreur → client
      if (livreurLat && livreurLng && clientLat && clientLng) {
        destLine.current = L.polyline(
          [[livreurLat, livreurLng], [clientLat, clientLng]],
          { color: "#F5A623", weight: 2, opacity: 0.55, dashArray: "7 7" }
        ).addTo(map);
        map.fitBounds([[livreurLat, livreurLng], [clientLat, clientLng]], { padding: [50, 50] });

        onLiveInfo?.({
          distanceKm: Math.round(haversineKm([livreurLat, livreurLng], [clientLat, clientLng]) * 10) / 10,
          etaMin: Math.round((haversineKm([livreurLat, livreurLng], [clientLat, clientLng]) / VITESSE_DEFAUT_KMH) * 60),
          speedKmh: null,
        });
      } else if (clientLat && clientLng) {
        map.setView([clientLat, clientLng], 14);
      }
    });

    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        livreurMarker.current = null;
        clientMarker.current  = null;
        trailLine.current     = null;
        destLine.current      = null;
        trailPoints.current   = [];
        dernierFix.current    = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live update: smooth animation + cap (heading) + trail + distance/ETA
  useEffect(() => {
    if (!mapInstance.current || !livreurLat || !livreurLng) return;

    import("leaflet").then((L) => {
      if (!mapInstance.current) return;
      const newPos: [number, number] = [livreurLat, livreurLng];
      const now = Date.now();

      if (livreurMarker.current) {
        const old = livreurMarker.current.getLatLng();
        const from: [number, number] = [old.lat, old.lng];
        const dist = Math.abs(old.lat - newPos[0]) + Math.abs(old.lng - newPos[1]);
        if (dist > 0.00001) {
          animateTo(livreurMarker.current, from, newPos);
          appliquerCap(livreurMarker.current, bearingDeg(from, newPos));
        }
      } else {
        livreurMarker.current = L.marker(newPos, { icon: livreurIcon(L) })
          .addTo(mapInstance.current)
          .bindPopup(livreurNom ? `🚴 ${livreurNom}` : "🚴 Livreur en route");
      }

      // Vitesse mesurée entre les deux derniers fixes GPS réels (pas les frames
      // d'animation) — lissée pour ne pas faire sauter l'ETA sur un bruit GPS.
      if (dernierFix.current) {
        const km = haversineKm(dernierFix.current.pos, newPos);
        const heures = (now - dernierFix.current.at) / 3_600_000;
        if (heures > 0 && km > 0.01) {
          const vitesseInstant = Math.min(VITESSE_MAX_KMH, Math.max(VITESSE_MIN_KMH, km / heures));
          vitesseLissee.current = vitesseLissee.current * 0.6 + vitesseInstant * 0.4;
        }
      }
      dernierFix.current = { pos: newPos, at: now };

      // Extend trail with new position
      const last = trailPoints.current[trailPoints.current.length - 1];
      const moved = !last || Math.abs(last[0] - newPos[0]) + Math.abs(last[1] - newPos[1]) > 0.00001;
      if (moved) {
        trailPoints.current = [...trailPoints.current, newPos];
        if (trailLine.current) {
          trailLine.current.setLatLngs(trailPoints.current);
        } else {
          trailLine.current = L.polyline(trailPoints.current, {
            color: "#22c55e", weight: 4, opacity: 0.85,
          }).addTo(mapInstance.current);
        }
      }

      // Update dashed remaining-distance line + distance/ETA callback
      if (clientLat && clientLng) {
        if (destLine.current) {
          destLine.current.setLatLngs([newPos, [clientLat, clientLng]]);
        } else {
          destLine.current = L.polyline([newPos, [clientLat, clientLng]], {
            color: "#F5A623", weight: 2, opacity: 0.55, dashArray: "7 7",
          }).addTo(mapInstance.current);
        }
        const distanceKm = haversineKm(newPos, [clientLat, clientLng]);
        onLiveInfo?.({
          distanceKm: Math.round(distanceKm * 10) / 10,
          etaMin: Math.max(1, Math.round((distanceKm / vitesseLissee.current) * 60)),
          speedKmh: Math.round(vitesseLissee.current),
        });
      }

      mapInstance.current.panTo(newPos, { animate: true, duration: 1.5 });
    });
  }, [livreurLat, livreurLng, livreurNom, clientLat, clientLng]);

  return (
    <>
      <style>{`@keyframes pingMap{75%,100%{transform:scale(2);opacity:0}}`}</style>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={containerRef} style={{ width: "100%", height: 280, background: "#1a1a1a" }} />
    </>
  );
}
