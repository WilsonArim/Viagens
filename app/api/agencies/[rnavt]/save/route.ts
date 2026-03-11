import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { unauthorized, notFound } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// GET — check if agency is saved by current user
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ rnavt: string }> }
) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const { rnavt } = await params;
    const agency = await prisma.agency.findUnique({ where: { rnavt }, select: { id: true } });
    if (!agency) {
        return NextResponse.json({ saved: false });
    }

    const saved = await prisma.savedAgency.findUnique({
        where: { userId_agencyId: { userId: session.user.id, agencyId: agency.id } },
        select: { id: true },
    });

    return NextResponse.json({ saved: !!saved });
}

// POST — save agency
export async function POST(
    _req: Request,
    { params }: { params: Promise<{ rnavt: string }> }
) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const { rnavt } = await params;
    const agency = await prisma.agency.findUnique({ where: { rnavt }, select: { id: true } });
    if (!agency) {
        return notFound("agency_not_found");
    }

    await prisma.savedAgency.upsert({
        where: { userId_agencyId: { userId: session.user.id, agencyId: agency.id } },
        create: { userId: session.user.id, agencyId: agency.id },
        update: {},
    });

    return NextResponse.json({ saved: true });
}

// DELETE — unsave agency
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ rnavt: string }> }
) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const { rnavt } = await params;
    const agency = await prisma.agency.findUnique({ where: { rnavt }, select: { id: true } });
    if (!agency) {
        return notFound("agency_not_found");
    }

    await prisma.savedAgency.deleteMany({
        where: { userId: session.user.id, agencyId: agency.id },
    });

    return NextResponse.json({ saved: false });
}
