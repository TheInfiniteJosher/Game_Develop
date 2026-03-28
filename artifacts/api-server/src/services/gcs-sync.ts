/**
 * gcs-sync.ts
 *
 * Keeps project files durable across deployments by mirroring every write to
 * Google Cloud Storage.  On server startup all objects are restored from GCS
 * back to the local /tmp filesystem so the rest of the codebase can keep
 * using normal filesystem calls.
 *
 * Key layout: projects/{projectId}/{relativeFilePath}
 */

import { Storage, type Bucket } from "@google-cloud/storage";
import path from "path";
import fs from "fs/promises";
import { logger } from "../lib/logger.js";
import { getProjectRoot } from "./filesystem.js";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
const REPLIT_SIDECAR = "http://127.0.0.1:1106";

let _bucket: Bucket | null = null;

function getBucket(): Bucket | null {
  if (!BUCKET_ID) return null;
  if (!_bucket) {
    // Use Replit's sidecar for GCS authentication (works in both dev and production)
    _bucket = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR}/credential`,
          format: { type: "json", subject_token_field_name: "access_token" },
        },
        universe_domain: "googleapis.com",
      } as Parameters<typeof Storage>[0]["credentials"],
      projectId: "",
    }).bucket(BUCKET_ID);
  }
  return _bucket;
}

function gcsKey(projectId: string, relPath: string): string {
  return `projects/${projectId}/${relPath}`;
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".json": "application/json",
    ".css": "text/css",
    ".txt": "text/plain",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".flac": "audio/flac",
  };
  return map[ext] ?? "application/octet-stream";
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function saveFileToGcs(
  projectId: string,
  relPath: string,
  content: string | Buffer
): Promise<void> {
  const bucket = getBucket();
  if (!bucket) return;
  try {
    await bucket.file(gcsKey(projectId, relPath)).save(content, {
      contentType: contentTypeFor(relPath),
      resumable: false,
    });
  } catch (err) {
    logger.warn({ err, projectId, relPath }, "GCS save failed (non-fatal)");
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteFileFromGcs(
  projectId: string,
  relPath: string
): Promise<void> {
  const bucket = getBucket();
  if (!bucket) return;
  try {
    await bucket.file(gcsKey(projectId, relPath)).delete({ ignoreNotFound: true });
  } catch (err) {
    logger.warn({ err, projectId, relPath }, "GCS delete failed (non-fatal)");
  }
}

export async function deleteFolderFromGcs(
  projectId: string,
  relPath: string
): Promise<void> {
  const bucket = getBucket();
  if (!bucket) return;
  try {
    const prefix = `projects/${projectId}/${relPath}/`;
    const [files] = await bucket.getFiles({ prefix });
    await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })));
  } catch (err) {
    logger.warn({ err, projectId, relPath }, "GCS folder delete failed (non-fatal)");
  }
}

export async function deleteProjectFromGcs(projectId: string): Promise<void> {
  const bucket = getBucket();
  if (!bucket) return;
  try {
    const [files] = await bucket.getFiles({ prefix: `projects/${projectId}/` });
    await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })));
  } catch (err) {
    logger.warn({ err, projectId }, "GCS project delete failed (non-fatal)");
  }
}

// ── Startup restore ───────────────────────────────────────────────────────────

/**
 * Called once at server startup.  Downloads every stored project file from GCS
 * back into /tmp so the rest of the server can work with normal fs calls.
 */
export async function restoreAllProjectsFromGcs(): Promise<void> {
  const bucket = getBucket();
  if (!bucket) {
    logger.info("GCS not configured – skipping project restore");
    return;
  }

  try {
    const [files] = await bucket.getFiles({ prefix: "projects/" });
    if (files.length === 0) {
      logger.info("GCS: no stored project files found");
      return;
    }

    await Promise.all(
      files.map(async (file) => {
        // key: projects/{projectId}/{relPath}
        const rest = file.name.slice("projects/".length); // "{projectId}/{relPath}"
        const slashIdx = rest.indexOf("/");
        if (slashIdx === -1) return; // bare "projects/{id}" marker – skip
        const projectId = rest.slice(0, slashIdx);
        const relPath = rest.slice(slashIdx + 1);
        if (!relPath) return;

        const localPath = path.join(getProjectRoot(projectId), relPath);
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        const [content] = await file.download();
        await fs.writeFile(localPath, content);
      })
    );

    logger.info({ count: files.length }, "GCS: project files restored");
  } catch (err) {
    logger.error({ err }, "GCS restore failed – projects may be empty this run");
  }
}
