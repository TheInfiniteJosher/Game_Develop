import { useState } from "react";
import { Sparkles, Loader2, Copy, ChevronDown, ChevronUp, Wand2, ImageIcon, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch { /* ignore */ }
}

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
  };
}

interface AssetStudioProps {
  projectId: string;
  onAssetGenerated?: () => void;
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
  { value: "sprite", label: "Character" },
  { value: "animation", label: "Sprite Sheet" },
  { value: "tileset", label: "Tileset" },
  { value: "background", label: "Background" },
  { value: "ui", label: "UI Element" },
  { value: "vfx", label: "VFX" },
  { value: "enemy", label: "Enemy" },
  { value: "item", label: "Item / Pickup" },
];

const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "4:3", label: "4:3" },
  { value: "9:16", label: "9:16" },
];

const FRAME_COUNTS = [1, 2, 4, 6, 8, 12];

const PRESETS: { label: string; prompt: string; type: string; style: string; frames: number }[] = [
  { label: "Run Cycle", prompt: "side-view hero knight running animation", type: "animation", style: "pixel", frames: 8 },
  { label: "Grass Tiles", prompt: "top-down grass terrain with dirt path variations", type: "tileset", style: "pixel", frames: 1 },
  { label: "Space BG", prompt: "deep space with stars, nebula and distant planets", type: "background", style: "realistic", frames: 1 },
  { label: "Dungeon BG", prompt: "dark dungeon stone corridor with torches", type: "background", style: "dark", frames: 1 },
  { label: "Fantasy Boss", prompt: "dark fantasy dragon boss, full body", type: "enemy", style: "dark", frames: 1 },
  { label: "Coin Pickup", prompt: "golden spinning coin pickup", type: "item", style: "pixel", frames: 1 },
  { label: "HUD Frame", prompt: "fantasy game HUD frame and health bar UI", type: "ui", style: "pixel", frames: 1 },
  { label: "Explosion VFX", prompt: "orange red explosion burst with sparks", type: "vfx", style: "cartoon", frames: 1 },
  { label: "Jump Cycle", prompt: "side-view character jumping animation", type: "animation", style: "pixel", frames: 6 },
  { label: "Forest Tiles", prompt: "top-down forest floor with trees and rocks", type: "tileset", style: "cartoon", frames: 1 },
];

function getCodeSnippet(asset: GeneratedAsset): string {
  const name = asset.filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_");
  const path = asset.path;
  if (asset.assetType === "animation" && asset.metadata?.frameCount && asset.metadata.frameCount > 1) {
    const fw = asset.metadata.frameWidth || 128;
    const fh = asset.metadata.frameHeight || 128;
    return `// preload()\nthis.load.spritesheet('${name}', '${path}', {\n  frameWidth: ${fw},\n  frameHeight: ${fh}\n});\n\n// create()\nthis.anims.create({\n  key: '${name}_anim',\n  frames: this.anims.generateFrameNumbers('${name}', { start: 0, end: ${(asset.metadata.frameCount as number) - 1} }),\n  frameRate: 10, repeat: -1\n});\n// sprite.play('${name}_anim');`;
  }
  if (asset.assetType === "background") {
    return `// preload()\nthis.load.image('${name}', '${path}');\n\n// create()\nthis.add.image(0, 0, '${name}')\n  .setOrigin(0, 0).setDisplaySize(this.scale.width, this.scale.height);`;
  }
  return `// preload()\nthis.load.image('${name}', '${path}');\n\n// create()\nconst ${name} = this.add.image(x, y, '${name}');`;
}

export function AssetStudio({ projectId, onAssetGenerated }: AssetStudioProps) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("pixel");
  const [assetType, setAssetType] = useState("sprite");
  const [frameCount, setFrameCount] = useState(1);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedAsset | null>(null);
  const [showSnippet, setShowSnippet] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  const handlePreset = (preset: typeof PRESETS[0]) => {
    setPrompt(preset.prompt);
    setAssetType(preset.type);
    setStyle(preset.style);
    setFrameCount(preset.frames);
    setAspectRatio(preset.type === "background" ? "16:9" : "1:1");
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);
    setShowSnippet(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/assets/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, assetType, frameCount, aspectRatio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setResult(data);
      onAssetGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const isAnimation = assetType === "animation";

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3 space-y-3">

        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
            <ImageIcon className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <div className="text-xs font-semibold">Asset Generator</div>
            <div className="text-[10px] text-muted-foreground">Assets save to your project's Assets panel</div>
          </div>
        </div>

        {/* Prompt */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Describe</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. side-scrolling hero with red armor and sword..."
            className="resize-none text-sm bg-muted/30 border-border focus:border-primary h-16 font-mono"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleGenerate(); }}
          />
        </div>

        {/* Presets */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Quick presets</label>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => handlePreset(p)}
                className="text-[11px] px-2 py-0.5 rounded bg-muted/50 hover:bg-primary/20 hover:text-primary border border-border/50 hover:border-primary/50 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Style selector */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Style</label>
          <div className="flex flex-wrap gap-1">
            {STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => setStyle(s.value)}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
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

        {/* Asset type selector */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Type</label>
          <div className="flex flex-wrap gap-1">
            {ASSET_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setAssetType(t.value)}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
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

        {/* Aspect + Frame count row */}
        <div className="flex items-start gap-3 flex-wrap">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Ratio</label>
            <div className="flex gap-1">
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setAspectRatio(r.value)}
                  className={`text-[11px] px-1.5 py-0.5 rounded border transition-colors ${
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
          {isAnimation && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Frames</label>
              <div className="flex gap-1">
                {FRAME_COUNTS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFrameCount(f)}
                    className={`text-[11px] px-1.5 py-0.5 rounded border transition-colors min-w-[22px] text-center ${
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

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full gap-2"
          size="sm"
          style={!isGenerating && prompt.trim() ? { background: "linear-gradient(135deg, #F97316, #EA580C)" } : undefined}
        >
          {isGenerating ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating… (15–30s)</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5" />Generate Asset</>
          )}
        </Button>

        {error && (
          <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded p-2">{error}</div>
        )}
      </div>

      {/* Result — below the form, seamlessly attached */}
      {result && (
        <div className="border-t border-border mx-3 mb-3 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-green-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Generated
            </span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[160px]" title={result.filename}>{result.filename}</span>
          </div>

          {/* Preview */}
          <div className="bg-[repeating-conic-gradient(#2a2a3a_0%_25%,#1e1e2e_0%_50%)] bg-[size:14px_14px] rounded-lg border border-border overflow-hidden">
            <img src={result.previewUrl} alt={result.filename} className="w-full max-h-44 object-contain" />
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">{result.assetType}</span>
            {result.metadata?.style && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 border border-border text-muted-foreground">{result.metadata.style}</span>
            )}
            {result.metadata?.frameCount && result.metadata.frameCount > 1 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {result.metadata.frameCount} frames · {result.metadata.frameWidth}px
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-1.5">
            <button
              onClick={() => { navigator.clipboard.writeText(result.path); setCopiedPath(true); setTimeout(() => setCopiedPath(false), 2000); }}
              className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
            >
              <Copy className="w-3 h-3" />
              {copiedPath ? "Copied!" : "Copy Path"}
            </button>
            <button
              onClick={() => downloadFile(result.previewUrl, result.filename)}
              className="flex items-center justify-center gap-1 text-xs py-1.5 px-2.5 rounded border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
              title="Download"
            >
              <Download className="w-3 h-3" />
            </button>
            <button
              onClick={() => setShowSnippet(v => !v)}
              className={`flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded border transition-colors ${
                showSnippet ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-muted/30 hover:bg-muted/60"
              }`}
            >
              <Wand2 className="w-3 h-3" />
              Code Snippet
              {showSnippet ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {showSnippet && (
            <div className="relative">
              <pre className="text-xs bg-background border border-border rounded p-2 overflow-x-auto font-mono text-green-300 whitespace-pre leading-relaxed">
                {getCodeSnippet(result)}
              </pre>
              <button
                onClick={() => { navigator.clipboard.writeText(getCodeSnippet(result)); setCopiedSnippet(true); setTimeout(() => setCopiedSnippet(false), 2000); }}
                className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 border border-border"
              >
                {copiedSnippet ? "Copied!" : "Copy"}
              </button>
            </div>
          )}

          {/* Hint to find asset in sidebar */}
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Asset saved → view in <span className="text-primary/80">Files › Assets</span> panel
          </p>
        </div>
      )}
    </div>
  );
}
