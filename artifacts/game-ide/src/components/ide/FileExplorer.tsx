import { useState } from "react";
import { ChevronRight, ChevronDown, FileIcon, Folder, FolderOpen, FileJson, FileCode2, FileImage, Plus, Trash2, Edit2, FilePlus, FolderPlus } from "lucide-react";
import { useListFiles, useDeleteFile, useRenameFile, useCreateFolder, useWriteFile } from "@/hooks/use-api";
import { useIde } from "@/hooks/use-ide";
import { type ListFilesResponseItem as FileNode } from "@workspace/api-client-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";

const getIcon = (name: string, isFolder: boolean, expanded: boolean) => {
  if (isFolder) return expanded ? <FolderOpen className="w-4 h-4 text-primary" /> : <Folder className="w-4 h-4 text-primary" />;
  if (name.endsWith('.json')) return <FileJson className="w-4 h-4 text-yellow-500" />;
  if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.jsx') || name.endsWith('.tsx')) return <FileCode2 className="w-4 h-4 text-blue-400" />;
  if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.svg')) return <FileImage className="w-4 h-4 text-purple-400" />;
  return <FileIcon className="w-4 h-4 text-muted-foreground" />;
};

const NodeItem = ({ 
  node, 
  level, 
  projectId,
  onNewFile
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
  
  const isFolder = node.type === 'folder';
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
              ${isActive ? 'bg-primary/20 text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}`}
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
              <ContextMenuItem onSelect={() => onNewFile(node.path)}><FilePlus className="w-4 h-4 mr-2"/> New File</ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onSelect={handleRename}><Edit2 className="w-4 h-4 mr-2"/> Rename</ContextMenuItem>
          <ContextMenuItem onSelect={handleDelete} className="text-destructive focus:text-destructive"><Trash2 className="w-4 h-4 mr-2"/> Delete</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      
      {isFolder && expanded && node.children?.map(child => (
        <NodeItem key={child.path} node={child} level={level + 1} projectId={projectId} onNewFile={onNewFile} />
      ))}
    </div>
  );
};

export function FileExplorer({ projectId }: { projectId: string }) {
  const { data: files, isLoading } = useListFiles(projectId);
  const createFolder = useCreateFolder();
  const writeFileMutation = useWriteFile();
  
  const handleNewFolder = () => {
    const name = window.prompt("New folder name:");
    if (name) {
      createFolder.mutate({ id: projectId, data: { path: name } });
    }
  };

  const handleNewFile = (parentPath: string = "") => {
    const name = window.prompt("New file name:");
    if (!name) return;
    const filePath = parentPath ? `${parentPath}/${name}` : name;
    writeFileMutation.mutate({ id: projectId, data: { path: filePath, content: "" } });
  };

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading files...</div>;

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Explorer</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => handleNewFile("")}>
            <FilePlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={handleNewFolder}>
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {files?.map(node => (
          <NodeItem key={node.path} node={node} level={0} projectId={projectId} onNewFile={handleNewFile} />
        ))}
      </div>
    </div>
  );
}
