import { useParams, Link } from "wouter";
import { useEffect, useState } from "react";

interface GameProject {
  id: string;
  name: string;
  description: string | null;
  publishedSlug: string | null;
  publishedAt: string | null;
}

export default function Play() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<GameProject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/play/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "Game not found");
        return res.json();
      })
      .then((data) => {
        setProject(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black">
        <div className="animate-pulse text-white/40 text-sm font-mono">Loading game…</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-black gap-4">
        <div className="text-red-400 text-lg font-semibold">Game not found</div>
        <p className="text-white/40 text-sm">This game isn't published or the link is invalid.</p>
        <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm underline">
          Go to GameForge Studio
        </Link>
      </div>
    );
  }

  const previewUrl = `/api/preview/${project.id}/index.html`;

  return (
    <div className="h-screen w-screen flex flex-col bg-black overflow-hidden">
      <iframe
        src={previewUrl}
        className="flex-1 w-full border-0"
        title={project.name}
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"
        allow="fullscreen"
      />
      <div className="h-8 bg-black/90 flex items-center justify-between px-4 shrink-0">
        <span className="text-white/30 text-xs font-mono truncate">{project.name}</span>
        <Link
          href="/"
          className="text-white/20 hover:text-white/50 text-xs transition-colors shrink-0"
        >
          Made with GameForge
        </Link>
      </div>
    </div>
  );
}
