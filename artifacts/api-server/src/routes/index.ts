import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import projectsRouter from "./projects.js";
import filesRouter from "./files.js";
import aiRouter from "./ai.js";
import assetsRouter from "./assets.js";
import viteRouter from "./vite.js";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/projects", projectsRouter);
router.use("/projects/:id", filesRouter);
router.use("/projects/:id", aiRouter);
router.use("/projects/:id", assetsRouter);
router.use("/projects/:id", viteRouter);

// Public play lookup — resolves a slug to a project (for the SPA play page)
router.get("/play/:slug", async (req, res) => {
  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.publishedSlug, req.params.slug));
    if (!project || !project.publishedAt) {
      return res.status(404).json({ error: "Game not found or not published" });
    }
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: "Failed to look up game" });
  }
});

export default router;
