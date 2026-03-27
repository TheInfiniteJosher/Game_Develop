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
})();
</script>`;

function injectConsoleScript(html: string): string {
  if (html.includes("<head>")) return html.replace("<head>", "<head>" + CONSOLE_INJECT_SCRIPT);
  if (html.includes("<html")) return html.replace(/<html[^>]*>/, (m) => m + CONSOLE_INJECT_SCRIPT);
  return CONSOLE_INJECT_SCRIPT + html;
}

// Build status HTML page shown while vite is compiling or has errored
function buildingPage(status: string, logs: string[]): string {
  const isError = status === "error";
  const logText = logs.slice(-40).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isError ? "Build Failed" : "Building Preview…"}</title>
  <style>
    body { margin: 0; background: #0d1117; color: #c9d1d9; font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
    h2 { color: ${isError ? "#f85149" : "#58a6ff"}; margin-bottom: 12px; }
    pre { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 16px; width: 100%; max-width: 700px; overflow: auto; font-size: 12px; white-space: pre-wrap; word-break: break-all; max-height: 60vh; }
    .spinner { border: 3px solid #30363d; border-top-color: #58a6ff; border-radius: 50%; width: 32px; height: 32px; animation: spin 0.8s linear infinite; margin-bottom: 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
  ${!isError ? `<script>setTimeout(()=>location.reload(),2500)</script>` : ""}
</head>
<body>
  ${isError ? "" : `<div class="spinner"></div>`}
  <h2>${isError ? "❌ Build Failed" : "🔨 Building preview…"}</h2>
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
    const { status, logs } = getViteStatus(projectId);
    // If idle (e.g. server restarted), kick off the build automatically
    if (status === "idle") {
      buildViteProject(projectId).catch(() => {});
    }
    return res.setHeader("Content-Type", "text/html").send(buildingPage(status, logs));
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

  // Inject console capture for HTML files
  if (entry.endsWith(".html") || entry.endsWith(".htm")) {
    try {
      const html = await fs.readFile(fullPath, "utf-8");
      return res.setHeader("Content-Type", "text/html").send(injectConsoleScript(html));
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
