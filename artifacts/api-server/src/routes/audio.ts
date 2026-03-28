import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import multer from "multer";
import { getProjectRoot } from "../services/filesystem.js";
import { generateAudioForProject, listProjectAudio } from "../services/audioPipeline.js";

const router: IRouter = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Generate audio
router.post("/audio/generate", async (req, res) => {
  try {
    const {
      audioName,
      audioType = "sfx",
      description,
      style,
      mood,
      duration,
      loop,
    } = req.body;

    if (!audioName?.trim()) return res.status(400).json({ error: "audioName is required" });
    if (!description?.trim()) return res.status(400).json({ error: "description is required" });

    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(503).json({
        error: "ElevenLabs API key not configured. Add ELEVENLABS_API_KEY to your project secrets."
      });
    }

    const result = await generateAudioForProject(req.params.id, {
      audioName,
      audioType,
      description,
      style,
      mood,
      duration,
      loop,
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to generate audio");
    res.status(500).json({ error: String(err) });
  }
});

// List project audio
router.get("/audio", async (req, res) => {
  try {
    const audio = await listProjectAudio(req.params.id);
    res.json(audio);
  } catch (err) {
    req.log.error({ err }, "Failed to list audio");
    res.status(500).json({ error: "Failed to list audio" });
  }
});

// Upload audio file
router.post("/audio/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const allowedMimes = ["audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/x-wav", "audio/wave"];
    const allowedExts = [".mp3", ".ogg", ".wav"];
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!allowedMimes.includes(req.file.mimetype) && !allowedExts.includes(ext)) {
      return res.status(400).json({ error: "Only MP3, OGG, and WAV audio files are supported" });
    }

    const { audioType = "sfx" } = req.body;
    const validTypes = ["sfx", "music", "ambient", "ui"];
    const type = validTypes.includes(audioType) ? audioType : "sfx";
    const loop = type === "music" || type === "ambient";

    const projectRoot = getProjectRoot(req.params.id);
    const audioDir = path.join(projectRoot, "assets", "audio", type);
    await fs.mkdir(audioDir, { recursive: true });

    const base = req.file.originalname.replace(/\.[^.]+$/, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    const timestamp = Date.now();
    const actualExt = ext || ".mp3";
    const filename = `${base}_${timestamp}${actualExt}`;
    const fullPath = path.join(audioDir, filename);
    const relPath = `assets/audio/${type}/${filename}`;

    await fs.writeFile(fullPath, req.file.buffer);

    const metadata = {
      audioName: base,
      audioType: type,
      loop,
      createdAt: new Date().toISOString(),
      uploaded: true,
    };
    await fs.writeFile(fullPath.replace(/\.[^.]+$/, ".meta.json"), JSON.stringify(metadata, null, 2));

    res.json({
      path: relPath,
      filename,
      audioType: type,
      previewUrl: `/api/preview/${req.params.id}/${relPath}`,
      loop,
      metadata,
    });
  } catch (err) {
    req.log.error({ err }, "Audio upload failed");
    res.status(500).json({ error: "Audio upload failed" });
  }
});

// Delete audio file
router.delete("/audio", async (req, res) => {
  try {
    const { path: audioPath } = req.body;
    if (!audioPath) return res.status(400).json({ error: "path is required" });

    const projectRoot = getProjectRoot(req.params.id);
    const fullPath = path.resolve(path.join(projectRoot, audioPath));

    if (!fullPath.startsWith(path.resolve(projectRoot))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (existsSync(fullPath)) await fs.unlink(fullPath);

    const metaPath = fullPath.replace(/\.\w+$/, ".meta.json");
    if (existsSync(metaPath)) await fs.unlink(metaPath);

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete audio");
    res.status(500).json({ error: "Failed to delete audio" });
  }
});

export default router;
