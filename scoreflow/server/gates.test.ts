import { describe, expect, it } from "vitest";
import {
  checkAttestation,
  checkFileBasics,
  ALLOWED_EXTENSIONS,
  BLOCKED_EXTENSIONS,
} from "./gates.js";

describe("copyright attestation", () => {
  it("refuses without ack", () => {
    const r = checkAttestation({
      rightsBasis: "own_copyright",
      copyrightAck: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MISSING_ATTESTATION");
  });

  it("refuses without rights basis", () => {
    const r = checkAttestation({ copyrightAck: true });
    expect(r.ok).toBe(false);
  });

  it("requires license URL for licensed works", () => {
    const r = checkAttestation({
      copyrightAck: true,
      rightsBasis: "licensed",
    });
    expect(r.ok).toBe(false);
  });

  it("accepts own_copyright with ack", () => {
    const r = checkAttestation({
      copyrightAck: true,
      rightsBasis: "own_copyright",
    });
    expect(r.ok).toBe(true);
  });

  it("accepts public_domain with reference URL", () => {
    const r = checkAttestation({
      copyrightAck: true,
      rightsBasis: "public_domain",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    });
    expect(r.ok).toBe(true);
  });
});

describe("DRM / format gates", () => {
  it("blocks DRM extensions", () => {
    expect(BLOCKED_EXTENSIONS.has(".m4p")).toBe(true);
    const r = checkFileBasics("song.m4p", 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("DRM_PROTECTED");
  });

  it("allows clear mp3", () => {
    expect(ALLOWED_EXTENSIONS.has(".mp3")).toBe(true);
    const r = checkFileBasics("demo.mp3", 2048);
    expect(r.ok).toBe(true);
  });

  it("rejects empty and oversized", () => {
    expect(checkFileBasics("a.mp3", 0).ok).toBe(false);
    expect(checkFileBasics("a.mp3", 50 * 1024 * 1024).ok).toBe(false);
  });
});
