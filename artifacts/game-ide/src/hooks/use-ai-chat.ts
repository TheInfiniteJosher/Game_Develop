import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useAiChatStream(projectId: string) {
  const [streamingMessage, setStreamingMessage] = useState('');
  const [thinking, setThinking] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const queryClient = useQueryClient();

  const sendMessage = useCallback(async (message: string, contextFiles?: string[]) => {
    setIsStreaming(true);
    setStreamingMessage('');
    setThinking('');

    try {
      const res = await fetch(`/api/projects/${projectId}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, contextFiles })
      });

      if (!res.ok) throw new Error('Failed to start chat');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.trim() === '') continue;
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'thinking') {
                  setThinking(prev => prev + data.content);
                } else if (data.type === 'delta') {
                  setStreamingMessage(prev => prev + data.content);
                } else if (data.type === 'change') {
                  // A file was changed, invalidate files list so tree updates
                  queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
                } else if (data.type === 'done') {
                  // Generation complete
                  queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/ai/history`] });
                  queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/changes`] });
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error', error);
    } finally {
      setIsStreaming(false);
      // Ensure we refresh history one last time
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/ai/history`] });
    }
  }, [projectId, queryClient]);

  return { sendMessage, streamingMessage, thinking, isStreaming };
}
