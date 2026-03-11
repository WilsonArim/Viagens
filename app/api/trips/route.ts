import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerAuthSession } from "@/lib/auth";
import { unauthorized } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

const dateStr = z.string().refine((s) => !isNaN(Date.parse(s)), "Data inválida");

const createTripSchema = z.object({
    name: z.string().trim().min(1, "Nome é obrigatório").max(200),
    destination: z.string().trim().max(200).nullish(),
    startDate: dateStr.nullish(),
    endDate: dateStr.nullish(),
    notes: z.string().trim().max(2000).nullish(),
}).refine(
    (d) => !(d.startDate && d.endDate && new Date(d.endDate) < new Date(d.startDate)),
    { message: "Data de fim deve ser posterior à data de início", path: ["endDate"] },
);

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const trips = await prisma.trip.findMany({
    where: { userId: session.user.id, deletedAt: null },
    include: {
      searches: {
        select: { id: true, queryType: true, destination: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { searches: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ trips });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parsed = createTripSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const { name, destination, startDate, endDate, notes } = parsed.data;
  const trip = await prisma.trip.create({
    data: {
      userId: session.user.id,
      name,
      destination: destination || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      notes: notes || null,
    },
  });

  return NextResponse.json({ trip }, { status: 201 });
}
