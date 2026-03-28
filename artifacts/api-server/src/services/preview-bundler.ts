/**
 * preview-bundler.ts
 *
 * Uses esbuild to collapse a project's native-ESM source tree into a single
 * inline <script> so the browser makes ONE request instead of a waterfall of
 * module fetches.  The result is cached in memory and invalidated whenever any
 * project file is written or deleted.
 */

import * as esbuild from "esbuild";
import path from "path";
import { getProjectRoot } from "./filesystem.js";

interface CacheEntry {
  js: string;
  builtAt: number;
}

const cache = new Map<string, CacheEntry>();

export function invalidateBundleCache(projectId: string): void {
  cache.delete(projectId);
}

export async function bundleEntryJs(
  projectId: string,
  jsRelPath: string
): Promise<string | null> {
  const cached = cache.get(projectId);
  if (cached) return cached.js;

  const root = getProjectRoot(projectId);
  const fullEntry = path.resolve(root, jsRelPath);

  try {
    const result = await esbuild.build({
      entryPoints: [fullEntry],
      bundle: true,
      format: "iife",
      write: false,
      absWorkingDir: root,
      platform: "browser",
      target: ["es2020"],
      logLevel: "silent",
      // Asset files loaded by Phaser at runtime (string URLs) – just stub them
      // so esbuild doesn't choke if someone accidentally imports them as modules.
      loader: {
        ".png": "empty",
        ".jpg": "empty",
        ".jpeg": "empty",
        ".gif": "empty",
        ".svg": "empty",
        ".webp": "empty",
        ".mp3": "empty",
        ".ogg": "empty",
        ".wav": "empty",
        ".m4a": "empty",
        ".flac": "empty",
      },
    });

    const js = result.outputFiles?.[0]?.text ?? "";
    if (!js) return null;

    cache.set(projectId, { js, builtAt: Date.now() });
    return js;
  } catch (err) {
    // Bundling failed (syntax error, bad import, etc.) – fall back to original
    return null;
  }
}

/**
 * Given an HTML string, finds the first <script type="module" src="..."> tag,
 * bundles that JS entry via esbuild, and returns the HTML with that tag
 * replaced by an inline <script> containing the full bundle.
 *
 * Returns null if no bundleable script is found or bundling fails.
 */
export async function bundleHtmlPreview(
  projectId: string,
  html: string
): Promise<string | null> {
  // Match <script type="module" src="..."> in either attribute order
  const scriptRe =
    /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["'][^>]*>[\s\S]*?<\/script>|<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*\btype=["']module["'][^>]*>[\s\S]*?<\/script>/gi;

  let match: RegExpExecArray | null;
  let jsSrc: string | null = null;

  while ((match = scriptRe.exec(html)) !== null) {
    const src = match[1] ?? match[2];
    // Skip absolute URLs / CDN scripts – only bundle local files
    if (!src || src.startsWith("http") || src.startsWith("//")) continue;
    jsSrc = src;
    break;
  }

  if (!jsSrc) return null;

  // Normalise path: strip leading "./" or "/"
  const jsRelPath = jsSrc.replace(/^\.\//, "").replace(/^\//, "");

  const bundledJs = await bundleEntryJs(projectId, jsRelPath);
  if (!bundledJs) return null;

  // Remove all local module <script> tags (they're now bundled inline)
  let result = html.replace(scriptRe, (full, src1, src2) => {
    const s = src1 ?? src2 ?? "";
    if (!s || s.startsWith("http") || s.startsWith("//")) return full; // keep CDN scripts
    return ""; // remove local module scripts
  });

  // Inject the bundle just before </body> (or append if no </body>)
  const inlineTag = `<script>\n${bundledJs}\n</script>`;
  if (result.includes("</body>")) {
    result = result.replace("</body>", `${inlineTag}\n</body>`);
  } else {
    result += "\n" + inlineTag;
  }

  return result;
}
