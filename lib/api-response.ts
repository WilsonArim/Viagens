import { NextResponse } from "next/server";

export function unauthorized() {
  return NextResponse.json({ error: "auth_required" }, { status: 401 });
}

export function validationError(details: unknown) {
  return NextResponse.json({ error: "validation_error", details }, { status: 400 });
}

export function notFound(message = "not_found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function rateLimited(retryAfter: number) {
  return NextResponse.json(
    { error: "rate_limited", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
