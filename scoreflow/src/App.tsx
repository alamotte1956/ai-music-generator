import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

type RightsBasis = "own_copyright" | "licensed" | "public_domain";

type ConvertResult = {
  title: string;
  key: string;
  tempo: number;
  timeSignature: string;
  lyrics: string;
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

type ApiError = {
  ok: false;
  code?: string;
  message?: string;
  job?: { error?: string };
};

type Health = {
  ok: boolean;
  apis?: { mirelo?: boolean; whisper?: boolean };
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [rightsBasis, setRightsBasis] = useState<RightsBasis | "">("");
  const [licenseUrl, setLicenseUrl] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const scoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
  }, []);

  const needsLicense = rightsBasis === "licensed" || rightsBasis === "public_domain";

  const canSubmit = useMemo(() => {
    if (!file || !ack || !rightsBasis || busy) return false;
    if (needsLicense && !licenseUrl.trim()) return false;
    return true;
  }, [file, ack, rightsBasis, needsLicense, licenseUrl, busy]);

  useEffect(() => {
    if (!result?.musicXml || !scoreRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay");
        if (cancelled || !scoreRef.current) return;
        scoreRef.current.innerHTML = "";
        const osmd = new OpenSheetMusicDisplay(scoreRef.current, {
          autoResize: true,
          drawTitle: true,
        });
        await osmd.load(result.musicXml);
        osmd.render();
      } catch (err) {
        console.warn("OSMD render failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [result]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || !canSubmit) return;
    setBusy(true);
    setError(null);
    setResult(null);
    if (scoreRef.current) scoreRef.current.innerHTML = "";

    const body = new FormData();
    body.append("audio", file);
    body.append("title", title || file.name.replace(/\.[^.]+$/, ""));
    body.append("lyrics", lyrics);
    body.append("rightsBasis", rightsBasis);
    body.append("licenseUrl", licenseUrl);
    body.append("copyrightAck", ack ? "true" : "false");

    try {
      const res = await fetch("/api/convert", { method: "POST", body });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const err = data as ApiError;
        setError(err.message || err.job?.error || "Conversion refused.");
        return;
      }
      setResult(data.job.result as ConvertResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header>
        <h1 className="brand">Scoreflow</h1>
        <p className="tagline">
          Professional MP3 → lead sheet: Mirelo Audio-to-MIDI Pro for notation,
          Whisper for lyrics, guitar chords from the score. DRM and unauthorized
          copyrighted material are refused.
        </p>
      </header>

      {health && (
        <div
          className={`banner ${health.apis?.mirelo ? "ok" : "warn"}`}
          style={{ marginBottom: "1rem" }}
        >
          {health.apis?.mirelo
            ? `Mirelo Audio-to-MIDI Pro connected${health.apis.whisper ? " · Whisper lyrics ready" : " · add OPENAI_API_KEY for lyric ASR"}`
            : "MIRELO_API_KEY missing — add your Mirelo Studio API key for professional transcription."}
        </div>
      )}

      <form className="panel grid" onSubmit={onSubmit}>
        <div className="grid two">
          <label>
            Audio file (MP3, WAV, FLAC, OGG, clear M4A/AAC)
            <input
              type="file"
              accept=".mp3,.wav,.flac,.ogg,.m4a,.aac,audio/mpeg,audio/wav,audio/flac,audio/ogg,audio/mp4,audio/aac"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setResult(null);
                setError(null);
              }}
            />
          </label>
          <label>
            Title
            <input
              type="text"
              value={title}
              placeholder="Song title"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        </div>

        <label>
          Lyrics (optional — Whisper fills this when OPENAI_API_KEY is set)
          <textarea
            value={lyrics}
            placeholder="Paste lyrics you have rights to use, or leave blank for Whisper…"
            onChange={(e) => setLyrics(e.target.value)}
          />
        </label>

        <div className="rights">
          <h2>Rights check — required</h2>
          <p>
            Scoreflow rejects DRM-protected files and will not convert material
            you do not own or license for transcription.
          </p>
          <label>
            Rights basis
            <select
              value={rightsBasis}
              onChange={(e) => setRightsBasis(e.target.value as RightsBasis | "")}
              required
            >
              <option value="">Select…</option>
              <option value="own_copyright">I own the copyright</option>
              <option value="licensed">
                I have a written license that allows transcription
              </option>
              <option value="public_domain">
                Public domain / open license (derivatives allowed)
              </option>
            </select>
          </label>
          {needsLicense && (
            <label>
              License / public-domain URL
              <input
                type="url"
                value={licenseUrl}
                placeholder="https://…"
                onChange={(e) => setLicenseUrl(e.target.value)}
                required
              />
            </label>
          )}
          <label className="ack">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            <span>
              I confirm this file is not DRM-protected, and that I own it, hold
              a transcription license, or it is public domain / openly licensed
              for derivatives. I will not upload commercial copyrighted tracks
              without authorization.
            </span>
          </label>
        </div>

        <div className="actions">
          <button className="primary" type="submit" disabled={!canSubmit}>
            {busy ? "Transcribing with Mirelo…" : "Convert to sheet music"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const res = await fetch("/api/sample");
                const data = await res.json();
                if (!data.ok) throw new Error("Sample preview failed");
                setResult(data.result as ConvertResult);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Sample failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Preview sample lead sheet
          </button>
        </div>

        {error && <div className="banner error">{error}</div>}
      </form>

      {result && (
        <section className="panel result">
          <h2>{result.title}</h2>
          <div className="meta">
            <span className="chip">Key {result.key}</span>
            <span className="chip">{result.tempo} BPM</span>
            <span className="chip">{result.timeSignature}</span>
            {result.provider && (
              <span className="chip">{result.provider}</span>
            )}
          </div>
          {result.warnings.map((w) => (
            <div key={w} className="banner warn">
              {w}
            </div>
          ))}

          {result.scorePdfUrl && (
            <div style={{ marginBottom: "1rem" }}>
              <h3>Professional score (PDF)</h3>
              <iframe
                title="Score PDF"
                src={result.scorePdfUrl}
                style={{
                  width: "100%",
                  height: "520px",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  background: "#fff",
                }}
              />
              <div className="actions">
                <a className="primary" href={result.scorePdfUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "inline-block" }}>
                  Open score PDF
                </a>
                {result.midiUrl && (
                  <a href={result.midiUrl} target="_blank" rel="noreferrer">
                    Download MIDI
                  </a>
                )}
                {result.musicXmlUrl && (
                  <a href={result.musicXmlUrl} target="_blank" rel="noreferrer">
                    Download MusicXML
                  </a>
                )}
                {result.tablaturePdfUrl && (
                  <a href={result.tablaturePdfUrl} target="_blank" rel="noreferrer">
                    Guitar/bass tab PDF
                  </a>
                )}
              </div>
            </div>
          )}

          {result.musicXml && (
            <>
              <h3>Interactive notation</h3>
              <div id="score" ref={scoreRef} />
            </>
          )}

          {result.lyrics && (
            <div style={{ marginTop: "1rem" }}>
              <h3>Lyrics</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{result.lyrics}</p>
            </div>
          )}

          <div className="chords">
            <h3>Guitar chords</h3>
            {result.chords.sections.map((s) => (
              <div key={s.name} className="chord-row">
                <strong>{s.name}</strong>
                {s.chords.map((c, i) => (
                  <span className="chord" key={`${s.name}-${c}-${i}`}>
                    {c}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="foot">
        Powered by Mirelo Audio-to-MIDI Pro · Whisper lyrics · Scoreflow refuses
        DRM and unauthorized copyrighted uploads.
      </p>
    </div>
  );
}
