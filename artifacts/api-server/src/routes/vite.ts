import { Router, type IRouter } from "express";
import {
  isViteProject,
  getViteStatus,
  buildViteProject,
} from "../services/vite-manager.js";

const router: IRouter = Router({ mergeParams: true });

router.get("/vite/status", (req, res) => {
  const projectId = req.params.id;
  const vite = isViteProject(projectId);
  const { status, logs } = getViteStatus(projectId);
  res.json({ isViteProject: vite, status, logs });
});

router.post("/vite/build", async (req, res) => {
  const projectId = req.params.id;
  if (!isViteProject(projectId)) {
    return res.status(400).json({ error: "Not a Vite project" });
  }
  const { status } = getViteStatus(projectId);
  if (status === "installing" || status === "building") {
    return res.json({ message: "Build already in progress", status });
  }
  buildViteProject(projectId).catch(() => {});
  res.json({ message: "Build started", status: "installing" });
});

export default router;
