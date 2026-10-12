export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Build the OAuth login URL. Returns null when the portal URL is missing or
 * invalid so callers can keep rendering instead of throwing during paint.
 */
export function buildLoginUrl(input: {
  portalUrl?: string;
  appId?: string;
  origin: string;
}): string | null {
  const portalUrl = input.portalUrl?.trim();
  if (!portalUrl) return null;

  const redirectUri = `${input.origin}/api/oauth/callback`;
  let state: string;
  try {
    state = btoa(redirectUri);
  } catch {
    try {
      state = btoa(unescape(encodeURIComponent(redirectUri)));
    } catch {
      return null;
    }
  }

  try {
    const url = new URL(`${portalUrl.replace(/\/$/, "")}/app-auth`);
    url.searchParams.set("appId", input.appId ?? "");
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    return url.toString();
  } catch {
    return null;
  }
}

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const url = buildLoginUrl({
    portalUrl: import.meta.env.VITE_OAUTH_PORTAL_URL,
    appId: import.meta.env.VITE_APP_ID,
    origin: typeof window === "undefined" ? "" : window.location.origin,
  });
  if (!url) {
    console.error(
      "Sign-in is unavailable: set VITE_OAUTH_PORTAL_URL and VITE_APP_ID, and register the redirect URL /api/oauth/callback."
    );
  }
  return url ?? "#";
};
