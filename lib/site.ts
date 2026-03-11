const DEFAULT_SITE_URL = "https://detetiveviagens.pt";

export function getSiteUrl(): string {
  const rawUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    DEFAULT_SITE_URL;

  const normalizedUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  return normalizedUrl.replace(/\/$/, "");
}

export function absoluteUrl(pathname = "/"): string {
  return new URL(pathname, getSiteUrl()).toString();
}
