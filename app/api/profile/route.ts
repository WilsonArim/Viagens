import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { validationError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { familyProfileSchema } from "@/lib/validation";

function unauthorized() {
  return NextResponse.json({ error: "auth_required", login_url: "/login" }, { status: 401 });
}

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const profile = await prisma.familyProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      members: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const payload = await request.json().catch(() => null);
  const parsedPayload = familyProfileSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return validationError(parsedPayload.error.flatten());
  }

  const existing = await prisma.familyProfile.findUnique({
    where: {
      userId: session.user.id,
    },
  });

  if (existing) {
    return NextResponse.json(
      {
        error: "profile_exists",
        message: "Perfil já existe. Usa PUT para atualizar.",
      },
      { status: 409 },
    );
  }

  const profile = await prisma.familyProfile.create({
    data: {
      userId: session.user.id,
      generalBudget: parsedPayload.data.generalBudget,
      dietaryRestrictions: parsedPayload.data.dietaryRestrictions,
      travelPace: parsedPayload.data.travelPace,
      notes: parsedPayload.data.notes,
      members: {
        create: parsedPayload.data.members.map((member) => ({
          name: member.name,
          age: member.age,
          hobbies: member.hobbies,
          interests: member.interests,
        })),
      },
    },
    include: {
      members: true,
    },
  });

  return NextResponse.json({ profile }, { status: 201 });
}

export async function PUT(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const payload = await request.json().catch(() => null);
  const parsedPayload = familyProfileSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return validationError(parsedPayload.error.flatten());
  }

  const profile = await prisma.familyProfile.upsert({
    where: {
      userId: session.user.id,
    },
    create: {
      userId: session.user.id,
      generalBudget: parsedPayload.data.generalBudget,
      dietaryRestrictions: parsedPayload.data.dietaryRestrictions,
      travelPace: parsedPayload.data.travelPace,
      notes: parsedPayload.data.notes,
      members: {
        create: parsedPayload.data.members.map((member) => ({
          name: member.name,
          age: member.age,
          hobbies: member.hobbies,
          interests: member.interests,
        })),
      },
    },
    update: {
      generalBudget: parsedPayload.data.generalBudget,
      dietaryRestrictions: parsedPayload.data.dietaryRestrictions,
      travelPace: parsedPayload.data.travelPace,
      notes: parsedPayload.data.notes,
      members: {
        deleteMany: {},
        create: parsedPayload.data.members.map((member) => ({
          name: member.name,
          age: member.age,
          hobbies: member.hobbies,
          interests: member.interests,
        })),
      },
    },
    include: {
      members: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  return NextResponse.json({ profile });
}
