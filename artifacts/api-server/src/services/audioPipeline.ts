import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { getProjectRoot } from "./filesystem.js";

// ─── ElevenLabs Sound Generation ──────────────────────────────────────────────

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not configured. Add your ElevenLabs API key in Secrets.");
  return key;
}

// ─── Folders ──────────────────────────────────────────────────────────────────

const AUDIO_FOLDERS: Record<string, string> = {
  sfx: "assets/audio/sfx",
  music: "assets/audio/music",
  ambient: "assets/audio/ambient",
  ui: "assets/audio/ui",
};

// ─── Duration mapping ─────────────────────────────────────────────────────────

const DURATION_SECONDS: Record<string, number> = {
  short: 1.5,
  medium: 4.0,
  long: 8.0,
  loop: 20.0,
};

// ─── Prompt enhancement ───────────────────────────────────────────────────────

function buildAudioPrompt(params: GenerateAudioParams): string {
  const { description, audioType, style, mood } = params;

  const styleMap: Record<string, string> = {
    "8bit": "8-bit retro chiptune style",
    "synth": "synthesizer electronic style",
    "realistic": "realistic foley recorded sound",
    "fantasy": "fantasy orchestral magical style",
    "scifi": "science fiction futuristic style",
    "lofi": "lo-fi warm mellow style",
    "cinematic": "cinematic orchestral dramatic style",
  };

  const moodHint = mood ? `, ${mood} mood` : "";
  const styleHint = style ? `, ${styleMap[style] || style}` : "";

  switch (audioType) {
    case "music":
      return `Loopable background music: ${description}${styleHint}${moodHint}, no sudden start or end, seamlessly loopable, instrumental only`;
    case "ambient":
      return `Ambient sound layer: ${description}${styleHint}${moodHint}, loopable environmental background, consistent texture`;
    case "ui":
      return `UI interface sound: ${description}${styleHint}${moodHint}, very short, crisp, clean`;
    case "sfx":
    default:
      return `Game sound effect: ${description}${styleHint}${moodHint}, punchy, clear, no reverb tail`;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateAudioParams {
  audioName: string;
  audioType: "sfx" | "music" | "ambient" | "ui";
  description: string;
  style?: string;
  mood?: string;
  duration?: "short" | "medium" | "long" | "loop";
  loop?: boolean;
}

export interface GenerateAudioResult {
  path: string;
  filename: string;
  previewUrl: string;
  audioType: string;
  loop: boolean;
  durationSeconds: number;
  phaserLoadSnippet: string;
  phaserPlaySnippet: string;
}

// ─── Core generation function ─────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export async function generateAudioForProject(
  projectId: string,
  params: GenerateAudioParams
): Promise<GenerateAudioResult> {
  const apiKey = getApiKey();
  const { audioName, audioType, loop = audioType === "music" || audioType === "ambient" } = params;

  const durationKey = params.duration || (audioType === "music" || audioType === "ambient" ? "loop" : audioType === "ui" ? "short" : "medium");
  const durationSeconds = DURATION_SECONDS[durationKey] ?? 2.0;

  const prompt = buildAudioPrompt(params);

  // Call ElevenLabs Sound Generation API
  const response = await fetch(`${ELEVENLABS_BASE}/sound-generation`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: Math.min(durationSeconds, 22),
      prompt_influence: audioType === "music" || audioType === "ambient" ? 0.4 : 0.3,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown error");
    throw new Error(`ElevenLabs API error ${response.status}: ${errText}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  // Save to project
  const folder = AUDIO_FOLDERS[audioType] || "assets/audio/sfx";
  const projectRoot = getProjectRoot(projectId);
  const audioDir = path.join(projectRoot, folder);
  await fs.mkdir(audioDir, { recursive: true });

  const slug = slugify(audioName);
  const ext = audioType === "sfx" || audioType === "ui" ? "wav" : "mp3";
  let filename = `${slug}.${ext}`;
  let fullPath = path.join(audioDir, filename);

  // Handle duplicates
  let counter = 1;
  while (existsSync(fullPath)) {
    filename = `${slug}_${counter}.${ext}`;
    fullPath = path.join(audioDir, filename);
    counter++;
  }

  await fs.writeFile(fullPath, audioBuffer);

  const relPath = path.join(folder, filename).replace(/\\/g, "/");

  // Save metadata
  const meta = {
    audioName,
    audioType,
    style: params.style,
    mood: params.mood,
    duration: durationKey,
    durationSeconds,
    loop,
    description: params.description,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(fullPath.replace(/\.\w+$/, ".meta.json"), JSON.stringify(meta, null, 2));

  const phaserKey = slugify(audioName);
  const phaserLoadSnippet = `this.load.audio('${phaserKey}', '${relPath}')`;
  const phaserPlaySnippet = loop
    ? `this.sound.play('${phaserKey}', { loop: true, volume: ${audioType === "music" ? 0.4 : 0.6} })`
    : `this.sound.play('${phaserKey}', { volume: 0.7 })`;

  return {
    path: relPath,
    filename,
    previewUrl: `/api/preview/${projectId}/${relPath}`,
    audioType,
    loop,
    durationSeconds,
    phaserLoadSnippet,
    phaserPlaySnippet,
  };
}

// ─── List project audio ───────────────────────────────────────────────────────

export async function listProjectAudio(projectId: string) {
  const projectRoot = getProjectRoot(projectId);
  const audioRoot = path.join(projectRoot, "assets/audio");
  const results: Array<{
    path: string; filename: string; audioType: string;
    previewUrl: string; loop: boolean; createdAt: string;
    metadata?: Record<string, unknown>;
  }> = [];

  if (!existsSync(audioRoot)) return results;

  async function scanDir(dir: string) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (/\.(mp3|wav|ogg)$/i.test(entry.name)) {
        const stat = await fs.stat(fullPath);
        const relPath = path.relative(projectRoot, fullPath).replace(/\\/g, "/");
        const metaPath = fullPath.replace(/\.\w+$/, ".meta.json");
        let metadata: Record<string, unknown> | undefined;
        try { metadata = JSON.parse(await fs.readFile(metaPath, "utf-8")); } catch { /* no meta */ }
        const folderName = path.relative(audioRoot, path.dirname(fullPath)).split(path.sep)[0];
        results.push({
          path: relPath,
          filename: entry.name,
          audioType: metadata?.audioType as string || folderName || "sfx",
          previewUrl: `/api/preview/${projectId}/${relPath}`,
          loop: metadata?.loop as boolean ?? false,
          createdAt: stat.birthtime.toISOString(),
          metadata,
        });
      }
    }
  }

  await scanDir(audioRoot);
  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return results;
}
