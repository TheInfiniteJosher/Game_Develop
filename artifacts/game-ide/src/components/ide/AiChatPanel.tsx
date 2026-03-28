import { useState, useRef, useEffect, useCallback } from "react";
import { useGetAiHistory, useClearAiHistory } from "@/hooks/use-api";
import { useAiChatStream, type AiPhase, type GeneratingAsset, type GeneratingAudio } from "@/hooks/use-ai-chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Square, Trash2, ChevronRight, Bot, User, Loader2, FileCode2,
  Sparkles, ImageIcon, CheckCircle2, AlertCircle, Wand2, Music2, Volume2,
  PenLine, Cpu,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function stripFileBlocks(text: string) {
  return text.replace(/<file path="[^"]+">[\s\S]*?<\/file>/g, "").trim();
}

function countOpenFileTags(text: string) {
  return (text.match(/<file path="([^"]+)">/g) || []).map(m => {
    const match = m.match(/path="([^"]+)"/);
    return match ? match[1] : "";
  });
}

// ─── Working status bar ───────────────────────────────────────────────────────

function WorkingStatusBar({
  phase,
  generatingAssets,
  generatingAudio,
  writingFiles,
}: {
  phase: AiPhase;
  generatingAssets: GeneratingAsset[];
  generatingAudio: GeneratingAudio[];
  writingFiles: string[];
}) {
  const doneAssets = generatingAssets.filter(a => a.status === "done").length;
  const doneAudio  = generatingAudio.filter(a => a.status === "done").length;
  const totalAssets = generatingAssets.length;
  const totalAudio  = generatingAudio.length;

  let icon: React.ReactNode;
  let label: string;
  let sub: string | null = null;

  if (phase === "thinking") {
    icon  = <Cpu className="w-3 h-3 text-primary animate-pulse" />;
    label = "Thinking…";
  } else if (phase === "generating") {
    icon  = <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />;
    const parts: string[] = [];
    if (totalAssets > 0) parts.push(`${doneAssets}/${totalAssets} assets`);
    if (totalAudio  > 0) parts.push(`${doneAudio}/${totalAudio} audio`);
    label = `Generating ${parts.join(", ")}…`;
  } else if (phase === "writing") {
    icon  = <PenLine className="w-3 h-3 text-green-400" />;
    label = "Writing game files…";
    if (writingFiles.length > 0) sub = writingFiles[writingFiles.length - 1];
  } else {
    return null;
  }

  return (
    <div className="px-3 py-1.5 border-b border-border bg-card/50 shrink-0 flex items-center gap-2 min-h-0">
      {/* pulsing dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary/80" />
      </span>
      {icon}
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {sub && (
        <code className="text-[10px] text-primary/60 truncate max-w-[160px] ml-auto">{sub}</code>
      )}
    </div>
  );
}

// ─── Asset generation progress card ──────────────────────────────────────────

function AssetCard({ asset }: { asset: GeneratingAsset }) {
  const isDone = asset.status === "done";
  const isError = asset.status === "error";

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
      isDone
        ? "border-green-500/30 bg-green-500/5"
        : isError
          ? "border-red-500/30 bg-red-500/5"
          : "border-primary/30 bg-primary/5"
    }`}>
      {/* Thumbnail or spinner */}
      <div className="w-10 h-10 rounded-md overflow-hidden shrink-0 bg-[repeating-conic-gradient(#2a2a3a_0%_25%,#1e1e2e_0%_50%)] bg-[size:6px_6px] flex items-center justify-center">
        {isDone && asset.previewUrl ? (
          <img src={asset.previewUrl} alt={asset.name} className="w-full h-full object-contain" />
        ) : isError ? (
          <AlertCircle className="w-4 h-4 text-red-400" />
        ) : (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate">{asset.name.replace(/_/g, " ")}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {isDone ? asset.filename : isError ? (asset.error || "Failed") : `Generating ${asset.assetType}…`}
        </div>
      </div>

      {/* Status icon */}
      <div className="shrink-0">
        {isDone ? (
          <CheckCircle2 className="w-4 h-4 text-green-400" />
        ) : isError ? (
          <AlertCircle className="w-4 h-4 text-red-400" />
        ) : (
          <span className="text-[10px] text-primary/60 font-mono">{asset.style}</span>
        )}
      </div>
    </div>
  );
}

function AssetGenerationBlock({ assets }: { assets: GeneratingAsset[] }) {
  const doneCount = assets.filter(a => a.status === "done").length;
  const total = assets.length;
  const allDone = doneCount === total;

  return (
    <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/20">
        <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center">
          {allDone ? (
            <CheckCircle2 className="w-3 h-3 text-green-400" />
          ) : (
            <Sparkles className="w-3 h-3 text-primary animate-pulse" />
          )}
        </div>
        <span className="text-xs font-semibold">
          {allDone ? "Assets Generated" : "Generating Assets"}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {doneCount}/{total}
        </span>
      </div>

      {/* Asset list */}
      <div className="p-2 space-y-1.5">
        {assets.map(asset => (
          <AssetCard key={asset.index} asset={asset} />
        ))}
      </div>

      {allDone && (
        <div className="px-3 py-2 border-t border-primary/20">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Wand2 className="w-3 h-3 text-primary" />
            Writing game code with these assets…
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Audio generation progress card ──────────────────────────────────────────

const AUDIO_TYPE_ICONS: Record<string, typeof Music2> = {
  music: Music2,
  sfx: Volume2,
  ambient: Volume2,
  ui: Volume2,
};

function AudioCard({ audio }: { audio: GeneratingAudio }) {
  const isDone = audio.status === "done";
  const isError = audio.status === "error";
  const Icon = AUDIO_TYPE_ICONS[audio.audioType] || Volume2;

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
      isDone
        ? "border-violet-500/30 bg-violet-500/5"
        : isError
          ? "border-red-500/30 bg-red-500/5"
          : "border-violet-400/30 bg-violet-400/5"
    }`}>
      <div className={`w-10 h-10 rounded-md bg-violet-500/15 flex items-center justify-center shrink-0`}>
        {isDone ? (
          <CheckCircle2 className="w-4 h-4 text-violet-400" />
        ) : isError ? (
          <AlertCircle className="w-4 h-4 text-red-400" />
        ) : (
          <Icon className={`w-4 h-4 text-violet-400 animate-pulse`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate">{audio.name.replace(/_/g, " ")}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {isDone
            ? `${audio.audioType} · ${audio.loop ? "looping" : "one-shot"}`
            : isError
              ? (audio.error || "Failed")
              : `Generating ${audio.audioType}…`}
        </div>
      </div>
      <div className="shrink-0">
        {!isDone && !isError && (
          <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
        )}
      </div>
    </div>
  );
}

function AudioGenerationBlock({ audio }: { audio: GeneratingAudio[] }) {
  const doneCount = audio.filter(a => a.status === "done").length;
  const total = audio.length;
  const allDone = doneCount === total;

  return (
    <div className="mt-2 rounded-xl border border-violet-500/30 bg-violet-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-violet-500/20">
        <div className="w-5 h-5 rounded-md bg-violet-500/20 flex items-center justify-center">
          {allDone ? (
            <CheckCircle2 className="w-3 h-3 text-violet-400" />
          ) : (
            <Music2 className="w-3 h-3 text-violet-400 animate-pulse" />
          )}
        </div>
        <span className="text-xs font-semibold">
          {allDone ? "Audio Generated" : "Generating Audio"}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">{doneCount}/{total}</span>
      </div>
      <div className="p-2 space-y-1.5">
        {audio.map(a => <AudioCard key={a.index} audio={a} />)}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AiChatPanel({ projectId }: { projectId: string }) {
  const { data: history } = useGetAiHistory(projectId);
  const clearHistory = useClearAiHistory();
  const { sendMessage, stopStreaming, streamingMessage, thinking, isStreaming, phase, generatingAssets, generatingAudio } = useAiChatStream(projectId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);
  const [thinkingOpen, setThinkingOpen] = useState(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolledUp.current = distFromBottom > 80;
  }, []);

  useEffect(() => {
    if (isUserScrolledUp.current) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history, streamingMessage, thinking, generatingAssets, generatingAudio]);

  useEffect(() => {
    if (isStreaming) {
      isUserScrolledUp.current = false;
      setThinkingOpen(true);
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [isStreaming]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  };

  const visibleStream = stripFileBlocks(streamingMessage);
  const writingFiles = countOpenFileTags(streamingMessage);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-card shrink-0">
        <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground px-2">AI Assistant</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => clearHistory.mutate({ id: projectId })}
          title="Clear History"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Live working status bar */}
      {isStreaming && (
        <WorkingStatusBar
          phase={phase}
          generatingAssets={generatingAssets}
          generatingAudio={generatingAudio}
          writingFiles={writingFiles}
        />
      )}

      {/* Message list */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4">

        {history?.length === 0 && !isStreaming && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
            <Bot className="w-16 h-16" />
            <p>How can I help you build your game today?</p>
          </div>
        )}

        {/* Conversation history */}
        {history?.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}>
              {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"} gap-1`}>
              {msg.role === "assistant" && msg.thinking && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary/50 group">
                    <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
                    <span>Thought for {msg.thinkingDurationMs ? `${(msg.thinkingDurationMs / 1000).toFixed(1)}s` : "a moment"}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="text-[11px] text-muted-foreground border-l-2 border-muted pl-3 py-1 ml-2 max-h-32 overflow-y-auto leading-relaxed">
                      {msg.thinking}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
              <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-secondary text-secondary-foreground rounded-tl-sm"
              }`}>
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              </div>
              {msg.role === "assistant" && msg.changesCount != null && msg.changesCount > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
                  <FileCode2 className="w-3 h-3" />
                  <span>{msg.changesCount} file{msg.changesCount !== 1 ? "s" : ""} updated</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live streaming response */}
        {isStreaming && (
          <div className="flex gap-2.5 flex-row">
            <div className="w-7 h-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col max-w-[85%] items-start gap-1 w-full">

              {/* Thinking bubble */}
              {thinking !== undefined && (
                <Collapsible open={thinkingOpen} onOpenChange={setThinkingOpen}>
                  <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary/50 group">
                    {phase === "thinking" ? (
                      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90 shrink-0" />
                    )}
                    <span className="flex items-center gap-1">
                      {phase === "thinking" ? (
                        <>
                          Thinking
                          <span className="flex gap-0.5 ml-0.5">
                            <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                          </span>
                        </>
                      ) : (
                        <span className="opacity-60">Reasoned</span>
                      )}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="text-[11px] text-muted-foreground border-l-2 border-muted pl-3 py-1 ml-2 max-h-32 overflow-y-auto leading-relaxed">
                      {thinking || "Analyzing…"}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Asset generation progress */}
              {generatingAssets.length > 0 && (
                <div className="w-full max-w-[360px]">
                  <AssetGenerationBlock assets={generatingAssets} />
                </div>
              )}

              {/* Audio generation progress */}
              {generatingAudio.length > 0 && (
                <div className="w-full max-w-[360px]">
                  <AudioGenerationBlock audio={generatingAudio} />
                </div>
              )}

              {/* Streamed text response */}
              {visibleStream && (
                <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-secondary text-secondary-foreground text-sm leading-relaxed">
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{visibleStream}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* File write indicators */}
              {writingFiles.length > 0 && (
                <div className="flex flex-col gap-1 mt-0.5">
                  {writingFiles.map(f => (
                    <div key={f} className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
                      <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                      <span className="truncate">{f}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-border bg-card">
        {/* Prompt hint */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[
            "Build a coffee shop simulator",
            "Make a space shooter",
            "Create a platformer with a knight hero",
          ].map(hint => (
            <button
              key={hint}
              onClick={() => { setInput(hint); }}
              disabled={isStreaming}
              className="text-[10px] px-2 py-0.5 rounded-full border border-border/60 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors truncate max-w-[180px] disabled:opacity-40"
            >
              {hint}
            </button>
          ))}
        </div>

        <div className="relative flex items-end shadow-sm rounded-xl border border-input focus-within:ring-1 focus-within:ring-primary overflow-hidden bg-background">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything, or describe a game to build…"
            className="min-h-[56px] max-h-[200px] border-0 focus-visible:ring-0 shadow-none resize-none bg-transparent pr-12 py-3"
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          {isStreaming ? (
            <Button
              size="icon"
              className="absolute right-2 bottom-2 h-8 w-8 rounded-lg shadow-md transition-transform active:scale-95 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={stopStreaming}
              title="Stop generation"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="absolute right-2 bottom-2 h-8 w-8 rounded-lg shadow-md transition-transform active:scale-95"
              onClick={handleSend}
              disabled={!input.trim()}
              style={input.trim() ? { background: "linear-gradient(135deg, #F97316, #EA580C)" } : undefined}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>

        {isStreaming && (generatingAssets.length > 0 || generatingAudio.length > 0) && (
          <p className="text-[10px] text-muted-foreground text-center mt-1.5 flex items-center justify-center gap-1">
            {generatingAudio.length > 0 ? <Music2 className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
            Generating {generatingAudio.length > 0 ? "audio" : "assets"} — this may take 30–60 seconds
          </p>
        )}
      </div>
    </div>
  );
}
