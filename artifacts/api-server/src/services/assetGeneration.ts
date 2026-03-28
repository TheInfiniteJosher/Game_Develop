import OpenAI from "openai";
import path from "path";
import fs from "fs/promises";
import { getProjectRoot } from "./filesystem.js";
import { saveFileToGcs } from "./gcs-sync.js";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const ASSET_FOLDERS: Record<string, string> = {
  sprite: "assets/sprites",
  animation: "assets/sprites",
  tileset: "assets/tilesets",
  background: "assets/backgrounds",
  ui: "assets/ui",
  vfx: "assets/vfx",
  enemy: "assets/sprites",
  item: "assets/sprites",
};

const STYLE_MAP: Record<string, string> = {
  pixel: "pixel art style, 16-bit retro game art, crisp pixels, limited color palette, no anti-aliasing",
  cartoon: "cartoon game art style, flat cel-shaded colors, bold clean outlines, vibrant colors",
  realistic: "realistic detailed game art, high quality digital painting, professional game asset",
  vector: "flat vector art, clean geometric shapes, bold colors, scalable game asset design",
  painterly: "painterly digital art, expressive brushstrokes, rich color, indie game aesthetic",
  dark: "dark fantasy art style, moody atmospheric, detailed illustration, gothic game art",
};

// Asset types that need transparent backgrounds vs opaque
const OPAQUE_TYPES = new Set(["background", "tileset"]);

function buildEnhancedPrompt(
  userPrompt: string,
  style: string,
  assetType: string,
  frameCount: number
): string {
  const styleDesc = STYLE_MAP[style] || `${style} style`;
  const needsTransparency = !OPAQUE_TYPES.has(assetType);
  const bgHint = needsTransparency
    ? "fully transparent background, PNG with alpha channel, no background fill, isolated subject only"
    : "";

  switch (assetType) {
    case "animation":
      return `${userPrompt}, ${styleDesc}, horizontal sprite sheet with exactly ${frameCount} equally-sized animation frames in a single row, ${bgHint}, game sprite sheet, consistent character across all frames, smooth animation cycle, no text`;
    case "tileset":
      return `${userPrompt}, ${styleDesc}, seamless tileset texture, perfectly tileable, grid-aligned game tiles, consistent lighting, no text, professional game texture`;
    case "background":
      return `${userPrompt}, ${styleDesc}, wide game background scene, layered environment, no characters in foreground, atmospheric depth, game level art, no text`;
    case "ui":
      return `${userPrompt}, ${styleDesc}, game UI element, clean interface design for HUD or menu, ${bgHint}, professional game interface art`;
    case "vfx":
      return `${userPrompt}, ${styleDesc}, game visual effect, particle or sprite effect, ${bgHint}`;
    default:
      return `${userPrompt}, ${styleDesc}, game character or asset, suitable for 2D side-scroller or top-down game, clean silhouette, ${bgHint}, professional game art quality, no text`;
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export interface GenerateAssetResult {
  path: string;
  filename: string;
  previewUrl: string;
  assetType: string;
  style: string;
  frameCount: number;
  frameWidth?: number;
  frameHeight?: number;
}

export async function generateAssetForProject(
  projectId: string,
  params: {
    name: string;
    prompt: string;
    assetType: string;
    style: string;
    frameCount?: number;
    aspectRatio?: string;
  }
): Promise<GenerateAssetResult> {
  const { name, prompt, assetType, style, frameCount = 1, aspectRatio = "1:1" } = params;

  const enhancedPrompt = buildEnhancedPrompt(prompt, style, assetType, Number(frameCount));

  const needsTransparency = !OPAQUE_TYPES.has(assetType);
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt: enhancedPrompt,
    n: 1,
    size: "1024x1024",
    ...(needsTransparency ? { background: "transparent" } : {}),
  } as Parameters<typeof openai.images.generate>[0]);

  const imageData = (response.data[0] as { b64_json?: string })?.b64_json;
  if (!imageData) throw new Error("No image data returned");

  const imageBuffer = Buffer.from(imageData, "base64");

  const folder = ASSET_FOLDERS[assetType] || "assets/sprites";
  const projectRoot = getProjectRoot(projectId);
  const assetDir = path.join(projectRoot, folder);
  await fs.mkdir(assetDir, { recursive: true });

  const slug = slugify(name);
  const filename = `${slug}.png`;
  const fullPath = path.join(assetDir, filename);

  // Handle duplicates
  let finalPath = fullPath;
  let finalFilename = filename;
  let counter = 1;
  while (true) {
    try {
      await fs.access(finalPath);
      finalFilename = `${slug}_${counter}.png`;
      finalPath = path.join(assetDir, finalFilename);
      counter++;
    } catch {
      break;
    }
  }

  await fs.writeFile(finalPath, imageBuffer);

  const relPath = path.join(folder, finalFilename).replace(/\\/g, "/");

  // Persist to GCS so the file survives redeployment
  saveFileToGcs(projectId, relPath, imageBuffer).catch(() => {});

  // Compute frame dimensions for sprite sheets
  let frameWidth: number | undefined;
  let frameHeight: number | undefined;
  if (assetType === "animation" && Number(frameCount) > 1) {
    frameWidth = Math.floor(1024 / Number(frameCount));
    frameHeight = 1024;
  }

  // Save metadata
  const meta = {
    assetType,
    style,
    prompt,
    frameCount: Number(frameCount),
    frameWidth,
    frameHeight,
    createdAt: new Date().toISOString(),
  };
  const metaJson = JSON.stringify(meta, null, 2);
  await fs.writeFile(finalPath.replace(/\.png$/, ".meta.json"), metaJson);
  saveFileToGcs(projectId, relPath.replace(/\.png$/, ".meta.json"), metaJson).catch(() => {});

  return {
    path: relPath,
    filename: finalFilename,
    previewUrl: `/api/preview/${projectId}/${relPath}`,
    assetType,
    style,
    frameCount: Number(frameCount),
    frameWidth,
    frameHeight,
  };
}
