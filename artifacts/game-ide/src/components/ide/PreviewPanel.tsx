import { useGetPreviewEntry } from "@/hooks/use-api";
import { useIde } from "@/hooks/use-ide";
import { RefreshCw, ExternalLink, Hammer, PackageCheck, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, useCallback } from "react";

type ViteStatus = "idle" | "installing" | "building" | "ready" | "error";

interface ViteInfo {
  isViteProject: boolean;
  status: ViteStatus;
  logs: string[];
  startedAt?: number;
}

function useViteStatus(projectId: string, initialData: ViteInfo | null) {
  const [viteInfo, setViteInfo] = useState<ViteInfo | null>(initialData);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/vite/status`);
      if (res.ok) {
        const data: ViteInfo = await res.json();
        setViteInfo(data);
        return data;
      }
    } catch {
      // ignore
    }
    return null;
  }, [projectId]);

  const triggerBuild = useCallback(async () => {
    await fetch(`/api/projects/${projectId}/vite/build`, { method: "POST" });
    await fetchStatus();
  }, [projectId, fetchStatus]);

  // Poll while building (every 1s for responsive progress)
  useEffect(() => {
    if (!viteInfo?.isViteProject) return;
    if (viteInfo.status === "ready" || viteInfo.status === "idle" || viteInfo.status === "error") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (!pollRef.current) {
      pollRef.current = setInterval(fetchStatus, 1000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [viteInfo?.isViteProject, viteInfo?.status, fetchStatus]);

  // Sync from parent data on mount / project change
  useEffect(() => {
    if (initialData) setViteInfo(initialData);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { viteInfo, fetchStatus, triggerBuild };
}

function useElapsedSeconds(startedAt: number | undefined, active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active || !startedAt) { setElapsed(0); return; }
    const update = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt, active]);
  return elapsed;
}

export function PreviewPanel({ projectId }: { projectId: string }) {
  const { data } = useGetPreviewEntry(projectId);
  const { previewRefreshKey, refreshPreview } = useIde();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [activeScene, setActiveScene] = useState<string | null>(null);

  // Listen for Phaser scene change messages from the preview iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "phaser-scene") {
        setActiveScene(e.data.scene ?? null);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Clear scene name when project changes or preview refreshes
  useEffect(() => { setActiveScene(null); }, [projectId, previewRefreshKey]);

  // Extract vite info from preview-entry response (extra fields beyond the typed schema)
  const anyData = data as (typeof data & {
    isViteProject?: boolean;
    viteStatus?: ViteStatus;
    viteLogs?: string[];
    viteStartedAt?: number;
  }) | undefined;

  const initialViteInfo: ViteInfo | null = anyData
    ? {
        isViteProject: anyData.isViteProject ?? false,
        status: anyData.viteStatus ?? "idle",
        logs: anyData.viteLogs ?? [],
        startedAt: anyData.viteStartedAt,
      }
    : null;

  const { viteInfo, fetchStatus, triggerBuild } = useViteStatus(projectId, initialViteInfo);

  const isVite = viteInfo?.isViteProject ?? false;
  const viteStatus = viteInfo?.status ?? "idle";
  const viteLogs = viteInfo?.logs ?? [];
  const isBuilding = viteStatus === "installing" || viteStatus === "building";
  const elapsed = useElapsedSeconds(viteInfo?.startedAt, isBuilding);

  // Kick off polling as soon as we know it's a Vite project that's still building
  useEffect(() => {
    if (isVite && isBuilding) {
      fetchStatus();
    }
  }, [isVite, isBuilding]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [viteInfo?.logs]);

  const showIframe = !isVite || viteStatus === "ready";
  const showBuildPanel = isVite && !showIframe;

  const statusLabel: Record<ViteStatus, string> = {
    idle: "Not built",
    installing: "Installing dependencies...",
    building: "Building project...",
    ready: "Ready",
    error: "Build failed",
  };

  const statusIcon = {
    idle: <PackageCheck className="h-4 w-4" />,
    installing: <Loader2 className="h-4 w-4 animate-spin" />,
    building: <Loader2 className="h-4 w-4 animate-spin" />,
    ready: <PackageCheck className="h-4 w-4 text-green-400" />,
    error: <AlertCircle className="h-4 w-4 text-red-400" />,
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="flex items-center justify-between p-2 border-b border-border h-10 shrink-0">
        <div className="flex items-center gap-2 px-2">
          <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
            Game Preview
          </span>
          {isVite && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {statusIcon[viteStatus]}
              <span>{statusLabel[viteStatus]}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isVite && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={triggerBuild}
              disabled={isBuilding}
              title="Rebuild Vite Project"
            >
              <Hammer className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={refreshPreview}
            title="Refresh Preview"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          {data?.url && showIframe && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              asChild
              title="Open in New Tab"
            >
              <a href={data.url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 bg-background relative overflow-hidden">
        {showBuildPanel ? (
          <div className="absolute inset-0 flex flex-col p-3 gap-3">
            {/* Status header */}
            <div className="flex items-center gap-2">
              {statusIcon[viteStatus]}
              <span className="text-sm font-medium text-foreground">
                {viteStatus === "error" ? "Build failed" : isBuilding ? statusLabel[viteStatus] : "Vite project detected"}
              </span>
              {isBuilding && (
                <span className="text-xs text-muted-foreground ml-auto">{elapsed}s elapsed</span>
              )}
            </div>

            {/* Step progress */}
            {isBuilding && (
              <div className="flex gap-4 text-xs">
                <div className={`flex items-center gap-1.5 ${viteStatus === "installing" ? "text-blue-400" : "text-green-400"}`}>
                  <span className={`w-2 h-2 rounded-full bg-current ${viteStatus === "installing" ? "animate-pulse" : ""}`} />
                  1. Installing packages
                </div>
                <div className={`flex items-center gap-1.5 ${viteStatus === "building" ? "text-blue-400" : "text-muted-foreground"}`}>
                  <span className={`w-2 h-2 rounded-full bg-current ${viteStatus === "building" ? "animate-pulse" : ""}`} />
                  2. Building with Vite
                </div>
              </div>
            )}

            {viteStatus === "idle" && (
              <div className="text-xs text-muted-foreground">
                This project uses Vite. Click{" "}
                <button
                  className="underline text-blue-400 hover:text-blue-300"
                  onClick={triggerBuild}
                >
                  Build
                </button>{" "}
                to prepare the preview.
              </div>
            )}

            {/* Build log */}
            {viteLogs.length > 0 && (
              <div className="flex-1 bg-black/40 rounded border border-border overflow-auto font-mono text-xs leading-relaxed p-2">
                {viteLogs.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.startsWith("❌") || line.toLowerCase().includes("error")
                        ? "text-red-400"
                        : line.startsWith("✅")
                        ? "text-green-400"
                        : line.startsWith("📦") || line.startsWith("🔨")
                        ? "text-blue-400"
                        : "text-muted-foreground"
                    }
                  >
                    {line}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}

            {viteStatus === "error" && (
              <Button size="sm" variant="outline" onClick={triggerBuild} className="self-start">
                <Hammer className="h-3.5 w-3.5 mr-1.5" />
                Retry Build
              </Button>
            )}
          </div>
        ) : data?.url ? (
          <>
            <iframe
              key={`${previewRefreshKey}-${viteStatus}`}
              src={data.url}
              className={`absolute top-0 left-0 right-0 ${activeScene ? "bottom-6" : "bottom-0"} border-0 w-full`}
              title="Game Preview"
              sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"
            />
            {activeScene && (
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-card/95 backdrop-blur-sm border-t border-border flex items-center px-3 gap-2 text-xs z-10 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                <span className="text-muted-foreground">Scene</span>
                <span className="font-mono text-blue-400 font-medium truncate">{activeScene}</span>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            No preview available
          </div>
        )}
      </div>
    </div>
  );
}
