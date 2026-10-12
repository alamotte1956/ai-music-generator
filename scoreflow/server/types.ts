export type RightsBasis =
  | "own_copyright"
  | "licensed"
  | "public_domain";

export type GateRejectCode =
  | "DRM_PROTECTED"
  | "UNSUPPORTED_FORMAT"
  | "DECODE_FAILED"
  | "MISSING_ATTESTATION"
  | "COPYRIGHT_REFUSED"
  | "FILE_TOO_LARGE"
  | "EMPTY_FILE";

export type GateResult =
  | { ok: true }
  | { ok: false; code: GateRejectCode; message: string };

export type ConvertJob = {
  id: string;
  status: "queued" | "converting" | "done" | "failed";
  title: string;
  createdAt: number;
  error?: string;
  result?: ConvertResult;
};

export type ConvertResult = {
  title: string;
  key: string;
  tempo: number;
  timeSignature: string;
  lyrics: string;
  /** Legacy/local path; empty when using Mirelo MusicXML/PDF. */
  abcNotation: string;
  musicXml?: string;
  musicXmlUrl?: string;
  midiUrl?: string;
  scorePdfUrl?: string;
  tablaturePdfUrl?: string;
  provider?: string;
  chords: {
    key: string;
    sections: { name: string; chords: string[] }[];
    diagrams: { name: string; frets: number[] }[];
  };
  warnings: string[];
};
