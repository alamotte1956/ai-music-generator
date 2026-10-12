import { mireloConfigured, transcribeWithMirelo } from "./mirelo.js";
import { transcribeLyricsWithWhisper } from "./lyrics.js";
import { fetchText, parseMusicXmlExtras } from "./musicxml.js";
import type { ConvertResult } from "./types.js";

const GUITAR_SHAPES: Record<string, number[]> = {
  C: [-1, 3, 2, 0, 1, 0],
  Dm: [-1, -1, 0, 2, 3, 1],
  Em: [0, 2, 2, 0, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
  G: [3, 2, 0, 0, 0, 3],
  Am: [-1, 0, 2, 2, 1, 0],
  D: [-1, -1, 0, 2, 3, 2],
  E: [0, 2, 2, 1, 0, 0],
  A: [-1, 0, 2, 2, 2, 0],
  Bm: [-1, 2, 4, 4, 3, 2],
};

function diagramsFor(chords: string[]) {
  return [...new Set(chords)].slice(0, 12).map((name) => ({
    name,
    frets: GUITAR_SHAPES[name] || GUITAR_SHAPES[name.replace(/maj/i, "")] || [
      -1, -1, -1, -1, -1, -1,
    ],
  }));
}

function sectionize(chords: string[]) {
  if (!chords.length) {
    return [
      { name: "A", chords: ["C", "G", "Am", "F"] },
      { name: "B", chords: ["F", "C", "G", "C"] },
    ];
  }
  const a = chords.slice(0, Math.min(4, chords.length));
  const b = chords.slice(4, 8);
  return [
    { name: "Verse / A", chords: a },
    ...(b.length ? [{ name: "Chorus / B", chords: b }] : []),
  ];
}

/**
 * Professional convert path:
 * 1) Mirelo Audio-to-MIDI Pro → MIDI + MusicXML + score PDFs + musical context
 * 2) OpenAI Whisper (optional) → lyrics
 * 3) MusicXML parse → chords / key / tempo / embedded lyrics
 */
export async function convertAudioToLeadSheet(opts: {
  filePath: string;
  title: string;
  lyrics?: string;
}): Promise<ConvertResult> {
  if (!mireloConfigured()) {
    throw new Error(
      "Professional transcription requires MIRELO_API_KEY (Mirelo Audio-to-MIDI Pro). Add the secret and restart Scoreflow.",
    );
  }

  const warnings: string[] = [];
  const mirelo = await transcribeWithMirelo(opts.filePath);

  let musicXmlText = "";
  let extras = {
    title: undefined as string | undefined,
    key: undefined as string | undefined,
    tempo: undefined as number | undefined,
    timeSignature: undefined as string | undefined,
    lyrics: "",
    chords: [] as string[],
  };

  if (mirelo.musicxml_url) {
    try {
      musicXmlText = await fetchText(mirelo.musicxml_url);
      extras = parseMusicXmlExtras(musicXmlText);
    } catch (err) {
      warnings.push(
        `MusicXML fetch/parse warning: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else {
    warnings.push(
      "Mirelo did not return MusicXML (no notes detected or engraving skipped).",
    );
  }

  let lyrics = (opts.lyrics || "").trim();
  if (!lyrics) {
    const whispered = await transcribeLyricsWithWhisper(opts.filePath);
    if (whispered) lyrics = whispered;
    else if (extras.lyrics) lyrics = extras.lyrics;
    else {
      lyrics = "";
      warnings.push(
        "No lyrics provided and OPENAI_API_KEY not set (or Whisper found none). Add lyrics or set OPENAI_API_KEY for ASR.",
      );
    }
  }

  const chords =
    (mirelo.chords && mirelo.chords.length ? mirelo.chords : extras.chords) ||
    [];

  const pdf =
    mirelo.score_pdfs?.full_score_url ||
    mirelo.score_pdfs?.parts?.[0]?.url ||
    mirelo.score_bundle_url ||
    undefined;

  const tabUrl = mirelo.score_pdfs?.tablature?.[0]?.url;

  return {
    title: extras.title || opts.title,
    key: mirelo.key || extras.key || "C",
    tempo: mirelo.tempo || extras.tempo || 120,
    timeSignature: mirelo.meter || extras.timeSignature || "4/4",
    lyrics,
    abcNotation: "", // Professional path uses MusicXML/PDF, not ABC
    musicXml: musicXmlText || undefined,
    musicXmlUrl: mirelo.musicxml_url,
    midiUrl: mirelo.midi_url,
    scorePdfUrl: pdf,
    tablaturePdfUrl: tabUrl,
    provider: "mirelo-audio-to-midi-pro",
    chords: {
      key: mirelo.key || extras.key || "C",
      sections: sectionize(chords),
      diagrams: diagramsFor(chords),
    },
    warnings,
  };
}
