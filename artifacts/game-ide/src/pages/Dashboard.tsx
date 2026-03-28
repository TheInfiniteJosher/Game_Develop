import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Plus, Upload, FolderGit2, MoreVertical, Pencil, Copy, Trash2, LogIn, LogOut, User, Zap, Bot, Globe } from "lucide-react";
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
import { GameForgeLogo } from "@/components/GameForgeLogo";

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
    const name = file.name.replace('.zip', '');
    createProject.mutate({ data: { name } }, {
      onSuccess: (project) => {
        uploadZip.mutate({ id: project.id, data: { file, overwrite: true } });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient glow background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(ellipse, #F97316 0%, #EA580C 40%, transparent 70%)" }} />
        <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] rounded-full opacity-5"
          style={{ background: "radial-gradient(ellipse, #A855F7 0%, transparent 70%)" }} />
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] rounded-full opacity-5"
          style={{ background: "radial-gradient(ellipse, #A855F7 0%, transparent 70%)" }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-8 py-8 space-y-10">

        {/* Header */}
        <header className="flex items-center justify-between">
          <GameForgeLogo size={44} showText textSize="xl" />

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <div>
                  <input type="file" id="zip-upload" accept=".zip" className="hidden" onChange={handleZipUpload} />
                  <Label htmlFor="zip-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 font-medium text-sm transition-colors border border-border shadow-sm">
                      <Upload className="w-4 h-4" />
                      Upload ZIP
                    </div>
                  </Label>
                </div>
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  className="gap-2 shadow-lg shadow-primary/30"
                  style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
                >
                  <Plus className="w-4 h-4" />
                  New Project
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-full w-9 h-9 border-border hover:border-primary/50">
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
              <Button
                onClick={login}
                className="gap-2 shadow-lg shadow-primary/30"
                style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
              >
                <LogIn className="w-4 h-4" />
                Sign in
              </Button>
            ) : null}
          </div>
        </header>

        {/* Signed-out hero */}
        {!isAuthenticated && !authLoading && (
          <>
            {/* Hero */}
            <div className="text-center py-16 space-y-6">
              <div className="flex justify-center mb-6">
                <GameForgeLogo size={88} />
              </div>
              <div>
                <h1 className="text-5xl font-extrabold tracking-tight mb-3">
                  <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-orange-600 bg-clip-text text-transparent">
                    GameForge
                  </span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
                  The AI-powered IDE built for game developers. Write, preview, and ship browser games faster than ever.
                </p>
              </div>
              <div className="flex items-center justify-center gap-4 pt-2">
                <Button
                  size="lg"
                  onClick={login}
                  className="gap-2 text-base px-8 py-6 shadow-2xl shadow-orange-900/40 hover:shadow-orange-900/60 transition-shadow"
                  style={{ background: "linear-gradient(135deg, #FBBF24, #F97316, #EA580C)" }}
                >
                  <LogIn className="w-5 h-5" />
                  Get started free
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Sign in with Google, GitHub, or email — no credit card required</p>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  icon: <Bot className="w-6 h-6" />,
                  color: "from-orange-500/20 to-amber-500/10",
                  border: "border-orange-500/20",
                  iconColor: "text-orange-400",
                  title: "AI Coding Partner",
                  desc: "Chat with an AI that reads your code, suggests fixes, and applies changes directly to your files.",
                },
                {
                  icon: <Zap className="w-6 h-6" />,
                  color: "from-purple-500/20 to-violet-500/10",
                  border: "border-purple-500/20",
                  iconColor: "text-purple-400",
                  title: "Live Preview",
                  desc: "See your game running in real-time as you code. Instant hot-reload keeps your flow uninterrupted.",
                },
                {
                  icon: <Globe className="w-6 h-6" />,
                  color: "from-emerald-500/20 to-teal-500/10",
                  border: "border-emerald-500/20",
                  iconColor: "text-emerald-400",
                  title: "One-click Publish",
                  desc: "Ship your game to a public URL instantly. Share playable builds with anyone, anywhere.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className={`rounded-2xl border ${f.border} bg-gradient-to-br ${f.color} p-6 space-y-3`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${f.iconColor} bg-card border border-border`}>
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Signed-in: project grid */}
        {isAuthenticated && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {user?.firstName ? `Welcome back, ${user.firstName}` : "Your Projects"}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">Pick up where you left off</p>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-44 rounded-2xl bg-card border border-border animate-pulse" />
                ))}
              </div>
            ) : projects?.length === 0 ? (
              <div className="py-24 text-center border-2 border-dashed border-border rounded-2xl bg-card/40 flex flex-col items-center space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <FolderGit2 className="w-10 h-10 text-primary/60" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-1">No projects yet</h3>
                  <p className="text-muted-foreground max-w-sm text-sm">Create your first game project or upload an existing HTML5 game ZIP to get started.</p>
                </div>
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  className="gap-2 shadow-lg shadow-primary/20 mt-2"
                  style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
                >
                  <Plus className="w-4 h-4" />
                  Create First Project
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects?.map(project => (
                  <div
                    key={project.id}
                    className="group relative bg-card rounded-2xl border border-border p-5 hover:border-primary/40 hover:shadow-2xl hover:shadow-orange-900/10 transition-all duration-300 flex flex-col"
                  >
                    {/* Subtle top glow on hover */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-t-2xl" />

                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/20 flex items-center justify-center">
                        <FolderGit2 className="w-6 h-6 text-orange-400" />
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
                          <DropdownMenuItem
                            onClick={() => { if (window.confirm("Delete this project?")) deleteProject.mutate({ id: project.id }); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <h3 className="text-lg font-semibold truncate mb-1">{project.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4 flex-1">
                      {project.fileCount} {project.fileCount === 1 ? "file" : "files"} · Updated {format(new Date(project.updatedAt), 'MMM d, yyyy')}
                    </p>

                    <Link href={`/ide/${project.id}`} className="block mt-auto">
                      <Button
                        variant="secondary"
                        className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors font-medium"
                      >
                        Open Editor
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Auth loading shimmer */}
        {authLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-44 rounded-2xl bg-card border border-border animate-pulse" />
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
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Space Shooter"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!newProjectName.trim() || createProject.isPending}
              style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
            >
              {createProject.isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
