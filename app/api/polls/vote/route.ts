import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit/index";

const voteSchema = z.object({
    token: z.string().min(1),
    voterName: z.string().trim().min(1, "Nome é obrigatório").max(60, "Nome demasiado longo"),
    optionIndex: z.number().int().min(0),
});

// GET /api/polls/vote?token=xxx — get poll by share token (public, no auth)
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });

    const poll = await prisma.poll.findUnique({
        where: { shareToken: token },
        include: {
            votes: true,
            trip: { select: { name: true, destination: true } },
        },
    });

    if (!poll) return NextResponse.json({ error: "Poll não encontrado" }, { status: 404 });

    return NextResponse.json({ poll });
}

// POST /api/polls/vote — submit a vote (public, no auth)
export async function POST(req: Request) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { allowed, retryAfter } = await checkRateLimit(`poll-vote:${ip}`, 20, 60_000);
    if (!allowed) {
        return NextResponse.json(
            { error: "Demasiadas tentativas. Tenta novamente em breve." },
            { status: 429, headers: { "Retry-After": String(retryAfter) } },
        );
    }

    const body = await req.json().catch(() => null);
    const parsed = voteSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: "token, voterName e optionIndex são obrigatórios", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { token, voterName, optionIndex } = parsed.data;

    const poll = await prisma.poll.findUnique({ where: { shareToken: token } });
    if (!poll) return NextResponse.json({ error: "Poll não encontrado" }, { status: 404 });

    if (optionIndex >= poll.options.length) {
        return NextResponse.json({ error: "Opção inválida" }, { status: 400 });
    }

    // Upsert: allow changing vote
    const vote = await prisma.pollVote.upsert({
        where: { pollId_voterName: { pollId: poll.id, voterName } },
        update: { optionIndex },
        create: { pollId: poll.id, voterName, optionIndex },
    });

    // Return updated poll
    const updated = await prisma.poll.findUnique({
        where: { id: poll.id },
        include: { votes: true },
    });

    return NextResponse.json({ vote, poll: updated });
}
