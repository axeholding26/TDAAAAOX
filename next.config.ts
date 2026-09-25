import type { NextConfig } from "next";

const OWASP_HEADERS = [
  { key: "X-Frame-Options",           value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "X-XSS-Protection",          value: "1; mode=block" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(self), microphone=(self), geolocation=(self)" },
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
      "frame-src 'self' https://www.openstreetmap.org https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,

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
