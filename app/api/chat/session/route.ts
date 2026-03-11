import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const chatSession = await prisma.chatSession.findFirst({
        where: { userId: session.user.id, deletedAt: null },
        orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ messages: chatSession?.messages ?? [] });
}

export async function DELETE() {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    await prisma.chatSession.updateMany({ where: { userId: session.user.id, deletedAt: null }, data: { deletedAt: new Date() } });
    return NextResponse.json({ cleared: true });
}
