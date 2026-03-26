import { useGetPreviewEntry } from "@/hooks/use-api";
import { useIde } from "@/hooks/use-ide";
import { RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PreviewPanel({ projectId }: { projectId: string }) {
  const { data } = useGetPreviewEntry(projectId);
  const { previewRefreshKey, refreshPreview } = useIde();

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="flex items-center justify-between p-2 border-b border-border h-10 shrink-0">
        <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground px-2">Game Preview</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={refreshPreview} title="Refresh Preview">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          {data?.url && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" asChild title="Open in New Tab">
              <a href={data.url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 bg-white relative">
        {data?.url ? (
          <iframe 
            key={previewRefreshKey}
            src={data.url} 
            className="absolute inset-0 w-full h-full border-0"
            title="Game Preview"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-background">
            No preview available
          </div>
        )}
      </div>
    </div>
  );
}
