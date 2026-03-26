import { useState, useRef, useEffect } from "react";
import { useGetAiHistory, useClearAiHistory } from "@/hooks/use-api";
import { useAiChatStream } from "@/hooks/use-ai-chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Trash2, ChevronRight, Bot, User, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function AiChatPanel({ projectId }: { projectId: string }) {
  const { data: history } = useGetAiHistory(projectId);
  const clearHistory = useClearAiHistory();
  const { sendMessage, streamingMessage, thinking, isStreaming } = useAiChatStream(projectId);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, streamingMessage, thinking]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between p-2 border-b border-border bg-card shrink-0">
        <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground px-2">AI Assistant</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => clearHistory.mutate({ id: projectId })} title="Clear History">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {history?.length === 0 && !isStreaming && (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
            <Bot className="w-16 h-16" />
            <p>How can I help you build your game today?</p>
          </div>
        )}

        {history?.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`p-3 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-secondary text-secondary-foreground rounded-tl-sm'}`}>
                {msg.thinking && (
                  <Collapsible className="mb-2">
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 transition-opacity">
                      <ChevronRight className="h-3 w-3 group-data-[state=open]:rotate-90 transition-transform" />
                      Thinking Process
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 text-xs opacity-80 border-l-2 border-primary/30 pl-2 py-1 max-h-40 overflow-y-auto hide-scrollbar">
                      {msg.thinking}
                    </CollapsibleContent>
                  </Collapsible>
                )}
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              </div>
              {msg.role === 'assistant' && (msg.changesCount || msg.thinkingDurationMs) && (
                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                  {msg.thinkingDurationMs ? `Thought for ${(msg.thinkingDurationMs/1000).toFixed(1)}s` : ''} 
                  {msg.changesCount ? ` · Made ${msg.changesCount} changes` : ''}
                </span>
              )}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex gap-3 flex-row">
            <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex flex-col max-w-[85%] items-start">
              <div className="p-3 rounded-2xl bg-secondary text-secondary-foreground rounded-tl-sm w-full">
                {thinking ? (
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Thinking...
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 text-xs opacity-80 border-l-2 border-primary/30 pl-2 py-1">
                      {thinking}
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Starting...
                  </div>
                )}
                {streamingMessage && (
                  <div className="prose prose-sm prose-invert max-w-none mt-2 pt-2 border-t border-border/50">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingMessage}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border bg-card">
        <div className="relative flex items-end shadow-sm rounded-xl border border-input focus-within:ring-1 focus-within:ring-primary overflow-hidden bg-background">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Describe a feature or bug to fix..."
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
