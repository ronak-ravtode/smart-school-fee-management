import { Router } from "express";
import {
  getMetrics,
  getDefaults,
  getRevenueBreakdown,
  getRecoveryDefaulters,
  getRevenueTimeline,
} from "./controller";

const router = Router();

router.get("/metrics", getMetrics);
router.get("/defaults", getDefaults);
router.get("/recovery", getRecoveryDefaulters);
router.get("/revenue-breakdown", getRevenueBreakdown);
router.get("/revenue-timeline", getRevenueTimeline);

export { router as dashboardRoutes };
