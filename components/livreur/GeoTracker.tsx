"use client";
import { useEffect } from "react";

interface Props {
  livreurId: string;
  // true quand le livreur a une course "expediee" : suivi continu pour le traceur client
  enLivraison: boolean;
}

const INTERVALLE_REPOS_MS = 30_000;     // hors livraison : position pour la carte de flotte, économise la batterie
const INTERVALLE_LIVRAISON_MS = 5_000;  // en livraison : au plus un envoi toutes les 5 s

export function GeoTracker({ livreurId, enLivraison }: Props) {
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    let dernierEnvoi = 0;
    const envoyer = ({ coords }: GeolocationPosition) => {
      dernierEnvoi = Date.now();
      fetch(`/api/livreurs/${livreurId}/position`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
      }).catch(() => {});
    };
    const lire = () => navigator.geolocation.getCurrentPosition(envoyer, () => {}, { enableHighAccuracy: true, timeout: 10000 });

    lire();
    if (!enLivraison) {
      const intervalle = setInterval(lire, INTERVALLE_REPOS_MS);
      return () => clearInterval(intervalle);
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => { if (Date.now() - dernierEnvoi >= INTERVALLE_LIVRAISON_MS) envoyer(pos); },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    // Filet : certains iOS suspendent watchPosition à l'arrêt (feu rouge)
    const filet = setInterval(lire, INTERVALLE_REPOS_MS);
    return () => { navigator.geolocation.clearWatch(watchId); clearInterval(filet); };
  }, [livreurId, enLivraison]);

  return null;
}
