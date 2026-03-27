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

// Build a reliable PATH that includes the directory containing the current
// node/npm binaries. This ensures child processes can find npm and npx in
// both dev and production environments.
function buildEnv(): NodeJS.ProcessEnv {
  const nodeDir = path.dirname(process.execPath);
  const basePath = process.env.PATH ?? "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
  const pathParts = basePath.split(":").filter(Boolean);
  if (!pathParts.includes(nodeDir)) pathParts.unshift(nodeDir);
  return { ...process.env, PATH: pathParts.join(":") };
}

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
    if (existsSync(path.join(getProjectDistRoot(projectId), "index.html"))) {
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
    return;
  }

  const state: ViteState = { status: "installing", logs: [] };
  states.set(projectId, state);

  const addLog = (line: string) => {
    state.logs.push(line);
    if (state.logs.length > 300) state.logs.shift();
  };

  try {
    await fs.rm(distDir, { recursive: true, force: true });

    addLog("📦 Running npm install...");
    await runCommand("npm", ["install", "--prefer-offline", "--no-audit", "--no-fund"], root, addLog);

    state.status = "building";
    addLog("🔨 Running vite build...");

    // Prefer the locally installed vite binary over npx for reliability
    const localVite = path.join(root, "node_modules", ".bin", "vite");
    const viteCmd = existsSync(localVite) ? localVite : "npx";
    const viteArgs = existsSync(localVite)
      ? ["build", "--outDir", distDir, "--base", "./", "--logLevel", "info"]
      : ["vite", "build", "--outDir", distDir, "--base", "./", "--logLevel", "info"];

    await runCommand(viteCmd, viteArgs, root, addLog);

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
    const proc = spawn(cmd, args, {
      cwd,
      shell: false,
      env: buildEnv(),
    });

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

    proc.on("error", (err) => {
      onLog(`Spawn error: ${err.message}`);
      reject(err);
    });
  });
}
