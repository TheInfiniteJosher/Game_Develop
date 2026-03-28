import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import path from "path";
import { getProjectRoot, detectEntryFile } from "./services/filesystem.js";
import {
  getProjectDistRoot,
  isViteProject,
  getViteStatus,
  buildViteProject,
} from "./services/vite-manager.js";
import { existsSync } from "fs";
import fs from "fs/promises";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const CONSOLE_INJECT_SCRIPT = `<script>
(function() {
  var _log = console.log, _error = console.error, _warn = console.warn;
  function send(type, args) {
    try {
      window.parent.postMessage({ type: 'console', level: type, message: Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
    } catch(e) {}
  }
  console.log = function() { _log.apply(console, arguments); send('log', arguments); };
  console.error = function() { _error.apply(console, arguments); send('error', arguments); };
  console.warn = function() { _warn.apply(console, arguments); send('warn', arguments); };
  window.addEventListener('error', function(e) {
    send('error', [e.message + (e.filename ? ' at ' + e.filename + ':' + e.lineno : '')]);
  });
  window.addEventListener('unhandledrejection', function(e) {
    send('error', ['Unhandled Promise: ' + (e.reason?.message || e.reason)]);
  });

  // Phaser 3 active scene detector
  var _lastScene = null;
  var _foundGame = null;
  function isGame(v) {
    return v && typeof v === 'object' && v.scene && typeof v.scene.getScenes === 'function';
  }
  function findPhaserGame() {
    if (_foundGame) return _foundGame;
    // 1. Game exposed by our module-tracker script (most reliable for ESM/Vite projects)
    if (isGame(window.__phaserGame)) { _foundGame = window.__phaserGame; return _foundGame; }
    // 2. Common naming conventions
    var candidates = [window.game, window.Game, window.phaserGame, window.phaser];
    for (var i = 0; i < candidates.length; i++) {
      if (isGame(candidates[i])) { _foundGame = candidates[i]; return _foundGame; }
    }
    // 3. Duck-type scan of all window properties (fallback)
    try {
      var keys = Object.keys(window);
      for (var j = 0; j < keys.length; j++) {
        try {
          var v = window[keys[j]];
          if (isGame(v)) { _foundGame = v; return _foundGame; }
        } catch(e) {}
      }
    } catch(e) {}
    return null;
  }
  setInterval(function() {
    try {
      var game = findPhaserGame();
      if (!game) return;
      var scenes = game.scene.getScenes(true);
      if (!scenes || !scenes.length) return;
      var key = scenes.map(function(s) { return s.scene && s.scene.key; }).filter(Boolean).join(' + ');
      if (key && key !== _lastScene) {
        _lastScene = key;
        window.parent.postMessage({ type: 'phaser-scene', scene: key }, '*');
      }
    } catch(e) {}
  }, 500);
})();
</script>`;

// Inject a tiny module script that re-imports the main bundle (cached, no re-execution)
// and exposes its default export (the Phaser.Game instance) as window.__phaserGame.
// This is necessary for ESM/Vite projects where the game is stored as a module export,
// not a window property.
function buildModuleTrackerScript(html: string): string {
  const match = html.match(/<script\s[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/i)
    ?? html.match(/<script\s[^>]*src=["']([^"']+)["'][^>]*type=["']module["'][^>]*>/i);
  if (!match) return "";
  const src = match[1];
  return `\n<script type="module">import("${src}").then(function(m){try{var g=m&&m.default;if(g&&g.scene&&typeof g.scene.getScenes==='function')window.__phaserGame=g;}catch(e){}});</script>`;
}

function injectConsoleScript(html: string): string {
  const tracker = buildModuleTrackerScript(html);
  const withTracker = tracker ? html.replace("</body>", tracker + "\n</body>") : html;
  if (withTracker.includes("<head>")) return withTracker.replace("<head>", "<head>" + CONSOLE_INJECT_SCRIPT);
  if (withTracker.includes("<html")) return withTracker.replace(/<html[^>]*>/, (m) => m + CONSOLE_INJECT_SCRIPT);
  return CONSOLE_INJECT_SCRIPT + withTracker;
}

// Build status HTML page shown while vite is compiling or has errored
function buildingPage(status: string, logs: string[], startedAt?: number): string {
  const isError = status === "error";
  const isInstalling = status === "installing";
  const logText = logs.slice(-50).join("\n");
  const startMs = startedAt ?? Date.now();

  const stepsHtml = !isError ? `
    <div class="steps">
      <div class="step ${isInstalling ? "active" : "done"}">
        <span class="dot"></span>1. Installing dependencies
      </div>
      <div class="step ${!isInstalling ? "active" : ""}">
        <span class="dot"></span>2. Building with Vite
      </div>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isError ? "Build Failed" : "Building Preview…"}</title>
  <style>
    body { margin: 0; background: #0d1117; color: #c9d1d9; font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; box-sizing: border-box; gap: 12px; }
    h2 { color: ${isError ? "#f85149" : "#58a6ff"}; margin: 0; }
    .timer { color: #8b949e; font-size: 13px; }
    .steps { display: flex; flex-direction: column; gap: 6px; width: 100%; max-width: 700px; }
    .step { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #8b949e; }
    .step.active { color: #58a6ff; }
    .step.done { color: #3fb950; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
    .step.active .dot { animation: pulse 1s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
    pre { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 16px; width: 100%; max-width: 700px; overflow: auto; font-size: 12px; white-space: pre-wrap; word-break: break-all; max-height: 55vh; margin: 0; }
    .spinner { border: 3px solid #30363d; border-top-color: #58a6ff; border-radius: 50%; width: 28px; height: 28px; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
  ${!isError ? `<script>
    var startMs = ${startMs};
    function tick() {
      var s = Math.floor((Date.now() - startMs) / 1000);
      var el = document.getElementById('elapsed');
      if (el) el.textContent = s + 's elapsed';
    }
    tick();
    setInterval(tick, 1000);
    setTimeout(function(){ location.reload(); }, 1500);
  </script>` : ""}
</head>
<body>
  ${isError ? "" : `<div class="spinner"></div>`}
  <h2>${isError ? "❌ Build Failed" : "🔨 Building preview…"}</h2>
  ${!isError ? `<div class="timer" id="elapsed">0s elapsed</div>` : ""}
  ${stepsHtml}
  <pre>${logText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</body>
</html>`;
}

// Serve game project files for preview
// For Vite projects: ONLY serve from dist/. If dist isn't ready, show a build status page.
// For non-Vite projects: serve raw source files.
// Route: /api/preview/:projectId/*
app.use("/api/preview/:projectId", async (req, res, next) => {
  const { projectId } = req.params;
  const projectRoot = getProjectRoot(projectId);
  const distRoot = getProjectDistRoot(projectId);

  if (!existsSync(projectRoot)) {
    return res.status(404).send("Project not found");
  }

  const isVite = isViteProject(projectId);
  const hasViteDist = existsSync(path.join(distRoot, "index.html"));

  // If this is a Vite project without a completed dist, show build status page
  if (isVite && !hasViteDist) {
    const { status, logs, startedAt } = getViteStatus(projectId);
    // If idle (e.g. server restarted), kick off the build automatically
    if (status === "idle") {
      buildViteProject(projectId).catch(() => {});
    }
    return res.setHeader("Content-Type", "text/html").send(buildingPage(status, logs, startedAt));
  }

  const serveRoot = hasViteDist ? distRoot : projectRoot;
  const filePath = req.path === "/" ? "" : req.path.replace(/^\//, "");

  const entry = hasViteDist
    ? (filePath || "index.html")
    : (filePath || await detectEntryFile(projectId) || "index.html");

  const fullPath = path.join(serveRoot, entry);

  if (!existsSync(fullPath)) {
    // Auto-generate index.html if non-Vite project only has JS
    if (!hasViteDist && (!filePath || filePath === "index.html")) {
      const mainJs = ["main.js", "src/main.js", "game.js", "src/game.js"].find(
        (f) => existsSync(path.join(projectRoot, f))
      );
      if (mainJs) {
        const autoHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Game Preview</title>
  <style>body { margin: 0; background: #000; }</style>
</head>
<body>
  <script type="module" src="./${mainJs}"></script>
</body>
</html>`;
        return res.setHeader("Content-Type", "text/html").send(injectConsoleScript(autoHtml));
      }
    }
    return next();
  }

  // Inject console capture for HTML files (always no-cache so injection updates are seen)
  if (entry.endsWith(".html") || entry.endsWith(".htm")) {
    try {
      const html = await fs.readFile(fullPath, "utf-8");
      return res
        .setHeader("Content-Type", "text/html")
        .setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
        .send(injectConsoleScript(html));
    } catch {
      // Fall through to static serving
    }
  }

  next();
});

// Static file serving for projects (dist takes priority over raw files)
app.use("/api/preview/:projectId", (req, res, next) => {
  const { projectId } = req.params;
  const distRoot = getProjectDistRoot(projectId);
  const hasViteDist = existsSync(path.join(distRoot, "index.html"));
  const serveRoot = hasViteDist ? distRoot : getProjectRoot(projectId);
  express.static(serveRoot)(req, res, next);
});

app.use("/api", router);

export default app;
