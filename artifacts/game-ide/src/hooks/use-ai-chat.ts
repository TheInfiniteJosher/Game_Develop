import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface GeneratingAsset {
  index: number;
  name: string;
  assetType: string;
  style: string;
  prompt: string;
  status: 'generating' | 'done' | 'error';
  path?: string;
  previewUrl?: string;
  filename?: string;
  frameCount?: number;
  frameWidth?: number;
  frameHeight?: number;
  error?: string;
}

export interface GeneratingAudio {
  index: number;
  name: string;
  audioType: string;
  description: string;
  status: 'generating' | 'done' | 'error';
  path?: string;
  previewUrl?: string;
  loop?: boolean;
  phaserLoadSnippet?: string;
  phaserPlaySnippet?: string;
  error?: string;
}

export type AiPhase =
  | 'idle'
  | 'thinking'       // initial reasoning before any output
  | 'generating'     // generating assets / audio
  | 'writing'        // writing game files (code output)

export function useAiChatStream(projectId: string) {
  const [streamingMessage, setStreamingMessage] = useState('');
  const [thinking, setThinking] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [phase, setPhase] = useState<AiPhase>('idle');
  const [generatingAssets, setGeneratingAssets] = useState<GeneratingAsset[]>([]);
  const [generatingAudio, setGeneratingAudio] = useState<GeneratingAudio[]>([]);
  const queryClient = useQueryClient();

  const sendMessage = useCallback(async (message: string, contextFiles?: string[]) => {
    setIsStreaming(true);
    setPhase('thinking');
    setStreamingMessage('');
    setThinking('');
    setGeneratingAssets([]);
    setGeneratingAudio([]);

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

      let buffer = '';
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.trim() === '') continue;
            if (!line.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'thinking') {
                setThinking(prev => prev + (data.content || ''));
                setPhase('thinking');
              } else if (data.type === 'thinking_done') {
                setThinking('');
                // phase stays 'thinking' until we know what comes next
              } else if (data.type === 'delta') {
                setStreamingMessage(prev => prev + data.content);
                setPhase('writing');

              } else if (data.type === 'assets_start') {
                setGeneratingAssets([]);
                setGeneratingAudio([]);
                setPhase('generating');

              } else if (data.type === 'asset_generating') {
                setGeneratingAssets(prev => [
                  ...prev.filter(a => a.index !== data.index),
                  {
                    index: data.index,
                    name: data.name,
                    assetType: data.assetType,
                    style: data.style,
                    prompt: data.prompt,
                    status: 'generating',
                  },
                ]);

              } else if (data.type === 'asset_done') {
                setGeneratingAssets(prev =>
                  prev.map(a =>
                    a.index === data.index
                      ? {
                          ...a,
                          status: 'done',
                          path: data.path,
                          previewUrl: data.previewUrl,
                          filename: data.filename,
                          frameCount: data.frameCount,
                          frameWidth: data.frameWidth,
                          frameHeight: data.frameHeight,
                        }
                      : a
                  )
                );
                queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/assets`] });

              } else if (data.type === 'asset_error') {
                setGeneratingAssets(prev =>
                  prev.map(a =>
                    a.index === data.index
                      ? { ...a, status: 'error', error: data.error }
                      : a
                  )
                );

              } else if (data.type === 'audio_generating') {
                setGeneratingAudio(prev => [
                  ...prev.filter(a => a.index !== data.index),
                  {
                    index: data.index,
                    name: data.name,
                    audioType: data.audioType,
                    description: data.description,
                    status: 'generating',
                  },
                ]);

              } else if (data.type === 'audio_done') {
                setGeneratingAudio(prev =>
                  prev.map(a =>
                    a.index === data.index
                      ? {
                          ...a,
                          status: 'done',
                          path: data.path,
                          previewUrl: data.previewUrl,
                          loop: data.loop,
                          phaserLoadSnippet: data.phaserLoadSnippet,
                          phaserPlaySnippet: data.phaserPlaySnippet,
                        }
                      : a
                  )
                );
                queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/audio`] });

              } else if (data.type === 'audio_error') {
                setGeneratingAudio(prev =>
                  prev.map(a =>
                    a.index === data.index
                      ? { ...a, status: 'error', error: data.error }
                      : a
                  )
                );

              } else if (data.type === 'assets_done') {
                setPhase('writing');

              } else if (data.type === 'change') {
                queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });

              } else if (data.type === 'assets_saved') {
                queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/assets`] });

              } else if (data.type === 'done') {
                queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/ai/history`] });
                queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/changes`] });
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error', error);
    } finally {
      setIsStreaming(false);
      setPhase('idle');
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/ai/history`] });
    }
  }, [projectId, queryClient]);

  return { sendMessage, streamingMessage, thinking, isStreaming, phase, generatingAssets, generatingAudio };
}
