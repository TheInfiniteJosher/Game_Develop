import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import projectsRouter from "./projects.js";
import filesRouter from "./files.js";
import aiRouter from "./ai.js";
import assetsRouter from "./assets.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/projects", projectsRouter);
router.use("/projects/:id", filesRouter);
router.use("/projects/:id", aiRouter);
router.use("/projects/:id", assetsRouter);

export default router;
