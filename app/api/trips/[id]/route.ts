import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerAuthSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

const dateStr = z.string().refine((s) => !isNaN(Date.parse(s)), "Data inválida");

const updateTripSchema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    destination: z.string().trim().max(200).nullish(),
    startDate: dateStr.nullish(),
    endDate: dateStr.nullish(),
    notes: z.string().trim().max(2000).nullish(),
});

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const { id } = await params;

    const trip = await prisma.trip.findFirst({
        where: { id, userId: session.user.id, deletedAt: null },
        include: {
            searches: {
                orderBy: { createdAt: "desc" },
                include: {
                    hotelAnalyses: {
                        select: {
                            id: true,
                            hotelName: true,
                            verdict: true,
                            abundanceIndex: true,
                            redFlags: true,
                        },
                    },
                },
            },
        },
    });

    if (!trip) {
        return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ trip });
}

export async function PUT(request: Request, { params }: RouteParams) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = updateTripSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
    }

    const existing = await prisma.trip.findFirst({
        where: { id, userId: session.user.id, deletedAt: null },
    });

    if (!existing) {
        return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });
    }

    const { name, destination, startDate, endDate, notes } = parsed.data;

    const finalStart = startDate ? new Date(startDate) : existing.startDate;
    const finalEnd = endDate ? new Date(endDate) : existing.endDate;
    if (finalStart && finalEnd && finalEnd < finalStart) {
        return NextResponse.json({ error: "Data de fim deve ser posterior à data de início" }, { status: 400 });
    }

    const trip = await prisma.trip.update({
        where: { id },
        data: {
            name: name ?? existing.name,
            destination: destination !== undefined ? (destination || null) : existing.destination,
            startDate: finalStart,
            endDate: finalEnd,
            notes: notes !== undefined ? (notes || null) : existing.notes,
        },
    });

    return NextResponse.json({ trip });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const { id } = await params;

    const existing = await prisma.trip.findFirst({
        where: { id, userId: session.user.id, deletedAt: null },
    });

    if (!existing) {
        return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });
    }

    await prisma.trip.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ deleted: true });
}
