import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";

const MIRELO_BASE = "https://api.mirelo.ai";

export type MireloScorePdfs = {
  full_score_url?: string;
  parts?: { name?: string; url?: string }[];
  tablature?: { name?: string; url?: string }[];
};

export type MireloResult = {
  midi_url?: string;
  musicxml_url?: string;
  notes?: unknown;
  tempo?: number;
  meter?: string;
  key?: string;
  chords?: string[];
  score_pdfs?: MireloScorePdfs;
  raw: Record<string, unknown>;
};

function apiKey(): string {
  const key = process.env.MIRELO_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "MIRELO_API_KEY is not set. Add your Mirelo Studio API key to enable professional Audio-to-MIDI Pro transcription.",
    );
  }
  return key;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey()}`,
    ...extra,
  };
}

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
      return "audio/wav";
    case ".flac":
      return "audio/flac";
    case ".ogg":
      return "audio/ogg";
    case ".m4a":
      return "audio/mp4";
    case ".aac":
      return "audio/aac";
    default:
      return "audio/mpeg";
  }
}

/**
 * Upload private audio to Mirelo assets (v3 ticket + multipart).
 */
export async function uploadMireloAsset(filePath: string): Promise<string> {
  const contentType = guessContentType(filePath);
  const ticketRes = await fetch(`${MIRELO_BASE}/v3/assets`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ content_type: contentType }),
  });
  if (!ticketRes.ok) {
    const text = await ticketRes.text().catch(() => "");
    throw new Error(
      `Mirelo asset ticket failed (${ticketRes.status}): ${text.slice(0, 400)}`,
    );
  }
  const ticket = (await ticketRes.json()) as {
    id: string;
    upload_url: string;
    fields: Record<string, string>;
  };

  const bytes = await fs.readFile(filePath);
  const form = new FormData();
  for (const [k, v] of Object.entries(ticket.fields || {})) {
    form.append(k, v);
  }
  form.append(
    "file",
    new Blob([bytes], { type: contentType }),
    path.basename(filePath),
  );

  const uploadRes = await fetch(ticket.upload_url, {
    method: "POST",
    body: form,
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");
    throw new Error(
      `Mirelo asset upload failed (${uploadRes.status}): ${text.slice(0, 400)}`,
    );
  }
  return ticket.id;
}

async function pollJob(jobUrl: string, timeoutMs = 12 * 60 * 1000): Promise<MireloResult> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(jobUrl, { headers: authHeaders() });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Mirelo job poll failed (${res.status}): ${text.slice(0, 400)}`);
    }
    const body = (await res.json()) as Record<string, unknown>;
    const status = String(body.status || "").toLowerCase();
    if (status === "succeeded" || status === "success" || status === "completed") {
      return normalizeResult(body);
    }
    if (status === "errored" || status === "failed" || status === "error") {
      throw new Error(
        `Mirelo transcription failed: ${JSON.stringify(body.error || body).slice(0, 500)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("Mirelo transcription timed out waiting for job completion.");
}

function normalizeResult(body: Record<string, unknown>): MireloResult {
  const result = (body.result as Record<string, unknown>) || body;
  const score =
    (result.score_pdfs as MireloScorePdfs) ||
    (body.score_pdfs as MireloScorePdfs) ||
    undefined;

  const chordsRaw = result.chords || body.chords;
  let chords: string[] | undefined;
  if (Array.isArray(chordsRaw)) {
    chords = chordsRaw.map((c) =>
      typeof c === "string" ? c : String((c as { symbol?: string }).symbol || c),
    );
  }

  return {
    midi_url: (result.midi_url || body.midi_url) as string | undefined,
    musicxml_url: (result.musicxml_url || body.musicxml_url) as string | undefined,
    notes: result.notes || body.notes,
    tempo: Number(result.tempo || body.tempo || 0) || undefined,
    meter: (result.meter || body.meter) as string | undefined,
    key: (result.key || body.key) as string | undefined,
    chords,
    score_pdfs: score,
    raw: body,
  };
}

/**
 * Professional full-mix transcription via Mirelo Audio-to-MIDI Pro.
 * Returns MIDI, MusicXML, tempo/meter/key/chords, and optional score PDFs.
 */
export async function transcribeWithMirelo(filePath: string): Promise<MireloResult> {
  const assetId = await uploadMireloAsset(filePath);
  const payload = {
    audio: { type: "asset", asset_id: assetId },
    optimize_musicxml: true,
    score_pdfs: true,
  };

  // Prefer async jobs for reliability (avoids long sync timeouts).
  const createRes = await fetch(`${MIRELO_BASE}/v2/audio-to-midi/v1.0/jobs`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json",
      "Idempotency-Key": nanoid(),
    }),
    body: JSON.stringify(payload),
  });

  if (!createRes.ok) {
    // Fallback to sync for short clips if jobs endpoint rejects the payload shape.
    if (createRes.status === 404 || createRes.status === 405) {
      return transcribeWithMireloSync(payload);
    }
    const text = await createRes.text().catch(() => "");
    // Some tenants only expose sync — try that next.
    if (createRes.status >= 400) {
      try {
        return await transcribeWithMireloSync(payload);
      } catch {
        throw new Error(
          `Mirelo job create failed (${createRes.status}): ${text.slice(0, 500)}`,
        );
      }
    }
  }

  const created = (await createRes.json()) as {
    job_id?: string;
    job_url?: string;
    id?: string;
  };
  const jobUrl =
    created.job_url ||
    (created.job_id
      ? `${MIRELO_BASE}/v2/audio-to-midi/v1.0/jobs/${created.job_id}`
      : created.id
        ? `${MIRELO_BASE}/v2/audio-to-midi/v1.0/jobs/${created.id}`
        : null);
  if (!jobUrl) {
    // Response might already be a completed sync-shaped body
    if ((created as { midi_url?: string }).midi_url || (created as { status?: string }).status) {
      return normalizeResult(created as unknown as Record<string, unknown>);
    }
    throw new Error("Mirelo job create did not return a job URL.");
  }
  return pollJob(jobUrl);
}

async function transcribeWithMireloSync(payload: Record<string, unknown>): Promise<MireloResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000);
  try {
    const res = await fetch(`${MIRELO_BASE}/v2/audio-to-midi/v1.0/sync`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
        "Idempotency-Key": nanoid(),
      }),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Mirelo sync failed (${res.status}): ${text.slice(0, 500)}`);
    }
    return normalizeResult((await res.json()) as Record<string, unknown>);
  } finally {
    clearTimeout(timer);
  }
}

export function mireloConfigured(): boolean {
  return Boolean(process.env.MIRELO_API_KEY?.trim());
}
