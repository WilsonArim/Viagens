import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = [
  "/dashboard",
  "/profile",
  "/trips",
  "/chat",
  "/agency-check",
  "/saved-agencies",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ── CSRF protection for state-changing requests ─────────────────────────
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method) && pathname.startsWith("/api/")) {
    const isAuthCallback = pathname.startsWith("/api/auth/");

    if (!isAuthCallback) {
      const origin = request.headers.get("origin");
      const host = request.headers.get("host");

      if (origin && host) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host) {
            return new NextResponse("Forbidden", { status: 403 });
          }
        } catch {
          return new NextResponse("Forbidden", { status: 403 });
        }
      }
    }
  }

  // ── CSP nonce generation ────────────────────────────────────────────────
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.google.com https://*.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://nominatim.openstreetmap.org https://api.x.ai https://api.openai.com https://generativelanguage.googleapis.com",
    "frame-ancestors 'none'",
  ].join("; ");

  // ── Auth check for protected paths ──────────────────────────────────────
  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isProtected) {
    const sessionToken =
      request.cookies.get("__Secure-next-auth.session-token") ??
      request.cookies.get("next-auth.session-token");

    if (!sessionToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Set security headers on response ────────────────────────────────────
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
