"use client";
// Photo de profil de la personne connectée, partout dans l'espace marchand (en-tête, menu mobile,
// Mon profil). Hors de la session (une image importée dépasserait la taille du cookie) : lue une
// fois via /api/compte, puis mise à jour en direct par l'événement EVENEMENT_PHOTO. Sans photo : initiales.
import { useEffect, useState, type CSSProperties } from "react";
import { initiales } from "@/lib/utils";

export const EVENEMENT_PHOTO = "axso:photo-compte";

let photo: Promise<string | null> | null = null;
const lirePhoto = () => (photo ??= fetch("/api/compte").then((r) => (r.ok ? r.json() : null)).then((d) => d?.image ?? null).catch(() => null));

/** À appeler après un changement de photo : tous les avatars affichés se mettent à jour. */
export function annoncerPhoto(url: string | null) {
  photo = Promise.resolve(url);
  window.dispatchEvent(new CustomEvent(EVENEMENT_PHOTO, { detail: url }));
}

export function AvatarCompte({ nom, className = "", style, classeInitiales = "" }: { nom: string; className?: string; style?: CSSProperties; classeInitiales?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let actif = true;
    lirePhoto().then((u) => { if (actif) setUrl(u); });
    const maj = (e: Event) => setUrl((e as CustomEvent<string | null>).detail);
    window.addEventListener(EVENEMENT_PHOTO, maj);
    return () => { actif = false; window.removeEventListener(EVENEMENT_PHOTO, maj); };
  }, []);
  return (
    <span className={`overflow-hidden flex items-center justify-center flex-shrink-0 ${className}`} style={style}>
      {url
        ? <img src={url} alt="" className="w-full h-full object-cover" onError={() => setUrl(null)} />
        : <span className={classeInitiales}>{initiales(nom) || "?"}</span>}
    </span>
  );
}
