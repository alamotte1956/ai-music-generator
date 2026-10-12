import fs from "node:fs/promises";
import path from "node:path";

/**
 * Professional lyric ASR via OpenAI Whisper (optional OPENAI_API_KEY).
 */
export async function transcribeLyricsWithWhisper(
  filePath: string,
): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const bytes = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase() || ".mp3";
  const form = new FormData();
  form.append(
    "file",
    new Blob([bytes], { type: "audio/mpeg" }),
    `audio${ext}`,
  );
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append(
    "prompt",
    "Transcribe the sung lyrics of this song. Output only the lyric words.",
  );

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`[lyrics] Whisper failed: ${res.status} ${text.slice(0, 200)}`);
    return null;
  }
  const data = (await res.json()) as { text?: string };
  return (data.text || "").trim() || null;
}
