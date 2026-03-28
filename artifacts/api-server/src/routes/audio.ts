import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { getProjectRoot } from "../services/filesystem.js";
import { generateAudioForProject, listProjectAudio } from "../services/audioPipeline.js";

const router: IRouter = Router({ mergeParams: true });

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
