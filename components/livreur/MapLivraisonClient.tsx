"use client";
import dynamic from "next/dynamic";

const MapLivraison = dynamic(
  () => import("@/components/livreur/MapLivraison").then(m => m.MapLivraison),
  { ssr: false }
);

interface Props {
  adresse: string;
  ville: string;
  livreurLat?: number | null;
  livreurLng?: number | null;
}

export function MapLivraisonClient({ adresse, ville, livreurLat, livreurLng }: Props) {
  return (
    <MapLivraison
      adresse={adresse}
      ville={ville}
      livreurLat={livreurLat ?? undefined}
      livreurLng={livreurLng ?? undefined}
    />
  );
}
