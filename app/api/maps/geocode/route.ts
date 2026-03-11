import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerAuthSession } from "@/lib/auth";
import { unauthorized, validationError } from "@/lib/api-response";
import { geocodeQueries } from "@/lib/maps/nominatim";
import { checkRateLimit } from "@/lib/rate-limit/index";

const geocodeRequestSchema = z.object({
  queries: z.array(z.string().trim().min(2).max(180)).min(1).max(30),
});

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  // 5 geocode requests per 30 seconds per user (Nominatim policy: max 1 req/s)
  const rateLimit = await checkRateLimit(`geocode:${session.user.id}`, 5, 30_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "rate_limit", retryAfter: rateLimit.retryAfter },
      { status: 429 },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsedPayload = geocodeRequestSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return validationError(parsedPayload.error.flatten());
  }

  const results = await geocodeQueries(parsedPayload.data.queries, { maxQueries: 20 });

  return NextResponse.json({ results });
}
