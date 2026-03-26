import { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { useReadFile, useWriteFile } from "@/hooks/use-api";
import { useIde } from "@/hooks/use-ide";
import { Loader2 } from "lucide-react";

export function CodeEditor({ projectId }: { projectId: string }) {
  const { activeFile, refreshPreview } = useIde();
  const [content, setContent] = useState<string>("");
  
  const { data, isLoading } = useReadFile(
    projectId, 
    { path: activeFile || "" }, 
    { query: { enabled: !!activeFile } }
  );

  const writeFile = useWriteFile();

  useEffect(() => {
    if (data) {
      setContent(data.content);
    } else {
      setContent("");
    }
  }, [data, activeFile]);

  const handleSave = () => {
    if (!activeFile) return;
    writeFile.mutate({ 
      id: projectId, 
      data: { path: activeFile, content } 
    }, {
      onSuccess: () => {
        refreshPreview();
      }
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, content]);

  if (!activeFile) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <div className="mb-2 text-4xl">🚀</div>
          <p>Select a file to start coding</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const language = activeFile.endsWith('.json') ? 'json' :
                   activeFile.endsWith('.html') ? 'html' :
                   activeFile.endsWith('.css') ? 'css' :
                   (activeFile.endsWith('.js') || activeFile.endsWith('.jsx')) ? 'javascript' :
                   (activeFile.endsWith('.ts') || activeFile.endsWith('.tsx')) ? 'typescript' : 'plaintext';

  return (
    <div className="h-full w-full bg-background pt-2">
      <Editor
        height="100%"
        language={language}
        theme="vs-dark"
        value={content}
        onChange={(val) => setContent(val || "")}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', monospace",
          wordWrap: 'on',
          padding: { top: 16 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          formatOnPaste: true,
        }}
      />
    </div>
  );
}
