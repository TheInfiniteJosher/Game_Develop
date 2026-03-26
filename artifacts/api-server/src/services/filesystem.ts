import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";

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
}

export async function deleteFileOrFolder(
  projectId: string,
  filePath: string
): Promise<void> {
  const fullPath = path.join(getProjectRoot(projectId), filePath);
  const stat = await fs.stat(fullPath);
  if (stat.isDirectory()) {
    await fs.rm(fullPath, { recursive: true });
  } else {
    await fs.unlink(fullPath);
  }
}

export async function renameFileOrFolder(
  projectId: string,
  oldPath: string,
  newName: string
): Promise<void> {
  const oldFull = path.join(getProjectRoot(projectId), oldPath);
  const newFull = path.join(path.dirname(oldFull), newName);
  await fs.rename(oldFull, newFull);
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
