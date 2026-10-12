import { describe, expect, it } from "vitest";
import { requestOrigin } from "../shared/brand";

describe("requestOrigin", () => {
  it("uses the forwarded host and protocol", () => {
    expect(
      requestOrigin({
        headers: {
          "x-forwarded-host": "clefvane.vercel.app",
          "x-forwarded-proto": "https",
          host: "internal",
        },
      })
    ).toBe("https://clefvane.vercel.app");
  });

  it("falls back to the Host header", () => {
    expect(
      requestOrigin({
        headers: { host: "localhost:3000" },
        protocol: "http",
      })
    ).toBe("http://localhost:3000");
  });
});
