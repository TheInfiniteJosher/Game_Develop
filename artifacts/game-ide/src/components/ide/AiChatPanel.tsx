import { useState, useRef, useEffect, useCallback } from "react";
import { useGetAiHistory, useClearAiHistory } from "@/hooks/use-api";
import { useAiChatStream } from "@/hooks/use-ai-chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Trash2, ChevronRight, Bot, User, Loader2, FileCode2 } from "lucide-react";
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

export function AiChatPanel({ projectId }: { projectId: string }) {
  const { data: history } = useGetAiHistory(projectId);
  const clearHistory = useClearAiHistory();
  const { sendMessage, streamingMessage, thinking, isStreaming } = useAiChatStream(projectId);
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
  }, [history, streamingMessage, thinking]);

  // When AI starts streaming, reset scroll lock and open thinking bubble
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
      <div className="flex items-center justify-between p-2 border-b border-border bg-card shrink-0">
        <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground px-2">AI Assistant</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => clearHistory.mutate({ id: projectId })} title="Clear History">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {history?.length === 0 && !isStreaming && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
            <Bot className="w-16 h-16" />
            <p>How can I help you build your game today?</p>
          </div>
        )}

        {history?.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>
            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-1`}>
              {msg.role === 'assistant' && msg.thinking && (
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
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-secondary text-secondary-foreground rounded-tl-sm'
              }`}>
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              </div>
              {msg.role === 'assistant' && msg.changesCount != null && msg.changesCount > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
                  <FileCode2 className="w-3 h-3" />
                  <span>{msg.changesCount} file{msg.changesCount !== 1 ? 's' : ''} updated</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex gap-2.5 flex-row">
            <div className="w-7 h-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col max-w-[85%] items-start gap-1">
              {/* Thinking bubble */}
              <Collapsible open={thinkingOpen} onOpenChange={setThinkingOpen}>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary/50 group">
                  {visibleStream ? (
                    <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
                  ) : (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  <span className="flex items-center gap-1">
                    Thinking
                    {!visibleStream && (
                      <span className="flex gap-0.5 ml-0.5">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    )}
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="text-[11px] text-muted-foreground border-l-2 border-muted pl-3 py-1 ml-2 max-h-32 overflow-y-auto leading-relaxed">
                    {thinking || "Analyzing..."}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Response text (file blocks stripped) */}
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

      <div className="p-3 border-t border-border bg-card">
        <div className="relative flex items-end shadow-sm rounded-xl border border-input focus-within:ring-1 focus-within:ring-primary overflow-hidden bg-background">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything, or describe a change..."
            className="min-h-[56px] max-h-[200px] border-0 focus-visible:ring-0 shadow-none resize-none bg-transparent pr-12 py-3"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8 rounded-lg shadow-md transition-transform active:scale-95"
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
