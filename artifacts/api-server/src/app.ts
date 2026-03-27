import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import path from "path";
import { getProjectRoot, detectEntryFile, buildFileTree } from "./services/filesystem.js";
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

// Serve game project files for preview
// Route: /api/preview/:projectId/*
app.use("/api/preview/:projectId", async (req, res, next) => {
  const { projectId } = req.params;
  const projectRoot = getProjectRoot(projectId);

  if (!existsSync(projectRoot)) {
    return res.status(404).send("Project not found");
  }

  // Inject error capture script into HTML files
  const filePath = req.path === "/" ? "" : req.path.replace(/^\//, "");
  const entry = filePath || await detectEntryFile(projectId) || "index.html";
  const fullPath = path.join(projectRoot, entry);

  if (!existsSync(fullPath)) {
    // Auto-generate index.html if project only has JS
    if (!filePath || filePath === "index.html") {
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
  <script type="module" src="/${projectId}/${mainJs}"></script>
</body>
</html>`;
        return res.setHeader("Content-Type", "text/html").send(autoHtml);
      }
    }
    return next();
  }

  // Inject console capture for HTML files
  if (entry.endsWith(".html") || entry.endsWith(".htm")) {
    try {
      let html = await fs.readFile(fullPath, "utf-8");
      const injectScript = `
<script>
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
      // Inject after <head> or <html>
      if (html.includes("<head>")) {
        html = html.replace("<head>", "<head>" + injectScript);
      } else if (html.includes("<html")) {
        html = html.replace(/<html[^>]*>/, (m) => m + injectScript);
      } else {
        html = injectScript + html;
      }
      return res.setHeader("Content-Type", "text/html").send(html);
    } catch {
      // Fall through to static serving
    }
  }

  next();
});

// Static file serving for projects
const STORAGE_ROOT = process.env.PROJECTS_STORAGE || "/tmp/game-ide-projects";
app.use("/api/preview/:projectId", (req, res, next) => {
  const { projectId } = req.params;
  const projectRoot = path.join(STORAGE_ROOT, projectId, "files");
  express.static(projectRoot)(req, res, next);
});

app.use("/api", router);

export default app;
