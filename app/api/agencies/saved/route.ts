import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// GET — list saved agencies for current user
export async function GET() {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const saved = await prisma.savedAgency.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        include: {
            agency: {
                select: {
                    rnavt: true,
                    legalName: true,
                    commercialName: true,
                    city: true,
                    district: true,
                    googleRating: true,
                    googleReviewCount: true,
                    googlePlaceId: true,
                    nifptStatus: true,
                },
            },
        },
    });

    return NextResponse.json({ saved });
}
