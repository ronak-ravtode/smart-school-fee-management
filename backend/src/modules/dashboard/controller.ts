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
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await dashboardService.getDefaults(page, limit);
    res.json(
      sendSuccess(result.data, "Defaulters fetched")
    );
  }
);

export const getRevenueBreakdown = asyncHandler(
  async (_req: Request, res: Response) => {
    const breakdown = await dashboardService.getRevenueBreakdown();
    res.json(sendSuccess(breakdown, "Revenue breakdown fetched"));
  }
);
