"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window { ttq?: any; }
}

interface Props { pixelId: string; }

/** Charge le TikTok Pixel et déclenche une page view à chaque changement de route */
export function TikTokPixel({ pixelId }: Props) {
  const pathname = usePathname();
  const initRef = useRef(false);

  useEffect(() => {
    if (!pixelId || typeof window === "undefined") return;

    if (!initRef.current) {
      initRef.current = true;
      (function (w: any, d: Document, t: string) {
        w.TiktokAnalyticsObject = t;
        const ttq: any = (w[t] = w[t] || []);
        ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
        ttq.setAndDefer = function (target: any, method: string) {
          target[method] = function (...args: any[]) { target.push([method, ...args]); };
        };
        for (const method of ttq.methods) ttq.setAndDefer(ttq, method);
        ttq.load = function (id: string) {
          const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
          ttq._i = ttq._i || {};
          ttq._i[id] = [];
          ttq._i[id]._u = url;
          ttq._t = ttq._t || {};
          ttq._t[id] = Date.now();
          const script = d.createElement("script");
          script.type = "text/javascript";
          script.async = true;
          script.src = `${url}?sdkid=${id}&lib=ttq`;
          const first = d.getElementsByTagName("script")[0];
          first.parentNode?.insertBefore(script, first);
        };
        ttq.load(pixelId);
        ttq.page();
      })(window, document, "ttq");
    } else {
      window.ttq?.page();
    }
  }, [pixelId, pathname]);

  return null;
}

export function trackTikTokEvent(event: string, params?: Record<string, any>) {
  if (typeof window === "undefined" || !window.ttq) return;
  window.ttq.track(event, params);
}
