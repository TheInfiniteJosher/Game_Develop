import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, fileChangesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import multer from "multer";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import {
  buildFileTree,
  readFile,
  writeFile,
  deleteFileOrFolder,
  renameFileOrFolder,
  moveFileOrFolder,
  duplicateFile,
  createFolder,
  detectLanguage,
  detectEntryFile,
  getProjectRoot,
  countFiles,
} from "../services/filesystem.js";
import { nanoid } from "../lib/nanoid.js";

const router: IRouter = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

async function updateProjectStats(projectId: string) {
  const root = getProjectRoot(projectId);
  const fileCount = await countFiles(root);
  const entryFile = await detectEntryFile(projectId);
  await db
    .update(projectsTable)
    .set({ fileCount, entryFile: entryFile || null, updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId));
}

// List files as tree
router.get("/files", async (req, res) => {
  try {
    const root = getProjectRoot(req.params.id);
    if (!existsSync(root)) {
      return res.json([]);
    }
    const tree = await buildFileTree(root);
    res.json(tree);
  } catch (err) {
    req.log.error({ err }, "Failed to list files");
    res.status(500).json({ error: "Failed to list files" });
  }
});

// Read file content
router.get("/files/read", async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: "path is required" });
    const content = await readFile(req.params.id, filePath);
    res.json({ path: filePath, content, language: detectLanguage(filePath) });
  } catch (err) {
    req.log.error({ err }, "Failed to read file");
    res.status(500).json({ error: "Failed to read file" });
  }
});

// Write file content
router.post("/files/write", async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ error: "path is required" });

    // Save previous version for change history
    let previousContent: string | undefined;
    try {
      previousContent = await readFile(req.params.id, filePath);
    } catch { /* new file */ }

    await writeFile(req.params.id, filePath, content);

    // Record change
    await db.insert(fileChangesTable).values({
      id: nanoid(),
      projectId: req.params.id,
      filePath,
      previousContent: previousContent ?? null,
      newContent: content,
      description: "Manual edit",
    });

    await updateProjectStats(req.params.id);
    res.json({ success: true, message: "File written" });
  } catch (err) {
    req.log.error({ err }, "Failed to write file");
    res.status(500).json({ error: "Failed to write file" });
  }
});

// Create folder
router.post("/files/create-folder", async (req, res) => {
  try {
    const { path: folderPath } = req.body;
    if (!folderPath) return res.status(400).json({ error: "path is required" });
    await createFolder(req.params.id, folderPath);
    res.json({ success: true, message: "Folder created" });
  } catch (err) {
    req.log.error({ err }, "Failed to create folder");
    res.status(500).json({ error: "Failed to create folder" });
  }
});

// Rename file or folder
router.post("/files/rename", async (req, res) => {
  try {
    const { oldPath, newName } = req.body;
    if (!oldPath || !newName) return res.status(400).json({ error: "oldPath and newName required" });
    await renameFileOrFolder(req.params.id, oldPath, newName);
    await updateProjectStats(req.params.id);
    res.json({ success: true, message: "Renamed" });
  } catch (err) {
    req.log.error({ err }, "Failed to rename");
    res.status(500).json({ error: "Failed to rename" });
  }
});

// Move file or folder
router.post("/files/move", async (req, res) => {
  try {
    const { sourcePath, destinationFolder } = req.body;
    if (!sourcePath || destinationFolder === undefined) {
      return res.status(400).json({ error: "sourcePath and destinationFolder required" });
    }
    await moveFileOrFolder(req.params.id, sourcePath, destinationFolder);
    await updateProjectStats(req.params.id);
    res.json({ success: true, message: "Moved" });
  } catch (err) {
    req.log.error({ err }, "Failed to move");
    res.status(500).json({ error: "Failed to move" });
  }
});

// Delete file or folder
router.delete("/files/delete", async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: "path required" });
    await deleteFileOrFolder(req.params.id, filePath);
    await updateProjectStats(req.params.id);
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete");
    res.status(500).json({ error: "Failed to delete" });
  }
});

// Duplicate file
router.post("/files/duplicate", async (req, res) => {
  try {
    const { path: filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: "path required" });
    await duplicateFile(req.params.id, filePath);
    await updateProjectStats(req.params.id);
    res.json({ success: true, message: "Duplicated" });
  } catch (err) {
    req.log.error({ err }, "Failed to duplicate");
    res.status(500).json({ error: "Failed to duplicate" });
  }
});

// Upload files (multipart)
router.post("/upload", upload.array("files"), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const paths = Array.isArray(req.body.paths) ? req.body.paths : [req.body.paths];
    const overwrite = req.body.overwrite === "true" || req.body.overwrite === true;

    const uploaded: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = paths[i] || file.originalname;

      try {
        const root = getProjectRoot(req.params.id);
        const fullPath = path.join(root, filePath);

        if (!overwrite && existsSync(fullPath)) {
          skipped.push(filePath);
          continue;
        }

        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, file.buffer);
        uploaded.push(filePath);
      } catch (err) {
        errors.push(`${filePath}: ${String(err)}`);
      }
    }

    await updateProjectStats(req.params.id);
    res.json({ uploaded, skipped, errors });
  } catch (err) {
    req.log.error({ err }, "Failed to upload files");
    res.status(500).json({ error: "Failed to upload files" });
  }
});

// Upload ZIP file
router.post("/upload-zip", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });
    const overwrite = req.body.overwrite === "true" || req.body.overwrite === true;

    const uploaded: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    const zip = new AdmZip(file.buffer);
    const entries = zip.getEntries();
    const root = getProjectRoot(req.params.id);

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      // Strip top-level folder if all files share one
      let entryName = entry.entryName;
      // Remove leading slash
      entryName = entryName.replace(/^\//, "");

      try {
        const fullPath = path.join(root, entryName);

        if (!overwrite && existsSync(fullPath)) {
          skipped.push(entryName);
          continue;
        }

        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, entry.getData());
        uploaded.push(entryName);
      } catch (err) {
        errors.push(`${entryName}: ${String(err)}`);
      }
    }

    await updateProjectStats(req.params.id);
    res.json({ uploaded, skipped, errors });
  } catch (err) {
    req.log.error({ err }, "Failed to upload zip");
    res.status(500).json({ error: "Failed to upload zip" });
  }
});

// Get change history
router.get("/changes", async (req, res) => {
  try {
    const changes = await db
      .select()
      .from(fileChangesTable)
      .where(eq(fileChangesTable.projectId, req.params.id))
      .orderBy(fileChangesTable.timestamp);
    res.json(changes.reverse());
  } catch (err) {
    req.log.error({ err }, "Failed to get changes");
    res.status(500).json({ error: "Failed to get changes" });
  }
});

// Revert change
router.post("/changes/:changeId/revert", async (req, res) => {
  try {
    const [change] = await db
      .select()
      .from(fileChangesTable)
      .where(eq(fileChangesTable.id, req.params.changeId));

    if (!change) return res.status(404).json({ error: "Change not found" });
    if (!change.previousContent) {
      return res.status(400).json({ error: "No previous version to revert to" });
    }

    await writeFile(req.params.id, change.filePath, change.previousContent);

    // Record revert as a new change
    await db.insert(fileChangesTable).values({
      id: nanoid(),
      projectId: req.params.id,
      filePath: change.filePath,
      previousContent: change.newContent,
      newContent: change.previousContent,
      description: `Reverted to previous version`,
    });

    res.json({ success: true, message: "Reverted" });
  } catch (err) {
    req.log.error({ err }, "Failed to revert change");
    res.status(500).json({ error: "Failed to revert" });
  }
});

// Get preview entry
router.get("/preview-entry", async (req, res) => {
  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, req.params.id));

    const entryFile = project?.entryFile || await detectEntryFile(req.params.id);
    const url = `/api/preview/${req.params.id}/${entryFile || "index.html"}`;

    res.json({
      entryFile: entryFile || "index.html",
      url,
      generated: !entryFile,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get preview entry");
    res.status(500).json({ error: "Failed to get preview entry" });
  }
});

export default router;
