"use client";
import { useEffect, useRef } from "react";

interface Props {
  livreurId: string;
}

// Envoi de la position GPS toutes les 30 secondes en arrière-plan
export function GeoTracker({ livreurId }: Props) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const envoyer = () => {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          await fetch(`/api/livreurs/${livreurId}/position`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };

    envoyer();
    intervalRef.current = setInterval(envoyer, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [livreurId]);

  return null;
}
