import { useParams, Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IdeProvider, useIde } from "@/hooks/use-ide";
import { FileExplorer } from "@/components/ide/FileExplorer";
import { CodeEditor } from "@/components/ide/CodeEditor";
import { PreviewPanel } from "@/components/ide/PreviewPanel";
import { AiChatPanel } from "@/components/ide/AiChatPanel";
import { ChangesPanel } from "@/components/ide/ChangesPanel";
import { ChevronLeft, FileCode2, X, Terminal } from "lucide-react";
import { useGetProject } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";

interface ConsoleMessage {
  level: "log" | "error" | "warn";
  message: string;
  timestamp: number;
}

function IdeLayout({ projectId }: { projectId: string }) {
  const { data: project } = useGetProject(projectId);
  const { openFiles, activeFile, setActiveFile, closeFile } = useIde();
  const [consoleLogs, setConsoleLogs] = useState<ConsoleMessage[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Listen for postMessage from the preview iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "console") {
        setConsoleLogs(prev => [...prev.slice(-200), {
          level: e.data.level as "log" | "error" | "warn",
          message: e.data.message,
          timestamp: Date.now()
        }]);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Navbar */}
      <header className="h-12 border-b border-border flex items-center px-4 justify-between shrink-0 bg-card shadow-sm z-10 relative">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-5 w-5"/>
            </Button>
          </Link>
          <div className="flex flex-col">
            <span className="font-semibold text-sm leading-tight">{project?.name || "Loading..."}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">AI Game Studio</span>
          </div>
        </div>
      </header>

      {/* Main IDE area */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          
          {/* Left Sidebar - Explorer */}
          <ResizablePanel defaultSize={18} minSize={12} maxSize={30} className="z-10">
            <FileExplorer projectId={projectId} />
          </ResizablePanel>
          
          <ResizableHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
          
          {/* Center + Right */}
          <ResizablePanel defaultSize={82}>
            <ResizablePanelGroup direction="horizontal">
              
              {/* Center - Editor */}
              <ResizablePanel defaultSize={60} minSize={30}>
                <ResizablePanelGroup direction="vertical">
                  
                  {/* Editor Area */}
                  <ResizablePanel defaultSize={70} minSize={30}>
                    <div className="h-full flex flex-col bg-background relative">
                      {/* Editor Tabs */}
                      <div className="flex h-10 bg-card border-b border-border overflow-x-auto hide-scrollbar shrink-0 shadow-sm z-10">
                        {openFiles.length === 0 && (
                          <div className="flex items-center px-4 text-xs text-muted-foreground italic">No files open</div>
                        )}
                        {openFiles.map(file => (
                          <div 
                            key={file}
                            className={`flex items-center gap-2 px-4 border-r border-border text-sm cursor-pointer min-w-[120px] max-w-[200px] select-none transition-colors group
                              ${activeFile === file 
                                ? "bg-background text-foreground border-t-2 border-t-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]" 
                                : "text-muted-foreground hover:bg-background/50 border-t-2 border-t-transparent"}`}
                            onClick={() => setActiveFile(file)}
                          >
                            <FileCode2 className={`h-3.5 w-3.5 ${activeFile === file ? 'text-primary' : 'opacity-70'}`} />
                            <span className="truncate">{file.split('/').pop()}</span>
                            <button 
                              className={`ml-auto p-0.5 rounded-md hover:bg-muted transition-opacity ${activeFile === file ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} 
                              onClick={(e) => { e.stopPropagation(); closeFile(file); }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      {/* Editor Instance */}
                      <div className="flex-1 overflow-hidden z-0">
                        <CodeEditor projectId={projectId} />
                      </div>
                    </div>
                  </ResizablePanel>

                  <ResizableHandle className="h-1 bg-border hover:bg-primary/50 transition-colors" />

                  {/* Bottom Panel (AI Chat / Changes / Console) */}
                  <ResizablePanel defaultSize={30} minSize={20}>
                    <Tabs defaultValue="chat" className="h-full flex flex-col">
                      <div className="px-2 border-b border-border bg-card shrink-0">
                        <TabsList className="bg-transparent border-0 h-10 p-0 gap-4">
                          <TabsTrigger value="chat" className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full shadow-none px-4 text-xs tracking-wide uppercase font-semibold">
                            AI Chat
                          </TabsTrigger>
                          <TabsTrigger value="changes" className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full shadow-none px-4 text-xs tracking-wide uppercase font-semibold">
                            Changes
                          </TabsTrigger>
                          <TabsTrigger value="console" className="data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full shadow-none px-4 text-xs tracking-wide uppercase font-semibold">
                            Console
                          </TabsTrigger>
                        </TabsList>
                      </div>
                      <div className="flex-1 overflow-hidden bg-background">
                        <TabsContent value="chat" className="h-full m-0 data-[state=active]:flex flex-col">
                          <AiChatPanel projectId={projectId} />
                        </TabsContent>
                        <TabsContent value="changes" className="h-full m-0">
                          <ChangesPanel projectId={projectId} />
                        </TabsContent>
                        <TabsContent value="console" className="h-full m-0 flex flex-col">
                          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Terminal className="w-3 h-3"/> Preview Console
                            </div>
                            <button onClick={() => setConsoleLogs([])} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
                            {consoleLogs.length === 0 && (
                              <div className="text-muted-foreground opacity-50 p-2">No output yet. Run your game to see logs.</div>
                            )}
                            {consoleLogs.map((log, i) => (
                              <div key={i} className={`py-0.5 px-2 rounded mb-0.5 flex gap-2 items-start ${
                                log.level === 'error' ? 'text-red-400 bg-red-400/5' :
                                log.level === 'warn' ? 'text-yellow-400 bg-yellow-400/5' :
                                'text-muted-foreground'
                              }`}>
                                <span className="opacity-40 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                <span className="break-all">{log.message}</span>
                              </div>
                            ))}
                            <div ref={consoleEndRef} />
                          </div>
                        </TabsContent>
                      </div>
                    </Tabs>
                  </ResizablePanel>
                  
                </ResizablePanelGroup>
              </ResizablePanel>

              <ResizableHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />

              {/* Right - Preview */}
              <ResizablePanel defaultSize={40} minSize={20}>
                <PreviewPanel projectId={projectId} />
              </ResizablePanel>
              
            </ResizablePanelGroup>
          </ResizablePanel>

        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export default function Ide() {
  const params = useParams();
  const projectId = params.projectId;

  if (!projectId) return <div>Project not found</div>;

  return (
    <IdeProvider>
      <IdeLayout projectId={projectId} />
    </IdeProvider>
  );
}
