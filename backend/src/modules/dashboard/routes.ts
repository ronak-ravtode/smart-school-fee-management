import { Router } from "express";
import {
  getMetrics,
  getDefaults,
  getRevenueBreakdown,
} from "./controller";

const router = Router();

router.get("/metrics", getMetrics);
router.get("/defaults", getDefaults);
router.get("/revenue-breakdown", getRevenueBreakdown);

export { router as dashboardRoutes };
