"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Compte une visite à chaque page vue de la vitrine — alimente les stats
// "Visites" du tableau de bord (Analytics type "page_view", via /api/pixel).
export function StorefrontPageView({ slug }: { slug: string }) {
  const pathname = usePathname();

  useEffect(() => {
    let sessionId: string | undefined;
    try {
      sessionId = sessionStorage.getItem("axso_sid") ?? undefined;
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem("axso_sid", sessionId);
      }
    } catch {}
    fetch("/api/pixel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug: slug, type: "PageView", sessionId }),
      keepalive: true,
    }).catch(() => {});
  }, [slug, pathname]);

  return null;
}
