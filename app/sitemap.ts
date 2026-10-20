import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://axsoafrica.com";

const PAGES = [
  "", "/fonctionnalites", "/themes", "/temoignages", "/affiliation", "/about", "/contact",
  "/blog", "/docs", "/tutorials", "/community", "/press", "/jobs",
  "/legal/cgu", "/legal/privacy", "/legal/cookies", "/legal/abonnements", "/legal/politique-prix",
];

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statiques = PAGES.map((p) => ({ url: `${BASE}${p}` }));
  // Base indisponible (build sans DB…) : on sert au moins les pages statiques.
  const boutiques = await prisma.tenant
    .findMany({ where: { statut: "active" }, select: { slug: true, customDomain: true, domaineActifAt: true, updatedAt: true } })
    .catch(() => []);
  return [
    ...statiques,
    ...boutiques.map((b) => ({
      url: b.customDomain && b.domaineActifAt ? `https://${b.customDomain}` : `${BASE}/${b.slug}`,
      lastModified: b.updatedAt,
    })),
  ];
}
