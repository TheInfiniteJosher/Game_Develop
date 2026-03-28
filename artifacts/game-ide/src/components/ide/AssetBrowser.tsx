import { useState, useCallback, useEffect, useRef } from "react";
import { Sparkles, RefreshCw, Copy, Trash2, Wand2, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";
import { useRenameFile } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";

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

interface AssetBrowserProps {
  projectId: string;
  onGenerateClick: () => void;
}

function getCodeSnippet(asset: GeneratedAsset): string {
  const name = asset.filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_");
  const path = asset.path;
  if (asset.assetType === "animation" && asset.metadata?.frameCount && asset.metadata.frameCount > 1) {
    const fw = asset.metadata.frameWidth || 128;
    const fh = asset.metadata.frameHeight || 128;
    return `// preload()\nthis.load.spritesheet('${name}', '${path}', {\n  frameWidth: ${fw},\n  frameHeight: ${fh}\n});\n\n// create()\nthis.anims.create({\n  key: '${name}_anim',\n  frames: this.anims.generateFrameNumbers('${name}', { start: 0, end: ${(asset.metadata.frameCount as number) - 1} }),\n  frameRate: 10,\n  repeat: -1\n});\n// sprite.play('${name}_anim');`;
  }
  if (asset.assetType === "background") {
    return `// preload()\nthis.load.image('${name}', '${path}');\n\n// create()\nthis.add.image(0, 0, '${name}')\n  .setOrigin(0, 0)\n  .setDisplaySize(this.scale.width, this.scale.height);`;
  }
  if (asset.assetType === "tileset") {
    return `// preload()\nthis.load.image('${name}', '${path}');\n\n// In create() with tilemaps:\n// const map = this.make.tilemap({ key: 'map' });\n// const tiles = map.addTilesetImage('${name}', '${name}');`;
  }
  return `// preload()\nthis.load.image('${name}', '${path}');\n\n// create()\nconst ${name} = this.add.image(x, y, '${name}');`;
}

const TYPE_LABELS: Record<string, string> = {
  sprite: "Sprites", animation: "Sprite Sheets", tileset: "Tilesets",
  background: "Backgrounds", ui: "UI", vfx: "VFX", enemy: "Sprites", item: "Sprites",
};

function groupAssets(assets: GeneratedAsset[]) {
  const groups: Record<string, GeneratedAsset[]> = {};
  for (const a of assets) {
    const label = TYPE_LABELS[a.assetType] ?? a.assetType;
    (groups[label] ??= []).push(a);
  }
  return groups;
}

function RenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.select(); }, []);
  return (
    <div className="flex items-center gap-1 px-1" onClick={e => e.stopPropagation()}>
      <input
        ref={ref}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") onCommit(value.trim());
          if (e.key === "Escape") onCancel();
        }}
        className="flex-1 bg-muted/60 border border-primary/50 rounded text-xs px-1.5 py-0.5 outline-none min-w-0"
      />
      <button onClick={() => onCommit(value.trim())} className="text-green-400 hover:text-green-300 shrink-0"><Check className="w-3 h-3" /></button>
      <button onClick={onCancel} className="text-muted-foreground hover:text-foreground shrink-0"><X className="w-3 h-3" /></button>
    </div>
  );
}

export function AssetBrowser({ projectId, onGenerateClick }: AssetBrowserProps) {
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<GeneratedAsset | null>(null);
  const [showSnippet, setShowSnippet] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const renameFile = useRenameFile();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/assets`);
      if (res.ok) setAssets(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (asset: GeneratedAsset) => {
    try {
      await fetch(`/api/projects/${projectId}/assets`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: asset.path }),
      });
      if (selectedAsset?.path === asset.path) setSelectedAsset(null);
      await load();
    } catch { /* ignore */ }
  };

  const handleRename = (asset: GeneratedAsset, newName: string) => {
    if (!newName || newName === asset.filename) { setRenamingPath(null); return; }
    renameFile.mutate(
      { id: projectId, data: { oldPath: asset.path, newName } },
      {
        onSuccess: async () => {
          setRenamingPath(null);
          await load();
        },
        onError: () => setRenamingPath(null),
      }
    );
  };

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const copySnippet = (asset: GeneratedAsset) => {
    navigator.clipboard.writeText(getCodeSnippet(asset));
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const groups = groupAssets(assets);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border shrink-0">
        <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
          Assets {assets.length > 0 && <span className="text-muted-foreground/60 font-normal">({assets.length})</span>}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={load} className="text-muted-foreground hover:text-foreground p-1 rounded" title="Refresh">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Button
            size="sm"
            className="h-6 text-xs gap-1 px-2"
            onClick={onGenerateClick}
            style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
          >
            <Sparkles className="w-3 h-3" />
            New
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {assets.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary/50" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">No assets yet</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Generate your first asset below</p>
            </div>
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={onGenerateClick}
              style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}>
              <Sparkles className="w-3 h-3" /> Generate Asset
            </Button>
          </div>
        )}

        {/* Grouped asset grid */}
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="border-b border-border last:border-0">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 bg-sidebar">
              {group}
            </div>
            <div className="grid grid-cols-2 gap-1.5 p-1.5">
              {items.map(asset => (
                <div
                  key={asset.path}
                  className={`group relative rounded-lg border overflow-hidden cursor-pointer transition-all ${
                    selectedAsset?.path === asset.path
                      ? "border-primary/60 ring-1 ring-primary/30"
                      : "border-border hover:border-border/80"
                  }`}
                  onClick={() => {
                    setSelectedAsset(selectedAsset?.path === asset.path ? null : asset);
                    setShowSnippet(false);
                  }}
                >
                  {/* Thumbnail */}
                  <div className="bg-[repeating-conic-gradient(#2a2a3a_0%_25%,#1e1e2e_0%_50%)] bg-[size:10px_10px] aspect-square relative">
                    <img src={asset.previewUrl} alt={asset.filename} className="w-full h-full object-contain" loading="lazy" />

                    {/* Hover action bar */}
                    <div className="absolute inset-0 bg-background/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                      <button
                        onClick={e => { e.stopPropagation(); copyPath(asset.path); }}
                        className="p-1.5 rounded bg-card border border-border hover:border-primary/50 hover:text-primary transition-colors"
                        title="Copy path"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setRenamingPath(asset.path); }}
                        className="p-1.5 rounded bg-card border border-border hover:border-primary/50 hover:text-primary transition-colors"
                        title="Rename"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(asset); }}
                        className="p-1.5 rounded bg-card border border-border hover:border-red-500/50 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Filename / rename */}
                  {renamingPath === asset.path ? (
                    <div className="py-0.5" onClick={e => e.stopPropagation()}>
                      <RenameInput
                        initial={asset.filename}
                        onCommit={name => handleRename(asset, name)}
                        onCancel={() => setRenamingPath(null)}
                      />
                    </div>
                  ) : (
                    <div
                      className="px-1.5 py-1 text-[10px] text-muted-foreground truncate leading-tight"
                      title={asset.filename}
                      onDoubleClick={e => { e.stopPropagation(); setRenamingPath(asset.path); }}
                    >
                      {asset.filename}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Selected asset detail */}
        {selectedAsset && (
          <div className="border-t border-border bg-sidebar p-2 space-y-2">
            <div className="text-xs font-semibold text-foreground/80 truncate">{selectedAsset.filename}</div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                {selectedAsset.assetType}
              </span>
              {selectedAsset.metadata?.style && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50 border border-border text-muted-foreground">
                  {selectedAsset.metadata.style}
                </span>
              )}
              {selectedAsset.metadata?.frameCount && selectedAsset.metadata.frameCount > 1 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {selectedAsset.metadata.frameCount} frames
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-1.5">
              <button
                onClick={() => copyPath(selectedAsset.path)}
                className="flex-1 flex items-center justify-center gap-1 text-[10px] py-1 rounded border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
              >
                <Copy className="w-3 h-3" />
                {copiedPath === selectedAsset.path ? "Copied!" : "Copy Path"}
              </button>
              <button
                onClick={() => setShowSnippet(v => !v)}
                className={`flex-1 flex items-center justify-center gap-1 text-[10px] py-1 rounded border transition-colors ${
                  showSnippet ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-muted/30 hover:bg-muted/60"
                }`}
              >
                <Wand2 className="w-3 h-3" />
                Code
                {showSnippet ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
              </button>
            </div>

            {showSnippet && (
              <div className="relative">
                <pre className="text-[10px] bg-background border border-border rounded p-2 overflow-x-auto font-mono text-green-300 whitespace-pre leading-relaxed max-h-40">
                  {getCodeSnippet(selectedAsset)}
                </pre>
                <button
                  onClick={() => copySnippet(selectedAsset)}
                  className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 border border-border"
                >
                  {copiedSnippet ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
