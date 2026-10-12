import { describe, expect, it } from "vitest";
import { buildLoginUrl } from "./const";

describe("buildLoginUrl", () => {
  it("returns null when the portal URL is missing", () => {
    expect(buildLoginUrl({ origin: "https://app.example" })).toBeNull();
    expect(buildLoginUrl({ portalUrl: "   ", origin: "https://app.example" })).toBeNull();
  });

  it("includes the callback as the redirect URI", () => {
    const url = buildLoginUrl({
      portalUrl: "https://portal.example.com",
      appId: "app_123",
      origin: "https://app.example",
    });
    expect(url).toBeTruthy();
    const parsed = new URL(url!);
    expect(parsed.origin).toBe("https://portal.example.com");
    expect(parsed.pathname).toBe("/app-auth");
    expect(parsed.searchParams.get("appId")).toBe("app_123");
    expect(parsed.searchParams.get("redirectUri")).toBe(
      "https://app.example/api/oauth/callback"
    );
    expect(parsed.searchParams.get("type")).toBe("signIn");
    expect(parsed.searchParams.get("state")).toBe(
      btoa("https://app.example/api/oauth/callback")
    );
  });

  it("returns null for a malformed portal URL", () => {
    expect(
      buildLoginUrl({ portalUrl: "not a url", origin: "https://app.example" })
    ).toBeNull();
  });
});
