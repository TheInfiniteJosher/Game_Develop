import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import {
  saveFileToGcs,
  deleteFileFromGcs,
  deleteFolderFromGcs,
} from "./gcs-sync.js";

const STORAGE_ROOT = process.env.PROJECTS_STORAGE || "/tmp/game-ide-projects";

export function getProjectRoot(projectId: string): string {
  return path.join(STORAGE_ROOT, projectId, "files");
}

export async function ensureProjectDir(projectId: string): Promise<void> {
  const root = getProjectRoot(projectId);
  await fs.mkdir(root, { recursive: true });
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
  size?: number;
}

export async function buildFileTree(
  dir: string,
  relativePath = ""
): Promise<FileNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) {
      return a.isDirectory() ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  })) {
    const entryRelPath = relativePath
      ? `${relativePath}/${entry.name}`
      : entry.name;
    const entryAbsPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const children = await buildFileTree(entryAbsPath, entryRelPath);
      nodes.push({
        name: entry.name,
        path: entryRelPath,
        type: "folder",
        children,
      });
    } else {
      const stat = await fs.stat(entryAbsPath);
      nodes.push({
        name: entry.name,
        path: entryRelPath,
        type: "file",
        size: stat.size,
      });
    }
  }

  return nodes;
}

export async function countFiles(dir: string): Promise<number> {
  let count = 0;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        count += await countFiles(path.join(dir, entry.name));
      } else {
        count++;
      }
    }
  } catch {
    // dir doesn't exist yet
  }
  return count;
}

export async function readFile(projectId: string, filePath: string): Promise<string> {
  const fullPath = path.join(getProjectRoot(projectId), filePath);
  return fs.readFile(fullPath, "utf-8");
}

export async function writeFile(
  projectId: string,
  filePath: string,
  content: string
): Promise<void> {
  const fullPath = path.join(getProjectRoot(projectId), filePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
  // Fire-and-forget GCS persistence – never blocks or fails the local write
  saveFileToGcs(projectId, filePath, content).catch(() => {});
}

export async function deleteFileOrFolder(
  projectId: string,
  filePath: string
): Promise<void> {
  const fullPath = path.join(getProjectRoot(projectId), filePath);
  const stat = await fs.stat(fullPath);
  if (stat.isDirectory()) {
    await fs.rm(fullPath, { recursive: true });
    deleteFolderFromGcs(projectId, filePath).catch(() => {});
  } else {
    await fs.unlink(fullPath);
    deleteFileFromGcs(projectId, filePath).catch(() => {});
  }
}

export async function renameFileOrFolder(
  projectId: string,
  oldPath: string,
  newName: string
): Promise<void> {
  const root = getProjectRoot(projectId);
  const oldFull = path.join(root, oldPath);
  const newFull = path.join(path.dirname(oldFull), newName);
  await fs.rename(oldFull, newFull);

  // Reflect rename in GCS: copy all objects under old prefix to new prefix then delete old
  const newRelPath = path.join(path.dirname(oldPath), newName);
  try {
    const stat = await fs.stat(newFull);
    if (stat.isDirectory()) {
      // Read the renamed directory tree and re-upload each file
      const entries = await collectFiles(newFull, newFull);
      await Promise.all(
        entries.map(async ({ absPath, relInDir }) => {
          const newGcsPath = `${newRelPath}/${relInDir}`;
          const buf = await fs.readFile(absPath);
          await saveFileToGcs(projectId, newGcsPath, buf).catch(() => {});
          await deleteFileFromGcs(projectId, `${oldPath}/${relInDir}`).catch(() => {});
        })
      );
    } else {
      const content = await fs.readFile(newFull, "utf-8");
      await saveFileToGcs(projectId, newRelPath, content).catch(() => {});
      await deleteFileFromGcs(projectId, oldPath).catch(() => {});
    }
  } catch {
    // best effort
  }
}

export async function moveFileOrFolder(
  projectId: string,
  sourcePath: string,
  destinationFolder: string
): Promise<void> {
  const sourceRoot = getProjectRoot(projectId);
  const sourceFull = path.join(sourceRoot, sourcePath);
  const destFull = path.join(sourceRoot, destinationFolder, path.basename(sourcePath));
  await fs.mkdir(path.dirname(destFull), { recursive: true });
  await fs.rename(sourceFull, destFull);

  // Reflect move in GCS
  const newRelPath = path.join(destinationFolder, path.basename(sourcePath));
  try {
    const stat = await fs.stat(destFull);
    if (stat.isDirectory()) {
      const entries = await collectFiles(destFull, destFull);
      await Promise.all(
        entries.map(async ({ absPath, relInDir }) => {
          const buf = await fs.readFile(absPath);
          await saveFileToGcs(projectId, `${newRelPath}/${relInDir}`, buf).catch(() => {});
          await deleteFileFromGcs(projectId, `${sourcePath}/${relInDir}`).catch(() => {});
        })
      );
    } else {
      const content = await fs.readFile(destFull, "utf-8");
      await saveFileToGcs(projectId, newRelPath, content).catch(() => {});
      await deleteFileFromGcs(projectId, sourcePath).catch(() => {});
    }
  } catch {
    // best effort
  }
}

// Helper: walk a directory and return all files with paths relative to baseDir
async function collectFiles(
  dir: string,
  baseDir: string
): Promise<Array<{ absPath: string; relInDir: string }>> {
  const results: Array<{ absPath: string; relInDir: string }> = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(baseDir, abs);
    if (entry.isDirectory()) {
      results.push(...(await collectFiles(abs, baseDir)));
    } else {
      results.push({ absPath: abs, relInDir: rel });
    }
  }
  return results;
}

export async function duplicateFile(
  projectId: string,
  filePath: string
): Promise<void> {
  const root = getProjectRoot(projectId);
  const sourceFull = path.join(root, filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const dir = path.dirname(filePath);

  let destRelPath = path.join(dir, `${base}_copy${ext}`);
  let destFull = path.join(root, destRelPath);
  let counter = 1;
  while (existsSync(destFull)) {
    destRelPath = path.join(dir, `${base}_copy${counter}${ext}`);
    destFull = path.join(root, destRelPath);
    counter++;
  }
  await fs.copyFile(sourceFull, destFull);
  const content = await fs.readFile(destFull, "utf-8").catch(() => null);
  if (content !== null) saveFileToGcs(projectId, destRelPath, content).catch(() => {});
}

export async function createFolder(
  projectId: string,
  folderPath: string
): Promise<void> {
  const fullPath = path.join(getProjectRoot(projectId), folderPath);
  await fs.mkdir(fullPath, { recursive: true });
}

export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".js": "javascript",
    ".mjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".jsx": "javascript",
    ".html": "html",
    ".css": "css",
    ".json": "json",
    ".md": "markdown",
    ".txt": "plaintext",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".xml": "xml",
    ".svg": "xml",
    ".sh": "shell",
    ".py": "python",
  };
  return map[ext] || "plaintext";
}

export async function detectEntryFile(projectId: string): Promise<string | null> {
  const root = getProjectRoot(projectId);
  const candidates = [
    "index.html",
    "src/index.html",
    "public/index.html",
    "main.js",
    "src/main.js",
    "game.js",
    "src/game.js",
  ];
  for (const candidate of candidates) {
    if (existsSync(path.join(root, candidate))) {
      return candidate;
    }
  }
  return null;
}

// Extensions considered binary (skip content search)
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".avif",
  ".mp3", ".mp4", ".wav", ".ogg", ".flac", ".aac",
  ".ttf", ".otf", ".woff", ".woff2",
  ".zip", ".gz", ".tar", ".br",
  ".pdf", ".bin", ".exe", ".wasm",
]);

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".cache", ".vite"]);

export interface SearchMatch {
  line: number;
  text: string;
}

export interface SearchResult {
  path: string;
  name: string;
  matches: SearchMatch[];
}

export async function searchProjectFiles(
  projectId: string,
  query: string,
  maxResults = 50,
): Promise<SearchResult[]> {
  const root = getProjectRoot(projectId);
  if (!existsSync(root)) return [];

  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  async function walk(dir: string, rel: string) {
    if (results.length >= maxResults) return;
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      if (SKIP_DIRS.has(entry.name)) continue;

      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      const entryAbs = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(entryAbs, entryRel);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const nameMatches = entry.name.toLowerCase().includes(q);

        if (BINARY_EXTENSIONS.has(ext)) {
          // Only match by filename for binary/asset files
          if (nameMatches) {
            results.push({ path: entryRel, name: entry.name, matches: [] });
          }
          continue;
        }

        // Skip large files (> 512 KB)
        try {
          const stat = await fs.stat(entryAbs);
          if (stat.size > 512 * 1024) {
            if (nameMatches) results.push({ path: entryRel, name: entry.name, matches: [] });
            continue;
          }
        } catch {
          continue;
        }

        let content: string;
        try {
          content = await fs.readFile(entryAbs, "utf-8");
        } catch {
          if (nameMatches) results.push({ path: entryRel, name: entry.name, matches: [] });
          continue;
        }

        const lines = content.split("\n");
        const matches: SearchMatch[] = [];
        for (let i = 0; i < lines.length && matches.length < 3; i++) {
          if (lines[i].toLowerCase().includes(q)) {
            matches.push({ line: i + 1, text: lines[i].trim().slice(0, 160) });
          }
        }

        if (nameMatches || matches.length > 0) {
          results.push({ path: entryRel, name: entry.name, matches });
        }
      }
    }
  }

  await walk(root, "");
  return results;
}

export async function copyProjectFiles(
  sourceId: string,
  destId: string
): Promise<void> {
  const src = getProjectRoot(sourceId);
  const dest = getProjectRoot(destId);
  await fs.mkdir(dest, { recursive: true });

  async function copyRecursive(from: string, to: string) {
    const stat = await fs.stat(from).catch(() => null);
    if (!stat) return;
    if (stat.isDirectory()) {
      await fs.mkdir(to, { recursive: true });
      const entries = await fs.readdir(from);
      for (const entry of entries) {
        await copyRecursive(path.join(from, entry), path.join(to, entry));
      }
    } else {
      await fs.copyFile(from, to);
    }
  }

  if (existsSync(src)) {
    await copyRecursive(src, dest);
  }
}
