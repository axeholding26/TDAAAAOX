"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window { dataLayer?: any[]; }
}

interface Props { containerId: string; }

/** Charge Google Tag Manager (script + dataLayer). Le conteneur GTM gère
 *  lui-même le suivi des changements de route (via son propre écouteur
 *  history), pas besoin de re-déclencher au changement de pathname ici. */
export function GoogleTagManager({ containerId }: Props) {
  const initRef = useRef(false);

  useEffect(() => {
    if (!containerId || typeof window === "undefined" || initRef.current) return;
    initRef.current = true;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`;
    const first = document.getElementsByTagName("script")[0];
    first.parentNode?.insertBefore(script, first);
  }, [containerId]);

  if (!containerId) return null;
  return (
    <noscript>
      <iframe src={`https://www.googletagmanager.com/ns.html?id=${containerId}`}
        height="0" width="0" style={{ display: "none", visibility: "hidden" }} title="gtm" />
    </noscript>
  );
}
