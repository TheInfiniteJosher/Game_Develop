import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Music2, Volume2, Loader2, Play, Pause, Trash2, CheckCircle2, AlertCircle,
  Radio, Wand2, WifiOff, Download, Upload,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AudioAsset {
  path: string;
  filename: string;
  audioType: string;
  previewUrl: string;
  loop: boolean;
  createdAt: string;
  metadata?: {
    audioName?: string;
    style?: string;
    mood?: string;
    duration?: string;
    description?: string;
    durationSeconds?: number;
  };
}

// ─── Download helper ──────────────────────────────────────────────────────────

async function downloadAudio(previewUrl: string, filename: string) {
  try {
    const res = await fetch(previewUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch { /* ignore */ }
}

// ─── Audio player ─────────────────────────────────────────────────────────────

function AudioPlayer({ src, loop }: { src: string; loop: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.loop = loop;
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [playing, loop]);

  return (
    <div className="flex items-center gap-1.5">
      <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} />
      <button
        onClick={toggle}
        className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${
          playing
            ? "bg-violet-500 text-white"
            : "bg-violet-500/15 text-violet-400 hover:bg-violet-500/30"
        }`}
      >
        {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      </button>
    </div>
  );
}

// ─── Audio type icon ──────────────────────────────────────────────────────────

function AudioTypeIcon({ type }: { type: string }) {
  if (type === "music") return <Music2 className="w-3.5 h-3.5 text-violet-400" />;
  if (type === "ambient") return <Radio className="w-3.5 h-3.5 text-blue-400" />;
  return <Volume2 className="w-3.5 h-3.5 text-orange-400" />;
}

// ─── Project audio list item ──────────────────────────────────────────────────

function AudioItem({
  audio,
  onDelete,
}: {
  audio: AudioAsset;
  onDelete: (path: string) => void;
}) {
  const name = audio.metadata?.audioName || audio.filename.replace(/\.\w+$/, "");
  const style = audio.metadata?.style;
  const durationSec = audio.metadata?.durationSeconds;

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-border/50 hover:border-violet-500/30 bg-card hover:bg-violet-500/5 transition-all group">
      <AudioTypeIcon type={audio.audioType} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate">{name.replace(/_/g, " ")}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <span className="capitalize">{audio.audioType}</span>
          {style && <><span>·</span><span>{style}</span></>}
          {durationSec && <><span>·</span><span>{durationSec.toFixed(1)}s</span></>}
          {audio.loop && <><span>·</span><span>loop</span></>}
        </div>
      </div>
      <AudioPlayer src={audio.previewUrl} loop={audio.loop} />
      <button
        onClick={() => downloadAudio(audio.previewUrl, audio.filename)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-violet-400 p-1 rounded transition-all"
        title="Download"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onDelete(audio.path)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded transition-all"
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Config constants ─────────────────────────────────────────────────────────

const AUDIO_TYPES = [
  { value: "sfx", label: "SFX", icon: Volume2, color: "orange" },
  { value: "music", label: "Music", icon: Music2, color: "violet" },
  { value: "ambient", label: "Ambient", icon: Radio, color: "blue" },
  { value: "ui", label: "UI Sound", icon: Volume2, color: "green" },
];

const STYLES = ["8bit", "synth", "realistic", "fantasy", "scifi", "lofi", "cinematic"];

const DURATIONS = [
  { value: "short", label: "Short (<2s)" },
  { value: "medium", label: "Medium (4s)" },
  { value: "long", label: "Long (8s)" },
  { value: "loop", label: "Loop (20s)" },
];

const MOODS = ["playful", "tense", "calm", "epic", "mysterious", "cozy", "energetic", "spooky"];

// ─── Main component ───────────────────────────────────────────────────────────

export function AudioStudio({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState("");
  const [audioType, setAudioType] = useState("sfx");
  const [style, setStyle] = useState("8bit");
  const [duration, setDuration] = useState("medium");
  const [mood, setMood] = useState("");
  const [lastGenerated, setLastGenerated] = useState<{
    filename: string; path: string; previewUrl: string;
    phaserLoadSnippet: string; phaserPlaySnippet: string; loop: boolean;
  } | null>(null);
  const [genError, setGenError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadAudioType, setUploadAudioType] = useState("sfx");
  const uploadRef = useRef<HTMLInputElement>(null);

  const audioQueryKey = [`/api/projects/${projectId}/audio`];

  const { data: audioList = [] } = useQuery<AudioAsset[]>({
    queryKey: audioQueryKey,
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/audio`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      setGenError("");
      setLastGenerated(null);
      const slug = description.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24) || "sound";
      const audioName = `${slug}_${audioType}`;
      const res = await fetch(`/api/projects/${projectId}/audio/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioName,
          audioType,
          description: description.trim(),
          style,
          mood: mood || undefined,
          duration: audioType === "music" || audioType === "ambient" ? "loop" : duration,
          loop: audioType === "music" || audioType === "ambient",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to generate audio" }));
        throw new Error(err.error || "Failed to generate audio");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setLastGenerated({
        filename: data.filename ?? "",
        path: data.path ?? "",
        previewUrl: data.previewUrl ?? "",
        phaserLoadSnippet: data.phaserLoadSnippet ?? "",
        phaserPlaySnippet: data.phaserPlaySnippet ?? "",
        loop: data.loop ?? false,
      });
      queryClient.invalidateQueries({ queryKey: audioQueryKey });
    },
    onError: (err: Error) => {
      setGenError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (path: string) => {
      await fetch(`/api/projects/${projectId}/audio`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: audioQueryKey }),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    const form = new FormData();
    form.append("file", file);
    form.append("audioType", uploadAudioType);
    try {
      const res = await fetch(`/api/projects/${projectId}/audio/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      queryClient.invalidateQueries({ queryKey: audioQueryKey });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const isLoading = generateMutation.isPending;

  const sfxAudio = audioList.filter(a => a.audioType === "sfx" || a.audioType === "ui");
  const musicAudio = audioList.filter(a => a.audioType === "music");
  const ambientAudio = audioList.filter(a => a.audioType === "ambient");

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-card shrink-0 flex items-center gap-2">
        <Music2 className="w-4 h-4 text-violet-400" />
        <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Audio Studio</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{audioList.length} asset{audioList.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Generation Form */}
        <div className="p-3 border-b border-border space-y-3">
          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Describe your sound</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={
                audioType === "music" ? "Cozy lofi background music with soft piano and rain…" :
                audioType === "ambient" ? "Busy coffee shop chatter with clinking cups…" :
                audioType === "ui" ? "Satisfying menu select click, crisp and short…" :
                "8-bit coin pickup, bouncy and rewarding…"
              }
              className="min-h-[60px] resize-none text-xs bg-muted/30 border-border/60"
            />
          </div>

          {/* Audio Type */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Audio Type</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {AUDIO_TYPES.map(t => {
                const Icon = t.icon;
                const isActive = audioType === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => {
                      setAudioType(t.value);
                      if (t.value === "music" || t.value === "ambient") setDuration("loop");
                      else if (duration === "loop") setDuration("medium");
                    }}
                    className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border text-[10px] font-medium transition-all ${
                      isActive
                        ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                        : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Style */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Style</Label>
            <div className="flex flex-wrap gap-1">
              {STYLES.map(s => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`px-2 py-0.5 rounded-full text-[10px] border transition-all capitalize ${
                    style === s
                      ? "border-violet-500/60 bg-violet-500/20 text-violet-300"
                      : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Duration (hidden for music/ambient — always loop) */}
          {audioType !== "music" && audioType !== "ambient" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Duration</Label>
              <div className="flex gap-1.5">
                {DURATIONS.filter(d => d.value !== "loop").map(d => (
                  <button
                    key={d.value}
                    onClick={() => setDuration(d.value)}
                    className={`flex-1 px-2 py-1 rounded-lg text-[10px] border transition-all ${
                      duration === d.value
                        ? "border-violet-500/60 bg-violet-500/20 text-violet-300"
                        : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mood (optional) */}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Mood <span className="opacity-50">(optional)</span></Label>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setMood("")}
                className={`px-2 py-0.5 rounded-full text-[10px] border transition-all ${
                  mood === ""
                    ? "border-violet-500/60 bg-violet-500/20 text-violet-300"
                    : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border"
                }`}
              >
                any
              </button>
              {MOODS.map(m => (
                <button
                  key={m}
                  onClick={() => setMood(mood === m ? "" : m)}
                  className={`px-2 py-0.5 rounded-full text-[10px] border transition-all ${
                    mood === m
                      ? "border-violet-500/60 bg-violet-500/20 text-violet-300"
                      : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            className="w-full h-9 text-xs font-semibold"
            disabled={isLoading || !description.trim()}
            onClick={() => generateMutation.mutate()}
            style={!isLoading && description.trim() ? {
              background: "linear-gradient(135deg, hsl(265 70% 58%), hsl(280 70% 50%))"
            } : undefined}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5 mr-2" />
                Generate Audio
              </>
            )}
          </Button>

          {/* Error */}
          {genError && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
              {genError.includes("ELEVENLABS_API_KEY") ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold mb-0.5">ElevenLabs key required</div>
                    <div className="text-[10px] opacity-80">Add <code>ELEVENLABS_API_KEY</code> to your project secrets to enable audio generation.</div>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{genError}</span>
                </>
              )}
            </div>
          )}

          {/* Last generated preview */}
          {lastGenerated && (
            <div className="p-2.5 rounded-xl border border-violet-500/30 bg-violet-500/5 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                <span className="text-xs font-semibold text-violet-300 truncate">
                  {lastGenerated.filename.replace(/\.\w+$/, "").replace(/_/g, " ")}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => downloadAudio(lastGenerated.previewUrl, lastGenerated.filename)}
                    className="p-1 rounded text-muted-foreground hover:text-violet-400 transition-colors"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <AudioPlayer src={lastGenerated.previewUrl} loop={lastGenerated.loop} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="font-mono text-[9px] bg-muted/40 rounded p-1.5 text-muted-foreground break-all">
                  {lastGenerated.phaserLoadSnippet}
                </div>
                <div className="font-mono text-[9px] bg-muted/40 rounded p-1.5 text-muted-foreground break-all">
                  {lastGenerated.phaserPlaySnippet}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload Section */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Upload Audio</Label>
            <div className="flex gap-1">
              {(["sfx", "music", "ambient", "ui"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setUploadAudioType(t)}
                  className={`px-1.5 py-0.5 rounded text-[10px] border transition-all capitalize ${
                    uploadAudioType === t
                      ? "border-violet-500/60 bg-violet-500/20 text-violet-300"
                      : "border-border/50 bg-muted/20 text-muted-foreground hover:border-border"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-center gap-2 h-9 rounded-lg border border-dashed border-border/60 hover:border-violet-500/50 hover:bg-violet-500/5 cursor-pointer transition-colors text-xs text-muted-foreground">
            <Upload className="w-3.5 h-3.5" />
            <span>Drop MP3 / OGG / WAV or click</span>
            <input
              ref={uploadRef}
              type="file"
              accept=".mp3,.ogg,.wav,audio/*"
              className="hidden"
              onChange={handleUpload}
            />
          </label>
          {uploadError && (
            <div className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 rounded p-1.5">{uploadError}</div>
          )}
        </div>

        {/* Project Audio Library */}
        {audioList.length > 0 && (
          <div className="p-3 space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Project Audio</div>

            {musicAudio.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Music2 className="w-3 h-3 text-violet-400" />
                  <span>Music</span>
                </div>
                {musicAudio.map(a => (
                  <AudioItem key={a.path} audio={a} onDelete={(p) => deleteMutation.mutate(p)} />
                ))}
              </div>
            )}

            {ambientAudio.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Radio className="w-3 h-3 text-blue-400" />
                  <span>Ambient</span>
                </div>
                {ambientAudio.map(a => (
                  <AudioItem key={a.path} audio={a} onDelete={(p) => deleteMutation.mutate(p)} />
                ))}
              </div>
            )}

            {sfxAudio.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Volume2 className="w-3 h-3 text-orange-400" />
                  <span>SFX & UI</span>
                </div>
                {sfxAudio.map(a => (
                  <AudioItem key={a.path} audio={a} onDelete={(p) => deleteMutation.mutate(p)} />
                ))}
              </div>
            )}
          </div>
        )}

        {audioList.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground opacity-50 space-y-2">
            <Music2 className="w-10 h-10" />
            <p className="text-xs">No audio yet. Generate or upload your first sound!</p>
          </div>
        )}
      </div>
    </div>
  );
}
