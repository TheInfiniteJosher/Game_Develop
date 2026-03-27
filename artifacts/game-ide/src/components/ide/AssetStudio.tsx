import { useState, useCallback, useEffect } from "react";
import { Wand2, Loader2, Download, Copy, Trash2, RefreshCw, ImageIcon, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface GeneratedAsset {
  path: string;
  filename: string;
  assetType: string;
  previewUrl: string;
  metadata?: {
    frameCount?: number;
    frameWidth?: number;
    frameHeight?: number;
    style?: string;
    prompt?: string;
    createdAt?: string;
  };
}

interface AssetStudioProps {
  projectId: string;
}

const STYLES = [
  { value: "pixel", label: "Pixel Art" },
  { value: "cartoon", label: "Cartoon" },
  { value: "realistic", label: "Realistic" },
  { value: "vector", label: "Vector" },
  { value: "dark", label: "Dark Fantasy" },
  { value: "painterly", label: "Painterly" },
];

const ASSET_TYPES = [
  { value: "sprite", label: "Character", folder: "assets/sprites" },
  { value: "animation", label: "Sprite Sheet", folder: "assets/sprites" },
  { value: "tileset", label: "Tileset", folder: "assets/tilesets" },
  { value: "background", label: "Background", folder: "assets/backgrounds" },
  { value: "ui", label: "UI Element", folder: "assets/ui" },
  { value: "vfx", label: "VFX", folder: "assets/vfx" },
  { value: "enemy", label: "Enemy", folder: "assets/sprites" },
  { value: "item", label: "Item/Pickup", folder: "assets/sprites" },
];

const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1 Square" },
  { value: "16:9", label: "16:9 Wide" },
  { value: "4:3", label: "4:3" },
  { value: "9:16", label: "9:16 Tall" },
];

const FRAME_COUNTS = [1, 2, 4, 6, 8, 12];

const PRESET_PROMPTS: { label: string; prompt: string; type: string; style: string; frames: number }[] = [
  { label: "Run Cycle", prompt: "side-view character running animation, small hero knight", type: "animation", style: "pixel", frames: 8 },
  { label: "Grass Tileset", prompt: "top-down grass terrain tileset with dirt path variations", type: "tileset", style: "pixel", frames: 1 },
  { label: "Space Background", prompt: "deep space background with stars, nebula, and distant planets", type: "background", style: "realistic", frames: 1 },
  { label: "Dungeon BG", prompt: "dark dungeon stone corridor background with torches", type: "background", style: "dark", frames: 1 },
  { label: "Fantasy Boss", prompt: "dark fantasy dragon boss monster full body view", type: "enemy", style: "dark", frames: 1 },
  { label: "Coin Pickup", prompt: "golden spinning coin pickup item", type: "item", style: "pixel", frames: 1 },
  { label: "HUD Frame", prompt: "fantasy game HUD frame and health bar UI elements", type: "ui", style: "pixel", frames: 1 },
  { label: "Explosion VFX", prompt: "orange and red explosion burst effect with sparks", type: "vfx", style: "cartoon", frames: 1 },
  { label: "Jump Cycle", prompt: "side-view character jumping animation, game character", type: "animation", style: "pixel", frames: 6 },
  { label: "Forest Tiles", prompt: "top-down forest floor tileset with trees and rocks", type: "tileset", style: "cartoon", frames: 1 },
];

function getCodeSnippet(asset: GeneratedAsset): string {
  const name = asset.filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_");
  const path = asset.path;

  if (asset.assetType === "animation" && asset.metadata?.frameCount && asset.metadata.frameCount > 1) {
    const fw = asset.metadata.frameWidth || 128;
    const fh = asset.metadata.frameHeight || 128;
    return `// In preload():
this.load.spritesheet('${name}', '${path}', {
  frameWidth: ${fw},
  frameHeight: ${fh}
});

// In create() - create animation:
this.anims.create({
  key: '${name}_anim',
  frames: this.anims.generateFrameNumbers('${name}', { start: 0, end: ${(asset.metadata.frameCount as number) - 1} }),
  frameRate: 10,
  repeat: -1
});

// Play animation on a sprite:
// sprite.play('${name}_anim');`;
  }

  if (asset.assetType === "background") {
    return `// In preload():
this.load.image('${name}', '${path}');

// In create():
this.add.image(0, 0, '${name}').setOrigin(0, 0).setDisplaySize(this.scale.width, this.scale.height);`;
  }

  if (asset.assetType === "tileset") {
    return `// In preload():
this.load.image('${name}', '${path}');

// In create() with tilemaps:
// const map = this.make.tilemap({ key: 'map' });
// const tiles = map.addTilesetImage('${name}', '${name}');`;
  }

  return `// In preload():
this.load.image('${name}', '${path}');

// In create():
const ${name} = this.add.image(x, y, '${name}');`;
}

export function AssetStudio({ projectId }: AssetStudioProps) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("pixel");
  const [assetType, setAssetType] = useState("sprite");
  const [frameCount, setFrameCount] = useState(1);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestAsset, setLatestAsset] = useState<GeneratedAsset | null>(null);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [showSnippet, setShowSnippet] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setIsLoadingAssets(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/assets`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data);
      }
    } catch {
      // silently ignore
    } finally {
      setIsLoadingAssets(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setLatestAsset(null);
    setShowSnippet(false);

    try {
      const res = await fetch(`/api/projects/${projectId}/assets/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, assetType, frameCount, aspectRatio }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Generation failed");
      }

      setLatestAsset(data);
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreset = (preset: typeof PRESET_PROMPTS[0]) => {
    setPrompt(preset.prompt);
    setAssetType(preset.type);
    setStyle(preset.style);
    setFrameCount(preset.frames);
    if (preset.type === "background") setAspectRatio("16:9");
    else if (preset.type === "animation") setAspectRatio("16:9");
    else setAspectRatio("1:1");
  };

  const handleDelete = async (asset: GeneratedAsset) => {
    try {
      await fetch(`/api/projects/${projectId}/assets`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: asset.path }),
      });
      await loadAssets();
      if (latestAsset?.path === asset.path) setLatestAsset(null);
    } catch { /* ignore */ }
  };

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const copySnippet = () => {
    if (!latestAsset) return;
    navigator.clipboard.writeText(getCodeSnippet(latestAsset));
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const isAnimation = assetType === "animation";

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-hidden">
      <div className="flex-1 overflow-y-auto">

        {/* Generation Form */}
        <div className="p-3 border-b border-border space-y-3">
          {/* Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Describe Your Asset</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. side-scrolling hero character with sword, red armor..."
              className="resize-none text-sm bg-muted/30 border-border focus:border-primary h-16 font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleGenerate();
              }}
            />
          </div>

          {/* Preset Templates */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Presets</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p)}
                  className="text-xs px-2 py-0.5 rounded bg-muted/50 hover:bg-primary/20 hover:text-primary border border-border/50 hover:border-primary/50 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Row */}
          <div className="grid grid-cols-2 gap-2">
            {/* Style */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Style</label>
              <div className="flex flex-wrap gap-1">
                {STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      style === s.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 border-border hover:bg-muted/60"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Asset Type */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Asset Type</label>
              <div className="flex flex-wrap gap-1">
                {ASSET_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setAssetType(t.value)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      assetType === t.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 border-border hover:bg-muted/60"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Options Row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Aspect Ratio */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground">Ratio:</label>
              <div className="flex gap-1">
                {ASPECT_RATIOS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setAspectRatio(r.value)}
                    className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                      aspectRatio === r.value
                        ? "bg-primary/20 text-primary border-primary/60"
                        : "bg-muted/30 border-border hover:bg-muted/60"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Frame Count - only for animation */}
            {isAnimation && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground">Frames:</label>
                <div className="flex gap-1">
                  {FRAME_COUNTS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setFrameCount(f)}
                      className={`text-xs px-1.5 py-0.5 rounded border transition-colors min-w-[24px] text-center ${
                        frameCount === f
                          ? "bg-primary/20 text-primary border-primary/60"
                          : "bg-muted/30 border-border hover:bg-muted/60"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full gap-2"
            size="sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating... (15-30s)
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate Asset
              </>
            )}
          </Button>

          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded p-2">
              {error}
            </div>
          )}
        </div>

        {/* Latest Generated Result */}
        {latestAsset && (
          <div className="p-3 border-b border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Generated
              </span>
              <span className="text-xs text-muted-foreground">{latestAsset.filename}</span>
            </div>

            {/* Preview */}
            <div className="relative bg-[repeating-conic-gradient(#333_0%_25%,#222_0%_50%)] bg-[size:16px_16px] rounded border border-border overflow-hidden">
              <img
                src={latestAsset.previewUrl}
                alt={latestAsset.filename}
                className="w-full max-h-48 object-contain"
              />
            </div>

            {/* Metadata badges */}
            <div className="flex flex-wrap gap-1">
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                {latestAsset.assetType}
              </span>
              {latestAsset.metadata?.style && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted/50 border border-border">
                  {latestAsset.metadata.style}
                </span>
              )}
              {latestAsset.metadata?.frameCount && latestAsset.metadata.frameCount > 1 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                  {latestAsset.metadata.frameCount} frames · {latestAsset.metadata.frameWidth}px each
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-xs h-7"
                onClick={() => copyPath(latestAsset.path)}
              >
                <Copy className="w-3 h-3" />
                {copiedPath === latestAsset.path ? "Copied!" : "Copy Path"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-xs h-7"
                onClick={() => setShowSnippet(!showSnippet)}
              >
                <Wand2 className="w-3 h-3" />
                Code Snippet
                {showSnippet ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </div>

            {/* Code Snippet Expander */}
            {showSnippet && (
              <div className="relative">
                <pre className="text-xs bg-muted/40 border border-border rounded p-2 overflow-x-auto font-mono text-green-300 whitespace-pre leading-relaxed">
                  {getCodeSnippet(latestAsset)}
                </pre>
                <button
                  onClick={copySnippet}
                  className="absolute top-1.5 right-1.5 text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 border border-border transition-colors"
                >
                  {copiedSnippet ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Asset Browser */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-3 h-3" />
              Project Assets ({assets.length})
            </label>
            <button
              onClick={loadAssets}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingAssets ? "animate-spin" : ""}`} />
            </button>
          </div>

          {assets.length === 0 && !isLoadingAssets && (
            <div className="text-center py-6 text-muted-foreground text-xs">
              No assets yet. Generate your first asset above!
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {assets.map((asset) => (
              <div
                key={asset.path}
                className="group relative rounded border border-border bg-muted/20 overflow-hidden hover:border-primary/50 transition-colors"
              >
                <div className="bg-[repeating-conic-gradient(#333_0%_25%,#222_0%_50%)] bg-[size:12px_12px] aspect-square">
                  <img
                    src={asset.previewUrl}
                    alt={asset.filename}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="p-1">
                  <div className="text-xs text-muted-foreground truncate" title={asset.filename}>
                    {asset.filename.replace(/_\d+\.png$/, ".png")}
                  </div>
                  <div className="text-xs text-primary/70">{asset.assetType}</div>
                </div>

                {/* Hover actions */}
                <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                  <button
                    onClick={() => copyPath(asset.path)}
                    className="p-1.5 rounded bg-muted hover:bg-primary/20 hover:text-primary border border-border transition-colors"
                    title="Copy path"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      setLatestAsset(asset);
                      setShowSnippet(false);
                    }}
                    className="p-1.5 rounded bg-muted hover:bg-primary/20 hover:text-primary border border-border transition-colors"
                    title="View & get code"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(asset)}
                    className="p-1.5 rounded bg-muted hover:bg-red-500/20 hover:text-red-400 border border-border transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
