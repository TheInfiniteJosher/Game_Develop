import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Plus, Upload, FolderGit2, MoreVertical, Pencil, Copy, Trash2, Gamepad2, LogIn, LogOut, User } from "lucide-react";
import { 
  useListProjects, 
  useCreateProject, 
  useDeleteProject, 
  useDuplicateProject, 
  useUpdateProject,
  useUploadZip 
} from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@workspace/replit-auth-web";

export default function Dashboard() {
  const { user, isLoading: authLoading, isAuthenticated, login, logout } = useAuth();
  const { data: projects, isLoading } = useListProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const duplicateProject = useDuplicateProject();
  const updateProject = useUpdateProject();
  const uploadZip = useUploadZip();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");

  const handleCreate = () => {
    if (!newProjectName.trim()) return;
    createProject.mutate({ data: { name: newProjectName } }, {
      onSuccess: () => {
        setIsCreateOpen(false);
        setNewProjectName("");
      }
    });
  };

  const handleRename = () => {
    if (!renameProjectId || !renameName.trim()) return;
    updateProject.mutate({ id: renameProjectId, data: { name: renameName } }, {
      onSuccess: () => setRenameProjectId(null)
    });
  };

  const handleZipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Create project first, then upload zip
    const name = file.name.replace('.zip', '');
    createProject.mutate({ data: { name } }, {
      onSuccess: (project) => {
        uploadZip.mutate({ id: project.id, data: { file, overwrite: true } });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-inner">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI Game Studio</h1>
              <p className="text-sm text-muted-foreground">Manage your game projects</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <div>
                  <input type="file" id="zip-upload" accept=".zip" className="hidden" onChange={handleZipUpload} />
                  <Label htmlFor="zip-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 font-medium text-sm transition-colors border border-border shadow-sm">
                      <Upload className="w-4 h-4" />
                      Upload ZIP
                    </div>
                  </Label>
                </div>
                <Button onClick={() => setIsCreateOpen(true)} className="gap-2 shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4" />
                  New Project
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full w-9 h-9">
                      {user?.profileImageUrl ? (
                        <img src={user.profileImageUrl} alt="avatar" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(user?.firstName || user?.email) && (
                      <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                        {user?.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : user?.email}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                      <LogOut className="w-4 h-4 mr-2" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : !authLoading ? (
              <Button onClick={login} className="gap-2">
                <LogIn className="w-4 h-4" />
                Sign in
              </Button>
            ) : null}
          </div>
        </header>

        {/* Project Grid */}
        {!isAuthenticated && !authLoading ? (
          <div className="py-24 text-center border-2 border-dashed border-border rounded-2xl bg-card/50 flex flex-col items-center">
            <Gamepad2 className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Sign in to get started</h3>
            <p className="text-muted-foreground max-w-sm mb-6">Create and manage your game projects. Sign in to save your work and access your projects from anywhere.</p>
            <Button onClick={login} className="gap-2">
              <LogIn className="w-4 h-4" />
              Sign in
            </Button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : projects?.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-border rounded-2xl bg-card/50 flex flex-col items-center">
            <FolderGit2 className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground max-w-sm mb-6">Create a new project from scratch or upload an existing HTML5 game ZIP archive to get started.</p>
            <Button onClick={() => setIsCreateOpen(true)}>Create First Project</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map(project => (
              <div key={project.id} className="group relative bg-card rounded-xl border border-border p-5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-primary">
                    <FolderGit2 className="w-6 h-6" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setRenameProjectId(project.id); setRenameName(project.name); }}>
                        <Pencil className="w-4 h-4 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicateProject.mutate({ id: project.id })}>
                        <Copy className="w-4 h-4 mr-2" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        if (window.confirm("Delete project?")) deleteProject.mutate({ id: project.id });
                      }} className="text-destructive focus:text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <h3 className="text-lg font-semibold truncate mb-1">{project.name}</h3>
                <p className="text-sm text-muted-foreground mb-4 flex-1">
                  {project.fileCount} files · Last updated {format(new Date(project.updatedAt), 'MMM d, yyyy')}
                </p>
                
                <Link href={`/ide/${project.id}`} className="block mt-auto">
                  <Button variant="secondary" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    Open in Editor
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Rename Dialog */}
      <Dialog open={!!renameProjectId} onOpenChange={(open) => !open && setRenameProjectId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rename">New Name</Label>
              <Input 
                id="rename"
                value={renameName} 
                onChange={(e) => setRenameName(e.target.value)} 
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameProjectId(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!renameName.trim() || updateProject.isPending}>
              {updateProject.isPending ? "Saving..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Project Name</Label>
              <Input 
                id="name" 
                value={newProjectName} 
                onChange={(e) => setNewProjectName(e.target.value)} 
                placeholder="e.g. My Awesome Platformer"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newProjectName.trim() || createProject.isPending}>
              {createProject.isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
