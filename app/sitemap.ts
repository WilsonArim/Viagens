import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";

/**
 * Auto-generated sitemap covering:
 * - Static routes (home, agency check, chat, etc.)
 * - All agency pages (one per RNAVT)
 * - Directory pages (paginated)
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://amigodeviagens.pt";

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/agencia`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/agency-check`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];

  // All agency pages
  const agencies = await prisma.agency.findMany({
    select: { rnavt: true, updatedAt: true },
    orderBy: { rnavt: "asc" },
  });

  const agencyRoutes: MetadataRoute.Sitemap = agencies.map(a => ({
    url: `${baseUrl}/agencia/${a.rnavt}`,
    lastModified: a.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Paginated directory pages (max 40 per page)
  const total = agencies.length;
  const pageSize = 40;
  const totalPages = Math.ceil(total / pageSize);

  const paginatedRoutes: MetadataRoute.Sitemap = Array.from({ length: Math.min(totalPages, 100) }, (_, i) => ({
    url: `${baseUrl}/agencia?pagina=${i + 1}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: i === 0 ? 0.9 : 0.5,
  }));

  return [...staticRoutes, ...agencyRoutes, ...paginatedRoutes];
}
