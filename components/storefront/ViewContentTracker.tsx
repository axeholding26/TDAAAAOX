"use client";
import { useEffect } from "react";
import { trackPixelEvent } from "./MetaPixel";

export function ViewContentTracker({ produitId, nom, prix, devise }: { produitId: string; nom: string; prix: number; devise: string }) {
  useEffect(() => {
    trackPixelEvent("ViewContent", {
      content_ids: [produitId],
      content_name: nom,
      content_type: "product",
      value: prix,
      currency: devise,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produitId]);
  return null;
}
