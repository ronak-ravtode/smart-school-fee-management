import { Request, Response } from "express";
import { sendSuccess } from "@/utils/apiResponse";
import { asyncHandler } from "@/utils/asyncHandler";

export const getFeeStructures = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess([], "Fee structures fetched"));
  }
);

export const getFeeStructureById = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess(null, "Fee structure fetched"));
  }
);

export const createFeeStructure = asyncHandler(
  async (_req: Request, res: Response) => {
    res.status(201).json(sendSuccess(null, "Fee structure created"));
  }
);

export const updateFeeStructure = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess(null, "Fee structure updated"));
  }
);

export const deleteFeeStructure = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(sendSuccess(null, "Fee structure deleted"));
  }
);
