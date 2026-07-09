import { Router } from "express";
import {
  getMetrics,
  getDefaults,
  getRevenueBreakdown,
  getRecoveryDefaulters,
} from "./controller";

const router = Router();

router.get("/metrics", getMetrics);
router.get("/defaults", getDefaults);
router.get("/recovery", getRecoveryDefaulters);
router.get("/revenue-breakdown", getRevenueBreakdown);

export { router as dashboardRoutes };
