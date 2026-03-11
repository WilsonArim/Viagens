import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// GET /api/agency/saved — list all agencies saved by the current user
export async function GET() {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const saved = await prisma.savedAgency.findMany({
        where: { userId: session.user.id },
        include: {
            agency: {
                select: {
                    id: true, rnavt: true, legalName: true, commercialName: true,
                    city: true, district: true, googleRating: true,
                    googleReviewCount: true, nifptStatus: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ agencies: saved });
}
