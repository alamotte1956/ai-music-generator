/**
 * Public product name.
 * Clefvane is a coined name (clef + vane) with no matching app, company, or domain.
 * Public URLs use the host that is serving the app. There is no custom domain.
 */
export const SITE_NAME = "Clefvane";
export const SITE_TITLE = `${SITE_NAME} - AI Music Generator & Composer`;
export const SUPPORT_EMAIL = "alamotte1956@gmail.com";
export const LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663211654017/Q3oEbCsP6DUj527aoyypq7/logo-makecustommusic-V4H6NBVctSA5W9x5679fcE.webp";

/** Origin of the page currently open in the browser. */
export function currentOrigin(): string {
  if (typeof window === "undefined" || !window.location?.origin) return "";
  return window.location.origin;
}

function headerValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim() ?? "";
}

/** Origin of an incoming HTTP request, from proxy headers or the Host header. */
export function requestOrigin(req: {
  headers: { [key: string]: string | string[] | undefined };
  protocol?: string;
}): string {
  const host = headerValue(req.headers["x-forwarded-host"]) || headerValue(req.headers.host) || "localhost";
  const forwarded = headerValue(req.headers["x-forwarded-proto"]);
  const fallback =
    host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const proto = (forwarded || req.protocol || fallback).replace(/:$/, "");
  return `${proto}://${host}`;
}
