import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { nanoid } from "../lib/nanoid.js";
import { existsSync } from "fs";
import {
  ensureProjectDir,
  getProjectRoot,
  countFiles,
  detectEntryFile,
  copyProjectFiles,
} from "../services/filesystem.js";

function slugify(name: string, id: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = id.slice(0, 6);
  return base ? `${base}-${suffix}` : suffix;
}

const router: IRouter = Router();

// List all projects
router.get("/", async (req, res) => {
  try {
    const projects = await db
      .select()
      .from(projectsTable)
      .orderBy(projectsTable.updatedAt);
    res.json(projects.reverse());
  } catch (err) {
    req.log.error({ err }, "Failed to list projects");
    res.status(500).json({ error: "Failed to list projects" });
  }
});

// Create project
router.post("/", async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const id = nanoid();
    await ensureProjectDir(id);

    const [project] = await db
      .insert(projectsTable)
      .values({ id, name, description: description || null, fileCount: 0 })
      .returning();

    res.status(201).json(project);
  } catch (err) {
    req.log.error({ err }, "Failed to create project");
    res.status(500).json({ error: "Failed to create project" });
  }
});

// Get project
router.get("/:id", async (req, res) => {
  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, req.params.id));
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err) {
    req.log.error({ err }, "Failed to get project");
    res.status(500).json({ error: "Failed to get project" });
  }
});

// Update project
router.patch("/:id", async (req, res) => {
  try {
    const { name, description } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    // Refresh file count and entry file from disk
    const root = getProjectRoot(req.params.id);
    if (existsSync(root)) {
      const fileCount = await countFiles(root);
      const entryFile = await detectEntryFile(req.params.id);
      updates.fileCount = fileCount;
      if (entryFile) updates.entryFile = entryFile;
    }

    const [project] = await db
      .update(projectsTable)
      .set(updates)
      .where(eq(projectsTable.id, req.params.id))
      .returning();

    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err) {
    req.log.error({ err }, "Failed to update project");
    res.status(500).json({ error: "Failed to update project" });
  }
});

// Delete project
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(projectsTable).where(eq(projectsTable.id, id));

    // Delete files from disk
    try {
      const { rm } = await import("fs/promises");
      await rm(getProjectRoot(id), { recursive: true, force: true });
    } catch { /* ignore */ }

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete project");
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// Publish project — assigns a public slug and sets publishedAt
router.post("/:id/publish", async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Project not found" });

    // Reuse existing slug or create a new one
    const slug = existing.publishedSlug || slugify(existing.name, id);

    const [project] = await db
      .update(projectsTable)
      .set({ publishedSlug: slug, publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(projectsTable.id, id))
      .returning();

    res.json(project);
  } catch (err) {
    req.log.error({ err }, "Failed to publish project");
    res.status(500).json({ error: "Failed to publish project" });
  }
});

// Unpublish project — clears slug and publishedAt
router.delete("/:id/publish", async (req, res) => {
  try {
    const [project] = await db
      .update(projectsTable)
      .set({ publishedSlug: null, publishedAt: null, updatedAt: new Date() })
      .where(eq(projectsTable.id, req.params.id))
      .returning();

    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err) {
    req.log.error({ err }, "Failed to unpublish project");
    res.status(500).json({ error: "Failed to unpublish project" });
  }
});

// Duplicate project
router.post("/:id/duplicate", async (req, res) => {
  try {
    const [original] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, req.params.id));
    if (!original) return res.status(404).json({ error: "Project not found" });

    const newId = nanoid();
    await ensureProjectDir(newId);
    await copyProjectFiles(original.id, newId);

    const fileCount = await countFiles(getProjectRoot(newId));
    const [project] = await db
      .insert(projectsTable)
      .values({
        id: newId,
        name: `${original.name} (copy)`,
        description: original.description,
        entryFile: original.entryFile,
        fileCount,
      })
      .returning();

    res.status(201).json(project);
  } catch (err) {
    req.log.error({ err }, "Failed to duplicate project");
    res.status(500).json({ error: "Failed to duplicate project" });
  }
});

export default router;
