import { spawn } from "child_process";
import { createRequire } from "module";
import path from "path";
import { existsSync } from "fs";
import fs from "fs/promises";

// ---------------------------------------------------------------------------
// Server-bundled vite resolution
// ---------------------------------------------------------------------------
// vite is a dependency of this API server, so it is always present in
// production without any runtime npm installs.
// We resolve its path once at startup using createRequire so we can:
//   1. Invoke vite/bin/vite.js directly (avoids .bin/ symlink issues)
//   2. Pass NODE_PATH pointing at the pnpm virtual-store dir that holds vite
//      AND all of vite's own dependencies. This lets vite find 'vite' when
//      it compiles the user's vite.config.js into a temp ESM file.

const _require = createRequire(import.meta.url);

function resolveServerVite(): { bin: string; dir: string } {
  // e.g. .../node_modules/.pnpm/vite@6.x.y_.../node_modules/vite/package.json
  const vitePkg = _require.resolve("vite/package.json");
  const viteDir = path.dirname(vitePkg);  // actual vite package dir
  return {
    bin: path.join(viteDir, "bin", "vite.js"),
    dir: viteDir,
  };
}

const SERVER_VITE = resolveServerVite();

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------
const STORAGE_ROOT = process.env.PROJECTS_STORAGE || "/tmp/game-ide-projects";

export type ViteStatus = "idle" | "installing" | "building" | "ready" | "error";

interface ViteState {
  status: ViteStatus;
  logs: string[];
  error?: string;
  startedAt?: number;
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

export function getViteStatus(projectId: string): { status: ViteStatus; logs: string[]; startedAt?: number } {
  const state = states.get(projectId);
  if (!state) {
    if (existsSync(path.join(getProjectDistRoot(projectId), "index.html"))) {
      return { status: "ready", logs: ["Build output found from previous session."] };
    }
    return { status: "idle", logs: [] };
  }
  return { status: state.status, logs: [...state.logs], startedAt: state.startedAt };
}

// ---------------------------------------------------------------------------
// Build orchestration
// ---------------------------------------------------------------------------
export async function buildViteProject(projectId: string): Promise<void> {
  const root = getProjectFilesRoot(projectId);
  const distDir = getProjectDistRoot(projectId);

  const existing = states.get(projectId);
  if (existing?.status === "installing" || existing?.status === "building") return;

  const state: ViteState = { status: "installing", logs: [], startedAt: Date.now() };
  states.set(projectId, state);

  const addLog = (line: string) => {
    state.logs.push(line);
    if (state.logs.length > 300) state.logs.shift();
  };

  try {
    await fs.rm(distDir, { recursive: true, force: true });

    // Skip npm install if node_modules already exists and package.json hasn't
    // changed since the last install (compare mtimes). This makes rebuilds fast.
    const nodeModulesDir = path.join(root, "node_modules");
    const nmStat = await fs.stat(nodeModulesDir).catch(() => null);
    const pkgStat = await fs.stat(path.join(root, "package.json")).catch(() => null);
    const needsInstall = !nmStat || !pkgStat || pkgStat.mtimeMs > nmStat.mtimeMs;

    if (needsInstall) {
      addLog("📦 Running npm install...");
      await runCommand(
        "npm",
        ["install", "--prefer-offline", "--no-audit", "--no-fund"],
        root,
        addLog,
      );
    } else {
      addLog("📦 Dependencies up to date, skipping npm install.");
    }

    // Symlink the server's vite into the user's node_modules so that when vite
    // compiles vite.config.js into a temp ESM file and that file does
    // `import { defineConfig } from 'vite'`, Node.js ESM resolution finds it.
    // NODE_PATH is NOT supported for ESM, so a real node_modules entry is needed.
    const userNodeModules = path.join(root, "node_modules");
    const userViteLink = path.join(userNodeModules, "vite");
    if (!existsSync(userViteLink)) {
      await fs.mkdir(userNodeModules, { recursive: true });
      await fs.symlink(SERVER_VITE.dir, userViteLink, "dir");
    }

    state.status = "building";
    addLog("🔨 Running vite build...");

    // Run the server's vite directly via node to avoid .bin/ symlink issues.
    await runCommand(
      process.execPath,
      [SERVER_VITE.bin, "build", "--outDir", distDir, "--base", "./", "--logLevel", "info"],
      root,
      addLog,
    );

    state.status = "ready";
    addLog("✅ Build complete! Preview is ready.");
  } catch (err) {
    state.status = "error";
    state.error = String(err);
    addLog(`❌ Build failed: ${String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Process helpers
// ---------------------------------------------------------------------------
function buildEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const nodeDir = path.dirname(process.execPath);
  const basePath = process.env.PATH ?? "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
  const pathParts = basePath.split(":").filter(Boolean);
  if (!pathParts.includes(nodeDir)) pathParts.unshift(nodeDir);
  return { ...process.env, PATH: pathParts.join(":"), ...extra };
}

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  onLog: (line: string) => void,
  extraEnv?: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd,
      shell: false,
      env: buildEnv(extraEnv),
    });

    proc.stdout?.on("data", (data: Buffer) => {
      data.toString().split("\n").filter((l) => l.trim()).forEach(onLog);
    });

    proc.stderr?.on("data", (data: Buffer) => {
      data.toString().split("\n").filter((l) => l.trim()).forEach(onLog);
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
