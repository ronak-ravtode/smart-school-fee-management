import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import * as dashboardService from "./service";

export const getMetrics = asyncHandler(
  async (_req: Request, res: Response) => {
    const metrics = await dashboardService.getMetrics();
    res.json(sendSuccess(metrics, "Dashboard metrics fetched"));
  }
);

export const getDefaults = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Number(req.query.limit) || 20;
    const data = await dashboardService.getDefaults(limit);
    res.json(sendSuccess(data, "Defaulters fetched"));
  }
);

export const getRevenueBreakdown = asyncHandler(
  async (_req: Request, res: Response) => {
    const breakdown = await dashboardService.getRevenueBreakdown();
    res.json(sendSuccess(breakdown, "Revenue breakdown fetched"));
  }
);

export const getRecoveryDefaulters = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await dashboardService.getRecoveryDefaulters();
    res.json(sendSuccess(result.data, "Recovery defaulters fetched"));
  }
);

export const getRevenueTimeline = asyncHandler(
  async (_req: Request, res: Response) => {
    const timeline = await dashboardService.getRevenueTimeline();
    res.json(sendSuccess(timeline, "Revenue timeline fetched"));
  }
);
