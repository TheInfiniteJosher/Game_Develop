import { Router, type IRouter } from "express";
import OpenAI from "openai";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import multer from "multer";
import { getProjectRoot } from "../services/filesystem.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router: IRouter = Router({ mergeParams: true });

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

const OPAQUE_ASSET_TYPES = new Set(["background", "tileset"]);

function buildEnhancedPrompt(
  userPrompt: string,
  style: string,
  assetType: string,
  frameCount: number
): string {
  const styleMap: Record<string, string> = {
    pixel: "pixel art style, 16-bit retro game art, crisp pixels, limited color palette, no anti-aliasing",
    cartoon: "cartoon game art style, flat cel-shaded colors, bold clean outlines, vibrant colors",
    realistic: "realistic detailed game art, high quality digital painting, professional AAA game asset",
    vector: "flat vector art, clean geometric shapes, bold colors, scalable game asset design",
    painterly: "painterly digital art, expressive brushstrokes, rich color, indie game aesthetic",
    dark: "dark fantasy art style, moody atmospheric, detailed illustration, gothic game art",
  };

  const styleDesc = styleMap[style] || `${style} style`;
  const needsTransparency = !OPAQUE_ASSET_TYPES.has(assetType);
  const bgHint = needsTransparency
    ? "fully transparent background, PNG with alpha channel, no background fill, isolated subject only"
    : "";

  switch (assetType) {
    case "animation":
      return `${userPrompt}, ${styleDesc}, horizontal sprite sheet with exactly ${frameCount} equally-sized animation frames in a single row, ${bgHint}, game sprite sheet, consistent character across all frames, smooth animation cycle, no text or labels`;

    case "tileset":
      return `${userPrompt}, ${styleDesc}, seamless tileset texture, perfectly tileable, grid-aligned game tiles, consistent lighting, no text, top-down or side-scroller game tile, professional game texture`;

    case "background":
      return `${userPrompt}, ${styleDesc}, wide game background scene, layered environment for parallax scrolling, no characters in foreground, atmospheric depth, game level art, no text`;

    case "ui":
      return `${userPrompt}, ${styleDesc}, game UI element, clean interface design for HUD or menu, ${bgHint}, professional game interface art`;

    case "vfx":
      return `${userPrompt}, ${styleDesc}, game visual effect, particle or sprite effect, ${bgHint}, glowing or dynamic energy effect for game`;

    default:
      return `${userPrompt}, ${styleDesc}, game character or asset, suitable for 2D game, clean silhouette, ${bgHint}, professional game art quality, no text`;
  }
}

router.post("/assets/generate", async (req, res) => {
  try {
    const {
      prompt,
      style = "pixel",
      assetType = "sprite",
      frameCount = 1,
      aspectRatio = "1:1",
    } = req.body;

    if (!prompt?.trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const enhancedPrompt = buildEnhancedPrompt(prompt, style, assetType, Number(frameCount));

    const sizeMap: Record<string, "1024x1024"> = {
      "1:1": "1024x1024",
      "16:9": "1024x1024",
      "4:3": "1024x1024",
      "9:16": "1024x1024",
      "3:4": "1024x1024",
    };
    const size = sizeMap[aspectRatio] || "1024x1024";

    const needsTransparency = !OPAQUE_ASSET_TYPES.has(assetType);
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: enhancedPrompt,
      n: 1,
      size,
      ...(needsTransparency ? { background: "transparent" } : {}),
    } as Parameters<typeof openai.images.generate>[0]);

    const imageData = (response.data[0] as { b64_json?: string })?.b64_json;
    if (!imageData) {
      return res.status(500).json({ error: "No image data returned from generation API" });
    }

    const folder = ASSET_FOLDERS[assetType] || "assets/sprites";
    const projectRoot = getProjectRoot(req.params.id);
    const assetDir = path.join(projectRoot, folder);
    await fs.mkdir(assetDir, { recursive: true });

    const slug = prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 28);
    const timestamp = Date.now();
    const filename = `${slug}_${timestamp}.png`;
    const fullFilePath = path.join(assetDir, filename);
    const relativePath = `${folder}/${filename}`;

    await fs.writeFile(fullFilePath, Buffer.from(imageData, "base64"));

    const [imgWidth, imgHeight] = size.split("x").map(Number);
    const metadata: Record<string, unknown> = {
      assetType,
      style,
      prompt,
      enhancedPrompt,
      aspectRatio,
      createdAt: new Date().toISOString(),
    };

    if (assetType === "animation" && frameCount > 1) {
      metadata.frameCount = Number(frameCount);
      metadata.frameWidth = Math.floor(imgWidth / Number(frameCount));
      metadata.frameHeight = imgHeight;
    }

    const metaPath = fullFilePath.replace(".png", ".meta.json");
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

    res.json({
      path: relativePath,
      filename,
      assetType,
      metadata,
      previewUrl: `/api/preview/${req.params.id}/${relativePath}`,
    });
  } catch (err: unknown) {
    const error = err as Error & { status?: number; error?: { message?: string } };
    req.log.error({ err }, "Asset generation failed");
    const message =
      (error as { error?: { message?: string } }).error?.message ||
      error.message ||
      "Asset generation failed";
    res.status(500).json({ error: message });
  }
});

router.get("/assets", async (req, res) => {
  try {
    const projectRoot = getProjectRoot(req.params.id);
    const assetsRoot = path.join(projectRoot, "assets");

    if (!existsSync(assetsRoot)) {
      return res.json([]);
    }

    const assets: Array<{
      path: string;
      filename: string;
      folder: string;
      assetType: string;
      size: number;
      createdAt: string;
      previewUrl: string;
      metadata?: Record<string, unknown>;
    }> = [];

    async function scanDir(dir: string, relBase: string) {
      let entries: Awaited<ReturnType<typeof fs.readdir>>;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await scanDir(fullPath, relPath);
        } else if (/\.(png|jpg|jpeg|gif|webp)$/i.test(entry.name)) {
          const stat = await fs.stat(fullPath);
          const metaPath = fullPath.replace(/\.(png|jpg|jpeg|gif|webp)$/i, ".meta.json");
          let metadata: Record<string, unknown> | undefined;
          if (existsSync(metaPath)) {
            try {
              metadata = JSON.parse(await fs.readFile(metaPath, "utf-8"));
            } catch { /* ignore */ }
          }
          const assetRelPath = `assets/${relPath}`;
          assets.push({
            path: assetRelPath,
            filename: entry.name,
            folder: relBase,
            assetType: (metadata?.assetType as string) || "sprite",
            size: stat.size,
            createdAt: stat.birthtime.toISOString(),
            previewUrl: `/api/preview/${req.params.id}/${assetRelPath}`,
            metadata,
          });
        }
      }
    }

    await scanDir(assetsRoot, "");
    assets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(assets);
  } catch (err) {
    req.log.error({ err }, "Failed to list assets");
    res.status(500).json({ error: "Failed to list assets" });
  }
});

router.post("/assets/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const { assetType = "sprite" } = req.body;
    const allowedMimes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Only PNG, JPG, GIF, and WebP images are supported" });
    }

    const folder = ASSET_FOLDERS[assetType] || "assets/sprites";
    const projectRoot = getProjectRoot(req.params.id);
    const assetDir = path.join(projectRoot, folder);
    await fs.mkdir(assetDir, { recursive: true });

    const ext = req.file.originalname.split(".").pop()?.toLowerCase() || "png";
    const base = req.file.originalname.replace(/\.[^.]+$/, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    const timestamp = Date.now();
    const filename = `${base}_${timestamp}.${ext}`;
    const fullFilePath = path.join(assetDir, filename);
    const relativePath = `${folder}/${filename}`;

    await fs.writeFile(fullFilePath, req.file.buffer);

    const metadata = { assetType, createdAt: new Date().toISOString(), uploaded: true };
    await fs.writeFile(fullFilePath.replace(/\.[^.]+$/, ".meta.json"), JSON.stringify(metadata, null, 2));

    res.json({
      path: relativePath,
      filename,
      assetType,
      metadata,
      previewUrl: `/api/preview/${req.params.id}/${relativePath}`,
    });
  } catch (err) {
    req.log.error({ err }, "Asset upload failed");
    res.status(500).json({ error: "Asset upload failed" });
  }
});

router.delete("/assets", async (req, res) => {
  try {
    const { path: assetPath } = req.body;
    if (!assetPath) return res.status(400).json({ error: "path is required" });

    const projectRoot = getProjectRoot(req.params.id);
    const fullPath = path.resolve(path.join(projectRoot, assetPath));

    if (!fullPath.startsWith(path.resolve(projectRoot))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (existsSync(fullPath)) {
      await fs.unlink(fullPath);
    }
    const metaPath = fullPath.replace(/\.(png|jpg|jpeg|gif|webp)$/i, ".meta.json");
    if (existsSync(metaPath)) {
      await fs.unlink(metaPath);
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete asset");
    res.status(500).json({ error: "Failed to delete asset" });
  }
});

export default router;
