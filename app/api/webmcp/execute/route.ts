import { NextResponse } from "next/server";

import { getServerAuthSession } from "@/lib/auth";
import { validationError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit/index";
import { webmcpExecuteSchema } from "@/lib/validation";
import { executeWebMCPTool } from "@/lib/webmcp/handlers";

function isToolError(result: unknown): result is { error: string } {
  return typeof result === "object" && result !== null && "error" in result && typeof (result as Record<string, unknown>).error === "string";
}

const STATUS_MAP: Record<string, number> = {
  internal_api_error: 500,
  auth_required: 401,
  validation_error: 400,
  unknown_tool: 400,
};

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: "auth_required",
        login_url: "/login",
      },
      { status: 401 },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsedPayload = webmcpExecuteSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return validationError(parsedPayload.error.flatten());
  }

  const rateLimit = await checkRateLimit(session.user.id, 10, 60_000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many tool invocations.",
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: {
          "retry-after": String(rateLimit.retryAfter),
        },
      },
    );
  }

  const result = await executeWebMCPTool(
    parsedPayload.data.toolName,
    parsedPayload.data.input ?? {},
  );

  if (isToolError(result)) {
    const status = STATUS_MAP[result.error] ?? 500;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}

