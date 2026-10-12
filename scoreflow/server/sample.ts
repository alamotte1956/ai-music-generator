import type { ConvertResult } from "./types.js";

/** Public-domain style demo lead sheet so the UI can be previewed without API keys. */
const SAMPLE_MUSICXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work><work-title>Morning Sketch (Sample)</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Melody</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <key><fifths>0</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      <direction placement="above">
        <direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>100</per-minute></metronome></direction-type>
        <sound tempo="100"/>
      </direction>
      <harmony><root><root-step>C</root-step></root><kind text="C">major</kind></harmony>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric number="1"><text>Morn</text></lyric></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric number="1"><text>ing</text></lyric></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric number="1"><text>light</text></lyric></note>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric number="1"><text>is</text></lyric></note>
    </measure>
    <measure number="2">
      <harmony><root><root-step>F</root-step></root><kind text="F">major</kind></harmony>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric number="1"><text>soft</text></lyric></note>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric number="1"><text>and</text></lyric></note>
      <harmony><root><root-step>G</root-step></root><kind text="G">major</kind></harmony>
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><type>half</type><lyric number="1"><text>clear</text></lyric></note>
    </measure>
    <measure number="3">
      <harmony><root><root-step>A</root-step></root><kind text="Am">minor</kind></harmony>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric number="1"><text>Sing</text></lyric></note>
      <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric number="1"><text>a</text></lyric></note>
      <harmony><root><root-step>C</root-step></root><kind text="C">major</kind></harmony>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric number="1"><text>qui</text></lyric></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric number="1"><text>et</text></lyric></note>
    </measure>
    <measure number="4">
      <harmony><root><root-step>F</root-step></root><kind text="F">major</kind></harmony>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric number="1"><text>song</text></lyric></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type><lyric number="1"><text>for</text></lyric></note>
      <harmony><root><root-step>G</root-step></root><kind text="G">major</kind></harmony>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><type>half</type><lyric number="1"><text>you</text></lyric></note>
      <barline location="right"><bar-style>light-heavy</bar-style></barline>
    </measure>
  </part>
</score-partwise>
`;

export function getSampleLeadSheet(): ConvertResult {
  return {
    title: "Morning Sketch (Sample)",
    key: "C",
    tempo: 100,
    timeSignature: "4/4",
    lyrics: "Morning light is soft and clear\nSing a quiet song for you",
    abcNotation: "",
    musicXml: SAMPLE_MUSICXML,
    provider: "sample-preview",
    chords: {
      key: "C",
      sections: [
        { name: "A", chords: ["C", "F", "G", "C"] },
        { name: "B", chords: ["Am", "C", "F", "G"] },
      ],
      diagrams: [
        { name: "C", frets: [-1, 3, 2, 0, 1, 0] },
        { name: "F", frets: [1, 3, 3, 2, 1, 1] },
        { name: "G", frets: [3, 2, 0, 0, 0, 3] },
        { name: "Am", frets: [-1, 0, 2, 2, 1, 0] },
      ],
    },
    warnings: [
      "This is a built-in sample so you can preview the Scoreflow UI without API keys.",
      "Real conversions use Mirelo Audio-to-MIDI Pro once MIRELO_API_KEY is injected into a new agent.",
    ],
  };
}
