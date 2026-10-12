import express from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import ViteExpress from "vite-express";
import { runUploadGates } from "./gates.js";
import { convertAudioToLeadSheet } from "./convert.js";
import { mireloConfigured } from "./mirelo.js";
import { getSampleLeadSheet } from "./sample.js";
import type { ConvertJob } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const uploadDir = path.join(root, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const jobs = new Map<string, ConvertJob>();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".bin";
      cb(null, `${nanoid()}${ext}`);
    },
  }),
  limits: { fileSize: 40 * 1024 * 1024 },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    product: "scoreflow",
    apis: {
      mirelo: mireloConfigured(),
      whisper: Boolean(process.env.OPENAI_API_KEY?.trim()),
    },
  });
});

/** UI demo result — no upload, no API keys required. */
app.get("/api/sample", (_req, res) => {
  res.json({ ok: true, result: getSampleLeadSheet() });
});

app.post("/api/convert", upload.single("audio"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({
      ok: false,
      code: "EMPTY_FILE",
      message: "No audio file uploaded.",
    });
  }

  const title =
    String(req.body.title || "").trim() ||
    path.basename(file.originalname, path.extname(file.originalname));
  const lyrics = String(req.body.lyrics || "");
  const attestation = {
    rightsBasis: String(req.body.rightsBasis || ""),
    licenseUrl: String(req.body.licenseUrl || ""),
    copyrightAck: req.body.copyrightAck,
  };

  const gate = await runUploadGates({
    originalName: file.originalname,
    size: file.size,
    filePath: file.path,
    attestation,
  });

  if (!gate.ok) {
    fs.unlink(file.path, () => {});
    return res.status(403).json({
      ok: false,
      code: gate.code,
      message: gate.message,
    });
  }

  const id = nanoid();
  const job: ConvertJob = {
    id,
    status: "converting",
    title,
    createdAt: Date.now(),
  };
  jobs.set(id, job);

  try {
    const result = await convertAudioToLeadSheet({
      filePath: file.path,
      title,
      lyrics,
    });
    job.status = "done";
    job.result = result;
    fs.unlink(file.path, () => {});
    return res.json({ ok: true, job });
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "Conversion failed";
    fs.unlink(file.path, () => {});
    return res.status(500).json({ ok: false, job });
  }
});

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ ok: false, message: "Job not found" });
  res.json({ ok: true, job });
});

const port = Number(process.env.PORT || 3080);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(root, "dist", "index.html"));
  });
  app.listen(port, () => {
    console.log(`Scoreflow listening on http://localhost:${port}`);
  });
} else {
  ViteExpress.listen(app, port, () => {
    console.log(`Scoreflow (dev) http://localhost:${port}`);
  });
}
