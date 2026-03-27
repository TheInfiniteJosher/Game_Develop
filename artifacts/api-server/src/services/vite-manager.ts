import { spawn } from "child_process";
import path from "path";
import { existsSync } from "fs";
import fs from "fs/promises";

const STORAGE_ROOT = process.env.PROJECTS_STORAGE || "/tmp/game-ide-projects";

export type ViteStatus = "idle" | "installing" | "building" | "ready" | "error";

interface ViteState {
  status: ViteStatus;
  logs: string[];
  error?: string;
}

const states = new Map<string, ViteState>();

export function getProjectFilesRoot(projectId: string): string {
  return path.join(STORAGE_ROOT, projectId, "files");
}

export function getProjectDistRoot(projectId: string): string {
  return path.join(STORAGE_ROOT, projectId, "dist");
}

export function isViteProject(projectId: string): boolean {
  const root = getProjectFilesRoot(projectId);
  const hasPackageJson = existsSync(path.join(root, "package.json"));
  const hasViteConfig =
    existsSync(path.join(root, "vite.config.js")) ||
    existsSync(path.join(root, "vite.config.ts")) ||
    existsSync(path.join(root, "vite.config.mjs")) ||
    existsSync(path.join(root, "vite.config.cjs"));
  return hasPackageJson && hasViteConfig;
}

export function getViteStatus(projectId: string): { status: ViteStatus; logs: string[] } {
  const state = states.get(projectId);
  if (!state) {
    // Check if dist already exists from a previous session
    if (existsSync(getProjectDistRoot(projectId))) {
      return { status: "ready", logs: ["Build output found from previous session."] };
    }
    return { status: "idle", logs: [] };
  }
  return { status: state.status, logs: [...state.logs] };
}

export async function buildViteProject(projectId: string): Promise<void> {
  const root = getProjectFilesRoot(projectId);
  const distDir = getProjectDistRoot(projectId);

  const existing = states.get(projectId);
  if (existing?.status === "installing" || existing?.status === "building") {
    return; // Already in progress
  }

  const state: ViteState = { status: "installing", logs: [] };
  states.set(projectId, state);

  const addLog = (line: string) => {
    state.logs.push(line);
    if (state.logs.length > 300) state.logs.shift();
  };

  try {
    // Clean previous dist
    await fs.rm(distDir, { recursive: true, force: true });

    addLog("📦 Running npm install...");
    await runCommand("npm", ["install", "--prefer-offline"], root, addLog);

    state.status = "building";
    addLog("🔨 Running vite build...");
    await runCommand(
      "npx",
      ["vite", "build", "--outDir", distDir, "--base", "./", "--logLevel", "info"],
      root,
      addLog
    );

    state.status = "ready";
    addLog("✅ Build complete! Preview is ready.");
  } catch (err) {
    state.status = "error";
    state.error = String(err);
    addLog(`❌ Build failed: ${String(err)}`);
  }
}

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  onLog: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, shell: true });

    proc.stdout?.on("data", (data: Buffer) => {
      data
        .toString()
        .split("\n")
        .filter((l) => l.trim())
        .forEach(onLog);
    });

    proc.stderr?.on("data", (data: Buffer) => {
      data
        .toString()
        .split("\n")
        .filter((l) => l.trim())
        .forEach(onLog);
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Process exited with code ${code}`));
    });

    proc.on("error", reject);
  });
}
