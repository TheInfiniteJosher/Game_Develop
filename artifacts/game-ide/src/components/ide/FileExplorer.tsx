import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronRight, ChevronDown, FileIcon, Folder, FolderOpen,
  FileJson, FileCode2, FileImage, Plus, Trash2, Edit2,
  FilePlus, FolderPlus, Search, X, ImageIcon,
} from "lucide-react";
import { useListFiles, useDeleteFile, useRenameFile, useCreateFolder, useWriteFile } from "@/hooks/use-api";
import { useIde } from "@/hooks/use-ide";
import { type ListFilesResponseItem as FileNode } from "@workspace/api-client-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { AssetBrowser } from "./AssetBrowser";

// ---------------------------------------------------------------------------
// File icon helper
// ---------------------------------------------------------------------------
const getIcon = (name: string, isFolder: boolean, expanded: boolean) => {
  if (isFolder) return expanded ? <FolderOpen className="w-4 h-4 text-primary" /> : <Folder className="w-4 h-4 text-primary" />;
  if (name.endsWith(".json")) return <FileJson className="w-4 h-4 text-yellow-500" />;
  if ([".js", ".ts", ".jsx", ".tsx"].some(e => name.endsWith(e))) return <FileCode2 className="w-4 h-4 text-blue-400" />;
  if ([".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp"].some(e => name.endsWith(e))) return <FileImage className="w-4 h-4 text-purple-400" />;
  return <FileIcon className="w-4 h-4 text-muted-foreground" />;
};

// ---------------------------------------------------------------------------
// File tree node
// ---------------------------------------------------------------------------
const NodeItem = ({
  node,
  level,
  projectId,
  onNewFile,
}: {
  node: FileNode;
  level: number;
  projectId: string;
  onNewFile: (parentPath: string) => void;
}) => {
  const [expanded, setExpanded] = useState(level < 1);
  const { activeFile, openFile } = useIde();
  const deleteFile = useDeleteFile();
  const renameFile = useRenameFile();

  const isFolder = node.type === "folder";
  const isActive = activeFile === node.path;

  const handleRename = () => {
    const newName = window.prompt("New name for " + node.name, node.name);
    if (newName && newName !== node.name) {
      renameFile.mutate({ id: projectId, data: { oldPath: node.path, newName } });
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${node.name}?`)) {
      deleteFile.mutate({ id: projectId, params: { path: node.path } });
    }
  };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer select-none group text-sm
              ${isActive ? "bg-primary/20 text-primary-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={() => isFolder ? setExpanded(!expanded) : openFile(node.path)}
          >
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              {isFolder && (expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)}
            </div>
            {getIcon(node.name, isFolder, expanded)}
            <span className="truncate">{node.name}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48 bg-popover border-border">
          {isFolder && (
            <>
              <ContextMenuItem onSelect={() => onNewFile(node.path)}><FilePlus className="w-4 h-4 mr-2" /> New File</ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onSelect={handleRename}><Edit2 className="w-4 h-4 mr-2" /> Rename</ContextMenuItem>
          <ContextMenuItem onSelect={handleDelete} className="text-destructive focus:text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isFolder && expanded && node.children?.map(child => (
        <NodeItem key={child.path} node={child} level={level + 1} projectId={projectId} onNewFile={onNewFile} />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Search result types (mirror the API shape)
// ---------------------------------------------------------------------------
interface SearchMatch {
  line: number;
  text: string;
}
interface SearchResult {
  path: string;
  name: string;
  matches: SearchMatch[];
}

// ---------------------------------------------------------------------------
// Highlight matching text inside a line snippet
// ---------------------------------------------------------------------------
function HighlightedText({ text, query }: { text: string; query: string }) {
  const q = query.toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/30 text-yellow-200 rounded-[2px]">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Search results panel
// ---------------------------------------------------------------------------
function SearchResults({
  query,
  results,
  loading,
  projectId,
}: {
  query: string;
  results: SearchResult[];
  loading: boolean;
  projectId: string;
}) {
  const { openFile } = useIde();

  if (loading) {
    return (
      <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
        <span className="w-3 h-3 rounded-full border border-muted-foreground border-t-transparent animate-spin" />
        Searching…
      </div>
    );
  }

  if (query.length < 2) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Type at least 2 characters to search.
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        No results for <span className="text-foreground font-mono">"{query}"</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
        {results.length} file{results.length !== 1 ? "s" : ""} matched
      </div>
      {results.map(result => (
        <div key={result.path} className="border-b border-border/50 last:border-0">
          {/* File name row */}
          <button
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-muted/50 group"
            onClick={() => openFile(result.path)}
            title={result.path}
          >
            {getIcon(result.name, false, false)}
            <span className="text-xs font-medium text-foreground truncate flex-1">
              <HighlightedText text={result.name} query={query} />
            </span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px] opacity-60 shrink-0">
              {result.path.includes("/") ? result.path.split("/").slice(0, -1).join("/") : ""}
            </span>
          </button>

          {/* Matching lines */}
          {result.matches.map((match, i) => (
            <button
              key={i}
              className="w-full flex items-start gap-2 px-3 py-1 text-left hover:bg-muted/40 cursor-pointer"
              onClick={() => openFile(result.path)}
            >
              <span className="text-[10px] text-muted-foreground/50 font-mono w-8 text-right shrink-0 pt-0.5">
                {match.line}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground truncate">
                <HighlightedText text={match.text} query={query} />
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main FileExplorer component
// ---------------------------------------------------------------------------
export function FileExplorer({ projectId, onGenerateAsset }: { projectId: string; onGenerateAsset?: () => void }) {
  const { data: files, isLoading } = useListFiles(projectId);
  const createFolder = useCreateFolder();
  const writeFileMutation = useWriteFile();

  const [sidebarView, setSidebarView] = useState<"files" | "assets">("files");
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNewFolder = () => {
    const name = window.prompt("New folder name:");
    if (name) createFolder.mutate({ id: projectId, data: { path: name } });
  };

  const handleNewFile = (parentPath: string = "") => {
    const name = window.prompt("New file name:");
    if (!name) return;
    const filePath = parentPath ? `${parentPath}/${name}` : name;
    writeFileMutation.mutate({ id: projectId, data: { path: filePath, content: "" } });
  };

  const openSearch = () => {
    setSearchActive(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const closeSearch = useCallback(() => {
    setSearchActive(false);
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchActive) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/files/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, searchActive, projectId]);

  // Escape key closes search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && searchActive) closeSearch(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchActive, closeSearch]);

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading files…</div>;

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      {/* View toggle — Files / Assets */}
      <div className="flex items-center gap-px p-2 border-b border-border shrink-0 bg-sidebar">
        <button
          onClick={() => setSidebarView("files")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            sidebarView === "files"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Folder className="w-3.5 h-3.5" />
          Files
        </button>
        <button
          onClick={() => setSidebarView("assets")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            sidebarView === "assets"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          Assets
        </button>
      </div>

      {/* Assets view */}
      {sidebarView === "assets" && (
        <AssetBrowser
          projectId={projectId}
          onGenerateClick={() => onGenerateAsset?.()}
        />
      )}

      {/* Files view */}
      {sidebarView === "files" && (
        <>
          {/* Files header */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-border shrink-0">
            {searchActive ? (
              <div className="flex items-center gap-1.5 w-full">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search files…"
                  className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground/60 min-w-0"
                />
                <button onClick={closeSearch} className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Explorer</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={openSearch} title="Search files">
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => handleNewFile("")} title="New file">
                    <FilePlus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={handleNewFolder} title="New folder">
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* File tree or search results */}
          {searchActive ? (
            <SearchResults query={searchQuery} results={searchResults} loading={searching} projectId={projectId} />
          ) : (
            <div className="flex-1 overflow-y-auto py-2">
              {files?.map(node => (
                <NodeItem key={node.path} node={node} level={0} projectId={projectId} onNewFile={handleNewFile} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
