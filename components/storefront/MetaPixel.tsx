"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window { fbq?: any; _fbq?: any; }
}

interface Props { pixelId: string; }

/** Charge le Meta Pixel et déclenche PageView à chaque changement de route (App Router = navigation client-side) */
export function MetaPixel({ pixelId }: Props) {
  const pathname = usePathname();
  const initRef = useRef(false);

  useEffect(() => {
    if (!pixelId || typeof window === "undefined") return;

    if (!initRef.current) {
      initRef.current = true;
      (function (f: any, b: any, e: string, v: string) {
        if (f.fbq) return;
        const n: any = (f.fbq = function (...args: any[]) {
          n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
        });
        if (!f._fbq) f._fbq = n;
        n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
        const t = b.createElement(e); t.async = true; t.src = v;
        const s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", pixelId);
    }
    window.fbq?.("track", "PageView");
  }, [pixelId, pathname]);

  if (!pixelId) return null;
  return (
    <noscript>
      <img height="1" width="1" style={{ display: "none" }} alt=""
        src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`} />
    </noscript>
  );
}

/** Helper à appeler depuis n'importe où côté client pour déclencher un événement standard */
export function trackPixelEvent(event: string, params?: Record<string, any>) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", event, params);
}
