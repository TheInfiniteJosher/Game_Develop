import { useGetChangeHistory, useRevertChange } from "@/hooks/use-api";
import { formatDistanceToNow } from "date-fns";
import { Clock, RotateCcw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChangesPanel({ projectId }: { projectId: string }) {
  const { data: changes, isLoading } = useGetChangeHistory(projectId);
  const revertChange = useRevertChange();

  if (isLoading) return <div className="p-4 text-muted-foreground text-sm">Loading changes...</div>;

  if (!changes || changes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
        <Clock className="w-12 h-12" />
        <p>No changes recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3 bg-background">
      {changes.map((change) => (
        <div key={change.id} className="p-3 rounded-lg border border-border bg-card flex flex-col gap-2 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm truncate max-w-[200px]" title={change.filePath}>{change.filePath}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(change.timestamp), { addSuffix: true })}
            </span>
          </div>
          
          {change.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {change.description}
            </p>
          )}

          <div className="flex justify-end mt-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 text-xs px-2 gap-1 hover:text-destructive hover:border-destructive hover:bg-destructive/10"
              onClick={() => {
                if (window.confirm('Are you sure you want to revert this file to how it was before this change?')) {
                  revertChange.mutate({ id: projectId, changeId: change.id });
                }
              }}
              disabled={revertChange.isPending}
            >
              <RotateCcw className="w-3 h-3" />
              Revert
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
