import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// POST /api/agency/save — toggle save/unsave an agency
export async function POST(request: Request) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const body = await request.json().catch(() => null);
    const agencyId = body?.agencyId as string | undefined;
    if (!agencyId) {
        return NextResponse.json({ error: "agencyId required" }, { status: 400 });
    }

    // Verify agency exists
    const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { id: true } });
    if (!agency) {
        return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    const existing = await prisma.savedAgency.findUnique({
        where: { userId_agencyId: { userId: session.user.id, agencyId } },
    });

    if (existing) {
        await prisma.savedAgency.delete({ where: { id: existing.id } });
        return NextResponse.json({ saved: false });
    } else {
        await prisma.savedAgency.create({ data: { userId: session.user.id, agencyId } });
        return NextResponse.json({ saved: true });
    }
}

// GET /api/agency/save?agencyId=xxx — check if saved
export async function GET(request: Request) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return NextResponse.json({ saved: false });
    }

    const { searchParams } = new URL(request.url);
    const agencyId = searchParams.get("agencyId");
    if (!agencyId) return NextResponse.json({ saved: false });

    const saved = await prisma.savedAgency.findUnique({
        where: { userId_agencyId: { userId: session.user.id, agencyId } },
    });

    return NextResponse.json({ saved: !!saved });
}
