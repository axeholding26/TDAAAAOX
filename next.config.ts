import path from "path";
import type { NextConfig } from "next";

// Live Academy (lib/live/visio.ts) : un serveur Jitsi auto-hébergé (JITSI_DOMAIN) est intégré
// en iframe dans la page de l'inscrit — seul ce domaine est ajouté à frame-src et reçoit le droit
// caméra/micro. Sans JITSI_DOMAIN, rien ne change : meet.jit.si s'ouvre dans un nouvel onglet.
const JITSI = process.env.JITSI_DOMAIN?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const JITSI_ORIGINE = JITSI && /^[a-z0-9.-]+(:\d+)?$/i.test(JITSI) ? `https://${JITSI}` : "";

const OWASP_HEADERS = [
  { key: "X-Frame-Options",           value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "X-XSS-Protection",          value: "1; mode=block" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: JITSI_ORIGINE ? `camera=(self "${JITSI_ORIGINE}"), microphone=(self "${JITSI_ORIGINE}"), display-capture=(self "${JITSI_ORIGINE}"), geolocation=(self)` : "camera=(self), microphone=(self), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      // Google Fonts : polices des thèmes (StorefrontTypography, designs AXSO) — bloquées sans ça.
      "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "connect-src 'self' https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Lecteurs vidéo intégrés (blocs Vidéo) — sans eux : « Ce contenu est bloqué ».
      "frame-src 'self' https://www.openstreetmap.org https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com" + (JITSI_ORIGINE ? ` ${JITSI_ORIGINE}` : ""),
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Racine explicite : sans elle, un package-lock.json dans un dossier parent
  // (ex. ~/package-lock.json) fait prendre tout le dossier personnel pour le
  // projet — Turbopack le surveille et le serveur de dev sature la mémoire.
  turbopack: { root: path.resolve(__dirname) },
  // Erreurs TypeScript bloquantes : un déploiement avec une erreur de types échoue au lieu de partir en production.
  typescript: { ignoreBuildErrors: false },
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,

  // AXSO Sourcing tient en une page : les anciennes adresses y renvoient.
  async redirects() {
    const vers = (source: string, destination: string) => ({ source, destination, permanent: false });
    return [
      ...["catalogue", "import", "calculateur", "fournisseurs/agent"].map((p) => vers(`/dashboard/sourcing/${p}`, "/dashboard/sourcing")),
      ...["commandes", "expeditions", "stocks"].map((p) => vers(`/dashboard/sourcing/${p}`, `/dashboard/sourcing?bloc=${p}`)),
      vers("/dashboard/sourcing/produits/:id", "/dashboard/sourcing?dossier=:id"),
      vers("/dashboard/dropshipping", "/dashboard/sourcing?bloc=benefice"),
    ];
  },

  async headers() {
    return [
      { source: "/(.*)", headers: OWASP_HEADERS },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http",  hostname: "localhost" },
    ],
  },
};

export default nextConfig;
