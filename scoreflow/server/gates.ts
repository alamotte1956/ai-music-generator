import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import type { GateResult, RightsBasis } from "./types.js";

const execFileAsync = promisify(execFile);

/** Clear audio only — never DRM containers. */
export const ALLOWED_EXTENSIONS = new Set([
  ".mp3",
  ".wav",
  ".flac",
  ".ogg",
  ".m4a",
  ".aac",
]);

export const BLOCKED_EXTENSIONS = new Set([
  ".m4p", // iTunes DRM
  ".wma", // often DRM
  ".aax", // Audible
  ".aa",
]);

const MAX_BYTES = 40 * 1024 * 1024;

export type AttestationInput = {
  rightsBasis?: string;
  licenseUrl?: string;
  copyrightAck?: string | boolean;
};

/**
 * Refuse DRM / bad formats / missing rights attestation before any convert work.
 */
export function checkAttestation(input: AttestationInput): GateResult {
  const ack =
    input.copyrightAck === true ||
    input.copyrightAck === "true" ||
    input.copyrightAck === "on" ||
    input.copyrightAck === "1";

  if (!ack) {
    return {
      ok: false,
      code: "MISSING_ATTESTATION",
      message:
        "You must confirm you own the rights, hold a license that permits transcription, or that the work is public domain / openly licensed for derivatives.",
    };
  }

  const basis = input.rightsBasis as RightsBasis | undefined;
  if (
    basis !== "own_copyright" &&
    basis !== "licensed" &&
    basis !== "public_domain"
  ) {
    return {
      ok: false,
      code: "MISSING_ATTESTATION",
      message:
        "Select a rights basis: own copyright, licensed for transcription, or public domain / open license.",
    };
  }

  if (basis === "licensed" || basis === "public_domain") {
    const url = (input.licenseUrl || "").trim();
    if (!url) {
      return {
        ok: false,
        code: "MISSING_ATTESTATION",
        message:
          "Provide a license URL or public-domain / Creative Commons reference for licensed or public-domain works.",
      };
    }
  }

  return { ok: true };
}

export function checkFileBasics(
  originalName: string,
  size: number,
): GateResult {
  if (!size || size <= 0) {
    return {
      ok: false,
      code: "EMPTY_FILE",
      message: "Empty file rejected.",
    };
  }
  if (size > MAX_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: "File too large (max 40MB).",
    };
  }

  const ext = path.extname(originalName).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      code: "DRM_PROTECTED",
      message:
        "DRM-protected or encrypted audio formats are not accepted. Scoreflow never strips or bypasses DRM.",
    };
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      code: "UNSUPPORTED_FORMAT",
      message: `Unsupported format "${ext || "(none)"}". Use clear MP3, WAV, FLAC, OGG, or unencrypted M4A/AAC.`,
    };
  }
  return { ok: true };
}

type FfprobeStream = {
  codec_name?: string;
  codec_tag_string?: string;
  tags?: Record<string, string>;
};

type FfprobeJson = {
  format?: {
    format_name?: string;
    tags?: Record<string, string>;
  };
  streams?: FfprobeStream[];
};

function looksEncrypted(probe: FfprobeJson): boolean {
  const blob = JSON.stringify(probe).toLowerCase();
  if (
    blob.includes("encryption") ||
    blob.includes("encrypted") ||
    blob.includes("drm") ||
    blob.includes("fairplay") ||
    blob.includes("widevine") ||
    blob.includes("playready")
  ) {
    return true;
  }
  for (const s of probe.streams || []) {
    const name = (s.codec_name || "").toLowerCase();
    if (name.includes("encrypt") || name === "bin_data") return true;
  }
  return false;
}

/**
 * Probe + decode attempt. Rejects DRM / undecodable encrypted audio.
 */
export async function checkDrmAndDecodable(filePath: string): Promise<GateResult> {
  let probe: FfprobeJson;
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=format_name:format_tags:stream=codec_name,codec_tag_string:stream_tags",
        "-of",
        "json",
        filePath,
      ],
      { timeout: 20000, maxBuffer: 2 * 1024 * 1024 },
    );
    probe = JSON.parse(stdout) as FfprobeJson;
  } catch {
    return {
      ok: false,
      code: "DECODE_FAILED",
      message:
        "Could not read this audio file. It may be corrupted, encrypted, or DRM-protected.",
    };
  }

  if (looksEncrypted(probe)) {
    return {
      ok: false,
      code: "DRM_PROTECTED",
      message:
        "DRM-protected or encrypted audio cannot be uploaded. Scoreflow does not strip or bypass DRM.",
    };
  }

  // Short decode probe to clear PCM — fails on many DRM wrappers.
  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        filePath,
        "-t",
        "1",
        "-f",
        "null",
        "-",
      ],
      { timeout: 30000, maxBuffer: 1024 * 1024 },
    );
  } catch (err: unknown) {
    const msg = String(err instanceof Error ? err.message : err).toLowerCase();
    if (
      msg.includes("drm") ||
      msg.includes("encrypt") ||
      msg.includes("decrypt") ||
      msg.includes("forbidden")
    ) {
      return {
        ok: false,
        code: "DRM_PROTECTED",
        message:
          "DRM-protected or encrypted audio cannot be uploaded. Scoreflow does not strip or bypass DRM.",
      };
    }
    return {
      ok: false,
      code: "DECODE_FAILED",
      message:
        "Audio could not be decoded as clear (non-DRM) audio. Conversion refused.",
    };
  }

  return { ok: true };
}

export async function runUploadGates(opts: {
  originalName: string;
  size: number;
  filePath: string;
  attestation: AttestationInput;
}): Promise<GateResult> {
  const attestation = checkAttestation(opts.attestation);
  if (!attestation.ok) return attestation;

  const basics = checkFileBasics(opts.originalName, opts.size);
  if (!basics.ok) return basics;

  return checkDrmAndDecodable(opts.filePath);
}
