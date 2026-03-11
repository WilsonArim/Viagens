import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerAuthSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

const createPollSchema = z.object({
    question: z.string().trim().min(1, "Pergunta é obrigatória").max(500),
    options: z.array(z.string().trim().min(1).max(200)).min(2, "Mínimo 2 opções").max(10),
});

// GET /api/trips/[id]/polls — list polls for a trip
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;

    const polls = await prisma.poll.findMany({
        where: { tripId: id, trip: { userId: session.user.id, deletedAt: null } },
        include: { votes: true },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ polls });
}

// POST /api/trips/[id]/polls — create a new poll
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = createPollSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
    }

    // Verify trip ownership
    const trip = await prisma.trip.findFirst({ where: { id, userId: session.user.id, deletedAt: null } });
    if (!trip) return NextResponse.json({ error: "Viagem não encontrada" }, { status: 404 });

    const poll = await prisma.poll.create({
        data: {
            tripId: id,
            question: parsed.data.question,
            options: parsed.data.options,
        },
        include: { votes: true },
    });

    return NextResponse.json({ poll }, { status: 201 });
}
