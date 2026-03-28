import { useState, useCallback, useRef } from 'react';
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
  | 'thinking'
  | 'generating'
  | 'writing'
  | 'complete'

export interface BuildStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'skipped';
  detail?: string;
}

interface BuildSnapshot {
  isBuildWorkflow: boolean;
  isBuildComplete: boolean;
  filesWritten: number;
  generatingAssets: GeneratingAsset[];
  generatingAudio: GeneratingAudio[];
}

function loadSnapshot(projectId: string): BuildSnapshot | null {
  try {
    const raw = sessionStorage.getItem(`gameforge_build_${projectId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSnapshot(projectId: string, snap: BuildSnapshot) {
  try {
    sessionStorage.setItem(`gameforge_build_${projectId}`, JSON.stringify(snap));
  } catch {}
}

function clearSnapshot(projectId: string) {
  try {
    sessionStorage.removeItem(`gameforge_build_${projectId}`);
  } catch {}
}

export function useAiChatStream(projectId: string, onGameReady?: () => void) {
  const saved = loadSnapshot(projectId);

  const [streamingMessage, setStreamingMessage] = useState('');
  const [thinking, setThinking] = useState<string | undefined>(undefined);
  const [isStreaming, setIsStreaming] = useState(false);
  const [phase, setPhase] = useState<AiPhase>(saved?.isBuildComplete ? 'complete' : 'idle');
  const [generatingAssets, setGeneratingAssets] = useState<GeneratingAsset[]>(saved?.generatingAssets ?? []);
  const [generatingAudio, setGeneratingAudio] = useState<GeneratingAudio[]>(saved?.generatingAudio ?? []);
  const [isBuildWorkflow, setIsBuildWorkflow] = useState(saved?.isBuildWorkflow ?? false);
  const [isBuildComplete, setIsBuildComplete] = useState(saved?.isBuildComplete ?? false);
  const [filesWritten, setFilesWritten] = useState(saved?.filesWritten ?? 0);

  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const sendMessage = useCallback(async (message: string, contextFiles?: string[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Clear previous build state and session snapshot before starting new message
    clearSnapshot(projectId);
    setIsStreaming(true);
    setPhase('thinking');
    setStreamingMessage('');
    setThinking(undefined);
    setGeneratingAssets([]);
    setGeneratingAudio([]);
    setIsBuildWorkflow(false);
    setIsBuildComplete(false);
    setFilesWritten(0);

    // Local variables to track current build state for snapshotting
    let currentAssets: GeneratingAsset[] = [];
    let currentAudio: GeneratingAudio[] = [];

    try {
      const res = await fetch(`/api/projects/${projectId}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, contextFiles }),
        signal: controller.signal,
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
                setThinking(prev => (prev ?? '') + (data.content || ''));
                setPhase('thinking');
              } else if (data.type === 'thinking_done') {
                setThinking(undefined);
              } else if (data.type === 'delta') {
                setStreamingMessage(prev => prev + data.content);
                setPhase('writing');

              } else if (data.type === 'assets_start') {
                currentAssets = [];
                currentAudio = [];
                setGeneratingAssets([]);
                setGeneratingAudio([]);
                setIsBuildWorkflow(true);
                setPhase('generating');

              } else if (data.type === 'asset_generating') {
                setGeneratingAssets(prev => {
                  const next = [
                    ...prev.filter(a => a.index !== data.index),
                    {
                      index: data.index,
                      name: data.name,
                      assetType: data.assetType,
                      style: data.style,
                      prompt: data.prompt,
                      status: 'generating' as const,
                    },
                  ];
                  currentAssets = next;
                  return next;
                });

              } else if (data.type === 'asset_done') {
                setGeneratingAssets(prev => {
                  const next = prev.map(a =>
                    a.index === data.index
                      ? {
                          ...a,
                          status: 'done' as const,
                          path: data.path,
                          previewUrl: data.previewUrl,
                          filename: data.filename,
                          frameCount: data.frameCount,
                          frameWidth: data.frameWidth,
                          frameHeight: data.frameHeight,
                        }
                      : a
                  );
                  currentAssets = next;
                  return next;
                });
                queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/assets`] });

              } else if (data.type === 'asset_error') {
                setGeneratingAssets(prev => {
                  const next = prev.map(a =>
                    a.index === data.index ? { ...a, status: 'error' as const, error: data.error } : a
                  );
                  currentAssets = next;
                  return next;
                });

              } else if (data.type === 'audio_generating') {
                setIsBuildWorkflow(true);
                setGeneratingAudio(prev => {
                  const next = [
                    ...prev.filter(a => a.index !== data.index),
                    {
                      index: data.index,
                      name: data.name,
                      audioType: data.audioType,
                      description: data.description,
                      status: 'generating' as const,
                    },
                  ];
                  currentAudio = next;
                  return next;
                });

              } else if (data.type === 'audio_done') {
                setGeneratingAudio(prev => {
                  const next = prev.map(a =>
                    a.index === data.index
                      ? {
                          ...a,
                          status: 'done' as const,
                          path: data.path,
                          previewUrl: data.previewUrl,
                          loop: data.loop,
                          phaserLoadSnippet: data.phaserLoadSnippet,
                          phaserPlaySnippet: data.phaserPlaySnippet,
                        }
                      : a
                  );
                  currentAudio = next;
                  return next;
                });
                queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/audio`] });

              } else if (data.type === 'audio_error') {
                setGeneratingAudio(prev => {
                  const next = prev.map(a =>
                    a.index === data.index ? { ...a, status: 'error' as const, error: data.error } : a
                  );
                  currentAudio = next;
                  return next;
                });

              } else if (data.type === 'assets_done') {
                setPhase('writing');

              } else if (data.type === 'change') {
                queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });

              } else if (data.type === 'game_ready') {
                const newFilesWritten = data.filesWritten || 0;
                setFilesWritten(newFilesWritten);
                setIsBuildComplete(true);
                setPhase('complete');
                onGameReady?.();
                queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });

                // Persist the completed build state so it survives tab switches and page refresh
                saveSnapshot(projectId, {
                  isBuildWorkflow: true,
                  isBuildComplete: true,
                  filesWritten: newFilesWritten,
                  generatingAssets: currentAssets,
                  generatingAudio: currentAudio,
                });

              } else if (data.type === 'assets_saved') {
                queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/assets`] });

              } else if (data.type === 'done') {
                queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/ai/history`] });
                queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/changes`] });
                queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Chat error', error);
    } finally {
      setIsStreaming(false);
      // Preserve 'complete' phase so the build tracker stays visible after streaming ends.
      // Only revert to idle if we never completed a build in this stream.
      setPhase(prev => prev === 'complete' ? 'complete' : 'idle');
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/ai/history`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/files`] });
    }
  }, [projectId, queryClient, onGameReady]);

  return {
    sendMessage,
    stopStreaming,
    streamingMessage,
    thinking,
    isStreaming,
    phase,
    generatingAssets,
    generatingAudio,
    isBuildWorkflow,
    isBuildComplete,
    filesWritten,
  };
}
