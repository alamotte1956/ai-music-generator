/**
 * Lightweight MusicXML extraction for lyrics, chords, key, tempo.
 * Not a full engraver — Mirelo PDF/MusicXML are the source of truth for notation.
 */

export type MusicXmlExtras = {
  title?: string;
  key?: string;
  tempo?: number;
  timeSignature?: string;
  lyrics: string;
  chords: string[];
};

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function parseMusicXmlExtras(xml: string): MusicXmlExtras {
  const lyrics: string[] = [];
  const lyricRe = /<text[^>]*>([^<]*)<\/text>/gi;
  let m: RegExpExecArray | null;
  while ((m = lyricRe.exec(xml))) {
    const t = decodeXmlEntities(m[1]).trim();
    if (t) lyrics.push(t);
  }

  const chords: string[] = [];
  const harmonyBlocks = xml.match(/<harmony[\s\S]*?<\/harmony>/gi) || [];
  for (const block of harmonyBlocks) {
    const rootStep = block.match(/<root-step[^>]*>([^<]+)<\/root-step>/i)?.[1];
    const rootAlter = block.match(/<root-alter[^>]*>([^<]+)<\/root-alter>/i)?.[1];
    const kind = block.match(/<kind[^>]*text="([^"]+)"/i)?.[1]
      || block.match(/<kind[^>]*>([^<]+)<\/kind>/i)?.[1];
    if (!rootStep) continue;
    let symbol = rootStep.toUpperCase();
    if (rootAlter === "1") symbol += "#";
    if (rootAlter === "-1") symbol += "b";
    if (kind && kind !== "major" && kind !== "Major") {
      const k = kind.toLowerCase();
      if (k.includes("minor") || k === "m") symbol += "m";
      else if (k.includes("dominant") || k.includes("7")) symbol += "7";
      else if (kind.match(/^[a-z0-9+#/-]+$/i)) symbol += kind;
    }
    chords.push(symbol);
  }

  // Also pick up chord symbols written as direction/words (common in lead sheets)
  const wordsRe = /<words[^>]*>([^<]+)<\/words>/gi;
  while ((m = wordsRe.exec(xml))) {
    const t = decodeXmlEntities(m[1]).trim();
    if (/^[A-G][#b]?(m|maj|min|dim|aug|sus\d?|add\d|\d)?(\/[A-G][#b]?)?$/i.test(t)) {
      chords.push(t);
    }
  }

  const fifths = xml.match(/<fifths[^>]*>([^<]+)<\/fifths>/i)?.[1];
  const mode = xml.match(/<mode[^>]*>([^<]+)<\/mode>/i)?.[1] || "major";
  const fifthsMap: Record<string, string> = {
    "0": "C",
    "1": "G",
    "2": "D",
    "3": "A",
    "4": "E",
    "5": "B",
    "6": "F#",
    "-1": "F",
    "-2": "Bb",
    "-3": "Eb",
    "-4": "Ab",
    "-5": "Db",
    "-6": "Gb",
  };
  let key = fifths != null ? fifthsMap[fifths] || "C" : undefined;
  if (key && mode.toLowerCase().startsWith("min")) key += "m";

  const beats = xml.match(/<beats[^>]*>([^<]+)<\/beats>/i)?.[1];
  const beatType = xml.match(/<beat-type[^>]*>([^<]+)<\/beat-type>/i)?.[1];
  const timeSignature = beats && beatType ? `${beats}/${beatType}` : undefined;

  const tempo =
    Number(xml.match(/<sound[^>]*tempo="([^"]+)"/i)?.[1]) ||
    Number(xml.match(/per-minute[^>]*>([^<]+)<\/per-minute>/i)?.[1]) ||
    undefined;

  const title =
    xml.match(/<work-title[^>]*>([^<]+)<\/work-title>/i)?.[1] ||
    xml.match(/<movement-title[^>]*>([^<]+)<\/movement-title>/i)?.[1];

  // Dedupe chords preserving order
  const seen = new Set<string>();
  const uniqueChords = chords.filter((c) => {
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });

  return {
    title: title ? decodeXmlEntities(title) : undefined,
    key,
    tempo,
    timeSignature,
    lyrics: lyrics.join(" ").replace(/\s+/g, " ").trim(),
    chords: uniqueChords,
  };
}

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}
