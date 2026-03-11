import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const { id: tripId } = await params;
    const body = await request.json().catch(() => null);

    if (!body?.searchId || typeof body.searchId !== "string") {
        return NextResponse.json({ error: "searchId é obrigatório" }, { status: 400 });
    }

    const trip = await prisma.trip.findFirst({
        where: { id: tripId, userId: session.user.id, deletedAt: null },
    });

    if (!trip) {
        return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });
    }

    const search = await prisma.tripSearch.findFirst({
        where: { id: body.searchId, userId: session.user.id },
    });

    if (!search) {
        return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 });
    }

    const updated = await prisma.tripSearch.update({
        where: { id: body.searchId },
        data: { tripId },
    });

    return NextResponse.json({ search: updated });
}
