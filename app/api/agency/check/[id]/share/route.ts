import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { unauthorized, notFound } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// POST /api/agency/check/[id]/share — generate or return existing share token
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
        return unauthorized();
    }

    const { id } = await params;

    const check = await prisma.agencyCheck.findFirst({
        where: { id, userId: session.user.id, deletedAt: null },
        select: { id: true, shareToken: true },
    });

    if (!check) {
        return notFound();
    }

    // Return existing token or generate a new one (12-char hex token)
    const token = check.shareToken ?? crypto.randomUUID().replace(/-/g, "").slice(0, 12);

    if (!check.shareToken) {
        await prisma.agencyCheck.update({
            where: { id: check.id },
            data: { shareToken: token },
        });
    }

    const shareUrl = `${process.env.NEXTAUTH_URL ?? ""}/verificacao/${token}`;
    return NextResponse.json({ token, shareUrl });
}
