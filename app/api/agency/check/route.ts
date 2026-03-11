import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { unauthorized } from "@/lib/api-response";

import { findAgency, isCacheValid, updateGoogleCache, saveExternalLink, type AgencyWithLinks } from "@/lib/agency-cache";
import { getServerAuthSession } from "@/lib/auth";
import { grokAnalyzeLink, type LinkAnalysis } from "@/lib/grok-researcher";
import { fetchGooglePlaces } from "@/lib/maps/places";
import { prisma } from "@/lib/prisma";

function daysSince(date: Date): number {
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function normalizeCacheKey(rnavt?: string, agencyName?: string, nipc?: string, socialUrl?: string): string {
    return (rnavt || agencyName || nipc || socialUrl || "").toLowerCase().trim().replace(/\s+/g, "-");
}

// ── Link Analysis — powered by Grok Researcher ────────────────────────────

async function analyzeExternalLink(url: string): Promise<LinkAnalysis> {
    return grokAnalyzeLink(url);
}

// ── RNAVT DB cross-check result ───────────────────────────────────────────

interface CrossCheckResult {
    match: boolean;
    mismatch: boolean;
    officialAgency: AgencyWithLinks | null;
    rnavtBelongsTo: string | null;
}

async function crossCheckRnavt(rnavtFound: string | null, agencyNameFound: string | null, nipc?: string): Promise<CrossCheckResult> {
    if (!rnavtFound && !agencyNameFound && !nipc) {
        return { match: false, mismatch: false, officialAgency: null, rnavtBelongsTo: null };
    }

    const query = rnavtFound || nipc || agencyNameFound || "";
    const agency = await findAgency(query);

    if (!agency) {
        return { match: false, mismatch: false, officialAgency: null, rnavtBelongsTo: null };
    }

    if (rnavtFound && agencyNameFound) {
        // Check if RNAVT matches the agency name we found in the link
        const officialName = agency.legalName.toLowerCase();
        const commercialName = (agency.commercialName ?? "").toLowerCase();
        const extractedName = agencyNameFound.toLowerCase();

        // Simple substring match — good enough for cross-check purposes
        const nameMatches = officialName.includes(extractedName.split(/\s/)[0]) ||
            extractedName.includes(officialName.split(/\s/)[0]) ||
            (commercialName && (commercialName.includes(extractedName.split(/\s/)[0]) ||
                extractedName.includes(commercialName.split(/\s/)[0])));

        if (!nameMatches && agency.rnavt !== rnavtFound) {
            return { match: false, mismatch: true, officialAgency: agency, rnavtBelongsTo: agency.legalName };
        }
    }

    return { match: true, mismatch: false, officialAgency: agency, rnavtBelongsTo: null };
}

export async function POST(request: Request) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const payload = await request.json().catch(() => null);

    const agencyCheckSchema = z.object({
        agencyName: z.string().trim().max(200).optional(),
        rnavt: z.string().trim().max(20).optional(),
        nipc: z.string().trim().max(20).optional(),
        socialUrl: z.string().trim().max(500).optional(),
        tripId: z.string().optional(),
        forceRefresh: z.boolean().optional(),
    }).refine(
        (d) => !!(d.agencyName || d.rnavt || d.nipc || d.socialUrl),
        { message: "Pelo menos um campo de pesquisa é obrigatório" },
    );

    const parsed = agencyCheckSchema.safeParse(payload);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid_payload" }, { status: 400 });
    }

    const { agencyName, rnavt, nipc, socialUrl, tripId, forceRefresh } = parsed.data;
    const input = (agencyName || rnavt || nipc || socialUrl || "").trim();

    const cacheKey = normalizeCacheKey(rnavt, agencyName, nipc, socialUrl);
    const cacheExpiry = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ── Cache hit (30 dias) ───────────────────────────────────────────────
    if (!forceRefresh) {
        const cached = await prisma.agencyCheck.findFirst({
            where: { cacheKey, userId: session.user.id, createdAt: { gte: cacheExpiry }, deletedAt: null },
            orderBy: { createdAt: "desc" },
        });

        if (cached) {
            const cachedRecord = cached as typeof cached & { shareToken?: string | null };
            return NextResponse.json({
                id: cached.id,
                shareToken: cachedRecord.shareToken ?? null,
                verdict: cached.verdict,
                verdictText: cached.verdictText,
                officialAgency: cached.rnavtData ?? null,
                linkAnalysis: (cached.onlineData as Record<string, unknown> | null) ?? null,
                fromCache: true,
                cacheAge: daysSince(cached.createdAt),
                cachedAt: cached.createdAt,
            });
        }
    }

    // ── Step 1: DB Lookup (name / NIF / RNAVT) ───────────────────────────
    const dbQuery = rnavt || nipc || agencyName || "";
    let officialAgency: AgencyWithLinks | null = dbQuery ? await findAgency(dbQuery) : null;

    // ── Step 2: Link Analysis (if socialUrl provided) ────────────────────
    let linkAnalysis: (LinkAnalysis & { crossCheck?: CrossCheckResult }) | null = null;

    if (socialUrl) {
        const analysis = await analyzeExternalLink(socialUrl);
        const crossCheck = await crossCheckRnavt(analysis.rnavtFound, analysis.agencyNameFound, nipc);

        if (crossCheck.officialAgency && !officialAgency) {
            officialAgency = crossCheck.officialAgency;
        }

        // Add mismatch to red flags
        if (crossCheck.mismatch) {
            analysis.redFlags.unshift(
                `🚨 MISMATCH: RNAVT ${analysis.rnavtFound} pertence a "${crossCheck.rnavtBelongsTo}", NÃO a esta agência!`
            );
        }

        if (!analysis.rnavtFound) {
            analysis.redFlags.push("Sem RNAVT declarado (obrigatório por lei em Portugal)");
        }

        linkAnalysis = { ...analysis, crossCheck };
    }

    // ── Step 3: Google Places (lazy — só para agências encontradas na BD) ─
    let googleRating: number | null = null;
    let googleReviewCount: number | null = null;
    let googlePlaceId: string | null = null;

    if (officialAgency) {
        googlePlaceId = officialAgency.googlePlaceId ?? null;

        if (isCacheValid(officialAgency.googleCachedAt) && !forceRefresh) {
            googleRating = officialAgency.googleRating;
            googleReviewCount = officialAgency.googleReviewCount;
        } else {
            const places = await fetchGooglePlaces(officialAgency.legalName, officialAgency.address, officialAgency.commercialName);
            if (places.placeId) {
                await updateGoogleCache(officialAgency.id, places);
                if (places.website) await saveExternalLink(officialAgency.id, "website", places.website);
                googleRating = places.rating;
                googleReviewCount = places.reviewCount;
                googlePlaceId = places.placeId;
            }
        }
    }

    // ── Step 4: Verdict ───────────────────────────────────────────────────
    let verdict: string;
    let verdictText: string;

    const hasMismatch = linkAnalysis?.crossCheck?.mismatch;

    if (hasMismatch) {
        verdict = "danger";
        verdictText = "Alto Risco — Possível Fraude";
    } else if (officialAgency) {
        verdict = "safe";
        verdictText = "Agência Licenciada";
    } else if (linkAnalysis && !linkAnalysis.rnavtFound) {
        verdict = "caution";
        verdictText = "Sem RNAVT Declarado — Pede Comprovativo";
    } else {
        verdict = "not_found";
        verdictText = "Não encontrada no Registo Oficial";
    }

    const officialAgencyPayload = officialAgency ? {
        rnavt: officialAgency.rnavt,
        nif: officialAgency.nif,
        legalName: officialAgency.legalName,
        commercialName: officialAgency.commercialName ?? null,
        address: officialAgency.address ?? null,
        postalCode: officialAgency.postalCode ?? null,
        city: officialAgency.city ?? null,
        district: officialAgency.district ?? null,
        phone: officialAgency.phone ?? null,
        googleRating,
        googleReviewCount,
        googlePlaceId,
    } : null;

    // ── Step 5: Save to AgencyCheck (cache) ──────────────────────────────
    const detectiveNote = hasMismatch
        ? `ALERTA: O RNAVT ${linkAnalysis?.rnavtFound} declarado neste perfil pertence a "${linkAnalysis?.crossCheck?.rnavtBelongsTo}". Este perfil pode estar a usar um registo alheio — possível fraude.`
        : officialAgency
            ? `Agência encontrada no registo oficial do Turismo de Portugal (RNAVT ${officialAgency.rnavt}).`
            : linkAnalysis
                ? `Perfil analisado. ${linkAnalysis.summary} ${!linkAnalysis.rnavtFound ? "Sem RNAVT declarado — obrigatório por lei." : ""}`
                : `"${input}" não consta no registo oficial do Turismo de Portugal. Verifica em rnt.turismodeportugal.pt antes de pagar.`;

    const saved = await prisma.agencyCheck.create({
        data: {
            userId: session.user.id,
            tripId: tripId ?? null,
            agencyId: officialAgency?.id ?? null,
            cacheKey,
            input,
            rnavt: officialAgency?.rnavt ?? rnavt ?? linkAnalysis?.rnavtFound ?? null,
            agencyName: officialAgency?.legalName ?? agencyName ?? linkAnalysis?.agencyNameFound ?? null,
            verdict,
            verdictText,
            rnavtStatus: officialAgency ? "confirmed" : hasMismatch ? "mismatch" : "notFound",
            rnavtData: (officialAgencyPayload ?? null) as object,
            onlineData: (linkAnalysis ? {
                rnavtFound: linkAnalysis.rnavtFound,
                agencyNameFound: linkAnalysis.agencyNameFound,
                followers: linkAnalysis.followers,
                ageDescription: linkAnalysis.ageDescription,
                redFlags: linkAnalysis.redFlags,
                summary: linkAnalysis.summary,
                mismatch: linkAnalysis.crossCheck?.mismatch ?? false,
                rnavtBelongsTo: linkAnalysis.crossCheck?.rnavtBelongsTo ?? null,
            } : Prisma.DbNull) as object,
            complaints: [],
            redFlags: linkAnalysis?.redFlags ?? [],
            greenFlags: officialAgency ? ["Licenciada pelo Turismo de Portugal"] : [],
            detectiveNote,
            rawReport: "",
            usedGrok: !!linkAnalysis,
        },
        select: { id: true },
    });

    return NextResponse.json({
        id: saved.id,
        shareToken: null, // generated on demand via POST /api/agency/check/[id]/share
        verdict,
        verdictText,
        officialAgency: officialAgencyPayload,
        linkAnalysis: linkAnalysis ? {
            rnavtFound: linkAnalysis.rnavtFound,
            agencyNameFound: linkAnalysis.agencyNameFound,
            followers: linkAnalysis.followers,
            ageDescription: linkAnalysis.ageDescription,
            redFlags: linkAnalysis.redFlags,
            summary: linkAnalysis.summary,
            mismatch: linkAnalysis.crossCheck?.mismatch ?? false,
            rnavtBelongsTo: linkAnalysis.crossCheck?.rnavtBelongsTo ?? null,
        } : null,
        fromCache: false,
    });
}

// GET: list agency checks for a trip or user (cursor-based pagination)
export async function GET(request: Request) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get("tripId");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

    const checks = await prisma.agencyCheck.findMany({
        where: { userId: session.user.id, deletedAt: null, ...(tripId ? { tripId } : {}) },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = checks.length > limit;
    if (hasMore) checks.pop();
    const nextCursor = hasMore ? checks[checks.length - 1]?.id : null;

    return NextResponse.json({ checks, nextCursor });
}
