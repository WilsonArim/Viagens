import { prisma } from "@/lib/prisma";
import type { Agency, AgencyExternalLink } from "@prisma/client";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export function isCacheValid(cachedAt: Date | null | undefined): boolean {
    if (!cachedAt) return false;
    return Date.now() - cachedAt.getTime() < CACHE_TTL_MS;
}

export type AgencyWithLinks = Agency & { externalLinks: AgencyExternalLink[] };

/**
 * Procura agência na BD oficial por RNAVT, NIF, ou nome.
 * Retorna null se não encontrada.
 */
export async function findAgency(query: string): Promise<AgencyWithLinks | null> {
    const normalized = query.trim();

    // Tentar por RNAVT (numérico, possivelmente com espaços)
    const rnavtClean = normalized.replace(/\s/g, "");
    if (/^\d+$/.test(rnavtClean)) {
        const byRnavt = await prisma.agency.findUnique({
            where: { rnavt: rnavtClean },
            include: { externalLinks: true },
        });
        if (byRnavt) return byRnavt;

        // Tentar com espaço à frente (formato Excel: " 13214")
        const byRnavtPadded = await prisma.agency.findFirst({
            where: { rnavt: { contains: rnavtClean } },
            include: { externalLinks: true },
        });
        if (byRnavtPadded) return byRnavtPadded;
    }

    // Tentar por NIF (9 dígitos)
    if (/^\d{9}$/.test(rnavtClean)) {
        const byNif = await prisma.agency.findFirst({
            where: { nif: rnavtClean },
            include: { externalLinks: true },
        });
        if (byNif) return byNif;
    }

    // Tentar por nome (case-insensitive, parcial)
    const byName = await prisma.agency.findFirst({
        where: {
            OR: [
                { legalName: { contains: normalized, mode: "insensitive" } },
                { commercialName: { contains: normalized, mode: "insensitive" } },
            ],
        },
        include: { externalLinks: true },
    });

    return byName;
}

/**
 * Atualiza cache do Google Places para uma agência.
 */
export async function updateGoogleCache(
    agencyId: string,
    data: {
        rating: number | null;
        reviewCount: number | null;
        reviews: unknown;
        placeId: string | null;
    }
) {
    return prisma.agency.update({
        where: { id: agencyId },
        data: {
            googleRating: data.rating,
            googleReviewCount: data.reviewCount,
            googleReviews: data.reviews as never,
            googlePlaceId: data.placeId,
            googleCachedAt: new Date(),
        },
    });
}

/**
 * Atualiza cache de queixas para uma agência.
 */
export async function updateComplaintsCache(
    agencyId: string,
    summary: unknown
) {
    return prisma.agency.update({
        where: { id: agencyId },
        data: {
            complaintsSummary: summary as never,
            complaintsCachedAt: new Date(),
        },
    });
}

/**
 * Guarda um URL externo descoberto (Portal da Queixa, Trustpilot, etc.)
 * Usa upsert para não duplicar.
 */
export async function saveExternalLink(
    agencyId: string,
    source: string,
    url: string
) {
    return prisma.agencyExternalLink.upsert({
        where: { agencyId_source: { agencyId, source } },
        create: { agencyId, source, url },
        update: { url },
    });
}
