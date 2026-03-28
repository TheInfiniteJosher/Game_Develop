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
  isRebuilding?: boolean; // true when a dist already existed before this build started
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

export function getViteStatus(projectId: string): { status: ViteStatus; logs: string[]; startedAt?: number; isRebuilding?: boolean } {
  const state = states.get(projectId);
  if (!state) {
    if (existsSync(path.join(getProjectDistRoot(projectId), "index.html"))) {
      return { status: "ready", logs: ["Build output found from previous session."] };
    }
    return { status: "idle", logs: [] };
  }
  return { status: state.status, logs: [...state.logs], startedAt: state.startedAt, isRebuilding: state.isRebuilding };
}

// ---------------------------------------------------------------------------
// Build orchestration
// ---------------------------------------------------------------------------
// Debounced per-project rebuild scheduler
const rebuildTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleRebuild(projectId: string, delayMs = 1500): void {
  if (!isViteProject(projectId)) return;
  // Cancel any pending rebuild timer
  const prev = rebuildTimers.get(projectId);
  if (prev) clearTimeout(prev);
  const timer = setTimeout(() => {
    rebuildTimers.delete(projectId);
    buildViteProject(projectId).catch(() => {});
  }, delayMs);
  rebuildTimers.set(projectId, timer);
}

export async function buildViteProject(projectId: string): Promise<void> {
  const root = getProjectFilesRoot(projectId);
  const distDir = getProjectDistRoot(projectId);
  // Build into a sibling temp dir so the existing dist stays live while building.
  // On success we atomically swap; on failure we clean up and leave the old dist.
  const tempDir = `${distDir}-building`;

  const existing = states.get(projectId);
  if (existing?.status === "installing" || existing?.status === "building") return;

  // If there's already a good dist, mark this as a hot-rebuild so the UI keeps
  // showing the old preview with just a progress indicator instead of a blank page.
  const isRebuilding = existsSync(path.join(distDir, "index.html"));

  const state: ViteState = { status: "installing", logs: [], startedAt: Date.now(), isRebuilding };
  states.set(projectId, state);

  const addLog = (line: string) => {
    state.logs.push(line);
    if (state.logs.length > 300) state.logs.shift();
  };

  try {
    // Clean any leftover temp dir from a previous failed build
    await fs.rm(tempDir, { recursive: true, force: true });

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

    // Build into the temp dir — old dist remains accessible for the preview
    await runCommand(
      process.execPath,
      [SERVER_VITE.bin, "build", "--outDir", tempDir, "--base", "./", "--logLevel", "info"],
      root,
      addLog,
    );

    // Post-process built JS: expose the Phaser.Game instance on window
    await patchPhaserGameExport(tempDir, addLog);

    // Atomically swap: remove old dist, rename temp into place
    await fs.rm(distDir, { recursive: true, force: true });
    await fs.rename(tempDir, distDir);

    state.status = "ready";
    addLog("✅ Build complete! Preview is ready.");
  } catch (err) {
    // Clean up the temp dir on failure; old dist (if any) is untouched
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    state.status = "error";
    state.error = String(err);
    addLog(`❌ Build failed: ${String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Post-build patching
// ---------------------------------------------------------------------------

// Scan the built JS assets for the Phaser.Game constructor call and prefix it
// with a window assignment so the scene-detection script can locate the game
// instance even in fully-minified ESM bundles where the variable is local.
// Pattern matched: new X.Game(...)  →  window.__phaserGame=new X.Game(...)
async function patchPhaserGameExport(distDir: string, addLog: (line: string) => void): Promise<void> {
  try {
    const assetsDir = path.join(distDir, "assets");
    const files = await fs.readdir(assetsDir).catch(() => [] as string[]);
    const jsFiles = files.filter((f) => f.endsWith(".js"));

    for (const jsFile of jsFiles) {
      const filePath = path.join(assetsDir, jsFile);
      const content = await fs.readFile(filePath, "utf-8");
      // Match the Phaser.Game constructor (any minified variable name)
      // e.g.  new j.Game(cfg)  or  new Phaser.Game(config)
      const patched = content.replace(
        /\bnew ([A-Za-z$_][A-Za-z0-9$_]*)\.Game\(/g,
        "window.__phaserGame=new $1.Game(",
      );
      if (patched !== content) {
        await fs.writeFile(filePath, patched, "utf-8");
        addLog("🎮 Patched bundle for scene detection.");
      }
    }
  } catch {
    // Non-fatal – scene detection just won't work if patching fails
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
